// Разрешение импортов проекта для запуска исходников напрямую в Node.
//
// Node умеет исполнять TypeScript (снимает типы), но не знает двух вещей, на которых
// держится код в `src/`: псевдонима `@/` из tsconfig.json и импортов без расширения.
// Сборщик Next и vitest это делают сами, а `node scripts/*.mjs` — нет, и без хука
// сид пришлось бы писать мимо слоя доступа, дублируя запросы к базе.
//
// Хук ставится вызовом `register()` в самом сценарии — до первого импорта из `src/`.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const ALIAS = "@/";

// Порядок тот же, что у сборщика: файл, затем каталог с index.
const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];
const HAS_EXTENSION = /\.[cm]?[jt]sx?$/;

function firstExisting(href) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${href}${suffix}`;
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return undefined;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(ALIAS)) {
    const target = new URL(specifier.slice(ALIAS.length), SRC).href;
    const found = firstExisting(target);
    if (found === undefined) {
      throw new Error(
        `Импорт ${specifier} не разрешён: под ${fileURLToPath(SRC)} такого файла нет`,
      );
    }
    return nextResolve(found, context);
  }

  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  if (isRelative && !HAS_EXTENSION.test(specifier)) {
    const parent = context.parentURL;
    if (parent !== undefined && parent.startsWith("file:")) {
      const found = firstExisting(new URL(specifier, parent).href);
      if (found !== undefined) return nextResolve(found, context);
    }
  }

  return nextResolve(specifier, context);
}
