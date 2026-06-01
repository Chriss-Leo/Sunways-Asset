"use client";

import { useT } from "@/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale } = useT();

  return (
    <span className="inline-flex rounded-md border border-zinc-300 bg-white text-xs font-medium shadow-sm">
      <button
        className={`rounded-l-md px-3 py-1.5 transition ${
          locale === "zh"
            ? "bg-zinc-950 text-white"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
        disabled={locale === "zh"}
        onClick={() => setLocale("zh")}
        type="button"
      >
        中文
      </button>
      <button
        className={`rounded-r-md px-3 py-1.5 transition ${
          locale === "en"
            ? "bg-zinc-950 text-white"
            : "text-zinc-500 hover:text-zinc-700"
        }`}
        disabled={locale === "en"}
        onClick={() => setLocale("en")}
        type="button"
      >
        English
      </button>
    </span>
  );
}
