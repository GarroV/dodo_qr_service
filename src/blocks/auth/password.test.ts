import { describe, expect, test } from "vitest";

import { hashPassword, verifyPassword } from "./password";

// Параметры слабее рабочих: тесту нужна проверяемая логика, а не стойкость к перебору.
// Формат хранит параметры внутри строки, поэтому рабочий хэш проверяется тем же кодом.
const TEST_PARAMS = { cost: 1024, blockSize: 8, parallelization: 1 } as const;
const PASSWORD = "правильный-пароль-методиста";

async function testHash(password = PASSWORD): Promise<string> {
  return hashPassword(password, TEST_PARAMS);
}

describe("hashPassword", () => {
  test("выдаёт строку с именем алгоритма и параметрами, но без самого пароля", async () => {
    const stored = await testHash();

    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).toContain("1024");
    expect(stored).not.toContain(PASSWORD);
  });

  test("на один и тот же пароль даёт разные хэши — соль случайная", async () => {
    expect(await testHash()).not.toBe(await testHash());
  });
});

describe("verifyPassword", () => {
  test("принимает верный пароль", async () => {
    await expect(verifyPassword(PASSWORD, await testHash())).resolves.toBe(
      true,
    );
  });

  test("отвергает неверный пароль", async () => {
    await expect(
      verifyPassword("другой-пароль", await testHash()),
    ).resolves.toBe(false);
  });

  test("отвергает пароль, отличающийся одним знаком", async () => {
    await expect(
      verifyPassword(`${PASSWORD}!`, await testHash()),
    ).resolves.toBe(false);
  });

  test("отвергает пустой пароль", async () => {
    await expect(verifyPassword("", await testHash())).resolves.toBe(false);
  });

  test("проверяет хэш, посчитанный с рабочими параметрами, теми же параметрами", async () => {
    const stored = await hashPassword(PASSWORD, {
      cost: 2048,
      blockSize: 8,
      parallelization: 2,
    });

    await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(true);
    await expect(verifyPassword("другой-пароль", stored)).resolves.toBe(false);
  });

  test("на испорченном хэше падает с внятной ошибкой, а не молча пускает", async () => {
    for (const broken of [
      "",
      "не-хэш",
      "scrypt$1024$8",
      "bcrypt$1024$8$1$c29sdA$aGFzaA",
    ]) {
      await expect(verifyPassword(PASSWORD, broken)).rejects.toThrow(
        /ADMIN_PASSWORD_HASH/,
      );
    }
  });

  test("отвергает хэш с нечисловыми параметрами scrypt", async () => {
    const [, , blockSize, parallelization, salt, key] = (
      await testHash()
    ).split("$");
    const broken = [
      "scrypt",
      "не-число",
      blockSize,
      parallelization,
      salt,
      key,
    ].join("$");

    await expect(verifyPassword(PASSWORD, broken)).rejects.toThrow(
      /ADMIN_PASSWORD_HASH/,
    );
  });

  test("отвергает хэш с солью или ключом не той длины", async () => {
    await expect(
      verifyPassword(PASSWORD, "scrypt$1024$8$1$c29sdA$aGFzaA"),
    ).rejects.toThrow(/ADMIN_PASSWORD_HASH/);
  });

  test("ошибка про испорченный хэш не выносит наружу ни пароль, ни сам хэш", async () => {
    const stored = await testHash();
    const broken = `bcrypt$${stored.split("$").slice(1).join("$")}`;

    const error = await verifyPassword(PASSWORD, broken).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(Error);
    const text = `${String(error)} ${JSON.stringify((error as Error).message)}`;
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(broken.split("$").at(-1));
  });
});

// Проверка не на конкретную реализацию, а на наблюдаемое снаружи: неверный пароль
// не отвечает быстрее верного. Берётся минимум выборки — он устойчив к посторонней
// нагрузке на машине, в отличие от среднего.
async function minDuration(
  password: string,
  stored: string,
  runs: number,
): Promise<number> {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < runs; index += 1) {
    const started = performance.now();
    await verifyPassword(password, stored);
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

describe("сравнение постоянного времени", () => {
  test("неверный пароль отвечает не быстрее верного", async () => {
    const stored = await hashPassword(PASSWORD, {
      cost: 16_384,
      blockSize: 8,
      parallelization: 1,
    });
    await minDuration(PASSWORD, stored, 2); // прогрев

    const right = await minDuration(PASSWORD, stored, 7);
    // Три вида неверного: другой длины, той же длины, отличающийся одним знаком в конце.
    const wrong = Math.min(
      await minDuration("x", stored, 7),
      await minDuration("п".repeat(PASSWORD.length), stored, 7),
      await minDuration(`${PASSWORD.slice(0, -1)}!`, stored, 7),
    );

    // Ранний выход по длине или посимвольное сравнение дают разрыв в разы,
    // а не в проценты: порог ловит именно это, не придираясь к шуму планировщика.
    expect(wrong).toBeGreaterThan(right * 0.7);
    expect(right).toBeGreaterThan(1);
  });
});
