export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  ADMIN_PASSWORD: string;
  WEBHOOK_SECRET: string;
  MAIL_API: string;
}

const TG = (method:string) => `https://api.telegram.org/bot${ENV_TOKEN}/${method}`;
let ENV_TOKEN = "";

async function tg(method:string, body:any) {
  const r = await fetch(TG(method), {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body)
  });
  return r.json();
}

async function getSetting(env:Env, key:string, fallback="") {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<any>();
  return r?.value ?? fallback;
}
async function getText(env:Env, key:string, fallback="") {
  const r = await env.DB.prepare("SELECT value FROM texts WHERE key=?").bind(key).first<any>();
  return r?.value ?? fallback;
}
function esc(s:string){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function now(){return new Date();}
function expiry(hours:number){return new Date(Date.now()+hours*3600*1000).toISOString();}
function randomCode(){return crypto.randomUUID().replaceAll("-","").slice(0,10);}
function keyboard(rows:any[][]){return {inline_keyboard:rows};}

async function user(env:Env, tgId:string, info:any={}) {
  let u = await env.DB.prepare("SELECT * FROM users WHERE tg_id=?").bind(tgId).first<any>();
  if(!u){
    const code=randomCode();
    await env.DB.prepare("INSERT INTO users(tg_id,username,first_name,ref_code) VALUES(?,?,?,?)")
      .bind(tgId,info.username||"",info.first_name||"",code).run();
    u=await env.DB.prepare("SELECT * FROM users WHERE tg_id=?").bind(tgId).first<any>();
  } else {
    await env.DB.prepare("UPDATE users SET username=?,first_name=? WHERE tg_id=?")
      .bind(info.username??u.username,info.first_name??u.first_name,tgId).run();
  }
  return u;
}

async function joinOK(env:Env, tgId:string) {
  const channel=await getSetting(env,"FORCE_CHANNEL","");
  if(!channel) return true;
  try{
    ENV_TOKEN=env.BOT_TOKEN;
    const r:any=await tg("getChatMember",{chat_id:channel,user_id:Number(tgId)});
    return ["member","administrator","creator"].includes(r?.result?.status);
  }catch{return false}
}

async function mainMenu(env:Env,tgId:string){
  const u=await user(env,tgId);
  return keyboard([
    [{text:"✨ ساخت ایمیل جدید",callback_data:"new"}],
    [{text:"⚡ ساخت سریع",callback_data:"quick"},{text:"📨 صندوق ورودی",callback_data:"inbox"}],
    [{text:"🌐 دامنه‌ها",callback_data:"domains"},{text:"🎁 دعوت و سکه",callback_data:"coins"}],
    [{text:"📱 باز کردن Mini App",web_app:{url: await miniUrl(env)}}],
    [{text:"ℹ️ راهنما",callback_data:"help"}]
  ]);
}
async function miniUrl(env:Env){
  const base = await getSetting(env,"MINIAPP_URL","");
  return base || "https://example.com";
}
function render(t:string, vars:Record<string,string>={}){
  return t.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??"");
}

async function sendHome(env:Env,chatId:string){
  const t=await getText(env,"welcome","🌌 به NovaMail خوش آمدی!");
  const u=await user(env,String(chatId));
  await tg("sendMessage",{chat_id:chatId,text:`${t}\n\n🪙 موجودی: ${u.coins} سکه`,reply_markup:await mainMenu(env,String(chatId))});
}

async function createMailbox(env:Env,tgId:string,domain:string,local:string){
  const cost=Number(await getSetting(env,"CREATE_COST","2"));
  const u=await user(env,tgId);
  if(u.coins<cost) return {error:await getText(env,"insufficient","🪙 سکه کافی نیست.")};

  const password=randomCode()+"A1!";
  const address=`${local}@${domain}`;
  const ar=await fetch(`${env.MAIL_API}/accounts`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({address,password})});
  if(!ar.ok) return {error:"❌ ساخت ایمیل ناموفق بود؛ دامنه دیگری را امتحان کن."};
  const account:any=await ar.json();
  const tr=await fetch(`${env.MAIL_API}/token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({address,password})});
  if(!tr.ok) return {error:"❌ دریافت توکن ایمیل ناموفق بود."};
  const token:any=await tr.json();
  const hours=Number(await getSetting(env,"EXPIRY_HOURS","24"));
  const exp=expiry(hours);
  await env.DB.prepare("INSERT INTO mailboxes(tg_id,address,password,token,domain,expires_at) VALUES(?,?,?,?,?,?)")
    .bind(tgId,address,password,token.token,domain,exp).run();
  await env.DB.prepare("UPDATE users SET coins=coins-? WHERE tg_id=?").bind(cost,tgId).run();
  return {email:address,hours};
}

async function domains(env:Env){
  const r=await fetch(`${env.MAIL_API}/domains?page=1`);
  if(!r.ok) return [];
  const j:any=await r.json();
  return (j["hydra:member"]||[]).map((x:any)=>x.domain).slice(0,30);
}

async function inbox(env:Env,tgId:string){
  const m=await env.DB.prepare("SELECT * FROM mailboxes WHERE tg_id=? AND active=1 ORDER BY id DESC LIMIT 1").bind(tgId).first<any>();
  if(!m) return "📭 هنوز ایمیل فعالی نداری.";
  if(new Date(m.expires_at)<=new Date()) return "⌛ اعتبار این ایمیل تمام شده است.";
  const r=await fetch(`${env.MAIL_API}/messages`,{headers:{authorization:`Bearer ${m.token}`}});
  if(!r.ok) return "❌ دریافت صندوق ورودی ناموفق بود.";
  const j:any=await r.json();
  const arr=j["hydra:member"]||[];
  let out=`📨 صندوق ورودی\n\n📧 ${m.address}\n\n`;
  if(!arr.length) out+="📭 پیام جدیدی نیست.";
  else arr.slice(0,10).forEach((x:any,i:number)=>out+=`${i+1}. ${esc(x.from?.address||"unknown")} — ${esc(x.subject||"(بدون موضوع)")}\n`);
  return out;
}

async function handleUpdate(env:Env,upd:any){
  ENV_TOKEN=env.BOT_TOKEN;
  if(upd.message){
    const m=upd.message, chatId=String(m.chat.id), text=String(m.text||"");
    const u=await user(env,chatId,m.from);
    if(u.banned) return;
    if(text.startsWith("/start")){
      const p=text.split(" ")[1]||"";
      if(p.startsWith("ref_") && !u.referred_by && p.slice(4)!==u.ref_code){
        const ref=await env.DB.prepare("SELECT * FROM users WHERE ref_code=?").bind(p.slice(4)).first<any>();
        if(ref){
          await env.DB.prepare("UPDATE users SET referred_by=? WHERE tg_id=?").bind(ref.tg_id,chatId).run();
          await env.DB.prepare("UPDATE users SET referrals=referrals+1 WHERE tg_id=?").bind(ref.tg_id).run();
          const rr=Number(await getSetting(env,"REF_EVERY","2")), reward=Number(await getSetting(env,"REF_REWARD","10"));
          const fresh=await env.DB.prepare("SELECT referrals,rewarded_referrals FROM users WHERE tg_id=?").bind(ref.tg_id).first<any>();
          const should=Math.floor(fresh.referrals/rr);
          if(should>fresh.rewarded_referrals){
            await env.DB.prepare("UPDATE users SET coins=coins+?,rewarded_referrals=? WHERE tg_id=?").bind((should-fresh.rewarded_referrals)*reward,should,ref.tg_id).run();
          }
        }
      }
      if(!(await joinOK(env,chatId))){
        const url=await getSetting(env,"FORCE_CHANNEL_URL","");
        await tg("sendMessage",{chat_id:chatId,text:await getText(env,"join_required","🔒 ابتدا عضو کانال شو."),reply_markup:keyboard([[{text:"📢 عضویت در کانال",url:url||"https://t.me/"}],[{text:"✅ بررسی عضویت",callback_data:"check_join"}]])});
        return;
      }
      await sendHome(env,chatId); return;
    }
    const sess=await env.DB.prepare("SELECT * FROM sessions WHERE tg_id=?").bind(chatId).first<any>();
    if(sess?.state==="username"){
      const domain=sess.data;
      const local=text.toLowerCase().replace(/[^a-z0-9._-]/g,"").slice(0,30);
      if(local.length<3){await tg("sendMessage",{chat_id:chatId,text:"❌ نام ایمیل حداقل ۳ کاراکتر باشد."});return;}
      const result=await createMailbox(env,chatId,domain,local);
      await env.DB.prepare("DELETE FROM sessions WHERE tg_id=?").bind(chatId).run();
      await tg("sendMessage",{chat_id:chatId,text:result.error||render(await getText(env,"mail_created","✅ {email}"),{email:result.email||"",hours:String(result.hours||24)}),reply_markup:await mainMenu(env,chatId)});
      return;
    }
    await sendHome(env,chatId);
  }
  if(upd.callback_query){
    const q=upd.callback_query, chatId=String(q.message.chat.id), data=q.data;
    await tg("answerCallbackQuery",{callback_query_id:q.id});
    if(data==="check_join"){await sendHome(env,chatId);return;}
    if(data==="new"||data==="quick"){
      const ds=await domains(env);
      if(!ds.length){await tg("sendMessage",{chat_id:chatId,text:"❌ دامنه‌ای در دسترس نیست."});return;}
      const rows=ds.slice(0,12).map((d:string)=>[{text:"@"+d,callback_data:"domain:"+d}]);
      await tg("sendMessage",{chat_id:chatId,text:"🌐 دامنه را انتخاب کن:",reply_markup:keyboard(rows)});return;
    }
    if(data.startsWith("domain:")){
      const d=data.slice(7);
      await env.DB.prepare("INSERT OR REPLACE INTO sessions(tg_id,state,data) VALUES(?,?,?)").bind(chatId,"username",d).run();
      await tg("sendMessage",{chat_id:chatId,text:`✏️ نام ایمیل را بفرست.\nمثال: taha\n\nدامنه: @${d}`});return;
    }
    if(data==="domains"){
      const ds=await domains(env); await tg("sendMessage",{chat_id:chatId,text:"🌐 دامنه‌های فعال:\n\n"+ds.map((x:string)=>"• @"+x).join("\n")});return;
    }
    if(data==="inbox"){
      await tg("sendMessage",{chat_id:chatId,text:await inbox(env,chatId)});return;
    }
    if(data==="coins"){
      const u=await user(env,chatId);
      const bot:any=await tg("getMe",{});
      const link=`https://t.me/${bot.result.username}?start=ref_${u.ref_code}`;
      await tg("sendMessage",{chat_id:chatId,text:`🎁 دعوت و سکه\n\n🪙 موجودی: ${u.coins}\n👥 دعوت‌ها: ${u.referrals}\n\nهر 2 دعوت = 10 سکه\n\n🔗 لینک دعوت:\n${link}`});return;
    }
    if(data==="help"){
      await tg("sendMessage",{chat_id:chatId,text:await getText(env,"help","ℹ️ راهنما")});return;
    }
  }
}

async function adminPage(env:Env,req:Request){
  const u=new URL(req.url);
  if(u.pathname==="/admin"){
    const html=`<!doctype html><html lang="fa" dir="rtl"><meta name="viewport" content="width=device-width"><title>NovaMail Control</title>
    <style>body{font-family:Tahoma;background:#07101f;color:#fff;max-width:900px;margin:auto;padding:20px}input,textarea,button{width:100%;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #29456d;background:#0b1830;color:#fff}button{background:#6d4aff;border:0;font-weight:bold}.card{background:#0c1a30;border:1px solid #1d3b63;border-radius:16px;padding:15px;margin:12px 0}</style>
    <h1>🌌 NovaMail Control</h1>
    <div class="card"><h3>ورود مدیریت</h3><input id="pw" type="password" placeholder="ADMIN_PASSWORD"><button onclick="login()">ورود</button></div>
    <div id="panel"></div><script>
    async function login(){let p=document.getElementById('pw').value;let r=await fetch('/admin/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:p,op:'stats'})});let j=await r.json();if(!j.ok)return alert(j.error);document.getElementById('panel').innerHTML='<div class="card"><h3>آمار</h3><p>کاربران: '+j.users+'</p><p>ایمیل‌ها: '+j.mailboxes+'</p></div><div class="card"><h3>تنظیمات</h3><textarea id="set" rows="12"></textarea><button onclick="save()">ذخیره تنظیمات</button></div>';document.getElementById('set').value=JSON.stringify(j.settings,null,2);window.p=p}
    async function save(){let r=await fetch('/admin/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:window.p,op:'settings',settings:JSON.parse(document.getElementById('set').value)})});let j=await r.json();alert(j.ok?'ذخیره شد':'خطا')}
    </script></html>`;
    return new Response(html,{headers:{"content-type":"text/html;charset=utf-8"}});
  }
  if(u.pathname==="/admin/api" && req.method==="POST"){
    const b:any=await req.json().catch(()=>({}));
    if(b.password!==env.ADMIN_PASSWORD)return Response.json({ok:false,error:"رمز مدیریت اشتباه است"},{status:401});
    if(b.op==="stats"){
      const a=await env.DB.prepare("SELECT COUNT(*) c FROM users").first<any>();
      const m=await env.DB.prepare("SELECT COUNT(*) c FROM mailboxes").first<any>();
      const s=await env.DB.prepare("SELECT key,value FROM settings").all<any>();
      return Response.json({ok:true,users:a.c,mailboxes:m.c,settings:Object.fromEntries((s.results||[]).map((x:any)=>[x.key,x.value]))});
    }
    if(b.op==="settings"){
      for(const [k,v] of Object.entries(b.settings||{})) await env.DB.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)").bind(k,String(v)).run();
      return Response.json({ok:true});
    }
  }
  return new Response("Not found",{status:404});
}

export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    ENV_TOKEN=env.BOT_TOKEN;
    const u=new URL(req.url);
    if(u.pathname==="/admin"||u.pathname==="/admin/api") return adminPage(env,req);
    if(u.pathname.startsWith("/telegram/")){
      const secret=u.pathname.split("/").pop();
      if(secret!==env.WEBHOOK_SECRET) return new Response("Forbidden",{status:403});
      const upd=await req.json().catch(()=>null);
      if(upd) await handleUpdate(env,upd);
      return new Response("OK");
    }
    if(u.pathname==="/api/health") return Response.json({ok:true,app:"NovaMail"});
    return new Response("NovaMail is running.");
  }
};