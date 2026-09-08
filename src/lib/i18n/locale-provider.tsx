"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Locale, type TranslationKey, type TranslationParams } from "./dictionary";

export type { Locale, TranslationKey } from "./dictionary";

type LocaleContextValue = {
  locale: Locale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  setLocale: (locale: Locale) => void;
  persistLocale: (locale?: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

type ShellCopy = {
  nav: Record<string, string>;
  header: { search: string; searchAssets: string; openSearch: string; openNotifications: string };
  rail: { thisMonth: string; creditsRemaining: string; used: string; total: string; viewUsage: string; quickTip: string; tip: string; browseTemplates: string; needHelp: string; helpCenter: string };
  account: { openMenu: string; actions: string; logout: string; loggingOut: string; logoutFailed: string };
};

function createShellCopy(locale: Locale): ShellCopy {
  const t = (key: TranslationKey) => translate(locale, key);
  return {
    nav: {
      "/home": t("shell.nav.home"), "/projects": t("shell.nav.projects"), "/templates": t("shell.nav.templates"), "/assets": t("shell.nav.assets"), "/history": t("shell.nav.history"), "/usage": t("shell.nav.usage"), "/settings": t("shell.nav.settings"), "/create/image": t("shell.nav.image"), "/create/video": t("shell.nav.video"), "/create/audio": t("shell.nav.audio"), create: t("shell.nav.create"),
    },
    header: { search: t("shell.header.search"), searchAssets: t("shell.header.searchAssets"), openSearch: t("shell.header.openSearch"), openNotifications: t("shell.header.openNotifications") },
    rail: { thisMonth: t("shell.rail.thisMonth"), creditsRemaining: t("shell.rail.creditsRemaining"), used: t("shell.rail.used"), total: t("shell.rail.total"), viewUsage: t("shell.rail.viewUsage"), quickTip: t("shell.rail.quickTip"), tip: t("shell.rail.tip"), browseTemplates: t("shell.rail.browseTemplates"), needHelp: t("shell.rail.needHelp"), helpCenter: t("shell.rail.helpCenter") },
    account: { openMenu: t("shell.account.openMenu"), actions: t("shell.account.actions"), logout: t("shell.account.logout"), loggingOut: t("shell.account.loggingOut"), logoutFailed: t("shell.account.logoutFailed") },
  };
}

export const shellCopy: Record<Locale, ShellCopy> = { th: createShellCopy("th"), en: createShellCopy("en") };

// Legacy feature screens still contain copy authored before the shared locale layer.
// Keep this as an exact whole-phrase compatibility map while those screens migrate
// to typed copy objects. Never translate individual words or substrings here.
const featurePhraseTranslations: Record<string, string> = {
  "OR CONTINUE WITH": "หรือเข้าสู่ระบบด้วย",
  "Don't have an account?": "ยังไม่มีบัญชี?",
  "Already have an account?": "มีบัญชีอยู่แล้ว?",
  "Sign up": "สมัครสมาชิก",
  "Keep me signed in": "ให้ฉันอยู่ในระบบต่อไป",
  "Keep it private": "เก็บรหัสผ่านเป็นความลับ",
  "Email address": "อีเมล",
  "Work email": "อีเมลที่ทำงาน",
  "Password": "รหัสผ่าน",
  "Confirm password": "ยืนยันรหัสผ่าน",
  "Enter your password": "กรอกรหัสผ่าน",
  "Re-enter your password": "กรอกรหัสผ่านอีกครั้ง",
  "Passwords do not match": "รหัสผ่านไม่ตรงกัน",
  "8+ characters": "อย่างน้อย 8 ตัวอักษร",
  "LOGIN": "เข้าสู่ระบบ",
  "Login": "เข้าสู่ระบบ",
  "CREATE ACCOUNT": "สมัครสมาชิก",
  "Signing in...": "กำลังเข้าสู่ระบบ...",
  "Creating account...": "กำลังสร้างบัญชี...",
  "Connecting...": "กำลังเชื่อมต่อ...",
  "Continue with Google": "เข้าสู่ระบบด้วย Google",
  "Welcome back": "ยินดีต้อนรับกลับ",
  "Create your account": "สร้างบัญชีของคุณ",
  "Check your inbox": "ตรวจสอบอีเมลของคุณ",
  "Back to login": "กลับไปเข้าสู่ระบบ",
  "Resend confirmation email": "ส่งอีเมลยืนยันอีกครั้ง",
  "Sending...": "กำลังส่ง...",
  "Image to Video": "รูปภาพเป็นวิดีโอ",
  "IMAGE TO VIDEO": "รูปภาพเป็นวิดีโอ",
  "Text to Video": "ข้อความเป็นวิดีโอ",
  "TEXT TO VIDEO": "ข้อความเป็นวิดีโอ",
  "People Video": "วิดีโอคน",
  "PEOPLE VIDEO": "วิดีโอคน",
  "Motion Transfer": "ถ่ายโอนการเคลื่อนไหว",
  "MOTION TRANSFER": "ถ่ายโอนการเคลื่อนไหว",
  "Extend Video": "ขยายวิดีโอ",
  "EXTEND VIDEO": "ขยายวิดีโอ",
  "EXTENDING VIDEO": "กำลังขยายวิดีโอ",
  "Image to Image": "แปลงรูปภาพ",
  "IMAGE TO IMAGE": "แปลงรูปภาพ",
  "AI Style Transfer": "ถ่ายโอนสไตล์ด้วย AI",
  "AI STYLE TRANSFER": "ถ่ายโอนสไตล์ด้วย AI",
  "AI Background": "พื้นหลัง AI",
  "AI BACKGROUND": "พื้นหลัง AI",
  "Extend Image": "ขยายรูปภาพ",
  "EXTEND IMAGE": "ขยายรูปภาพ",
  "Upscale Image": "เพิ่มความละเอียดรูปภาพ",
  "UPSCALE IMAGE": "เพิ่มความละเอียดรูปภาพ",
  "Text to Image": "ข้อความเป็นรูปภาพ",
  "TEXT TO IMAGE": "ข้อความเป็นรูปภาพ",
  "Text to Speech": "ข้อความเป็นเสียงพูด",
  "Podcast & Dialogue": "พอดแคสต์และบทสนทนา",
  "Voice Clone": "โคลนเสียง",
  "Sound Effects": "เอฟเฟกต์เสียง",
  "Audio Cleanup": "ล้างเสียง",
  "Reference to Video": "ภาพอ้างอิงเป็นวิดีโอ",
  "Single Storyboard Image": "รูปภาพสตอรี่บอร์ดเดี่ยว",
  "Multi-Scene Storyboard": "สตอรี่บอร์ดหลายฉาก",
  "Flexible Storyboard": "สตอรี่บอร์ดแบบยืดหยุ่น",
  "Frame Continuation": "ต่อเนื่องจากเฟรม",
  "Video to SFX": "วิดีโอเป็นเอฟเฟกต์เสียง",
  "Video to Music": "วิดีโอเป็นเพลง",
  "Video dubbing + mouth sync": "พากย์วิดีโอพร้อมซิงก์ปาก",
  "MOUTH SYNC": "ซิงก์ปาก",
  "SYNC AUDIO": "ซิงก์เสียง",
  "PERFORMANCE DIRECTION": "ทิศทางการแสดง",
  "REFERENCE MOTION": "การเคลื่อนไหวอ้างอิง",
  "FULL PERFORMANCE": "การแสดงเต็มรูปแบบ",
  "CINEMATIC WHOOSH": "เสียงหวือแบบภาพยนตร์",
  "ROOM NOISE": "เสียงรบกวนในห้อง",
  "VOICE SAMPLE": "ตัวอย่างเสียง",
  "VOICE MODEL": "โมเดลเสียง",
  "Audio-driven talking character": "ตัวละครพูดจากเสียง",
  "Audio-driven full performance": "การแสดงเต็มรูปแบบจากเสียง",
  "Scripted talking character": "ตัวละครพูดตามสคริปต์",
  "Script + voice mouth sync": "ซิงก์ปากจากสคริปต์และเสียง",
  "Dialogue Builder": "ตัวสร้างบทสนทนา",
  "Generate an image": "สร้างรูปภาพ",
  "Generate a video": "สร้างวิดีโอ",
  "Generate audio": "สร้างเสียง",
  "Generate Audio": "สร้างเสียง",
  "Create an AI presenter": "สร้างพิธีกร AI",
  "Build a custom workflow": "สร้างเวิร์กโฟลว์แบบกำหนดเอง",
  "Create a document": "สร้างเอกสาร",
  "Create stunning backgrounds": "สร้างพื้นหลังที่โดดเด่น",
  "Create video that moves": "สร้างวิดีโอที่มีการเคลื่อนไหว",
  "Create voiceovers": "สร้างเสียงพากย์",
  "Create a voice identity": "สร้างตัวตนของเสียง",
  "New generation": "การสร้างใหม่",
  "Back to workspace": "กลับไปที่เวิร์กสเปซ",
  "Describe your idea": "อธิบายไอเดียของคุณ",
  "Your request will be validated and connected to a provider in a later phase.": "คำขอของคุณจะได้รับการตรวจสอบและเชื่อมต่อกับผู้ให้บริการในระยะถัดไป",
  "Prepare a presenter-led content brief for a future generation workflow.": "เตรียมบรีฟคอนเทนต์แบบมีพิธีกรสำหรับเวิร์กโฟลว์การสร้างในอนาคต",
  "Estimated cost will appear once pricing is configured.": "ค่าใช้จ่ายโดยประมาณจะแสดงเมื่อกำหนดราคาแล้ว",
  "Save generation brief": "บันทึกบรีฟการสร้าง",
  "More models coming soon": "โมเดลเพิ่มเติมจะพร้อมใช้งานเร็ว ๆ นี้",
  "Square · 1:1": "สี่เหลี่ยม · 1:1",
  "Landscape · 16:9": "แนวนอน · 16:9",
  "Portrait · 9:16": "แนวตั้ง · 9:16",
  "Create a focused visual brief with the direction and format you need.": "สร้างบรีฟภาพที่ชัดเจนพร้อมทิศทางและรูปแบบที่ต้องการ",
  "Define the story, pacing, and visual direction for your next video concept.": "กำหนดเรื่องราว จังหวะ และทิศทางภาพสำหรับคอนเซ็ปต์วิดีโอถัดไป",
  "Set the voice, feeling, and format for your audio idea.": "กำหนดเสียง อารมณ์ และรูปแบบสำหรับไอเดียเสียงของคุณ",
  "Build a structured document brief with AI and OCR-ready inputs.": "สร้างบรีฟเอกสารที่มีโครงสร้างพร้อมอินพุตสำหรับ AI และ OCR",
  "Design a repeatable creative workflow for your team.": "ออกแบบเวิร์กโฟลว์สร้างสรรค์ที่ทีมทำซ้ำได้",
  "Video generation modes": "โหมดการสร้างวิดีโอ",
  "GENERATION MODE": "โหมดการสร้าง",
  "Generate one video from one image": "สร้างวิดีโอหนึ่งรายการจากรูปภาพหนึ่งภาพ",
  "Smart Enhance": "ปรับปรุงอัจฉริยะ",
  "Negative Prompt": "พรอมต์เชิงลบ",
  "Start Frame": "เฟรมเริ่มต้น",
  "Preview live": "ตัวอย่างสด",
  "Video preview not generated": "ยังไม่ได้สร้างตัวอย่างวิดีโอ",
  "Video preview views": "มุมมองตัวอย่างวิดีโอ",
  "Latest generated video will appear here.": "วิดีโอที่สร้างล่าสุดจะแสดงที่นี่",
  "Please sign in before generating a video": "กรุณาเข้าสู่ระบบก่อนสร้างวิดีโอ",
  "ESTIMATED CREDITS": "เครดิตโดยประมาณ",
  "1 scene x 5 sec": "1 ฉาก × 5 วินาที",
  "2 scene x 5 sec": "2 ฉาก × 5 วินาที",
  "3 scene x 5 sec": "3 ฉาก × 5 วินาที",
  "MODE": "โหมด",
  "Required": "จำเป็น",
  "Optional": "ไม่บังคับ",
  "Image input not supported": "ไม่รองรับอินพุตรูปภาพ",
  "This model does not support image input.": "โมเดลนี้ไม่รองรับอินพุตรูปภาพ",
  "This model requires an audio file.": "โมเดลนี้ต้องใช้ไฟล์เสียง",
  "Please upload an image before generating.": "กรุณาอัปโหลดรูปภาพก่อนสร้าง",
  "Please sign in before generating audio": "กรุณาเข้าสู่ระบบก่อนสร้างเสียง",
  "Please sign in before generating an image": "กรุณาเข้าสู่ระบบก่อนสร้างรูปภาพ",
  "No generated image yet.": "ยังไม่มีรูปภาพที่สร้าง",
  "No generated audio yet.": "ยังไม่มีเสียงที่สร้าง",
  "No saved audio yet.": "ยังไม่มีเสียงที่บันทึก",
  "Audio preview": "ตัวอย่างเสียง",
  "Audio preview and scenes": "ตัวอย่างเสียงและฉาก",
  "Audio scenes and timeline": "ฉากเสียงและไทม์ไลน์",
  "Audio script and prompt": "สคริปต์และพรอมต์เสียง",
  "Audio settings": "การตั้งค่าเสียง",
  "Audio tools": "เครื่องมือเสียง",
  "Audio tutorials": "บทช่วยสอนด้านเสียง",
  "Podcast settings": "การตั้งค่าพอดแคสต์",
  "Podcast speakers": "ผู้พูดพอดแคสต์",
  "English (US)": "English (สหรัฐฯ)",
  "Thai (ไทย)": "ไทย",
  "Image generation": "การสร้างรูปภาพ",
  "Video generation": "การสร้างวิดีโอ",
  "Audio generation": "การสร้างเสียง",
  "Generation history": "ประวัติการสร้าง",
  "Generation preview": "ตัวอย่างการสร้าง",
  "Video generation mode options": "ตัวเลือกโหมดการสร้างวิดีโอ",
  "Video model options": "ตัวเลือกโมเดลวิดีโอ",
  "Text-to-video model options": "ตัวเลือกโมเดลข้อความเป็นวิดีโอ",
  "Motion transfer model options": "ตัวเลือกโมเดลถ่ายโอนการเคลื่อนไหว",
  "Extend Video model options": "ตัวเลือกโมเดลขยายวิดีโอ",
  "Model options": "ตัวเลือกโมเดล",
  "Select a model": "เลือกโมเดล",
  "Select a model before generating.": "เลือกโมเดลก่อนสร้าง",
  "Select a video model before generating.": "เลือกโมเดลวิดีโอก่อนสร้าง",
  "Select a video model first.": "เลือกโมเดลวิดีโอก่อน",
  "Select a text-to-video model.": "เลือกโมเดลข้อความเป็นวิดีโอ",
  "Select a motion transfer model.": "เลือกโมเดลถ่ายโอนการเคลื่อนไหว",
  "Select an Extend Video model.": "เลือกโมเดลขยายวิดีโอ",
  "No compatible model": "ไม่มีโมเดลที่รองรับ",
  "No compatible model configured": "ยังไม่ได้ตั้งค่าโมเดลที่รองรับ",
  "Prompt is required.": "ต้องใส่พรอมต์",
  "Prompt is required for this model.": "โมเดลนี้ต้องใส่พรอมต์",
  "Prompt must be 2,000 characters or fewer.": "พรอมต์ต้องมีความยาวไม่เกิน 2,000 ตัวอักษร",
  "Add a prompt before generating.": "เพิ่มพรอมต์ก่อนสร้าง",
  "Add a prompt before transforming.": "เพิ่มพรอมต์ก่อนแปลงรูปภาพ",
  "Add text and choose a voice for every scene.": "เพิ่มข้อความและเลือกเสียงให้ครบทุกฉาก",
  "Describe your video": "อธิบายวิดีโอของคุณ",
  "Describe how you want to transform the image": "อธิบายว่าต้องการแปลงรูปภาพอย่างไร",
  "Describe the scene and the movement you want": "อธิบายฉากและการเคลื่อนไหวที่ต้องการ",
  "Describe the scene and let the selected model create the motion.": "อธิบายฉาก แล้วให้โมเดลที่เลือกสร้างการเคลื่อนไหว",
  "Drive a character with the movement from a reference video while keeping the target identity.": "ควบคุมตัวละครด้วยการเคลื่อนไหวจากวิดีโออ้างอิง โดยคงตัวตนของตัวละครไว้",
  "Continue an existing video with a new prompt-guided segment.": "ต่อวิดีโอเดิมด้วยช่วงใหม่ที่กำกับด้วยพรอมต์",
  "Match mouth movement to speech while keeping the source face and motion intact.": "จับคู่การขยับปากกับเสียงพูด โดยคงใบหน้าและการเคลื่อนไหวต้นฉบับไว้",
  "Turn a person or character into a speaking performer with expression, pose, and natural head movement.": "เปลี่ยนบุคคลหรือตัวละครให้เป็นผู้แสดงที่พูดได้ พร้อมสีหน้า ท่าทาง และการเคลื่อนไหวศีรษะอย่างเป็นธรรมชาติ",
  "Use this when the main job is accurate dialogue sync—not a new acting performance.": "ใช้เมื่อต้องการซิงก์บทสนทนาให้แม่นยำ ไม่ใช่สร้างการแสดงใหม่",
  "Use this when the movement is the source of truth—not the dialogue or mouth shape.": "ใช้เมื่อการเคลื่อนไหวคือสิ่งสำคัญ ไม่ใช่บทสนทนาหรือรูปปาก",
  "Use this when you want the character to perform, not only move the mouth.": "ใช้เมื่อต้องการให้ตัวละครแสดง ไม่ใช่แค่ขยับปาก",
  "Use reference images to guide one video": "ใช้ภาพอ้างอิงเพื่อกำกับวิดีโอหนึ่งรายการ",
  "Build the video scene by scene": "สร้างวิดีโอทีละฉาก",
  "Split the uploaded sheet into scenes automatically": "แยกชีตที่อัปโหลดเป็นฉากโดยอัตโนมัติ",
  "Describe the motion. The previous scene's last frame is used automatically.": "อธิบายการเคลื่อนไหว ระบบจะใช้เฟรมสุดท้ายของฉากก่อนหน้าให้อัตโนมัติ",
  "Describe the desired performance…": "อธิบายการแสดงที่ต้องการ…",
  "Add a little more direction to your prompt.": "เพิ่มรายละเอียดให้พรอมต์อีกเล็กน้อย",
  "Apply cinematic color tones": "ใช้โทนสีแบบภาพยนตร์",
  "Apply soft cinematic lighting and detailed brush texture": "ใช้แสงนุ่มแบบภาพยนตร์และพื้นผิวแปรงที่มีรายละเอียด",
  "Choose a background mode, add a prompt, or upload a reference.": "เลือกโหมดพื้นหลัง เพิ่มพรอมต์ หรืออัปโหลดภาพอ้างอิง",
  "Choose a style preset, upload a reference, or add a prompt.": "เลือกพรีเซ็ตสไตล์ อัปโหลดภาพอ้างอิง หรือเพิ่มพรอมต์",
  "Choose or describe": "เลือกหรืออธิบาย",
  "Choose a background mode": "เลือกโหมดพื้นหลัง",
  "Background replacement": "การเปลี่ยนพื้นหลัง",
  "Create a background from a prompt": "สร้างพื้นหลังจากพรอมต์",
  "Fill the cutout with a selected color": "เติมพื้นที่ตัดออกด้วยสีที่เลือก",
  "Clean your image in one click": "ล้างรูปภาพในคลิกเดียว",
  "Cut out the subject cleanly": "ตัดตัวแบบออกอย่างเรียบร้อย",
  "Increase resolution without losing quality": "เพิ่มความละเอียดโดยไม่เสียคุณภาพ",
  "Extend beyond image borders": "ขยายออกนอกขอบรูปภาพ",
  "Transform the source image": "แปลงรูปภาพต้นฉบับ",
  "Expand around the image": "ขยายรอบรูปภาพ",
  "Expand amount": "ปริมาณการขยาย",
  "Expand direction": "ทิศทางการขยาย",
  "Add canvas above": "เพิ่มพื้นที่ด้านบน",
  "Add canvas below": "เพิ่มพื้นที่ด้านล่าง",
  "Add canvas on the left": "เพิ่มพื้นที่ด้านซ้าย",
  "Add canvas on the right": "เพิ่มพื้นที่ด้านขวา",
  "Upload a source image.": "อัปโหลดรูปภาพต้นฉบับ",
  "Upload a source image before changing the background.": "อัปโหลดรูปภาพต้นฉบับก่อนเปลี่ยนพื้นหลัง",
  "Upload a source image before extending.": "อัปโหลดรูปภาพต้นฉบับก่อนขยาย",
  "Upload a reference image before transforming.": "อัปโหลดภาพอ้างอิงก่อนแปลง",
  "Upload a content image before applying a style.": "อัปโหลดรูปภาพเนื้อหาก่อนใช้สไตล์",
  "Upload an image before upscaling.": "อัปโหลดรูปภาพก่อนเพิ่มความละเอียด",
  "Upload a storyboard image before generating.": "อัปโหลดรูปภาพสตอรี่บอร์ดก่อนสร้าง",
  "Upload a storyboard image and describe the motion.": "อัปโหลดรูปภาพสตอรี่บอร์ดและอธิบายการเคลื่อนไหว",
  "Upload a storyboard sheet to detect scenes": "อัปโหลดชีตสตอรี่บอร์ดเพื่อแยกฉาก",
  "Upload Image": "อัปโหลดรูปภาพ",
  "Upload Video": "อัปโหลดวิดีโอ",
  "Upload Image or Video": "อัปโหลดรูปภาพหรือวิดีโอ",
  "Upload audio file": "อัปโหลดไฟล์เสียง",
  "Upload images": "อัปโหลดรูปภาพ",
  "Upload source video.": "อัปโหลดวิดีโอต้นฉบับ",
  "Upload a motion video.": "อัปโหลดวิดีโอการเคลื่อนไหว",
  "Replace source image": "แทนที่รูปภาพต้นฉบับ",
  "Remove source image": "ลบรูปภาพต้นฉบับ",
  "Remove reference image": "ลบภาพอ้างอิง",
  "Remove source person": "ลบบุคคลต้นฉบับ",
  "Remove audio": "ลบเสียง",
  "Remove audio file": "ลบไฟล์เสียง",
  "Replace audio file": "แทนที่ไฟล์เสียง",
  "Upload securely…": "กำลังอัปโหลดอย่างปลอดภัย…",
  "Uploading securely...": "กำลังอัปโหลดอย่างปลอดภัย…",
  "Uploading source image…": "กำลังอัปโหลดรูปภาพต้นฉบับ…",
  "Uploading source media…": "กำลังอัปโหลดสื่อต้นฉบับ…",
  "Uploading reference image…": "กำลังอัปโหลดภาพอ้างอิง…",
  "Uploading motion video…": "กำลังอัปโหลดวิดีโอการเคลื่อนไหว…",
  "Uploading audio…": "กำลังอัปโหลดเสียง…",
  "Preview image": "ตัวอย่างรูปภาพ",
  "Preview video": "ตัวอย่างวิดีโอ",
  "PREVIEW IMAGE": "ตัวอย่างรูปภาพ",
  "PREVIEW VIDEO": "ตัวอย่างวิดีโอ",
  "LIVE PREVIEW": "ตัวอย่างสด",
  "Live preview": "ตัวอย่างสด",
  "MODEL PREVIEW": "ตัวอย่างโมเดล",
  "Model preview": "ตัวอย่างโมเดล",
  "UPLOAD SOURCE IMAGE": "อัปโหลดรูปภาพต้นฉบับ",
  "GENERATE IMAGE": "สร้างรูปภาพ",
  "GENERATE VIDEO": "สร้างวิดีโอ",
  "GENERATE BACKGROUND": "สร้างพื้นหลัง",
  "GENERATE A BACKGROUND": "สร้างพื้นหลัง",
  "GENERATE SOUND": "สร้างเสียง",
  "GENERATING VIDEO": "กำลังสร้างวิดีโอ",
  "GENERATING...": "กำลังสร้าง…",
  "CREATING PREVIEW": "กำลังสร้างตัวอย่าง",
  "PREPARING VIDEO": "กำลังเตรียมวิดีโอ",
  "PREPARING GENERATION…": "กำลังเตรียมการสร้าง…",
  "GENERATING VIA BACKEND": "กำลังสร้างผ่านระบบหลังบ้าน",
  "CANCEL GENERATION": "ยกเลิกการสร้าง",
  "RETRY": "ลองอีกครั้ง",
  "Save Changes": "บันทึกการเปลี่ยนแปลง",
  "Save Scene": "บันทึกฉาก",
  "Save voice": "บันทึกเสียง",
  "Add Scene": "เพิ่มฉาก",
  "Add another scene": "เพิ่มฉากอีกฉาก",
  "New scene": "ฉากใหม่",
  "New image": "รูปภาพใหม่",
  "Latest result": "ผลลัพธ์ล่าสุด",
  "Video library": "คลังวิดีโอ",
  "Video results": "ผลลัพธ์วิดีโอ",
  "CURRENT VIDEO": "วิดีโอปัจจุบัน",
  "RECENT VIDEOS": "วิดีโอล่าสุด",
  "RECENT GENERATIONS": "ผลงานที่สร้างล่าสุด",
  "Latest generated video": "วิดีโอที่สร้างล่าสุด",
  "Generated video": "วิดีโอที่สร้างแล้ว",
  "Generated image": "รูปภาพที่สร้างแล้ว",
  "Generated result": "ผลลัพธ์ที่สร้างแล้ว",
  "Generated variations will appear here.": "รูปแบบที่สร้างจะแสดงที่นี่",
  "Generated videos will appear here.": "วิดีโอที่สร้างจะแสดงที่นี่",
  "No generated videos yet.": "ยังไม่มีวิดีโอที่สร้าง",
  "No generation history yet.": "ยังไม่มีประวัติการสร้าง",
  "View history": "ดูประวัติ",
  "View Mask": "ดูมาสก์",
  "Edit Mask": "แก้ไขมาสก์",
  "Mask refinement tool": "เครื่องมือปรับแต่งมาสก์",
  "Current preview": "ตัวอย่างปัจจุบัน",
  "Gallery view": "มุมมองแกลเลอรี",
  "Previous variations": "รูปแบบก่อนหน้า",
  "Next variations": "รูปแบบถัดไป",
  "Previous recent generations": "ผลงานล่าสุดก่อนหน้า",
  "Next recent generations": "ผลงานล่าสุดถัดไป",
  "Previous style presets": "พรีเซ็ตสไตล์ก่อนหน้า",
  "Next style presets": "พรีเซ็ตสไตล์ถัดไป",
  "Download video": "ดาวน์โหลดวิดีโอ",
  "Favorite video": "เพิ่มวิดีโอในรายการโปรด",
  "Compare original and generated image": "เปรียบเทียบรูปภาพต้นฉบับและรูปภาพที่สร้าง",
  "Close comparison": "ปิดการเปรียบเทียบ",
  "Close image preview": "ปิดตัวอย่างรูปภาพ",
  "Close tutorial": "ปิดบทช่วยสอน",
  "Tutorial": "บทช่วยสอน",
  "Feature guide": "คู่มือฟีเจอร์",
  "Mode-specific guide": "คู่มือเฉพาะโหมด",
  "Loading tutorial...": "กำลังโหลดบทช่วยสอน…",
  "No tutorial is available for this tool yet.": "ยังไม่มีบทช่วยสอนสำหรับเครื่องมือนี้",
  "Learn the key steps before you generate.": "เรียนรู้ขั้นตอนสำคัญก่อนเริ่มสร้าง",
  "Maximum 2,000 characters": "สูงสุด 2,000 ตัวอักษร",
  "TONE": "โทนเสียง",
  "LANGUAGE": "ภาษา",
  "PRONUNCIATION HINTS": "คำแนะนำการออกเสียง",
  "OUTPUT FORMAT": "รูปแบบผลลัพธ์",
  "SPEECH SPEED": "ความเร็วเสียงพูด",
  "BACKGROUND MUSIC": "เพลงพื้นหลัง",
  "No models configured": "ยังไม่ได้ตั้งค่าโมเดล",
  "Manage voices": "จัดการเสียง",
  "Try again": "ลองอีกครั้ง",
  "More preview actions": "การดำเนินการตัวอย่างเพิ่มเติม",
  "Play audio": "เล่นเสียง",
  "Pause audio": "หยุดเสียงชั่วคราว",
  "Rewind 10 seconds": "ย้อนกลับ 10 วินาที",
  "Forward 10 seconds": "เดินหน้า 10 วินาที",
  "Fullscreen audio preview": "ตัวอย่างเสียงเต็มหน้าจอ",
  "Audio progress": "ความคืบหน้าเสียง",
  "Volume": "ระดับเสียง",
  "No results yet. Create audio to save and replay results here.": "ยังไม่มีผลลัพธ์ สร้างเสียงเพื่อบันทึกและเล่นซ้ำที่นี่",
  "Generate audio to save and replay results here.": "สร้างเสียงเพื่อบันทึกและเล่นซ้ำผลลัพธ์ที่นี่",
  "Sound FX": "เอฟเฟกต์เสียง",
  "Auto-generate": "สร้างอัตโนมัติ",
  "Play": "เล่น",
  "Audio guide": "คู่มือเสียง",
  "Voiceover": "เสียงพากย์",
  "Multi-speaker convos": "บทสนทนาหลายผู้พูด",
  "Generate sounds": "สร้างเสียง",
  "Create sounds": "สร้างเสียง",
  "Remove noise": "ลบเสียงรบกวน",
  "Subtitle / Captions": "คำบรรยาย / คำบรรยายใต้ภาพ",
  "automatically": "อัตโนมัติ",
  "Audio / Speakers": "เสียง / ผู้พูด",
  "No results yet": "ยังไม่มีผลลัพธ์",
  "English (UK)": "English (สหราชอาณาจักร)",
  "Japanese": "ภาษาญี่ปุ่น",
  "Thai": "ภาษาไทย",
  "Energetic": "มีพลัง",
  "Friendly": "เป็นมิตร",
  "Premium": "พรีเมียม",
  "Dramatic": "ดราม่า",
  "Current file": "ไฟล์ปัจจุบัน",
  "No scene image selected": "ยังไม่ได้เลือกภาพฉาก",
  "Script or prompt": "สคริปต์หรือพรอมต์",
  "Audio waveform preview": "ตัวอย่างคลื่นเสียง",
  "Gen Audio hero": "ภาพหลักการสร้างเสียง",
  "Gen Audio — AI audio generation studio": "ภาพหลัก Gen Audio — สตูดิโอสร้างเสียงด้วย AI",
  "Gen Image creative studio hero artwork": "ภาพหลักสตูดิโอสร้างรูปภาพ EOS",
  "Maximum 2,000 characters.": "สูงสุด 2,000 ตัวอักษร",
  "Recalculating price…": "กำลังคำนวณราคาใหม่…",
  "Pricing unavailable": "ไม่สามารถคำนวณราคาได้",
  "Estimated credits": "เครดิตโดยประมาณ",
  "Your generation is private and secure": "ผลงานที่สร้างเป็นส่วนตัวและปลอดภัย",
  "Loading model options...": "กำลังโหลดตัวเลือกโมเดล…",
  "Loading video models...": "กำลังโหลดโมเดลวิดีโอ…",
  "Loading text-to-video models...": "กำลังโหลดโมเดลข้อความเป็นวิดีโอ…",
  "Loading motion transfer models…": "กำลังโหลดโมเดลถ่ายโอนการเคลื่อนไหว…",
  "Loading Extend Video models…": "กำลังโหลดโมเดลขยายวิดีโอ…",
  "Please wait": "กรุณารอสักครู่",
  "Waiting for provider…": "กำลังรอผู้ให้บริการ…",
  "Generation cancelled": "ยกเลิกการสร้างแล้ว",
  "Video generation cancelled": "ยกเลิกการสร้างวิดีโอแล้ว",
  "Prompt optimization failed": "ปรับปรุงพรอมต์ไม่สำเร็จ",
  "Image generation failed": "สร้างรูปภาพไม่สำเร็จ",
  "Video generation failed": "สร้างวิดีโอไม่สำเร็จ",
  "Audio generation failed": "สร้างเสียงไม่สำเร็จ",
  "Background generation failed": "สร้างพื้นหลังไม่สำเร็จ",
  "Style transfer failed": "ถ่ายโอนสไตล์ไม่สำเร็จ",
  "Image transformation failed": "แปลงรูปภาพไม่สำเร็จ",
  "Image extension failed": "ขยายรูปภาพไม่สำเร็จ",
  "Image upscaling failed": "เพิ่มความละเอียดรูปภาพไม่สำเร็จ",
  "Unable to generate video": "ไม่สามารถสร้างวิดีโอได้",
  "Unable to load generated videos": "ไม่สามารถโหลดวิดีโอที่สร้างได้",
  "Unable to load recent generations": "ไม่สามารถโหลดผลงานล่าสุดได้",
  "Unable to load tutorial": "ไม่สามารถโหลดบทช่วยสอนได้",
  "Use a sheet with clear gutters between panels": "ใช้ชีตที่มีช่องว่างชัดเจนระหว่างแต่ละแผง",
  "Every scene starts from its own image": "ทุกฉากเริ่มจากรูปภาพของตัวเอง",
  "Continue from the previous scene": "ต่อเนื่องจากฉากก่อนหน้า",
  "Choose the start frame per scene": "เลือกเฟรมเริ่มต้นของแต่ละฉาก",
  "Choose whether this scene starts with a new image or the previous frame.": "เลือกว่าฉากนี้จะเริ่มจากรูปภาพใหม่หรือเฟรมก่อนหน้า",
  "Each panel becomes one video scene": "แต่ละแผงจะกลายเป็นหนึ่งฉากวิดีโอ",
  "Finish preparing the storyboard before generating.": "เตรียมสตอรี่บอร์ดให้เสร็จก่อนเริ่มสร้าง",
  "Every scene needs a prompt before generating.": "ทุกฉากต้องมีพรอมต์ก่อนสร้าง",
  "Please upload an image for this scene.": "กรุณาอัปโหลดรูปภาพสำหรับฉากนี้",
  "Please add a prompt for this scene.": "กรุณาเพิ่มพรอมต์สำหรับฉากนี้",
  "Please choose a voice sample first": "กรุณาเลือกตัวอย่างเสียงก่อน",
  "Please choose a voice before generating.": "กรุณาเลือกเสียงก่อนสร้าง",
  "Please confirm permission to use this voice sample": "กรุณายืนยันสิทธิ์ในการใช้ตัวอย่างเสียงนี้",
  "Upload a clean sample and tune a voice for your next project.": "อัปโหลดตัวอย่างเสียงที่ชัดเจนและปรับแต่งเสียงสำหรับโปรเจกต์ถัดไป",
  "Your ideas deserve a voice that people remember.": "ไอเดียของคุณควรมีเสียงที่ผู้คนจดจำได้",
  "Play test phrase": "เล่นประโยคทดสอบ",
  "Create the voice before playing a test phrase": "สร้างเสียงก่อนเล่นประโยคทดสอบ",
  "Voice ready": "เสียงพร้อมใช้งาน",
  "VOICE READY": "เสียงพร้อมใช้งาน",
  "Voice preview failed": "ตัวอย่างเสียงไม่สำเร็จ",
  "Remove noise and restore clarity without losing the character of the voice.": "ลบเสียงรบกวนและคืนความชัดเจนโดยคงเอกลักษณ์ของเสียงไว้",
  "Polish every recording": "ปรับคุณภาพทุกการบันทึกเสียง",
  "Export as text": "ส่งออกเป็นข้อความ",
  "Transcript Export": "ส่งออกบทถอดเสียง",
  "View all": "ดูทั้งหมด",
  "STYLE PRESETS": "พรีเซ็ตสไตล์",
  "DIAL IT IN": "ปรับให้พอดี",
  "Fullscreen": "เต็มหน้าจอ",
  "3D Render": "เรนเดอร์ 3 มิติ",
  "Cyberpunk": "ไซเบอร์พังก์",
  "Realistic": "สมจริง",
  "Cinematic": "ภาพยนตร์",
  "Anime": "อนิเมะ",
  "None": "ไม่มี",
};

const translatableAttributes = ["aria-label", "placeholder", "title", "alt"] as const;
const originalTextNodes = new WeakMap<Text, { original: string; last: string }>();
const originalAttributes = new WeakMap<Element, Map<string, { original: string; last: string }>>();

function translateFeatureText(value: string, locale: Locale) {
  if (locale === "en" || !value.trim()) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.slice(leading.length, value.length - trailing.length || undefined);
  const sceneEstimate = core.match(/^(\d+) scene x (\d+) sec$/i);
  if (sceneEstimate) return `${leading}${sceneEstimate[1]} ฉาก × ${sceneEstimate[2]} วินาที${trailing}`;
  return `${leading}${featurePhraseTranslations[core] ?? core}${trailing}`;
}

function translateDocument(locale: Locale) {
  if (typeof document === "undefined" || !document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && !parent.closest("script, style, textarea, [data-no-translate]")) {
      const current = textNode.nodeValue ?? "";
      const record = originalTextNodes.get(textNode);
      const original = record && current === record.last ? record.original : current;
      const next = translateFeatureText(original, locale);
      originalTextNodes.set(textNode, { original, last: next });
      if (current !== next) textNode.nodeValue = next;
    }
    node = walker.nextNode();
  }

  for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    if (element.closest("[data-no-translate]")) continue;
    for (const attribute of translatableAttributes) {
      const current = element.getAttribute(attribute);
      if (current === null) continue;
      const records = originalAttributes.get(element) ?? new Map<string, { original: string; last: string }>();
      const record = records.get(attribute);
      const original = record && current === record.last ? record.original : current;
      const next = translateFeatureText(original, locale);
      records.set(attribute, { original, last: next });
      originalAttributes.set(element, records);
      if (current !== next) element.setAttribute(attribute, next);
    }
  }
}

function readStoredLocale(): Locale {
  return window.localStorage.getItem("eos-locale") === "en" ? "en" : "th";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("th");
  const [legacyTranslationReady, setLegacyTranslationReady] = useState(false);

  useEffect(() => {
    const storedLocale = readStoredLocale();
    document.documentElement.lang = storedLocale;
    if (storedLocale === "en") {
      const frame = window.requestAnimationFrame(() => setLocaleState(storedLocale));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "eos-locale") setLocaleState(event.newValue === "en" ? "en" : "th");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Legacy feature screens are still translated by a compatibility observer.
  // Never mutate React-owned DOM during hydration: doing so changes attributes
  // such as `alt` before a nested client component has hydrated and triggers a
  // React hydration mismatch. The short post-hydration delay is intentional;
  // migrated screens use `t(key)` directly and do not need this fallback.
  useEffect(() => {
    const timer = window.setTimeout(() => setLegacyTranslationReady(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!legacyTranslationReady) return;
    let frame = 0;
    const applyTranslations = () => {
      frame = 0;
      translateDocument(locale);
    };
    applyTranslations();
    const observer = new MutationObserver(() => {
      if (frame === 0) frame = window.requestAnimationFrame(applyTranslations);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...translatableAttributes] });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [legacyTranslationReady, locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    t: (key, params) => translate(locale, key, params),
    setLocale: (nextLocale) => setLocaleState(nextLocale),
    persistLocale: (nextLocale = locale) => {
      window.localStorage.setItem("eos-locale", nextLocale);
      window.dispatchEvent(new CustomEvent("eos-language-change", { detail: { locale: nextLocale } }));
    },
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
