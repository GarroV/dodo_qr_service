import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/blocks/auth/guard";
import { buildScreenModel } from "@/blocks/qr/ui/build-model";
import { scanOrigin } from "@/blocks/qr/ui/origin";
import { StationScreen } from "@/blocks/qr/ui/StationScreen";
import { parseStationRef, type SearchParams } from "@/blocks/qr/ui/view";

/**
 * Полноэкранный QR станции — то, что открывают на планшете и оставляют висеть.
 * Станции нет или она из другой пиццерии — 404, а не чужой код на весь экран.
 */
export default async function QrStationScreenPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();

  const ref = parseStationRef(await searchParams);
  if (ref === null) notFound();

  const origin = scanOrigin(await headers(), process.env);
  const model = await buildScreenModel(ref, origin);
  if (model === null) notFound();

  return <StationScreen model={model} />;
}
