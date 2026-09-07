// Удаление чек-листа на настоящей базе.
//
// Правило, которое здесь закрепляется: заполнения не исчезают никогда (принцип 3, D002).
// Поэтому удаление ведёт себя по-разному, и разница проверяется, а не подразумевается:
// чек-лист без заполнений стирается целиком, а чек-лист с историей уходит из работы,
// но остаётся в базе — иначе в ленте появились бы заполнения, ведущие в никуда.
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import {
  checklistVersions,
  checklists,
  saveSubmission,
  submissions,
} from "@/blocks/data";
import { closeTestDb, getTestDb } from "@/blocks/data/testing/db";
import {
  createChecklist,
  createDraft,
  createPublishedVersion,
  createStation,
  sampleSections,
} from "@/blocks/data/testing/fixtures";

import { previewRemoval, removeChecklist } from "./removal";
import { EditorInputError } from "./validation";

const db = getTestDb();

afterAll(closeTestDb);

async function checklistRow(
  id: string,
): Promise<{ archivedAt: Date | null } | undefined> {
  const rows = await db
    .select({ archivedAt: checklists.archivedAt })
    .from(checklists)
    .where(eq(checklists.id, id));
  return rows[0];
}

async function versionCount(checklistId: string): Promise<number> {
  const rows = await db
    .select({ id: checklistVersions.id })
    .from(checklistVersions)
    .where(eq(checklistVersions.checklistId, checklistId));
  return rows.length;
}

describe("removeChecklist", () => {
  test("чек-лист без заполнений удаляется целиком, вместе с версиями", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
    });
    await createDraft(checklistId, sampleSections("черновик"));
    await createPublishedVersion(checklistId, sampleSections("версия"));

    const outcome = await removeChecklist(checklistId);

    expect(outcome).toBe("deleted");
    expect(await checklistRow(checklistId)).toBeUndefined();
    expect(await versionCount(checklistId)).toBe(0);
  });

  test("чек-лист с заполнениями снимается с работы, но история остаётся", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
    });
    await createDraft(checklistId, sampleSections("черновик"));
    const versionId = await createPublishedVersion(
      checklistId,
      sampleSections("версия"),
    );
    const submissionId = await saveSubmission({
      versionId,
      answers: [{ itemId: "item-версия", value: true, at: Date.now() }],
      startedAt: Date.now(),
    });

    const outcome = await removeChecklist(checklistId);

    expect(outcome).toBe("archived");

    const row = await checklistRow(checklistId);
    expect(row?.archivedAt).toBeInstanceOf(Date);

    // Ни одно заполнение и ни одна версия не тронуты: лента продолжает их показывать.
    const kept = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(eq(submissions.id, submissionId));
    expect(kept).toHaveLength(1);
    expect(await versionCount(checklistId)).toBe(2);
  });

  test("повторное удаление снятого с работы чек-листа не ломается и не меняет времени", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
    });
    const versionId = await createPublishedVersion(
      checklistId,
      sampleSections("версия"),
    );
    await saveSubmission({
      versionId,
      answers: [{ itemId: "item-версия", value: true, at: Date.now() }],
      startedAt: Date.now(),
    });

    await removeChecklist(checklistId);
    const first = (await checklistRow(checklistId))?.archivedAt;
    const again = await removeChecklist(checklistId);

    expect(again).toBe("archived");
    expect((await checklistRow(checklistId))?.archivedAt).toStrictEqual(first);
  });

  test("несуществующий чек-лист — отказ с кодом, а не молчаливый успех", async () => {
    await expect(
      removeChecklist("00000000-0000-4000-8000-000000000000"),
    ).rejects.toBeInstanceOf(EditorInputError);
  });

  test("нечитаемый идентификатор до базы не доходит", async () => {
    await expect(removeChecklist("не-uuid")).rejects.toBeInstanceOf(
      EditorInputError,
    );
  });
});

describe("previewRemoval", () => {
  test("без заполнений обещает полное удаление и называет чек-лист", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
      title: { ru: "Открытие кухни", en: "Kitchen opening" },
    });
    await createDraft(checklistId, sampleSections("черновик"));

    const preview = await previewRemoval(checklistId);

    expect(preview).toStrictEqual({
      submissionCount: 0,
      archived: false,
      outcome: "deleted",
      title: { ru: "Открытие кухни", en: "Kitchen opening" },
    });
  });

  test("с заполнениями обещает снятие с работы и называет их число", async () => {
    // Число показывается методисту до нажатия: «удалить» и «убрать из работы» —
    // разные вещи, и выясняться они не должны после того, как он нажал.
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
    });
    const versionId = await createPublishedVersion(
      checklistId,
      sampleSections("версия"),
    );
    for (let count = 0; count < 2; count += 1) {
      await saveSubmission({
        versionId,
        answers: [{ itemId: "item-версия", value: true, at: Date.now() }],
        startedAt: Date.now(),
      });
    }

    const preview = await previewRemoval(checklistId);

    expect(preview.submissionCount).toBe(2);
    expect(preview.outcome).toBe("archived");
    expect(preview.archived).toBe(false);
  });

  test("уже снятый с работы виден как снятый", async () => {
    const station = await createStation();
    const checklistId = await createChecklist({
      stationId: station.stationId,
    });
    const versionId = await createPublishedVersion(
      checklistId,
      sampleSections("версия"),
    );
    await saveSubmission({
      versionId,
      answers: [{ itemId: "item-версия", value: true, at: Date.now() }],
      startedAt: Date.now(),
    });
    await removeChecklist(checklistId);

    const preview = await previewRemoval(checklistId);

    expect(preview.archived).toBe(true);
    expect(preview.outcome).toBe("archived");
  });

  test("несуществующий чек-лист — отказ, а не пустой экран подтверждения", async () => {
    await expect(
      previewRemoval("00000000-0000-4000-8000-000000000000"),
    ).rejects.toBeInstanceOf(EditorInputError);
  });
});
