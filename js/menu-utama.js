/* ============================================================
   menu-utama.js — Modul MENU UTAMA (halaman depan publik)
   Butuh pelanggan.js (muat lebih dulu): $, esc, rupiah, sessionUser,
   sessionRole, logout, backToPortalPicker.
   pelanggan.js (applySession/clearSession) memanggil applyView() dan
   memakai dashOpen dari file ini -- keduanya baru dipakai saat runtime,
   jadi urutan muat cukup: pelanggan.js lalu menu-utama.js.
   ============================================================ */
/* ================= HALAMAN DEPAN & MENU (publik) =================
   Ditampilkan sebelum login. Tombol "Login" di pojok kanan atas membuka
   kartu login/register (authScreen) sebagai jendela di atas halaman ini.
   Daftar menu & harga di bawah ini contoh -- sesuaikan dengan menu asli. */
const MENU=[
  {cat:"Kopi",ico:"☕",name:"Kopi Susu Batin",desc:"Espresso dengan susu segar dan gula aren, racikan khas kami.",price:22000},
  {cat:"Kopi",ico:"☕",name:"Americano",desc:"Espresso ganda dengan air panas, ringan dan bersih.",price:18000},
  {cat:"Kopi",ico:"☕",name:"Cappuccino",desc:"Espresso, susu hangat, dan busa susu yang lembut.",price:24000},
  {cat:"Kopi",ico:"☕",name:"Kopi Tubruk Lampung",desc:"Robusta Lampung diseduh tradisional, pekat dan harum.",price:15000},
  {cat:"Non-Kopi",ico:"🍵",name:"Matcha Latte",desc:"Matcha dan susu, manis seimbang.",price:26000},
  {cat:"Non-Kopi",ico:"🍫",name:"Cokelat Panas",desc:"Cokelat pekat dengan susu hangat.",price:22000},
  {cat:"Non-Kopi",ico:"🍋",name:"Lemon Tea",desc:"Teh segar dengan perasan lemon.",price:16000},
  {cat:"Makanan",ico:"🥐",name:"Croissant Butter",desc:"Renyah di luar, lembut di dalam.",price:20000},
  {cat:"Makanan",ico:"🍞",name:"Roti Bakar Cokelat Keju",desc:"Roti bakar tebal dengan cokelat dan keju.",price:18000},
  {cat:"Makanan",ico:"🍟",name:"Kentang Goreng",desc:"Kentang goreng renyah, cocok dinikmati bersama kopi.",price:17000},
];
let menuCat="Semua";
function setMenuCat(c){menuCat=c;renderMenu()}
function renderMenu(){
  const cats=["Semua",...new Set(MENU.map(m=>m.cat))];
  $("menuTabs").innerHTML=cats.map(c=>`<button type="button" class="menu-tab${c===menuCat?" active":""}" onclick="setMenuCat('${c}')">${esc(c)}</button>`).join("");
  $("menuGrid").innerHTML=MENU.filter(m=>menuCat==="Semua"||m.cat===menuCat).map(m=>`<div class="menu-card">
    <div class="menu-ico">${m.ico}</div><h3>${esc(m.name)}</h3><p>${esc(m.desc)}</p><div class="menu-price">${rupiah(m.price)}</div></div>`).join("");
}
function openAuth(){
  $("authScreen").classList.remove("hidden");
}
function closeAuth(){
  $("authScreen").classList.add("hidden");
  backToPortalPicker();
}

// dashOpen: true = dashboard sedang dibuka, false = pengguna di halaman utama (menu).
// Disimpan terpisah supaya refresh token / event auth tidak "melempar" pengguna
// keluar dari dashboard yang sedang dibuka.
let dashOpen=false;

function applyView(){
  const logged=!!sessionUser;
  $("landingPage").classList.toggle("hidden",logged&&dashOpen);
  $("adminApp").classList.toggle("hidden",!(logged&&dashOpen&&sessionRole==="admin"));
  $("buyerApp").classList.toggle("hidden",!(logged&&dashOpen&&sessionRole==="pembeli"));
  // Tombol pojok kanan atas: Login (belum masuk) -> Dashboard (sudah masuk)
  $("landingAuthBtn").textContent=logged?"Dashboard ▸":"Login";
  $("landingLogout").classList.toggle("hidden",!logged);
  $("landingUser").textContent=logged?sessionUser.name:"";
  $("landingUser").classList.toggle("hidden",!logged);
}
function landingAuthAction(){ sessionUser?openDashboard():openAuth(); }
function openDashboard(){
  if(!sessionUser){openAuth();return}
  dashOpen=true; applyView(); window.scrollTo(0,0);
}
function showLanding(){
  dashOpen=false; applyView(); window.scrollTo(0,0);
}

document.addEventListener("DOMContentLoaded",renderMenu);