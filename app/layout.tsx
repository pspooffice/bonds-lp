import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles.css";

export const metadata: Metadata = {
  title: "THE BONDS P・SPO会員向け仮予約",
  description:
    "P・SPO会員向けに、愛媛・中島のゲストハウス THE BONDS の特別価格を確認して仮予約できます。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
