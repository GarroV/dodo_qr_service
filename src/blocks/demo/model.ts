// Форма демонстрационного контура: что именно сид заводит в базе.
//
// Данные описаны здесь декларативно и с ФИКСИРОВАННЫМИ опознавателями, а не собираются
// на лету. Это и есть механизм идемпотентности (критерий 2 блока): повторный прогон
// удаляет строки ровно с этими опознавателями и вставляет их заново — тех же строк
// столько же, а чужого сид не касается вовсе.
//
// Времени в описании нет: заполнения и публикации заданы смещением назад от опорного
// момента. Иначе демо через месяц показывало бы ленту месячной давности, а тест
// идемпотентности не мог бы сравнить два прогона.
import type {
  Answer,
  Item,
  LocalizedText,
  Section,
  ShiftMode,
} from "@/blocks/data";

/** Ответ в описании контура: момент ответа считает сид, а не автор данных. */
export type DemoAnswer = Omit<Answer, "at">;

export interface DemoCountry {
  readonly id: string;
  readonly name: string;
  /** Язык демо — английский (конституция, раздел «Демонстрационный режим»). */
  readonly locale: "en";
}

export interface DemoStore {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
}

export interface DemoStation {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  /** Код из наклейки: 10 знаков алфавита кодов станций, постоянный между прогонами. */
  readonly code: string;
}

/** Переиспользуемый блок библиотеки (D011): заведён один раз, вставлен в несколько чек-листов. */
export interface DemoBlock {
  readonly id: string;
  readonly title: LocalizedText;
  readonly items: readonly Item[];
}

export interface DemoVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly status: "published" | "archived";
  readonly sections: readonly Section[];
  /** На сколько часов назад от опорного момента датируется публикация. */
  readonly publishedHoursAgo: number;
}

export interface DemoChecklist {
  readonly id: string;
  readonly stationId: string;
  readonly title: LocalizedText;
  /** Окно времени в формате экрана редактора: «06:00». */
  readonly window: { readonly start: string; readonly end: string };
  /** Черновик методиста: он остаётся рядом с опубликованной версией и правится дальше. */
  readonly draft: {
    readonly id: string;
    readonly sections: readonly Section[];
  };
  readonly versions: readonly DemoVersion[];
}

export interface DemoSubmission {
  readonly id: string;
  readonly versionId: string;
  readonly stationId: string;
  readonly answers: readonly DemoAnswer[];
  readonly submittedHoursAgo: number;
  /** Сколько минут заняло заполнение: из него считается момент начала. */
  readonly durationMinutes: number;
  /** Режим смены, в котором заполняли (D055). По умолчанию полная смена. */
  readonly mode?: ShiftMode;
}

/**
 * Режим смены, поставленный пиццерии на сегодня. Нужен, чтобы показ открывался
 * сразу с сокращённой сменой, а не только с полной: иначе градацию уровней на
 * демонстрации нечем показать без ручного щёлканья.
 */
export interface DemoShiftMode {
  readonly storeId: string;
  readonly mode: ShiftMode;
  readonly staffPresent: number;
  readonly staffExpected: number;
}

export interface DemoDataset {
  readonly country: DemoCountry;
  readonly stores: readonly DemoStore[];
  readonly stations: readonly DemoStation[];
  readonly blocks: readonly DemoBlock[];
  readonly checklists: readonly DemoChecklist[];
  readonly submissions: readonly DemoSubmission[];
  readonly shiftModes: readonly DemoShiftMode[];
}
