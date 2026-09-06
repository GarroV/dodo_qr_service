import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Перебор маршрутов админки по файлам, а не по списку в тесте.
 *
 * Так новый экран любого блока попадает под проверку «без сессии не отдаёт данные»
 * сам, в тот же день, когда его завели, — и не зависит от памяти того, кто его завёл.
 */
export interface AdminRoute {
  readonly url: string;
  /** `page` — экран, `handler` — обработчик `route.ts`, который разметка не закрывает. */
  readonly kind: "page" | "handler";
  readonly file: string;
}

const ADMIN_DIR = path.join(process.cwd(), "src", "app", "admin");
const DYNAMIC_SEGMENT_SAMPLE = "sample";

// Сегмент каталога → кусок адреса. null означает «это не адрес» (параллельный слот).
function segmentToUrl(name: string): string | null {
  if (name.startsWith("_")) return null; // приватный каталог Next, маршрутом не становится
  if (name.startsWith("@")) return null; // параллельный слот
  if (name.startsWith("(") && name.endsWith(")")) return ""; // группа маршрутов адрес не меняет
  if (name.startsWith("[")) return DYNAMIC_SEGMENT_SAMPLE; // динамический сегмент
  return name;
}

function collect(directory: string, url: string): AdminRoute[] {
  const found: AdminRoute[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const segment = segmentToUrl(entry.name);
      if (segment === null) continue;
      found.push(...collect(full, segment === "" ? url : `${url}/${segment}`));
      continue;
    }

    const relative = path.relative(process.cwd(), full);
    if (/^page\.tsx?$/.test(entry.name)) {
      found.push({ url: url === "" ? "/" : url, kind: "page", file: relative });
    }
    if (/^route\.tsx?$/.test(entry.name)) {
      found.push({
        url: url === "" ? "/" : url,
        kind: "handler",
        file: relative,
      });
    }
  }

  return found;
}

/** Все маршруты под `/admin` в том виде, в каком их видит браузер. */
export function adminRoutes(): AdminRoute[] {
  return collect(ADMIN_DIR, "/admin").sort((left, right) =>
    left.url.localeCompare(right.url),
  );
}
