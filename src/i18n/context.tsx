"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Locale, LocaleContextType } from "./types";
import en from "./locales/en";
import zh from "./locales/zh";

const LOCALE_STORAGE_KEY = "sunways.locale";

const locales: Record<Locale, Record<string, unknown>> = { en, zh };

function resolveLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "zh" || stored === "en") return stored;
  const browserLang = navigator.language.slice(0, 2);
  if (browserLang === "zh") return "zh";
  return "en";
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
});

export function useT() {
  return useContext(LocaleContext);
}

function getNested(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

function interpolate(value: string, params?: Record<string, string | number>): string {
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Always start with "en" so SSR and first client render match, avoiding
  // hydration mismatches. The saved/browser locale is resolved in the effect.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const id = window.setTimeout(() => setLocaleState(resolveLocale()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = locales[locale] as Record<string, unknown>;
      const raw = getNested(dict, key);
      return interpolate(raw, params);
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}
