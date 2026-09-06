// Отправка заполнения: единственная точка записи продукта, открытая интернету.
//
// Порядок проверок здесь — не стилистика, а защита. Сначала форма тела (дёшево, без базы),
// потом частота (тоже без базы), и только затем два запроса. Иначе поток мусора с улицы
// доходил бы до пула соединений раньше, чем до отказа.
import {
  countFailedCritical,
  getSubmission,
  saveSubmission,
} from "@/blocks/data";

import { checkSubmitAllowed } from "./rate-limit";
import { findStationVersion } from "./station";
import type { FillRefusal } from "./validation";
import {
  clampStartedAt,
  matchAnswersToSnapshot,
  parseSubmission,
} from "./validation";

/**
 * Что узнаёт браузер об исходе.
 *
 * Ни идентификатора заполнения, ни названия станции, ни числа пунктов сверх того,
 * что сотрудник и так только что видел: ответ на публичном маршруте — это ровно то,
 * что узнаёт любой, кто подобрал код (D021). Отказы неразличимы по форме: у всех
 * один набор полей, поэтому перебор не отличает «кода нет» от «код есть, но не тот».
 */
export type SubmitOutcome =
  | {
      readonly kind: "saved";
      /** Время сервера, прочитанное обратно из базы: экран показывает то, что записано. */
      readonly submittedAt: number;
      readonly durationMs: number;
      readonly failedCritical: number;
    }
  | {
      readonly kind: "refused";
      readonly reason: FillRefusal;
      readonly retryAfterSeconds: number;
    };

function refuse(reason: FillRefusal, retryAfterSeconds = 0): SubmitOutcome {
  return { kind: "refused", reason, retryAfterSeconds };
}

/**
 * Принимает заполнение и записывает его на версию, отданную клиенту.
 *
 * Версия приходит из браузера, то есть от кого угодно, — поэтому она принимается,
 * только если её замороженная станция совпадает со станцией отсканированного кода
 * (`findStationVersion`). Архивная версия проходит намеренно: это и есть T041 —
 * пока сотрудник заполнял, методист опубликовал следующую, и заполнение обязано
 * лечь на ту, что была на экране, вместе со снимком её пунктов (принцип 3, D002).
 */
export async function submitFilling(
  input: unknown,
  now: Date,
): Promise<SubmitOutcome> {
  const parsed = parseSubmission(input);
  if (!parsed.ok) return refuse(parsed.reason);

  const { code, versionId, startedAt, answers } = parsed.value;

  const rate = checkSubmitAllowed(code, now);
  if (!rate.allowed) return refuse("rate-limited", rate.retryAfterSeconds);

  const version = await findStationVersion(code, versionId);
  // Неизвестный код, перевыпущенный код и версия чужой станции дают один отказ:
  // различать их значило бы отвечать перебору по-разному.
  if (version === null) return refuse("unknown-code");

  const checked = matchAnswersToSnapshot(version.sections, answers);
  if (!checked.ok) return refuse(checked.reason);

  const submissionId = await saveSubmission({
    versionId: version.versionId,
    answers: [...checked.value],
    startedAt: clampStartedAt(startedAt, now),
  });

  // Время и длительность читаются обратно из базы, а не считаются здесь: на экране
  // сотрудника должно стоять то, что легло в историю, а не то, что показали часы
  // приложения (отметки времени продукта — серверные, `now()` базы).
  const saved = await getSubmission(submissionId);
  if (saved === null) return refuse("malformed");

  return {
    kind: "saved",
    submittedAt: saved.submittedAt.getTime(),
    durationMs: saved.durationMs,
    failedCritical: countFailedCritical(saved.snapshot, saved.answers),
  };
}
