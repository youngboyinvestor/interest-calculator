# เว็บสเปคตามที่ขอ

_Started 2026-08-26 11:00 UTC_

---

## User

สร้างเว็บให้หน่อย ตามที่ผม copy ให้

## Assistant



## User

Answered — design_system: Picked a design system (now attached); calculators: สินเชื่อบ้าน, สินเชื่อรถ (Flat Rate), ดอกเบี้ยทบต้น / เงินฝาก, Refinance, กู้ได้เท่าไร (Affordability); structure: หน้าเดียว สลับแท็บ; depth: สรุป + กราฟ + ตาราง + What-If; lang: ไทย + อังกฤษ สลับได้; audience: คนทั่วไปที่กำลังจะกู้บ้าน/รถ, คนที่มีหนี้อยู่แล้ว อยากวางแผนโปะ, ผู้ติดตามช่อง YoungBoyInvestor, นายหน้า/เซลล์สินเชื่อ; extras: Dark Mode, Print / PDF, แชร์ผลผ่าน URL, FAQ + คำอธิบายศัพท์; notes: ทำแยกกับเว็บ YBInvestor เน้นเว็บเป็นสไตล์มินิมอล

## Assistant

_[tool: ask_user]_

_[tool: run_script]_

_[tool: dc_write]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

Design system (Nocturne — dark, mono blurple) is attached. Rebuilding with your narrowed scope: 5 calculators, TH/EN, share-by-URL, print.

_[tool: dc_write]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: dc_html_str_replace]_

_[tool: multi_screenshot]_

_[tool: ready_for_verification]_

เว็บพร้อมดูแล้ว — 5 เครื่องคำนวณ (บ้าน · รถ Flat Rate · ทบต้น · Refinance · กู้ได้เท่าไร) ในหน้าเดียว บนดีไซน์ Nocturne ที่คุณเลือก

สิ่งที่ทำตามสเปคที่สำคัญ:
- **Engine แยกจาก UI** — สูตรทั้งหมดอยู่ใน object `ENGINE` ที่ไม่พึ่ง React เลย ยกไปใช้กับ mobile/API ได้ตรงๆ
- **Flat Rate แยกสูตรจากลดต้นลดดอก** ไม่ปนกัน และมีตารางเทียบ + อัตราเทียบเท่า (Flat 3% ≈ 5.64% ลดต้นลดดอก) คำนวณด้วย bisection จริง
- **Self-test 15 เคส** รันสดในเบราว์เซอร์ทุกครั้งที่เปิดหน้า กดดูรายการได้ท้ายหน้า — รวมเคส 0%, เงินต้นก้อนใหญ่, ขั้นบันได, ตรวจว่าเงินต้น+ดอกเบี้ย = ยอดจ่ายทั้งหมด และงวดสุดท้ายเหลือ 0 พอดี
- ดอกเบี้ยขั้นบันได (ปี 1/2/3/4+) คำนวณแยกช่วงจริงและคิดค่างวดใหม่ทุกครั้งที่ดอกเบี้ยเปลี่ยน
- โปะ 4 แบบ, What-If เงินดาวน์, ตารางผ่อนรายปี/ทุกงวด, CSV, พิมพ์, แชร์ผ่าน URL, TH/EN

สิ่งที่ยังไม่ได้ทำ: บัตรเครดิต, สินเชื่อส่วนบุคคล, เปรียบเทียบ A/B/C — ตัดออกตามที่คุณเลือก บอกได้ถ้าจะเพิ่มทีหลัง เพิ่มเป็นแท็บใหม่ได้เลยเพราะ engine รองรับอยู่แล้ว

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: grep]_

Both wrappers clamped. Now the contrast fix — the 12px muted labels move from `#75798c` to `#9397ab`:

_[tool: run_script]_

_[tool: grep]_

_[tool: run_script]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

แก้แล้วสองจุด:

- **Overflow แนวนอน** — ใส่ `grid-template-columns:minmax(0,1fr)` ให้ wrapper คอลัมน์ผลลัพธ์ทั้งสองชั้น ตารางผ่อนเลยเลื่อนอยู่ในกล่องตัวเองตามที่ควร วัดแล้วหน้าเว็บ overflow = 0
- **Contrast** — ตัวอักษรเล็ก 12px ทั้งหมดย้ายจาก `#75798c` (3.52:1) ไป `#9397ab` (5.25:1) ซึ่งยังเป็น neutral step ของ Nocturne เหมือนกัน ไม่หลุดระบบ

