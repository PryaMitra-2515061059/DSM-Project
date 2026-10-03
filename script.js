const SUPABASE_URL = "https://yidwhtzcuethnjtnfjfw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bf7ACxh-D-OkSCUp7877_A_SXXbzVi0";

const SUPABASE_REF = (SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/) || [])[1] || "";
const SUPABASE_URL_OK = SUPABASE_REF.length === 20;
if (!SUPABASE_URL_OK) console.error("SUPABASE_URL tidak valid: project ref harus 20 karakter, sekarang " + SUPABASE_REF.length + ". Salin ulang dari dashboard Supabase.");

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Singkatan document.getElementById, dipakai di hampir seluruh file.
const $=id=>document.getElementById(id);

/* ================= DATA PELANGGAN (Supabase: tabel customers & transactions) =================
   Baris pelanggan TIDAK lagi memakai data contoh (seed) atau localStorage.
   Setiap akun baru yang register otomatis dibuatkan satu baris pelanggan oleh
   trigger database (lihat supabase.sql). Tabel ini selalu mengikuti isi
   sebenarnya dari database, dan ikut berubah secara real-time lewat
   Supabase Realtime (lihat bagian FITUR REAL-TIME di akhir file). */
let data=[];
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
const fmtDate=d=>d?new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const initials=n=>(n||"?").trim().split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase();

function totals(c){return {visits:c.transactions.length,items:c.transactions.reduce((a,t)=>a+Number(t.qty),0),spend:c.transactions.reduce((a,t)=>a+Number(t.amount),0),last:c.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||null}}

// Ambil ulang seluruh data pelanggan + transaksi langsung dari database.
async function loadCustomers(){
  const {data:rows,error}=await supabaseClient
    .from("customers")
    .select("id,user_id,name,phone,email,joined,note,transactions(id,date,product,qty,amount)")
    .order("created_at",{ascending:false});
  if(error){toast("Gagal memuat data pelanggan: "+error.message);return}
  data=(rows||[]).map(c=>({...c,transactions:c.transactions||[]}));
  render();
}

function render(){
 const q=$("search").value.toLowerCase(), s=$("sort").value;
 let arr=data.filter(c=>(c.name+" "+c.phone).toLowerCase().includes(q));
 arr.sort((a,b)=>{let A=totals(a),B=totals(b); if(s==="name")return a.name.localeCompare(b.name);if(s==="visits")return B.visits-A.visits;if(s==="spend")return B.spend-A.spend;return (B.last||"").localeCompare(A.last||"")});
 const body=$("tbody");
 body.innerHTML=arr.length?arr.map(c=>{let t=totals(c);const acc=c.user_id?'<span class="status">Akun Terdaftar</span>':'<span class="status off">Tanpa Akun</span>';return `<tr>
 <td><div class="customer"><div class="avatar">${initials(c.name)}</div><div><div class="name">${esc(c.name)}</div><div class="phone">${esc(c.phone)}</div></div></div></td>
 <td><b>${t.visits}</b> <span class="muted">kali</span></td><td><b>${t.items}</b> <span class="muted">item</span></td><td class="money">${rupiah(t.spend)}</td><td>${fmtDate(t.last)}</td><td>${acc}</td>
 <td><div class="actions"><button class="icon-btn title" title="Detail" onclick="detail('${c.id}')">◉</button><button class="icon-btn" title="Tambah transaksi" onclick="openTransaction('${c.id}')">＋</button><button class="icon-btn" title="Edit" onclick="openCustomer('${c.id}')">✎</button><button class="icon-btn" title="Hapus" onclick="removeCustomer('${c.id}')">⌫</button></div></td>
 </tr>`}).join(""):`<tr><td colspan="7"><div class="empty">Belum ada pelanggan. Baris baru muncul otomatis saat ada akun yang register.</div></td></tr>`;
 $("statCustomers").textContent=data.length;
 $("statVisits").textContent=data.reduce((a,c)=>a+totals(c).visits,0);
 $("statItems").textContent=data.reduce((a,c)=>a+totals(c).items,0);
 $("statRevenue").textContent=rupiah(data.reduce((a,c)=>a+totals(c).spend,0));
}

function openCustomer(id=null){
 $("customerModal").classList.add("show");
 $("modalTitle").textContent=id?"Edit Pelanggan":"Tambah Pelanggan";
 $("customerId").value=id||"";
 if(id){let c=data.find(x=>x.id===id);$("name").value=c.name;$("phone").value=c.phone;$("email").value=c.email||"";$("joined").value=c.joined;$("note").value=c.note||""}
 else{document.querySelector("#customerModal form").reset();$("joined").value=new Date().toISOString().slice(0,10)}
}

async function saveCustomer(e){
 e.preventDefault();
 const id=$("customerId").value||null;
 const payload={name:$("name").value.trim(),phone:$("phone").value.trim(),email:$("email").value.trim(),joined:$("joined").value,note:$("note").value.trim()};
 const btn=e.target.closest(".modal").querySelector(".btn.primary");
 busy(btn,true);
 try{
  if(id){
   const {error}=await supabaseClient.from("customers").update({...payload,updated_by:(currentUser()||{}).name||null}).eq("id",id);
   if(error)throw error;
   toast("Data pelanggan diperbarui");
  }else{
   const {error}=await supabaseClient.from("customers").insert({...payload,created_by:(currentUser()||{}).name||null});
   if(error)throw error;
   toast("Pelanggan berhasil ditambahkan");
  }
  closeModal("customerModal");
  await loadCustomers();
 }catch(err){toast("Gagal menyimpan: "+err.message)}finally{busy(btn,false)}
}

function openTransaction(id){$("trxCustomerId").value=id;$("product").value="";$("qty").value=1;$("amount").value="";$("trxDate").value=new Date().toISOString().slice(0,10);$("transactionModal").classList.add("show")}

async function saveTransaction(e){
 e.preventDefault();
 const customer_id=$("trxCustomerId").value;
 const payload={customer_id,date:$("trxDate").value,product:$("product").value.trim(),qty:Number($("qty").value),amount:Number($("amount").value),created_by:(currentUser()||{}).name||null};
 const btn=e.target.closest(".modal").querySelector(".btn.primary");
 busy(btn,true);
 try{
  const {error}=await supabaseClient.from("transactions").insert(payload);
  if(error)throw error;
  closeModal("transactionModal");
  toast("Transaksi berhasil dicatat");
  await loadCustomers();
 }catch(err){toast("Gagal menyimpan transaksi: "+err.message)}finally{busy(btn,false)}
}

function detail(id){
 let c=data.find(x=>x.id===id); if(!c)return;
 let t=totals(c);
 const acc=c.user_id?'<span class="status">Akun Terdaftar</span>':'<span class="status off">Tanpa Akun</span>';
 $("detailContent").innerHTML=`
<div class="detail-profile"><div class="big-avatar">${initials(c.name)}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.phone)}${c.email?" · "+esc(c.email):""}</p><p style="margin-top:6px">${acc}</p></div></div>
<div class="mini-stats"><div class="mini"><small>Kunjungan</small><b>${t.visits} kali</b></div><div class="mini"><small>Jumlah item</small><b>${t.items} item</b></div><div class="mini"><small>Total pembelian</small><b>${rupiah(t.spend)}</b></div></div>
<div class="history-title">Riwayat Pembelian</div>
${c.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="history-item"><div><b>${esc(x.product)}</b><small>${fmtDate(x.date)} · ${x.qty} item</small></div><b>${rupiah(x.amount)}</b></div>`).join("")||'<div class="empty">Belum ada riwayat pembelian.</div>'}`;
 $("detailModal").classList.add("show")
}

async function removeCustomer(id){
 let c=data.find(x=>x.id===id); if(!c)return;
 if(!confirm("Hapus data pelanggan "+c.name+"?"+(c.user_id?" Akun login pelanggan ini TIDAK ikut terhapus, hanya baris datanya.":"")))return;
 try{
  const {error}=await supabaseClient.from("customers").delete().eq("id",id);
  if(error)throw error;
  toast("Data pelanggan dihapus");
  await loadCustomers();
 }catch(err){toast("Gagal menghapus: "+err.message)}
}

function closeModal(id){$(id).classList.remove("show")}
function resetFilter(){$("search").value="";$("sort").value="latest";render()}
function toast(msg){let el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function showComing(e,name){e.preventDefault();toast(name+" belum termasuk modul inti.")}
function exportCSV(){
 const rows=[["Nama","No WhatsApp","Status Akun","Kunjungan","Jumlah Pembelian","Total Pembelian","Terakhir Berkunjung"],...data.map(c=>{let t=totals(c);return[c.name,c.phone,c.user_id?"Akun Terdaftar":"Tanpa Akun",t.visits,t.items,t.spend,t.last||""]})];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="data-pelanggan-kopi-batin.csv";a.click();URL.revokeObjectURL(a.href);toast("CSV berhasil diekspor")}

/* ================= DASHBOARD PEMBELI (profil & riwayat pribadi) =================
   Hanya untuk akun role='pembeli'. Berbeda dari dashboard Admin, di sini
   pengguna cuma melihat profil dan riwayat pembeliannya SENDIRI -- baik di
   tampilan maupun di database (lihat kebijakan RLS "pembeli hanya baris
   sendiri" pada supabase.sql, bukan cuma disembunyikan di layar). */
let buyerRealtimeStarted=false, myCustomerId=null;

async function loadMyProfile(){
  if(!sessionUser)return;
  const profile=await fetchMyProfile(sessionUser.id);
  if(!profile){toast("Profil Anda tidak ditemukan. Hubungi admin.");return}
  myCustomerId=profile.id;
  const {data:trx,error}=await supabaseClient.from("transactions")
    .select("id,date,product,qty,amount")
    .eq("customer_id",profile.id)
    .order("date",{ascending:false});
  const transactions=error?[]:(trx||[]);
  const t=totals({transactions});
  $("buyerVisits").textContent=t.visits;
  $("buyerItems").textContent=t.items;
  $("buyerSpend").textContent=rupiah(t.spend);
  $("buyerAvatar").textContent=initials(profile.name);
  $("buyerName").textContent=profile.name;
  $("buyerProfile").innerHTML=`
    <div class="detail-profile"><div class="big-avatar">${initials(profile.name)}</div><div><h3>${esc(profile.name)}</h3><p>${esc(profile.phone)}${profile.email?" · "+esc(profile.email):""}</p></div></div>
    <div class="mini-stats">
      <div class="mini"><small>Bergabung sejak</small><b>${fmtDate(profile.joined)}</b></div>
      <div class="mini"><small>Catatan</small><b>${esc(profile.note)||"-"}</b></div>
    </div>`;
  $("buyerHistory").innerHTML=transactions.length?transactions.map(x=>`<div class="history-item"><div><b>${esc(x.product)}</b><small>${fmtDate(x.date)} · ${x.qty} item</small></div><b>${rupiah(x.amount)}</b></div>`).join(""):'<div class="empty">Belum ada riwayat pembelian. Riwayat akan muncul otomatis setelah ada transaksi atas nama Anda.</div>';
}

function startBuyerRealtimeOnce(){
  if(buyerRealtimeStarted)return; buyerRealtimeStarted=true;
  supabaseClient.channel("buyer-rt")
    .on("postgres_changes",{event:"*",schema:"public",table:"transactions"},()=>loadMyProfile())
    .on("postgres_changes",{event:"*",schema:"public",table:"customers"},()=>loadMyProfile())
    .subscribe();
}

// Tukar Kode Admin menjadi peran admin untuk akun yang sedang login.
// Validasi kodenya (berlaku/habis pakai/kedaluwarsa) dilakukan sepenuhnya
// di database lewat fungsi redeem_admin_invite() (lihat supabase.sql) --
// kode itu sendiri tidak pernah dikirim atau dicek di browser, supaya
// tidak bisa dibaca lewat DevTools atau ditebak dari script.js ini.
async function redeemAdminCode(){
  const input=$("adminCodeInput");
  const code=input.value.trim();
  if(!code){toast("Masukkan kode admin terlebih dahulu");return}
  const btn=document.querySelector("#adminUpgradePanel .btn.primary");
  busy(btn,true);
  try{
    const {error}=await supabaseClient.rpc("redeem_admin_invite",{p_code:code});
    if(error)throw error;
    input.value="";
    toast("Berhasil! Akun Anda sekarang Admin.");
    const {data:{user}}=await supabaseClient.auth.getUser();
    const profile=await fetchMyProfile(user.id);
    applySession(user,profile);
  }catch(err){toast("Gagal: "+err.message)}finally{busy(btn,false)}
}

/* ================= AUTENTIKASI & PERAN (Admin vs Pembeli) =================
   Setiap akun punya SATU peran tersimpan di kolom customers.role ('admin'
   atau 'pembeli'), ditentukan oleh database -- bukan oleh tombol yang
   diklik di layar login. Layar login hanya menentukan portal yang DITUJU
   (authPortal); begitu login berhasil, peran asli akun dicocokkan dengan
   portal tersebut. Kalau tidak cocok, pengguna langsung dikeluarkan lagi
   dengan pesan yang jelas, supaya akun Pembeli tidak bisa "menebak" masuk
   ke dashboard Admin dan sebaliknya. Pemisahan ini juga ditegakkan di sisi
   database lewat RLS (lihat supabase.sql), bukan cuma disembunyikan di
   tampilan. */
let sessionUser=null, sessionRole=null, authPortal=null, recovering=false, authFlowBusy=false;

function busy(btn,on){if(btn){btn.disabled=on;btn.style.opacity=on?".6":"1"}}
function currentUser(){return sessionUser}

// Terjemahkan pesan error teknis dari Supabase Auth (berbahasa Inggris)
// menjadi pesan yang jelas bagi pengguna. Untuk kombinasi email+password
// yang salah, pesannya SENGAJA digabung -- tidak membedakan "email belum
// terdaftar" dari "password salah" -- karena membedakan keduanya membuka
// celah keamanan: orang luar bisa mencoba-coba banyak alamat email untuk
// mengetahui mana saja yang sudah terdaftar di sistem (dikenal sebagai
// "email enumeration"). Ini praktik standar yang juga dipakai Supabase,
// Google, dan layanan serupa lainnya.
function friendlyAuthError(err){
  const m=(err&&err.message)||"";
  if(/invalid login credentials/i.test(m)){
    return "Email atau password salah. Periksa kembali, atau daftar dulu lewat tab Register jika belum punya akun.";
  }
  if(/email not confirmed/i.test(m)){
    return "Email Anda belum diverifikasi. Cek inbox (atau folder spam) untuk tautan konfirmasi dari Supabase.";
  }
  if(/user already registered|already been registered/i.test(m)){
    return "Email ini sudah terdaftar. Silakan login, atau gunakan menu Lupa Password jika lupa kata sandi.";
  }
  if(/rate limit|too many requests/i.test(m)){
    return "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.";
  }
  if(/password should be at least/i.test(m)){
    return "Password terlalu pendek. Gunakan minimal 8 karakter.";
  }
  if(/network|fetch/i.test(m)){
    return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
  }
  return m || "Terjadi kesalahan. Silakan coba lagi.";
}

function choosePortal(type){
  authPortal=type;
  $("portalPicker").classList.add("hidden");
  $("authForms").classList.remove("hidden");
  $("portalBadge").textContent=type==="admin"?"Masuk sebagai Admin":"Masuk / daftar sebagai Pembeli";
  if(type==="admin"){
    $("registerTab").classList.add("hidden");
    $("registerForm").classList.remove("active");
    $("adminRegisterNote").classList.remove("hidden");
  }else{
    $("registerTab").classList.remove("hidden");
    $("adminRegisterNote").classList.add("hidden");
  }
  switchAuth("login");
}
function backToPortalPicker(){
  authPortal=null;
  $("authForms").classList.add("hidden");
  $("portalPicker").classList.remove("hidden");
  $("portalBadge").textContent="Pilih jenis akun untuk masuk";
  ["loginForm","registerForm"].forEach(id=>{const f=$(id); if(f&&f.reset)f.reset()});
}

function switchAuth(type){
  $("loginTab").classList.toggle("active",type==="login");
  $("registerTab").classList.toggle("active",type==="register");
  $("loginForm").classList.toggle("active",type==="login");
  $("registerForm").classList.toggle("active",type==="register");
  $("forgotForm").classList.remove("active");
}
function showLogin(){switchAuth("login")}
function showForgotPassword(){
  ["loginTab","registerTab"].forEach(i=>$(i).classList.remove("active"));
  ["loginForm","registerForm"].forEach(i=>$(i).classList.remove("active"));
  $("forgotForm").classList.add("active");
  showForgotStep(1);
}
function showForgotStep(step){
  [1,2,3].forEach(n=>$("resetStep"+n).classList.toggle("active",n===step));
}
// Langkah 1: kirim email berisi tautan reset (Supabase)
async function requestReset(){
  const btn=document.querySelector("#resetStep1 .auth-submit");
  const email=$("resetEmail").value.trim();
  if(!email){toast("Masukkan email terlebih dahulu");return}
  if(!SUPABASE_URL_OK){toast("Konfigurasi Supabase salah: cek SUPABASE_URL di script.js");return}
  busy(btn,true);
  try{
    const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    if(error)throw error;
    toast("Jika email terdaftar, tautan reset telah dikirim. Cek inbox Anda.");
    showLogin();
  }catch(err){toast(friendlyAuthError(err))}finally{busy(btn,false)}
}
// Langkah 3: simpan password baru setelah pengguna membuka tautan di email
async function resetPassword(){
  const btn=document.querySelector("#resetStep3 .auth-submit");
  const p1=$("newPassword").value, p2=$("newPasswordConfirm").value;
  if(p1.length<8){toast("Password minimal 8 karakter");return}
  if(p1!==p2){toast("Konfirmasi password tidak cocok");return}
  busy(btn,true);
  try{
    const {error}=await supabaseClient.auth.updateUser({password:p1});
    if(error)throw error;
    ["newPassword","newPasswordConfirm","resetEmail"].forEach(i=>$(i).value="");
    recovering=false;
    toast("Password berhasil diubah.");
    showAuth();
  }catch(err){toast(friendlyAuthError(err))}finally{busy(btn,false)}
}

// Cek apakah password & konfirmasinya sudah sama, diperbarui setiap kali
// pengguna mengetik (bukan cuma dicek saat tombol submit ditekan), supaya
// kesalahan ketik langsung terlihat sebelum form dikirim.
function comparePasswords(pwId,confirmId,hintId){
  const pw=$(pwId).value, cf=$(confirmId).value;
  const hint=$(hintId); if(!hint)return;
  if(!cf){hint.textContent="";hint.className="field-hint";return}
  if(pw===cf){hint.textContent="✓ Password cocok";hint.className="field-hint match"}
  else{hint.textContent="✗ Password belum sama";hint.className="field-hint mismatch"}
}
function checkRegPasswordMatch(){comparePasswords("regPassword","regConfirm","regConfirmHint")}
function checkResetPasswordMatch(){comparePasswords("newPassword","newPasswordConfirm","resetConfirmHint")}

// Ambil baris profil (nama, peran, dsb) milik akun yang sedang login.
// Kebijakan RLS "customers select" selalu mengizinkan seseorang membaca
// baris miliknya sendiri (user_id = auth.uid()), apa pun perannya.
async function fetchMyProfile(userId){
  const {data,error}=await supabaseClient.from("customers")
    .select("id,name,phone,email,joined,note,role,user_id")
    .eq("user_id",userId).maybeSingle();
  if(error){console.error(error);return null}
  return data;
}

function applySession(user,profile){
  sessionUser={id:user.id,email:user.email,name:profile?.name||user.user_metadata?.full_name||user.email?.split("@")[0]||"Member"};
  sessionRole=profile?.role==="admin"?"admin":"pembeli";
  $("authScreen").classList.add("hidden");
  updateUserUI();
  if(sessionRole==="admin"){
    $("adminApp").classList.remove("hidden");
    $("buyerApp").classList.add("hidden");
    loadCustomers();
    startRealtimeOnce();
  }else{
    $("adminApp").classList.add("hidden");
    $("buyerApp").classList.remove("hidden");
    loadMyProfile();
    startBuyerRealtimeOnce();
  }
}

function clearSession(){
  sessionUser=null; sessionRole=null;
  $("adminApp").classList.add("hidden");
  $("buyerApp").classList.add("hidden");
  $("authScreen").classList.remove("hidden");
  backToPortalPicker();
  try{supabaseClient.removeAllChannels()}catch{}
  realtimeStarted=false; buyerRealtimeStarted=false;
  data=[];
}

async function showAuth(){
  let session = null;
  try { ({ data: { session } } = await supabaseClient.auth.getSession()); } catch (err) { console.error(err); }
  if (!session) { clearSession(); return; }
  const profile = await fetchMyProfile(session.user.id);
  applySession(session.user, profile);
}

function updateUserUI(){
  const u=sessionUser; if(!u)return;
  const label=sessionRole==="admin"?"Admin":"Pembeli";
  if($("userName")){$("userName").textContent=u.name;$("userAvatar").textContent=initials(u.name);if($("userRoleLabel"))$("userRoleLabel").textContent=label}
  if($("buyerName")){$("buyerName").textContent=u.name;$("buyerAvatar").textContent=initials(u.name)}
}

async function login(e){
  e.preventDefault();
  if (!SUPABASE_URL_OK) { toast("Konfigurasi Supabase salah: cek SUPABASE_URL di script.js"); return; }
  const btn = e.target.querySelector(".auth-submit");
  busy(btn, true); authFlowBusy=true;
  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const profile = await fetchMyProfile(data.user.id);
    if(!profile){
      await supabaseClient.auth.signOut();
      throw new Error("Profil pelanggan untuk akun ini tidak ditemukan. Hubungi admin.");
    }
    if(authPortal && profile.role!==authPortal){
      await supabaseClient.auth.signOut();
      const real=profile.role==="admin"?"Admin":"Pembeli";
      throw new Error("Akun ini terdaftar sebagai "+real+". Silakan kembali dan pilih portal "+real+".");
    }

    applySession(data.user, profile);
    $("loginForm").reset();
    toast("Login berhasil. Selamat datang, " + (profile.name||data.user.email));
  } catch (err) {
    toast(friendlyAuthError(err));
  } finally {
    busy(btn, false); authFlowBusy=false;
  }
}

async function register(e){
  e.preventDefault();
  if (!SUPABASE_URL_OK) { toast("Konfigurasi Supabase salah: cek SUPABASE_URL di script.js"); return; }
  if (authPortal!=="pembeli") { toast("Pendaftaran akun baru hanya tersedia untuk portal Pembeli."); return; }

  const btn = e.target.querySelector(".auth-submit");
  const name = $("regName").value.trim();
  const phone = $("regPhone").value.trim();
  const email = $("regEmail").value.trim();
  const password = $("regPassword").value;
  const confirm = $("regConfirm").value;

  if (password !== confirm) { toast("Konfirmasi password tidak cocok"); return; }
  if (password.length < 8) { toast("Password minimal 8 karakter"); return; }

  busy(btn, true); authFlowBusy=true;
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email, password, options: { data: { full_name: name, phone } }
    });
    if (error) throw error;
    $("registerForm").reset();

    // Jika "Confirm Email" aktif di Supabase, user harus membuka email
    // konfirmasi dulu sebelum punya sesi.
    if (data.session) {
      const profile = await fetchMyProfile(data.user.id);
      applySession(data.user, profile);
      toast("Akun berhasil dibuat. Selamat datang, " + name);
    } else {
      switchAuth("login");
      toast("Akun berhasil dibuat. Silakan cek email untuk verifikasi.");
    }
  } catch (err) {
    toast(friendlyAuthError(err));
  } finally {
    busy(btn, false); authFlowBusy=false;
  }
}

async function logout(){
  const { error } = await supabaseClient.auth.signOut();
  if (error) { toast(error.message); return; }
  clearSession();
  toast("Anda telah keluar dari akun");
}

showAuth();

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    recovering = true;
    $("authScreen").classList.remove("hidden");
    $("portalPicker").classList.add("hidden");
    $("authForms").classList.remove("hidden");
    showForgotPassword();
    showForgotStep(3);
    return;
  }
  if (recovering) return;
  if (authFlowBusy) return; // login()/register() sudah menangani sesi ini sendiri

  if (session) {
    fetchMyProfile(session.user.id).then(profile=>applySession(session.user, profile));
  } else {
    clearSession();
  }
});

render();


/* ================= FITUR REAL-TIME =================
   Tabel Data Pelanggan dan feed di bawah ini terhubung langsung ke database
   lewat Supabase Realtime (WebSocket) -- bukan lagi event "storage" di
   localStorage. Begitu ada perubahan di tabel customers/transactions (oleh
   siapa pun, dari perangkat mana pun, termasuk trigger pendaftaran akun
   baru), semua tab/perangkat yang sedang login langsung memuat ulang data
   dan menampilkan aktivitasnya di sini -- tanpa refresh. */
let activity=[];
const esc=t=>String(t??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

// Jam selalu menampilkan WIB (Asia/Jakarta) secara eksplisit, apa pun zona
// waktu perangkat pengguna -- sebelumnya jam memakai zona waktu perangkat
// tapi labelnya tetap "WIB", sehingga salah bila perangkat diatur ke zona
// waktu lain. Penjadwalan juga disinkronkan ke awal setiap detik (bukan
// setInterval biasa) supaya tidak drift, dan langsung disegarkan begitu tab
// aktif lagi setelah sempat ditahan browser di latar belakang.
let clockTimer=null;
function tickClock(){
  const el=$("liveClock"); if(!el)return;
  const now=new Date();
  const time=now.toLocaleTimeString("id-ID",{hour12:false,timeZone:"Asia/Jakarta"});
  const date=now.toLocaleDateString("id-ID",{weekday:"long",day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Jakarta"});
  el.textContent=time+" WIB";
  el.title=date;
}
function scheduleClock(){
  tickClock();
  clearTimeout(clockTimer);
  clockTimer=setTimeout(scheduleClock,1000-new Date().getMilliseconds());
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tickClock()});
function timeAgo(ts){
  const d=Math.floor((Date.now()-ts)/1000);
  if(d<10)return "baru saja"; if(d<60)return d+" detik lalu";
  if(d<3600)return Math.floor(d/60)+" menit lalu";
  if(d<86400)return Math.floor(d/3600)+" jam lalu";
  return new Date(ts).toLocaleDateString("id-ID",{day:"2-digit",month:"short"});
}
const actIcon={add:"＋",edit:"✎",trx:"☕",del:"⌫"};
function renderActivity(freshTs){
  const box=$("activityList"); if(!box)return;
  box.innerHTML=activity.length?activity.slice(0,8).map(a=>`<div class="act-item${a.t===freshTs?" new":""}">
    <div class="act-ico ${a.type==="trx"?"trx":a.type==="del"?"del":""}">${actIcon[a.type]||"•"}</div>
    <div class="act-body">${a.text}${a.by?`<small>oleh ${esc(a.by)}</small>`:""}</div>
    <div class="act-time" data-ts="${a.t}">${timeAgo(a.t)}</div></div>`).join("")
    :'<div class="empty">Belum ada aktivitas. Daftarkan akun atau catat pembelian untuk melihat pembaruan langsung.</div>';
}
function logActivity(text,type,by){
  const item={t:Date.now(),text,type,by:by||null};
  activity.unshift(item); activity=activity.slice(0,30);
  renderActivity(item.t); flashStats();
}
function flashStats(){
  document.querySelectorAll(".stat .num").forEach(n=>{n.classList.remove("flash");void n.offsetWidth;n.classList.add("flash")});
}

/* Berlangganan perubahan tabel customers & transactions lewat Supabase Realtime.
   Dipanggil sekali setiap sesi login sebagai admin (lihat applySession). */
let realtimeStarted=false;
function startRealtimeOnce(){
  if(realtimeStarted)return; realtimeStarted=true;
  supabaseClient.channel("customers-rt")
    .on("postgres_changes",{event:"*",schema:"public",table:"customers"},payload=>reactToChange("customers",payload))
    .subscribe();
  supabaseClient.channel("transactions-rt")
    .on("postgres_changes",{event:"*",schema:"public",table:"transactions"},payload=>reactToChange("transactions",payload))
    .subscribe();
}
function reactToChange(table,payload){
  const row=payload.new||payload.old||{};
  if(table==="customers"){
    if(payload.eventType==="INSERT"){
      const by=row.created_by;
      logActivity(by?("Pelanggan baru <b>"+esc(row.name)+"</b> ditambahkan"):("Akun baru <b>"+esc(row.name)+"</b> mendaftar sebagai pelanggan"),"add",by);
    }else if(payload.eventType==="UPDATE"){
      logActivity("Data pelanggan <b>"+esc(row.name)+"</b> diperbarui","edit",row.updated_by);
    }else if(payload.eventType==="DELETE"){
      logActivity("Data pelanggan <b>"+esc(row.name||"")+"</b> dihapus","del",row.updated_by);
    }
  }else{
    if(payload.eventType==="INSERT"){
      const c=data.find(x=>x.id===row.customer_id);
      logActivity("<b>"+esc(c?c.name:"Pelanggan")+"</b> membeli "+esc(row.product)+" ("+row.qty+" item) senilai "+rupiah(row.amount),"trx",row.created_by);
    }else if(payload.eventType==="DELETE"){
      logActivity("Transaksi "+esc(row.product||"")+" dihapus","del",row.created_by);
    }
  }
  loadCustomers();
}

/* Indikator koneksi */
function setOnline(){
  document.querySelectorAll(".live-box .live-dot").forEach(d=>d.classList.toggle("offline",!navigator.onLine));
  const b=document.querySelector(".live-box b"); if(b)b.textContent=navigator.onLine?"Live":"Offline";
}
window.addEventListener("online",setOnline);window.addEventListener("offline",setOnline);

scheduleClock();renderActivity();setOnline();
setInterval(()=>document.querySelectorAll(".act-time").forEach(el=>el.textContent=timeAgo(Number(el.dataset.ts))),15000);