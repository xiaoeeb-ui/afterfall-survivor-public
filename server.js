const http = require("node:http");

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.OPENAI_API_KEY;
const AI_BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://xiaoeeb-ui.github.io";

const characters = {
  lin: {
    name: "林野",
    role: "侦察员，冷静、简洁、谨慎，习惯先判断风险再行动。你不轻易信任陌生人，但会用行动建立关系。",
    memory: "你在旧城区外围侦察，电量有限，了解东侧街口有异常动静。"
  },
  mira: {
    name: "米拉",
    role: "医护人员，温和、细心、有同理心，但不软弱。会关心对方状态，也会给出具体实用建议。",
    memory: "你在相对安全的临时救护点，优先考虑人的身体状况、饮水、休息与伤情。"
  },
  oldzhou: {
    name: "老周",
    role: "维修工，直率、务实、偶尔嘴硬开玩笑。擅长修理设备、管理物资和解决眼前问题。",
    memory: "你在维修发电机，认为末日里工具、零件和补给都很重要。"
  },
  ash: {
    name: "灰鸦",
    role: "神秘无线电信号源，话少、观察敏锐、保留秘密。说话带一点悬念，但不要每句话都故弄玄虚。",
    memory: "你监听到一段每隔十七分钟重复的广播，怀疑频道里不止当前几个人。"
  }
};

function sendJson(res, status, data, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || ALLOWED_ORIGIN;
  const allowed = origin === ALLOWED_ORIGIN;
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    });
    return res.end();
  }
  if (req.url === "/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, service: "afterfall-ai" }, allowed ? origin : ALLOWED_ORIGIN);
  }
  if (req.url !== "/api/chat" || req.method !== "POST") {
    return sendJson(res, 404, { error: "找不到这个接口。" }, allowed ? origin : ALLOWED_ORIGIN);
  }
  if (!allowed) return sendJson(res, 403, { error: "请求来源未获允许。" }, ALLOWED_ORIGIN);
  if (!API_KEY) return sendJson(res, 503, { error: "AI 服务还未配置密钥，请先在后端环境变量中设置 OPENAI_API_KEY。" }, origin);

  let raw = "";
  req.on("data", chunk => {
    raw += chunk;
    if (raw.length > 20000) req.destroy();
  });
  req.on("end", async () => {
    try {
      const body = JSON.parse(raw || "{}");
      const character = characters[body.characterId];
      const message = String(body.message || "").trim().slice(0, 500);
      if (!character) return sendJson(res, 400, { error: "请选择有效的幸存者。" }, origin);
      if (!message) return sendJson(res, 400, { error: "消息不能为空。" }, origin);
      const prior = Array.isArray(body.history) ? body.history.slice(-16) : [];
      const messages = [
        {
          role: "system",
          content: `你正在扮演末日生存文字游戏《末日频道：幸存者》中的角色。
角色：${character.name}。
性格：${character.role}
当前背景：${character.memory}
规则：始终以角色身份自然地用简体中文回复；通常回复 1-5 句，像真实的人聊天，不要像客服或百科；记住本次请求提供的对话上下文；主动追问、表达情绪、保留个人立场，并根据玩家说的话回应，不要每次都重复背景；可以提出符合末日世界观的线索、风险和选择，但不要擅自宣称玩家已经完成未做过的行动；不要声称自己是真实人类或现实中能看到玩家。`
        },
        ...prior.filter(m => m && (m.role === "user" || m.role === "assistant")).map(m => ({
          role: m.role,
          content: String(m.content || "").slice(0, 1000)
        })),
        { role: "user", content: message }
      ];
      const upstream = await fetch(AI_BASE_URL + "/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages,
          temperature: 0.85,
          max_tokens: 350
        }),
        signal: AbortSignal.timeout(45000)
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const detail = data && data.error && data.error.message;
        console.error("AI provider error", upstream.status, detail || "unknown");
        return sendJson(res, 502, { error: "AI 暂时没有回应，请稍后重试。" }, origin);
      }
      const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!reply) return sendJson(res, 502, { error: "AI 返回了空消息，请重试。" }, origin);
      return sendJson(res, 200, { reply: String(reply).trim(), character: character.name }, origin);
    } catch (err) {
      console.error("Chat request failed", err && err.message);
      return sendJson(res, 500, { error: "聊天请求暂时失败，请检查网络后重试。" }, origin);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => console.log("Afterfall AI server listening on " + PORT));
