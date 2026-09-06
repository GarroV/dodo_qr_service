import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "dodo_qr_service",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="bg-canvas text-ink font-ui">{children}</body>
    </html>
  );
}
