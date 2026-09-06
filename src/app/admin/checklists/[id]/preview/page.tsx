import { PreviewScreen } from "@/blocks/editor/ui/PreviewScreen";

/**
 * Предпросмотр «как это увидит сотрудник» (T0хх). Экран сам ходит за черновиком
 * (`loadEditor(id)`) и сам решает `notFound()` — странице здесь нечего собирать.
 */
export default async function ChecklistPreviewPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PreviewScreen id={id} />;
}
