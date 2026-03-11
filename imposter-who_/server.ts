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

// Track recently used words to avoid repetition
const recentWords: string[] = [];
const MAX_RECENT = 20;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const RANDOM_CONSTRAINTS = [
  "Pick something uncommon or surprising — avoid the first word that comes to mind.",
  "Pick something specific and niche, not a generic or famous example.",
  "Avoid the most popular or well-known example in this category.",
  "Think of something a little unexpected or underrated in this category.",
  "Skip obvious choices. Pick something you wouldn't normally think of first.",
  "Pick a word that is real and specific but not the most famous in its category.",
  "Avoid clichés. Choose something more creative and less expected.",
];

const RANDOM_STARTERS = [
  "Start by thinking of at least 10 different words in this category, then pick one from the middle or end of your list — not the first.",
  "Mentally list 8 words in this category, skip the first 3, then pick one.",
  "Think of the 5th or 6th word that comes to mind in this category, not the 1st or 2nd.",
  "Generate a diverse list of options first, then randomly select from the less obvious ones.",
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database setup
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

      const avoidList =
        recentWords.length > 0
          ? `\nDo NOT use any of these recently used words: ${recentWords.join(", ")}.`
          : "";

      const constraint = pickRandom(RANDOM_CONSTRAINTS);
      const starter = pickRandom(RANDOM_STARTERS);
      const seed = Math.floor(Math.random() * 99999);

      const prompt = `You are an AI for a social deduction party game called "Imposter". [seed:${seed}]

Your task: Pick one secret word from the category "${categoriesStr}" and generate a "hint" word for the imposter.

════════════════════════════════
STEP 1 — PICK A WORD (simple & random)
════════════════════════════════

${starter}
${constraint}${avoidList}

DIFFICULTY RULES:
- The word must be something a 10-year-old would know.
- Common, everyday words only. No obscure, rare, or technical words.
- Good: dog, pizza, umbrella, bicycle, guitar, dentist, sunset, ladder, pillow.
- Bad: absinthe, theremin, astrolabe, dirigible.

════════════════════════════════
STEP 2 — IDENTIFY THE WORD'S TYPE
════════════════════════════════

Before writing the hint, ask yourself:
  "What TYPE of thing is my secret word?"

Examples:
  - cheetah  → it is an ANIMAL
  - soccer   → it is a SPORT
  - guitar   → it is a MUSICAL INSTRUMENT
  - pizza    → it is a FOOD
  - hammer   → it is a TOOL

════════════════════════════════
STEP 3 — GENERATE THE HINT
════════════════════════════════

The hint must NOT be the same TYPE as the secret word.

  ✅ GOOD — hint is a different type:
  - cheetah  → savanna   (a PLACE, not an animal)
  - cheetah  → spots     (a FEATURE, not an animal)
  - cheetah  → speed     (a TRAIT, not an animal)
  - soccer   → stadium   (a PLACE, not a sport)
  - soccer   → cleats    (EQUIPMENT, not a sport)
  - guitar   → strings   (a PART, not an instrument)
  - pizza    → oven       (where it's cooked, not a food)
  - pizza    → crust      (a PART, not a food)

  ❌ BAD — hint is the same type as the secret word:
  - cheetah  → monkey    ❌ (also an ANIMAL)
  - cheetah  → lion      ❌ (also an ANIMAL)
  - soccer   → basketball ❌ (also a SPORT)
  - guitar   → piano     ❌ (also an INSTRUMENT)
  - pizza    → burger    ❌ (also a FOOD)

════════════════════════════════
FINAL CHECK before returning:
  1. Would a 10-year-old know the secret word? → If no, pick something simpler.
  2. What TYPE is my secret word? (animal / sport / food / tool / etc.)
  3. Is my hint the same TYPE? → If yes, REJECT and pick a different hint.
  4. Does the hint strongly associate with the secret word? → If yes, return it.
════════════════════════════════

One-word hints only. Return ONLY valid JSON, no markdown, no explanation:
{"word": "secretword", "hint": "hintword"}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 1.8,
          topP: 0.95,
          topK: 64,
        },
      });

      const raw = response.text?.trim() ?? "";
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      const word = parsed.word?.toLowerCase();
      const hint = parsed.hint?.toLowerCase();

      if (word) {
        recentWords.push(word);
        if (recentWords.length > MAX_RECENT) recentWords.shift();
      }

      res.json({ word, hint });
    } catch (err) {
      console.error("AI Generation failed:", err);
      res.status(500).json({ error: "Failed to generate word" });
    }
  });

  // Vite middleware for development
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
