import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "game.db");
console.log(`Database connected at: ${dbPath}`);
const db = new Database(dbPath);
db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT UNIQUE,
      score INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recent_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const RANDOM_CONSTRAINTS = [
  "Focus on items you'd commonly find in a Pinoy household, an ihawan, or a sari-sari store (within the category context).",
  "Focus on things related to a famous Filipino dish, street food, or Pasalubong (within the category context).",
  "Focus on things associated with daily life in the survival mode of Philippine commute (within the category context).",
  "Focus on specific landmarks or locations that ARE relevant to the category (within the category context).",
  "Focus on words related to Filipino pop culture, legacy, or history (within the category context).",
];

const RANDOM_STARTERS = [
  "Imagine you're at a family reunion or an inuman with the barkada — pick an object you see.",
  "Think of a Filipino tradition, holiday (Noche Buena), or common 'pamahiin'.",
  "Consider something every Filipino 'Batang 90s' or Gen Z would immediately recognize.",
  "Think of a word that has a specific Pinoy context, like something you'd hear from a 'Tito' or 'Tita'.",
];

const RANDOM_VIBES = [
  "Classic Pinoy nostalgia (Batang 90s/80s).",
  "Modern Manila 'Hustle' life.",
  "Chill 'Probinsya' uwi vibe.",
  "Handaan/Fiesta/Inuman spirit.",
  "Sari-sari store / Tambayan setting.",
  "Mall culture (palamig vibe).",
];

const HINT_STRATEGIES = [
  "Use a hint that is a total Pinoy inside joke, but still fair.",
  "Reference a specific Pinoy taste (Maasim, Matamis, Malinamnam) or brand.",
  "Reference an object or action commonly associated with this item.",
  "Describe its role in a typical Filipino 'paborito' list.",
  "Use a hint that sounds like a line from a famous Pinoy movie or commercial.",
];

async function generateGameData(categoriesStr: string): Promise<{
  word: string;
  type: string;
  hint: string;
  imposterHint: string;
  imposterHint2: string;
}> {
  const constraint = pickRandom(RANDOM_CONSTRAINTS);
  const starter = pickRandom(RANDOM_STARTERS);
  const vibe = pickRandom(RANDOM_VIBES);
  const hintStrategy = pickRandom(HINT_STRATEGIES);

  // Fetch recent words from DB
  const recentRows = db
    .prepare("SELECT word FROM recent_words ORDER BY used_at DESC LIMIT 50")
    .all() as { word: string }[];
  const recentList = recentRows.map((r) => r.word);

  const avoidList =
    recentList.length > 0
      ? `DO NOT pick any of these specific words (most recently used): ${recentList.join(", ")}.`
      : "";

  const prompt = `ACT AS THE "BARKADA GAME MASTER" for "Imposter".
 
  CRITICAL RULE: The secret word MUST belong to the CATEGORY specified below.
  CATEGORY: "${categoriesStr}"
  
  TASK:
  1. Pick a secret word from the category that is deeply rooted in PH Knowledge (Philippines context).
  2. Ensure it's something every Pinoy recognizes, but avoid the most obvious first choice.
  3. VIBE: ${vibe}
  4. Use this strategy: ${starter}
  5. Adhere to this constraint: ${constraint}
  6. ${avoidList}
  
  HINTS (1-2 WORDS ONLY):
  - Player Hint: Cryptic and uses the ${hintStrategy} strategy. It should feel uniquely "Pinoy".
  - Imposter Hint 1 & 2: Two "distractor" words from DIFFERENT categories that share the SAME PHYSICAL ATTRIBUTES (Shape, Color, Container, Smell, or Temperature) as the "word". If the hint describes the physical appearance, the Imposter should be able to blend in perfectly.
  
  Example:
  Word: "San Miguel Pale Pilsen" (Category: Drinks), Hint: "Nasa brown na bote", imposterHint: "Patis" (Category: Foods), imposterHint2: "Medicine Bottle".
  Word: "Kalamansi" (Category: Foods), Hint: "Maliit at bilog", imposterHint: "Suthang" (Category: Objects/Toys), imposterHint2: "Cotton Ball".
  Word: "Sabong" (Category: Games), Hint: "May tari", imposterHint: "Manicure" (Category: Beauty), imposterHint2: "Chef's Knife". (Connects via the 'blade' attribute).

  CRITICAL CATEGORY LOCK: The "word" MUST absolutely be an item from the category: "${categoriesStr}". 
  If the category is "Games", DO NOT pick Food. If the category is "Places", DO NOT pick Animals.
  Choosing a word outside of "${categoriesStr}" is a CRITICAL FAILURE.

  STRICT RULE: Every field in the schema MUST be populated with high-quality content. 
  NEVER return "Unknown", "N/A", or generic refusal text. If stuck, focus on the physical shape.`;

  const getAIResult = async () => {
    const schema = {
      description:
        "Game data for Imposter game with deep Philippines cultural context",
      type: "object",
      properties: {
        word: { type: "string", description: "The secret word (PH Knowledge)" },
        type: { type: "string", description: "The sub-category or type" },
        hint: {
          type: "string",
          description: "A 1-2 word cryptic 'Pinoy' hint",
        },
        imposterHint: {
          type: "string",
          description: "A 1-2 word related concept (Primary Distractor)",
        },
        imposterHint2: {
          type: "string",
          description: "A 1-2 word related concept (Secondary Distractor)",
        },
      },
      required: ["word", "type", "hint", "imposterHint", "imposterHint2"],
    };

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a Game Master for 'Imposter'. Always return valid JSON matching the requested schema.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek API error: ${err}`);
    }

    const result = await response.json();
    let text = result.choices[0].message.content.trim();

    // Sanitize text: remove markdown code blocks if they exist
    if (text.startsWith("```")) {
      text = text.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
    }

    // Fallback: search for first '{' and last '}' if parsing fails
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("Retrying with regex-based JSON extraction...");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (innerE) {
          console.error("Critical: Regex extraction failed. Raw text:", text);
          throw innerE;
        }
      }
      console.error("Critical: JSON Parse failed. Raw text:", text);
      throw e;
    }
  };

  try {
    const parsed = await getAIResult();
    // Key-agnostic extraction (handles imposter_hint, imposterHint, etc.)
    const getVal = (obj: any, keys: string[]) => {
      for (const k of keys) {
        if (obj[k]) return obj[k];
        // Check case-insensitive
        const found = Object.keys(obj).find(
          (ok) =>
            ok.toLowerCase().replace(/[^a-z0-9]/g, "") ===
            k.toLowerCase().replace(/[^a-z0-9]/g, ""),
        );
        if (found) return obj[found];
      }
      return null;
    };

    const sanitize = (val: any, fallback: string) => {
      if (!val || typeof val !== "string") return fallback;
      const lower = val.toLowerCase();
      const blacklisted = [
        "unknown",
        "n/a",
        "refuse",
        "placeholder",
        "none",
        "error",
        "clue",
      ];
      if (blacklisted.some((b) => lower.includes(b)) || val.length < 2) {
        return fallback;
      }
      return val;
    };

    const rawWord = getVal(parsed, ["word"]) || "error";
    const rawType = getVal(parsed, ["type", "category"]) || "item";
    const rawHint = getVal(parsed, ["hint", "playerHint"]) || "clue";
    const rawIH1 =
      getVal(parsed, ["imposterHint", "imposter_hint", "distractor1"]) ||
      rawHint;
    const rawIH2 =
      getVal(parsed, ["imposterHint2", "imposter_hint2", "distractor2"]) ||
      rawIH1;

    return {
      word: sanitize(rawWord, "error").toLowerCase(),
      type: sanitize(rawType, "item").toLowerCase(),
      hint: sanitize(rawHint, "something").toLowerCase(),
      imposterHint: sanitize(rawIH1, sanitize(rawHint, "object")).toLowerCase(),
      imposterHint2: sanitize(
        rawIH2,
        sanitize(rawIH1, "concept"),
      ).toLowerCase(),
    };
  } catch (err: any) {
    console.error("AI generation failed. Propagating to 'Failed Page'.");
    throw err;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", async (req, res) => {
    try {
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(503).json({ status: "error", details: err.message });
    }
  });

  app.get("/api/leaderboard", (req, res) => {
    console.log("Fetching leaderboard scores...");
    const scores = db
      .prepare(
        "SELECT team_name as name, score FROM leaderboard ORDER BY score DESC LIMIT 10",
      )
      .all();
    console.log(`Leaderboard results: ${scores.length} teams found.`);
    res.json(scores);
  });

  app.post("/api/score", (req, res) => {
    const body = req.body;
    console.log("Received score update request:", JSON.stringify(body));
    const updates = Array.isArray(body) ? body : [body];

    const stmt = db.prepare(`
      INSERT INTO leaderboard (team_name, score)
      VALUES (?, ?)
      ON CONFLICT(team_name) DO UPDATE SET score = score + EXCLUDED.score
    `);

    try {
      const transaction = db.transaction((items) => {
        for (const item of items) {
          if (item && item.name) {
            console.log(`Updating score for: ${item.name} (+${item.score})`);
            stmt.run(item.name, item.score || 0);
          }
        }
      });

      transaction(updates);
      console.log("Database transaction completed successfully.");
      res.json({ success: true, count: updates.length });
    } catch (err: any) {
      console.error("Score update failed:", err.message);
      res.status(500).json({ error: err.message });
    }
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
      const { word, type, hint, imposterHint, imposterHint2 } =
        await generateGameData(categoriesStr);
      if (word) {
        // Save to DB
        db.prepare("INSERT OR IGNORE INTO recent_words (word) VALUES (?)").run(
          word.toLowerCase(),
        );
        // Keep only last 50
        db.prepare(
          "DELETE FROM recent_words WHERE id NOT IN (SELECT id FROM recent_words ORDER BY used_at DESC LIMIT 50)",
        ).run();
      }
      res.json({ word: word.toLowerCase(), hint, imposterHint, imposterHint2 });
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
