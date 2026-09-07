# /usage — QA และ UX review

วันที่ 7 กันยายน 2026 · ตรวจหน้า local จริงผ่าน preview · สถานะ: ยังไม่ผ่าน QA

รอบนี้เป็นการตรวจและเสนอแบบใหม่ ยังไม่ได้เปลี่ยน application code, environment, authentication หรือข้อมูลเครดิต ไม่ได้เรียกเก็บเงินจริง

## ผลตามลำดับการใช้งาน

1. **เข้าสู่หน้าเมื่อ session หมดอายุ — FAIL.** แสดงข้อความให้เข้าสู่ระบบ แต่ยังแสดงยอดตัวอย่าง 4,250 และกิจกรรมเก่า ควรซ่อนข้อมูลบัญชีจนโหลดสำเร็จ พร้อมปุ่มเข้าสู่ระบบ/ลองใหม่ ดู [ภาพก่อนเข้าสู่ระบบ](01-overview-before.png)
2. **ภาพรวมหลังเข้าสู่ระบบ — PARTIAL.** แสดงเครดิตจริง 9,898 ใช้เดือนนี้ 102 และกิจกรรมล่าสุดได้ แต่แสดง 0% used เพราะไม่มีเครดิตแพ็กเกจเป็นฐานคำนวณ ไม่ควรแสดงเปอร์เซ็นต์เมื่อไม่มีฐาน นอกจากนี้ข้อความ reset ทำให้เข้าใจผิดว่า wallet จะหมดอายุ ดู [ภาพรวม](03-overview-desktop.png)
3. **เลือกช่วงเวลาก่อนหน้า — PARTIAL.** ข้อมูลเปลี่ยนเป็นศูนย์ได้ แต่ empty state ไม่มีคำแนะนำและยังแสดง wallet ปัจจุบันโดยไม่แยกความหมายให้ชัด ดู [ช่วงไม่มีรายการ](04-empty-period.png)
4. **รายละเอียดการใช้ — FAIL.** ยังเป็นข้อมูลตัวอย่าง 1,750 เครดิต / 128 generations / รายการพฤษภาคม 2025 ไม่ตรงภาพรวม ปุ่ม Search, Filter และ Export ที่ทดลองไม่ทำงาน; ตรวจ source พบข้อมูลและ controls ยังเป็น placeholder ดู [รายละเอียด](05-details-desktop.png)
5. **ประวัติเครดิต — FAIL.** แสดง 4,250 ขณะที่ sidebar แสดงยอดจริง 9,898 พร้อมยอดเติม/ใช้และวันหมดอายุจากข้อมูลตัวอย่าง ดู [ประวัติ](06-history-desktop.png)
6. **ดูรายการทั้งหมด — FAIL.** คลิกแล้วไม่เปลี่ยนหน้า/รายการ และ source ไม่มี handler
7. **Team Usage — PASS.** ไม่แสดงแท็บตามความต้องการเดิม
8. **เลือกเติมเครดิต — PARTIAL.** โหลดแพ็กเกจได้: 1,000 เครดิต/฿1,000, 5,000/฿4,500, 10,000/฿8,000 แต่แสดง MISSING_CUSTOMER และข้อความ Stripe ไม่พร้อมทั้งที่เปิด Checkout ได้ ควรแยกสถานะ subscription ออกจากการเติมเครดิต ดู [Billing](07-billing-desktop.png)
9. **Stripe PromptPay — PARTIAL.** ทดลองแพ็กเกจ 1,000 เปิด Stripe Sandbox ยอด THB 1,000 ถูกต้อง และกด Continue ถึง QR ได้ กด Simulate scan แล้วไม่พบการเปลี่ยนสถานะในรอบนี้ จึงไม่ถือว่าจ่ายสำเร็จและไม่ยืนยัน webhook/ยอดเพิ่ม ดู [QR Sandbox](08-stripe-qr.png)
10. **กลับหลังยกเลิก — BLOCKED.** ลิงก์ Back จาก Stripe กลับ /usage?checkout=cancelled จริง แต่พบ Next.js Build Error: Expected '</', got 'ident' ที่ src/features/history/history-page.tsx:194:689 จึงไม่สามารถสรุปพฤติกรรม cancellation, ทดสอบ mobile/tablet หลัง login หรือ keyboard regression ต่อได้ ดู [Build error](09-build-error.png)

## ลำดับแก้ไข

| ระดับ | ปัญหา | เกณฑ์ผ่าน |
| --- | --- | --- |
| P1 | ยอด/รายการตัวอย่างปะปนข้อมูลจริง | ทุกแท็บใช้ API เดียวกัน; error/loading ไม่แสดง mock balance |
| P1 | Build error ขัดขวาง regression | กลับจาก Stripe แล้ว render ได้ ไม่มี compilation overlay |
| P1 | ยังไม่ยืนยัน payment-to-credit | Sandbox payment สำเร็จ → webhook verified → wallet เพิ่มครั้งเดียว; replay ไม่เพิ่มซ้ำ |
| P2 | Search/Filter/Export/View all ไม่ทำงาน | ทำงานกับข้อมูลจริงหรือไม่แสดง control จนรองรับ |
| P2 | 0% used / reset / billing status ชวนเข้าใจผิด | ไม่มีเปอร์เซ็นต์ไร้ฐาน; แยกรอบรายงานกับอายุเครดิต; ข้อความภาษาผู้ใช้ |
| P2 | แปลไทยปนอังกฤษและแตะ identifier | ใช้ข้อความแปลแบบ explicit; ไม่แปล transaction ID |
| P2 | ตัวอักษรเล็กและข้อมูลซ้ำ | Body 14–16px, ยอดหลักจุดเดียว, ตรวจ desktop/mobile และ keyboard จริง |

## แนวทางออกแบบ

คงแบรนด์ EOS สีส้ม/ชมพูและ sidebar เดิม ซ่อน Team Usage ต่อไป ยอดเครดิตพร้อมใช้เป็นข้อมูลหลัก แยกยอดใช้ตามช่วงเวลาออกจาก wallet ปัจจุบัน ใช้รายการจริงพร้อม empty/error/loading ที่ซื่อสัตย์ และ flow เติมเครดิตแบบเลือกแพ็กเกจ → สรุปยอด → Stripe QR → รอยืนยัน → เครดิตเข้า

สร้างภาพแนวทางใหม่ 3 ภาพสำหรับเลือกก่อนลงโค้ด: ภาพรวมเน้นยอดเครดิต, ประวัติแบบ ledger, และเติมเครดิตแบบมีสรุปคำสั่งซื้อ ภาพเป็นข้อเสนอ UX/UI ไม่ใช่ screenshot ของเว็บที่ implement แล้ว

## ขอบเขตที่ยังไม่ยืนยัน

- ไม่ได้ชำระเงินจริงหรือยืนยัน end-to-end webhook ในรอบนี้
- ยังไม่ผ่าน mobile/tablet หลัง login, keyboard navigation, screen reader หรือ WCAG audit เต็มรูปแบบ
- การกลับจาก checkout success/cancel และการ refresh balance ต้องทดสอบซ้ำหลัง build ได้
- Source review พบความเสี่ยง aggregation หลาย feature ต่อ tool ใน usage.service.ts (Map เขียนทับ key เดียวกัน) ยังไม่พิสูจน์ด้วย fixture หลาย feature
- ภาพหลักฐานอาจมีข้อมูลบัญชีและธุรกรรมของผู้ทดสอบ เก็บในเครื่องเท่านั้น ไม่ได้เผยแพร่
