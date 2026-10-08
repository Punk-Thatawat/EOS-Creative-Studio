import { Dancing_Script, Kanit, Mali, Mitr, Noto_Sans_Thai, Pridi, Prompt, Sarabun } from "next/font/google";

/**
 * The fonts a person can type on a form with. They are self-hosted by Next and only fetched when a mark uses them
 * (`preload: false`), so having a long list costs nothing until it is used. The Thai ones also carry Latin letters.
 */
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const notoSansThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], display: "swap", preload: false });
const kanit = Kanit({ subsets: ["thai", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const mitr = Mitr({ subsets: ["thai", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const pridi = Pridi({ subsets: ["thai", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const mali = Mali({ subsets: ["thai", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const dancingScript = Dancing_Script({ subsets: ["latin"], display: "swap", preload: false });

export type TextFont = { id: string; label: string; family: string; /** A hint of the character, shown in the picker. */ kind: "sans" | "serif" | "handwriting" | "mono" };

export const TEXT_FONTS: readonly TextFont[] = [
  { id: "sarabun", label: "Sarabun", family: sarabun.style.fontFamily, kind: "sans" },
  { id: "noto-sans-thai", label: "Noto Sans Thai", family: notoSansThai.style.fontFamily, kind: "sans" },
  { id: "kanit", label: "Kanit", family: kanit.style.fontFamily, kind: "sans" },
  { id: "prompt", label: "Prompt", family: prompt.style.fontFamily, kind: "sans" },
  { id: "mitr", label: "Mitr", family: mitr.style.fontFamily, kind: "sans" },
  { id: "pridi", label: "Pridi", family: pridi.style.fontFamily, kind: "serif" },
  { id: "mali", label: "Mali", family: mali.style.fontFamily, kind: "handwriting" },
  { id: "dancing-script", label: "Dancing Script", family: dancingScript.style.fontFamily, kind: "handwriting" },
  { id: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif", kind: "sans" },
  { id: "times", label: "Times New Roman", family: '"Times New Roman", Times, serif', kind: "serif" },
  { id: "courier", label: "Courier New", family: '"Courier New", Courier, monospace', kind: "mono" },
];

/** The font with this id, or the first one when a saved id is no longer in the list. */
export function fontById(id: string): TextFont {
  return TEXT_FONTS.find((font) => font.id === id) ?? TEXT_FONTS[0]!;
}
