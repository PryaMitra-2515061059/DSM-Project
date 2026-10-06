/* ============================================================
   pengaturan.js — Modul PENGATURAN (admin)
   Butuh pelanggan.js (muat lebih dulu): $, esc, toast, busy, initials,
   sessionUser, sessionRole, supabaseClient, authFlowBusy,
   friendlyAuthError. Dipakai juga oleh laporan.js & riwayat.js lewat
   getSetting().
   ============================================================ */
/* ================= PENGATURAN (admin) =================
   Preferensi operasional disimpan di localStorage browser ini (per perangkat),
   bukan di database. Ganti password memakai Supabase Auth. */
const PENGATURAN_KEY="kopi-batin-pengaturan";
const PENGATURAN_DEFAULT={namaUsaha:"Kopi Batin",riPageSize:20,lapDetailLimit:100};
const PILIHAN_RI_PAGE=[10,20,50,100];
const PILIHAN_LAP_LIMIT=[50,100,200,500];

function bacaPengaturan(){
  try{return JSON.parse(localStorage.getItem(PENGATURAN_KEY))||{}}catch{return {}}
}
// Nilai tersimpan, atau bawaan bila belum diatur / rusak.
function getSetting(key){
  const v=bacaPengaturan()[key];
  return v===undefined||v===null||v===""?PENGATURAN_DEFAULT[key]:v;
}

function renderPengaturan(){
  // Akun
  const u=sessionUser;
  if(u){
    $("setAccount").innerHTML=`
      <div class="detail-profile"><div class="big-avatar">${esc(initials(u.name))}</div>
        <div><h3>${esc(u.name)}</h3><p>${esc(u.email||"-")} · ${sessionRole==="admin"?"Admin":"Pembeli"}</p></div></div>`;
  }
  // Preferensi
  $("setNamaUsaha").value=getSetting("namaUsaha");
  $("setRiPage").innerHTML=PILIHAN_RI_PAGE.map(n=>`<option value="${n}">${n} transaksi</option>`).join("");
  $("setRiPage").value=String(getSetting("riPageSize"));
  $("setLapLimit").innerHTML=PILIHAN_LAP_LIMIT.map(n=>`<option value="${n}">${n} transaksi</option>`).join("");
  $("setLapLimit").value=String(getSetting("lapDetailLimit"));
}

function savePengaturan(e){
  e.preventDefault();
  const namaUsaha=$("setNamaUsaha").value.trim();
  const riPageSize=Number($("setRiPage").value);
  const lapDetailLimit=Number($("setLapLimit").value);
  if(!namaUsaha){toast("Nama usaha tidak boleh kosong");return}
  if(namaUsaha.length>60){toast("Nama usaha maksimal 60 karakter");return}
  if(!PILIHAN_RI_PAGE.includes(riPageSize)||!PILIHAN_LAP_LIMIT.includes(lapDetailLimit)){toast("Pilihan tidak valid");return}
  try{
    localStorage.setItem(PENGATURAN_KEY,JSON.stringify({namaUsaha,riPageSize,lapDetailLimit}));
  }catch(err){toast("Gagal menyimpan pengaturan: "+err.message);return}
  applyPengaturan();
  toast("Pengaturan disimpan");
}

function resetPengaturan(){
  if(!confirm("Kembalikan semua preferensi ke nilai bawaan?"))return;
  try{localStorage.removeItem(PENGATURAN_KEY)}catch{}
  renderPengaturan();
  applyPengaturan();
  toast("Pengaturan dikembalikan ke bawaan");
}

// Terapkan ke modul lain tanpa perlu refresh.
function applyPengaturan(){
  if(typeof riPage!=="undefined")riPage=1;
  if(typeof renderRiwayat==="function")renderRiwayat();
  if(typeof renderLaporan==="function")renderLaporan();
}

async function changePassword(e){
  e.preventDefault();
  if(!sessionUser){toast("Sesi tidak ditemukan. Silakan login ulang.");return}
  const oldPw=$("setOldPass").value, newPw=$("setNewPass").value, confPw=$("setConfPass").value;
  if(newPw.length<8){toast("Password baru minimal 8 karakter");return}
  if(newPw!==confPw){toast("Konfirmasi password baru tidak cocok");return}
  if(newPw===oldPw){toast("Password baru harus berbeda dari password saat ini");return}
  const btn=e.target.querySelector("button[type=submit]");
  busy(btn,true); authFlowBusy=true;   // cegah onAuthStateChange memuat ulang sesi di tengah proses
  try{
    // Verifikasi password saat ini lebih dulu.
    const {error:authErr}=await supabaseClient.auth.signInWithPassword({email:sessionUser.email,password:oldPw});
    if(authErr){toast("Password saat ini salah");return}
    const {error}=await supabaseClient.auth.updateUser({password:newPw});
    if(error)throw error;
    $("setPassForm").reset();
    toast("Password berhasil diubah");
  }catch(err){
    toast(friendlyAuthError(err));
  }finally{
    busy(btn,false); authFlowBusy=false;
  }
}