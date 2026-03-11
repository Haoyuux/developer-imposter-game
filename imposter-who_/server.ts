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

// Random pick helpers
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

  // API routes
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

      // Build avoid list from recent words
      const avoidList =
        recentWords.length > 0
          ? `\nDo NOT use any of these recently used words: ${recentWords.join(", ")}.`
          : "";

      // Pick random constraint and starter for variety
      const constraint = pickRandom(RANDOM_CONSTRAINTS);
      const starter = pickRandom(RANDOM_STARTERS);

      // Random seed number to break model determinism
      const seed = Math.floor(Math.random() * 99999);

      const prompt = `You are an AI for a social deduction party game called "Imposter". [seed:${seed}]

Your task: Pick one secret word from the category "${categoriesStr}" and generate a "hint" word for the imposter.

════════════════════════════════
WORD SELECTION — BE RANDOM & KEEP IT SIMPLE
════════════════════════════════

${starter}

${constraint}${avoidList}

DIFFICULTY RULES (very important):
- The word must be something a 10-year-old would know.
- Use only common, everyday words that most people encounter in daily life.
- NO obscure, rare, technical, or niche words (e.g. no "absinthe", "sextant", "clavicle").
- If you're unsure whether it's too obscure — pick something simpler.
- Good difficulty examples: dog, pizza, umbrella, bicycle, swimming pool, guitar, dentist, sunset.
- Bad difficulty examples: absinthe, theremin, astrolabe, mortise, dirigible.

════════════════════════════════
HINT RULES — READ CAREFULLY
════════════════════════════════

The hint must be a RELATED CONCEPT, not another item of the same type.

Ask yourself: "Could my hint be found in the same category as the secret word?"
If YES → your hint is WRONG. Pick a different one.
If NO  → your hint is correct.

GOOD hints link to:
  - A place associated with it   → soccer → stadium
  - Something it uses/needs      → soccer → cleats
  - A result or byproduct        → apple → cider
  - Where it comes from          → apple → orchard
  - An event around it           → soccer → penalty

BAD hints are siblings (same category):
  - soccer → basketball ❌  (also a sport)
  - apple → banana ❌       (also a fruit)
  - guitar → piano ❌       (also an instrument)

More good examples:
  - soccer   → goalkeeper, penalty, cleats, stadium, halftime
  - baseball → dugout, innings, pitcher, bleachers
  - apple    → orchard, cider, pie, tree
  - shark    → reef, fin, depth
  - piano    → recital, keys, sonata

════════════════════════════════
SELF-CHECK before returning:
  1. Would a 10-year-old know this word? → If no, REJECT it and pick something simpler.
  2. Is my hint a type of ${categoriesStr}? → If yes, REJECT it and try again.
  3. Would someone hearing the hint naturally think of the secret word? → If yes, it's good.
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
      // Strip markdown code fences if present
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      const word = parsed.word?.toLowerCase();
      const hint = parsed.hint?.toLowerCase();

      // Track this word to avoid repetition
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
