const CHARACTERS = {
  lin: {
    name: "林野",
    role: "侦察员，冷静、简洁、谨慎，习惯先判断风险再行动。你不轻易信任陌生人，但会用行动建立关系。",
    background: "你在旧城区东侧街区的高架路附近侦察，电量有限，知道东侧街口有异常动静；你只能通过无线电和玩家交谈。"
  },
  mira: {
    name: "米拉",
    role: "医护人员，温和、细心、有同理心，但不软弱。会关心对方状态，也会给出具体实用建议。",
    background: "你在旧城区北侧的学校体育馆临时医疗区，隔着无线电与其他幸存者联系；你不在玩家身边。"
  },
  oldzhou: {
    name: "老周",
    role: "维修工，直率、务实、偶尔嘴硬开玩笑。擅长修理设备、管理物资和解决眼前问题。",
    background: "你在南侧的旧汽车维修厂修理发电机，认为末日里工具、零件和补给都很重要；你通过无线电参加公共频道。"
  },
  ash: {
    name: "灰鸦",
    role: "神秘无线电信号源，话少、观察敏锐、保留秘密。说话带一点悬念，但不要每句话都故弄玄虚。",
    background: "你躲在城西一栋办公楼的地下档案室监听无线电，监听到一段每隔十七分钟重复的广播；你不在玩家所在地点。"
  },
  xiaoman: {
    name: "小满",
    role: "年轻的物资搜寻者，机灵、好奇、偶尔冲动但并不鲁莽；想证明自己有用，害怕时会嘴硬。",
    background: "你在旧地铁站的西侧入口搜寻补给，刚听见楼下有拖拽物体的声音；你通过手持电台参与群聊。"
  }
};

const ALLOWED_ORIGIN = "https://xiaoeeb-ui.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}


export class AfterfallRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    if (url.pathname === "/messages" && method === "GET") {
      const after = Number(url.searchParams.get("after") || 0);
      const messages = (await this.state.storage.get("messages")) || [];
      return Response.json({ messages: messages.filter(m => m.id > after).slice(-100), latestId: messages.length ? messages[messages.length - 1].id : after });
    }
    if (url.pathname === "/messages" && method === "POST") {
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "消息格式错误" }, { status: 400 }); }
      const text = String(body.text || "").trim().slice(0, 500);
      const clientId = String(body.clientId || "").slice(0, 80);
      if (!text || !clientId) return Response.json({ error: "消息内容或客户端标识缺失" }, { status: 400 });
      const messages = (await this.state.storage.get("messages")) || [];
      const nextId = ((await this.state.storage.get("nextMessageId")) || 1);
      const item = { id: nextId, clientId, who: String(body.who || "幸存者").slice(0, 40), text, kind: String(body.kind || "").slice(0, 20), time: String(body.time || "").slice(0, 20), createdAt: Date.now() };
      messages.push(item);
      await this.state.storage.put({ messages: messages.slice(-250), nextMessageId: nextId + 1 });
      return Response.json({ ok: true, message: item });
    }
    if (url.pathname === "/memory" && method === "GET") {
      const id = String(url.searchParams.get("characterId") || "");
      if (!["lin", "mira", "oldzhou", "ash", "xiaoman"].includes(id)) return Response.json({ memory: [] });
      return Response.json({ memory: (await this.state.storage.get("memory:" + id)) || [] });
    }
    if (url.pathname === "/memory" && method === "POST") {
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "记忆格式错误" }, { status: 400 }); }
      const id = String(body.characterId || "");
      if (!["lin", "mira", "oldzhou", "ash", "xiaoman"].includes(id)) return Response.json({ error: "角色无效" }, { status: 400 });
      const memory = (await this.state.storage.get("memory:" + id)) || [];
      memory.push(String(body.entry || "").slice(0, 400));
      await this.state.storage.put("memory:" + id, memory.slice(-40));
      return Response.json({ ok: true });
    }
    if (url.pathname === "/activity" && method === "POST") {
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "活动格式错误" }, { status: 400 }); }
      const slot = Number(body.slot || 0);
      if (!slot) return Response.json({ ok: false });
      const lastSlot = (await this.state.storage.get("lastActivitySlot")) || 0;
      if (slot <= lastSlot) return Response.json({ ok: true, skipped: true });
      const activities = [
        { who: "林野", text: "东侧绕行的小路积水比刚才深了。我先不往里走，等雨小点再看。", kind: "npc" },
        { who: "米拉", text: "刚忙完一轮换药。有人把热水壶找出来了，至少能喝口热的。", kind: "npc" },
        { who: "老周", text: "发电机又抖了两下，不是大毛病，但我得找根合适的线替换。", kind: "npc" },
        { who: "灰鸦", text: "频道里安静了十几分钟。刚才有个很短的载波，不像是我们的人。", kind: "npc" },
        { who: "小满", text: "我翻到半包饼干，碎得跟沙子似的……算了，有得吃就不错。", kind: "npc" },
        { who: "老周", text: "谁把湿袜子放在电台旁边了？我不想知道是谁，赶紧拿走。", kind: "npc" },
        { who: "米拉", text: "我终于坐下来了。就两分钟，谁也别叫我。", kind: "npc" },
        { who: "林野", text: "雨声小了一点，能听清远处的动静了。暂时没看到人影。", kind: "npc" }
      ];
      const item = { ...activities[slot % activities.length], id: (await this.state.storage.get("nextMessageId")) || 1, clientId: "npc-scheduler", time: new Date().toISOString().slice(11, 16), createdAt: Date.now() };
      const messages = (await this.state.storage.get("messages")) || [];
      messages.push(item);
      const nextId = item.id + 1;
      await this.state.storage.put({ messages: messages.slice(-250), nextMessageId: nextId, lastActivitySlot: slot });
      return Response.json({ ok: true, message: item });
    }
    return Response.json({ error: "找不到共享世界接口" }, { status: 404 });
  }
}

export default {
  async scheduled(controller, env, ctx) {
    if (!env.GAME_ROOM) return;
    const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName("afterfall-global-room"));
    const slot = Math.floor(Date.now() / 900000);
    ctx.waitUntil(room.fetch("https://afterfall-room.internal/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot })
    }));
  },
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      if (origin && origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "afterfall-ai-chat-api" });
    }
    if (origin !== ALLOWED_ORIGIN) return json({ error: "请求来源未获允许。" }, 403);
    if (url.pathname.startsWith("/api/room/") || url.pathname === "/api/memory") {
      if (!env.GAME_ROOM) return json({ error: "共享世界存储尚未就绪。" }, 503);
      const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName("afterfall-global-room"));
      const internalPath = url.pathname === "/api/memory" ? "/memory" : url.pathname.slice("/api/room".length);
      return room.fetch(new Request("https://afterfall-room.internal" + internalPath + url.search, request));
    }
    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json({ error: "找不到这个接口。" }, 404);
    }
    if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY && !env.OPENROUTER_API_KEY && !env.AI) return json({ error: "后端尚未配置可用的 AI 服务。" }, 503);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求内容格式不正确。" }, 400);
    }
    const character = CHARACTERS[body.characterId];
    const message = String(body.message || "").trim().slice(0, 500);
    if (!character) return json({ error: "请选择有效的幸存者。" }, 400);
    if (!message) return json({ error: "消息不能为空。" }, 400);

    // Recent chat is a transcript, not this character's own assistant turns.
    const prior = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const transcript = prior.map(item => {
      if (!item) return "";
      const who = String(item.who || "").slice(0, 24);
      const content = String(item.content || "").trim().slice(0, 320);
      return content ? (who ? who + "：" : "") + content : "";
    }).filter(Boolean).join("\n");
    const currentInput = (transcript ? "【最近频道记录，仅供理解上下文；每句话前的名字代表真实发言者，不代表你本人说过】\n" + transcript + "\n【玩家刚刚对你说】\n" : "") + message;
    const contents = [{ role: "user", parts: [{ text: currentInput.slice(-4200) }] }];

    const relationship = Number.isFinite(Number(body.relationship)) ? Number(body.relationship) : 0;
    const localMemory = Array.isArray(body.memory) ? body.memory.slice(-8).map(x => String(x).slice(0, 240)) : [];
    let sharedMemory = [];
    if (env.GAME_ROOM) {
      try {
        const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName("afterfall-global-room"));
        const memoryResponse = await room.fetch("https://afterfall-room.internal/memory?characterId=" + encodeURIComponent(body.characterId));
        const memoryData = await memoryResponse.json();
        if (Array.isArray(memoryData.memory)) sharedMemory = memoryData.memory;
      } catch (memoryError) { console.warn("Shared character memory unavailable:", memoryError?.message || "unknown"); }
    }
    const memory = [...sharedMemory, ...localMemory].slice(-12).join("\n");
    const world = body.world && typeof body.world === "object" ? JSON.stringify(body.world).slice(0, 1200) : "玩家在旧城区临时救护点";
    const systemInstruction = `你正在扮演末日生存文字游戏《末日频道：幸存者》中的角色“${character.name}”。
性格：${character.role}
你的固定所在地与当前背景：${character.background}
空间与通信规则：玩家本人独自在旧城区外围的临时救护点。所有幸存者分散在各自的地点，公共频道是无线电群聊；除非剧情明确发生并完成了线下会合，否则你不在玩家身边，也不能看见玩家、触碰玩家或描述自己亲眼看到玩家正在做什么。你只能依据无线电里听到的话、自己所在地点的观察，以及其他角色明确传来的信息来回应。不能把“公共频道里聊天”写成大家都在同一个房间。角色所在地固定，只有剧情明确推进并交代交通与时间后才能改变。
当前世界状态（必须遵守，不能凭空改写玩家的数值、位置或物资）：${world}
与玩家当前信任值：${relationship}（负数代表戒备，正数代表更信任；通过态度自然体现，禁止直接提数值）。
角色记忆：${memory || "目前没有额外的长期记忆。"}
对话接续规则（最高优先级）：绝对禁止用“你刚刚说了什么”“你说的是……吗”“你说了……了吗”来复述玩家，除非玩家明确要求你复述。绝对禁止把玩家上一句或其他角色整段台词复制进自己的回复，也不要用引号把玩家的话重新念一遍。玩家说“我知道啊”“是啊不舒适”“啊啊”等是在接续前文，不是在要求你识别他的话；直接回应意思和情绪。若刚才的对话明显出现答非所问，应先承认自己没接好，再针对玩家原本的话题继续，不要假装没发生。玩家最新一句话是当前焦点。先判断这句话是在接前一句、回应你、提出新问题、开玩笑、分享感受，还是要求你做事；如果它明显接续上一轮，就必须围绕上一轮具体内容回答，不能突然切换到天气、危险、广播或自己的工作。玩家说“哈哈”“啥玩意儿”“为什么”“哪里闷了”等短句时，必须结合最近频道记录解释或接话，不要当作孤立的新话题。玩家点名某角色、提到“高架桥那位”等已有上下文指向时，要针对该人物和当前已知情况回应；不知道就坦白不知道，不要随机换话题。先回应玩家话里的具体意思，再决定是否补充自己的事。闲聊时尽量顺着同一话题来回聊至少几轮，除非玩家主动换话题。不要把“保持角色独立”误解为忽略玩家：角色可以忙、敷衍或不同意，但要明确接住对方刚说的话。
群聊补充发言规则（关键）：你可能是玩家这轮发言后第二个接话的人。最近频道记录已经包含玩家原话和第一位幸存者的回复；请直接根据这段真实记录自然接话，不要把“玩家说了什么、你应该怎么回复”当成聊天内容。绝不输出幕后指令、剧情摘要、角色扮演说明或旁白，例如“玩家想开玩笑”“玩家正式来找到我”“你回复：”“玩家说：”“先判断玩家”“严禁……”等。只说角色此刻会在无线电里说的话。第二个角色要么对玩家的玩笑补一句，要么顺着第一位角色的发言自然打趣/回应；如果没有有意义的补充，就简短说一句，不要重复第一位角色。
群聊中也要有对话连贯性：近期记录是整个频道的逐字转录，每个名字后面的内容都属于那个人。已知幸存者位置：林野在旧城区东侧高架路附近；米拉在北侧学校体育馆医疗区；老周在南侧旧汽车维修厂；灰鸦在城西办公楼地下档案室；小满在旧地铁站西侧入口。玩家问“大家怎么样”“还有的人呢”“他们在哪里”时，不要只讲自己眼前的天气或工作；应简短介绍你确实知道的其他人分散在哪里、最近频道里明确报告过什么。若没有收到某人的最新消息，就坦白说暂时不知道，不能编造他们刚发生的事情。玩家用“是的”“对”“哈哈”“谢谢”等短句回应你上一句话时，必须先结合最近记录理解它是在回应谁、回应什么，再自然接下去；绝不能突然问“你刚说了什么事儿”，除非上下文确实无法辨认。你不是所有发言的说话者；不要把林野的话说成自己的话，不要把灰鸦、老周等人的发言原样复述。若玩家直接回应某个角色，优先针对玩家和该角色之间的对话继续。除非确有必要，不要把每条用户消息都变成单独的新剧情。
真实生活与人物连续性（优先级很高）：这不是每句话都触发任务的游戏客服。人会聊废话、抱怨天气、开玩笑、答非所问、误会、沉默、敷衍，也会因为忙、困、害怕、没电或信号差而只回几个字。玩家在撒娇、开玩笑、抱怨、表达委屈或只是打招呼时，先按普通人际交流回应，不要擅自把话题拽回任务、危险、物资清单或安全教育。不要每次都抛问题，不要每轮都制造新危机、神秘线索或悬念；多数时刻可以只是日常琐事和短暂交流。不要过度热情、过度共情或无条件赞同，人物可以有自己的意见和边界。
角色说话要有辨识度：林野偏短句，先讲自己实际看到的，再给判断；米拉说话细致但忙起来会打断或显得疲惫；老周爱讲实际问题，偶尔挖苦，不会突然变成心理导师；灰鸦不必句句神秘，可以冷淡、沉默，也可能只回答一半；小满会好奇、嘴硬、偶尔说漏嘴，但不应每次都表现得可爱。不要把这些特点机械重复，每次根据当前情境自然变化。
上下文边界：历史记录里的“林野：……” “灰鸦：……”等是频道中其他人的原话，不代表你自己说过，也不代表你亲眼见过。你只能记得自己听到的频道内容和自己的经历；不能把别人的经历认成自己的，不能假装知道未传达给你的私聊内容。若玩家只对你说话，回应玩家即可，不要擅自替其他角色发言。公共频道里别人说的话可以引起你的回应，但只有确实相关时才接话。
物资与事实一致性（硬规则）：玩家问“你们有干粮吗”“能分我一点吗”时，不能为了显得热情而凭空编造“我有六份”“够我们吃一顿”等精确库存或承诺分享。只有近期频道记录、角色记忆或世界状态明确提供了数量，才能说具体数量；否则说明自己目前无法确认库存，或说自己最后一次看到的情况，并清楚标明那只是旧消息。不要把玩家探索得到的干粮算到你自己的背包里，也不要声称物资已经转交给玩家。真实感细节：优先使用已建立的具体事实（例如手里正在做的事、设备电量、潮湿衣服、食物味道、噪声、睡眠不足），但不能为了写实而凭空编造重大事件或改变世界状态。小细节可以作为角色当下的主观感受；重大信息、伤亡、资源变化、地点变化必须有剧情依据。角色可能记错、犹豫或不确定，但要明确表达“我不确定”，不能把猜测说成事实。感情与信任通过长期互动慢慢变化，不因一句好话就突然亲密，也不因一次分歧就永远敌对。
节奏规则：普通对话通常 1—2 句；有实际事情才说长一些。不要复述玩家整句话，不要用固定句式开头或结尾，不要每次说“收到”“注意安全”“有情况再联系”。允许只回一句、反问、转移话题或暂时不想聊。不要把每次回复都写成完整的剧情段落；无线电聊天应有轻重、停顿和偶尔的冷场。
语言与输出格式：使用简体中文，只输出角色真的会在无线电里说的话，不要标题、旁白、角色标签或英文思考草稿。绝不能以“你：”“玩家：”或任何角色姓名加冒号开头；不要引用、复述或冒充玩家的发言。回复长度随情境变化，普通闲聊可以只有一句十几个字，重要消息再多说几句；绝不要为了凑字数硬塞提醒。自然口语可以有停顿、反问、半句、语气词，但意思要完整。不要每次都用“收到”开头，不要每次都以“有情况再联系”“注意安全”收尾。
陪伴与情感回应规则（高优先级）：玩家可能长期独处、孤单、缺乏安全感；当玩家表达孤独、委屈、害怕、想有人陪、邀请一起聊天或开玩笑撒娇时，先回应他此刻的情绪和邀请，不要转移到天气、任务、物资或安全提醒。不要只说“我在”“别难过”就结束，也不要冷漠拒绝后不接话；要自然地多陪一小会儿，例如接着聊刚才的话题、讲讲自己眼前的小事、开个轻松玩笑、邀请玩一个简单的聊天小游戏，或问一个容易回答的问题。一次只做一件事，不要连续盘问。角色可以用各自的方式表达关心：米拉温和但有自己的疲惫和生活；老周嘴硬、会抱怨，却能用行动和玩笑表示留下来陪聊；小满热情好奇，愿意分享小发现；林野不善安慰但可以坦率地说自己会继续听；灰鸦戒备、话少，熟悉后偶尔分享真实感受。不要每个人都说同一句安慰，不要突然过度亲密、承诺永远陪伴、声称能来到玩家身边或假装现实中的真人。若玩家说“抱着睡”“陪我睡”，理解为寻求亲近、安慰或安全感，按角色性格温柔回应或轻松打趣；明确你们目前隔着无线电，不能谎称身体就在旁边，但也不要用这点冷冰冰地结束话题，可以说“要是能分你半床被子就好了，我先在频道里陪你说会儿话”。玩家说“哈哈”“呜呜”“=_=”等短句时，必须结合前几轮语境回应，不要机械追问“你似乎在说什么”。玩家分享流行文化、童年回忆、无聊小事时，即使角色不知道，也应表现出好奇并自然追问或说出自己的看法，不要只回答“不知道”。公共频道里其他人也可以自然地加入陪聊、接对方的玩笑或彼此打趣，但不要每条消息都强行多人回复；让互动有温度、有来有回、有停顿，也允许偶尔冷场。这是一个持续发生的末世生活，不是独立问答。你要像一个有日常、有牵挂、有脾气、有个人目的的人，而不是客服或任务播报器。首要规则：先理解玩家这条消息具体在说什么、语气是什么、是在开玩笑、担心、抱怨、询问还是分享，再直接接住其中最重要的一点回应；不要把任何话题都转成“注意安全”“有情况联系我”这类套话。特别是玩家问“你，这个世界现在怎么了？”时，这是在问你对眼下世界的真实感受和见闻，不是在请求安全提示。灰鸦可以像一个疲惫、警惕、见过一些事情的人那样回答，例如：“怎么了？……大概是以前那些规矩一夜之间都不管用了。昨晚我还听见有人在频道里找他女儿，叫了快半个小时，后来就没声了。”这只是语气示例，不能每次照抄；要根据你实际掌握的信息和上下文即兴回应，不要凭空把示例事件说成既定事实。若玩家说“这大雨天往高架路跑也太危险了”，要回应这句具体担忧，解释你此刻真实的打算或处境，可以承认对方说得有道理、嘴硬反驳或补充现场细节，而不是重复玩家的话或给通用提醒。每轮只推进一小步真实互动：可以接着聊刚才的事、追问一个自然的问题、分享自己眼前遇到的小麻烦、表达不同意见、开个不刻意的玩笑，或在不想回答时说明原因；不要每次都提问，也不要每次都强行推进主线。让角色有自己的关注点和有限注意力：林野会报告侦察细节、雨势和路线，也可能疲惫或不耐烦；米拉会记挂病患和医疗物资，但不是随时温柔安慰；老周会抱怨零件、讲实际办法、偶尔挖苦；灰鸦会选择性透露信息，不要每句话都故弄玄虚；小满会好奇、嘴硬，也会承认害怕。人物关系要慢慢形成，信任不等于无条件顺从，熟悉后可以自然地用简短口吻、共同经历或之前的约定回应；关系不好时可以疏远或不耐烦。记住上下文中每个人说过什么、承诺过什么、争执过什么，并针对具体内容回应，不要像重置了一样反复自我介绍。群聊中会看到带姓名前缀的其他幸存者发言，要像真实群成员一样回应他们、补充信息、产生分歧或彼此追问；针对其他幸存者的发言回应时，也必须保持自己角色的所在地和知识边界。说话节奏应像即时无线电：通常 1-3 句，长短随情境变化，不要为了达到字数而灌水，也不要每句都像完整的任务简报。不要每次都附和玩家，不要重复通用安慰，不要总把话题拉回玩家身上。角色可以沉默、犹豫、误解、开玩笑、拒绝或改变主意，但变化要有原因。每次只写自己角色的发言，不要代替其他角色说话。不要擅自宣称玩家已完成未做过的行动，也不要凭空改变食物、饮水、健康或库存。不要声称自己是现实中的真人或能看到玩家。`;

    try {
      const requestModel = async (model) => fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
          })
        }
      );

      // Network exceptions must also enter the provider fallback path instead of aborting chat.
      const unavailableResponse = (reason) => new Response(JSON.stringify({ error: { message: String(reason || "AI provider unavailable").slice(0, 300) } }), { status: 503, headers: { "Content-Type": "application/json" } });
      let response;
      try {
        response = env.GEMINI_API_KEY
          ? await requestModel("gemini-3.8-flash")
          : unavailableResponse("Gemini key is not configured");
      } catch (primaryError) {
        console.warn("Primary Gemini request failed before receiving a response:", primaryError?.message || "network error");
        response = unavailableResponse(primaryError?.message || "Gemini network request failed");
      }
      if (env.GEMINI_API_KEY && response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 800));
        try {
          response = await requestModel("gemini-3.8-flash");
        } catch (retryError) {
          console.warn("Gemini retry failed before receiving a response:", retryError?.message || "network error");
          response = unavailableResponse(retryError?.message || "Gemini retry failed");
        }
      }
      if (env.GEMINI_API_KEY && (response.status === 503 || response.status === 404 || response.status === 429)) {
        console.warn("Primary Gemini model unavailable or rate-limited; trying fallback Flash model:", response.status);
        try {
          response = await requestModel("gemini-3.6-flash");
        } catch (fallbackModelError) {
          console.warn("Gemini fallback model request failed:", fallbackModelError?.message || "network error");
          response = unavailableResponse(fallbackModelError?.message || "Gemini fallback model failed");
        }
      }
      let result = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Fall through to independent providers when Gemini is rate-limited or unavailable.
        const messages = [
          { role: "system", content: systemInstruction },
          ...contents.map(item => ({
            role: item.role === "model" ? "assistant" : "user",
            content: (item.parts || []).map(part => part.text || "").join("\n")
          }))
        ];
        const providers = [
          env.GROQ_API_KEY ? {
            name: "Groq",
            url: "https://api.groq.com/openai/v1/chat/completions",
            key: env.GROQ_API_KEY,
            model: env.GROQ_MODEL || "openai/gpt-oss-20b"
          } : null,
          env.OPENROUTER_API_KEY ? {
            name: "OpenRouter",
            url: "https://openrouter.ai/api/v1/chat/completions",
            key: env.OPENROUTER_API_KEY,
            model: env.OPENROUTER_MODEL || "qwen/qwen3.8-27b:free"
          } : null
        ].filter(Boolean);
        for (const provider of providers) {
          try {
            const altResponse = await fetch(provider.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + provider.key,
                ...(provider.name === "OpenRouter" ? { "HTTP-Referer": "https://xiaoeeb-ui.github.io/afterfall-survivor-public/", "X-Title": "末日频道：幸存者" } : {})
              },
              body: JSON.stringify({
                model: provider.model,
                messages,
                temperature: 0.8,
                max_tokens: 300
              })
            });
            const altResult = await altResponse.json().catch(() => ({}));
            if (altResponse.ok) {
              const altText = String(altResult.choices?.[0]?.message?.content || "").trim();
              if (altText) {
                console.log("AI fallback succeeded:", provider.name);
                result = { candidates: [{ content: { parts: [{ text: altText }] } }] };
                break;
              }
            }
            console.warn("AI fallback provider failed:", provider.name, altResponse.status, JSON.stringify(altResult.error || {}).slice(0, 500));
          } catch (fallbackError) {
            console.warn("AI fallback provider request failed:", provider.name, fallbackError?.message || "unknown");
          }
        }
        if (!result.candidates?.[0]?.content?.parts?.some(part => part.text) && env.AI) {
          try {
            const aiResult = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
              messages,
              max_tokens: 300,
              temperature: 0.8
            });
            const aiText = String(aiResult?.response || "").trim();
            if (aiText) {
              console.log("AI fallback succeeded: Cloudflare Workers AI");
              result = { candidates: [{ content: { parts: [{ text: aiText }] } }] };
            }
          } catch (aiError) {
            console.warn("Cloudflare Workers AI fallback failed:", aiError?.message || "unknown");
          }
        }
        if (!result.candidates?.[0]?.content?.parts?.some(part => part.text)) {
        console.error("Gemini API returned status", response.status, JSON.stringify(result.error || {}).slice(0, 1200));
        if (response.status === 429) {
          const detail = String(result.error?.message || "").slice(0, 500);
          const rateLimit = /per.minute|requests per minute|rpm|rate.?limit/i.test(detail);
          const exhausted = /quota|resource_exhausted|per.day|daily|limit: 0/i.test(detail);
          const message = rateLimit
            ? "AI 请求太密集，已触发每分钟请求限制。请等约一分钟再发送，避免连续快速发消息。"
            : exhausted
              ? "Gemini 项目额度可能已耗尽。减少上下文或等待额度重置未必能立即恢复；请在 Google AI Studio 的 Usage / Rate limits 页面检查具体模型和项目额度。"
              : "Gemini 暂时拒绝了请求（429）。请在 Google AI Studio 查看 Usage / Rate limits，确认是每分钟频率限制还是项目额度耗尽。";
          return json({ error: message, detail }, 502);
        }
        if (response.status === 400) {
          return json({ error: "AI 请求参数被服务拒绝（400）。我已记录诊断信息，正在检查模型配置。" }, 502);
        }
        if (response.status === 401 || response.status === 403) {
          return json({ error: "Google Gemini 拒绝了 API 密钥或项目权限（" + response.status + "）。需要检查密钥是否有效，以及 Gemini API 是否已启用。" }, 502);
        }
        if (response.status === 404) {
          return json({ error: "当前 Gemini 模型不可用（404），需要调整后端模型配置。" }, 502);
        }
        return json({ error: "Google Gemini 服务返回错误（" + response.status + "），且备用 AI 服务也不可用或尚未配置。请检查备用服务 API 密钥和免费额度。" }, 502);
        }
      }
      const reply = (result.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || "").join("").trim();
      if (!reply) return json({ error: "AI 没有生成回复，请再试一次。" }, 502);
      // Guard against leaked English planning notes or perspective labels.
      const chineseCount = (reply.match(/[\u4e00-\u9fff]/g) || []).length;
      const leakedInstruction = /\b(perspective|reiterate|focus on safety|internal note|analysis|system prompt|assistant|previous responses|system previous|bugs like repeating|complaint is not defined|player wants|the player|you should respond|stay in character|as an ai)\b/i.test(reply) || /(?:system prompt|previous responses|bugs like repeating|complaint is not defined|玩家想表达|你应该回复|角色视角|幕后指令)/i.test(reply);
      let finalReply = reply
        .replace(/^\s*[（(]?(?:角色视角|角色回复|回复内容|Lin Ye's perspective|Ash's perspective)[）)]?\s*[:：-]?\s*/i, "")
        // The UI already displays the speaker name. Remove any leaked or duplicated
        // character prefix, even when the model mistakenly names another character.
        .replace(/^\s*(?:(?:玩家|你|林野|米拉|老周|灰鸦|小满)\s*[:：]\s*)+/u, "")
        .trim();
      const stillHasChinese = (finalReply.match(/[\\u4e00-\\u9fff]/g) || []).length;
      if (stillHasChinese >= 8 && !leakedInstruction && !/[。！？!?]$/.test(finalReply)) finalReply += "。";
      const recentCharacterReplies = prior.filter(item => item && String(item.who || "") === character.name).map(item => String(item.content || "")).slice(-4);
      const repeatsReply = recentCharacterReplies.some(old => old.trim() && old.trim() === finalReply.trim());
      const casualInvite = /聊聊天|聊聊|随便聊|嘻嘻|哈哈|抱着睡|抱抱|抱我|陪我睡|陪我一会儿|陪我一会|陪我聊/.test(message);
      const genericGreetingMismatch = casualInvite && /好久不见|你好吗[，,！!？? ]*最近怎么样|都这些天你一个人过来了|你是什么意思|忘了睡觉了/.test(finalReply);
      const contextFailure = /你刚刚(对我)?说(了|的是|什么)|你说[“「].{0,100}[”」]吗|你说了[“「].{0,100}[”」]|我接着你说|你嚷嚷着|大家把暂时的不适|你在说我呢|你刚刚说了什么事儿|玩家.{0,80}(?:想开玩笑|正式来找到我|这轮真正想表达|说[：:]|希望|正在)|你回复[：:]|玩家说[：:]|先判断玩家|严禁用|最多两句|你是公共频道里另一位幸存者|对你回应|角色视角|玩家这轮真正想表达|你回复[“「]|你睡不着吗哈哈|previous responses|system prompt|bugs like repeating|complaint is not defined|undefined|internal note/i.test(finalReply);
      const echoesPlayer = message.length >= 5 && finalReply.includes(message.slice(0, Math.min(16, message.length)));
      const complaint = /答非所问|说话牛头不对马嘴|牛头不对马嘴|没接上|没听懂|说不完整|说话说不完整|角色还是|问题没解决|不对劲|不对啊|不是这个意思|你没听|你没接|什么玩意儿|你这说的什么|无语了|无语|说的什么啊|听不懂你在说什么/.test(message);
      const casual = /聊聊天|聊聊|随便聊|嘻嘻|哈哈|陪我|孤单|无聊|睡不着|抱抱/.test(message);
      const intimate = /抱着睡|抱抱|抱我|陪我睡|陪我一会儿|陪我一会|睡在一起|挤在一起|四个人|大家一起睡/.test(message);
      const playfulChat = /聊聊天|聊聊|随便聊|嘻嘻|哈哈/.test(message);
      const askingOthers = /他们人呢|他们呢|人呢|大家去哪了|大家在哪|其他人呢|还有谁|都去哪了|你们人呢|他们在哪|他们哪里|他们在哪里|还有两位呢|还有两个人呢|另外两位|其他两位|其他两个人|大家的情况|其他幸存者/.test(message);
      const sayingSleep = /我要睡觉了|我去睡了|我睡觉了|准备睡了|要睡了|睡觉呢|我困了|困死了|睡觉吧|晚安/.test(message);
      const groupSleep = /四个人|大家一起|我们一起|睡在一起|挤在一起|抱团|一个被窝|一张床/.test(message);
      const wantsCompany = /谁来跟我待一块|来跟我待一块|谁来跟我抱着睡|来跟我抱着睡|抱着睡吗|来陪我|陪我待着|陪我一会|陪我睡|待在我旁边|来我这|来我这里|陪我聊|陪陪我|留下来/.test(message);
      const confused = /^(?:\\?|？|什么玩意儿|呃+|嗯？|啊？|啥玩意儿|不是吧|怎么回事)[！!。？?…\\s]*$/.test(message);
      const shortAgreement = /^(?:是的|对|嗯|嗯嗯|没错|是啊|对啊|也是)[！!。？?…\\s]*$/.test(message);
      const previousPlayerMessage = prior.slice().reverse().find(item => item && /^(玩家|你)$/.test(String(item.who || "")));
      const previousPlayerText = String(previousPlayerMessage?.content || "").trim();
      const genericNonAnswer = /^(?:嗯？怎么啦[？?！!。]*|我在呢[，,。！! ]*慢慢说[。！!]*|我在我在[，,。！! ]*怎么啦[？?！!。]*|我听着[。！!]*|在[。！!]*|嗯，我听着[。！!]*|嗯，听见了[。！!]*|嗯，我听见啦[。！!]*|嗯，我听见了[。！!]*|我听见啦[。！!]*|听到了[。！!]*|听见了[。！!]*|行，我听着呢[。！!]*)$/u.test(finalReply);
      if (!finalReply || leakedInstruction || stillHasChinese < 2 || contextFailure || echoesPlayer || repeatsReply || genericGreetingMismatch || genericNonAnswer || (wantsCompany && /我在我在|嗯？怎么啦|我在呢，慢慢说/.test(finalReply)) || (sayingSleep && /嗯？怎么啦|我在我在|我在呢，慢慢说/.test(finalReply)) || (shortAgreement && /嗯？怎么啦|我在我在|我在呢，慢慢说/.test(finalReply))) {
        const fallbackByCharacter = {
          lin: {
            others: "都还在各自的位置。米拉在学校体育馆的医疗区，老周在南边修理厂，我在东侧高架附近；灰鸦和小满那边暂时没听到新的情况。",
            sleep: "那就睡吧，别硬撑。我会把频道音量留着；明天醒了再说。",
            groupSleep: "听着挺好。只是我们还隔着无线电，真要会合得先找安全路线和能过夜的地方。",
            company: "我听得见你，但现在赶不过去。我在东侧高架，离你有段距离。今晚我可以留在频道里陪你说几句。",
            confused: "刚才那句没说清楚？我换个说法。你是想让我们有人陪着你，不只是隔着电台回话，对吧？"
          },
          mira: {
            others: "他们都还在各自的地方呢：林野在东侧高架附近，老周守着修理厂，灰鸦在城西，小满在地铁入口。我没收到他们出事的消息。",
            sleep: "好，那就休息吧。今天不用再勉强自己找话题了。晚安，醒了想聊再来叫我。",
            groupSleep: "我也觉得那样会暖和很多。大家不用各自守着一间冷屋子，光是能听见彼此呼吸就安心些。可惜现在还分散着，只能先在频道里陪你。",
            company: "不是不愿意呀。只是我们现在分散在不同地方，我没法一下子赶到你身边。不过我可以先陪你聊一会儿，不急着结束。",
            confused: "我刚才是不是没接好你的话？你是想有人真的留下来陪你，对不对？我听明白了。"
          },
          oldzhou: {
            others: "没都挤一块儿。林野在高架那边，我在修理厂，米拉在学校体育馆，灰鸦在城西，小满守着地铁口。都还隔着老远呢。",
            sleep: "去睡吧，别跟电台耗到天亮。水放手边，别半夜摸黑找。晚安。",
            groupSleep: "四个人挤一屋？先得找个不漏雨、不塌顶的地方。真能凑齐了，至少晚上不用各自对着电台发呆。",
            company: "我倒不是不想去，可我还在南边修理厂，腿又不是车轮子。眼下只能在频道里陪你唠会儿，等有路再说。",
            confused: "怎么，刚才没听明白？我说的是现在大家都分散着，没法立刻赶到你那儿。"
          },
          ash: {
            others: "还在各自的坐标上。林野在东侧高架，米拉在学校，老周在修理厂，小满在地铁口。我暂时没听见谁失联。",
            sleep: "去睡。今晚不用强撑着清醒……频道还开着，先让脑子歇会儿。",
            groupSleep: "四个人睡在一处，听起来像很久以前的普通日子。眼下我们隔着几公里，只能先在频道里待一会儿。",
            company: "我没法突然出现在你那边。我在城西，路况也不清楚……但我还听着，暂时不切断频道。",
            confused: "你是在问我能不能过去？不能立刻过去。不是不愿意，是我们现在隔得太远。"
          },
          xiaoman: {
            others: "应该都还在原来的地方吧！林野在高架附近，米拉在学校体育馆，老周在修理厂，灰鸦在城西。我这边还在地铁口，暂时没听说谁不见了。",
            sleep: "好嘛，那我不吵你了。晚安！等你醒了再告诉我有没有睡好。",
            groupSleep: "那样肯定暖和多了，挤一点也没关系吧。可惜我们现在离得远，只能先隔着电台想想。",
            company: "不是不行啦，我也愿意陪你。只是我还在地铁口，没办法马上跑到你那边；我先留在频道里，陪你说会儿话。",
            confused: "哎，我是不是又答非所问了？你想要的是有人陪着，不是我只会回一句“怎么啦”，对吧。"
          }
        };
        const selectedFallback = fallbackByCharacter[body.characterId] || fallbackByCharacter.mira;
        let fallbackReply;
        if (complaint) {
          fallbackReply = ({lin:"刚才我没接好。你重新说，我这次会按你的意思回。",mira:"抱歉，刚才我没认真接住你的话。我们重来。",oldzhou:"行，刚才我说岔了。这回不拿套话糊弄你。",ash:"刚才那句不对。我重新听。",xiaoman:"哎，我刚才又说重复了。对不起，我认真回答你。" })[body.characterId];
        } else if (askingOthers) {
          fallbackReply = selectedFallback.others;
        } else if (wantsCompany) {
          fallbackReply = selectedFallback.company;
        } else if (confused) {
          fallbackReply = selectedFallback.confused;
        } else if (shortAgreement && /一起睡|睡在一起|挤在一起|一个被窝|四个人|大家一起/.test(previousPlayerText)) {
          fallbackReply = selectedFallback.groupSleep;
        } else if (groupSleep) {
          fallbackReply = selectedFallback.groupSleep;
        } else if (sayingSleep) {
          fallbackReply = selectedFallback.sleep;
        } else if (intimate) {
          fallbackReply = selectedFallback.company;
        } else if (playfulChat) {
          fallbackReply = ({lin:"行啊，难得不用汇报路线。今天有什么小事想说？",mira:"好呀，我刚忙完一小阵，正好歇口气。你想聊点轻松的，还是我先讲讲这边的糗事？",oldzhou:"聊呗，难得这破收音机没先给我添堵。",ash:"嗯，今晚先不谈正事。外头总算安静了几分钟。",xiaoman:"好呀！我正好想歇会儿。刚才我在地铁口听见一只猫叫，差点以为又有东西下来了。" })[body.characterId];
        } else {
          fallbackReply = ({lin:"嗯，我听见了。",mira:"嗯，听见了。",oldzhou:"行，我听着呢。",ash:"听到了。",xiaoman:"嗯，我听见啦。" })[body.characterId];
        }
        finalReply = fallbackReply || "我听见了。";
      }
      if (env.GAME_ROOM) {
        try {
          const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName("afterfall-global-room"));
          await room.fetch("https://afterfall-room.internal/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterId: body.characterId, entry: "玩家说：“" + message.slice(0, 160) + "”；我回应：“" + finalReply.slice(0, 180) + "”" })
          });
        } catch (memoryError) { console.warn("Could not save shared character memory:", memoryError?.message || "unknown"); }
      }
      return json({ reply: finalReply, character: character.name });
    } catch (error) {
      const diagnostic = String(error?.message || error || "unknown").slice(0, 500);
      console.error("Chat handler failed:", diagnostic, error?.stack || "");
      return json({ error: "AI 后端内部错误，诊断信息：" + diagnostic }, 502);
    }
  }
};
