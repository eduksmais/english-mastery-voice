// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// (opcional) CORS simples se você embutir em outro domínio
// import cors from "cors";
// app.use(cors());

app.get("/health", (_, res) => res.json({ ok: true }));

/**
 * POST /respond
 * Front envia { text }, servidor chama Groq com sua GROQ_API_KEY
 * e devolve { ok: true, text }.
 */
app.post("/respond", async (req, res) => {
  try {
    const userText = (req.body?.text || "").toString().trim();
    if (!userText) {
      return res.status(400).json({ error: "Missing 'text' field" });
    }

    // 🔑 Certifique-se de ter setado em Render → Environment:
    // GROQ_API_KEY = gsk_...
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GROQ_API_KEY on server" });
    }

    // ✅ Modelo Groq válido em 2025
    const model = "llama-3.1-8b-instant";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              "You are Cadu, the English Mastery Coach — a friendly, supportive English teacher for Brazilian adults.",
              "Speak in clear, natural English. Gently correct mistakes and briefly explain the reason.",
              "End each message with ONE short follow-up question.",
              "Keep answers concise (3–6 sentences)."
            ].join(" ")
          },
          { role: "user", content: userText }
        ],
        // algumas implementações exigem esses campos:
        temperature: 0.7,
        top_p: 1
      })
    });

    // Pode falhar em rede/HTTP
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return res.status(response.status).json({
        error: "Groq HTTP error",
        status: response.status,
        detail: errText
      });
    }

    const data = await response.json();

    // Log de debug (aparece nos Logs do Render)
    console.log("DEBUG raw response:", JSON.stringify(data, null, 2));

    // 🧠 Extração robusta do texto
    let output = "";

    // Formato padrão da rota chat/completions (Groq compatível OpenAI):
    // { choices: [ { message: { role, content } } ], ... }
    output = data?.choices?.[0]?.message?.content?.trim() || output;

    // Alguns provedores retornam "content" como array (raríssimo):
    if (!output && Array.isArray(data?.choices?.[0]?.message?.content)) {
      output = data.choices[0].message.content
        .map((c) => (typeof c === "string" ? c : c?.text || ""))
        .join(" ")
        .trim();
    }

    if (!output) {
      return res.status(502).json({
        error: "Empty reply from Groq model",
        raw: data
      });
    }

    return res.json({ ok: true, text: output });
  } catch (err) {
    console.error("Groq respond error:", err);
    return res
      .status(500)
      .json({ error: "Server error", detail: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
