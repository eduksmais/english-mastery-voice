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

// 🔹 Health check
app.get("/health", (_, res) => res.json({ ok: true }));

/* ==========================================================
   🧠 ROUTE 1 — CHAT / CONVERSATION MODE (Groq)
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
                "You are Sr. Mastrius, the English Mastery Coach — a friendly, curious, and supportive English teacher for Brazilian adults.",
                "Speak naturally in English with warmth and light humor.",
                "Correct mistakes briefly and encourage improvement.",
                "Ask one short follow-up question at the end.",
                "Keep replies short (3–6 sentences).",
                "Avoid robotic or generic AI tone; sound human, inspiring, and insightful."
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

    // Debug log
    console.log("DEBUG raw Groq response:", JSON.stringify(data, null, 2));

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
   🧾 ROUTE 2 — LEAD CAPTURE (placement test → Formspree)
   ========================================================== */
app.post("/lead", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("LEAD UPSERT:", JSON.stringify(payload, null, 2));

    const formspreeUrl = "https://formspree.io/f/mdkproyy"; // ✅ Leads Form

    const r = await fetch(formspreeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        whatsapp: payload.whats,
        level: payload.placement?.level,
        score: payload.placement?.score,
        correct: payload.placement?.correct,
        wrong: payload.placement?.wrong,
        tags: (payload.placement?.tags || []).join(", "),
        timestamp: new Date().toISOString(),
        userAgent: payload.meta?.ua,
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("Formspree LEAD error:", text);
      return res.status(500).json({ error: "Formspree error", detail: text });
    }

    console.log("✅ Lead enviado para o Formspree (mdkproyy)");
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
   🎓 ROUTE 3 — STUDENT METRICS / FEEDBACK (Formspree)
   ========================================================== */
app.post("/student", async (req, res) => {
  try {
    const payload = req.body || {};
    console.log("STUDENT DATA:", JSON.stringify(payload, null, 2));

    const formspreeUrl = "https://formspree.io/f/xjkpqvjp"; // ✅ Students Form

    const r = await fetch(formspreeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        topic: payload.topic,
        feedback: payload.feedback,
        duration: payload.duration,
        timestamp: new Date().toISOString(),
        userAgent: payload.meta?.ua,
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("Formspree STUDENT error:", text);
      return res.status(500).json({ error: "Formspree error", detail: text });
    }

    console.log("✅ Dados de aluno enviados para o Formspree (xjkpqvjp)");
    return res.json({ ok: true });
  } catch (err) {
    console.error("student error:", err);
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
