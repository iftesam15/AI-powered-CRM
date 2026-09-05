import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppProviders } from "@/providers";
import { env } from "@/config/env";

import "./globals.css";

/**
 * Inter is the font named by the Logistic One preset in globals.css, so it is
 * loaded through next/font rather than a stylesheet link.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: env.NEXT_PUBLIC_APP_NAME,
    template: `%s · ${env.NEXT_PUBLIC_APP_NAME}`,
  },
  description:
    "Multi-tenant B2B CRM for accounts, contacts, leads, opportunities and pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
