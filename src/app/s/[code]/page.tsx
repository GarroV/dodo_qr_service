import type { Metadata } from "next";

import { FillScreen } from "@/blocks/fill/ui/FillScreen";

/**
 * Единственный адрес продукта, открытый интернету: `/s/<код станции>` — тот самый,
 * что печатается внутри QR-наклейки (`stationScanUrl` блока `qr`). Наклейка живёт
 * годами, поэтому путь менять нельзя, и совпадение проверяется сквозным сценарием.
 *
 * Экран сам ходит за данными и сам решает, что показать: чек-лист, отказ по коду
 * или «сейчас заполнять нечего». Странице собирать нечего.
 */

// Отказ по неизвестному коду отдаётся с обычным кодом ответа и такой же страницей,
// как всё остальное: разный код ответа сам по себе рассказал бы перебору, какой
// код существует, а какой нет.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "dodo_qr_service",
  // Публичная ссылка не должна попадать в поисковую выдачу.
  robots: { index: false, follow: false },
};

export default async function StationFillPage({
  params,
}: {
  readonly params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <FillScreen code={code} />;
}
