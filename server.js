// server.js — English Mastery Coach (Sr. Mastrius)
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

// 🔹 Health Check
app.get("/health", (_, res) => res.json({ ok: true }));

/* ==========================================================
   🧠 ROUTE 1 — CHAT / CONVERSATION MODE (uses Groq)
   ========================================================== */
app.post("/respond", async (req, res) => {
  try {
    const userText = (req.body?.text || "").toString().trim();
    if (!userText) {
      return res.status(400).json({ error: "Missing 'text' field" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GROQ_API_KEY on server" });
    }

    const model = "llama-3.1-8b-instant";

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: [
                "You are Sr. Mastrius, the English Mastery Coach — a friendly, curious and supportive English teacher for Brazilian adults.",
                "Speak in clear, natural English. Gently correct mistakes and briefly explain why.",
                "End each message with ONE short follow-up question.",
                "Keep answers between 3–6 sentences.",
                "Avoid generic AI tone; sound human, fun and insightful."
              ].join(" "),
            },
            { role: "user", content: userText },
          ],
          temperature: 0.7,
          top_p: 1,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return res.status(response.status).json({
        error: "Groq HTTP error",
        status: response.status,
        detail: errText,
      });
    }

    const data = await response.json();

    // Debug
    console.log("DEBUG raw response:", JSON.stringify(data, null, 2));

    let output =
      data?.choices?.[0]?.message?.content?.trim() ||
      (Array.isArray(data?.choices?.[0]?.message?.content)
        ? data.choices[0].message.content
            .map((c) => (typeof c === "string" ? c : c?.text || ""))
            .join(" ")
            .trim()
        : "");

    if (!output) {
      return res.status(502).json({
        error: "Empty reply from Groq model",
        raw: data,
      });
    }

    return res.json({ ok: true, text: output });
  } catch (err) {
    console.error("Groq respond error:", err);
    return res.status(500).json({
      error: "Server error",
      detail: String(err?.message || err),
    });
  }
});

/* ==========================================================
   🧾 ROUTE 2 — LEAD CAPTURE / UPSERT
   ========================================================== */
app.post("/lead", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("LEAD UPSERT:", JSON.stringify(payload, null, 2));

    // 📊 FUTURE: send to Google Sheets, Airtable, or Notion here
    // Example placeholder:
    // await fetch("https://hooks.zapier.com/your-webhook", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });

    return res.json({ ok: true });
  } catch (err) {
    console.error("lead error:", err);
    return res.status(500).json({
      error: "Server error",
      detail: String(err),
    });
  }
});

/* ==========================================================
   🚀 START SERVER
   ========================================================== */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
