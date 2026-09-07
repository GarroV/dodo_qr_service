"use server";

// Серверные действия экрана QR. Перевыпуск зовёт `requireAdmin()` сам: охрана в
// разметке `src/app/admin/layout.tsx` действия не закрывает — они выполняются мимо
// дерева разметки. Форма обычная, поэтому кнопка работает и без JavaScript.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { redirectPath } from "@/blocks/core/base-path";
import { CatalogError, reissueStationCode } from "@/blocks/catalog";
import { requireAdmin } from "@/blocks/auth/guard";

import { QR_PATH, isQrErrorCode, qrHref, type QrErrorCode } from "./view";

const STORE_ID = "storeId";
const STATION_ID = "stationId";

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Выдаёт станции новый код (D006). Старые наклейки после этого мертвы — предупреждение
 * об этом стоит на самом экране, рядом с кнопкой.
 */
export async function submitReissueCode(form: FormData): Promise<void> {
  await requireAdmin();

  const storeId = field(form, STORE_ID);
  const stationId = field(form, STATION_ID);

  let error: QrErrorCode | null = null;
  try {
    await reissueStationCode(stationId);
  } catch (cause) {
    // Чужое исключение не глотаем: молча съеденная ошибка неотличима от успеха.
    // Отказ справочника, которого этот экран показать не умеет, — тоже: пусть
    // будет пятисотка со строкой в журнале, а не тихий возврат «как будто вышло».
    if (!(cause instanceof CatalogError) || !isQrErrorCode(cause.code)) {
      throw cause;
    }
    error = cause.code;
  }

  revalidatePath(QR_PATH);
  // redirect бросает исключение — код ниже не выполняется, и это единственный выход.
  redirect(
    redirectPath(
      qrHref({
        storeId,
        stationId,
        ...(error === null ? {} : { error }),
      }),
    ),
  );
}
