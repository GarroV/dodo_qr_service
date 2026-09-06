import { afterEach, describe, expect, test } from "vitest";

import {
  LOGIN_LIMITS,
  checkLoginAllowed,
  createLoginThrottle,
  forgetAllLoginFailures,
  forgetLoginFailures,
  registerLoginFailure,
} from "./rate-limit";

const CLIENT = "203.0.113.7";
const OTHER = "198.51.100.3";
const START = new Date("2026-09-06T10:00:00Z");
const SECOND = 1000;

function later(seconds: number): Date {
  return new Date(START.getTime() + seconds * SECOND);
}

const SMALL = { maxFailures: 3, windowSeconds: 60, maxTrackedClients: 4 };

afterEach(() => {
  forgetAllLoginFailures();
});

describe("createLoginThrottle", () => {
  test("до предела попытки проходят", () => {
    const throttle = createLoginThrottle(SMALL);

    for (let attempt = 0; attempt < SMALL.maxFailures; attempt++) {
      expect(throttle.check(CLIENT, START).allowed).toBe(true);
      throttle.registerFailure(CLIENT, START);
    }

    expect(throttle.check(CLIENT, START).allowed).toBe(false);
  });

  test("отказ говорит, через сколько можно повторить", () => {
    const throttle = createLoginThrottle(SMALL);
    for (let attempt = 0; attempt < SMALL.maxFailures; attempt++) {
      throttle.registerFailure(CLIENT, START);
    }

    const verdict = throttle.check(CLIENT, later(20));

    expect(verdict.allowed).toBe(false);
    // Окно отсчитывается от первой неудачи: 60 секунд минус прошедшие 20.
    expect(verdict.retryAfterSeconds).toBe(40);
  });

  test("когда окно кончилось, попытки снова проходят", () => {
    const throttle = createLoginThrottle(SMALL);
    for (let attempt = 0; attempt < SMALL.maxFailures; attempt++) {
      throttle.registerFailure(CLIENT, START);
    }

    expect(throttle.check(CLIENT, later(SMALL.windowSeconds)).allowed).toBe(
      true,
    );
  });

  test("удачный вход обнуляет счётчик того, кто вошёл", () => {
    const throttle = createLoginThrottle(SMALL);
    for (let attempt = 0; attempt < SMALL.maxFailures; attempt++) {
      throttle.registerFailure(CLIENT, START);
    }

    throttle.clear(CLIENT);

    expect(throttle.check(CLIENT, START).allowed).toBe(true);
  });

  test("счётчики разных клиентов не смешиваются", () => {
    const throttle = createLoginThrottle(SMALL);
    for (let attempt = 0; attempt < SMALL.maxFailures; attempt++) {
      throttle.registerFailure(CLIENT, START);
    }

    expect(throttle.check(OTHER, START).allowed).toBe(true);
  });

  test("хранилище не растёт без предела: адрес в заголовке подделывается", () => {
    const throttle = createLoginThrottle(SMALL);

    for (let index = 0; index < SMALL.maxTrackedClients * 3; index++) {
      throttle.registerFailure(`192.0.2.${String(index)}`, START);
    }

    expect(throttle.size()).toBe(SMALL.maxTrackedClients);
  });

  test("вытесняется самая старая запись, а не свежая", () => {
    const throttle = createLoginThrottle(SMALL);
    throttle.registerFailure("самый-старый", START);

    for (let index = 0; index < SMALL.maxTrackedClients; index++) {
      throttle.registerFailure(`192.0.2.${String(index)}`, later(1));
    }

    expect(throttle.check("самый-старый", later(1)).allowed).toBe(true);
    expect(throttle.size()).toBe(SMALL.maxTrackedClients);
  });
});

describe("общий предел поверх клиентского", () => {
  test("перебор с новых адресов упирается в общий предел", () => {
    // Заголовок с адресом подделывается, поэтому один только клиентский счётчик
    // обходится сменой адреса на каждую попытку. Общий потолок этого не позволяет.
    for (let index = 0; index < LOGIN_LIMITS.everyone.maxFailures; index++) {
      const invented = `192.0.2.${String(index)}`;
      expect(checkLoginAllowed(invented, START).allowed).toBe(true);
      registerLoginFailure(invented, START);
    }

    expect(checkLoginAllowed("203.0.113.250", START).allowed).toBe(false);
  });

  test("клиентский предел срабатывает раньше общего", () => {
    for (let index = 0; index < LOGIN_LIMITS.perClient.maxFailures; index++) {
      registerLoginFailure(CLIENT, START);
    }

    const verdict = checkLoginAllowed(CLIENT, START);

    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBe(
      LOGIN_LIMITS.perClient.windowSeconds,
    );
    // Соседу перебор одного клиента вход не закрывает.
    expect(checkLoginAllowed(OTHER, START).allowed).toBe(true);
  });

  test("удачный вход снимает и клиентский, и общий счётчик", () => {
    for (let index = 0; index < LOGIN_LIMITS.perClient.maxFailures; index++) {
      registerLoginFailure(CLIENT, START);
    }

    forgetLoginFailures(CLIENT);

    expect(checkLoginAllowed(CLIENT, START).allowed).toBe(true);
  });
});
