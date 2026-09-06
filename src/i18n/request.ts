import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { pickLocale, type Locale } from "@/blocks/core/locale";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

const MESSAGES: Record<Locale, typeof en> = { en, ru };

// next-intl без маршрутизации локали: язык берётся из заголовка Accept-Language на каждом запросе.
export default getRequestConfig(async () => {
  const locale = pickLocale((await headers()).get("accept-language"));
  return { locale, messages: MESSAGES[locale] };
});
