import { getLocale, getTranslations } from "next-intl/server";
import type { ReactElement } from "react";

import type { Locale } from "@/blocks/core/locale";

import type { TimezoneOption } from "../timezone";
import {
  submitAssignChecklist,
  submitDeleteCountry,
  submitDeleteStation,
  submitDeleteStore,
  submitDetachChecklist,
  submitUpdateCountry,
  submitUpdateStation,
  submitUpdateStore,
} from "./actions";
import type {
  CatalogModel,
  CountryDetail,
  StationChecklistItem,
  StationDetail,
  StoreDetail,
} from "./model";

/**
 * Карточка правки под деревом — страна / пиццерия / станция, по эталону
 * `docs/forge/design/screens/catalog.html`. Эталон фиксирует только состояние
 * «пиццерия выбрана»; страна и станция держатся того же визуального языка.
 *
 * Карточки подтверждения удаления — в `CatalogScreen.tsx`: это отдельный режим
 * экрана (а не карточка правки), и там же есть запас по бюджету строк на файл.
 */

type Translate = Awaited<ReturnType<typeof getTranslations>>;

// Имена полей форм — те же строки, что в actions.ts (там они приватные).
const FIELD_NAME = "name";
const FIELD_LOCALE = "locale";
const FIELD_TIMEZONE = "timezone";
const FIELD_ID = "id";
const FIELD_COUNTRY_ID = "countryId";
const FIELD_STORE_ID = "storeId";
const FIELD_STATION_ID = "stationId";
const FIELD_CHECKLIST_ID = "checklistId";

// Повторяющиеся ключи словаря — тоже в константы (sonarjs/no-duplicate-string).
const KEY_FIELD_NAME = "fields.name";
const KEY_ACTION_SAVE = "actions.save";

const DETAIL_CARD_TEST_ID = "detail-card";

const CARD_CLASS =
  "bg-surface max-w-[880px] rounded-[var(--r-block)] border border-[var(--line-strong)] shadow-[var(--sh-xs)]";
const CARD_HEAD_CLASS =
  "flex items-center gap-[var(--space-6)] rounded-t-[var(--r-block)] border-b border-[var(--line)] bg-[var(--surface-3)] px-[var(--space-7)] py-[var(--space-6)]";
const CARD_BODY_CLASS = "flex flex-col gap-[var(--space-6)] p-[var(--space-7)]";
const CARD_TITLE_CLASS =
  "text-[length:var(--fs-title)] leading-[var(--lh-title)] font-semibold";
const ROW_CLASS = "flex gap-[var(--space-6)] [&>*]:min-w-0 [&>*]:flex-1";
const FIELD_CLASS = "flex flex-col gap-[var(--space-3)]";
const FIELD_LABEL_CLASS =
  "text-[length:var(--fs-micro)] leading-[var(--lh-micro)] font-semibold tracking-[var(--tracking-micro)] text-[var(--ink-3)] uppercase";
const FIELD_HINT_CLASS = "text-[length:var(--fs-meta)] text-[var(--ink-3)]";
const INPUT_CLASS =
  "text-ink bg-surface h-[var(--control-h)] w-full rounded-[var(--r-control)] border border-[var(--line-control)] px-[var(--space-5)] text-[length:var(--fs-lead)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-soft)] focus:outline-none";
const SELECT_CLASS =
  "text-ink bg-surface h-[var(--control-h)] w-full appearance-none rounded-[var(--r-control)] border border-[var(--line-control)] pr-[var(--space-8)] pl-[var(--space-5)] text-[length:var(--fs-lead)] [background-image:linear-gradient(45deg,transparent_50%,var(--ink-3)_50%),linear-gradient(135deg,var(--ink-3)_50%,transparent_50%)] [background-position:calc(100%-14px)_13px,calc(100%-9px)_13px] [background-repeat:no-repeat] [background-size:5px_5px,5px_5px] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-soft)] focus:outline-none disabled:opacity-60";
const INLINE_CLASS = "flex items-center gap-[var(--space-5)]";
const BTN_CLASS =
  "text-ink bg-surface inline-flex h-[var(--control-h)] items-center justify-center gap-[var(--space-4)] rounded-[var(--r-control)] border border-[var(--line-control)] px-[var(--space-6)] text-[length:var(--fs-body)] font-medium no-underline hover:border-[var(--line-control-2)] hover:bg-[var(--surface-2)]";
const BTN_GHOST_CLASS =
  "inline-flex h-[var(--control-h)] items-center justify-center gap-[var(--space-4)] rounded-[var(--r-control)] border border-transparent bg-transparent px-[var(--space-6)] text-[length:var(--fs-body)] font-medium text-[var(--ink-2)] no-underline hover:bg-[var(--surface-3)] hover:text-ink";
const BTN_GHOST_DANGER_CLASS =
  "text-err inline-flex h-[var(--control-h)] items-center justify-center gap-[var(--space-4)] rounded-[var(--r-control)] border border-transparent bg-transparent px-[var(--space-6)] text-[length:var(--fs-body)] font-medium no-underline hover:border-[var(--err-line)] hover:bg-[var(--err-soft)]";
const BTN_PRIMARY_CLASS =
  "bg-accent inline-flex h-[var(--control-h)] items-center justify-center gap-[var(--space-4)] rounded-[var(--r-control)] border border-[var(--accent)] px-[var(--space-6)] text-[length:var(--fs-body)] font-medium text-[var(--ink-inverse)] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]";
const SECTION_CLASS =
  "flex flex-col gap-[var(--space-4)] border-t border-[var(--line)] pt-[var(--space-6)]";
const CHECKLIST_LIST_CLASS = "m-0 flex list-none flex-col p-0";
const CHECKLIST_ITEM_CLASS =
  "flex items-center gap-[var(--space-4)] border-b border-[var(--line)] py-[var(--space-3)]";
const CODE_ROW_CLASS = "m-0 flex items-center gap-[var(--space-5)]";
const CODE_VALUE_CLASS =
  "text-ink font-[family-name:var(--font-num)] text-[length:var(--fs-lead)] [font-variant-numeric:tabular-nums]";
const NOTICE_WARN_CLASS =
  "flex gap-[var(--space-5)] rounded-[var(--r-block)] border border-[var(--warn-line)] bg-[var(--warn-soft)] px-[var(--space-7)] py-[var(--space-6)] text-[length:var(--fs-dense)] text-[var(--warn-ink)]";

const COUNTRY_FORM_ID = "country-edit-form";
const STORE_FORM_ID = "store-edit-form";
const STATION_FORM_ID = "station-edit-form";

function CountryCard({
  country,
  t,
}: {
  readonly country: CountryDetail;
  readonly t: Translate;
}): ReactElement {
  return (
    <div data-testid={DETAIL_CARD_TEST_ID} className={CARD_CLASS}>
      <div className={CARD_HEAD_CLASS}>
        <h2 className={CARD_TITLE_CLASS}>
          {t("card.countryTitle", { name: country.name })}
        </h2>
      </div>
      <div className={CARD_BODY_CLASS}>
        <form id={COUNTRY_FORM_ID} action={submitUpdateCountry}>
          <input type="hidden" name={FIELD_ID} value={country.id} />
        </form>
        <div className={ROW_CLASS}>
          <div className={FIELD_CLASS}>
            <label htmlFor="country-name" className={FIELD_LABEL_CLASS}>
              {t(KEY_FIELD_NAME)}
            </label>
            <input
              id="country-name"
              form={COUNTRY_FORM_ID}
              name={FIELD_NAME}
              defaultValue={country.name}
              className={INPUT_CLASS}
            />
          </div>
          <div className={FIELD_CLASS}>
            <label htmlFor="country-locale" className={FIELD_LABEL_CLASS}>
              {t("fields.locale")}
            </label>
            <select
              id="country-locale"
              form={COUNTRY_FORM_ID}
              name={FIELD_LOCALE}
              defaultValue={country.locale}
              className={SELECT_CLASS}
            >
              <option value="ru">ru</option>
              <option value="en">en</option>
            </select>
          </div>
        </div>
        <div className={INLINE_CLASS}>
          <button
            type="submit"
            form={COUNTRY_FORM_ID}
            className={BTN_PRIMARY_CLASS}
          >
            {t(KEY_ACTION_SAVE)}
          </button>
          <form action={submitDeleteCountry} className="ml-auto">
            <input type="hidden" name={FIELD_ID} value={country.id} />
            <button type="submit" className={BTN_GHOST_DANGER_CLASS}>
              {t("actions.deleteCountry")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StoreCard({
  store,
  countryId,
  timezones,
  t,
}: {
  readonly store: StoreDetail;
  readonly countryId: string;
  readonly timezones: readonly TimezoneOption[];
  readonly t: Translate;
}): ReactElement {
  return (
    <div data-testid={DETAIL_CARD_TEST_ID} className={CARD_CLASS}>
      <div className={CARD_HEAD_CLASS}>
        <h2 className={CARD_TITLE_CLASS}>
          {t("card.storeTitle", { name: store.name })}
        </h2>
      </div>
      <div className={CARD_BODY_CLASS}>
        <form id={STORE_FORM_ID} action={submitUpdateStore}>
          <input type="hidden" name={FIELD_ID} value={store.id} />
          <input type="hidden" name={FIELD_COUNTRY_ID} value={countryId} />
        </form>
        <div className={ROW_CLASS}>
          <div className={FIELD_CLASS}>
            <label htmlFor="store-name" className={FIELD_LABEL_CLASS}>
              {t(KEY_FIELD_NAME)}
            </label>
            <input
              id="store-name"
              form={STORE_FORM_ID}
              name={FIELD_NAME}
              defaultValue={store.name}
              className={INPUT_CLASS}
            />
          </div>
          <div className={FIELD_CLASS}>
            <label htmlFor="store-country" className={FIELD_LABEL_CLASS}>
              {t("fields.country")}
            </label>
            {/* Перенос пиццерии между странами эта версия не делает — только для чтения. */}
            <select
              id="store-country"
              disabled
              defaultValue={store.countryName}
              className={SELECT_CLASS}
            >
              <option value={store.countryName}>{store.countryName}</option>
            </select>
          </div>
          <div className={FIELD_CLASS}>
            <label htmlFor="store-timezone" className={FIELD_LABEL_CLASS}>
              {t("fields.timezone")}
            </label>
            <select
              id="store-timezone"
              form={STORE_FORM_ID}
              name={FIELD_TIMEZONE}
              defaultValue={store.timezone}
              className={SELECT_CLASS}
            >
              {timezones.map((zone) => (
                <option key={zone.name} value={zone.name}>
                  {zone.name} ({zone.offset})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={INLINE_CLASS}>
          <button
            type="submit"
            form={STORE_FORM_ID}
            className={BTN_PRIMARY_CLASS}
          >
            {t(KEY_ACTION_SAVE)}
          </button>
          <form action={submitDeleteStore} className="ml-auto">
            <input type="hidden" name={FIELD_ID} value={store.id} />
            <input type="hidden" name={FIELD_COUNTRY_ID} value={countryId} />
            <button type="submit" className={BTN_GHOST_DANGER_CLASS}>
              {t("actions.deleteStore")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface ChecklistRowProps {
  readonly checklist: StationChecklistItem;
  readonly countryId: string;
  readonly storeId: string;
  readonly stationId: string;
  readonly t: Translate;
}

// Строка привязанного чек-листа — своя функция ради отступа: внутри `.map`
// те же четыре скрытых поля не помещались в строку и разъезжались построчно.
function ChecklistRow({
  checklist,
  countryId,
  storeId,
  stationId,
  t,
}: ChecklistRowProps): ReactElement {
  return (
    <li className={CHECKLIST_ITEM_CLASS}>
      <span>{checklist.title}</span>
      <form action={submitDetachChecklist} className="ml-auto">
        <input type="hidden" name={FIELD_COUNTRY_ID} value={countryId} />
        <input type="hidden" name={FIELD_STORE_ID} value={storeId} />
        <input type="hidden" name={FIELD_STATION_ID} value={stationId} />
        <input type="hidden" name={FIELD_CHECKLIST_ID} value={checklist.id} />
        <button
          type="submit"
          className={`${BTN_GHOST_CLASS} text-[length:var(--fs-dense)]`}
        >
          {t("actions.detach")}
        </button>
      </form>
    </li>
  );
}

function StationCard({
  station,
  countryId,
  storeId,
  stationId,
  freeChecklists,
  locale,
  t,
}: {
  readonly station: StationDetail;
  readonly countryId: string;
  readonly storeId: string;
  readonly stationId: string;
  readonly freeChecklists: readonly StationChecklistItem[];
  readonly locale: Locale;
  readonly t: Translate;
}): ReactElement {
  const issuedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(new Date(station.codeIssuedAt));

  return (
    <div data-testid={DETAIL_CARD_TEST_ID} className={CARD_CLASS}>
      <div className={CARD_HEAD_CLASS}>
        <h2 className={CARD_TITLE_CLASS}>
          {t("card.stationTitle", { name: station.name })}
        </h2>
      </div>
      <div className={CARD_BODY_CLASS}>
        <form id={STATION_FORM_ID} action={submitUpdateStation}>
          <input type="hidden" name={FIELD_ID} value={station.id} />
          <input type="hidden" name={FIELD_COUNTRY_ID} value={countryId} />
          <input type="hidden" name={FIELD_STORE_ID} value={storeId} />
        </form>
        <div className={ROW_CLASS}>
          <div className={FIELD_CLASS}>
            <label htmlFor="station-name" className={FIELD_LABEL_CLASS}>
              {t(KEY_FIELD_NAME)}
            </label>
            <input
              id="station-name"
              form={STATION_FORM_ID}
              name={FIELD_NAME}
              defaultValue={station.name}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <div className={INLINE_CLASS}>
          <button
            type="submit"
            form={STATION_FORM_ID}
            className={BTN_PRIMARY_CLASS}
          >
            {t(KEY_ACTION_SAVE)}
          </button>
          <form action={submitDeleteStation} className="ml-auto">
            <input type="hidden" name={FIELD_ID} value={station.id} />
            <input type="hidden" name={FIELD_COUNTRY_ID} value={countryId} />
            <input type="hidden" name={FIELD_STORE_ID} value={storeId} />
            <button type="submit" className={BTN_GHOST_DANGER_CLASS}>
              {t("actions.deleteStation")}
            </button>
          </form>
        </div>

        <div className={SECTION_CLASS}>
          <h3 className={FIELD_LABEL_CLASS}>{t("card.stationChecklists")}</h3>
          {station.checklists.length === 0 ? (
            <p className={NOTICE_WARN_CLASS}>{t("assign.none")}</p>
          ) : (
            <ul className={CHECKLIST_LIST_CLASS}>
              {station.checklists.map((checklist) => (
                <ChecklistRow
                  key={checklist.id}
                  checklist={checklist}
                  countryId={countryId}
                  storeId={storeId}
                  stationId={stationId}
                  t={t}
                />
              ))}
            </ul>
          )}

          {freeChecklists.length === 0 ? (
            <p className={FIELD_HINT_CLASS}>{t("assign.noFree")}</p>
          ) : (
            <form action={submitAssignChecklist} className={INLINE_CLASS}>
              <input type="hidden" name={FIELD_COUNTRY_ID} value={countryId} />
              <input type="hidden" name={FIELD_STORE_ID} value={storeId} />
              <input type="hidden" name={FIELD_STATION_ID} value={stationId} />
              <label htmlFor="assign-checklist" className="sr-only">
                {t("assign.selectLabel")}
              </label>
              <select
                id="assign-checklist"
                name={FIELD_CHECKLIST_ID}
                required
                className={SELECT_CLASS}
              >
                {freeChecklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.title}
                  </option>
                ))}
              </select>
              <button type="submit" className={BTN_CLASS}>
                {t("actions.assign")}
              </button>
            </form>
          )}
        </div>

        <div className={SECTION_CLASS}>
          <h3 className={FIELD_LABEL_CLASS}>{t("card.qrCode")}</h3>
          <p className={CODE_ROW_CLASS}>
            <span className={CODE_VALUE_CLASS}>{station.code}</span>
            <span className={FIELD_HINT_CLASS}>
              {t("card.issuedAt", { date: issuedAt })}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Карточка правки решается фокусом дерева (`model.focus`); подтверждение
 * удаления — отдельный режим экрана, за ним в `CatalogScreen.tsx`.
 */
export async function DetailCards({
  model,
}: {
  readonly model: CatalogModel;
}): Promise<ReactElement | null> {
  const t = await getTranslations("catalog");
  const locale = (await getLocale()) as Locale;
  const { focus, countryId, storeId, stationId, country, store, station } =
    model;

  if (focus === "store" && store !== null && countryId !== null) {
    return (
      <StoreCard
        store={store}
        countryId={countryId}
        timezones={model.timezones}
        t={t}
      />
    );
  }
  if (focus === "country" && country !== null) {
    return <CountryCard country={country} t={t} />;
  }
  if (
    focus === "station" &&
    station !== null &&
    countryId !== null &&
    storeId !== null &&
    stationId !== null
  ) {
    return (
      <StationCard
        station={station}
        countryId={countryId}
        storeId={storeId}
        stationId={stationId}
        freeChecklists={model.freeChecklists}
        locale={locale}
        t={t}
      />
    );
  }
  return null;
}
