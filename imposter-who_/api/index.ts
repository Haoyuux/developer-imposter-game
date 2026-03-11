import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import path from "path";

// Vercel handles env vars automatically, but dotenv doesn't hurt locally
dotenv.config();

function getAIModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in environment variables.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite-preview",
  });
}

const app = express();
app.use(express.json());

const recentWords: string[] = [];
const MAX_RECENT = 20;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const RANDOM_CONSTRAINTS = [
  "Pick something uncommon or surprising — avoid the first word that comes to mind.",
  "Avoid the most popular or well-known example in this category.",
  "Think of something a little unexpected or underrated in this category.",
  "Skip obvious choices. Pick something you wouldn't normally think of first.",
  "Choose something more creative and less expected.",
];

const RANDOM_STARTERS = [
  "Think of at least 10 different words in this category, then pick one from the middle or end of your list — not the first.",
  "Mentally list 8 words in this category, skip the first 3, then pick one.",
  "Think of the 5th or 6th word that comes to mind, not the 1st or 2nd.",
  "Generate a diverse list first, then pick from the less obvious ones.",
];

async function generateGameData(
  categoriesStr: string,
): Promise<{ word: string; type: string; hint: string }> {
  const model = getAIModel();
  const constraint = pickRandom(RANDOM_CONSTRAINTS);
  const starter = pickRandom(RANDOM_STARTERS);
  const seed = Math.floor(Math.random() * 99999);
  const avoidList =
    recentWords.length > 0
      ? `Do NOT use any of these recently used words: ${recentWords.join(", ")}.`
      : "";

  const prompt = `You are picking a word and a hint for a party game called "Imposter". [seed:${seed}]

STEP 1: Pick one secret word from the category: "${categoriesStr}"
RULES for word:
- ${starter}
- ${constraint}
- ${avoidList}
- Must be a word a 10-year-old would know. Simple, everyday words only. (dog, pizza, guitar, etc.)
- Identify what TYPE of thing the word is (e.g. animal, food, sport, tool, etc.)

STEP 2: Generate a HINT for that word.
RULES for hint:
- ONE hint word associated with the secret word but NOT the same type.
- Example: word: salad, type: food -> hint: "fork" (utensil)
- Example: word: cheetah, type: animal -> hint: "savanna" (place)
- DO NOT pick another word of the same type.

Return ONLY valid JSON:
{"word": "secretword", "type": "type", "hint": "hintword"}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const raw = response.text().trim();
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      word: parsed.word.toLowerCase(),
      type: parsed.type.toLowerCase(),
      hint: parsed.hint.toLowerCase(),
    };
  } catch (parseErr) {
    console.error("Failed to parse AI response:", raw);
    throw new Error(`AI returned invalid JSON: ${raw.slice(0, 100)}...`);
  }
}

// In Vercel serverless, we should probably use a persistent DB (like Vercel KV or Postgres),
// but for the sake of getting the 404 fixed, we'll try to initialize SQLite in /tmp
// if it's not possible to write to the root.
let db: any;
try {
  // Try local file first, then /tmp for serverless
  const dbPath =
    process.env.NODE_ENV === "production" ? "/tmp/game.db" : "game.db";
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT UNIQUE,
      score INTEGER DEFAULT 0
    )
  `);
} catch (err) {
  console.log(
    "Database initialization failed (likely serverless env). Leaderboard will not persist.",
  );
}

app.get("/health", async (req, res) => {
  try {
    const model = getAIModel();
    const result = await model.generateContent("ping");
    const response = await result.response;
    const text = response.text();
    if (text) {
      return res.json({ status: "ok", message: "AI is ready" });
    }
    throw new Error("Empty response from AI");
  } catch (err: any) {
    console.error("AI Health Check failed:", err);
    res.status(503).json({
      status: "error",
      message: "AI service unavailable",
      details: err.message,
    });
  }
});

app.get("/leaderboard", (req, res) => {
  if (!db) return res.json([]);
  try {
    const scores = db
      .prepare(
        "SELECT team_name as name, score FROM leaderboard ORDER BY score DESC LIMIT 10",
      )
      .all();
    res.json(scores);
  } catch (err) {
    res.json([]);
  }
});

app.post("/score", (req, res) => {
  if (!db) return res.json({ success: true, message: "No persistence" });
  const { name, score } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const stmt = db.prepare(`
      INSERT INTO leaderboard (team_name, score)
      VALUES (?, ?)
      ON CONFLICT(team_name) DO UPDATE SET score = score + EXCLUDED.score
    `);
    stmt.run(name, score);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true });
  }
});

app.post("/generate-word", async (req, res) => {
  try {
    const { categories } = req.body;
    const categoriesStr =
      categories && categories.length > 0 ? categories.join(", ") : "random";
    const { word, type, hint } = await generateGameData(categoriesStr);

    if (word) {
      recentWords.push(word.toLowerCase());
      if (recentWords.length > MAX_RECENT) recentWords.shift();
    }

    console.log(`Generated: word="${word}" type="${type}" hint="${hint}"`);
    res.json({ word: word.toLowerCase(), hint });
  } catch (err: any) {
    console.error("AI Generation failed:", err);
    let errorMessage = "AI Generation failed. Check logs.";
    if (err.status === 403 || err.message?.includes("leaked")) {
      errorMessage = "API key issue. Update your Vercel Environment Variables.";
    }
    res.status(500).json({ error: errorMessage, details: err.message });
  }
});

export default app;
