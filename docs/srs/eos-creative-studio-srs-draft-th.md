# Software Requirements Specification (SRS)

## EOS Creative Studio

**สถานะเอกสาร:** Draft สำหรับ QA Freelance  
**ภาษา:** ไทย  
**วันที่จัดทำ:** 25 สิงหาคม 2026  
**ผู้ใช้งานเอกสาร:** ทีม QA, Product Owner, Frontend, Backend, DevOps  
**หมายเหตุ:** เอกสารฉบับนี้สรุปจากโค้ดและ API ที่มีอยู่ใน repository ณ วันที่จัดทำ ต้องทดสอบยืนยันกับ environment ที่จะส่งให้ QA ก่อนเริ่มทดสอบจริง

---

## 1. วัตถุประสงค์ของระบบ

EOS Creative Studio เป็นเว็บแอปพลิเคชันสำหรับสร้างและปรับแต่งสื่อด้วย AI โดยรวมการทำงานของผู้ให้บริการ AI หลายรายไว้ใน workspace เดียว ผู้ใช้งานสามารถสร้างรูปภาพ วิดีโอ และงานสื่อรูปแบบอื่นผ่านฟอร์มที่ปรับตาม model ที่เลือก ระบบจะคำนวณเครดิต ส่งงานเข้า queue ติดตามสถานะ และแสดงผลลัพธ์ใน preview, history และ library

เป้าหมายหลักของระบบคือ:

- ให้ผู้ใช้สร้างสื่อ AI ได้จากหน้าเว็บโดยไม่ต้องเรียก provider โดยตรง
- ให้ผู้ดูแลระบบกำหนด model, schema, route, prompt, pricing และเครดิตเริ่มต้นได้จากหลังบ้าน
- รองรับงานแบบ asynchronous ที่ใช้เวลานาน โดยผู้ใช้ยังสามารถไปหน้าอื่นและกลับมาติดตามงานได้
- แยกข้อมูลผู้ใช้และ workspace ไม่ให้เห็น generation ของผู้ใช้อื่น
- คิดค่าใช้บริการจากราคา provider และกติกา pricing ที่ตั้งไว้ในระบบ

## 2. ขอบเขตระบบ

### 2.1 อยู่ในขอบเขต

1. Landing page และการเข้าสู่ระบบ
2. Home / workspace shell / navigation
3. การสร้างรูปภาพ
4. การสร้างวิดีโอ
5. การอัปโหลด media ไปยัง provider เพื่อใช้เป็น input
6. การเลือก model จาก model catalog และ schema ของ model
7. การคำนวณราคาและเครดิตก่อนสร้างงาน
8. การจอง หัก คืน และแสดงประวัติเครดิต
9. Queue และ worker สำหรับประมวลผลงานแบบ asynchronous
10. Preview, recent generations, history และผลลัพธ์ที่สร้างเสร็จ
11. การยกเลิก generation ในกรณีที่สถานะและ provider รองรับ
12. หน้าผู้ดูแลระบบสำหรับ model routes, prompt templates, style presets, pricing และ signup credit

### 2.2 นอกขอบเขตของ SRS ฉบับนี้

- การกำหนดราคาเชิงธุรกิจขั้นสุดท้ายหรือแพ็กเกจการขาย
- SLA ของ provider AI ภายนอก
- การรับประกันคุณภาพภาพหรือวิดีโอของ provider ทุก model
- ระบบชำระเงินจริงและใบกำกับภาษี
- การสร้างหรือฝึก model AI ของ EOS เอง
- การตัดต่อวิดีโอระดับ timeline แบบเต็มรูปแบบ

## 3. คำศัพท์สำคัญ

| คำศัพท์ | ความหมาย |
|---|---|
| User | ผู้ใช้งานที่ผ่านการยืนยันตัวตน |
| Workspace | พื้นที่ทำงานที่ใช้แยกข้อมูล generation, project และเครดิต |
| Generation | งานสร้างสื่อหนึ่งคำสั่ง |
| Scene | ฉากย่อยของงานวิดีโอแบบ storyboard |
| Model | AI model ที่ provider เปิดให้ใช้งาน |
| Route | การผูก feature กับ model/provider ที่เปิดใช้งาน |
| Provider | ผู้ให้บริการ AI ภายนอก เช่น WaveSpeed |
| Credit | หน่วยที่ระบบใช้เรียกเก็บค่าการสร้างงาน |
| Quote | ราคาประมาณการก่อนสร้างงาน โดยยังไม่สร้าง generation |
| Worker | process ที่หยิบงานจาก queue ไปเรียก provider และอัปเดตผลลัพธ์ |
| Prompt template | prompt กลางที่ผู้ดูแลกำหนดตาม feature หรือ mode |

## 4. บทบาทผู้ใช้งาน

### 4.1 ผู้ใช้ทั่วไป

- สมัครหรือเข้าสู่ระบบ
- ดูเครดิตของตนเอง
- สร้างรูปและวิดีโอที่ route อนุญาต
- อัปโหลด input media
- ดูราคาโดยประมาณก่อนกดสร้าง
- ติดตาม ยกเลิก และดูผลลัพธ์ของงานของตนเอง
- ดู history, recent generations และ credit transactions ของตนเอง

### 4.2 ผู้ดูแลระบบ (Admin/Owner)

- จัดการ model routes และ model default
- sync model catalog จาก provider
- กำหนด model แยกตาม feature และ AI Background mode
- ตั้ง input upload limits ของแต่ละ model
- จัดการ prompt templates และ style presets
- ตั้งกติกา pricing, add-on และค่าเริ่มต้น
- ตั้งเครดิตที่แจกให้ผู้ใช้ใหม่
- ตรวจสอบสถานะระบบและแก้ configuration ที่เกี่ยวข้อง

## 5. ภาพรวมสถาปัตยกรรมและการไหลของงาน

```text
Browser
  -> Frontend (Next.js)
  -> Backend API (NestJS)
  -> ตรวจ auth / workspace / model / schema / pricing
  -> จองเครดิตและสร้าง generation
  -> Redis/BullMQ queue
  -> Worker
  -> Provider AI
  -> บันทึกสถานะและ provider output URL
  -> Frontend poll/refresh history และแสดงผล
```

หลักการสำคัญ:

- Browser ห้ามส่ง request ไป provider โดยตรง และห้ามเห็น provider API key
- Backend เป็นผู้ตรวจ model, parameter, route และเครดิตจริง
- งาน generation ต้องเป็น asynchronous และสามารถอยู่ในสถานะ `queued`, `processing`, `completed`, `failed` หรือ `cancelled`
- การส่งงานซ้ำจากคำสั่งเดิมต้องป้องกันด้วย idempotency key
- Output ต้องเก็บ metadata และ URL ตาม storage policy ของระบบ/provider
- QA ต้องทดสอบทั้งกรณี provider สำเร็จ, timeout, error, response ผิดรูปแบบ และ queue ค้าง

## 6. Functional Requirements

### FR-01 การเข้าสู่ระบบและ session

1. ผู้ใช้ที่ยังไม่ login สามารถเข้าหน้า landing page ได้
2. ผู้ใช้สามารถเข้าสู่ระบบผ่านวิธีที่เปิดใช้งาน เช่น Google หรือ email ตาม environment
3. เมื่อ login สำเร็จ ระบบต้องสร้างหรือโหลด profile, workspace และ credit wallet ของผู้ใช้
4. เมื่อ session หมดอายุหรือ token ไม่ถูกต้อง ระบบต้องไม่แสดงข้อมูล generation เดิมของผู้ใช้ต่อ
5. ผู้ใช้ที่ไม่มีสิทธิ์เข้าหน้า admin ต้องได้รับการปฏิเสธอย่างเหมาะสม
6. Local development อาจมี bypass token ตามที่ระบุใน backend README แต่ต้องไม่เปิดใช้ใน production

### FR-02 Workspace และหน้าหลัก

ระบบต้องมีหน้าหลักสำหรับเข้าถึงงานสำคัญ ได้แก่:

- Home
- Create Image
- Create Video
- Projects
- Assets
- Templates
- History
- Usage / Credit history
- Settings
- Team (ถ้าเปิดใช้งานใน environment)

หน้า shell ต้องแสดง user display name, role และ credit balance ที่เป็นข้อมูลจาก API ไม่ใช่ค่าคงที่ใน frontend

### FR-03 การเลือก model และ schema

1. Frontend ต้องโหลด model ที่เปิดใช้งานจาก `GET /api/v1/generation-models?feature=...`
2. Model selector ต้องแสดงชื่อที่เป็นมิตรต่อผู้ใช้ (`displayName` หากมี) และ provider
3. เมื่อเปลี่ยน model ฟิลด์ต้องเปลี่ยนตาม `capabilities.apiSchema` หรือข้อมูล capability ที่ backend ส่งมา
4. ฟิลด์ที่ model ไม่รองรับต้องไม่ถูกส่งไป provider
5. ฟิลด์ที่ model รองรับต้องตรวจ required, type, enum, min, max และ default ให้ตรง schema
6. หาก model ไม่มี parameter ของ product เช่น quality หรือ output format ระบบต้องใช้ prompt/add-on ตามกติกาที่ตั้งไว้ หรือซ่อนฟิลด์ที่ใช้ไม่ได้
7. Backend ต้องตรวจซ้ำทุก parameter และห้ามเชื่อค่าราคา/เครดิตจาก client

### FR-04 การอัปโหลด media

1. รองรับ input ประเภทที่ feature/model อนุญาต เช่น PNG, JPG/JPEG, WebP, video และ audio
2. Frontend ต้องตรวจชนิดไฟล์ ขนาดไฟล์ ความกว้าง ความสูง และจำนวน input ตามข้อจำกัดของ model
3. ข้อจำกัด upload ต้องโหลดจาก model capability หรือค่าที่ admin ตั้งไว้
4. เมื่ออัปโหลดสำเร็จ ระบบต้องส่งไฟล์ไป provider และรับ provider-hosted URL กลับมา
5. Frontend ต้องแสดง loading, success และ error ที่อ่านเข้าใจง่าย
6. เมื่อเกินข้อจำกัด ต้องแสดง alert/popup ที่บอกสาเหตุและค่าที่รองรับ ไม่แสดง error ดิบจาก server เพียงอย่างเดียว
7. ถ้า provider URL หมดอายุ ระบบต้องไม่แสดง broken image ใน recent generations; ให้ซ่อนรายการหรือแสดงสถานะ expired ตาม UX ที่กำหนด
8. QA ต้องตรวจว่าผู้ใช้คนหนึ่งไม่สามารถนำ URL หรือ generation ของอีก user มาใช้ได้โดยไม่มีสิทธิ์

### FR-05 Image Generation

หน้า Create Image ต้องมี feature อย่างน้อยดังนี้:

| Feature | หน้าที่ | Input สำคัญ |
|---|---|---|
| Text to Image | สร้างภาพจากข้อความ | prompt, aspect ratio, resolution, quality, output format, count |
| Image to Image | ปรับภาพอ้างอิงตาม prompt | source image, source images ตาม model, strength, prompt, style, negative prompt |
| AI Style Transfer | คง subject/composition แล้วเปลี่ยนสไตล์ | content image, style preset หรือ style reference, style strength, prompt |
| AI Background | ลบ/เปลี่ยน/สร้าง/เติมสีพื้นหลัง | source image, mode, prompt/reference/color, transparent, output format |
| Upscale | เพิ่มความละเอียดภาพ | source image, target resolution, quality, output format |
| Extend Image | ขยาย canvas และเติมพื้นที่โดยรอบ | source image, direction, amount, prompt, ratio/resolution |

ข้อกำหนดร่วม:

- ต้องมี source image ใน feature ที่กำหนดให้ required
- ต้องแสดง preview และ recent generations แยกตาม feature/context ที่ถูกต้อง
- ต้องคำนวณ estimated credits ก่อนกดสร้าง และคำนวณใหม่เมื่อ model, size, quality, count, output format หรือ input ที่มีผลต่อราคาเปลี่ยน
- จำนวนภาพรองรับตาม model เช่น 1, 2, 4 หรือ 8 หาก model ไม่รองรับค่าดังกล่าวต้องไม่แสดงให้เลือก
- Output format ต้องมาจาก capability/provider schema; PNG และ WebP สามารถรองรับ transparency ได้ถ้า provider/model รองรับ

#### FR-05.1 AI Background modes

AI Background ต้องรองรับ mode ที่ backend เปิด route ไว้:

- **Remove:** ตัดพื้นหลังออกและเก็บ subject
- **Replace:** เปลี่ยนพื้นหลังเป็นฉากใหม่ โดยรักษา subject
- **Generate:** สร้างพื้นหลังใหม่จาก prompt
- **Solid:** เติมพื้นหลังสีที่เลือก หรือทำ transparent ตาม model ที่รองรับ

แต่ละ mode สามารถกำหนด model, default model, pricing และ prompt template แยกกันได้จาก Admin Model Routes/Prompt Templates ระบบต้องไม่ใช้ model ของ Remove กับ Solid โดยอัตโนมัติถ้า model นั้นไม่รองรับ mode ดังกล่าว

### FR-06 Video Generation

หน้า Create Video ต้องมี feature อย่างน้อยดังนี้:

| Feature | หน้าที่ | Input สำคัญ |
|---|---|---|
| Image to Video | สร้างวิดีโอจากภาพหรือ storyboard | scenes, image, prompt, duration, resolution, model params |
| Text to Video | สร้างวิดีโอจาก prompt | prompt, duration, resolution, aspect ratio, model params |
| People Video | สร้างวิดีโอคนพูด/แสดงจาก image/video พร้อม script/audio | source image/video, script หรือ audio, acting direction, model params |
| Motion Transfer | นำ motion จากวิดีโอหนึ่งไปใช้กับภาพ/ตัวละคร | character image, motion video, model params |
| Lipsync | ทำปากให้ตรงกับ audio/script | source image/video, audio หรือ script, duration, model params |
| Extend Video | ต่อวิดีโอเดิมให้ยาวขึ้น | source video, prompt, duration, resolution, model params |

#### FR-06.1 Storyboard และหลาย scene

1. Image to Video ต้องรองรับ 1-8 scenes ต่อคำสั่ง
2. รองรับ mode `storyboard`, `continuous` และ `hybrid`
3. แต่ละ scene อาจมี start image, end image, prompt, negative prompt, duration และ model params ของตนเอง
4. ระบบต้องแสดงความคืบหน้าเป็นจำนวน scene/video ที่เสร็จ เช่น `3/6 videos ready`
5. เมื่อทุก scene สำเร็จ ระบบต้องรวมผลตาม workflow ของ storyboard และแสดง final video/library output
6. หาก scene ใดล้มเหลว ต้องแสดงสถานะที่ตรวจสอบได้ และไม่แสดงงานรวมว่า completed อย่างไม่ถูกต้อง
7. การ generate หลายงานพร้อมกันต้องแสดง progress แบบรวมตาม feature เดียวกัน ไม่สร้าง floating card ซ้ำจนรกหน้าจอ

#### FR-06.2 Audio และ duration

- หาก model คิดราคาตามความยาว audio ระบบต้องอัปโหลด/อ่าน duration ก่อนคำนวณราคา
- ถ้า duration ยังไม่ทราบ ต้องแสดงสถานะกำลังคำนวณและห้ามแสดงราคาสุดท้ายเป็นค่าที่ทำให้เข้าใจผิด
- หาก user ใส่ทั้ง audio และ script ต้องใช้กติกาตาม model schema และแจ้งว่าค่าหนึ่งจะถูกใช้เป็นหลักหรือไม่รองรับร่วมกัน

### FR-07 ราคาและเครดิต

1. ก่อนสร้างงาน ระบบต้องเรียก quote endpoint หรือคำนวณจาก pricing rule ที่ backend เป็นเจ้าของ
2. แสดงจำนวนเครดิตโดยประมาณก่อนกด Generate
3. เปลี่ยน model, resolution, quality, count, duration, audio duration, output format หรือ addon แล้วต้อง quote ใหม่
4. ขณะ quote ใหม่ควรแสดง loading state ที่ชัดเจน เช่น spinner/ข้อความกำลังคำนวณราคา
5. Backend ต้อง reserve เครดิตก่อนส่งงานเข้า queue
6. งานที่ provider ล้มเหลวหรือยกเลิกต้อง release/refund ตาม policy และไม่หักซ้ำ
7. การสร้างงานซ้ำจาก idempotency key เดิมต้องไม่หักเครดิตซ้ำ
8. เครดิตที่แสดงบน top bar และหน้า usage ต้องสอดคล้องกับ API ล่าสุด
9. ผู้ใช้ใหม่ต้องได้รับ signup credit ตามค่าที่ admin ตั้งไว้ ถ้าเปิดใช้งาน

### FR-08 Queue, worker และสถานะ generation

สถานะหลักของ generation:

```text
queued -> submitting -> submitted -> processing -> completed
   \          \             \             \
    -> failed  -> failed      -> failed      -> cancelled
```

ข้อกำหนด:

- Worker ต้องเริ่มทำงานแยกจาก API process และเชื่อมต่อ Redis/queue ได้
- Worker ต้อง recover งานที่ค้างหลัง restart ตาม policy
- งานต้องไม่หายเมื่อ frontend refresh หรือผู้ใช้ออกจากหน้า
- Frontend ต้องติดตามงานจาก polling/status/history และแสดง progress card ได้ทุกหน้าใน studio shell
- งาน feature เดียวกันหลาย job/scene ควรรวมเป็น progress card เดียว โดยรวม `completedCount/totalCount`
- ปุ่ม Cancel ต้องเรียก API cancel และเปลี่ยน UI ตามผลตอบกลับจริง
- Error message ที่ผู้ใช้เห็นต้องเป็นข้อความที่เข้าใจได้ และไม่เปิดเผย secret/stack trace

### FR-09 Preview, recent generations และ history

1. Preview ต้องแสดง output ล่าสุดของงานที่กำลังดู
2. Variations ต้องแสดงผลลัพธ์ของ generation ปัจจุบัน ไม่ปนกับ history ของ feature อื่น
3. Recent Generations ต้องแสดงเฉพาะข้อมูลของ user/workspace และ feature/context ที่ถูกต้อง
4. เมื่อ refresh หน้า รายการ recent/history ต้องโหลดจาก backend หรือข้อมูลที่ persist อย่างถูกต้อง
5. ถ้า provider URL หมดอายุหรือโหลดไม่ได้ ต้องไม่แสดง broken image icon ค้างใน UI
6. ผู้ใช้สามารถเปิด history เพื่อดูสถานะและ output ที่เคยสร้าง
7. ต้องแยกสถานะ `completed`, `failed`, `cancelled` และ `expired` ให้ตรวจสอบได้

### FR-10 Admin และ configuration

หลังบ้านต้องรองรับ:

| ส่วน | ความสามารถ |
|---|---|
| Model catalog | ดู model/provider/schema และ sync จาก provider |
| Model routes | เปิด/ปิด model, ตั้ง default, priority และ feature route |
| AI Background routes | ตั้ง model แยกตาม Remove, Replace, Generate, Solid |
| Input limits | ตั้ง max file size, width, height และ max input images |
| Prompt templates | ตั้ง prompt กลางแยกตาม feature/mode |
| Style presets | เพิ่ม แก้ไข ปิดใช้งาน และผูกกับ feature |
| Credit pricing | ตั้ง defaults, rules, add-ons และดู pricing preview |
| Signup credits | ตั้งจำนวนเครดิตที่แจก user ใหม่และสถานะเปิด/ปิด |

ทุก mutation ของ admin ต้องตรวจสิทธิ์และต้องมีผลสะท้อนใน frontend ตาม API ใหม่หลัง refresh/cache invalidation

## 7. API Contract สำหรับ QA

Base path ของ backend คือ `/api/v1` และ endpoint ส่วนใหญ่ต้องมี Bearer token

### 7.1 Auth / account / credits

| Method | Endpoint | จุดประสงค์ |
|---|---|---|
| GET | `/auth/session` | ตรวจ session และ profile auth |
| GET | `/users/me` | โหลด profile |
| PATCH | `/users/me` | แก้ profile ที่อนุญาต |
| GET | `/users/me/credits` | โหลด balance |
| GET | `/users/me/credits/transactions` | โหลดรายการเครดิต |

### 7.2 Model / preset / pricing

| Method | Endpoint | จุดประสงค์ |
|---|---|---|
| GET | `/generation-models?feature=...` | model สำหรับ frontend |
| GET | `/generation-style-presets?feature=...` | style preset สำหรับ user |
| GET | `/admin/model-routes` | route สำหรับ admin |
| POST | `/admin/model-routes/sync` | sync model catalog |
| PATCH | `/admin/model-routes/:feature` | ตั้ง route/default/priority |
| PATCH | `/admin/model-routes/model` | ตั้ง input limits |
| GET/PATCH | `/admin/prompt-templates` | จัดการ prompt กลาง |
| GET/POST/PATCH/DELETE | `/admin/style-presets` | จัดการ style preset |
| GET/PATCH/POST | `/admin/credit-pricing-rules` | จัดการ pricing และ preview |
| GET/PATCH | `/admin/signup-credit-grant` | ตั้ง signup credit |

### 7.3 Media และ generation

| Method | Endpoint | จุดประสงค์ |
|---|---|---|
| POST | `/media/upload` | ส่ง input media ไป provider และรับ URL |
| POST | `/generations/image/quote` | quote งาน image |
| POST | `/generations/video/quote` | quote งาน video |
| POST | `/generations/preview` | สร้าง text-to-image |
| POST | `/generations/image-to-image` | สร้าง image-to-image |
| POST | `/generations/style-transfer` | สร้าง style transfer |
| POST | `/generations/background-removal` | AI Background ทุก mode |
| POST | `/generations/upscale` | upscale image |
| POST | `/generations/extend-image` | extend image |
| POST | `/generations/video/image-to-video` | storyboard image-to-video |
| POST | `/generations/text-to-video` | text-to-video |
| POST | `/generations/people-video` | people video |
| POST | `/generations/lipsync` | lip sync |
| POST | `/generations/motion-transfer` | motion transfer |
| POST | `/generations/extend-video` | extend video |
| GET | `/generations` | list generation history |
| GET | `/generations/:id/status` | poll สถานะ generation |
| POST | `/generations/:id/cancel` | ยกเลิกงาน |

## 8. Non-functional Requirements

### NFR-01 Security

- ทุก API mutation ต้องตรวจ authentication และ authorization
- ข้อมูล generation ต้อง filter ตาม user/workspace
- API key ของ provider, database URL, Redis URL และ service role key ต้องอยู่ server-side เท่านั้น
- Error response production ห้ามส่ง stack trace, SQL, token หรือ secret
- Admin endpoint ต้องใช้ AdminGuard และทดสอบ privilege escalation
- Upload URL และ output URL ต้องไม่เปิดให้ user อื่นเข้าถึงข้อมูลโดยไม่มีสิทธิ์

### NFR-02 Reliability

- Worker restart แล้ว recover งาน queued ที่ยังไม่จบได้ตาม policy
- Provider webhook/event ซ้ำต้องไม่ทำให้เครดิตหรือ output ถูกบันทึกซ้ำ
- API timeout ต้องไม่สร้าง generation ซ้ำเมื่อ retry ด้วย idempotency key เดิม
- งานที่ค้างใน queue ต้องมีวิธีตรวจสอบและแจ้งเตือน

### NFR-03 Performance

- หน้า create ต้องโหลด shell ได้แม้ model catalog หรือ history ยังโหลดไม่เสร็จ
- การเปลี่ยน model ต้องไม่ทำให้ฟอร์มค้างหรือ field เดิมส่งต่อไปผิด model
- Quote ใหม่ควรแสดง feedback ทันทีและไม่สร้าง request ซ้ำเกินจำเป็น
- Preview/gallery ไม่ควรโหลดภาพเสียหรือ URL หมดอายุซ้ำทุกครั้ง

### NFR-04 Usability / Accessibility

- ปุ่ม Generate ต้อง disabled เมื่อ input required ยังไม่ครบหรือกำลัง submit
- Loading, queued, processing, failed และ completed ต้องมีข้อความ ไม่ใช้สีอย่างเดียว
- ปุ่มและ input ต้องมี accessible label
- Alert ต้องบอกสาเหตุและวิธีแก้ที่ทำได้
- Layout ต้องใช้งานได้ทั้ง desktop และ mobile โดยเฉพาะ progress card, upload และ preview

### NFR-05 Data retention

- ระบบต้องระบุ retention ของ provider-hosted input/output URL ให้ชัดเจน
- ถ้า URL provider มีอายุประมาณ 7 วัน ต้องมี behavior เมื่อหมดอายุ
- Metadata, status, price snapshot และ output URL ต้องสัมพันธ์กับ generation เดิม
- ห้ามเก็บไฟล์ลง EOS storage โดยไม่อยู่ใน storage policy ที่อนุมัติ

## 9. QA Test Scope และ Test Matrix

### 9.1 Smoke test ก่อนเริ่ม regression

| ID | กรณีทดสอบ | Expected result |
|---|---|---|
| SM-01 | เปิด landing page โดยไม่ login | หน้าโหลดได้และมีปุ่ม login |
| SM-02 | login สำเร็จ | เข้า home/studio และเห็นชื่อกับเครดิต |
| SM-03 | เปิด create image | model และ field โหลดจาก API |
| SM-04 | สร้าง Text to Image 1 รูป | ได้ queued -> processing -> completed และ preview แสดงผล |
| SM-05 | เปิด create video | tab video และ model โหลดได้ |
| SM-06 | เปิด history | เห็นเฉพาะ generation ของ user ปัจจุบัน |
| SM-07 | เปิด admin ด้วย admin | เข้าได้และโหลด model/pricing settings |
| SM-08 | เปิด admin ด้วย user ปกติ | ถูกปฏิเสธ |

### 9.2 Image test cases

| ID | กรณีทดสอบ | Expected result |
|---|---|---|
| IMG-01 | Text to Image prompt ปกติ | สร้างภาพได้ ราคาตรงกับ quote |
| IMG-02 | เปลี่ยน model | field เปลี่ยนตาม schema และค่าเก่าที่ไม่รองรับไม่ถูกส่ง |
| IMG-03 | เปลี่ยน ratio/resolution/quality/count | quote ใหม่และ UI แสดง loading คำนวณราคา |
| IMG-04 | Image to Image upload รูปเดียว | ใช้ source image และรักษาโครงสร้างตาม strength |
| IMG-05 | Image to Image model รองรับหลายรูป | เพิ่ม input ได้ตาม max input images |
| IMG-06 | อัปโหลดไฟล์เกินขนาด/ขนาดภาพเกิน | popup บอกข้อจำกัดและไม่ส่ง generation |
| IMG-07 | Style Transfer ใช้ preset | ส่ง style preset และ content image ถูกต้อง |
| IMG-08 | Style Transfer ใช้ style reference | ส่ง content + reference ตาม schema model |
| IMG-09 | AI Background Remove | ตัดพื้นหลังและ output transparency ตามที่ model รองรับ |
| IMG-10 | AI Background Replace/Generate | ใช้ prompt/reference ตาม mode และไม่ใช้ route ของ Remove ผิดตัว |
| IMG-11 | AI Background Solid | เลือกสี/transparent และ output format ตรง capability |
| IMG-12 | Upscale 2K/4K | target resolution ถูกส่งและราคาเปลี่ยนตามกติกา |
| IMG-13 | Extend Image 25/50/100% ทุกทิศทาง | canvas/output มีผลตาม amount และ direction |
| IMG-14 | refresh หลังงานเสร็จ | recent generations ไม่หายและไม่ปน tab อื่น |
| IMG-15 | provider URL หมดอายุ | ไม่แสดง broken image; แสดง expired/ซ่อนตาม policy |

### 9.3 Video test cases

| ID | กรณีทดสอบ | Expected result |
|---|---|---|
| VID-01 | Image to Video 1 scene | ได้วิดีโอและ progress 0/1 -> 1/1 |
| VID-02 | Storyboard 2-8 scenes | สร้าง scene ครบและรวมผลตาม mode |
| VID-03 | Storyboard storyboard/continuous/hybrid | start frame ถูกใช้ตาม mode |
| VID-04 | หลายงาน video พร้อมกัน | progress card ของ feature เดียวรวมเป็นใบเดียวและรวมจำนวน ready |
| VID-05 | Text to Video | prompt, duration, resolution และ model params ถูกต้อง |
| VID-06 | People Video จากรูป + script | อ่าน model schema และสร้างวิดีโอได้ |
| VID-07 | People Video จาก video + audio | validation และ duration อ้างอิง media ได้ถูกต้อง |
| VID-08 | Lipsync audio duration ต่างกัน | quote ใช้ duration ของ audio ตาม model/rule |
| VID-09 | Motion Transfer image + motion video | source และ motion ถูกส่งถูก field |
| VID-10 | Extend Video | source video และ prompt ถูกส่งไป route ที่ถูกต้อง |
| VID-11 | กด Cancel ระหว่าง queued/processing | สถานะเปลี่ยนตาม provider และไม่หักเครดิตซ้ำ |
| VID-12 | refresh/ย้ายหน้าในระหว่าง generate | progress card ยังอยู่และกลับมาติดตามต่อได้ |
| VID-13 | provider timeout/failed scene | แสดง error ที่เข้าใจได้และเครดิต refund ตาม policy |

### 9.4 Credit / queue / recovery test cases

| ID | กรณีทดสอบ | Expected result |
|---|---|---|
| SYS-01 | quote ก่อน submit | ไม่สร้าง generation และไม่หักเครดิต |
| SYS-02 | เครดิตไม่พอ | ปฏิเสธก่อนส่ง provider พร้อมข้อความชัดเจน |
| SYS-03 | submit สำเร็จ | reserve เครดิตหนึ่งครั้ง |
| SYS-04 | provider fail | release/refund ตาม policy หนึ่งครั้ง |
| SYS-05 | retry idempotency key เดิม | ไม่สร้างงานซ้ำและไม่หักซ้ำ |
| SYS-06 | restart worker ขณะมี queued job | งานกลับมาประมวลผลต่อได้ |
| SYS-07 | Redis unavailable | ระบบแจ้งสถานะ queue ไม่พร้อมและไม่ทำงานค้างเงียบ ๆ |
| SYS-08 | DB unavailable | API/worker แจ้ง error ที่เหมาะสมและไม่สร้างข้อมูลบางส่วนค้างโดยไม่มีสถานะ |
| SYS-09 | webhook/event ซ้ำ | output และ ledger ไม่ถูกบันทึกซ้ำ |
| SYS-10 | user ใหม่สมัคร | ได้ signup credit ตามค่าที่ admin ตั้งไว้เพียงครั้งเดียว |

### 9.5 Admin test cases

| ID | กรณีทดสอบ | Expected result |
|---|---|---|
| ADM-01 | Sync model catalog | model/schema/display name อัปเดตโดยไม่สร้าง route ผิด |
| ADM-02 | ตั้ง default model ของ feature | frontend แสดง default ใหม่หลัง refresh |
| ADM-03 | ปิด model route | model ไม่ปรากฏใน user selector และ backend reject หากยิงตรง |
| ADM-04 | ตั้ง AI Background แยก mode | แต่ละ mode เห็นเฉพาะ model ที่ assign ให้ mode |
| ADM-05 | ตั้ง upload limits | frontend validation และ backend validation สอดคล้องกัน |
| ADM-06 | แก้ prompt template | generation ใช้ prompt กลางใหม่ตาม feature/mode |
| ADM-07 | แก้ pricing/add-on | quote และราคา final เปลี่ยนตาม rule ใหม่ |
| ADM-08 | ตั้ง signup credit | user ใหม่ได้รับจำนวนเครดิตที่กำหนด ไม่แจกซ้ำ |

## 10. ข้อมูลทดสอบที่แนะนำ

- รูป PNG ที่มีพื้นหลังชัดเจนและ subject เดี่ยว
- รูป JPG/WebP ที่มีข้อความและองค์ประกอบหลายชิ้น
- รูป portrait, landscape และภาพความละเอียดสูง
- ไฟล์วิดีโอสั้น 5-6 วินาทีทั้งแนวตั้งและแนวนอน
- ไฟล์ audio ภาษาไทยความยาว 5, 10 และ 30 วินาที
- ไฟล์ที่นามสกุลถูกแต่ MIME type ผิด
- ไฟล์เกินขนาด, ไฟล์เสีย, ไฟล์ว่าง และไฟล์ที่มีชื่อภาษาไทย/อักขระพิเศษ
- บัญชีทดสอบ user ปกติ, user ใหม่, เครดิตไม่พอ และ admin

## 11. Acceptance Criteria ก่อนส่ง QA

ระบบถือว่าพร้อมสำหรับ QA รอบแรกเมื่อ:

1. Frontend และ backend deploy จาก commit ที่ระบุชัดเจน
2. API, worker, Redis และ database ใช้ environment เดียวกันและ health check ผ่าน
3. มี test account สำหรับ user และ admin
4. มีเครดิตเพียงพอสำหรับ smoke test หรือมี mock provider ที่ระบุชัดเจน
5. ทุก model route ที่จะทดสอบมี provider key และ pricing/config ครบ
6. Worker แสดง log ว่าเริ่มทำงานและรับ job ได้
7. Test media ชุดหลักถูกเตรียมไว้แล้ว
8. QA ได้ base URL, Swagger URL, credential/test account และข้อจำกัดของ provider
9. ปัญหาที่ provider URL หมดอายุ, queue timeout และ credit refund มี expected behavior ที่ตกลงกันแล้ว
10. มีช่องทางส่ง defect พร้อมข้อมูลขั้นต่ำ: environment, user, feature, model, request time, generation ID, screenshot และ console/network log

## 12. ข้อมูลที่ต้องยืนยันกับ Product/Dev ก่อนเริ่มทดสอบจริง

รายการต่อไปนี้ควรกรอกให้เสร็จก่อนส่ง SRS ฉบับ final:

- Production/staging URL และ build/commit ที่ QA ต้องใช้
- รายชื่อ provider/model ที่อนุมัติให้ทดสอบและราคาของแต่ละตัว
- อายุของ input/output URL และ behavior เมื่อหมดอายุ
- Policy การคืนเครดิตเมื่อ cancel, provider fail, timeout และบาง scene fail
- จำนวน worker/concurrency และเวลาที่คาดว่าจะรอใน queue
- สิทธิ์ของ user, admin และ owner ที่ใช้ใน environment จริง
- จำนวน signup credit และเงื่อนไขการแจกซ้ำ/ยกเลิก
- ขอบเขตของ feature ที่ยังอยู่ระหว่างทดลอง เช่น model คุณภาพต่ำหรือ provider ที่ยังไม่เสถียร
- ต้องการให้ QA ทดสอบ provider จริงทุก model หรือใช้ model ชุด smoke เท่านั้น

## 13. เอกสาร/ข้อมูลอ้างอิงภายในโครงการ

- Frontend README และเอกสาร architecture ใน `docs/architecture/`
- Backend README และ Swagger ที่ `/docs`
- Model capability/schema จาก `GET /api/v1/generation-models`
- Admin model routes และ pricing settings
- Test suites ใน backend `test/`
- Migration history ใน backend `database/migrations/`

**หมายเหตุสำหรับ QA:** SRS ฉบับนี้เป็น draft เพื่อให้เริ่มวางแผนทดสอบได้เร็ว รายละเอียดที่เป็น dynamic เช่น model, parameter, ราคา, upload limits และ provider retention ต้องยึดค่าที่ API/Admin ส่งใน environment ที่กำลังทดสอบเป็นหลัก
