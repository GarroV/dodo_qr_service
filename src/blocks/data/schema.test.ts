// Правила целостности проверяются на настоящей базе: индексы и ограничения живут
// в PostgreSQL, а не в коде, и заглушкой их не проверить.
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import {
  checklistVersions,
  checklists,
  countries,
  stations,
  stores,
  submissions,
} from "./schema";
import { closeTestDb, getTestDb } from "./testing/db";
import {
  PG_CHECK_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  dbErrorCode,
} from "./testing/errors";
import {
  createChecklist,
  createStation,
  sampleSections,
  uniqueStationCode,
} from "./testing/fixtures";

const db = getTestDb();

afterAll(closeTestDb);

async function publishedVersion(
  checklistId: string,
  versionNumber: number,
): Promise<void> {
  await db.insert(checklistVersions).values({
    checklistId,
    status: "published",
    versionNumber,
    sections: sampleSections(`v${String(versionNumber)}`),
    publishedAt: new Date(),
  });
}

describe("миграции", () => {
  test("создают все семь таблиц продукта", async () => {
    const rows = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = rows.rows.map((row) => row.table_name);

    for (const table of [
      "countries",
      "stores",
      "stations",
      "checklists",
      "checklist_versions",
      "blocks",
      "submissions",
    ]) {
      expect(names).toContain(table);
    }
  });
});

describe("одна опубликованная версия на чек-лист", () => {
  test("вторая опубликованная версия падает на уровне базы", async () => {
    const checklistId = await createChecklist();
    await publishedVersion(checklistId, 1);

    const code = await dbErrorCode(publishedVersion(checklistId, 2));

    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });

  test("архивные версии не мешают ни друг другу, ни опубликованной", async () => {
    const checklistId = await createChecklist();
    await db.insert(checklistVersions).values([
      {
        checklistId,
        status: "archived",
        versionNumber: 1,
        sections: sampleSections("a1"),
        publishedAt: new Date(),
      },
      {
        checklistId,
        status: "archived",
        versionNumber: 2,
        sections: sampleSections("a2"),
        publishedAt: new Date(),
      },
    ]);

    await expect(publishedVersion(checklistId, 3)).resolves.not.toThrow();
  });

  test("второй черновик одного чек-листа падает на уровне базы", async () => {
    const checklistId = await createChecklist();
    const draft = {
      checklistId,
      status: "draft" as const,
      sections: sampleSections("d"),
    };
    await db.insert(checklistVersions).values(draft);

    const code = await dbErrorCode(db.insert(checklistVersions).values(draft));

    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });

  test("у разных чек-листов свои опубликованные версии не конфликтуют", async () => {
    const first = await createChecklist();
    const second = await createChecklist();
    await publishedVersion(first, 1);

    await expect(publishedVersion(second, 1)).resolves.not.toThrow();
  });
});

describe("номер версии и признак публикации согласованы", () => {
  test("черновик с номером версии не вставляется", async () => {
    const checklistId = await createChecklist();

    const code = await dbErrorCode(
      db.insert(checklistVersions).values({
        checklistId,
        status: "draft",
        versionNumber: 1,
        sections: [],
      }),
    );

    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  test("опубликованная версия без номера не вставляется", async () => {
    const checklistId = await createChecklist();

    const code = await dbErrorCode(
      db.insert(checklistVersions).values({
        checklistId,
        status: "published",
        sections: [],
        publishedAt: new Date(),
      }),
    );

    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  test("номер версии внутри чек-листа не повторяется", async () => {
    const checklistId = await createChecklist();
    await db.insert(checklistVersions).values({
      checklistId,
      status: "archived",
      versionNumber: 1,
      sections: [],
      publishedAt: new Date(),
    });

    const code = await dbErrorCode(publishedVersion(checklistId, 1));

    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });
});

describe("окно времени чек-листа", () => {
  test("равные границы окна база не принимает: такой чек-лист не отдался бы никогда", async () => {
    // window_start = window_end делает условие выбора версии всегда ложным, и чек-лист
    // молча не открывается ни на одной станции. Отказ базы вместо недели поисков.
    const code = await dbErrorCode(
      db.insert(checklists).values({
        stationId: null,
        title: { ru: "Окно в ноль", en: "Zero window" },
        windowStart: "08:00:00",
        windowEnd: "08:00:00",
      }),
    );

    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  test("окно через полночь остаётся разрешённым", async () => {
    // Ограничение запрещает только равные границы: 22:00–02:00 — обычное окно
    // вечерней смены, и запретить конец раньше начала было бы поломкой продукта.
    await expect(
      db.insert(checklists).values({
        stationId: null,
        title: { ru: "Ночное окно", en: "Night window" },
        windowStart: "22:00:00",
        windowEnd: "02:00:00",
      }),
    ).resolves.not.toThrow();
  });
});

describe("справочник и история защищены от каскадного удаления", () => {
  test("страну с пиццериями удалить нельзя", async () => {
    const fixture = await createStation();

    const code = await dbErrorCode(
      db.delete(countries).where(eq(countries.id, fixture.countryId)),
    );

    expect(code).toBe(PG_FOREIGN_KEY_VIOLATION);
  });

  test("станцию с заполнениями удалить нельзя: история неприкосновенна", async () => {
    const fixture = await createStation();
    const checklistId = await createChecklist({ stationId: fixture.stationId });
    const sections = sampleSections("hist");
    const [version] = await db
      .insert(checklistVersions)
      .values({
        checklistId,
        status: "published",
        versionNumber: 1,
        sections,
        publishedAt: new Date(),
      })
      .returning({ id: checklistVersions.id });
    await db.insert(submissions).values({
      versionId: version?.id ?? "",
      stationId: fixture.stationId,
      snapshot: sections,
      answers: [],
      startedAt: new Date(),
    });

    const code = await dbErrorCode(
      db.delete(stations).where(eq(stations.id, fixture.stationId)),
    );

    expect(code).toBe(PG_FOREIGN_KEY_VIOLATION);
  });

  test("удаление станции отвязывает чек-лист, но не удаляет его", async () => {
    const fixture = await createStation();
    const checklistId = await createChecklist({ stationId: fixture.stationId });

    await db.delete(stations).where(eq(stations.id, fixture.stationId));

    const [checklist] = await db
      .select({ stationId: checklists.stationId })
      .from(checklists)
      .where(eq(checklists.id, checklistId));
    expect(checklist?.stationId).toBeNull();
  });
});

describe("код станции", () => {
  test("не повторяется между станциями", async () => {
    const first = await createStation();
    const [code] = await db
      .select({ code: stations.code })
      .from(stations)
      .where(eq(stations.id, first.stationId));
    const second = await createStation();

    const failure = await dbErrorCode(
      db
        .update(stations)
        .set({ code: code?.code ?? uniqueStationCode() })
        .where(eq(stations.id, second.stationId)),
    );

    expect(failure).toBe(PG_UNIQUE_VIOLATION);
  });
});

describe("JSONB хранит разметку чек-листа без потерь", () => {
  test("секции читаются обратно тем же объектом", async () => {
    const checklistId = await createChecklist();
    const sections = sampleSections("roundtrip");
    const [inserted] = await db
      .insert(checklistVersions)
      .values({ checklistId, status: "draft", sections })
      .returning({ id: checklistVersions.id });

    const [row] = await db
      .select({ sections: checklistVersions.sections })
      .from(checklistVersions)
      .where(eq(checklistVersions.id, inserted?.id ?? ""));

    expect(row?.sections).toStrictEqual(sections);
  });
});

describe("пиццерия и станция", () => {
  test("станция принадлежит существующей пиццерии", async () => {
    const code = await dbErrorCode(
      db.insert(stores).values({
        countryId: "00000000-0000-0000-0000-000000000000",
        name: "Пиццерия без страны",
      }),
    );

    expect(code).toBe(PG_FOREIGN_KEY_VIOLATION);
  });
});
