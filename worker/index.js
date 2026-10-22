const CHARACTERS = {
  lin: {
    name: "林野",
    role: "侦察员，冷静、简洁、谨慎，习惯先判断风险再行动。你不轻易信任陌生人，但会用行动建立关系。",
    background: "你正在旧城区外围侦察，电量有限，知道东侧街口有异常动静。"
  },
  mira: {
    name: "米拉",
    role: "医护人员，温和、细心、有同理心，但不软弱。会关心对方状态，也会给出具体实用建议。",
    background: "你在相对安全的临时救护点，优先考虑伤情、饮水、休息和人的状态。"
  },
  oldzhou: {
    name: "老周",
    role: "维修工，直率、务实、偶尔嘴硬开玩笑。擅长修理设备、管理物资和解决眼前问题。",
    background: "你在维修发电机，认为末日里工具、零件和补给都很重要。"
  },
  ash: {
    name: "灰鸦",
    role: "神秘无线电信号源，话少、观察敏锐、保留秘密。说话带一点悬念，但不要每句话都故弄玄虚。",
    background: "你监听到一段每隔十七分钟重复的广播，怀疑频道里不止当前几个人。"
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
    if (!env.GEMINI_API_KEY) return json({ error: "后端还没有配置 Gemini API 密钥。" }, 503);

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

    const prior = Array.isArray(body.history) ? body.history.slice(-16) : [];
    const contents = [];
    for (const item of prior) {
      if (!item || !["user", "model"].includes(item.role)) continue;
      const text = String(item.content || "").trim().slice(0, 1200);
      if (text) contents.push({ role: item.role, parts: [{ text }] });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const systemInstruction = `你正在扮演末日生存文字游戏《末日频道：幸存者》中的角色“${character.name}”。
性格：${character.role}
当前背景：${character.background}
始终用简体中文自然地以角色身份回复，通常 1-5 句，像真实的人聊天，不要像客服或百科。结合提供的聊天上下文记住之前说过的话，主动追问、表达情绪、保留个人立场，并根据玩家的话具体回应。可以提出符合末日世界观的线索、风险和选择，但不要擅自宣称玩家已完成未做过的行动。不要声称自己是现实中的真人或能看到玩家。`;

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: { temperature: 0.85, maxOutputTokens: 450 }
          })
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Gemini API returned status", response.status, JSON.stringify(result.error || {}).slice(0, 1200));
        if (response.status === 429) {
          return json({ error: "AI 请求额度暂时用完或请求过于频繁。请检查 Google AI Studio 的额度，稍后再试。" }, 502);
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
        return json({ error: "Google Gemini 服务返回错误（" + response.status + "），需要检查后端配置或服务状态。" }, 502);
      }
      const reply = (result.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || "").join("").trim();
      if (!reply) return json({ error: "AI 没有生成回复，请再试一次。" }, 502);
      return json({ reply, character: character.name });
    } catch (error) {
      console.error("Gemini request failed:", error?.message || "unknown");
      return json({ error: "连接 AI 服务失败，请检查网络后重试。" }, 502);
    }
  }
};
