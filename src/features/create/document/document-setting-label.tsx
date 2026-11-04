"use client";

import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const settingInfo: ReadonlyArray<readonly [TranslationKey, TranslationKey]> = [
  ["create.document.settings.pageRange", "create.document.info.pageRange"],
  ["create.document.settings.language", "create.document.info.language"],
  ["create.document.ocr.language", "create.document.info.language"],
  ["create.document.translate.sourceLanguage", "create.document.info.language"],
  ["create.document.translate.targetLanguage", "create.document.info.language"],
  ["create.document.summary.length", "create.document.info.summaryLength"],
  ["create.document.settings.outputFormat", "create.document.info.outputFormat"],
  ["create.document.settings.depth", "create.document.info.depth"],
  ["create.document.settings.tone", "create.document.info.tone"],
];

/** Keep the label readable even when a control has no applicable explanation. */
export function DocumentSettingLabel({ label }: { label: string }) {
  const { t } = useLocale();
  const entry = settingInfo.find(([key]) => t(key) === label);
  return <span>{label}{entry ? <> <InfoTooltip content={t(entry[1])} size={11} /></> : null}</span>;
}
