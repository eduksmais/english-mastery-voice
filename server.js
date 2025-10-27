app.post("/respond", async (req, res) => {
  try {
    const userText = (req.body?.text || "").toString().trim();
    if (!userText) return res.status(400).json({ error: "Missing 'text' field" });

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are the English Mastery Coach. Respond in clear, supportive English. Correct mistakes gently and ask ONE short follow-up question."
          },
          { role: "user", content: userText }
        ]
      })
    });

    const data = await r.json();

    const output =
      data.choices?.[0]?.message?.content?.trim() ||
      "No reply from Groq model.";

    res.json({ ok: true, text: output });
  } catch (err) {
    console.error("Groq respond error:", err);
    res.status(500).json({ error: "Server error", detail: String(err) });
  }
});
