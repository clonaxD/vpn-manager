(() => {
const cfg=window.VPN_MANAGER_CONFIG||{};
const configured=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("PASTE_")&&!cfg.SUPABASE_ANON_KEY.includes("PASTE_");
const $=id=>document.getElementById(id);
if(!configured){$("setupWarning").classList.remove("hidden");return}

const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const BACKEND="https://80-90-179-65.sslip.io";
let session=null,clients=[],wgClients=[];

const labels={"trial":"Пробный — 24 часа","14d":"14 дней","1m":"1 месяц","2m":"2 месяца","6m":"6 месяцев","12m":"12 месяцев"};
const referralBonus={"1m":14,"6m":30,"12m":60};
const pad=n=>String(n).padStart(2,"0");
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const parse=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)};
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmt=s=>{if(!s)return"";const[y,m,d]=s.split("-");return `${d}.${m}.${y}`};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const days=s=>Math.round((parse(s)-parse(today()))/86400000);
const status=s=>days(s)<=0?["Истекла","expired"]:days(s)<=7?["Скоро","soon"]:["Активна","active"];

function addPeriod(start,p){
  const d=parse(start);
  if(p==="trial"){d.setDate(d.getDate()+1);return iso(d)}
  if(p==="14d"){d.setDate(d.getDate()+14);return iso(d)}
  const map={"1m":1,"2m":2,"6m":6,"12m":12};
  if(!(p in map))throw new Error("Неизвестный тариф: "+p);
  const day=d.getDate(),mm=map[p];
  d.setDate(1);d.setMonth(d.getMonth()+mm);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));return iso(d)
}
function addDaysToDate(s,n){const d=parse(s);d.setDate(d.getDate()+n);return iso(d)}
function msg(t="",bad=false){$("message").textContent=t;$("message").style.color=bad?"var(--red)":"var(--green)"}

async function api(path,opts={}){
  const {data}=await sb.auth.getSession();
  const token=data.session?.access_token;
  if(!token)throw new Error("Нет активной сессии");
  const headers={...(opts.headers||{}),Authorization:`Bearer ${token}`};
  if(opts.body && typeof opts.body==="string")headers["Content-Type"]="application/json";
  const r=await fetch(BACKEND+path,{...opts,headers});
  if(!r.ok){
    let detail="";
    try{detail=(await r.json()).error||""}catch{}
    throw new Error(detail||`Backend HTTP ${r.status}`);
  }
  return r;
}
async function apiJson(path,opts={}){return (await api(path,opts)).json()}

function fillReferrers(){
  const sel=$("referrer"),cur=sel.value;
  sel.innerHTML='<option value="">Никто / не указан</option>'+clients.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"","ru")).map(c=>`<option value="${c.id}">${esc(c.name)}${c.phone?` — ${esc(c.phone)}`:""}</option>`).join("");
  if([...sel.options].some(o=>o.value===cur))sel.value=cur;
}
function updateReferralHint(){
  const bonus=referralBonus[$("period").value]||0,who=$("referrer").value;
  $("referralHint").textContent=who?(bonus?`Пригласившему будет начислено +${bonus} дней.`:"Для этого тарифа бонус не начисляется."):"";
}
function preview(){const s=$("startDate").value;if(s)$("preview").textContent="Подписка до: "+fmt(addPeriod(s,$("period").value))}
function wgFor(c){return c.wg_client_id?wgClients.find(w=>w.id===c.wg_client_id):null}
function linkOptions(){
  const used=new Set(clients.map(c=>c.wg_client_id).filter(Boolean));
  return '<option value="">Выбрать существующий VPN</option>'+wgClients.filter(w=>!used.has(w.id)).map(w=>`<option value="${w.id}">${esc(w.name)} — ${esc(w.address||"")}</option>`).join("");
}
async function loadWG(){
  try{const x=await apiJson("/api/wg/clients");wgClients=x.clients||[]}
  catch(e){wgClients=[];msg("WireGuard недоступен: "+e.message,true)}
}
async function load(){
  const {data,error}=await sb.from("clients").select("*").order("end_date",{ascending:true});
  if(error)return msg(error.message,true);
  clients=data||[];fillReferrers();await loadWG();render();
}
function renderStats(){
  let a=0,s=0,e=0;
  clients.forEach(c=>{const d=days(c.end_date);if(d<=0)e++;else{a++;if(d<=7)s++}});
  $("sTotal").textContent=clients.length;$("sActive").textContent=a;$("sSoon").textContent=s;$("sExpired").textContent=e;
}
function filtered(){
  const q=$("search").value.trim().toLowerCase();
  return q?clients.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.phone||"").toLowerCase().includes(q)||(c.note||"").toLowerCase().includes(q)):clients;
}
function wgStatus(c){
  if(!c.wg_client_id)return '<span class="wg-status none">Не привязан</span>';
  const w=wgFor(c);
  if(!w)return '<span class="wg-status off">Не найден</span>';
  return `<span class="wg-status ${w.enabled?"on":"off"}">${w.enabled?"Включён":"Отключён"}</span>${w.address?`<small>${esc(w.address)}</small>`:""}`;
}
function wgControls(c){
  if(!c.wg_client_id){
    return `<div class="wg-controls"><button data-a="wg-create" data-id="${c.id}">Создать VPN</button><select data-link="${c.id}">${linkOptions()}</select><button class="secondary" data-a="wg-link" data-id="${c.id}">Привязать</button></div>`;
  }
  const w=wgFor(c);
  if(!w)return `<div class="wg-controls"><button class="secondary" data-a="wg-unlink" data-id="${c.id}">Сбросить привязку</button></div>`;
  return `<div class="wg-controls">
    <button data-a="${w.enabled?"wg-disable":"wg-enable"}" data-id="${c.id}">${w.enabled?"Отключить VPN":"Включить VPN"}</button>
    <div class="share-row">
      <button class="secondary" data-a="wg-qr" data-id="${c.id}">QR</button>
      <button class="secondary" data-a="wg-config" data-id="${c.id}">Конфиг</button>
    </div>
    <div class="share-row">
      <button class="secondary" data-a="wg-share-qr" data-id="${c.id}">Отправить QR</button>
      <button class="secondary" data-a="wg-share-config" data-id="${c.id}">Отправить config</button>
    </div>
  </div>`;
}
function subControls(c){
  return `<select data-sel="${c.id}"><option value="trial">24 часа</option><option value="14d">14 дней</option><option value="1m">1 месяц</option><option value="2m">2 месяца</option><option value="6m">6 месяцев</option><option value="12m">12 месяцев</option></select><button data-a="extend" data-id="${c.id}">Продлить</button><button class="secondary" data-a="edit" data-id="${c.id}">Изменить</button><button class="danger" data-a="delete" data-id="${c.id}">Удалить</button>`;
}
function render(){
  renderStats();const list=filtered();$("empty").classList.toggle("hidden",list.length>0);
  $("rows").innerHTML=list.map(c=>{const[st,cl]=status(c.end_date);return `<tr>
    <td><b>${esc(c.name)}</b>${c.note?`<small>${esc(c.note)}</small>`:""}</td>
    <td>${esc(c.phone||"")}</td>
    <td>${esc((clients.find(x=>x.id===c.referrer_id)||{}).name||"—")}</td>
    <td>${wgStatus(c)}${wgControls(c)}</td>
    <td>${esc(labels[c.period]||c.period||"—")}</td>
    <td>${fmt(c.start_date)}</td><td>${fmt(c.end_date)}</td><td>${days(c.end_date)}</td>
    <td><span class="status ${cl}">${st}</span></td>
    <td><div class="actions">${subControls(c)}</div></td>
  </tr>`}).join("");
  $("cards").innerHTML=list.map(c=>{const[st,cl]=status(c.end_date);return `<article class="card">
    <div class="card-top"><div><h3>${esc(c.name)}</h3>${c.phone?`<a class="phone" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:""}</div><span class="status ${cl}">${st}</span></div>
    <div class="info"><div><small>Тариф</small><b>${esc(labels[c.period]||c.period||"—")}</b></div><div><small>До</small><b>${fmt(c.end_date)}</b></div><div><small>Осталось</small><b>${days(c.end_date)} дн.</b></div></div>
    ${c.referrer_id?`<div class="note">Пригласил: <b>${esc((clients.find(x=>x.id===c.referrer_id)||{}).name||"—")}</b></div>`:""}
    ${c.note?`<div class="note">${esc(c.note)}</div>`:""}
    <div class="note"><b>WireGuard:</b> ${wgStatus(c)}${wgControls(c)}</div>
    <details class="manage"><summary>Управление подпиской</summary><div class="manage-body">${subControls(c)}</div></details>
  </article>`}).join("");
}

async function shareBlob(blob,filename,title){
  const file=new File([blob],filename,{type:blob.type||"application/octet-stream"});
  if(navigator.canShare && navigator.canShare({files:[file]}) && navigator.share){
    await navigator.share({title,files:[file]});
    return;
  }
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  msg("Системная отправка файлов недоступна — файл скачан.");
}

$("addForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const start=$("startDate").value,p=$("period").value,referrerId=$("referrer").value?Number($("referrer").value):null;
  let wgClientId=null;
  try{
    if($("createVpn").checked){
      const x=await apiJson("/api/wg/client",{method:"POST",body:JSON.stringify({name:$("name").value.trim()})});
      wgClientId=x.client?.id||null;
      if(!wgClientId)throw new Error("Не получен ID WireGuard");
    }
    const payload={user_id:session.user.id,name:$("name").value.trim(),phone:$("phone").value.trim(),start_date:start,end_date:addPeriod(start,p),period:p,note:$("note").value.trim(),referrer_id:referrerId,wg_client_id:wgClientId};
    const {error}=await sb.from("clients").insert(payload);if(error)throw error;

    const bonus=referralBonus[p]||0;
    if(referrerId&&bonus>0){
      const ref=clients.find(x=>x.id===referrerId);
      if(ref){
        const base=days(ref.end_date)>0?ref.end_date:today();
        await sb.from("clients").update({end_date:addDaysToDate(base,bonus)}).eq("id",referrerId);
        if(ref.wg_client_id){try{await api(`/api/wg/client/${ref.wg_client_id}/enable`,{method:"POST"})}catch{}}
      }
    }
    e.target.reset();$("startDate").value=today();$("period").value="1m";$("createVpn").checked=true;preview();updateReferralHint();msg("Клиент добавлен");await load();
  }catch(err){msg("Ошибка добавления: "+err.message,true)}
});

document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-a]");if(!b)return;
  const id=Number(b.dataset.id),c=clients.find(x=>x.id===id);if(!c)return;
  try{
    const a=b.dataset.a;
    if(a==="delete"){
      if(!confirm(`Удалить клиента «${c.name}» из CRM? WireGuard-профиль останется.`))return;
      const{error}=await sb.from("clients").delete().eq("id",id);if(error)throw error;msg("Клиент удалён из CRM");return load();
    }
    if(a==="edit"){
      $("editId").value=c.id;$("editName").value=c.name||"";$("editPhone").value=c.phone||"";$("editStart").value=c.start_date;$("editDaysLeft").value=Math.max(0,days(c.end_date));$("editNote").value=c.note||"";$("editDialog").showModal();return;
    }
    if(a==="extend"){
      const scope=b.closest(".actions,.manage-body"),sel=scope.querySelector(`[data-sel="${id}"]`),p=sel.value;
      const base=days(c.end_date)>0?c.end_date:today(),newEnd=addPeriod(base,p);
      const{error}=await sb.from("clients").update({end_date:newEnd,period:p}).eq("id",id);if(error)throw error;
      if(c.wg_client_id)await api(`/api/wg/client/${c.wg_client_id}/enable`,{method:"POST"});
      msg("Подписка продлена, VPN включён");return load();
    }
    if(a==="wg-create"){
      const x=await apiJson("/api/wg/client",{method:"POST",body:JSON.stringify({name:c.name})});
      const wid=x.client?.id;if(!wid)throw new Error("Не получен ID WireGuard");
      const{error}=await sb.from("clients").update({wg_client_id:wid}).eq("id",id);if(error)throw error;msg("WireGuard создан");return load();
    }
    if(a==="wg-link"){
      const sel=document.querySelector(`[data-link="${id}"]`),wid=sel?.value;if(!wid)throw new Error("Выбери WireGuard-клиента");
      const{error}=await sb.from("clients").update({wg_client_id:wid}).eq("id",id);if(error)throw error;msg("WireGuard привязан");return load();
    }
    if(a==="wg-unlink"){
      const{error}=await sb.from("clients").update({wg_client_id:null}).eq("id",id);if(error)throw error;msg("Привязка сброшена");return load();
    }
    if(a==="wg-enable"||a==="wg-disable"){
      await api(`/api/wg/client/${c.wg_client_id}/${a==="wg-enable"?"enable":"disable"}`,{method:"POST"});msg(a==="wg-enable"?"VPN включён":"VPN отключён");return load();
    }
    if(a==="wg-qr"||a==="wg-share-qr"){
      const r=await api(`/api/wg/client/${c.wg_client_id}/qr`),blob=await r.blob();
      if(a==="wg-share-qr")return shareBlob(blob,`${c.name||"client"}-qr.svg`,`WireGuard QR — ${c.name}`);
      const url=URL.createObjectURL(blob);window.open(url,"_blank");setTimeout(()=>URL.revokeObjectURL(url),60000);return;
    }
    if(a==="wg-config"||a==="wg-share-config"){
      const r=await api(`/api/wg/client/${c.wg_client_id}/config`),blob=await r.blob();
      if(a==="wg-share-config")return shareBlob(blob,`${c.name||"wireguard"}.conf`,`WireGuard config — ${c.name}`);
      const url=URL.createObjectURL(blob),ln=document.createElement("a");ln.href=url;ln.download=`${c.name||"wireguard"}.conf`;ln.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return;
    }
  }catch(err){msg(err.message,true)}
});

$("editForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=Number($("editId").value),c=clients.find(x=>x.id===id),left=Math.max(0,parseInt($("editDaysLeft").value||"0",10)),end=parse(today());
  end.setDate(end.getDate()+left);
  const{error}=await sb.from("clients").update({name:$("editName").value.trim(),phone:$("editPhone").value.trim(),start_date:$("editStart").value,end_date:iso(end),note:$("editNote").value.trim()}).eq("id",id);
  if(error)return msg(error.message,true);
  try{if(c?.wg_client_id){await api(`/api/wg/client/${c.wg_client_id}/${left<=0?"disable":"enable"}`,{method:"POST"})}}catch{}
  $("editDialog").close();msg("Изменения сохранены");load();
});

$("closeEdit").onclick=()=>$("editDialog").close();$("search").oninput=render;$("refreshBtn").onclick=load;$("startDate").onchange=preview;$("period").onchange=()=>{preview();updateReferralHint()};$("referrer").onchange=updateReferralHint;$("logoutBtn").onclick=()=>sb.auth.signOut();
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const{error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("authMessage").textContent=error?("Ошибка входа: "+error.message):""});
sb.auth.onAuthStateChange(async(_e,s)=>{session=s;const yes=!!s;$("authScreen").classList.toggle("hidden",yes);$("app").classList.toggle("hidden",!yes);if(yes){$("startDate").value=today();$("period").value="1m";preview();await load();updateReferralHint()}});
(async()=>{const{data}=await sb.auth.getSession();session=data.session;const yes=!!session;$("authScreen").classList.toggle("hidden",yes);$("app").classList.toggle("hidden",!yes);if(yes){$("startDate").value=today();$("period").value="1m";preview();await load();updateReferralHint()}})();
})();