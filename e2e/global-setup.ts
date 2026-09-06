// Подготовка прогона: своя база сквозных сценариев с нуля. Без неё экраны редактора
// открылись бы на пустой схеме и упали бы не там, где ошибка.
import { prepareE2eDatabase } from "./database";

export default async function globalSetup(): Promise<void> {
  await prepareE2eDatabase();
}
