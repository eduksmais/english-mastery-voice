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

// Rota principal de resposta (Groq)
app.post("/respond", async (req, res) => {
  try {
    const userText = (req.body?.text || "").toString().trim();
    if (!userText) {
      return res.status(400).json({ error: "Missing 'text' field" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are the English Mastery Coach. Respond in clear, supportive English. Correct mistakes gently and ask ONE short follow-up question."
          },
          {
            role: "user",
            content: userText
          }
        ]
      })
    });

    const data = await response.json();

    // Para depuração
    console.log("DEBUG raw response:", JSON.stringify(data, null, 2));

    // Extrai o texto de forma segura
    const output = data?.choices?.[0]?.message?.content?.trim();

    if (!output) {
      return res.status(502).json({
        error: "Empty reply from Groq model",
        raw: data
      });
    }

    res.json({ ok: true, text: output });
  } catch (err) {
    console.error("Groq respond error:", err);
    res.status(500).json({ error: "Server error", detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
