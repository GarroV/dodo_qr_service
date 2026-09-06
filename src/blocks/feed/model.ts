// Модель экранов ленты: то, что страница посчитала, а разметка только рисует.
// Разметка не ходит в базу, не считает провалы и не переставляет строки — иначе лента
// и карточка начали бы считать одно и то же по-разному.
import type { Outcome } from "./outcome";
import type { FeedPeriod, RelativeDay } from "./period";

/** Строка ленты. Порядок строк задаёт слой доступа, экран его не меняет. */
export interface FeedRow {
  readonly id: string;
  readonly submittedAt: Date;
  readonly startedAt: Date;
  readonly durationMs: number;
  readonly countryName: string;
  readonly storeName: string;
  readonly stationName: string;
  /** Название чек-листа на языке интерфейса: снимок хранит его на всех языках. */
  readonly checklistTitle: string;
  readonly versionNumber: number | null;
  /** Пояс пиццерии: время строки показывается в нём, а не в поясе сервера. */
  readonly timeZone: string;
  /** Сегодня, вчера или раньше: от этого зависит вид отметки времени в строке. */
  readonly whenKind: RelativeDay;
  readonly outcome: Outcome;
}

/** Три показателя за выбранный период — считаются по тем же строкам, что показаны. */
export interface FeedMetrics {
  readonly submissionCount: number;
  readonly failedCriticalCount: number;
  /** `null`, когда заполнений нет: среднего у пустого множества не существует. */
  readonly averageDurationMs: number | null;
}

/** Пункт списка фильтра. */
export interface FilterOption {
  readonly id: string;
  readonly name: string;
}

/** Что показывает фильтр: выбранное и списки, уже суженные выбором. */
export interface FeedSelection {
  readonly countryId: string | null;
  readonly storeId: string | null;
  readonly stationId: string | null;
  readonly period: FeedPeriod;
  readonly countries: readonly FilterOption[];
  readonly stores: readonly FeedStoreOption[];
  readonly stations: readonly FeedStationOption[];
}

/** Пиццерия в фильтре знает свой пояс: в нём считается «сегодня» и время строк. */
export interface FeedStoreOption extends FilterOption {
  readonly countryId: string;
  readonly timezone: string;
}

/** Станция в фильтре знает свою пиццерию: выбор пиццерии сужает список станций. */
export interface FeedStationOption extends FilterOption {
  readonly storeId: string;
}

/** Что показывает экран ленты. */
export interface FeedModel {
  readonly selection: FeedSelection;
  /** Пояс, в котором посчитан период и подписан день. */
  readonly timeZone: string;
  /** Пояс выбран не однозначно — тогда экран его подписывает, а не умалчивает. */
  readonly timeZoneAmbiguous: boolean;
  /** День (или начало периода) — им подписана верхняя полоса. */
  readonly periodFrom: Date;
  readonly periodTo: Date;
  readonly metrics: FeedMetrics;
  readonly rows: readonly FeedRow[];
  /** Лента упёрлась в предел выдачи: показаны не все заполнения периода. */
  readonly limitReached: boolean;
  /** Почему лента пуста — от этого зависит, что предложить дальше. `null`, когда не пуста. */
  readonly emptyKind: FeedEmptyKind | null;
}

/**
 * Пустая лента объясняет причину, а не просто молчит:
 * `no-stations` — в справочнике нет ни одной станции, заполнять физически нечего;
 * `never` — по этим фильтрам не заполняли ни разу;
 * `period` — заполнения есть, но не в выбранном периоде.
 */
export type FeedEmptyKind = "no-stations" | "never" | "period";

/** Ответ на пункт в том виде, в котором его дал сотрудник. */
export type AnswerView =
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "none" };

/** Пункт карточки: заголовок из СНИМКА, ответ из заполнения. */
export interface SubmissionItemView {
  readonly itemId: string;
  readonly title: string;
  readonly hint: string | null;
  readonly critical: boolean;
  /** Диапазон числового пункта из снимка: «160–180» рядом с заголовком. */
  readonly min: number | null;
  readonly max: number | null;
  readonly failed: boolean;
  readonly answer: AnswerView;
  readonly answeredAt: Date | null;
  readonly comment: string | null;
}

export interface SubmissionSectionView {
  readonly id: string;
  readonly title: string;
  /** Секция пришла из переиспользуемого блока библиотеки (D011). */
  readonly fromLibrary: boolean;
  readonly items: readonly SubmissionItemView[];
}

/** Что показывает карточка одного заполнения. */
export interface SubmissionModel {
  readonly id: string;
  readonly checklistTitle: string;
  readonly countryName: string;
  readonly storeName: string;
  readonly stationName: string;
  readonly timeZone: string;
  readonly startedAt: Date;
  readonly submittedAt: Date;
  readonly durationMs: number;
  readonly itemCount: number;
  /** Отвечено и не провалено: столько пунктов реально выполнено. */
  readonly doneCount: number;
  readonly versionNumber: number | null;
  /** Когда опубликована та версия, по которой заполняли. */
  readonly versionPublishedAt: Date | null;
  readonly outcome: Outcome;
  /** Ссылка на сам чек-лист в редакторе: из карточки видно, что правят сейчас. */
  readonly checklistHref: string;
  readonly sections: readonly SubmissionSectionView[];
  /** Возврат в ленту с теми же фильтрами, с которыми пришли. */
  readonly backHref: string;
}
