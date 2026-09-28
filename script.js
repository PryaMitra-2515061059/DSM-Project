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
function persist(){localStorage.setItem("kopiBatinCustomers",JSON.stringify(data))}
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
 if(id){let old=data.find(x=>x.id===id);obj.transactions=old.transactions;data=data.map(x=>x.id===id?obj:x);toast("Data pelanggan diperbarui")}
 else{data.unshift(obj);toast("Pelanggan berhasil ditambahkan")}
 persist();render();closeModal("customerModal")}
function openTransaction(id){trxCustomerId.value=id;product.value="";qty.value=1;amount.value="";trxDate.value=new Date().toISOString().slice(0,10);document.getElementById("transactionModal").classList.add("show")}
function saveTransaction(e){e.preventDefault();let c=data.find(x=>x.id===Number(trxCustomerId.value));c.transactions.push({date:trxDate.value,product:product.value.trim(),qty:Number(qty.value),amount:Number(amount.value)});persist();render();closeModal("transactionModal");toast("Transaksi berhasil dicatat")}
function detail(id){let c=data.find(x=>x.id===id),t=totals(c);document.getElementById("detailContent").innerHTML=`
<div class="detail-profile"><div class="big-avatar">${initials(c.name)}</div><div><h3>${c.name}</h3><p>${c.phone}${c.email?" · "+c.email:""}</p></div></div>
<div class="mini-stats"><div class="mini"><small>Kunjungan</small><b>${t.visits} kali</b></div><div class="mini"><small>Jumlah item</small><b>${t.items} item</b></div><div class="mini"><small>Total pembelian</small><b>${rupiah(t.spend)}</b></div></div>
<div class="history-title">Riwayat Pembelian</div>
${c.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="history-item"><div><b>${x.product}</b><small>${fmtDate(x.date)} · ${x.qty} item</small></div><b>${rupiah(x.amount)}</b></div>`).join("")||'<div class="empty">Belum ada riwayat pembelian.</div>'}`;
document.getElementById("detailModal").classList.add("show")}
function removeCustomer(id){let c=data.find(x=>x.id===id);if(confirm("Hapus data pelanggan "+c.name+"?")){data=data.filter(x=>x.id!==id);persist();render();toast("Data pelanggan dihapus")}}
function closeModal(id){document.getElementById(id).classList.remove("show")}
function resetFilter(){search.value="";sort.value="latest";render()}
function toast(msg){let el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function showComing(e,name){e.preventDefault();toast(name+" belum termasuk modul inti.")}
function exportCSV(){
 const rows=[["Nama","No WhatsApp","Kunjungan","Jumlah Pembelian","Total Pembelian","Terakhir Berkunjung"],...data.map(c=>{let t=totals(c);return[c.name,c.phone,t.visits,t.items,t.spend,t.last||""]})];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="data-pelanggan-kopi-batin.csv";a.click();URL.revokeObjectURL(a.href);toast("CSV berhasil diekspor")}

const authKey="kopiBatinMembers";
let members=JSON.parse(localStorage.getItem(authKey)||"null")||[
  {id:1,name:"Admin Kopi Batin",phone:"081234567890",email:"admin@kopibatin.id",password:"admin123"}
];
function persistMembers(){localStorage.setItem(authKey,JSON.stringify(members))}
function switchAuth(type){
  document.getElementById("loginTab").classList.toggle("active",type==="login");
  document.getElementById("registerTab").classList.toggle("active",type==="register");
  document.getElementById("loginForm").classList.toggle("active",type==="login");
  document.getElementById("registerForm").classList.toggle("active",type==="register");
}
function currentUser(){return JSON.parse(localStorage.getItem("kopiBatinCurrentUser")||"null")}

let resetState={email:"",code:"",expiresAt:0};

function showLogin(){
  switchAuth("login");
}
function showForgotPassword(){
  document.getElementById("loginTab").classList.remove("active");
  document.getElementById("registerTab").classList.remove("active");
  document.getElementById("loginForm").classList.remove("active");
  document.getElementById("registerForm").classList.remove("active");
  document.getElementById("forgotForm").classList.add("active");
  showForgotStep(1);
}
function showForgotStep(step){
  [1,2,3].forEach(n=>document.getElementById("resetStep"+n).classList.toggle("active",n===step));
  if(step!==2)document.getElementById("demoCode").style.display="none";
}
function requestReset(){
  const email=document.getElementById("resetEmail").value.trim().toLowerCase();
  if(!email){toast("Masukkan email terlebih dahulu");return}
  const member=members.find(x=>x.email.toLowerCase()===email);
  if(!member){toast("Email tidak ditemukan dalam data member");return}

  resetState.email=email;
  resetState.code=String(Math.floor(100000+Math.random()*900000));
  resetState.expiresAt=Date.now()+5*60*1000;

  document.getElementById("resetCode").value="";
  document.getElementById("demoCode").innerHTML="<b>Mode Prototype:</b> kode verifikasi simulasi adalah <strong>"+resetState.code+"</strong>. Pada sistem nyata, kode dikirim melalui email/WhatsApp.";
  document.getElementById("demoCode").style.display="block";
  showForgotStep(2);
  toast("Kode verifikasi berhasil dibuat");
}
function verifyResetCode(){
  const code=document.getElementById("resetCode").value.trim();
  if(Date.now()>resetState.expiresAt){toast("Kode sudah kedaluwarsa. Minta kode baru.");showForgotStep(1);return}
  if(code!==resetState.code){toast("Kode verifikasi salah");return}
  showForgotStep(3);
  toast("Kode terverifikasi");
}
function resetPassword(){
  const p1=document.getElementById("newPassword").value;
  const p2=document.getElementById("newPasswordConfirm").value;
  if(p1.length<6){toast("Password minimal 6 karakter");return}
  if(p1!==p2){toast("Konfirmasi password tidak cocok");return}
  const index=members.findIndex(x=>x.email.toLowerCase()===resetState.email);
  if(index<0){toast("Akun tidak ditemukan");return}
  members[index].password=p1;
  persistMembers();
  resetState={email:"",code:"",expiresAt:0};
  document.getElementById("newPassword").value="";
  document.getElementById("newPasswordConfirm").value="";
  document.getElementById("resetEmail").value="";
  document.getElementById("resetCode").value="";
  showLogin();
  toast("Password berhasil direset. Silakan login.");
}

function showAuth(){
  document.getElementById("authScreen").classList.toggle("hidden",!!currentUser());
  updateUserUI();
}
function updateUserUI(){
  const u=currentUser(); if(!u)return;
  document.getElementById("userName").textContent=u.name;
  document.getElementById("userAvatar").textContent=initials(u.name);
}
function login(e){
  e.preventDefault();
  const email=document.getElementById("loginEmail").value.trim().toLowerCase();
  const password=document.getElementById("loginPassword").value;
  const u=members.find(x=>x.email.toLowerCase()===email && x.password===password);
  if(!u){toast("Email atau password salah");return}
  localStorage.setItem("kopiBatinCurrentUser",JSON.stringify({id:u.id,name:u.name,email:u.email,phone:u.phone}));
  document.getElementById("loginForm").reset();
  showAuth(); toast("Login berhasil. Selamat datang, "+u.name);
}
function register(e){
  e.preventDefault();
  const name=document.getElementById("regName").value.trim();
  const phone=document.getElementById("regPhone").value.trim();
  const email=document.getElementById("regEmail").value.trim().toLowerCase();
  const password=document.getElementById("regPassword").value;
  const confirm=document.getElementById("regConfirm").value;
  if(password!==confirm){toast("Konfirmasi password tidak cocok");return}
  if(members.some(x=>x.email.toLowerCase()===email)){toast("Email sudah terdaftar. Silakan login.");switchAuth("login");return}
  const u={id:Date.now(),name,phone,email,password};
  members.push(u);persistMembers();
  localStorage.setItem("kopiBatinCurrentUser",JSON.stringify({id:u.id,name:u.name,email:u.email,phone:u.phone}));
  document.getElementById("registerForm").reset();
  showAuth(); toast("Akun berhasil dibuat. Selamat datang, "+name);
}
function logout(){
  localStorage.removeItem("kopiBatinCurrentUser");
  switchAuth("login");
  document.getElementById("authScreen").classList.remove("hidden");
  toast("Anda telah keluar dari akun");
}
showAuth();

render();
