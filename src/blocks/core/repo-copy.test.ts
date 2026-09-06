import path from "node:path";

import { describe, expect, test } from "vitest";

import { repositoryCopyId, repositoryRoot } from "./repo-copy";

const HEX_ID = /^[\da-f]{8}$/;

describe("идентификатор копии репозитория", () => {
  test("корень копии — каталог, в котором лежит package.json проекта", () => {
    expect(path.resolve(repositoryRoot())).toBe(path.resolve(process.cwd()));
  });

  test("значение устойчиво: два вызова подряд дают одно и то же", () => {
    expect(repositoryCopyId()).toBe(repositoryCopyId());
  });

  test("значение короткое и годится в имя базы PostgreSQL", () => {
    expect(repositoryCopyId()).toMatch(HEX_ID);
  });

  test("две копии репозитория получают разные значения", () => {
    const first = repositoryCopyId("/Users/kto-to/projects/dodo_qr_service");
    const second = repositoryCopyId("/Users/kto-to/worktrees/dodo_qr_service");

    expect(first).not.toBe(second);
    expect(first).toMatch(HEX_ID);
    expect(second).toMatch(HEX_ID);
  });

  test("одинаковый путь с завершающим слэшем и без него — одно значение", () => {
    expect(repositoryCopyId("/tmp/copy/")).toBe(repositoryCopyId("/tmp/copy"));
  });
});
