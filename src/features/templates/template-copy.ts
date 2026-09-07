const systemTitle = /^(create a high-quality image that follows the user instruction|preserve the entire original image content|upscale the provided image|continue the source image naturally|generate only the new canvas area)/i;
const labels: Record<string,string> = {'extend-image':'ขยายภาพ','upscale':'เพิ่มความละเอียดภาพ','image-to-image':'ปรับแต่งภาพ','text-to-image':'สร้างภาพ','style-transfer':'เปลี่ยนสไตล์ภาพ','background-removal':'ปรับพื้นหลังภาพ','text-to-video':'สร้างวิดีโอ','image-to-video':'สร้างวิดีโอจากภาพ','tts':'เสียงบรรยาย'};
export function templateCopy(title: string, description: string, feature?: string, kind='image') {
  const fallback = labels[feature ?? ''] ?? (kind==='video'?'เทมเพลตวิดีโอ':kind==='audio'?'เทมเพลตเสียง':'เทมเพลตภาพ');
  return {
    title: systemTitle.test(title.trim()) ? fallback : title,
    description: systemTitle.test(description.trim()) ? 'ใช้ผลงานนี้เป็นต้นแบบ พร้อมปรับแต่งค่าก่อนสร้างงานของคุณ' : description,
  };
}
