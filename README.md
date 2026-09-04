# Manual Tracking / Finger Trail Trainer

เวอร์ชันนี้ทำมาให้ตรงกับแนว **manual tracking / finger-line effect** มากกว่าการโชว์โครงมืออย่างเดียว

ฟีเจอร์:
- ใช้กล้องหน้าและติดตามปลายนิ้วชี้
- วาดเส้นตามปลายนิ้วแบบต่อเนื่อง
- Neon / Solid / Dot
- ปรับความลื่นเพื่อบาลานซ์ความไวกับความนิ่ง
- ปรับความยาวเส้น
- เปิด/ปิดโครงมือ
- จำกัดความถี่ AI inference เพื่อช่วยลดอาการกระตุกบนมือถือ

รัน:
- GitHub Pages / HTTPS แนะนำที่สุด
- หรือ `python -m http.server 8000` แล้วเปิด localhost

หมายเหตุ:
MediaPipe inference รันบนเบราว์เซอร์และต้องใช้ไฟล์โมเดลจาก Google-hosted URL.
