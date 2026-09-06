import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8">
      <h1 className="text-accent text-2xl font-semibold" data-testid="title">
        {t("title")}
      </h1>
      <p className="text-ink-2" data-testid="subtitle">
        {t("subtitle")}
      </p>
    </main>
  );
}
