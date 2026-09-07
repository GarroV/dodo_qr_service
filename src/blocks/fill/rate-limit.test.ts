import { beforeEach, describe, expect, it } from "vitest";

import {
  FILL_LIMITS,
  checkScanAllowed,
  checkSubmitAllowed,
  createRateLimiter,
  forgetAllFillHits,
  identifyClient,
  trustedProxyHops,
} from "./rate-limit";

const START = new Date("2026-09-06T09:00:00Z");

function later(seconds: number): Date {
  return new Date(START.getTime() + seconds * 1000);
}

/** Открытие экрана с подставленным началом цепочки: один объявленный посредник. */
function scan(forged: string): boolean {
  const client = identifyClient({
    forwardedFor: `${forged}, 198.51.100.4`,
    peerAddress: null,
    trustedProxyHops: 1,
  });
  return client === null || checkScanAllowed(client, START).allowed;
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
  const PROXY = { forwardedFor: null, peerAddress: null, trustedProxyHops: 0 };

  it("без объявленного посредника заголовку не верит вовсе", () => {
    // Заголовок задаёт сам клиент. Пока площадка не сказала, что перед продуктом
    // стоит посредник, который его переписывает, верить в нём нечему.
    expect(
      identifyClient({ ...PROXY, forwardedFor: "203.0.113.7, 10.0.0.1" }),
    ).toBeNull();
  });

  it("без посредника берёт адрес соединения, если среда его даёт", () => {
    expect(
      identifyClient({
        ...PROXY,
        forwardedFor: "203.0.113.7",
        peerAddress: "198.51.100.4",
      }),
    ).toBe("198.51.100.4");
  });

  it("подделанная цепочка не даёт нового ключа", () => {
    // Один посредник: свой адрес он дописывает последним, всё левее — то, что
    // прислал клиент. Сколько бы он ни выдумал, ключ остаётся один и тот же.
    const keys = new Set(
      ["9.9.9.9", "8.8.8.8, 7.7.7.7", "не адрес", "203.0.113.7"].map((forged) =>
        identifyClient({
          forwardedFor: `${forged}, 198.51.100.4`,
          peerAddress: null,
          trustedProxyHops: 1,
        }),
      ),
    );

    expect([...keys]).toStrictEqual(["198.51.100.4"]);
  });

  it("цепочка короче объявленной — не от нашего посредника", () => {
    // Два посредника объявлено, а в цепочке одно звено: её писал не тот, кому верим.
    expect(
      identifyClient({
        forwardedFor: "9.9.9.9",
        peerAddress: "198.51.100.4",
        trustedProxyHops: 2,
      }),
    ).toBe("198.51.100.4");
  });

  it("возвращает null, когда различить клиентов нечем", () => {
    // Не «все под одним ключом»: общий ключ превратил бы предел на клиента
    // в рубильник, гасящий всю сеть на пересменке.
    expect(identifyClient(PROXY)).toBeNull();
    expect(
      identifyClient({ ...PROXY, forwardedFor: "", peerAddress: "  " }),
    ).toBeNull();
  });

  it("подделка заголовка не обходит предел на открытие экрана", () => {
    for (let index = 0; index < FILL_LIMITS.scanPerClient.maxHits; index += 1) {
      scan(`9.9.9.${String(index)}`);
    }

    expect(scan("9.9.9.250")).toBe(false);
  });
});

describe("сколько посредников объявила площадка", () => {
  it("не задано — ноль: заголовку не верим, пока не сказано обратное", () => {
    expect(trustedProxyHops({})).toBe(0);
  });

  it("читает объявленное число", () => {
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "1" })).toBe(1);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: " 2 " })).toBe(2);
  });

  it("отказывает на негодном значении, а не считает его нулём", () => {
    // Тихий ноль означал бы молча выключенный предел — ровно то, что и хотели
    // перестать допускать.
    for (const value of ["", "-1", "полтора", "1,5", "99"]) {
      expect(() => trustedProxyHops({ TRUSTED_PROXY_HOPS: value })).toThrow(
        /TRUSTED_PROXY_HOPS/,
      );
    }
  });
});
