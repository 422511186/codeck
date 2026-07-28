import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../web/theme/tokens.css";
import { AppProviders } from "../web/components/AppProviders";

export const metadata: Metadata = {
  title: "codeck",
  description: "移动端 codeck 前端"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" }
  ]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
