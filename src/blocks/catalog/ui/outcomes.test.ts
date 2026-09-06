// Правило, которое иначе живёт только в живом клике: отказ «нужно подтверждение»
// обязан превращаться в карточку подтверждения, а не в красную полосу с ошибкой.
import { describe, expect, test } from "vitest";

import { CatalogError } from "../errors";
import { afterDeleteStoreFailure, formField } from "./outcomes";

const BASE = { countryId: "c", storeId: "s", focus: "store" } as const;

describe("поле формы", () => {
  test("строка приходит как есть, отсутствие поля — пустой строкой", () => {
    const form = new FormData();
    form.set("name", "Алматы, Абая 44");

    expect(formField(form, "name")).toBe("Алматы, Абая 44");
    expect(formField(form, "нет-такого")).toBe("");
  });

  test("файл вместо строки не роняет действие", () => {
    // Форму отправляет браузер, но подделать её может кто угодно: поле-файл
    // не должно приводить к исключению вместо понятного отказа.
    const form = new FormData();
    form.set("name", new File(["данные"], "name.txt"));

    expect(formField(form, "name")).toBe("");
  });
});

describe("отказ при удалении пиццерии", () => {
  test("требование подтверждения ведёт к карточке подтверждения, а не к ошибке", () => {
    const view = afterDeleteStoreFailure(
      BASE,
      new CatalogError("confirmationRequired", "есть станции"),
    );

    expect(view.confirm).toBe("store");
    expect(view.error).toBeUndefined();
  });

  test("запрет по истории ведёт к тексту отказа, а не к подтверждению", () => {
    // Иначе методист получил бы карточку «удалить вместе со станциями?», нажал бы
    // «Удалить» и упёрся бы в тот же отказ — только уже с ощущением, что сломалось.
    const view = afterDeleteStoreFailure(
      BASE,
      new CatalogError("referencedByHistory", "есть заполнения"),
    );

    expect(view.error).toBe("referencedByHistory");
    expect(view.confirm).toBeUndefined();
  });

  test("исходное место в дереве сохраняется в обоих случаях", () => {
    for (const code of [
      "confirmationRequired",
      "referencedByHistory",
    ] as const) {
      const view = afterDeleteStoreFailure(BASE, new CatalogError(code, "…"));

      expect(view.countryId).toBe(BASE.countryId);
      expect(view.storeId).toBe(BASE.storeId);
      expect(view.focus).toBe(BASE.focus);
    }
  });
});
