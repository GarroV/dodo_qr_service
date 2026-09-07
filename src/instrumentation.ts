// Точка, которую Next зовёт один раз при старте процесса. Здесь — только проверка
// окружения: настройка, ломающая продукт, должна останавливать его на старте.
import { checkStartupConfig } from "./startup-checks";

export function register(): void {
  // Проверка идёт в основном исполнении: у edge своё окружение и свой запуск,
  // а проверять одно и то же дважды значит дважды писать в журнал.
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  for (const note of checkStartupConfig(process.env)) {
    console.warn(`ВНИМАНИЕ: ${note}`);
  }
}
