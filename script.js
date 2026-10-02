const SUPABASE_URL = "https://yidwhtzcuethnjtnfjfw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bf7ACxh-D-OkSCUp7877_A_SXXbzVi0";

const SUPABASE_REF = (SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/) || [])[1] || "";
const SUPABASE_URL_OK = SUPABASE_REF.length === 20;
if (!SUPABASE_URL_OK) console.error("SUPABASE_URL tidak valid: project ref harus 20 karakter, sekarang " + SUPABASE_REF.length + ". Salin ulang dari dashboard Supabase.");

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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

/* ================= AUTENTIKASI (terhubung ke server + database) ================= */
let sessionUser=null;
function busy(btn,on){if(btn){btn.disabled=on;btn.style.opacity=on?".6":"1"}}
function switchAuth(type){
  document.getElementById("loginTab").classList.toggle("active",type==="login");
  document.getElementById("registerTab").classList.toggle("active",type==="register");
  document.getElementById("loginForm").classList.toggle("active",type==="login");
  document.getElementById("registerForm").classList.toggle("active",type==="register");
  document.getElementById("forgotForm").classList.remove("active");
}
function currentUser(){return sessionUser}

let recovering=false;
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
  }catch(err){toast(err.message)}finally{busy(btn,false)}
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
  }catch(err){toast(err.message)}finally{busy(btn,false)}
}

let realtimeStarted=false;
function setUser(u){
  sessionUser=u||null;
  document.getElementById("authScreen").classList.toggle("hidden",!!sessionUser);
  updateUserUI();
  if(sessionUser){
    loadCustomers();
    startRealtimeOnce();
  }else{
    data=[];render();
    supabaseClient.removeAllChannels();
    realtimeStarted=false;
  }
}
async function showAuth(){

  let session = null;
  try {
    ({ data: { session } } = await supabaseClient.auth.getSession());
  } catch (err) { console.error(err); }

  if (!session) {
    setUser(null);
    return;
  }

  const user = session.user;

  const name =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Member";

  setUser({
    id: user.id,
    name: name,
    email: user.email
  });
}

function updateUserUI(){
  const u=sessionUser;if(!u)return;
  document.getElementById("userName").textContent=u.name;
  document.getElementById("userAvatar").textContent=initials(u.name);
}
async function login(e){
  e.preventDefault();
  if (!SUPABASE_URL_OK) { toast("Konfigurasi Supabase salah: cek SUPABASE_URL di script.js"); return; }

  const btn = e.target.querySelector(".auth-submit");
  busy(btn, true);

  try {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    const user = data.user;

    const name =
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Member";

    setUser({
      id: user.id,
      name: name,
      email: user.email
    });

    document.getElementById("loginForm").reset();

    toast("Login berhasil. Selamat datang, " + name);

  } catch (err) {
    toast(err.message);
  } finally {
    busy(btn, false);
  }
}

async function register(e){
  e.preventDefault();
  if (!SUPABASE_URL_OK) { toast("Konfigurasi Supabase salah: cek SUPABASE_URL di script.js"); return; }

  const btn = e.target.querySelector(".auth-submit");
  const name = document.getElementById("regName").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirm").value;

  if (password !== confirm) {
    toast("Konfirmasi password tidak cocok");
    return;
  }

  if (password.length < 8) {
    toast("Password minimal 8 karakter");
    return;
  }

  busy(btn, true);

  try {

    const { data, error } =
      await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone
          }
        }
      });

    if (error) throw error;

    document.getElementById("registerForm").reset();

    /*
      Jika Confirm Email aktif di Supabase,
      user harus membuka email konfirmasi terlebih dahulu.
    */

    if (data.session) {

      setUser({
        id: data.user.id,
        name: name,
        email: data.user.email
      });

      toast("Akun berhasil dibuat. Selamat datang, " + name);

    } else {

      switchAuth("login");

      toast(
        "Akun berhasil dibuat. Silakan cek email untuk verifikasi."
      );

    }

  } catch (err) {

    toast(err.message);

  } finally {

    busy(btn, false);

  }
}

async function logout(){

  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    toast(error.message);
    return;
  }

  setUser(null);
  switchAuth("login");

  toast("Anda telah keluar dari akun");
}

showAuth();

supabaseClient.auth.onAuthStateChange(
  (event, session) => {

    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      $("authScreen").classList.remove("hidden");
      showForgotPassword();
      showForgotStep(3);
      return;
    }

    if (recovering) return;

    if (session) {

      const user = session.user;

      const name =
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Member";

      setUser({
        id: user.id,
        name: name,
        email: user.email
      });

    } else {

      setUser(null);

    }

  }
);

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

function tickClock(){
  const el=$("liveClock"); if(!el)return;
  el.textContent=new Date().toLocaleTimeString("id-ID",{hour12:false})+" WIB";
}
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
   Dipanggil sekali setiap sesi login (lihat setUser). */
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

tickClock();renderActivity();setOnline();
setInterval(tickClock,1000);
setInterval(()=>document.querySelectorAll(".act-time").forEach(el=>el.textContent=timeAgo(Number(el.dataset.ts))),15000);
