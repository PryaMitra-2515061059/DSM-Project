"use strict";
/**
 * Kopi Batin — Server statis.
 *
 * Hanya menyajikan index.html, script.js, dan style.css. Autentikasi
 * (login, register, lupa password, sesi) sepenuhnya ditangani langsung oleh
 * Supabase Auth dari browser (lihat script.js) -- server ini TIDAK lagi
 * menyimpan data pengguna, password, atau sesi apa pun.
 *
 * Dipakai sekadar supaya index.html dibuka lewat http://localhost, bukan
 * file://, karena sebagian browser membatasi pemanggilan API pihak ketiga
 * dari halaman yang dibuka langsung dari disk.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/script.js": ["script.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

const server = http.createServer((req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");

  const url = new URL(req.url, "http://localhost");
  const file = req.method === "GET" && STATIC[url.pathname];
  if (!file) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Halaman tidak ditemukan" }));
    return;
  }
  res.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-cache" });
  fs.createReadStream(path.join(ROOT, file[0])).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Kopi Batin berjalan di http://localhost:${PORT}`);
});