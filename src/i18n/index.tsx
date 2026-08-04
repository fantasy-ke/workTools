import { useEffect, type PropsWithChildren } from "react";
import type { AppLanguage } from "../types";
import { useAppStore } from "../store/appStore";
import { enUS } from "./en-US";
import { zhCN } from "./zh-CN";

const dictionaries: Record<AppLanguage, Record<string, string>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

let activeLanguage: AppLanguage = "zh-CN";
const replacementEntries = Object.keys(zhCN).sort((left, right) => right.length - left.length);

export function translateForLanguage(source: string, language: AppLanguage): string {
  if (language === "zh-CN" || !source) return source;
  const dictionary = dictionaries[language];
  const exact = dictionary[source];
  if (exact) return exact;

  let translated = source;
  for (const key of replacementEntries) {
    if (translated.includes(key)) translated = translated.replaceAll(key, dictionary[key] ?? key);
  }
  return translated;
}

export function translate(source: string): string {
  return translateForLanguage(source, activeLanguage);
}

export function I18nProvider({ children }: PropsWithChildren) {
  const language = useAppStore((state) => state.settings.language);
  activeLanguage = language;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return children;
}
