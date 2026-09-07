import { afterEach, describe, expect, it } from "vitest";

import { redirectPath } from "./base-path";

const previous = process.env["BASE_PATH"];

afterEach(() => {
  if (previous === undefined) delete process.env["BASE_PATH"];
  else process.env["BASE_PATH"] = previous;
});

describe("путь перенаправления при опубликованном базовом пути", () => {
  it("на обычной площадке путь не меняется", () => {
    delete process.env["BASE_PATH"];
    expect(redirectPath("/admin")).toBe("/admin");
  });

  it("приставляет базовый путь площадки", () => {
    // Иначе вход срабатывает, а человек оказывается на корне адреса —
    // на площадке там живёт соседний сервис (D045).
    process.env["BASE_PATH"] = "/qr";
    expect(redirectPath("/admin")).toBe("/qr/admin");
    expect(redirectPath("/admin/login")).toBe("/qr/admin/login");
  });

  it("не двоит косые, как бы путь ни записали в окружении", () => {
    process.env["BASE_PATH"] = "qr/";
    expect(redirectPath("/admin")).toBe("/qr/admin");
  });
});
