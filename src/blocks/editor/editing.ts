// Правка разметки чек-листа в браузере. Функции чистые: на вход — список секций,
// на выход — новый список. Ничего не меняется на месте, поэтому состояние экрана
// обновляется одним присваиванием, а поведение проверяется без браузера.
//
// Здесь живут правила клавиатуры (принцип 5): Enter создаёт следующий пункт и говорит,
// куда ставить курсор; Alt+стрелки переставляют пункт; вставка списка кладёт пачку
// пунктов за один раз. Каждое лишнее касание мыши — это лишняя минута на чек-лист.
import type { Item, LocalizedText, Section } from "@/blocks/data";

/** Новый опознаватель. `crypto` есть и в браузере, и в Node — импорт не нужен. */
function newId(): string {
  return crypto.randomUUID();
}

/** Пустой пункт: тип «да/нет» и без критичности — так его заводит методист чаще всего. */
export function emptyItem(): Item {
  return { id: newId(), title: {}, type: "bool", critical: false };
}

/** Пустая секция с одним пустым пунктом: курсору сразу есть куда встать. */
export function emptySection(): Section {
  return { id: newId(), title: {}, source: "own", items: [emptyItem()] };
}

export function isLinked(section: Section): boolean {
  return typeof section.source !== "string";
}

export function itemCount(sections: readonly Section[]): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

/** Есть ли у пункта текст хоть на одном языке: пустые строки не сохраняются. */
export function hasText(text: LocalizedText): boolean {
  return Object.values(text).some((value) => value.trim() !== "");
}

function mapSection(
  sections: readonly Section[],
  sectionId: string,
  change: (section: Section) => Section,
): Section[] {
  return sections.map((section) =>
    section.id === sectionId ? change(section) : section,
  );
}

function mapItems(
  sections: readonly Section[],
  change: (items: readonly Item[]) => Item[],
): Section[] {
  return sections.map((section) => ({ ...section, items: change(section.items) }));
}

/**
 * Enter в поле пункта: следующий пункт встаёт сразу за текущим, а не в конце списка,
 * и возвращённый `focusItemId` говорит экрану, куда перевести курсор.
 */
export function addItemAfter(
  sections: readonly Section[],
  sectionId: string,
  afterItemId: string | null,
): { sections: Section[]; focusItemId: string } {
  const created = emptyItem();

  return {
    sections: mapSection(sections, sectionId, (section) => {
      const at = section.items.findIndex((item) => item.id === afterItemId);
      const items = [...section.items];
      items.splice(at < 0 ? items.length : at + 1, 0, created);
      return { ...section, items };
    }),
    focusItemId: created.id,
  };
}

/**
 * Alt+↑/↓: пункт переставляется внутри своей секции. На границе секции ничего не
 * происходит — пункт, уехавший в соседнюю секцию, для методиста просто исчезает.
 */
export function moveItem(
  sections: readonly Section[],
  itemId: string,
  delta: -1 | 1,
): { sections: Section[]; moved: boolean } {
  let moved = false;

  const result = sections.map((section) => {
    const at = section.items.findIndex((item) => item.id === itemId);
    if (at < 0) return section;

    const to = at + delta;
    if (to < 0 || to >= section.items.length) return section;

    const items = [...section.items];
    const [item] = items.splice(at, 1);
    if (item === undefined) return section;
    items.splice(to, 0, item);
    moved = true;
    return { ...section, items };
  });

  return { sections: moved ? result : [...sections], moved };
}

/**
 * Вставка списка из буфера. Пустой пункт, в который вставляли, занимается первой
 * строкой списка: иначе после вставки в чек-листе остаётся пустая строка на ровном месте.
 */
export function insertItems(
  sections: readonly Section[],
  sectionId: string,
  atItemId: string | null,
  items: readonly Item[],
): Section[] {
  if (items.length === 0) return [...sections];

  return mapSection(sections, sectionId, (section) => {
    const at = section.items.findIndex((item) => item.id === atItemId);
    const anchor = at < 0 ? undefined : section.items[at];
    const replaceAnchor = anchor !== undefined && !hasText(anchor.title);

    const next = [...section.items];
    if (replaceAnchor) {
      next.splice(at, 1, ...items);
    } else {
      next.splice(at < 0 ? next.length : at + 1, 0, ...items);
    }
    return { ...section, items: next };
  });
}

/** Правка полей пункта. Смена типа на «да/нет» и «текст» снимает границы диапазона. */
export function updateItem(
  sections: readonly Section[],
  itemId: string,
  patch: Partial<Item>,
): Section[] {
  return mapItems(sections, (items) =>
    items.map((item) => {
      if (item.id !== itemId) return item;
      const merged = { ...item, ...patch };
      if (merged.type === "number") return merged;
      // Границы у нечислового пункта не видны на экране и не правятся: оставить их
      // значит увезти в базу невидимое значение.
      const { min: _min, max: _max, ...withoutRange } = merged;
      return withoutRange;
    }),
  );
}

/** Текст пункта на языке интерфейса; тексты на других языках остаются как были. */
export function setItemTitle(
  sections: readonly Section[],
  itemId: string,
  locale: string,
  text: string,
): Section[] {
  return mapItems(sections, (items) =>
    items.map((item) =>
      item.id === itemId
        ? { ...item, title: { ...item.title, [locale]: text } }
        : item,
    ),
  );
}

export function removeItem(
  sections: readonly Section[],
  itemId: string,
): Section[] {
  return mapItems(sections, (items) =>
    items.filter((item) => item.id !== itemId),
  );
}

export function addSection(sections: readonly Section[]): {
  sections: Section[];
  sectionId: string;
} {
  const created = emptySection();
  return { sections: [...sections, created], sectionId: created.id };
}

export function setSectionTitle(
  sections: readonly Section[],
  sectionId: string,
  locale: string,
  text: string,
): Section[] {
  return mapSection(sections, sectionId, (section) => ({
    ...section,
    title: { ...section.title, [locale]: text },
  }));
}

export function removeSection(
  sections: readonly Section[],
  sectionId: string,
): Section[] {
  return sections.filter((section) => section.id !== sectionId);
}

/** Блок библиотеки для вставки: сам блок живёт в своём разделе, здесь только ссылка. */
export interface InsertableBlock {
  id: string;
  title: LocalizedText;
  items: readonly Item[];
}

/**
 * Вставка блока библиотеки: секция хранит ссылку `{ blockId }`, а пункты показываются
 * блоковые. Правка блока придёт сюда сама; в опубликованную версию уедет снимок (D002).
 */
export function insertLibrarySection(
  sections: readonly Section[],
  block: InsertableBlock,
): Section[] {
  return [
    ...sections,
    {
      id: newId(),
      title: { ...block.title },
      source: { blockId: block.id },
      items: block.items.map((item) => ({ ...item })),
    },
  ];
}

/**
 * «Отвязать»: секция перестаёт зависеть от блока и становится своей. Пункты остаются,
 * но получают новые опознаватели — иначе два чек-листа делили бы один пункт.
 */
export function unlinkSection(
  sections: readonly Section[],
  sectionId: string,
): Section[] {
  return mapSection(sections, sectionId, (section) => ({
    ...section,
    source: "own",
    items: section.items.map((item) => ({ ...item, id: newId() })),
  }));
}
