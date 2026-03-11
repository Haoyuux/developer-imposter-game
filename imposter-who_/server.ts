import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

// NEW: Strategies to make hints harder
const HINT_STRATEGIES = [
  "Think of where this item is used/found and pick an object from that setting.",
  "Think of an abstract quality or adjective associated with it.",
  "Think of a historical fact or a person famous for using this.",
  "Pick a second-order association (e.g. if word is 'Bee', don't use 'Honey', use 'Hexagon').",
  "Focus on a specific part or material of the object.",
];

async function generateGameData(
  categoriesStr: string,
): Promise<{ word: string; type: string; hint: string; imposterHint: string }> {
  const constraint = pickRandom(RANDOM_CONSTRAINTS);
  const starter = pickRandom(RANDOM_STARTERS);
  const hintStrategy = pickRandom(HINT_STRATEGIES);
  const seed = Math.floor(Math.random() * 99999);
  const avoidList =
    recentWords.length > 0
      ? `Do NOT use any of these recently used words: ${recentWords.join(", ")}.`
      : "";

  const prompt = `You are picking a word and hints for a party game called "Imposter". [seed:${seed}]

STEP 1: Pick one secret word from the category: "${categoriesStr}"
RULES for word:
- ${starter}
- ${constraint}
- ${avoidList}
- Identify what TYPE of thing the word is (e.g. animal, food, sport, tool, etc.)

STEP 2: Generate a slightly challenging ONE-WORD HINT for real players.
RULES for real hint:
- STRATEGY: ${hintStrategy}
- ABSOLUTELY AVOID the most obvious/literal association.
- The hint must be fair but require players to think 'diagonally'.

STEP 3: Generate a "Fake Hint" for the Imposter.
RULES for imposter hint:
- This word should be highly relevant or similar in context to the secret word.
- Its purpose is to give the Imposter a strong starting point to blend in without knowing the exact word.

Return ONLY valid JSON:
{"word": "secretword", "type": "type", "hint": "realhint", "imposterHint": "fakehint"}`;

  const getAIResult = async (modelId: string) => {
    const result = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    const raw = (result.text || "").trim();
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  };

  try {
    const parsed = await getAIResult("gemini-1.5-flash");
    return {
      word: parsed.word.toLowerCase(),
      type: (parsed.type || "unknown").toLowerCase(),
      hint: parsed.hint.toLowerCase(),
      imposterHint: (parsed.imposterHint || parsed.hint).toLowerCase(),
    };
  } catch (err: any) {
    console.warn("[NeuralBrain] Local gen failed, attempting discovery...");
    let modelToUse = "gemini-1.5-flash";
    const modelsIterator = await ai.models.list();
    for await (const m of modelsIterator) {
      if (m.name.includes("flash")) {
        modelToUse = m.name;
        break;
      }
    }

    const parsed = await getAIResult(modelToUse);
    return {
      word: parsed.word.toLowerCase(),
      type: (parsed.type || "unknown").toLowerCase(),
      hint: parsed.hint.toLowerCase(),
      imposterHint: (parsed.imposterHint || parsed.hint).toLowerCase(),
    };
  }
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

  app.get("/api/health", async (req, res) => {
    try {
      const found: string[] = [];
      const modelsIterator = await ai.models.list();
      for await (const m of modelsIterator) {
        found.push(m.name);
        if (found.length >= 10) break;
      }
      res.json({ status: "ok", availableModels: found });
    } catch (err: any) {
      res.status(503).json({ status: "error", details: err.message });
    }
  });

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
      const { word, type, hint, imposterHint } =
        await generateGameData(categoriesStr);
      if (word) {
        recentWords.push(word.toLowerCase());
        if (recentWords.length > MAX_RECENT) recentWords.shift();
      }
      res.json({ word: word.toLowerCase(), hint, imposterHint });
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      res
        .status(500)
        .json({ error: "Failed to generate word", details: err.message });
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
    console.log(`\n🚀 Game Server live!`);
    console.log(`> http://localhost:${PORT}\n`);
  });
}

startServer();
