import { useTranslations } from "next-intl";
import type { ChangeEvent } from "react";

import type { StationOption } from "../listing";
import { SELECT_ARROW } from "./select-style";

/** Окно времени в форме: варианты из эталона плюс то, что уже записано у чек-листа. */
export interface WindowValue {
  start: string;
  end: string;
}

export const WINDOW_PRESETS: readonly {
  key: "windowMorning" | "windowEvening" | "windowAny";
  value: WindowValue;
}[] = [
  { key: "windowMorning", value: { start: "06:00", end: "11:00" } },
  { key: "windowEvening", value: { start: "20:00", end: "00:00" } },
  { key: "windowAny", value: { start: "00:00", end: "24:00" } },
];

export function windowKey(value: WindowValue): string {
  return `${value.start}|${value.end}`;
}

export function parseWindowKey(key: string): WindowValue {
  const [start = "", end = ""] = key.split("|");
  return { start, end };
}

const FIELD_LABEL_CLASS =
  "text-[length:var(--fs-micro)] leading-[var(--lh-micro)] font-semibold tracking-[var(--tracking-micro)] text-[var(--ink-3)] uppercase";
const CONTROL_CLASS =
  "text-ink bg-surface h-[var(--control-h)] w-full rounded-[var(--r-control)] border border-[var(--line-control)] px-[var(--space-5)] text-[length:var(--fs-lead)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-soft)] focus:outline-none";

/**
 * Свойства чек-листа: название, станция, окно. Окно выбирается из готовых вариантов
 * (эталон): произвольное время — это два поля и лишние касания там, где вариантов
 * по сути три. Уже записанное нестандартное окно показывается отдельным пунктом,
 * чтобы открытие чек-листа не переписало его молча.
 */
export function PropertiesCard({
  title,
  stationId,
  window,
  stations,
  onTitle,
  onStation,
  onWindow,
}: {
  readonly title: string;
  readonly stationId: string;
  readonly window: WindowValue;
  readonly stations: readonly StationOption[];
  readonly onTitle: (value: string) => void;
  readonly onStation: (value: string) => void;
  readonly onWindow: (value: WindowValue) => void;
}) {
  const t = useTranslations("editor.form");
  const current = windowKey(window);
  const isPreset = WINDOW_PRESETS.some(
    (preset) => windowKey(preset.value) === current,
  );

  return (
    <div className="bg-surface mb-[var(--space-8)] rounded-[var(--r-block)] border border-[var(--line-strong)] shadow-[var(--sh-xs)]">
      <div className="flex gap-[var(--space-6)] p-[var(--space-7)]">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-3)]">
          <label className={FIELD_LABEL_CLASS} htmlFor="checklist-title">
            {t("title")}
          </label>
          <input
            id="checklist-title"
            data-testid="checklist-title"
            className={CONTROL_CLASS}
            value={title}
            placeholder={t("titlePlaceholder")}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onTitle(event.target.value);
            }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-3)]">
          <label className={FIELD_LABEL_CLASS} htmlFor="checklist-station">
            {t("station")}
          </label>
          <select
            id="checklist-station"
            data-testid="checklist-station"
            className={`${CONTROL_CLASS} pr-[var(--space-8)]`}
            style={SELECT_ARROW}
            value={stationId}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              onStation(event.target.value);
            }}
          >
            <option value="">{t("noStation")}</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {`${station.countryName} · ${station.storeName} · ${station.name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-3)]">
          <label className={FIELD_LABEL_CLASS} htmlFor="checklist-window">
            {t("window")}
          </label>
          <select
            id="checklist-window"
            data-testid="checklist-window"
            className={`${CONTROL_CLASS} pr-[var(--space-8)]`}
            style={SELECT_ARROW}
            value={current}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              onWindow(parseWindowKey(event.target.value));
            }}
          >
            {WINDOW_PRESETS.map((preset) => (
              <option key={preset.key} value={windowKey(preset.value)}>
                {t(preset.key)}
              </option>
            ))}
            {isPreset ? null : (
              <option value={current}>
                {t("windowCustom", { start: window.start, end: window.end })}
              </option>
            )}
          </select>
        </div>
      </div>
    </div>
  );
}
