const SUPABASE_URL = "https://yidwhtzcuethnjtnfjfw.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_bf7ACxh-D-OkSCUp7877_A_SXXbzVi0";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const seed=[
{id:1,name:"Raka Pratama",phone:"081234567890",email:"raka@email.com",joined:"2026-08-05",note:"Mahasiswa",transactions:[
{date:"2026-09-27",product:"Kopi Susu Batin",qty:2,amount:30000},{date:"2026-09-20",product:"Brownies",qty:1,amount:18000},{date:"2026-09-10",product:"Matcha Latte",qty:1,amount:22000}]},
{id:2,name:"Nadia Putri",phone:"082198765432",email:"",joined:"2026-08-14",note:"",transactions:[
{date:"2026-09-26",product:"Americano",qty:1,amount:18000},{date:"2026-09-14",product:"Brownies",qty:2,amount:36000}]},
{id:3,name:"Fajar Ramadhan",phone:"085712345678",email:"fajar@email.com",joined:"2026-07-21",note:"",transactions:[
{date:"2026-09-25",product:"Kopi Susu Batin",qty:1,amount:15000}]},
{id:4,name:"Citra Lestari",phone:"081376543210",email:"",joined:"2026-09-02",note:"",transactions:[
{date:"2026-09-24",product:"Matcha Latte",qty:2,amount:44000},{date:"2026-09-17",product:"Kopi Susu Batin",qty:1,amount:15000},{date:"2026-09-03",product:"Brownies",qty:1,amount:18000},{date:"2026-08-28",product:"Americano",qty:1,amount:18000}]}
];
let data=JSON.parse(localStorage.getItem("kopiBatinCustomers")||"null")||seed;
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
const fmtDate=d=>d?new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}):"-";
const initials=n=>n.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
function persist(){localStorage.setItem("kopiBatinCustomers",JSON.stringify(data));markSync()}
function totals(c){return {visits:c.transactions.length,items:c.transactions.reduce((a,t)=>a+Number(t.qty),0),spend:c.transactions.reduce((a,t)=>a+Number(t.amount),0),last:c.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||null}}
function render(){
 const q=document.getElementById("search").value.toLowerCase(), s=document.getElementById("sort").value;
 let arr=data.filter(c=>(c.name+" "+c.phone).toLowerCase().includes(q));
 arr.sort((a,b)=>{let A=totals(a),B=totals(b); if(s==="name")return a.name.localeCompare(b.name);if(s==="visits")return B.visits-A.visits;if(s==="spend")return B.spend-A.spend;return (B.last||"").localeCompare(A.last||"")});
 const body=document.getElementById("tbody");
 body.innerHTML=arr.length?arr.map(c=>{let t=totals(c);return `<tr>
 <td><div class="customer"><div class="avatar">${initials(c.name)}</div><div><div class="name">${c.name}</div><div class="phone">${c.phone}</div></div></div></td>
 <td><b>${t.visits}</b> <span class="muted">kali</span></td><td><b>${t.items}</b> <span class="muted">item</span></td><td class="money">${rupiah(t.spend)}</td><td>${fmtDate(t.last)}</td><td><span class="status">Aktif</span></td>
 <td><div class="actions"><button class="icon-btn title" title="Detail" onclick="detail(${c.id})">◉</button><button class="icon-btn" title="Tambah transaksi" onclick="openTransaction(${c.id})">＋</button><button class="icon-btn" title="Edit" onclick="openCustomer(${c.id})">✎</button><button class="icon-btn" title="Hapus" onclick="removeCustomer(${c.id})">⌫</button></div></td>
 </tr>`}).join(""):`<tr><td colspan="7"><div class="empty">Data pelanggan tidak ditemukan.</div></td></tr>`;
 document.getElementById("statCustomers").textContent=data.length;
 document.getElementById("statVisits").textContent=data.reduce((a,c)=>a+totals(c).visits,0);
 document.getElementById("statItems").textContent=data.reduce((a,c)=>a+totals(c).items,0);
 document.getElementById("statRevenue").textContent=rupiah(data.reduce((a,c)=>a+totals(c).spend,0));
}
function openCustomer(id=null){
 document.getElementById("customerModal").classList.add("show");
 document.getElementById("modalTitle").textContent=id?"Edit Pelanggan":"Tambah Pelanggan";
 document.getElementById("customerId").value=id||"";
 if(id){let c=data.find(x=>x.id===id);name.value=c.name;phone.value=c.phone;email.value=c.email||"";joined.value=c.joined;note.value=c.note||""}
 else{document.querySelector("#customerModal form").reset();joined.value=new Date().toISOString().slice(0,10)}
}
function saveCustomer(e){e.preventDefault();let id=Number(customerId.value);let obj={id:id||Date.now(),name:name.value.trim(),phone:phone.value.trim(),email:email.value.trim(),joined:joined.value,note:note.value.trim(),transactions:[]};
 if(id){let old=data.find(x=>x.id===id);obj.transactions=old.transactions;data=data.map(x=>x.id===id?obj:x);toast("Data pelanggan diperbarui");logActivity("Data pelanggan <b>"+esc(obj.name)+"</b> diperbarui","edit")}
 else{data.unshift(obj);toast("Pelanggan berhasil ditambahkan");logActivity("Pelanggan baru <b>"+esc(obj.name)+"</b> ditambahkan","add")}
 persist();render();closeModal("customerModal")}
function openTransaction(id){trxCustomerId.value=id;product.value="";qty.value=1;amount.value="";trxDate.value=new Date().toISOString().slice(0,10);document.getElementById("transactionModal").classList.add("show")}
function saveTransaction(e){e.preventDefault();let c=data.find(x=>x.id===Number(trxCustomerId.value));c.transactions.push({date:trxDate.value,product:product.value.trim(),qty:Number(qty.value),amount:Number(amount.value)});persist();render();closeModal("transactionModal");toast("Transaksi berhasil dicatat");logActivity("<b>"+esc(c.name)+"</b> membeli "+esc(product.value.trim())+" ("+Number(qty.value)+" item) senilai "+rupiah(Number(amount.value)),"trx")}
function detail(id){let c=data.find(x=>x.id===id),t=totals(c);document.getElementById("detailContent").innerHTML=`
<div class="detail-profile"><div class="big-avatar">${initials(c.name)}</div><div><h3>${c.name}</h3><p>${c.phone}${c.email?" · "+c.email:""}</p></div></div>
<div class="mini-stats"><div class="mini"><small>Kunjungan</small><b>${t.visits} kali</b></div><div class="mini"><small>Jumlah item</small><b>${t.items} item</b></div><div class="mini"><small>Total pembelian</small><b>${rupiah(t.spend)}</b></div></div>
<div class="history-title">Riwayat Pembelian</div>
${c.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="history-item"><div><b>${x.product}</b><small>${fmtDate(x.date)} · ${x.qty} item</small></div><b>${rupiah(x.amount)}</b></div>`).join("")||'<div class="empty">Belum ada riwayat pembelian.</div>'}`;
document.getElementById("detailModal").classList.add("show")}
function removeCustomer(id){let c=data.find(x=>x.id===id);if(confirm("Hapus data pelanggan "+c.name+"?")){data=data.filter(x=>x.id!==id);persist();render();toast("Data pelanggan dihapus");logActivity("Data pelanggan <b>"+esc(c.name)+"</b> dihapus","del")}}
function closeModal(id){document.getElementById(id).classList.remove("show")}
function resetFilter(){search.value="";sort.value="latest";render()}
function toast(msg){let el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function showComing(e,name){e.preventDefault();toast(name+" belum termasuk modul inti.")}
function exportCSV(){
 const rows=[["Nama","No WhatsApp","Kunjungan","Jumlah Pembelian","Total Pembelian","Terakhir Berkunjung"],...data.map(c=>{let t=totals(c);return[c.name,c.phone,t.visits,t.items,t.spend,t.last||""]})];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="data-pelanggan-kopi-batin.csv";a.click();URL.revokeObjectURL(a.href);toast("CSV berhasil diekspor")}

/* ================= AUTENTIKASI (terhubung ke server + database) ================= */
let sessionUser=null;
const isFile=location.protocol==="file:";
async function api(path,body){
  if(isFile)throw new Error("Jalankan server dengan 'npm start', lalu buka http://localhost:3000");
  let r;
  try{r=await fetch(path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:body===undefined?undefined:JSON.stringify(body)})}
  catch{throw new Error("Tidak dapat terhubung ke server. Pastikan server sudah berjalan.")}
  let j={};try{j=await r.json()}catch{}
  if(!r.ok)throw new Error(j.error||"Terjadi kesalahan pada server");
  return j;
}
function busy(btn,on){if(btn){btn.disabled=on;btn.style.opacity=on?".6":"1"}}
function pingAuth(){try{localStorage.setItem("kopiBatinAuthPing",String(Date.now()))}catch{}}
function switchAuth(type){
  document.getElementById("loginTab").classList.toggle("active",type==="login");
  document.getElementById("registerTab").classList.toggle("active",type==="register");
  document.getElementById("loginForm").classList.toggle("active",type==="login");
  document.getElementById("registerForm").classList.toggle("active",type==="register");
  document.getElementById("forgotForm").classList.remove("active");
}
function currentUser(){return sessionUser}

let resetState={email:"",token:""};
function showLogin(){switchAuth("login")}
function showForgotPassword(){
  ["loginTab","registerTab"].forEach(i=>document.getElementById(i).classList.remove("active"));
  ["loginForm","registerForm"].forEach(i=>document.getElementById(i).classList.remove("active"));
  document.getElementById("forgotForm").classList.add("active");
  showForgotStep(1);
}
function showForgotStep(step){
  [1,2,3].forEach(n=>document.getElementById("resetStep"+n).classList.toggle("active",n===step));
  if(step!==2)document.getElementById("demoCode").style.display="none";
}
async function requestReset(){
  const btn=document.querySelector("#resetStep1 .auth-submit");
  const email=document.getElementById("resetEmail").value.trim().toLowerCase();
  if(!email){toast("Masukkan email terlebih dahulu");return}
  busy(btn,true);
  try{
    const r=await api("/api/forgot",{email});
    resetState={email,token:""};
    document.getElementById("resetCode").value="";
    const demo=document.getElementById("demoCode");
    if(r.devCode){demo.innerHTML="<b>Mode Pengembangan:</b> kode verifikasi Anda <strong>"+r.devCode+"</strong>. Pada mode produksi kode hanya dikirim lewat email.";demo.style.display="block"}
    else demo.style.display="none";
    showForgotStep(2);
    toast(r.message||"Kode verifikasi dikirim");
  }catch(err){toast(err.message)}finally{busy(btn,false)}
}
async function verifyResetCode(){
  const btn=document.querySelector("#resetStep2 .auth-submit");
  const code=document.getElementById("resetCode").value.trim();
  if(!/^\d{6}$/.test(code)){toast("Kode terdiri dari 6 angka");return}
  busy(btn,true);
  try{
    const r=await api("/api/verify-reset",{email:resetState.email,code});
    resetState.token=r.resetToken;
    showForgotStep(3);toast("Kode terverifikasi");
  }catch(err){toast(err.message)}finally{busy(btn,false)}
}
async function resetPassword(){
  const btn=document.querySelector("#resetStep3 .auth-submit");
  const p1=document.getElementById("newPassword").value;
  const p2=document.getElementById("newPasswordConfirm").value;
  if(p1.length<8){toast("Password minimal 8 karakter");return}
  if(p1!==p2){toast("Konfirmasi password tidak cocok");return}
  busy(btn,true);
  try{
    await api("/api/reset",{email:resetState.email,resetToken:resetState.token,password:p1,confirm:p2});
    resetState={email:"",token:""};
    ["newPassword","newPasswordConfirm","resetEmail","resetCode"].forEach(i=>document.getElementById(i).value="");
    showLogin();pingAuth();
    toast("Password berhasil direset. Silakan login.");
  }catch(err){toast(err.message)}finally{busy(btn,false)}
}

function setUser(u){
  sessionUser=u||null;
  document.getElementById("authScreen").classList.toggle("hidden",!!sessionUser);
  updateUserUI();
}
async function showAuth(){

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

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


/* ================= FITUR REAL-TIME =================*/
const actKey="kopiBatinActivity", custKey="kopiBatinCustomers";
let activity=JSON.parse(localStorage.getItem(actKey)||"[]");
const esc=t=>String(t).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

function tickClock(){
  const el=document.getElementById("liveClock"); if(!el)return;
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
  const box=document.getElementById("activityList"); if(!box)return;
  box.innerHTML=activity.length?activity.slice(0,8).map(a=>`<div class="act-item${a.t===freshTs?" new":""}">
    <div class="act-ico ${a.type==="trx"?"trx":a.type==="del"?"del":""}">${actIcon[a.type]||"•"}</div>
    <div class="act-body">${a.text}<small>oleh ${esc(a.by)}</small></div>
    <div class="act-time" data-ts="${a.t}">${timeAgo(a.t)}</div></div>`).join("")
    :'<div class="empty">Belum ada aktivitas. Tambah pelanggan atau catat pembelian untuk melihat pembaruan langsung.</div>';
}
function logActivity(text,type){
  const item={t:Date.now(),text,type,by:(currentUser()||{}).name||"Sistem"};
  activity.unshift(item); activity=activity.slice(0,30);
  localStorage.setItem(actKey,JSON.stringify(activity));
  renderActivity(item.t); flashStats();
}
function flashStats(){
  document.querySelectorAll(".stat .num").forEach(n=>{n.classList.remove("flash");void n.offsetWidth;n.classList.add("flash")});
}
function markSync(){} // titik kait bila nanti dihubungkan ke backend

/* Sinkronisasi antar tab: event "storage" hanya terpicu di tab LAIN */
window.addEventListener("storage",e=>{
  if(e.key===custKey){
    data=JSON.parse(e.newValue||"null")||seed;
    render();flashStats();
    toast("Data diperbarui otomatis dari tab lain");
  }
  else if(e.key===actKey){activity=JSON.parse(e.newValue||"[]");renderActivity(activity[0]&&activity[0].t)}
  else if(e.key==="kopiBatinAuthPing"){showAuth()}   // login/logout ikut tersinkron
});

/* Indikator koneksi */
function setOnline(){
  document.querySelectorAll(".live-box .live-dot").forEach(d=>d.classList.toggle("offline",!navigator.onLine));
  const b=document.querySelector(".live-box b"); if(b)b.textContent=navigator.onLine?"Live":"Offline";
}
window.addEventListener("online",setOnline);window.addEventListener("offline",setOnline);

tickClock();renderActivity();setOnline();
setInterval(tickClock,1000);
setInterval(()=>document.querySelectorAll(".act-time").forEach(el=>el.textContent=timeAgo(Number(el.dataset.ts))),15000);
