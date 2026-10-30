const systemTitle = /^(create a high-quality image that follows the user instruction|preserve the entire original image content|upscale the provided image|continue the source image naturally|generate only the new canvas area|perform background removal|edit the provided source image)/i;
type CopyLocale = "th" | "en";
const labels: Record<CopyLocale, Record<string, string>> = {
  th: { "extend-image": "ขยายภาพ", "upscale": "เพิ่มความละเอียดภาพ", "image-to-image": "ปรับแต่งภาพ", "text-to-image": "สร้างภาพ", "style-transfer": "เปลี่ยนสไตล์ภาพ", "background-removal": "ปรับพื้นหลังภาพ", "text-to-video": "สร้างวิดีโอ", "image-to-video": "สร้างวิดีโอจากภาพ", "tts": "เสียงบรรยาย" },
  en: { "extend-image": "Extend image", "upscale": "Upscale image", "image-to-image": "Image edit", "text-to-image": "Create image", "style-transfer": "Style transfer", "background-removal": "Image background", "text-to-video": "Create video", "image-to-video": "Create video from image", "tts": "Voiceover" },
};
const kindFallback: Record<CopyLocale, { video: string; audio: string; image: string }> = {
  th: { video: "เทมเพลตวิดีโอ", audio: "เทมเพลตเสียง", image: "เทมเพลตภาพ" },
  en: { video: "Video template", audio: "Audio template", image: "Image template" },
};
const reuseDescription: Record<CopyLocale, string> = {
  th: "ใช้ผลงานนี้เป็นต้นแบบ พร้อมปรับแต่งค่าก่อนสร้างงานของคุณ",
  en: "Use this work as a starting point and adjust the settings before you create.",
};
export function templateCopy(title: string, description: string, feature?: string, kind = "image", locale: CopyLocale = "th") {
  const fallback = labels[locale][feature ?? ""] ?? (kind === "video" ? kindFallback[locale].video : kind === "audio" ? kindFallback[locale].audio : kindFallback[locale].image);
  return {
    title: systemTitle.test(title.trim()) ? fallback : title,
    description: systemTitle.test(description.trim()) ? reuseDescription[locale] : description,
  };
}
