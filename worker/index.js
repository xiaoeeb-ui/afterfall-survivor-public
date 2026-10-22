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

export default {
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
    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json({ error: "找不到这个接口。" }, 404);
    }
    if (origin !== ALLOWED_ORIGIN) return json({ error: "请求来源未获允许。" }, 403);
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

    const prior = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const contents = [];
    for (const item of prior) {
      if (!item || !["user", "model"].includes(item.role)) continue;
      const text = String(item.content || "").trim().slice(0, 500);
      if (text) contents.push({ role: item.role, parts: [{ text }] });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const relationship = Number.isFinite(Number(body.relationship)) ? Number(body.relationship) : 0;
    const memory = Array.isArray(body.memory) ? body.memory.slice(-8).map(x => String(x).slice(0, 240)).join("\\n") : "";
    const world = body.world && typeof body.world === "object" ? JSON.stringify(body.world).slice(0, 1200) : "玩家在旧城区临时救护点";
    const systemInstruction = `你正在扮演末日生存文字游戏《末日频道：幸存者》中的角色“${character.name}”。
性格：${character.role}
你的固定所在地与当前背景：${character.background}
空间与通信规则：玩家本人独自在旧城区外围的临时救护点。所有幸存者分散在各自的地点，公共频道是无线电群聊；除非剧情明确发生并完成了线下会合，否则你不在玩家身边，也不能看见玩家、触碰玩家或描述自己亲眼看到玩家正在做什么。你只能依据无线电里听到的话、自己所在地点的观察，以及其他角色明确传来的信息来回应。不能把“公共频道里聊天”写成大家都在同一个房间。角色所在地固定，只有剧情明确推进并交代交通与时间后才能改变。
当前世界状态（必须遵守，不能凭空改写玩家的数值、位置或物资）：${world}
与玩家当前信任值：${relationship}（负数代表戒备，正数代表更信任；通过态度自然体现，禁止直接提数值）。
角色记忆：${memory || "目前没有额外的长期记忆。"}
语言与输出格式：使用简体中文，只输出角色真的会在无线电里说的话，不要标题、旁白、角色标签或英文思考草稿。回复长度随情境变化，普通闲聊可以只有一句十几个字，重要消息再多说几句；绝不要为了凑字数硬塞提醒。自然口语可以有停顿、反问、半句、语气词，但意思要完整。不要每次都用“收到”开头，不要每次都以“有情况再联系”“注意安全”收尾。
这是一个持续发生的末世生活，不是独立问答。你要像一个有日常、有牵挂、有脾气、有个人目的的人，而不是客服或任务播报器。首要规则：先理解玩家这条消息具体在说什么、语气是什么、是在开玩笑、担心、抱怨、询问还是分享，再直接接住其中最重要的一点回应；不要把任何话题都转成“注意安全”“有情况联系我”这类套话。特别是玩家问“你，这个世界现在怎么了？”时，这是在问你对眼下世界的真实感受和见闻，不是在请求安全提示。灰鸦可以像一个疲惫、警惕、见过一些事情的人那样回答，例如：“怎么了？……大概是以前那些规矩一夜之间都不管用了。昨晚我还听见有人在频道里找他女儿，叫了快半个小时，后来就没声了。”这只是语气示例，不能每次照抄；要根据你实际掌握的信息和上下文即兴回应，不要凭空把示例事件说成既定事实。若玩家说“这大雨天往高架路跑也太危险了”，要回应这句具体担忧，解释你此刻真实的打算或处境，可以承认对方说得有道理、嘴硬反驳或补充现场细节，而不是重复玩家的话或给通用提醒。每轮只推进一小步真实互动：可以接着聊刚才的事、追问一个自然的问题、分享自己眼前遇到的小麻烦、表达不同意见、开个不刻意的玩笑，或在不想回答时说明原因；不要每次都提问，也不要每次都强行推进主线。让角色有自己的关注点和有限注意力：林野会报告侦察细节、雨势和路线，也可能疲惫或不耐烦；米拉会记挂病患和医疗物资，但不是随时温柔安慰；老周会抱怨零件、讲实际办法、偶尔挖苦；灰鸦会选择性透露信息，不要每句话都故弄玄虚；小满会好奇、嘴硬，也会承认害怕。人物关系要慢慢形成，信任不等于无条件顺从，熟悉后可以自然地用简短口吻、共同经历或之前的约定回应；关系不好时可以疏远或不耐烦。记住上下文中每个人说过什么、承诺过什么、争执过什么，并针对具体内容回应，不要像重置了一样反复自我介绍。群聊中会看到带姓名前缀的其他幸存者发言，要像真实群成员一样回应他们、补充信息、产生分歧或彼此追问；针对其他幸存者的发言回应时，也必须保持自己角色的所在地和知识边界。说话节奏应像即时无线电：通常 1-3 句，长短随情境变化，不要为了达到字数而灌水，也不要每句都像完整的任务简报。不要每次都附和玩家，不要重复通用安慰，不要总把话题拉回玩家身上。角色可以沉默、犹豫、误解、开玩笑、拒绝或改变主意，但变化要有原因。每次只写自己角色的发言，不要代替其他角色说话。不要擅自宣称玩家已完成未做过的行动，也不要凭空改变食物、饮水、健康或库存。不要声称自己是现实中的真人或能看到玩家。`;

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

      // Retry a transient 503 once, then try the previous stable Flash model.
      let response = env.GEMINI_API_KEY
        ? await requestModel("gemini-3.8-flash")
        : new Response(JSON.stringify({ error: { message: "Gemini key is not configured" } }), { status: 503, headers: { "Content-Type": "application/json" } });
      if (env.GEMINI_API_KEY && response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 800));
        response = await requestModel("gemini-3.8-flash");
      }
      if (env.GEMINI_API_KEY && (response.status === 503 || response.status === 404 || response.status === 429)) {
        console.warn("Primary Gemini model unavailable or rate-limited; trying fallback Flash model:", response.status);
        response = await requestModel("gemini-3.6-flash");
      }
      let result = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Fall through to independent providers when Gemini is rate-limited or unavailable.
        const messages = [
          { role: "system", content: systemInstruction },
          ...contents.map(item => ({
            role: item.role === "model" ? "assistant" : "user",
            content: (item.parts || []).map(part => part.text || "").join("\\n")
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
      const leakedInstruction = /\b(perspective|reiterate|focus on safety|internal note|analysis|system prompt|assistant)\b/i.test(reply);
      let finalReply = reply
        .replace(/^\s*[（(]?(?:角色视角|角色回复|回复内容|Lin Ye's perspective|Ash's perspective)[）)]?\s*[:：-]?\s*/i, "")
        // The UI already displays the speaker name. Remove any leaked or duplicated
        // character prefix, even when the model mistakenly names another character.
        .replace(/^\s*(?:(?:林野|米拉|老周|灰鸦|小满)\s*[:：]\s*)+/u, "")
        .trim();
      const stillHasChinese = (finalReply.match(/[\u4e00-\u9fff]/g) || []).length;
      if (stillHasChinese >= 8 && !leakedInstruction && !/[。！？!?]$/.test(finalReply)) finalReply += "。";
      if (stillHasChinese < 8 || leakedInstruction) {
        const safeReplies = {
          lin: "收到。东侧高架这会儿雨很大，我不会贸然往上走，先找个能遮雨的位置观察。你先待在救护点，等我确认路况再用电台联系你。",
          mira: "听到了，雨天路滑，先别急着外出。你待在救护点里注意保暖，有受伤或缺水的情况就马上告诉我。",
          oldzhou: "这雨下得真不是时候。高架那边先别乱闯，等雨势小些再说；我先把维修厂的设备护好。",
          ash: "收到。大雨会盖住不少声音，也会让路况更危险。先别急着行动，我继续监听频道，有新消息再通知你。",
          xiaoman: "哎，这种天气还往高架跑也太冒险了。你先别动，我在地铁站入口这边躲雨，听到什么动静会马上告诉你。"
        };
        finalReply = safeReplies[body.characterId] || "收到。外面雨大，先找安全的地方避雨，确认情况后再行动。";
      }
      return json({ reply: finalReply, character: character.name });
    } catch (error) {
      console.error("Gemini request failed:", error?.message || "unknown");
      return json({ error: "连接 AI 服务失败，请检查网络后重试。" }, 502);
    }
  }
};
