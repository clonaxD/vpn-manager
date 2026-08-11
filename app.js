(() => {
const cfg=window.VPN_MANAGER_CONFIG||{};
const ok=cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("PASTE_")&&!cfg.SUPABASE_ANON_KEY.includes("PASTE_");
const $=id=>document.getElementById(id);
if(!ok){$("setupWarning").classList.remove("hidden");return}
const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let session=null,clients=[];
const labels={"14d":"14 дней","1m":"1 месяц","2m":"2 месяца","6m":"6 месяцев","12m":"12 месяцев"};
const pad=n=>String(n).padStart(2,"0");
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)};
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmt=s=>{if(!s)return"";const[y,m,d]=s.split("-");return `${d}.${m}.${y}`};
function addPeriod(start,p){const d=parse(start);if(p==="14d"){d.setDate(d.getDate()+14);return iso(d)}const mm={"1m":1,"2m":2,"6m":6,"12m":12}[p]||1,day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+mm);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return iso(d)}
const days=s=>Math.round((parse(s)-parse(today()))/86400000);
const status=s=>days(s)<0?["Истекла","expired"]:days(s)<=7?["Скоро","soon"]:["Активна","active"];
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const options=()=>`<option value="14d">14 дней</option><option value="1m">1 месяц</option><option value="2m">2 месяца</option><option value="6m">6 месяцев</option><option value="12m">12 месяцев</option>`;
function msg(t="",bad=false){$("message").textContent=t;$("message").style.color=bad?"var(--r)":"var(--g)"}
async function load(){const{data,error}=await sb.from("clients").select("*").order("end_date",{ascending:true});if(error)return msg(error.message,true);clients=data||[];render()}
function renderStats(){let a=0,s=0,e=0;clients.forEach(c=>{const d=days(c.end_date);if(d<0)e++;else{a++;if(d<=7)s++}});$("sTotal").textContent=clients.length;$("sActive").textContent=a;$("sSoon").textContent=s;$("sExpired").textContent=e}
function filtered(){const q=$("search").value.trim().toLowerCase();return q?clients.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.phone||"").toLowerCase().includes(q)||(c.note||"").toLowerCase().includes(q)):clients}
function render(){renderStats();const list=filtered();$("empty").classList.toggle("hidden",list.length>0);
$("rows").innerHTML=list.map(c=>{const[st,cl]=status(c.end_date);return `<tr><td><b>${esc(c.name)}</b>${c.note?`<small>${esc(c.note)}</small>`:""}</td><td>${esc(c.phone)}</td><td>${esc(labels[c.period]||c.period)}</td><td>${fmt(c.start_date)}</td><td>${fmt(c.end_date)}</td><td>${days(c.end_date)}</td><td><span class="status ${cl}">${st}</span></td><td><div class="actions"><select data-sel="${c.id}">${options()}</select><button data-a="extend" data-id="${c.id}">Продлить</button><button class="secondary" data-a="edit" data-id="${c.id}">Изменить</button><button class="danger" data-a="delete" data-id="${c.id}">Удалить</button></div></td></tr>`}).join("");
$("cards").innerHTML=list.map(c=>{const[st,cl]=status(c.end_date);return `<article class="card"><div class="card-top"><div><h3>${esc(c.name)}</h3>${c.phone?`<a class="phone" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:""}</div><span class="status ${cl}">${st}</span></div><div class="info"><div><small>Тариф</small><b>${esc(labels[c.period]||c.period)}</b></div><div><small>До</small><b>${fmt(c.end_date)}</b></div><div><small>Осталось</small><b>${days(c.end_date)} дн.</b></div></div>${c.note?`<div class="note">${esc(c.note)}</div>`:""}<details class="manage"><summary>Управление подпиской</summary><div class="manage-body"><select data-sel="${c.id}">${options()}</select><button data-a="extend" data-id="${c.id}">Продлить</button><button class="secondary" data-a="edit" data-id="${c.id}">Редактировать</button><button class="danger" data-a="delete" data-id="${c.id}">Удалить клиента</button></div></details></article>`}).join("")}
function preview(){const s=$("startDate").value;if(s)$("preview").textContent="Подписка до: "+fmt(addPeriod(s,$("period").value))}
$("addForm").addEventListener("submit",async e=>{e.preventDefault();const start=$("startDate").value,p=$("period").value;const payload={user_id:session.user.id,name:$("name").value.trim(),phone:$("phone").value.trim(),start_date:start,end_date:addPeriod(start,p),period:p,note:$("note").value.trim()};const{error}=await sb.from("clients").insert(payload);if(error)return msg(error.message,true);e.target.reset();$("startDate").value=today();$("period").value="1m";preview();msg("Клиент добавлен");load()});
document.addEventListener("click",async e=>{const b=e.target.closest("[data-a]");if(!b)return;const id=Number(b.dataset.id),c=clients.find(x=>x.id===id);if(!c)return;
if(b.dataset.a==="delete"){if(!confirm(`Удалить клиента «${c.name}»?`))return;const{error}=await sb.from("clients").delete().eq("id",id);if(error)return msg(error.message,true);msg("Клиент удалён");return load()}
if(b.dataset.a==="edit"){$("editId").value=c.id;$("editName").value=c.name||"";$("editPhone").value=c.phone||"";$("editStart").value=c.start_date;$("editNote").value=c.note||"";$("editDialog").showModal();return}
if(b.dataset.a==="extend"){const scope=b.closest(".actions,.manage-body"),sel=scope.querySelector(`[data-sel="${id}"]`),p=sel.value,base=parse(c.end_date)>=parse(today())?c.end_date:today(),newEnd=addPeriod(base,p);const{error}=await sb.from("clients").update({end_date:newEnd,period:p}).eq("id",id);if(error)return msg(error.message,true);msg("Подписка продлена");return load()}})
$("editForm").addEventListener("submit",async e=>{e.preventDefault();const id=Number($("editId").value);const{error}=await sb.from("clients").update({name:$("editName").value.trim(),phone:$("editPhone").value.trim(),start_date:$("editStart").value,note:$("editNote").value.trim()}).eq("id",id);if(error)return msg(error.message,true);$("editDialog").close();msg("Изменения сохранены");load()});
$("closeEdit").onclick=()=>$("editDialog").close();$("search").oninput=render;$("refreshBtn").onclick=load;$("startDate").onchange=preview;$("period").onchange=preview;$("logoutBtn").onclick=()=>sb.auth.signOut();
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const{error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("authMessage").textContent=error?("Ошибка входа: "+error.message):""});
sb.auth.onAuthStateChange(async(_e,s)=>{session=s;const yes=!!s;$("authScreen").classList.toggle("hidden",yes);$("app").classList.toggle("hidden",!yes);if(yes){$("startDate").value=today();preview();await load()}});
(async()=>{const{data}=await sb.auth.getSession();session=data.session;const yes=!!session;$("authScreen").classList.toggle("hidden",yes);$("app").classList.toggle("hidden",!yes);if(yes){$("startDate").value=today();preview();await load()}})();
})();