"use server";

// Серверные действия редактора. Каждое зовёт requireAdmin() само: действия выполняются
// мимо дерева разметки, и охрана в src/app/admin/layout.tsx их не закрывает.
//
// Наружу уходит код отказа, а не текст: экран двуязычный и сообщение выбирает он.
// Подробности отказа остаются в журнале сервера — браузеру знать их незачем.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/blocks/auth/guard";
import type { Section } from "@/blocks/data";

import type { EditorActionState } from "./action-state";
import { saveDraft, updateChecklist, createChecklist } from "./drafts";
import { duplicateChecklist } from "./duplicate";
import { publish } from "./publish";
import { CHECKLISTS_PATH, checklistPath } from "./routes";
import type { EditorErrorCode } from "./validation";
import { EditorInputError, LIMITS, parseSections } from "./validation";

const LIMIT_BY_CODE: Partial<Record<EditorErrorCode, number>> = {
  tooManySections: LIMITS.sections,
  tooManyItems: LIMITS.items,
  textTooLong: LIMITS.textLength,
};

function failure(error: unknown): EditorActionState {
  if (error instanceof EditorInputError) {
    const limit = LIMIT_BY_CODE[error.code];
    return {
      status: "failed",
      errorCode: error.code,
      ...(limit === undefined ? {} : { limit }),
    };
  }
  // Сбой, которого мы не предусмотрели: в браузер уходит общее сообщение, подробности —
  // в журнал сервера. Молча проглотить его нельзя: методист решит, что всё сохранилось.
  console.error("Редактор: непредвиденный сбой действия", error);
  return { status: "failed", errorCode: "unknown" };
}

function text(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

function sectionsFrom(form: FormData): Section[] {
  const raw = text(form, "sections");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new EditorInputError("badFormat", "Разметка пришла не как JSON");
  }
  return parseSections(parsed);
}

function stationFrom(form: FormData): string | null {
  const value = text(form, "stationId");
  return value === "" ? null : value;
}

function windowFrom(form: FormData): { start: string; end: string } {
  return { start: text(form, "windowStart"), end: text(form, "windowEnd") };
}

/** Заведение чек-листа с экрана «Новый чек-лист». Успех уводит сразу в редактор. */
export async function submitCreateChecklist(
  _previous: EditorActionState,
  form: FormData,
): Promise<EditorActionState> {
  await requireAdmin();

  let checklistId: string;
  try {
    checklistId = await createChecklist({
      stationId: stationFrom(form),
      title: { [text(form, "locale")]: text(form, "title") },
      window: windowFrom(form),
    });
  } catch (error) {
    return failure(error);
  }

  // redirect() бросает исключение управления потоком — он обязан быть вне try/catch,
  // иначе переход будет пойман как отказ и методист останется на пустой форме.
  revalidatePath(CHECKLISTS_PATH);
  redirect(checklistPath(checklistId));
}

/** «Сохранить черновик»: свойства чек-листа и разметка уходят одним действием. */
export async function submitSaveDraft(
  _previous: EditorActionState,
  form: FormData,
): Promise<EditorActionState> {
  await requireAdmin();

  try {
    const checklistId = text(form, "checklistId");
    const sections = sectionsFrom(form);
    await updateChecklist(checklistId, {
      stationId: stationFrom(form),
      title: { [text(form, "locale")]: text(form, "title") },
      window: windowFrom(form),
    });
    await saveDraft(checklistId, sections);
    revalidatePath(checklistPath(checklistId));
    return { status: "saved" };
  } catch (error) {
    return failure(error);
  }
}

/**
 * «Опубликовать»: сначала сохраняется то, что на экране, потом создаётся версия.
 * Иначе опубликовалось бы прошлое сохранение, а методист смотрел бы на свежие правки.
 */
export async function submitPublish(
  _previous: EditorActionState,
  form: FormData,
): Promise<EditorActionState> {
  await requireAdmin();

  try {
    const checklistId = text(form, "checklistId");
    const sections = sectionsFrom(form);
    await updateChecklist(checklistId, {
      stationId: stationFrom(form),
      title: { [text(form, "locale")]: text(form, "title") },
      window: windowFrom(form),
    });
    await saveDraft(checklistId, sections);
    const version = await publish(checklistId);
    revalidatePath(checklistPath(checklistId));
    return {
      status: "published",
      ...(version.versionNumber === null
        ? {}
        : { versionNumber: version.versionNumber }),
    };
  } catch (error) {
    return failure(error);
  }
}

/** Дублирование со списка чек-листов. Успех открывает копию в редакторе. */
export async function submitDuplicate(
  _previous: EditorActionState,
  form: FormData,
): Promise<EditorActionState> {
  await requireAdmin();

  let copyId: string;
  try {
    copyId = await duplicateChecklist(text(form, "checklistId"));
  } catch (error) {
    return failure(error);
  }

  revalidatePath(CHECKLISTS_PATH);
  redirect(checklistPath(copyId));
}
