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

// Create ephemeral Realtime session
app.post("/session", async (req, res) => {
  try {
    const body = {
      model: "gpt-4o-realtime-preview",
      voice: "verse",
      modalities: ["audio", "text"],
      instructions: `You are "English Mastery Coach", an empathetic, upbeat conversation partner for Brazilian adult learners.
- Speak clearly and naturally in English.
- Level the language to the student's ability (A1–B2) and adjust pace.
- Use short turns. Ask 1 question at a time.
- Gently correct mistakes in the moment: recast + 1-sentence why.
- Encourage and celebrate progress. Keep confidence high.
- If student switches to Portuguese for help, briefly explain in PT-BR, then get back to English.
- Focus on real-life speaking situations (work, travel, meetings).
- Use server VAD (voice activity detection) to manage turns.`,
      turn_detection: { type: "server_vad" }
    };

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: "OpenAI session error", detail: text });
    }

    const json = await r.json();
    res.json({
      client_secret: json.client_secret?.value,
      model: json.model,
      expires_at: json.expires_at
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
