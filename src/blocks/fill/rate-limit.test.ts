import { beforeEach, describe, expect, it } from "vitest";

import {
  FILL_LIMITS,
  checkScanAllowed,
  checkSubmitAllowed,
  createRateLimiter,
  forgetAllFillHits,
  identifyClient,
} from "./rate-limit";

const START = new Date("2026-09-06T09:00:00Z");

function later(seconds: number): Date {
  return new Date(START.getTime() + seconds * 1000);
}

describe("счётчик частоты", () => {
  it("пропускает, пока предел не выбран, и отказывает дальше", () => {
    // Arrange
    const limiter = createRateLimiter({
      maxHits: 2,
      windowSeconds: 60,
      maxTrackedKeys: 10,
    });

    // Act + Assert
    expect(limiter.hit("код", START).allowed).toBe(true);
    expect(limiter.hit("код", START).allowed).toBe(true);
    expect(limiter.hit("код", START).allowed).toBe(false);
  });

  it("называет, через сколько секунд повторять", () => {
    const limiter = createRateLimiter({
      maxHits: 1,
      windowSeconds: 60,
      maxTrackedKeys: 10,
    });
    limiter.hit("код", START);

    const verdict = limiter.hit("код", later(20));

    expect(verdict).toStrictEqual({ allowed: false, retryAfterSeconds: 40 });
  });

  it("окно кончается, и счёт начинается заново", () => {
    const limiter = createRateLimiter({
      maxHits: 1,
      windowSeconds: 60,
      maxTrackedKeys: 10,
    });
    limiter.hit("код", START);

    expect(limiter.hit("код", later(59)).allowed).toBe(false);
    expect(limiter.hit("код", later(60)).allowed).toBe(true);
  });

  it("считает каждый код отдельно", () => {
    const limiter = createRateLimiter({
      maxHits: 1,
      windowSeconds: 60,
      maxTrackedKeys: 10,
    });
    limiter.hit("первый", START);

    expect(limiter.hit("второй", START).allowed).toBe(true);
  });

  it("отказ не продлевает окно: молотить в закрытую дверь бесполезно", () => {
    // Иначе перебор держал бы честного сотрудника заблокированным бесконечно.
    const limiter = createRateLimiter({
      maxHits: 1,
      windowSeconds: 60,
      maxTrackedKeys: 10,
    });
    limiter.hit("код", START);
    limiter.hit("код", later(30));
    limiter.hit("код", later(50));

    expect(limiter.hit("код", later(60)).allowed).toBe(true);
  });

  it("память не растёт бесконечно: старые ключи вытесняются", () => {
    // Ключ приходит снаружи (код со наклейки, адрес клиента) — без потолка
    // достаточно перебора, чтобы съесть память процесса.
    const limiter = createRateLimiter({
      maxHits: 5,
      windowSeconds: 3600,
      maxTrackedKeys: 3,
    });

    for (let index = 0; index < 50; index += 1) {
      limiter.hit(`код-${String(index)}`, START);
    }

    expect(limiter.size()).toBe(3);
  });
});

describe("пределы публичного маршрута", () => {
  beforeEach(() => {
    forgetAllFillHits();
  });

  it("отправки с одного кода упираются в предел", () => {
    const { maxHits } = FILL_LIMITS.submitPerCode;
    for (let index = 0; index < maxHits; index += 1) {
      expect(checkSubmitAllowed("код", START).allowed).toBe(true);
    }

    const verdict = checkSubmitAllowed("код", START);

    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("предел на код не запирает соседнюю станцию", () => {
    for (
      let index = 0;
      index < FILL_LIMITS.submitPerCode.maxHits + 5;
      index += 1
    ) {
      checkSubmitAllowed("первый", START);
    }

    expect(checkSubmitAllowed("второй", START).allowed).toBe(true);
  });

  it("общий предел ловит поток с разных кодов", () => {
    const perCode = FILL_LIMITS.submitPerCode.maxHits;
    const total = FILL_LIMITS.submitEveryone.maxHits;
    let allowed = 0;
    for (let index = 0; index < total + perCode; index += 1) {
      // Свой код на каждую попытку: предел на код так не срабатывает ни разу.
      if (checkSubmitAllowed(`код-${String(index)}`, START).allowed)
        allowed += 1;
    }

    expect(allowed).toBe(total);
  });

  it("открытие экрана считается отдельно от отправки", () => {
    // Иначе перебор кодов через GET выбирал бы предел отправок и запирал бы кухню.
    for (let index = 0; index < FILL_LIMITS.scanPerClient.maxHits; index += 1) {
      checkScanAllowed("1.2.3.4", START);
    }

    expect(checkScanAllowed("1.2.3.4", START).allowed).toBe(false);
    expect(checkSubmitAllowed("код", START).allowed).toBe(true);
  });
});

describe("кто прислал запрос", () => {
  it("берёт первый адрес из цепочки прокси", () => {
    expect(identifyClient("203.0.113.7, 10.0.0.1", null)).toBe("203.0.113.7");
  });

  it("падает на прямой адрес, когда цепочки нет", () => {
    expect(identifyClient(null, "203.0.113.7")).toBe("203.0.113.7");
    expect(identifyClient("  ", "203.0.113.7")).toBe("203.0.113.7");
  });

  it("возвращает null, когда различить клиентов нечем", () => {
    // Не «все под одним ключом»: общий ключ превратил бы предел на клиента
    // в рубильник, гасящий всю сеть на пересменке.
    expect(identifyClient(null, null)).toBeNull();
    expect(identifyClient("", "  ")).toBeNull();
  });
});
