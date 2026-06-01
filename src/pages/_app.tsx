import type { AppProps } from "next/app";
import { Geist, Geist_Mono } from "next/font/google";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { LocaleProvider, useT } from "@/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function RainbowKitShell({ children }: { children: ReactNode }) {
  const { locale } = useT();
  return (
    <RainbowKitProvider key={locale} locale={locale === "zh" ? "zh-CN" : "en"}>
      {children}
    </RainbowKitProvider>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <RainbowKitShell>
            <div
              className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
            >
              <Component {...pageProps} />
            </div>
          </RainbowKitShell>
        </LocaleProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
