/**
 * คัดลอกไฟล์ pdf.worker (จาก pdfjs-dist ที่ react-pdf ใช้ภายใน) มาไว้ที่
 * public/ เพื่อให้ Next.js เสิร์ฟเป็น static asset ตรงๆ ที่ /pdf.worker.min.mjs
 * — รันอัตโนมัติทุกครั้งหลัง npm install (ดู "postinstall" ใน package.json)
 * ไม่ commit ไฟล์ที่คัดลอกนี้เข้า Git (อยู่ใน .gitignore) เพราะเป็นไฟล์ vendor
 * ที่สร้างใหม่ได้เสมอจาก node_modules
 */
const fs = require("fs");
const path = require("path");

const source = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs"
);
const destination = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

if (!fs.existsSync(source)) {
  console.warn(
    "copy-pdf-worker: ไม่พบไฟล์ pdf.worker.min.mjs ใน pdfjs-dist — ข้ามการคัดลอก " +
      "(หน้าอ่านแบบ flipbook จะใช้งานไม่ได้จนกว่าจะรัน npm install ใหม่)"
  );
  process.exit(0);
}

fs.copyFileSync(source, destination);
console.log("copy-pdf-worker: คัดลอก pdf.worker.min.mjs ไปยัง public/ สำเร็จ");
