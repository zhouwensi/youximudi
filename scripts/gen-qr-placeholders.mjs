/**
 * 生成两张纯色占位 PNG（120×120），便于开发预览；上线前请替换为真实太阳码/公众号码。
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "miniprogram", "miniprogram", "images");

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function solidPng(w, h, r, g, b) {
  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0);
    for (let x = 0; x < w; x++) {
      raw.push(r, g, b);
    }
  }
  const zlibbed = zlib.deflateSync(Buffer.from(raw));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibbed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, "qr_mini_program.jpg"), solidPng(120, 120, 139, 90, 43));
fs.writeFileSync(path.join(root, "qr_official_account.jpg"), solidPng(120, 120, 92, 64, 51));
console.log("written:", path.join(root, "qr_mini_program.jpg"), path.join(root, "qr_official_account.jpg"));
