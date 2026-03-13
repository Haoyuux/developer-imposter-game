import type { VercelRequest, VercelResponse } from "@vercel/node";

// Ephemeral storage for Vercel (resets on cold starts)
let ephemeralLeaderboard: { name: string; score: number }[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url = "" } = req;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      status: "error",
      message: "API key missing in Vercel settings.",
    });
  }

  // 1. Leaderboard Endpoints
  if (url.includes("/api/leaderboard") || url.endsWith("/leaderboard")) {
    const sorted = [...ephemeralLeaderboard]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return res.status(200).json(sorted);
  }

  if (url.includes("/api/score") || url.endsWith("/score")) {
    if (method === "POST") {
      try {
        const body = req.body;
        const updates = Array.isArray(body) ? body : [body];

        for (const { name, score } of updates) {
          if (!name) continue;
          const existing = ephemeralLeaderboard.find(
            (e) => e.name.toLowerCase() === name.toLowerCase(),
          );
          if (existing) {
            existing.score += score;
          } else {
            ephemeralLeaderboard.push({ name, score });
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
    ephemeralLeaderboard = [];
    return res.status(200).json({ success: true });
  }

  // 2. Diagnostics
  if (url.includes("/health") || url.endsWith("/health")) {
    return res.status(200).json({
      status: "ok",
      message: "Neural Core Online (DeepSeek)",
    });
  }

  // 3. Word Generation
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};
      const prompt = `ACT AS THE "BARKADA GAME MASTER" for "Imposter".
      CRITICAL CATEGORY LOCK: The secret word MUST absolutely belong to: "${categories.join(", ")}".
      TASK: Pick a secret word from category, Real Hint, and TWO Imposter Hints (imposterHint and imposterHint2).
      
      JSON Schema:
      {
        "word": "The secret word (Single word)",
        "type": "item type",
        "hint": "clue for hunters (Single word/Very short phrase)",
        "imposterHint": "distractor (Single word ONLY)",
        "imposterHint2": "another physical distractor (Single word ONLY)"
      }

      STRICT RULE: Every field MUST be a SINGLE WORD or short phrase. 
      DO NOT include definitions, descriptions, or explanations.
      CRITICAL: Picking a word outside of "${categories.join(", ")}" is a FAILURE.
      IMPORTANT: Return ONLY JSON. NEVER return "Unknown".`;

      const executeGen = async () => {
        const response = await fetch(
          "https://api.deepseek.com/chat/completions",
          {
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
              temperature: 0.3,
            }),
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`DeepSeek API error: ${errText}`);
        }

        const result = await response.json();
        let text = result.choices[0].message.content.trim();

        if (text.startsWith("```")) {
          text = text.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");
        }

        try {
          return JSON.parse(text);
        } catch (e) {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              return JSON.parse(match[0]);
            } catch (innerE) {
              throw innerE;
            }
          }
          throw e;
        }
      };

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

      const data = await executeGen();
      const rawWord =
        getVal(data, ["word", "secretWord", "item", "secret_word"]) || "error";
      const rawHint =
        getVal(data, ["hint", "playerHint", "clue", "real_hint"]) || "clue";
      const rawType = getVal(data, ["type", "category", "kind"]) || "item";
      const rawIH1 =
        getVal(data, [
          "imposterHint",
          "imposter_hint",
          "distractor1",
          "fake_hint1",
        ]) || rawHint;
      const rawIH2 =
        getVal(data, [
          "imposterHint2",
          "imposter_hint2",
          "distractor2",
          "fake_hint2",
        ]) || rawIH1;

      return res.status(200).json({
        word: sanitize(rawWord, "error").toLowerCase(),
        hint: sanitize(rawHint, "something").toLowerCase(),
        imposterHint: sanitize(
          rawIH1,
          sanitize(rawHint, "object"),
        ).toLowerCase(),
        imposterHint2: sanitize(
          rawIH2,
          sanitize(rawIH1, "concept"),
        ).toLowerCase(),
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "AI Generation failed", details: err.message });
    }
  }

  return res.status(200).json({ message: "Neural reached", url });
}
