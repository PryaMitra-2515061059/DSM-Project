/* ============================================================
   riwayat.js — Modul RIWAYAT PEMBELIAN (admin)
   Butuh pelanggan.js dan pengaturan.js (data, $, rupiah, fmtDate, esc, todayWIB, addDays,
   csvCell, toast, loadCustomers, detail).
   ============================================================ */
/* ================= RIWAYAT PEMBELIAN (admin) =================
   Daftar semua transaksi dari semua pelanggan. Dihitung di browser dari
   "data" yang sudah dimuat loadCustomers(), jadi tidak ada query baru dan
   otomatis ikut real-time (loadCustomers() memanggil renderRiwayat()). */
// Jumlah baris per halaman diatur di menu Pengaturan (getSetting di pengaturan.js).
const riPageSize=()=>(typeof getSetting==="function"&&Number(getSetting("riPageSize")))||20;
let riPage=1;

function riRange(){
  const p=$("riPeriod").value, today=todayWIB();
  if(p==="today")return {from:today,to:today};
  if(p==="7d")return {from:addDays(today,-6),to:today};
  if(p==="30d")return {from:addDays(today,-29),to:today};
  if(p==="month")return {from:today.slice(0,7)+"-01",to:today};
  if(p==="custom"){
    let f=$("riFrom").value||null, t=$("riTo").value||null;
    if(f&&t&&f>t)[f,t]=[t,f];
    return {from:f,to:t};
  }
  return {from:null,to:null};
}

function riFiltered(){
  const q=$("riSearch").value.trim().toLowerCase(), prod=$("riProduct").value, r=riRange(), s=$("riSort").value;
  const arr=data.flatMap(c=>c.transactions.map(t=>({...t,customerId:c.id,customerName:c.name,customerPhone:c.phone})))
    .filter(t=>(!r.from||t.date>=r.from)&&(!r.to||t.date<=r.to)&&(!prod||t.product===prod)
      &&(!q||(t.customerName+" "+t.customerPhone+" "+t.product).toLowerCase().includes(q)));
  arr.sort((a,b)=>{
    if(s==="oldest")return a.date.localeCompare(b.date);
    if(s==="high")return Number(b.amount)-Number(a.amount);
    if(s==="low")return Number(a.amount)-Number(b.amount);
    return b.date.localeCompare(a.date);
  });
  return arr;
}

function riFillProducts(){
  const sel=$("riProduct"), cur=sel.value;
  const names=[...new Set(data.flatMap(c=>c.transactions.map(t=>t.product)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  sel.innerHTML='<option value="">Semua produk</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  sel.value=names.includes(cur)?cur:"";
}

function renderRiwayat(){
  riFillProducts();
  const arr=riFiltered();
  const total=arr.reduce((a,t)=>a+Number(t.amount),0);
  $("riCount").textContent=arr.length;
  $("riItems").textContent=arr.reduce((a,t)=>a+Number(t.qty),0);
  $("riTotal").textContent=rupiah(total);
  $("riAvg").textContent=rupiah(arr.length?Math.round(total/arr.length):0);

  const pages=Math.max(1,Math.ceil(arr.length/riPageSize()));
  riPage=Math.min(Math.max(1,riPage),pages);
  const size=riPageSize(), start=(riPage-1)*size, shown=arr.slice(start,start+size);
  const filtering=$("riSearch").value||$("riProduct").value||$("riPeriod").value!=="all";

  $("riBody").innerHTML=shown.length?shown.map(t=>`<tr>
    <td>${fmtDate(t.date)}</td>
    <td><div class="name">${esc(t.customerName)}</div><div class="phone">${esc(t.customerPhone)}</div></td>
    <td>${esc(t.product)}</td><td>${Number(t.qty)} item</td><td class="money">${rupiah(t.amount)}</td>
    <td><div class="actions"><button class="icon-btn" title="Detail pelanggan" onclick="detail('${t.customerId}')">◉</button><button class="icon-btn" title="Hapus transaksi" onclick="removeTransaction('${t.id}')">⌫</button></div></td>
  </tr>`).join(""):`<tr><td colspan="6"><div class="empty">${filtering?"Tidak ada transaksi yang cocok. Ubah atau reset filter.":"Belum ada transaksi. Catat pembelian dari menu Data Pelanggan."}</div></td></tr>`;

  $("riPagerInfo").textContent=arr.length?`Menampilkan ${start+1}–${start+shown.length} dari ${arr.length} transaksi`:"";
  $("riPrev").disabled=riPage<=1;
  $("riNext").disabled=riPage>=pages;
}

function riChanged(){riPage=1;renderRiwayat()}
function riGo(d){riPage+=d;renderRiwayat()}
function onRiPeriodChange(){
  const custom=$("riPeriod").value==="custom";
  $("riCustomRange").classList.toggle("hidden",!custom);
  if(custom&&!$("riFrom").value&&!$("riTo").value){const t=todayWIB();$("riFrom").value=addDays(t,-29);$("riTo").value=t}
  riChanged();
}
function resetRiwayatFilter(){
  $("riSearch").value="";$("riPeriod").value="all";$("riProduct").value="";$("riSort").value="latest";
  $("riFrom").value="";$("riTo").value="";$("riCustomRange").classList.add("hidden");
  riChanged();
}

async function removeTransaction(id){
  const t=data.flatMap(c=>c.transactions.map(x=>({...x,customerName:c.name}))).find(x=>String(x.id)===String(id));
  if(!t)return;
  if(!confirm("Hapus transaksi "+t.product+" ("+fmtDate(t.date)+", "+rupiah(t.amount)+") milik "+t.customerName+"? Tindakan ini tidak bisa dibatalkan."))return;
  try{
    const {data:rows,error}=await supabaseClient.from("transactions").delete().eq("id",id).select("id");
    if(error)throw error;
    if(!rows||!rows.length)throw new Error("tidak ada baris yang terhapus (cek izin/RLS tabel transactions)");
    toast("Transaksi dihapus");
    await loadCustomers();
  }catch(err){toast("Gagal menghapus transaksi: "+err.message)}
}

// Mengekspor SEMUA hasil filter (bukan hanya halaman yang tampil).
function exportRiwayatCSV(){
  const arr=riFiltered();
  if(!arr.length){toast("Tidak ada transaksi untuk diekspor");return}
  const rows=[["Tanggal","Pelanggan","No WhatsApp","Produk","Jumlah","Total"],
    ...arr.map(t=>[t.date,t.customerName,t.customerPhone,t.product,Number(t.qty),Number(t.amount)])];
  const csv="\ufeff"+rows.map(r=>r.map(csvCell).join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download="riwayat-pembelian-kopi-batin-"+todayWIB()+".csv";
  a.click();URL.revokeObjectURL(a.href);
  toast("Riwayat pembelian diekspor ("+arr.length+" transaksi)");
}