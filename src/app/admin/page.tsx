import { getTranslations } from "next-intl/server";

import { submitSignOut } from "@/blocks/auth/ui/sign-out-action";

// Заглушка первого экрана админки: разделы приносят блоки catalog, editor, library, qr и feed.
// Здесь она нужна, чтобы вошедшему было куда попасть, а проверке — что защищать.
export default async function AdminHomePage() {
  const t = await getTranslations("admin");

  return (
    <main
      data-testid="admin-home"
      className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-[var(--space-6)] p-[var(--space-9)]"
    >
      <h1 className="text-[length:var(--fs-display)] leading-[var(--lh-display)] font-semibold">
        {t("home")}
      </h1>
      <p className="text-ink-2 text-[length:var(--fs-body)]">{t("signedIn")}</p>
      <form action={submitSignOut}>
        <button
          type="submit"
          data-testid="sign-out"
          className="bg-surface text-ink flex h-[var(--control-h)] items-center justify-center rounded-[var(--r-control)] border border-[var(--line-control)] px-[var(--space-6)] text-[length:var(--fs-body)] font-medium hover:border-[var(--line-control-2)]"
        >
          {t("signOut")}
        </button>
      </form>
    </main>
  );
}
