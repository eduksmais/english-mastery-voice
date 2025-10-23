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

// Health check
app.get("/health", (_, res) => res.json({ ok: true }));

/**
 * Rota de resposta de TEXTO:
 * O FRONT chama /respond, e o SERVIDOR chama a OpenAI com sua chave sk- (segura).
 * Assim o browser nunca usa ek_ nem vê sua sk-.
 */
app.post("/respond", async (req, res) => {
  try {
    const userText = (req.body?.text || "").toString().trim();
    if (!userText) return res.status(400).json({ error: "Missing 'text' field" });

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: [{ type: "input_text", text:
            "You are the English Mastery Coach. Respond in clear, supportive English. Correct mistakes gently and ask ONE short follow-up question." }] },
          { role: "user", content: [{ type: "input_text", text: userText }] }
        ]
      })
    });

    const data = await r.json();

    // Extrai texto com segurança (cobre variações de payload)
    let output = "";
    try {
      if (data.output && Array.isArray(data.output) && data.output.length) {
        output = data.output
          .map(o => (o.content || []).map(c => c.text).filter(Boolean).join(" "))
          .join(" ");
      } else if (data.output_text) {
        output = data.output_text;
      } else if (data.choices?.[0]?.message?.content) {
        // fallback para formatos antigos
        output = data.choices[0].message.content;
      }
    } catch (_) { /* ignore parsing errors */ }

    if (!output) {
      return res.status(502).json({ error: "Empty reply from model", raw: data });
    }

    res.json({ ok: true, text: output.trim() });
  } catch (err) {
    console.error("respond error:", err);
    res.status(500).json({ error: "Server error", detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
