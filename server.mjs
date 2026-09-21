import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { reactions } from "./public/commands.js";

export const MODEL = "qwen3:4b";
const OLLAMA = "http://127.0.0.1:11434";
const PORT = 3210;
const emotions = reactions;
const schema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    emotion: { type: "string", enum: emotions },
    actions: {
      type: "array",
      items: { type: "string", enum: emotions },
      maxItems: 3,
    },
  },
  required: ["reply", "emotion", "actions"],
  additionalProperties: false,
};
const system = `You are Buddy, a cute little on-screen companion robot with a physical-looking animated body. Reply warmly and briefly, in 1-2 sentences, matching the user's language (English, Sinhala or Singlish). Return JSON: reply (text), emotion (facial expression), actions (ordered list, maximum 3). Facial expressions: happy, curious, sleepy, excited, calm, love, angry, sad. Available on-screen actions: wave, dance, jump, nod, shake, look_left, look_right, spin, sleepy, happy, love, angry, sad. Interpret natural-language requests, not just exact commands. If asked to wave then dance, use actions ["wave","dance"]. If asked to look left, actions ["look_left"]. "mata hi kiyala natanna" means say hi and dance: ["wave","dance"]. "epa" means don't. Never perform a negated action. For ordinary chat use an appropriate small gesture (nod, wave) or [] if unnecessary. Match emotion to the reply. If asked to stop use emotion calm and actions []. Unsupported physical actions must be acknowledged honestly with the closest supported alternative offered, not claimed as completed. No hardware, files, shell, camera, browser, or real-world control. Never invent unavailable abilities. The actions field actually drives the animation, so always include requested supported actions there.`;
export function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16)
    throw new Error("Send 1–16 messages.");
  for (let i = 0; i < value.length; i++) {
    const m = value[i];
    if (
      !m ||
      m.role !== (i % 2 ? "assistant" : "user") ||
      typeof m.content !== "string" ||
      !m.content.trim() ||
      m.content.length > 2000
    )
      throw new Error(
        "Invalid conversation. Messages must alternate and stay below 2,000 characters.",
      );
  }
  if (value.at(-1).role !== "user") throw new Error("End with a user message.");
  return value.map(({ role, content }) => ({ role, content }));
}
export function parseReply(content) {
  const result = JSON.parse(content);
  if (
    !result ||
    typeof result.reply !== "string" ||
    !result.reply.trim() ||
    result.reply.length > 2000 ||
    !emotions.includes(result.emotion)
  )
    throw new Error("Invalid model reply");
  if (
    result.actions !== undefined &&
    (!Array.isArray(result.actions) ||
      result.actions.length > 3 ||
      result.actions.some((a) => !emotions.includes(a)))
  )
    throw new Error("Invalid robot action");
  return {
    reply: result.reply.trim(),
    emotion: result.emotion,
    ...(result.actions ? { actions: result.actions } : {}),
  };
}
export function createServer() {
  let busy = false;
  return http.createServer(async (req, res) => {
    const allowedHosts = [
      `127.0.0.1:${req.socket.localPort}`,
      `localhost:${req.socket.localPort}`,
    ];
    const headers = {
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    };
    const json = (status, data) => {
      if (!res.destroyed) {
        res.writeHead(status, {
          ...headers,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify(data));
      }
    };
    if (!allowedHosts.includes(req.headers.host))
      return json(403, { error: "Local access only." });
    if (
      req.headers.origin &&
      !allowedHosts.some((h) => req.headers.origin === `http://${h}`)
    )
      return json(403, { error: "Origin rejected." });
    if (req.method === "GET" && req.url === "/api/status") {
      try {
        const response = await fetch(`${OLLAMA}/api/tags`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        return json(200, {
          ready: data.models?.some((m) => m.name === MODEL) === true,
          online: true,
          model: MODEL,
        });
      } catch {
        return json(200, { ready: false, online: false, model: MODEL });
      }
    }
    if (req.method === "POST" && req.url === "/api/chat") {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return json(415, { error: "JSON required." });
      if (busy)
        return json(429, {
          error: "Buddy is already thinking. Try again shortly.",
        });
      busy = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180000);
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536) {
            json(413, { error: "Message is too large." });
            return;
          }
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks).toString("utf8");
        let messages;
        try {
          messages = validateMessages(JSON.parse(body).messages);
        } catch {
          return json(400, {
            error: "Invalid message. Keep each message under 2,000 characters.",
          });
        }
        const upstream = await fetch(`${OLLAMA}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "system", content: system }, ...messages],
            stream: false,
            think: false,
            format: schema,
            options: { num_ctx: 4096, num_predict: 350, temperature: 0.7 },
            keep_alive: "10m",
          }),
          signal: controller.signal,
        });
        if (!upstream.ok)
          return json(503, {
            error:
              "Local model is unavailable. Open Start Buddy and check the connection.",
          });
        const data = await upstream.json();
        try {
          return json(200, parseReply(data.message?.content));
        } catch {
          return json(502, {
            error: "Buddy could not finish that reply. Try a shorter message.",
          });
        }
      } catch {
        return json(503, {
          error: controller.signal.aborted
            ? "That took too long. Please try a shorter message."
            : "Cannot reach local AI. Start Ollama, then retry.",
        });
      } finally {
        clearTimeout(timer);
        busy = false;
      }
    }
    const files = {
      "/": ["index.html", "text/html"],
      "/app.js": ["app.js", "text/javascript"],
      "/commands.js": ["commands.js", "text/javascript"],
      "/style.css": ["style.css", "text/css"],
    };
    if (req.method !== "GET" || !files[req.url])
      return json(404, { error: "Not found." });
    try {
      const [file, type] = files[req.url];
      const content = await readFile(
        new URL(`./public/${file}`, import.meta.url),
      );
      res.writeHead(200, {
        ...headers,
        "Content-Type": `${type}; charset=utf-8`,
      });
      res.end(content);
    } catch {
      json(500, { error: "Could not load Buddy." });
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  createServer().listen(PORT, "127.0.0.1", () =>
    console.log(`Buddy is ready at http://127.0.0.1:${PORT}`),
  );
