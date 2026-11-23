import { type CreativeTemplate as Template, type TemplateKind } from "@/lib/api/templates";
import { templateCopy } from "./template-copy";
import { type CopyLocale, type Mode } from "./library-modes";
import { WORK_ID } from "./saved-works";

/** Which mode a template belongs to, from the tool it opens: motion tools, editing tools, or (by default) creating. */
export function modeOf(t: Template): Mode {
  const feature = typeof t.settings?.feature === "string" ? t.settings.feature : "";
  const hint = `${feature} ${t.targetPath}`.toLowerCase();
  if (/(motion|swap)/.test(hint)) return "motion";
  if (/(extend|edit|upscale|reframe|lipsync|remove-background)/.test(hint)) return "edit";
  return "create";
}

const titles: Record<string, string> = {
  "Social media post": "โพสต์โซเชียลที่เป็นคุณ",
  "Product ad": "เปลี่ยนสินค้าให้เป็นแคมเปญ",
  "AI presenter video": "พรีเซนเตอร์ AI มืออาชีพ",
  "Podcast & dialogue": "พอดแคสต์และบทสนทนา",
  "Training video": "วิดีโออบรมและสอน",
  "Motion transfer: brand story": "ถ่ายทอดการเคลื่อนไหว: เรื่องราวแบรนด์",
  "Motion transfer: product showcase": "ถ่ายทอดการเคลื่อนไหว: โชว์สินค้า",
  "Extend video: continue the scene": "ขยายวิดีโอ: เล่าฉากต่อ",
  "Lipsync: presenter voice-over": "ลิปซิงก์: พรีเซนเตอร์พากย์เสียง",
  "Image to video workflow": "เวิร์กโฟลว์ ภาพเป็นวิดีโอ",
};

// The prompts of the seeded templates are stored in English; in Thai the panel shows these instead (the rest come from the data).
const prompts: Record<string, string> = {
  "Create a premium product advertisement with intentional lighting, a clean composition, and a clear hero product.":
    "สร้างโฆษณาสินค้าพรีเมียมด้วยแสงที่ตั้งใจจัด องค์ประกอบภาพสะอาดตา และเน้นสินค้าหลักให้เด่นชัด",
  "Create an engaging presenter video with a confident delivery, natural pacing, and a clean branded background.":
    "สร้างวิดีโอพรีเซนเตอร์ที่น่าติดตาม ถ่ายทอดอย่างมั่นใจ จังหวะเป็นธรรมชาติ ฉากหลังสะอาดตาและสื่อถึงแบรนด์",
  "Create a natural, conversational dialogue with clear speaker turns, warm delivery, and purposeful pacing.":
    "สร้างบทสนทนาที่เป็นธรรมชาติ แบ่งช่วงผู้พูดชัดเจน น้ำเสียงอบอุ่น และจังหวะที่มีจุดมุ่งหมาย",
  "Create a clear training video with an easy-to-follow structure, helpful visual examples, and a calm professional tone.":
    "สร้างวิดีโออบรมที่ชัดเจน โครงสร้างติดตามง่าย มีตัวอย่างภาพประกอบที่เป็นประโยชน์ และน้ำเสียงมืออาชีพที่ใจเย็น",
  "Replace the main character in the source video with my character and keep the original camera movement and timing.":
    "แทนที่ตัวละครหลักในวิดีโอต้นฉบับด้วยตัวละครของฉัน โดยคงการเคลื่อนกล้องและจังหวะเวลาเดิมไว้",
  "A woman in a white dress stands in a field of flowers at sunset, a gentle breeze moving her hair, soft warm light.":
    "ผู้หญิงในชุดสีขาวยืนอยู่กลางทุ่งดอกไม้ยามพระอาทิตย์ตก ลมพัดผมเบาๆ แสงอบอุ่นนุ่มนวล",
  "Show my product in the source video, keeping the same camera motion, lighting direction and pacing.":
    "แสดงสินค้าของฉันในวิดีโอต้นฉบับ โดยคงการเคลื่อนกล้อง ทิศทางแสง และจังหวะเดิมไว้",
};

// In Thai the template's own Thai text (set in the admin) comes first; the maps above only cover older templates that have none.
export const promptOf = (t: Template, locale: CopyLocale) => {
  const text = t.prompt?.trim() ?? "";
  if (locale !== "th") return text;
  return t.promptTh?.trim() || prompts[text] || text;
};

export const copy = (t: Template, locale: CopyLocale) => {
  const base = templateCopy(
    t.title,
    t.description,
    typeof t.settings?.feature === "string" ? t.settings.feature : undefined,
    t.kind,
    locale,
  );
  return locale === "th" && t.descriptionTh?.trim() ? { ...base, description: t.descriptionTh.trim() } : base;
};

/**
 * A name made from a prompt: the first line only, with a {placeholder} read as plain words, kept to a short length at a word.
 * A template saved from a clip used to take the start of the whole prompt as its name, line breaks and all.
 */
export function tidyTitle(text: string, max = 60): string {
  const line = text.split(/\r?\n/).find((part) => part.trim()) ?? "";
  const plain = line.replace(/\{([^}]*)\}/g, (_, key: string) => key.replace(/_/g, " ")).replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)).trim()}…`;
}

export const name = (t: Template, locale: CopyLocale) => {
  const title = (locale === "th" ? t.titleTh?.trim() || titles[t.title] : undefined) ?? copy(t, locale).title;
  // Only names that look like a prompt need tidying: a line break or a {placeholder} in them.
  return /[\r\n]|\{[^}]*\}?/.test(title) ? tidyTitle(title) : title;
};

export function templateHref(t: Template) {
  const url = new URL(t.targetPath, "http://template.local");
  url.searchParams.set("template", t.slug);
  return url.pathname + url.search + url.hash;
}

export const valid = (v?: string) => !!v && !v.includes("\\") && (/^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v));

/** Height follows the work's own aspect ratio (9:16 tall, 16:9 wide), kept between those two. */
const fallbackRatio: Record<TemplateKind, number> = { video: 16 / 9, image: 4 / 5, audio: 1, document: 3 / 4 };

export function ratioOf(t: Template) {
  const raw = [t.settings?.ratio, t.settings?.aspectRatio, t.format].find(
    (v): v is string => typeof v === "string" && /\d+\s*:\s*\d+/.test(v),
  );
  const m = raw?.match(/(\d+)\s*:\s*(\d+)/);
  const ratio = m ? Number(m[1]) / Number(m[2]) : fallbackRatio[t.kind];
  return Math.min(16 / 9, Math.max(9 / 16, Number.isFinite(ratio) && ratio > 0 ? ratio : 1));
}

/** A product template: recreating it asks for the visitor's own product (and optionally a person) first. */
export const isProductTemplate = (t: Template) =>
  t.kind === "video" &&
  modeOf(t) === "create" &&
  !t.id.startsWith(WORK_ID) &&
  (t.category === "Product Ads & Commercial" || (t.tags ?? []).some((tag) => tag.toLowerCase() === "product"));
