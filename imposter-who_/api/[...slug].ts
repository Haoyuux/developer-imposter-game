import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Ephemeral In-Memory Storage ───
// Uses globalThis to persist data across module reloads within the same Vercel instance.
// This survives warm invocations but resets on cold starts.

interface EphemeralPlayer {
  name: string;
  role: string;
  is_host: number;
  score: number;
  vote: string | null;
  team_name: string | null;
  last_active: number;
}

interface EphemeralRoom {
  code: string;
  state: string;
  settings: any;
  game_data: any;
  host_name: string;
  players: EphemeralPlayer[];
  created_at: number;
}

// Persist across module reloads using globalThis
const g = globalThis as any;
if (!g._ephemeralLeaderboard) g._ephemeralLeaderboard = [];
if (!g._rooms) g._rooms = new Map();
if (!g._recentWords) g._recentWords = [];

const ephemeralLeaderboard: {
  name: string;
  score: number;
  members?: string[];
  type: string;
}[] = g._ephemeralLeaderboard;
const rooms: Map<string, EphemeralRoom> = g._rooms;
let recentWords: string[] = g._recentWords;

// ─── Randomization Helpers ───

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

// ─── AI Generation ───

async function generateGameData(
  apiKey: string,
  categoriesStr: string,
): Promise<{
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
  const randomSeed = Math.floor(Math.random() * 999999);

  const avoidList =
    recentWords.length > 0
      ? `These words were recently used: [${recentWords.join(", ")}]. STRONGLY PREFER picking a different word — only reuse one of these if you truly cannot think of anything else for this category. Prioritize fresh, surprising choices.`
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
  - Imposter Hint 1 & 2: Two "distractor" words from DIFFERENT categories that share the SAME PHYSICAL ATTRIBUTES (Shape, Color, Container, Smell, or Temperature) as the "word".
  
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

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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

  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw e;
    }
  }

  const getVal = (obj: any, keys: string[]) => {
    for (const k of keys) {
      if (obj[k]) return obj[k];
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
    getVal(parsed, ["imposterHint", "imposter_hint", "distractor1"]) || rawHint;
  const rawIH2 =
    getVal(parsed, ["imposterHint2", "imposter_hint2", "distractor2"]) ||
    rawIH1;

  const word = sanitize(rawWord, "error").toLowerCase();

  // Track recent words
  recentWords.push(word);
  if (recentWords.length > 15) recentWords = recentWords.slice(-15);

  return {
    word,
    type: sanitize(rawType, "item").toLowerCase(),
    hint: sanitize(rawHint, "something").toLowerCase(),
    imposterHint: sanitize(rawIH1, sanitize(rawHint, "object")).toLowerCase(),
    imposterHint2: sanitize(rawIH2, sanitize(rawIH1, "concept")).toLowerCase(),
  };
}

// ─── Helper: Generate Room Code ───

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// ─── Helper: Clean stale players (inactive > 60s) ───

function cleanStalePlayers(room: EphemeralRoom) {
  const cutoff = Date.now() - 60000;
  room.players = room.players.filter((p) => p.last_active > cutoff);
}

// ─── Helper: Sanitize players for response ───

function sanitizePlayers(room: EphemeralRoom, playerName?: string): any[] {
  const isHost = room.host_name === playerName;
  const isResultPhase = room.state === "result";

  return room.players.map((p) => {
    const isMe = playerName && p.name === playerName;
    return {
      ...p,
      role: isMe || isResultPhase || isHost ? p.role : "player",
      hasVoted: !!p.vote,
      vote: isMe || isResultPhase || isHost ? p.vote : null,
    };
  });
}

// ─── Main Handler ───

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url = "" } = req;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      status: "error",
      message: "API key missing in Vercel settings.",
    });
  }

  // ════════════════════════════════════════
  // 1. LEADERBOARD ENDPOINTS
  // ════════════════════════════════════════

  if (url.includes("/api/leaderboard") || url.endsWith("/leaderboard")) {
    const { type = "team" } = req.query;
    const sorted = [...ephemeralLeaderboard]
      .filter((e) => e.type === type)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return res.status(200).json(sorted);
  }

  if (url.includes("/api/score") || url.endsWith("/score")) {
    if (method === "POST") {
      try {
        const body = req.body;
        const updates = Array.isArray(body) ? body : [body];

        for (const { name, score, members, type = "team" } of updates) {
          if (!name) continue;
          const existing = ephemeralLeaderboard.find(
            (e) =>
              e.name.toLowerCase() === name.toLowerCase() && e.type === type,
          );
          if (existing) {
            existing.score += score;
            if (members && Array.isArray(members)) {
              if (!existing.members) existing.members = [];
              members.forEach((m: string) => {
                if (!existing.members!.includes(m)) existing.members!.push(m);
              });
            }
          } else {
            ephemeralLeaderboard.push({
              name,
              score,
              members: members || [],
              type,
            });
          }
        }
        return res.status(200).json({ success: true, count: updates.length });
      } catch (err: any) {
        return res
          .status(500)
          .json({ error: "Score update failed", details: err.message });
      }
    }
  }

  if (
    url.includes("/api/reset-leaderboard") ||
    url.endsWith("/reset-leaderboard")
  ) {
    ephemeralLeaderboard.length = 0;
    g._ephemeralLeaderboard = ephemeralLeaderboard;
    rooms.clear();
    return res.status(200).json({ success: true });
  }

  // ════════════════════════════════════════
  // 2. HEALTH CHECK
  // ════════════════════════════════════════

  if (url.includes("/health") || url.endsWith("/health")) {
    return res.status(200).json({
      status: "ok",
      message: "Neural Core Online (DeepSeek)",
    });
  }

  // ════════════════════════════════════════
  // 3. WORD GENERATION
  // ════════════════════════════════════════

  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};
      const categoriesStr = categories.join(", ");
      const { word, hint, imposterHint, imposterHint2 } =
        await generateGameData(apiKey, categoriesStr);

      return res.status(200).json({
        word,
        hint,
        imposterHint,
        imposterHint2,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "AI Generation failed", details: err.message });
    }
  }

  // ════════════════════════════════════════
  // 4. REMOTE ROOM ENDPOINTS
  // ════════════════════════════════════════

  // --- Create Room ---
  if (
    (url.includes("/api/rooms/create") || url.endsWith("/rooms/create")) &&
    method === "POST"
  ) {
    const code = generateRoomCode();
    const room: EphemeralRoom = {
      code,
      state: "lobby",
      settings: { numImposters: 1 },
      game_data: null,
      host_name: "",
      players: [],
      created_at: Date.now(),
    };
    rooms.set(code, room);
    console.log(
      `[Room Create] Created room ${code}. Total rooms in memory: ${rooms.size}`,
    );
    return res.status(200).json({ success: true, code, roomId: code });
  }

  // --- Join Room ---
  if (
    (url.includes("/api/rooms/join") || url.endsWith("/rooms/join")) &&
    method === "POST"
  ) {
    const { code, name, isHost } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ error: "Code and name required" });
    }
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Check for duplicate name
    if (room.players.some((p) => p.name === name)) {
      return res.status(409).json({ error: "Name already taken in this room" });
    }

    if (isHost) {
      room.host_name = name;
    }

    room.players.push({
      name,
      role: "player",
      is_host: isHost ? 1 : 0,
      score: 0,
      vote: null,
      team_name: null,
      last_active: Date.now(),
    });

    return res
      .status(200)
      .json({ success: true, playerId: name, roomId: code });
  }

  // --- Room endpoints with code in URL ---
  // Match /api/rooms/XXXXX or /api/rooms/XXXXX/action
  const roomMatch = url.match(/\/api\/rooms\/([A-Z0-9]{4,7})(?:\/([^?/]+))?/i);
  if (roomMatch) {
    const code = roomMatch[1].toUpperCase();
    const action = roomMatch[2] || null; // start, vote, leave, kick, update-state, settings, join-team, play-again
    const room = rooms.get(code);

    if (!room) {
      console.log(
        `[Room GET] Room ${code} NOT found. Active rooms: [${Array.from(rooms.keys()).join(", ")}]`,
      );
      return res.status(404).json({ error: "Room not found" });
    }

    // --- GET /api/rooms/:code (Get Room Status) ---
    if (!action && method === "GET") {
      cleanStalePlayers(room);

      const playerName = req.query.name as string;
      if (playerName) {
        const player = room.players.find((p) => p.name === playerName);
        if (player) {
          player.last_active = Date.now();
        }
      }

      // Access control
      const isHost = room.host_name === playerName;
      const isPlayerInRoom = room.players.some((p) => p.name === playerName);
      if (playerName && !isHost && !isPlayerInRoom) {
        return res
          .status(401)
          .json({ error: "Access denied: You are not in this room." });
      }

      return res.status(200).json({
        code: room.code,
        state: room.state,
        game_data: room.game_data,
        settings: room.settings,
        host_name: room.host_name,
        players: sanitizePlayers(room, playerName),
      });
    }

    // --- POST /api/rooms/:code/start ---
    if (action === "start" && method === "POST") {
      const { categories, numImposters } = req.body || {};
      try {
        const categoriesStr =
          categories && categories.length > 0
            ? categories.join(", ")
            : "random";
        const gameData = await generateGameData(apiKey, categoriesStr);

        if (room.players.length < 3) {
          return res.status(400).json({ error: "Need at least 3 players" });
        }

        // Assign roles
        const shuffled = [...room.players].sort(() => Math.random() - 0.5);
        const imposterCount = numImposters || 1;
        const starter =
          room.players[Math.floor(Math.random() * room.players.length)].name;

        // Reset all to player
        room.players.forEach((p) => {
          p.role = "player";
          p.vote = null;
        });

        // Assign imposters
        for (let i = 0; i < Math.min(imposterCount, shuffled.length - 1); i++) {
          const target = room.players.find((p) => p.name === shuffled[i].name);
          if (target) target.role = "imposter";
        }

        room.state = "reveal";
        room.game_data = gameData;
        room.settings = {
          numImposters: imposterCount,
          discussionStarter: starter,
        };

        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // --- POST /api/rooms/:code/vote ---
    if (action === "vote" && method === "POST") {
      const { name, vote } = req.body || {};
      const player = room.players.find((p) => p.name === name);
      if (player) {
        player.vote = vote;
      }
      return res.status(200).json({ success: true });
    }

    // --- POST /api/rooms/:code/leave ---
    if (action === "leave" && method === "POST") {
      const { name } = req.body || {};
      room.players = room.players.filter((p) => p.name !== name);
      return res.status(200).json({ success: true });
    }

    // --- POST /api/rooms/:code/kick ---
    if (action === "kick" && method === "POST") {
      const { name } = req.body || {};
      room.players = room.players.filter((p) => p.name !== name);
      return res.status(200).json({ success: true });
    }

    // --- POST /api/rooms/:code/update-state (also accepts /state) ---
    if (
      (action === "update-state" || action === "state") &&
      method === "POST"
    ) {
      const { state } = req.body || {};
      if (state) room.state = state;
      return res.status(200).json({ success: true });
    }

    // --- POST /api/rooms/:code/settings ---
    if (action === "settings" && method === "POST") {
      const { settings } = req.body || {};
      if (settings) room.settings = settings;
      return res.status(200).json({ success: true });
    }

    // --- POST /api/rooms/:code/join-team ---
    if (action === "join-team" && method === "POST") {
      const { name, team } = req.body || {};
      const player = room.players.find((p) => p.name === name);
      if (player) {
        player.team_name = team;
      }
      return res.status(200).json({ success: true });
    }

    // --- POST /api/rooms/:code/play-again ---
    if (action === "play-again" && method === "POST") {
      room.state = "lobby";
      room.game_data = null;
      room.players.forEach((p) => {
        p.role = "player";
        p.vote = null;
      });
      return res.status(200).json({ success: true });
    }

    // Fallback for unrecognized room action
    return res.status(200).json({ message: "Room action not found", url });
  }

  return res.status(200).json({ message: "Neural reached", url });
}
