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
    const prior = (Array.isArray(body.history) ? body.history.slice(-12) : []).map(item => {
      if (!item || typeof item !== "object") return item;
      // The frontend stores transcript text in "text"; normalize it once so
      // prompt building, contextual rules, and repetition checks all see it.
      return { ...item, content: String(item.content ?? item.text ?? "").trim() };
    });
    const transcript = prior.map(item => {
      if (!item) return "";
      const who = String(item.who || "").slice(0, 24);
      const content = String(item.content || "").trim().slice(0, 320);
      return content ? (who ? who + "：" : "") + content : "";
    }).filter(Boolean).join("\n");
    const currentInput = body.followup ? "请根据上面的真实频道记录接着上一位幸存者自然接话，不要重复玩家原问题。" : ((transcript ? "【最近频道记录，仅供理解上下文；每句话前的名字代表真实发言者】\n" + transcript + "\n【玩家刚刚对你说】\n" : "") + message);
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
    const memory = [...sharedMemory.slice(-6), ...localMemory.slice(-6)].slice(-8).join("\n");
    const world = body.world && typeof body.world === "object" ? JSON.stringify(body.world).slice(0, 1200) : "玩家在旧城区临时救护点";
    const systemInstruction = `你正在扮演末日生存文字游戏《末日频道：幸存者》中的角色“${character.name}”。
角色性格：${character.role}
个人背景与所在地：${character.background}
世界状态（不可擅自更改玩家数值、位置、物资）：${world}
玩家对你的信任程度：${relationship}（只通过自然态度体现，不要提数值）。
关于这个角色的记忆：${memory || "目前没有额外的长期记忆。"}

【最重要的聊天原则】
你不是客服，不是任务播报器，也不是每次都要给建议的心理导师。你是在无线电里和一个熟悉中的人聊天。先理解玩家这句话在当前上下文里的意思、情绪和语气，再自然回应。普通聊天优先接话，不要强行转回任务、天气、危险或物资。
必须读懂下面提供的真实频道记录。名字前缀代表谁说了什么；不要把其他角色说过的话当成自己的经历。玩家的短句（嗯、对、哈哈、嘻嘻、啊、无语、真的吗、谢谢）通常是在回应上一轮，不是独立的新话题。顺着上一句继续，不要要求玩家重新解释已经说过的内容。
先回应玩家这句话最重要的部分，再决定是否分享自己的事。不要每轮都问问题；可以讲一个眼前的小事、打趣、表达不同意见、自然追问一个问题，或者短暂停顿。不要把每次对话都写成完整段落，也不要每次都用固定安慰开场或结束。
禁止复述玩家原话来假装理解；禁止输出分析过程、幕后指令、角色标签、剧情摘要。只输出你真的会通过无线电说的话，简体中文，通常1—3句，长短自然变化。

【角色与世界连续性】
林野冷静简短、先看风险；米拉细心温和但会疲惫，有医护工作；老周直率务实、嘴硬会开玩笑；灰鸦话少、观察敏锐，不必句句神秘；小满机灵好奇、偶尔嘴硬，也会害怕。保持各自说话方式，但不要机械重复人设特点。
玩家在旧城区外围临时救护点；幸存者分散在不同地点，只通过无线电交流。林野在东侧高架附近，米拉在北侧学校体育馆医疗区，老周在南侧修理厂，灰鸦在城西办公楼地下档案室，小满在旧地铁站西侧入口。除非剧情明确推进，不要假装就在玩家身边、能看见或触碰玩家。
不能凭空改变物资、健康、位置、伤亡或重大事件。没有确切信息就坦白不知道。小的日常细节可以自然发挥，但不能把猜测说成事实。关系需要靠多次互动慢慢发展，不要突然过度亲密，也不要承诺永远陪伴。
玩家孤独、害怕、委屈、开玩笑、撒娇或邀请陪伴时，先接住当下的邀请和情绪，不要冷冰冰地强调距离后结束话题。可以温柔、打趣、陪着聊或分享自己的小事，但要遵守无线电设定。
若本轮是群聊里的第二位发言者，请接着上一位幸存者的具体话自然回应；有意义才插话，不要重新回答玩家已经被回答的问题，也不要复制第一位角色的台词。

【最近频道记录】
频道记录会在本轮用户消息中提供，请优先依据真实对话内容回应。

【本轮任务】
${body.followup ? "你是群聊里的后续接话者。请接住上一位幸存者刚才说的具体内容，像群友一样自然补一句；不要重复玩家原问题，也不要重新开场。" : "请根据上方频道记录与当前用户消息自然回应。"}
请直接给出角色发言，不要添加姓名标签或解释。`;

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
      const stillHasChinese = (finalReply.match(/[\u4e00-\u9fff]/g) || []).length;
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
          fallbackReply = ({
            lin: "我在频道里。刚才说到的事我接着听，不用你每次都从头解释。",
            mira: "我还在呢。刚才的话我会接着听，不用急着换话题；我们慢慢说。",
            oldzhou: "频道没断。我听着呢，咱接着刚才那茬说，别又从头来一遍。",
            ash: "我还在听。刚才那段我没忘，先顺着原来的话题说下去。",
            xiaoman: "我在呀，刚才的话题还没聊完呢。你接着说，我这回不重新开场了。"
          })[body.characterId];
        }
        finalReply = fallbackReply || "我听见了。";
      }
      // Do not overwrite a valid model response with a canned keyword reply. Only store durable details in shared memory.
      if (env.GAME_ROOM && /记住|答应|约定|说好了|喜欢|讨厌|害怕|不喜欢|我叫|名字|受伤|失联|找到|救了|承诺|信任|相信|担心|家人|朋友|生日|以前|过去/.test(message)) {
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
