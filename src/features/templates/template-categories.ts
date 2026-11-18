type CopyLocale = "th" | "en";

/** Thai names for the categories templates are filed under. A category that is not listed shows as it was written. */
const categoriesTh: Record<string, string> = {
  "AI Image & Product Photography": "ภาพ AI และภาพถ่ายสินค้า",
  "AI Presenter & Talking Avatar": "พรีเซนเตอร์ AI และอวตารพูดได้",
  Advertising: "โฆษณา",
  "Anime, Fantasy & Animation": "อนิเมะ แฟนตาซี และแอนิเมชัน",
  Audio: "เสียง",
  "Branding & Graphic Design": "แบรนด์ดิ้งและกราฟิกดีไซน์",
  "Business & Corporate": "ธุรกิจและองค์กร",
  "Cinematic & Storytelling": "ภาพยนตร์และการเล่าเรื่อง",
  "Edit video": "แก้ไขวิดีโอ",
  "Education & Explainer": "การศึกษาและอธิบายเนื้อหา",
  "Fitness, Health & Wellness": "ฟิตเนสและสุขภาพ",
  "Food & Cooking": "อาหารและการทำอาหาร",
  "Gaming & Sci-Fi": "เกมและไซไฟ",
  Motion: "โมชัน",
  "Motion Graphics & Transitions": "โมชันกราฟิกและทรานซิชัน",
  Presenter: "พรีเซนเตอร์",
  "Product Ads & Commercial": "โฆษณาสินค้า",
  "Real Estate & Architecture": "อสังหาริมทรัพย์และสถาปัตยกรรม",
  "Seasonal & Special Events": "เทศกาลและอีเวนต์พิเศษ",
  "Social Media & Viral Content": "โซเชียลมีเดียและคอนเทนต์ไวรัล",
  "Travel, Nature & Lifestyle": "ท่องเที่ยว ธรรมชาติ และไลฟ์สไตล์",
  "UGC & Influencer Marketing": "UGC และการตลาดอินฟลูเอนเซอร์",
  Video: "วิดีโอ",
  "Voice, Music & Sound Design": "เสียงพูด ดนตรี และงานออกแบบเสียง",
  image: "ภาพ",
};

export function categoryLabel(name: string, locale: CopyLocale): string {
  return locale === "th" ? (categoriesTh[name] ?? name) : name;
}
