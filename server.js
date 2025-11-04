// server.js — Mastrius backend (Render + Groq + CORS)
import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// === CORS: libera chamadas do front ===
app.use(cors({
  origin: "*", // ou coloque seu domínio exato ex: "https://englishmastery.com.br"
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// === Middlewares ===
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname)); // serve index.html

// === Endpoint principal para IA ===
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // 🚀 modelo mais recente e natural
        messages,
        temperature: 0.7,
        max_tokens: 800,
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(500).json({
        error: data?.error?.message || "Groq API failed"
      });
    }

    res.json(data);
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Server error connecting to Groq" });
  }
});

// === Rota fallback (SPA) ===
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === Inicia o servidor ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mastrius backend ativo em http://localhost:${PORT}`);
});
