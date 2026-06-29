import express from "express";
import cors from "cors";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY is missing. Copy .env.example to .env and add your key.");
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// You can switch the model via the .env file. Sonnet is a good default;
// claude-haiku-4-5-20251001 is cheaper/faster if you prefer.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL }));

app.post("/api/rate", async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "missing text" });

  const prompt =
`משתמש מנה כמה "מרכיבים" אקראיים (לא בהכרח אוכל, ולא בהכרח מתאימים יחד): "${text}"

דרג עד כמה הצירוף הזה מגעיל, בסולם מ-0 (מצוין לגמרי / מעורר תיאבון) עד 100 (גועלי במיוחד). היה מצחיק, שובב וקצת תיאטרלי — כמו מבקר גועל מצחיק לילדים. תגמל צירופים מגעילים במיוחד בציון גבוה; צירופים תמימים או משעממים מקבלים ציון נמוך.

חשוב מאוד: כל הטקסט מיועד לילד בן 8. כתוב בעברית פשוטה, נקייה ומצחיקה, בלי מילים גסות, בלי קללות, ובלי תכנים מפחידים, אלימים, מגעילים מדי או מבוגרים. רק גועל שטותי, ילדותי וכיפי (כמו "איכס", "יאק", "בלעך", "פוי"). שמור על טון חיובי ומשעשע שמתאים לילדים.

החזר אך ורק אובייקט JSON גולמי, בלי markdown, בלי גרשיים מסולסלים, בדיוק במבנה הזה:
{"score": <מספר שלם 0-100>, "verdict": "<משפט או שניים חדים בעברית>", "ingredients": ["<פריט בעברית>", "..."]}`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const out = JSON.parse(json);
    res.json({
      score: Math.max(0, Math.min(100, Math.round(out.score))),
      verdict: out.verdict || "",
      ingredients: Array.isArray(out.ingredients) ? out.ingredients.slice(0, 12) : [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "server error" });
  }
});

// In production (e.g. Render), serve the built client from this same service.
// The Vite dev proxy handles this in development, so we only do it when the
// build output exists.
const clientDist = path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🧪 Disgustometer API running on http://localhost:${PORT}`));
