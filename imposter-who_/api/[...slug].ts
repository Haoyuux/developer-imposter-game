import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// Ephemeral storage for Vercel (resets on cold starts)
let ephemeralLeaderboard: { name: string; score: number }[] = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url = "" } = req;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "API key missing in Vercel settings.",
      });
  }

  const ai = new GoogleGenAI({ apiKey });
  const masked =
    apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);

  // 1. Leaderboard Endpoints
  if (url.includes("/api/leaderboard") || url.endsWith("/leaderboard")) {
    const sorted = [...ephemeralLeaderboard]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    return res.status(200).json(sorted);
  }

  if (url.includes("/api/score") || url.endsWith("/score")) {
    if (method === "POST") {
      try {
        const { name, score } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });

        const existing = ephemeralLeaderboard.find(
          (e) => e.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          existing.score += score;
        } else {
          ephemeralLeaderboard.push({ name, score });
        }
        return res.status(200).json({ success: true });
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

  // 2. Diagnostics & Auto-Discovery
  if (url.includes("/health") || url.endsWith("/health")) {
    try {
      const found: string[] = [];
      const modelsIterator = await ai.models.list();
      for await (const m of modelsIterator) {
        found.push(m.name);
        if (found.length >= 20) break;
      }

      return res.status(200).json({
        status: "ok",
        message: found.length > 0 ? "Neural Core Online" : "No models found",
        diagnostics: {
          keyUsed: masked,
          availableModels: found,
          recommendation:
            found.find((n) => n.includes("flash")) ||
            (found.length > 0 ? found[0] : "None"),
        },
      });
    } catch (err: any) {
      return res.status(200).json({
        status: "error",
        message: "Discovery failed.",
        details: err.message,
        keyUsed: masked,
      });
    }
  }

  // 3. Word Generation
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};

      // PROMPT UPDATED: Higher similarity for imposter blending
      const prompt = `Game: "Imposter". Category: "${categories.join(", ")}". 
      STEP 1: Pick ONE common secret word.
      STEP 2: Generate a challenging ONE-WORD hint for the real players (avoiding literal associations).
      STEP 3: Pick a "Fake Hint" for the Imposter that is closely related or similar in context to the secret word, to help them blend in.
      
      Example: 
      Secret: "Coffee", Real Hint: "Roast", Imposter Hint: "Cappuccino" (similar/related word).
      
      Return format: PURE JSON ONLY. e.g. {"word": "pizza", "hint": "crust", "imposterHint": "pepperoni"}`;

      const executeGen = async (modelId: string) => {
        const result = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
        });
        const text = (result.text || "")
          .trim()
          .replace(/```json\s*|```\s*/gi, "");
        const data = JSON.parse(text);
        // Ensure we return the 'hint' as 'hint' and 'imposterHint' as 'hint' for the response if needed,
        // but the frontend uses `data.word` and `data.hint` for the main game.
        // We'll return them as discrete fields:
        return data;
      };

      try {
        const data = await executeGen("gemini-1.5-flash");
        return res.status(200).json({
          word: data.word,
          hint: data.hint, // The real clue
          imposterHint: data.imposterHint || data.hint, // The blending tip
        });
      } catch (innerErr) {
        let modelToUse = "";
        const modelsIterator = await ai.models.list();
        for await (const m of modelsIterator) {
          if (m.name.includes("flash")) {
            modelToUse = m.name;
            break;
          }
        }
        if (!modelToUse) throw new Error("No models available.");
        const data = await executeGen(modelToUse);
        return res.status(200).json({
          word: data.word,
          hint: data.hint,
          imposterHint: data.imposterHint || data.hint,
        });
      }
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "AI Generation failed", details: err.message });
    }
  }

  return res.status(200).json({ message: "Neural reached", url });
}
