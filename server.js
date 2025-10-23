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

// simple health check
app.get("/health", (_, res) => res.json({ ok: true }));

/**
 * POST /respond
 * Receives plain text from the browser, sends it to OpenAI using your sk- key,
 * and returns the model’s text back to the browser.
 */
app.post("/respond", async (req, res) => {
  try {
    const userText = (req.body?.text || "").toString().trim();
    if (!userText) {
      return res.status(400).json({ error: "Missing 'text' field" });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are the English Mastery Coach. Respond in clear, supportive English. Correct mistakes gently and ask ONE short follow-up question.",
              },
            ],
          },
          { role: "user", content: [{ type: "input_text", text: userText }] },
        ],
      }),
    });

    const data = await openaiRes.json();

    // ---- extract text safely ----
    let output = "";
    try {
      if (data.output && Array.isArray(data.output) && data.output.length) {
        output = data.output
          .map((o) =>
            (o.content || [])
              .map((c) => c.text)
              .filter(Boolean)
              .join(" ")
          )
          .join(" ");
      } else if (data.output_text) {
        output = data.output_text;
      } else if (data.choices?.[0]?.message?.content) {
        output = data.choices[0].message.content;
      }
    } catch (_) {
      /* ignore parse errors */
    }

    // ---- log unexpected structure ----
    if (!output) {
      console.log("DEBUG raw response:", JSON.stringify(data, null, 2));
      if (data.output_text) {
        output = data.output_text;
      } else if (data.output && data.output[0]?.content?.[0]?.text) {
        output = data.output[0].content[0].text;
      } else if (data.choices?.[0]?.message?.content) {
        output = data.choices[0].message.content;
      }
    }

    if (!output) {
      return res
        .status(502)
        .json({ error: "Empty reply after debug", raw: data });
    }

    res.json({ ok: true, text: output.trim() });
  } catch (err) {
    console.error("respond error:", err);
    res
      .status(500)
      .json({ error: "Server error", detail: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
