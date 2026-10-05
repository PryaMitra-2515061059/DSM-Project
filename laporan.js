/* ============================================================
   laporan.js — Modul LAPORAN (admin)
   Butuh pelanggan.js (data, $, rupiah, fmtDate, esc, todayWIB, addDays,
   daysBetween, addMonths, csvCell, toast).
   ============================================================ */
/* ================= LAPORAN (admin) =================
   Dihitung di browser dari "data" yang sudah dimuat loadCustomers() --
   tidak ada query baru ke Supabase, jadi langsung ikut live tiap kali
   data berubah (lihat pemanggilan renderLaporan() di loadCustomers()). */
// Rentang tanggal sesuai pilihan periode. null = tanpa batas.
function getReportRange(){
  const p=$("lapPeriod").value, today=todayWIB();
  if(p==="today")return {from:today,to:today};
  if(p==="7d")return {from:addDays(today,-6),to:today};
  if(p==="30d")return {from:addDays(today,-29),to:today};
  if(p==="month")return {from:today.slice(0,7)+"-01",to:today};
  if(p==="custom"){
    let f=$("lapFrom").value||null, t=$("lapTo").value||null;
    if(f&&t&&f>t)[f,t]=[t,f];
    return {from:f,to:t};
  }
  return {from:null,to:null};
}

function periodLabel(r){
  if(!r.from&&!r.to)return "Semua waktu";
  if(r.from&&r.to)return r.from===r.to?fmtDate(r.from):fmtDate(r.from)+" – "+fmtDate(r.to);
  return r.from?"Sejak "+fmtDate(r.from):"Sampai "+fmtDate(r.to);
}

function aggregateReport(){
  const range=getReportRange();
  const allTrx=data.flatMap(c=>c.transactions.map(t=>({...t,customerId:c.id,customerName:c.name})))
    .filter(t=>(!range.from||t.date>=range.from)&&(!range.to||t.date<=range.to))
    .sort((a,b)=>b.date.localeCompare(a.date));
  const totalRevenue=allTrx.reduce((a,t)=>a+Number(t.amount),0);
  const totalTrx=allTrx.length;
  const avgTrx=totalTrx?totalRevenue/totalTrx:0;

  const byProduct={};
  allTrx.forEach(t=>{
    const k=t.product||"(tanpa nama)";
    byProduct[k]=byProduct[k]||{qty:0,revenue:0};
    byProduct[k].qty+=Number(t.qty);
    byProduct[k].revenue+=Number(t.amount);
  });
  const topProducts=Object.entries(byProduct)
    .map(([name,v])=>({name,...v}))
    .sort((a,b)=>b.revenue-a.revenue).slice(0,5);

  const byCustomer={};
  allTrx.forEach(t=>{
    const o=byCustomer[t.customerId]=byCustomer[t.customerId]||{name:t.customerName,spend:0,visits:0};
    o.spend+=Number(t.amount);o.visits+=1;
  });
  const activeCustomers=Object.keys(byCustomer).length;
  const topCustomers=Object.values(byCustomer).sort((a,b)=>b.spend-a.spend).slice(0,5);

  return {range,allTrx,totalRevenue,totalTrx,avgTrx,topProducts,topCustomers,activeCustomers};
}

// Pendapatan per hari (rentang <= 31 hari) atau per bulan (lebih panjang).
function buildTrend(r){
  if(!r.allTrx.length)return {mode:"day",points:[]};
  const dates=r.allTrx.map(t=>t.date);
  const from=r.range.from||dates[dates.length-1];   // allTrx urut terbaru -> terlama
  const to=r.range.to||dates[0];
  const mode=daysBetween(from,to)<=30?"day":"month";
  const sums={};
  r.allTrx.forEach(t=>{const k=mode==="day"?t.date:t.date.slice(0,7);sums[k]=(sums[k]||0)+Number(t.amount)});
  const points=[];
  if(mode==="day"){for(let d=from;d<=to;d=addDays(d,1))points.push({key:d,value:sums[d]||0})}
  else{for(let m=from.slice(0,7);m<=to.slice(0,7);m=addMonths(m,1))points.push({key:m,value:sums[m]||0})}
  return {mode,points};
}

function barRow(label,sub,value,max,valueText){
  const pct=max>0?Math.max(2,Math.round(value/max*100)):0;
  return `<div class="bar-row">
    <div class="bar-label">${esc(label)}<small>${esc(sub)}</small></div>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    <div class="bar-value">${valueText}</div>
  </div>`;
}

function renderTrend(r){
  const {mode,points}=buildTrend(r);
  $("lapTrendTitle").textContent="Tren Pendapatan "+(mode==="day"?"Harian":"Bulanan");
  const box=$("lapTrend");
  if(!points.length){box.innerHTML='<div class="empty">Belum ada transaksi pada periode ini.</div>';return}
  const max=Math.max(...points.map(p=>p.value));
  const step=Math.ceil(points.length/10);
  const monthName=(k,o)=>new Date(k+"-01T00:00:00").toLocaleDateString("id-ID",o);
  box.innerHTML=points.map((p,i)=>{
    const pct=max>0?Math.round(p.value/max*100):0;
    const title=(mode==="day"?fmtDate(p.key):monthName(p.key,{month:"long",year:"numeric"}))+": "+rupiah(p.value);
    const label=i%step===0?(mode==="day"?p.key.slice(8):monthName(p.key,{month:"short",year:"2-digit"})):"";
    return `<div class="trend-col" title="${esc(title)}"><div class="trend-barwrap"><div class="trend-bar" style="height:${p.value?Math.max(3,pct):0}%"></div></div><div class="trend-lbl">${esc(label)}</div></div>`;
  }).join("");
}

const LAP_DETAIL_LIMIT=100;
function renderLaporan(){
  const r=aggregateReport();
  $("lapPeriodLabel").textContent="Periode: "+periodLabel(r.range);
  $("lapRevenue").textContent=rupiah(r.totalRevenue);
  $("lapTrx").textContent=r.totalTrx;
  $("lapAvg").textContent=rupiah(Math.round(r.avgTrx));
  $("lapCustomers").textContent=r.activeCustomers;
  $("lapCustomersSub").textContent="dari "+data.length+" pelanggan";

  renderTrend(r);

  const maxProductRevenue=Math.max(0,...r.topProducts.map(p=>p.revenue));
  $("lapTopProducts").innerHTML=r.topProducts.length
    ?r.topProducts.map(p=>barRow(p.name,p.qty+" terjual",p.revenue,maxProductRevenue,rupiah(p.revenue))).join("")
    :'<div class="empty">Belum ada transaksi pada periode ini.</div>';

  const maxCustomerSpend=Math.max(0,...r.topCustomers.map(c=>c.spend));
  $("lapTopCustomers").innerHTML=r.topCustomers.length
    ?r.topCustomers.map(c=>barRow(c.name,c.visits+" transaksi",c.spend,maxCustomerSpend,rupiah(c.spend))).join("")
    :'<div class="empty">Belum ada pembelian pada periode ini.</div>';

  const shown=r.allTrx.slice(0,LAP_DETAIL_LIMIT);
  $("lapTrxBody").innerHTML=shown.length
    ?shown.map(t=>`<tr><td>${fmtDate(t.date)}</td><td class="name">${esc(t.customerName)}</td><td>${esc(t.product)}</td><td>${Number(t.qty)} item</td><td class="money">${rupiah(t.amount)}</td></tr>`).join("")
    :'<tr><td colspan="5"><div class="empty">Tidak ada transaksi pada periode ini.</div></td></tr>';
  $("lapDetailNote").textContent=r.allTrx.length>LAP_DETAIL_LIMIT
    ?"Menampilkan "+LAP_DETAIL_LIMIT+" terbaru dari "+r.allTrx.length+" (semua ikut di CSV)"
    :(r.allTrx.length?r.allTrx.length+" transaksi":"");
}

function onLaporanPeriodChange(){
  const custom=$("lapPeriod").value==="custom";
  $("lapCustomRange").classList.toggle("hidden",!custom);
  if(custom&&!$("lapFrom").value&&!$("lapTo").value){
    const today=todayWIB();$("lapFrom").value=addDays(today,-29);$("lapTo").value=today;
  }
  renderLaporan();
}

function exportLaporanCSV(){
  const r=aggregateReport();
  const rows=[
    ["Laporan Kopi Batin"],
    ["Periode",periodLabel(r.range)],
    [],
    ["Ringkasan"],
    ["Total Pendapatan",r.totalRevenue],
    ["Total Transaksi",r.totalTrx],
    ["Rata-rata per Transaksi",Math.round(r.avgTrx)],
    ["Pelanggan Aktif",r.activeCustomers],
    ["Total Pelanggan",data.length],
    [],
    ["Produk Terlaris","Jumlah Terjual","Pendapatan"],
    ...r.topProducts.map(p=>[p.name,p.qty,p.revenue]),
    [],
    ["Pelanggan Terbesar","Transaksi","Total Belanja"],
    ...r.topCustomers.map(c=>[c.name,c.visits,c.spend]),
    [],
    ["Rincian Transaksi"],
    ["Tanggal","Pelanggan","Produk","Jumlah","Total"],
    ...r.allTrx.map(t=>[t.date,t.customerName,t.product,Number(t.qty),Number(t.amount)]),
  ];
  const csv="\ufeff"+rows.map(row=>row.map(csvCell).join(",")).join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download="laporan-kopi-batin-"+todayWIB()+".csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Laporan CSV berhasil diekspor");
}
