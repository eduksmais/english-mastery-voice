import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import bodyParser from "body-parser";
import cefrKnowledge from "./cefr-knowledge.json" assert { type: "json" };

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Endpoint base
app.get("/", (req, res) => {
  res.send(`
  <html style="font-family:sans-serif;text-align:center;padding:50px">
    <h1>🧠 Sr. Mastrius is online!</h1>
    <p>Your AI English Coach is ready to guide students based on CEFR levels.</p>
  </html>
  `);
});

// 🔑 Configure sua chave Groq (se quiser usar IA real)
const GROQ_KEY = process.env.GROQ_API_KEY || "";

// 🔍 Função de análise do CEFR (detecta nível simples com base no texto)
function detectLevel(text) {
  const lower = text.toLowerCase();
  if (lower.includes("future") || lower.includes("would") || lower.includes("could")) return "B2";
  if (lower.includes("because") || lower.includes("if")) return "B1";
  if (lower.includes("i am") || lower.includes("my") || lower.includes("like")) return "A1";
  return "A2";
}

// ⚙️ Endpoint principal de resposta (chat)
app.post("/respond", async (req, res) => {
  try {
    const { text, sessionId } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });

    // Detecta o nível aproximado do aluno
    const studentLevel = detectLevel(text);
    const guide = cefrKnowledge[studentLevel] || cefrKnowledge["A1"];

    // Constrói prompt contextualizado com o CEFR
    const cefrPrompt = `
You are Sr. Mastrius 🧠, an empathetic, encouraging English coach.
Your student is roughly level ${studentLevel}.
Adapt your feedback, tone and language based on the CEFR descriptors below.
Speak mostly in English, but may use short Portuguese explanations when needed.

Level ${studentLevel} overview:
- Speaking: ${guide.speaking.map(x => x.en).slice(0,4).join("; ")}
- Listening: ${guide.listening.map(x => x.en).slice(0,3).join("; ")}
- Writing: ${guide.writing.map(x => x.en).slice(0,2).join("; ")}
- Interaction: ${guide.interaction.map(x => x.en).slice(0,3).join("; ")}
- Mediation: ${guide.mediation.map(x => x.en).slice(0,2).join("; ")}

When replying:
1️⃣ React naturally to what the student said.
2️⃣ Give light correction or encouragement.
3️⃣ Add a short example or follow-up question to keep the talk going.
4️⃣ Never explain CEFR or levels directly.
`;

    // Se houver chave Groq válida, usa IA real
    if (GROQ_KEY) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: cefrPrompt },
            { role: "user", content: text },
          ],
          temperature: 0.8,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
      const reply =
        data?.choices?.[0]?.message?.content ||
        "I'm here! Tell me more about you. 😊";
      return res.json({ text: reply, level: studentLevel });
    }

    // 🔁 Fallback local (se não tiver Groq)
    const simulatedReplies = [
      "Nice! Tell me more about that. 😊",
      "That's interesting! How often do you do it?",
      "Good example! Try saying it again with more detail.",
      "Awesome effort — your English is improving already!",
      "Can you give me one more sentence using that idea?",
    ];
    const reply =
      simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];

    return res.json({ text: reply, level: studentLevel });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// 🚀 Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Sr. Mastrius is live on port ${PORT}`);
});
