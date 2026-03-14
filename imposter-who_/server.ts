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
      score INTEGER DEFAULT 0,
      members TEXT,
      type TEXT DEFAULT 'team'
    );
    CREATE TABLE IF NOT EXISTS recent_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      state TEXT DEFAULT 'lobby',
      settings TEXT,
      game_data TEXT,
      host_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      name TEXT,
      role TEXT DEFAULT 'player',
      is_host INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      vote TEXT,
      team_name TEXT,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
  `);

// Migration for existing databases
try {
  db.exec("ALTER TABLE rooms ADD COLUMN host_name TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN team_name TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE leaderboard ADD COLUMN members TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE leaderboard ADD COLUMN type TEXT DEFAULT 'team'");
} catch (e) {}

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

  // Fetch recent words from DB (keep only last 15 so words can cycle back)
  const recentRows = db
    .prepare("SELECT word FROM recent_words ORDER BY used_at DESC LIMIT 15")
    .all() as { word: string }[];
  const recentList = recentRows.map((r) => r.word);

  // Generate a random seed to break AI caching patterns
  const randomSeed = Math.floor(Math.random() * 999999);

  const avoidList =
    recentList.length > 0
      ? `These words were recently used: [${recentList.join(", ")}]. STRONGLY PREFER picking a different word — only reuse one of these if you truly cannot think of anything else for this category. Prioritize fresh, surprising choices.`
      : "";

  const prompt = `ACT AS THE "BARKADA GAME MASTER" for "Imposter". RANDOM SEED: ${randomSeed} (use this to inspire a unique, unexpected choice).
 
  CRITICAL RULE: The secret word MUST belong to the CATEGORY specified below.
  CATEGORY: "${categoriesStr}"
  
  TASK:
  1. Pick a SURPRISING and UNIQUE secret word from the category that is deeply rooted in PH Knowledge (Philippines context).
  2. DO NOT pick the most common or obvious answer — dig DEEP. Think of obscure brands, regional items, childhood memories, or niche Pinoy knowledge.
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

  JSON Schema:
  {
    "word": "The secret word (e.g. Sungka)",
    "type": "item type (e.g. Game)",
    "hint": "clue for hunters (Single word or short phrase, e.g. Holes)",
    "imposterHint": "distractor (Single word only, e.g. Egg Tray)",
    "imposterHint2": "another distractor (Single word only, e.g. Palette)"
  }

  CRITICAL CATEGORY LOCK: The "word" MUST absolutely be an item from the category: "${categoriesStr}". 
  Choosing a word outside of "${categoriesStr}" is a CRITICAL FAILURE.

  STRICT RULE: Every field MUST be a SINGLE WORD or short phrase. 
  DO NOT include definitions, descriptions, or explanations.
  NEVER return "Unknown", "N/A", or generic refusal text.`;

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
        temperature: 1.3,
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
    const type = req.query.type || "team";
    console.log(`Fetching leaderboard scores for type: ${type}...`);
    const scores = db
      .prepare(
        "SELECT team_name as name, score, members, type FROM leaderboard WHERE type = ? ORDER BY score DESC LIMIT 10",
      )
      .all(type);

    const parsedScores = scores.map((s: any) => ({
      ...s,
      members: s.members ? JSON.parse(s.members) : [],
    }));

    console.log(
      `Leaderboard results: ${parsedScores.length} entries found for ${type}.`,
    );
    res.json(parsedScores);
  });

  app.post("/api/score", (req, res) => {
    const body = req.body;
    console.log("Received score update request:", JSON.stringify(body));
    const updates = Array.isArray(body) ? body : [body];

    const stmt = db.prepare(`
      INSERT INTO leaderboard (team_name, score, members, type)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(team_name) DO UPDATE SET 
        score = score + EXCLUDED.score,
        members = EXCLUDED.members,
        type = EXCLUDED.type
    `);

    try {
      const transaction = db.transaction((items) => {
        for (const item of items) {
          if (item && item.name) {
            const cleanName = item.name.trim();
            console.log(`Updating score for: ${cleanName} (+${item.score})`);

            // Fetch existing members - case insensitive search
            const existing = db
              .prepare(
                "SELECT team_name, members FROM leaderboard WHERE UPPER(team_name) = UPPER(?)",
              )
              .get(cleanName) as any;

            let membersList: string[] = [];
            let dbName = cleanName; // Use the case already in DB if it exists

            if (existing) {
              dbName = existing.team_name;
              if (existing.members) {
                try {
                  membersList = JSON.parse(existing.members);
                } catch (e) {}
              }
            }

            // Merge new members
            const newMembers = item.members || [];
            newMembers.forEach((m: string) => {
              if (m && !membersList.includes(m)) {
                membersList.push(m);
              }
            });

            const type = item.type || "team";
            stmt.run(
              dbName,
              item.score || 0,
              JSON.stringify(membersList),
              type,
            );
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
    db.prepare("DELETE FROM rooms").run();
    db.prepare("DELETE FROM players").run();
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
          "DELETE FROM recent_words WHERE id NOT IN (SELECT id FROM recent_words ORDER BY used_at DESC LIMIT 15)",
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

  // --- Remote Play API ---

  function generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  app.post("/api/rooms/create", (req, res) => {
    const code = generateRoomCode();
    try {
      const info = db
        .prepare("INSERT INTO rooms (code, state) VALUES (?, ?)")
        .run(code, "lobby");
      res.json({ success: true, code, roomId: info.lastInsertRowid });
    } catch (err) {
      // Retry once if code exists
      const newCode = generateRoomCode();
      const info = db
        .prepare("INSERT INTO rooms (code, state) VALUES (?, ?)")
        .run(newCode, "lobby");
      res.json({ success: true, code: newCode, roomId: info.lastInsertRowid });
    }
  });

  app.post("/api/rooms/join", (req, res) => {
    const { code, isHost } = req.body;
    const name = (req.body.name || "").trim();
    const oldName = (req.body.oldName || "").trim();
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    try {
      if (oldName) {
        // Handle Rename
        db.prepare(
          "UPDATE players SET name = ? WHERE room_id = ? AND name = ?",
        ).run(name, room.id, oldName);

        // Update room's host name if the person renaming is the host
        if (isHost) {
          db.prepare("UPDATE rooms SET host_name = ? WHERE id = ?").run(
            name,
            room.id,
          );
        }

        return res.json({ success: true, roomId: room.id });
      }

      // Check for duplicate name
      const existing = db
        .prepare("SELECT id FROM players WHERE room_id = ? AND name = ?")
        .get(room.id, name);
      if (existing) {
        return res
          .status(400)
          .json({ error: "Name already taken in this room" });
      }

      // Update room's host name if this is the initial host or a rename
      if (isHost) {
        db.prepare("UPDATE rooms SET host_name = ? WHERE id = ?").run(
          name,
          room.id,
        );
      }

      // Set default settings if empty
      if (!room.settings) {
        db.prepare("UPDATE rooms SET settings = ? WHERE id = ?").run(
          JSON.stringify({ numImposters: 1 }),
          room.id,
        );
      }

      const player = db
        .prepare(
          "INSERT INTO players (room_id, name, is_host) VALUES (?, ?, ?)",
        )
        .run(room.id, name, isHost ? 1 : 0);
      res.json({
        success: true,
        playerId: player.lastInsertRowid,
        roomId: room.id,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/rooms/:code", (req, res) => {
    const { code } = req.params;
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    db.prepare(
      "DELETE FROM players WHERE room_id = ? AND last_active < DATETIME('now', '-60 seconds')",
    ).run(room.id);

    // Update last_active for current player if name provided in query
    const playerName = req.query.name as string;
    if (playerName) {
      db.prepare(
        "UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE room_id = ? AND name = ?",
      ).run(room.id, playerName);
    }

    const players = db
      .prepare("SELECT * FROM players WHERE room_id = ?")
      .all(room.id) as any[];

    // Access Control: Check if player is allowed to see the room
    const isHost = room.host_name === playerName;
    const isPlayerInRoom = players.some((p) => p.name === playerName);

    if (playerName && !isHost && !isPlayerInRoom) {
      console.log(
        `[Access Denied] Player "${playerName}" not in room ${code}. Host: "${room.host_name}"`,
      );
      return res
        .status(401)
        .json({ error: "Access denied: You are not in this room." });
    }

    // PROTECT SENSITIVE DATA: Hide roles and individual votes unless it's the result phase
    const sanitizedPlayers = players.map((p) => {
      const isMe = playerName && p.name === playerName;
      const isResultPhase = room.state === "result";

      return {
        ...p,
        // Show role ONLY for myself OR in the result phase OR if I am the host
        role: isMe || isResultPhase || isHost ? p.role : "player",
        // Show indicator that player HAS voted, but not who they voted for (unless it's me or result or host)
        hasVoted: !!p.vote,
        vote: isMe || isResultPhase || isHost ? p.vote : null,
        team_name: p.team_name,
      };
    });

    res.json({
      ...room,
      game_data: room.game_data ? JSON.parse(room.game_data) : null,
      settings: room.settings ? JSON.parse(room.settings) : {},
      players: sanitizedPlayers,
    });
  });

  app.post("/api/rooms/:code/leave", (req, res) => {
    const { code } = req.params;
    const { name } = req.body;
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (room) {
      db.prepare("DELETE FROM players WHERE room_id = ? AND name = ?").run(
        room.id,
        name,
      );
    }
    res.json({ success: true });
  });

  app.post("/api/rooms/:code/start", async (req, res) => {
    const { code } = req.params;
    const { categories, numImposters } = req.body;
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    try {
      const categoriesStr =
        categories && categories.length > 0 ? categories.join(", ") : "random";
      const gameDataArr = await generateGameData(categoriesStr);

      // Save generated word to recent_words to prevent repeats
      if (gameDataArr.word) {
        db.prepare("INSERT OR IGNORE INTO recent_words (word) VALUES (?)").run(
          gameDataArr.word.toLowerCase(),
        );
        db.prepare(
          "DELETE FROM recent_words WHERE id NOT IN (SELECT id FROM recent_words ORDER BY used_at DESC LIMIT 15)",
        ).run();
      }

      const players = db
        .prepare("SELECT * FROM players WHERE room_id = ?")
        .all(room.id) as any[];
      if (players.length < 3)
        return res.status(400).json({ error: "Need at least 3 players" });

      // Assign roles
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const imposterCount = numImposters || 1;
      const starter = players[Math.floor(Math.random() * players.length)].name;

      db.prepare(
        "UPDATE players SET role = 'player', vote = NULL WHERE room_id = ?",
      ).run(room.id);

      for (let i = 0; i < imposterCount; i++) {
        db.prepare("UPDATE players SET role = 'imposter' WHERE id = ?").run(
          shuffled[i].id,
        );
      }

      db.prepare(
        "UPDATE rooms SET state = 'reveal', game_data = ?, settings = ? WHERE id = ?",
      ).run(
        JSON.stringify(gameDataArr),
        JSON.stringify({
          numImposters: imposterCount,
          discussionStarter: starter,
        }),
        room.id,
      );

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/rooms/:code/vote", (req, res) => {
    const { code } = req.params;
    const { name, vote } = req.body; // 'vote' can be comma-separated names
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    db.prepare(
      "UPDATE players SET vote = ? WHERE room_id = ? AND name = ?",
    ).run(vote, room.id, name);

    res.json({ success: true });
  });

  app.post("/api/rooms/:code/join-team", (req, res) => {
    const { code } = req.params;
    const name = (req.body.name || "").trim();
    const team = (req.body.team || "").trim();
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    db.prepare(
      "UPDATE players SET team_name = ? WHERE room_id = ? AND name = ?",
    ).run(team, room.id, name);

    res.json({ success: true });
  });

  app.post("/api/rooms/:code/settings", (req, res) => {
    const { code } = req.params;
    const { settings } = req.body;
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    db.prepare("UPDATE rooms SET settings = ? WHERE id = ?").run(
      JSON.stringify(settings),
      room.id,
    );
    res.json({ success: true });
  });

  app.post("/api/rooms/:code/kick", (req, res) => {
    const { code } = req.params;
    const { name } = req.body;
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    db.prepare("DELETE FROM players WHERE room_id = ? AND name = ?").run(
      room.id,
      name,
    );
    res.json({ success: true });
  });

  app.post("/api/rooms/:code/update-state", (req, res) => {
    const { code } = req.params;
    const { state } = req.body;
    const room = db
      .prepare("SELECT * FROM rooms WHERE code = ?")
      .get(code) as any;
    if (!room) return res.status(404).json({ error: "Room not found" });

    db.prepare("UPDATE rooms SET state = ? WHERE id = ?").run(state, room.id);
    res.json({ success: true });
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

  const nets = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Game Server live!`);
    console.log(`> Local:   http://localhost:${PORT}`);
    addresses.forEach((addr) => {
      console.log(`> Network: http://${addr}:${PORT}`);
    });
    console.log("");
  });
}

startServer();
