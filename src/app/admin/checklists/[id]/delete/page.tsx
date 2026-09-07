import { RemoveChecklistScreen } from "@/blocks/editor/ui/RemoveChecklistScreen";

/**
 * Подтверждение удаления чек-листа. Экран сам читает состояние и сам решает `notFound()` —
 * странице здесь нечего собирать.
 */
export default async function RemoveChecklistPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RemoveChecklistScreen id={id} />;
}
