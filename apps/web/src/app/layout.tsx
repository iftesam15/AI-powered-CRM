import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";

import { AppProviders } from "@/providers";
import { env } from "@/config/env";
import { DEFAULT_STYLE_PRESET, PRESET_STORAGE_KEY } from "@/config/style-presets";

import "./globals.css";

/**
 * Presets declare their own --font-sans stacks. Inter covers Claude Blue /
 * Logistic One; Poppins covers Telesto. Both are loaded so switching presets
 * does not wait on a network fetch.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

/** Apply stored preset before paint to avoid a flash of the wrong theme tokens. */
const presetInitScript = `(function(){try{var k=${JSON.stringify(PRESET_STORAGE_KEY)};var d=${JSON.stringify(DEFAULT_STYLE_PRESET)};var p=localStorage.getItem(k)||d;document.documentElement.setAttribute("data-preset",p);}catch(e){document.documentElement.setAttribute("data-preset",${JSON.stringify(DEFAULT_STYLE_PRESET)});} })();`;

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
    <html lang="en" suppressHydrationWarning data-preset={DEFAULT_STYLE_PRESET}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: presetInitScript }} />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
