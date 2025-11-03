
// ===============================
// 🧠 English Mastery - Sr. Mastrius Server
// ===============================

import express from "express";
import fs from "fs";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// 📘 Load Teacher Brain configuration
// ===============================
const TEACHER_BRAIN = JSON.parse(fs.readFileSync("./data/teacher-brain.json", "utf-8"));

// ===============================
// 🧠 AI Coaching Endpoint
// ===============================
app.post("/api/coach", async (req, res) => {
  try {
    const {
      message,
      studentName,
      studentLevel,
      focusAreas,
      theme,
      previousMessages,
      intakeData,
    } = req.body;

    // ===============================
    // 🧩 Construct system prompt
    // ===============================
    const systemPrompt = `
You are ${TEACHER_BRAIN.identity.name}, ${TEACHER_BRAIN.identity.role}.
Archetype: ${TEACHER_BRAIN.identity.archetype}.
Mission: ${TEACHER_BRAIN.identity.mission}.

Model: ${TEACHER_BRAIN.identity.default_model}.
Teaching Philosophy: ${Object.values(TEACHER_BRAIN.pedagogical_framework.core_principles).join(" | ")}.
Influences: ${TEACHER_BRAIN.pedagogical_framework.influences.join(", ")}.

Student Profile:
- Name: ${studentName || "New Learner"}
- Level: ${studentLevel || "A1"}
- Focus Areas: ${focusAreas?.join(", ") || "General Improvement"}
- Theme: ${theme || "Conversation"}
${intakeData ? `Pain: ${intakeData.painPoint} | Dream: ${intakeData.dreamScenario} | Motivation: ${intakeData.motivation}` : ""}

Response Style:
- Tone: ${TEACHER_BRAIN.communication_style.tone}
- ${TEACHER_BRAIN.coaching_model.structure.join("\n")}
Always end with a motivational or reflective challenge.
`;

    // ===============================
    // 💬 Combine conversation history
    // ===============================
    const conversationHistory = (previousMessages || [])
      .map((msg) => `${msg.role === "user" ? "Student" : "Coach"}: ${msg.content}`)
      .join("\n");

    // ===============================
    // ⚙️ Build Groq API Request
    // ===============================
    const body = {
      model: TEACHER_BRAIN.identity.default_model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${conversationHistory}\nStudent: ${message}` },
      ],
      temperature: 0.8,
      max_tokens: 400,
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "Sorry, I had trouble responding.";

    // ===============================
    // ✅ Send back AI response
    // ===============================
    res.json({ response: reply });
  } catch (error) {
    console.error("[Coach Error]", error);
    res.status(500).json({ error: "Server failed to respond." });
  }
});

// ===============================
// 🌐 Serve frontend files (optional)
// ===============================
app.use(express.static("public"));

// ===============================
// 🚀 Start server
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Sr. Mastrius Coach Server running on port ${PORT}`)
);
