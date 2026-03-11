import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey:
    process.env.GEMINI_API_KEY || "AIzaSyAIUBxFAFFmO-zjhQd3Z3BQUgIJhJDZ9lI",
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// CALL 1: Generate just the word and its type
async function generateWord(
  categoriesStr: string,
): Promise<{ word: string; type: string }> {
  const constraint = pickRandom(RANDOM_CONSTRAINTS);
  const starter = pickRandom(RANDOM_STARTERS);
  const seed = Math.floor(Math.random() * 99999);
  const avoidList =
    recentWords.length > 0
      ? `Do NOT use any of these recently used words: ${recentWords.join(", ")}.`
      : "";

  const prompt = `You are picking a word for a party game. [seed:${seed}]

Pick one secret word from the category: "${categoriesStr}"

RULES:
- ${starter}
- ${constraint}
- ${avoidList}
- Must be a word a 10-year-old would know. Simple, everyday words only.
- Good examples: dog, pizza, umbrella, bicycle, guitar, dentist, ladder, pillow, mirror.
- Bad examples: absinthe, theremin, astrolabe, dirigible.

Also identify what TYPE of thing the word is (e.g. animal, food, sport, tool, place, vehicle, etc.)

Return ONLY valid JSON, no markdown, no explanation:
{"word": "secretword", "type": "what type of thing it is"}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { temperature: 1.8, topP: 0.95, topK: 64 },
  });

  const raw = response.text?.trim() ?? "";
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

// CALL 2: Generate the hint knowing the word and its type
async function generateHint(word: string, type: string): Promise<string> {
  const prompt = `You are generating a hint for a party game called "Imposter".

The secret word is: "${word}"
It is a type of: "${type}"

Your job: Give ONE hint word that is ASSOCIATED with "${word}" but is NOT a "${type}".

The hint must come from a completely different category than "${type}".
It should be something connected to "${word}" — like where it's found, what it's used for, a part of it, or something it produces.

GOOD hints for "${word}" would be things like:
- A place where you find "${word}"
- Something "${word}" needs or uses
- A part or feature of "${word}"
- Something "${word}" produces or leads to

BAD hints are any other "${type}" — do not pick another ${type} as the hint.

Examples of correct hint logic:
- word: salad, type: food → hint: "fork" (utensil) or "bowl" (container) or "dressing" (condiment) ✅
- word: cheetah, type: animal → hint: "savanna" (place) or "spots" (feature) or "speed" (trait) ✅
- word: soccer, type: sport → hint: "stadium" (place) or "cleats" (equipment) or "penalty" (event) ✅

Examples of wrong hints:
- word: salad, type: food → hint: "rice" ❌ (also a food)
- word: cheetah, type: animal → hint: "monkey" ❌ (also an animal)
- word: soccer, type: sport → hint: "basketball" ❌ (also a sport)

Return ONLY valid JSON, no markdown, no explanation:
{"hint": "hintword"}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { temperature: 1.2, topP: 0.9, topK: 40 },
  });

  const raw = response.text?.trim() ?? "";
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/```$/, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return parsed.hint?.toLowerCase();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const db = new Database("game.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT UNIQUE,
      score INTEGER DEFAULT 0
    )
  `);

  app.use(express.json());

  app.get("/api/leaderboard", (req, res) => {
    const scores = db
      .prepare(
        "SELECT team_name as name, score FROM leaderboard ORDER BY score DESC LIMIT 10",
      )
      .all();
    res.json(scores);
  });

  app.post("/api/score", (req, res) => {
    const { name, score } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const stmt = db.prepare(`
      INSERT INTO leaderboard (team_name, score)
      VALUES (?, ?)
      ON CONFLICT(team_name) DO UPDATE SET score = score + EXCLUDED.score
    `);
    stmt.run(name, score);
    res.json({ success: true });
  });

  app.post("/api/reset-leaderboard", (req, res) => {
    db.prepare("DELETE FROM leaderboard").run();
    res.json({ success: true });
  });

  app.post("/api/generate-word", async (req, res) => {
    try {
      const { categories } = req.body;
      const categoriesStr =
        categories && categories.length > 0 ? categories.join(", ") : "random";

      // Two separate focused calls
      const { word, type } = await generateWord(categoriesStr);
      const hint = await generateHint(word.toLowerCase(), type.toLowerCase());

      if (word) {
        recentWords.push(word.toLowerCase());
        if (recentWords.length > MAX_RECENT) recentWords.shift();
      }

      console.log(`Generated: word="${word}" type="${type}" hint="${hint}"`);
      res.json({ word: word.toLowerCase(), hint });
    } catch (err) {
      console.error("AI Generation failed:", err);
      res.status(500).json({ error: "Failed to generate word" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Game Server is live!`);
    console.log(`> Local:   http://localhost:${PORT}`);

    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === "IPv4" && !iface.internal) {
          console.log(`> Network: http://${iface.address}:${PORT}`);
        }
      }
    }
    console.log("");
  });
}

startServer();
