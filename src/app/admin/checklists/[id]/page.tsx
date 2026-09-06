import { EditorScreen } from "@/blocks/editor/ui/EditorScreen";

// Экран под /admin — охрану ставит src/app/admin/layout.tsx, повторять её здесь не нужно.
// Серверные действия редактора зовут requireAdmin() сами: они идут мимо разметки.
export default async function ChecklistEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditorScreen checklistId={id} />;
}
