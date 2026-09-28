"use strict";
/**
 * Kopi Batin — Server autentikasi (register, login, lupa password)
 * Tanpa framework: hanya modul bawaan Node.js (butuh Node >= 22.13).
 * Database: SQLite (node:sqlite) -> file data/kopibatin.db
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

/* ---------- Konfigurasi ---------- */
const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === "production";
// Tampilkan kode reset di layar/terminal HANYA saat pengembangan (tanpa SMTP)
const SHOW_CODE = process.env.DEV_SHOW_CODE ? process.env.DEV_SHOW_CODE === "1" : !PROD;
const SESSION_MS = 7 * 24 * 3600 * 1000;
const RESET_MS = 10 * 60 * 1000;
const ROOT = __dirname;

/* ---------- Database ---------- */
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
const db = new DatabaseSync(process.env.DB_FILE || path.join(ROOT, "data", "kopibatin.db"));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT,
  used INTEGER NOT NULL DEFAULT 0
);
`);
const q = {
  userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  insertUser: db.prepare("INSERT INTO users(name,phone,email,password_hash,created_at) VALUES(?,?,?,?,?)"),
  insertSession: db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)"),
  sessionUser: db.prepare(`SELECT u.id,u.name,u.email,u.phone FROM sessions s JOIN users u ON u.id=s.user_id
                           WHERE s.token_hash=? AND s.expires_at>?`),
  delSession: db.prepare("DELETE FROM sessions WHERE token_hash=?"),
  delUserSessions: db.prepare("DELETE FROM sessions WHERE user_id=?"),
  delUserResets: db.prepare("DELETE FROM password_resets WHERE user_id=?"),
  insertReset: db.prepare("INSERT INTO password_resets(user_id,code_hash,expires_at) VALUES(?,?,?)"),
  latestReset: db.prepare("SELECT * FROM password_resets WHERE user_id=? AND used=0 ORDER BY id DESC LIMIT 1"),
  bumpAttempt: db.prepare("UPDATE password_resets SET attempts=attempts+1 WHERE id=?"),
  markVerified: db.prepare("UPDATE password_resets SET verified=1,token_hash=?,expires_at=? WHERE id=?"),
  markUsed: db.prepare("UPDATE password_resets SET used=1 WHERE id=?"),
  setPassword: db.prepare("UPDATE users SET password_hash=? WHERE id=?"),
};
setInterval(() => {
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at<?").run(now);
  db.prepare("DELETE FROM password_resets WHERE expires_at<?").run(now);
}, 3600 * 1000).unref();

/* ---------- Keamanan: hash & token ---------- */
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const safeEq = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
function verifyPassword(pw, stored) {
  const [alg, saltHex, keyHex] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(key, Buffer.from(keyHex, "hex"));
}
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

/* ---------- Rate limit sederhana (in-memory) ---------- */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  let h = hits.get(key);
  if (!h || h.reset < now) h = { count: 0, reset: now + windowMs };
  h.count++; hits.set(key, h);
  return h.count > max;
}
const clearLimit = (key) => hits.delete(key);
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k); }, 600000).unref();

/* ---------- Helper HTTP ---------- */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
function send(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers["content-type"] || "").includes("application/json")) return reject(new HttpError(415, "Content-Type harus application/json"));
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 10_000) { reject(new HttpError(413, "Data terlalu besar")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { reject(new HttpError(400, "Format JSON tidak valid")); } });
    req.on("error", reject);
  });
}
function getCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("="); if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
const cookie = (val, maxAge) => `kb_session=${val}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${PROD ? "; Secure" : ""}`;
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  q.insertSession.run(sha(token), userId, Date.now() + SESSION_MS);
  return { "Set-Cookie": cookie(token, SESSION_MS / 1000) };
}
function authUser(req) {
  const t = getCookie(req, "kb_session");
  return t ? q.sessionUser.get(sha(t), Date.now()) || null : null;
}
const clientIp = (req) => req.socket.remoteAddress || "unknown";

/* ---------- Validasi ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(\+62|62|0)8[0-9]{8,12}$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");
function checkPassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) throw new HttpError(400, "Password minimal 8 karakter");
  if (pw.length > 128) throw new HttpError(400, "Password terlalu panjang");
}

/* ---------- Pengiriman kode reset ---------- */
async function sendResetCode(user, code) {
  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = require("nodemailer");
      const port = Number(process.env.SMTP_PORT) || 587;
      const tx = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port, secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await tx.sendMail({
        from: process.env.MAIL_FROM || "Kopi Batin <no-reply@kopibatin.id>",
        to: user.email,
        subject: "Kode reset password Kopi Batin",
        text: `Halo ${user.name},\n\nKode reset password Anda: ${code}\nBerlaku 10 menit. Abaikan email ini jika Anda tidak memintanya.`,
      });
      return;
    } catch (e) { console.error("[MAIL] Gagal kirim email:", e.message); }
  }
  if (SHOW_CODE) console.log(`[RESET] Kode untuk ${user.email}: ${code} (berlaku 10 menit)`);
}

/* ---------- Route API ---------- */
const routes = {
  "GET /api/me": (req, res) => send(res, 200, { user: authUser(req) }),

  "POST /api/register": async (req, res) => {
    const ip = clientIp(req);
    if (limited("reg:" + ip, 10, 15 * 60_000)) throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi nanti.");
    const b = await readJson(req);
    const name = str(b.name), phone = str(b.phone).replace(/[\s-]/g, ""), email = str(b.email).toLowerCase();
    if (name.length < 2 || name.length > 80) throw new HttpError(400, "Nama harus 2–80 karakter");
    if (!PHONE_RE.test(phone)) throw new HttpError(400, "Nomor WhatsApp tidak valid (contoh: 081234567890)");
    if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, "Format email tidak valid");
    checkPassword(b.password);
    if (b.confirm !== undefined && b.confirm !== b.password) throw new HttpError(400, "Konfirmasi password tidak cocok");
    if (q.userByEmail.get(email)) throw new HttpError(409, "Email sudah terdaftar. Silakan login.");
    const id = Number(q.insertUser.run(name, phone, email, hashPassword(b.password), Date.now()).lastInsertRowid);
    send(res, 201, { user: { id, name, email, phone } }, startSession(res, id));
  },

  "POST /api/login": async (req, res) => {
    const b = await readJson(req);
    const email = str(b.email).toLowerCase(), key = `login:${clientIp(req)}:${email}`;
    if (limited(key, 5, 15 * 60_000)) throw new HttpError(429, "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.");
    const u = q.userByEmail.get(email);
    const ok = verifyPassword(String(b.password || ""), u ? u.password_hash : DUMMY_HASH) && !!u;
    if (!ok) throw new HttpError(401, "Email atau password salah");
    clearLimit(key);
    send(res, 200, { user: { id: u.id, name: u.name, email: u.email, phone: u.phone } }, startSession(res, u.id));
  },

  "POST /api/logout": async (req, res) => {
    const t = getCookie(req, "kb_session");
    if (t) q.delSession.run(sha(t));
    send(res, 200, { ok: true }, { "Set-Cookie": cookie("", 0) });
  },

  // Langkah 1: minta kode. Respons selalu sama agar email tidak bisa ditebak.
  "POST /api/forgot": async (req, res) => {
    const b = await readJson(req);
    const email = str(b.email).toLowerCase();
    if (limited("fg-ip:" + clientIp(req), 8, 15 * 60_000) || limited("fg:" + email, 3, 15 * 60_000))
      throw new HttpError(429, "Terlalu banyak permintaan kode. Coba lagi dalam 15 menit.");
    const u = EMAIL_RE.test(email) ? q.userByEmail.get(email) : null;
    const out = { ok: true, message: "Jika email terdaftar, kode verifikasi telah dikirim." };
    if (u) {
      const code = String(crypto.randomInt(100000, 1000000));
      q.delUserResets.run(u.id);
      q.insertReset.run(u.id, sha(code), Date.now() + RESET_MS);
      await sendResetCode(u, code);
      if (SHOW_CODE) out.devCode = code;
    }
    send(res, 200, out);
  },

  // Langkah 2: verifikasi kode -> dapat resetToken sekali pakai
  "POST /api/verify-reset": async (req, res) => {
    const b = await readJson(req);
    const email = str(b.email).toLowerCase(), code = str(b.code);
    const bad = new HttpError(400, "Kode salah atau sudah kedaluwarsa");
    const u = q.userByEmail.get(email); if (!u) throw bad;
    const r = q.latestReset.get(u.id);
    if (!r || r.verified || r.expires_at < Date.now() || r.attempts >= 5) throw bad;
    q.bumpAttempt.run(r.id);
    if (!/^\d{6}$/.test(code) || !safeEq(sha(code), r.code_hash)) throw bad;
    const token = crypto.randomBytes(32).toString("hex");
    q.markVerified.run(sha(token), Date.now() + RESET_MS, r.id);
    send(res, 200, { ok: true, resetToken: token });
  },

  // Langkah 3: simpan password baru
  "POST /api/reset": async (req, res) => {
    const b = await readJson(req);
    const email = str(b.email).toLowerCase();
    checkPassword(b.password);
    if (b.confirm !== undefined && b.confirm !== b.password) throw new HttpError(400, "Konfirmasi password tidak cocok");
    const bad = new HttpError(400, "Sesi reset tidak valid atau kedaluwarsa. Ulangi dari awal.");
    const u = q.userByEmail.get(email); if (!u) throw bad;
    const r = q.latestReset.get(u.id);
    if (!r || !r.verified || r.expires_at < Date.now() || !safeEq(sha(String(b.resetToken || "")), r.token_hash || "")) throw bad;
    q.setPassword.run(hashPassword(b.password), u.id);
    q.markUsed.run(r.id);
    q.delUserSessions.run(u.id); // paksa keluar dari semua perangkat
    send(res, 200, { ok: true });
  },
};

/* ---------- File statis (whitelist) ---------- */
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/script.js": ["script.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  try {
    const url = new URL(req.url, "http://localhost");
    const handler = routes[`${req.method} ${url.pathname}`];
    if (handler) return await handler(req, res);
    if (url.pathname.startsWith("/api/")) throw new HttpError(404, "Endpoint tidak ditemukan");
    const file = req.method === "GET" && STATIC[url.pathname];
    if (!file) throw new HttpError(404, "Halaman tidak ditemukan");
    res.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-cache" });
    fs.createReadStream(path.join(ROOT, file[0])).pipe(res);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: "Terjadi kesalahan pada server" });
  }
});
server.listen(PORT, () => {
  console.log(`Kopi Batin berjalan di http://localhost:${PORT}`);
  if (SHOW_CODE) console.log("Mode pengembangan: kode reset password akan tampil di terminal ini dan di layar.");
});
