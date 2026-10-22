const API = (window.AFTERFALL_AI_API_URL || "https://afterfall-ai-chat-api.xiaoeeb.workers.dev").replace(/\/$/, "");
const CAST = {
  lin: {name:"林野",icon:"🧭",role:"侦察员，冷静谨慎，话少但会承担责任；不轻易信任别人，重视可验证的信息。"},
  mira:{name:"米拉",icon:"🩹",role:"医护人员，温和细心但有底线；关注伤病、饮水和人的情绪，不会一味附和。"},
  oldzhou:{name:"老周",icon:"🔧",role:"维修工，直率务实、偶尔嘴硬开玩笑；看重工具、物资和实际行动。"},
  ash:{name:"灰鸦",icon:"📡",role:"神秘无线电监听者，敏锐、多疑、保留秘密；不会每句话都故弄玄虚。"},
  xiaoman:{name:"小满",icon:"🎒",role:"年轻的物资搜寻者，机灵、好奇，有时冲动也会害怕；想证明自己有用。"}
};
const STORE = "afterfall-world-v2";
const defaults = {
  day:18, hour:19, weather:"阴，偶有冷雨", location:"旧城区外围 · 临时避难点",
  stats:{health:78,stamina:64,hunger:38,thirst:44,morale:57},
  inventory:{"压缩饼干":5,"饮用水":4,"绷带":2,"电池":3,"废金属":2},
  relationships:{lin:0,mira:0,oldzhou:0,ash:0,xiaoman:0},
  seenIntro:false, lastTick:Date.now(), memories:[], chats:{group:[]}
};
function clone(x){return JSON.parse(JSON.stringify(x));}
function load(){try{return Object.assign(clone(defaults),JSON.parse(localStorage.getItem(STORE)||"{}"));}catch(e){return clone(defaults);}}
let world=load(), channel="group", busy=false;
Object.keys(CAST).forEach(id=>{if(!world.chats[id])world.chats[id]=[];});
if(!world.chats.group.length){
  world.chats.group=[
    {who:"系统播报",text:"【第18日 19:04｜临时避难点】外面的雨声盖过了大部分动静。频道里有人刚接入。",kind:"system"},
    {who:"林野",text:"东侧街口刚才有灯闪了一下。不是手电的节奏，我暂时不建议任何人过去。",id:"lin"},
    {who:"老周",text:"先别自己吓自己，也可能是线路短路。谁有多余电池？我这台收音机快熄火了。",id:"oldzhou"},
    {who:"米拉",text:"先确认大家有没有受伤。小满，你刚才说出去找水，回来了吗？",id:"mira"},
    {who:"小满",text:"……我在楼梯间。我听见楼下有人拖东西，不知道是不是人。"}
  ];
  world.seenIntro=true; save();
}
function save(){world.lastTick=Date.now();localStorage.setItem(STORE,JSON.stringify(world));renderStats();renderSurvival();}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function timeText(){return "第"+world.day+"日 "+String(world.hour).padStart(2,"0")+":00";}
function renderStats(){
  const s=world.stats;
  document.getElementById("worldTime").textContent=timeText();
  document.getElementById("weather").textContent=world.weather;
  document.getElementById("location").textContent=world.location;
  document.getElementById("health").textContent=s.health;
  document.getElementById("stamina").textContent=s.stamina;
  document.getElementById("hunger").textContent=s.hunger;
  document.getElementById("thirst").textContent=s.thirst;
  document.getElementById("morale").textContent=s.morale;
  document.getElementById("inventory").innerHTML=Object.entries(world.inventory).map(([k,v])=>"<span class='item'>"+esc(k)+" <b>"+v+"</b></span>").join("")||"暂无物资";
}
function renderSurvival(){
  const s=world.stats;
  [["health",s.health],["stamina",s.stamina],["hunger",s.hunger],["thirst",s.thirst],["morale",s.morale]].forEach(([id,v])=>{
    const el=document.getElementById(id+"Bar"); if(el)el.style.width=Math.max(0,Math.min(100,v))+"%";
  });
}
function renderChat(){
  const feed=document.getElementById("feed"), msgs=world.chats[channel]||[];
  feed.innerHTML=msgs.map(m=>"<article class='msg "+(m.kind||"")+"'><div class='name'>"+esc(m.who)+(m.time?" <small>"+esc(m.time)+"</small>":"")+"</div><div class='body'>"+esc(m.text)+"</div></article>").join("");
  feed.scrollTop=feed.scrollHeight;
  document.getElementById("channelTitle").textContent=channel==="group"?"# 幸存者公共频道":"# "+CAST[channel].name+" · 私聊";
  document.querySelectorAll("[data-channel]").forEach(b=>b.classList.toggle("active",b.dataset.channel===channel));
  document.getElementById("send").disabled=busy;
}
function push(channelId,who,text,kind,id){
  world.chats[channelId]=world.chats[channelId]||[];
  world.chats[channelId].push({who,text,kind:kind||"",id,time:timeText()});
  if(world.chats[channelId].length>100)world.chats[channelId]=world.chats[channelId].slice(-100);
}
function tick(hours){
  world.hour+=hours;
  while(world.hour>=24){world.hour-=24;world.day++;world.stats.hunger=Math.min(100,world.stats.hunger+8);world.stats.thirst=Math.min(100,world.stats.thirst+10);push("group","系统播报","夜晚过去了。新的一天开始，饥饿与口渴正在累积。","system");}
  world.stats.stamina=Math.max(0,world.stats.stamina- Math.max(1,hours*2));
  world.stats.hunger=Math.min(100,world.stats.hunger+hours*2);
  world.stats.thirst=Math.min(100,world.stats.thirst+hours*3);
  if(world.stats.hunger>80)world.stats.health=Math.max(0,world.stats.health-2);
  if(world.stats.thirst>80)world.stats.health=Math.max(0,world.stats.health-3);
  if(Math.random()<.18)world.weather=["冷雨","浓雾","阴天，风很大","低温，空气潮湿"][Math.floor(Math.random()*4)];
}
function localEvent(text){push("group","系统事件",text,"system");if(channel==="group")renderChat();save();}
function act(action){
  if(busy)return;
  if(action==="rest"){
    tick(2);world.stats.stamina=Math.min(100,world.stats.stamina+28);world.stats.morale=Math.min(100,world.stats.morale+4);
    localEvent("你在避难点休息了两小时。体力恢复了一些，但外面的天气和动静仍然让人无法完全放松。");
  }else if(action==="eat"){
    if((world.inventory["压缩饼干"]||0)<1){localEvent("物资不足：没有压缩饼干可吃。");return;}
    world.inventory["压缩饼干"]--;world.stats.hunger=Math.max(0,world.stats.hunger-28);tick(0.25);
    localEvent("你吃掉一份压缩饼干。饥饿感减轻了，剩余 "+(world.inventory["压缩饼干"]||0)+" 份。");
  }else if(action==="drink"){
    if((world.inventory["饮用水"]||0)<1){localEvent("物资不足：没有饮用水了。");return;}
    world.inventory["饮用水"]--;world.stats.thirst=Math.max(0,world.stats.thirst-32);tick(.1);
    localEvent("你喝了一份饮用水。口渴缓解了，剩余 "+(world.inventory["饮用水"]||0)+" 份。");
  }else if(action==="scavenge"){
    if(world.stats.stamina<18){localEvent("你现在太疲惫了，体力不足以安全外出搜寻。先休息或补充食物。");return;}
    tick(2);world.stats.stamina=Math.max(0,world.stats.stamina-12);
    const roll=Math.random();
    if(roll<.25){world.inventory["饮用水"]=(world.inventory["饮用水"]||0)+1;localEvent("搜寻结果：在翻倒的背包里找到一瓶密封饮用水。你带回避难点，时间过去了两小时。");}
    else if(roll<.48){world.inventory["压缩饼干"]=(world.inventory["压缩饼干"]||0)+2;localEvent("搜寻结果：找到两份没被雨水泡坏的压缩饼干。你把它们收好。");}
    else if(roll<.65){world.inventory["废金属"]=(world.inventory["废金属"]||0)+2;localEvent("搜寻结果：拆下两块还能用的金属零件。老周也许能拿它们修设备。");}
    else if(roll<.8){world.stats.morale=Math.max(0,world.stats.morale-5);localEvent("搜寻时你听见附近有脚步跟了一段路。你没有看清对方，只能提前折返，心情也受到影响。");}
    else{world.stats.health=Math.max(0,world.stats.health-6);localEvent("搜寻时你踩空摔了一跤，手臂擦伤。你损失了 6 点健康，最好找米拉检查。");}
  }else if(action==="craft"){
    if((world.inventory["废金属"]||0)<2||(world.inventory["电池"]||0)<1){localEvent("制作条件不足：需要废金属 ×2、电池 ×1。");return;}
    world.inventory["废金属"]-=2;world.inventory["电池"]--;world.inventory["电池组"]=(world.inventory["电池组"]||0)+1;
    tick(1);localEvent("你花了一小时把废金属和电池拼成简易电源。它能短暂维持一台小型设备。");
  }
}
function formatAIGroup(text){
  const lines=String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean), out=[];
  lines.forEach(line=>{
    const m=line.match(/^\[?(林野|米拉|老周|灰鸦|小满|系统播报)\]?[：:]\s*(.+)$/);
    if(m)out.push({who:m[1],text:m[2],id:Object.keys(CAST).find(k=>CAST[k].name===m[1])});
  });
  if(out.length)return out.slice(0,5);
  return [{who:"林野",text:String(text||"频道暂时没有回应。"),id:"lin"}];
}
async function sendMessage(raw){
  const message=String(raw||"").trim();if(!message||busy)return;
  const target=channel;
  push(target,"你",message,"me");
  if(target==="group")tick(.15);
  save();renderChat();busy=true;renderChat();
  const btn=document.getElementById("send"), input=document.getElementById("entry");
  btn.textContent="频道响应中…";
  try{
    const history=(world.chats[target]||[]).slice(0,-1).filter(m=>m.kind!=="system").slice(-18).map(m=>({
      role:m.who==="你"?"user":"model",
      content:(m.who==="你"?"玩家":m.who)+"："+m.text
    }));
    const payload={characterId:target==="group"?"group":target,message,history,world:{
      day:world.day,time:timeText(),weather:world.weather,location:world.location,
      stats:world.stats,inventory:world.inventory,relationships:world.relationships,
      recentEvents:(world.chats.group||[]).slice(-8).map(m=>m.who+"："+m.text)
    }};
    const res=await fetch(API+"/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||"AI 请求失败，请稍后重试。");
    if(target==="group"){
      formatAIGroup(data.reply).forEach(m=>{push("group",m.who,m.text,"",m.id);if(m.id)world.relationships[m.id]=Math.min(100,(world.relationships[m.id]||0)+ (Math.random()<.45?1:0));});
    }else{
      push(target,CAST[target].name,data.reply,"",target);
      world.relationships[target]=Math.min(100,(world.relationships[target]||0)+(message.length>8?1:0));
    }
    save();
  }catch(e){push(target,"系统提示",e.message||"连接失败，请稍后再试。","system");save();}
  finally{busy=false;btn.textContent="发送";renderChat();input.focus();}
}
document.querySelectorAll("[data-channel]").forEach(b=>b.addEventListener("click",()=>{channel=b.dataset.channel;renderChat();}));
document.getElementById("form").addEventListener("submit",e=>{e.preventDefault();const input=document.getElementById("entry");const v=input.value;input.value="";sendMessage(v);});
document.querySelectorAll("[data-say]").forEach(b=>b.addEventListener("click",()=>sendMessage(b.dataset.say)));
document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>act(b.dataset.action)));
document.getElementById("clearChat").addEventListener("click",()=>{if(confirm("清空当前频道记录？生存状态不会重置。")){world.chats[channel]=[];save();renderChat();}});
document.getElementById("resetWorld").addEventListener("click",()=>{if(confirm("确定重新开始？这会清除本机的游戏进度和聊天记录。")){localStorage.removeItem(STORE);location.reload();}});
renderStats();renderSurvival();renderChat();
