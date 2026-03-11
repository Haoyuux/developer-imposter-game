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

      // PROMPT REFINED: Focus on Semantic Similarity within the Category context
      const prompt = `Game: "Imposter". Category Context: "${categories.join(", ")}". 
      
      TASK:
      1. Pick a secret word from this category.
      2. Provide a "Real Hint" for players: A word that is related but slightly cryptic (diagonal thinking).
      3. Provide an "Imposter Hint": A word that is a NEAR-SYNONYM or DIRECTLY related in the SAME context.
      
      Avoid homophone gaps (e.g. if word is 'Tee' in Golf, do NOT give 'Steep' for Tea).
      The Imposter Hint must be a word that someone might actually confuse with the secret word or is very close in definition.
      
      Example Category: "Drinks"
      Word: "Espresso", Real Hint: "Shot", Imposter Hint: "Coffee" (Strongly similar).
      
      Example Category: "Sports"
      Word: "Tee", Real Hint: "Fairway", Imposter Hint: "Stand" or "Peg" (Strongly similar).

      Return format: PURE JSON ONLY. 
      {"word": "...", "hint": "...", "imposterHint": "..."}`;

      const executeGen = async (modelId: string) => {
        const result = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
        });
        const text = (result.text || "")
          .trim()
          .replace(/```json\s*|```\s*/gi, "");
        return JSON.parse(text);
      };

      try {
        const data = await executeGen("gemini-1.5-flash");
        return res.status(200).json({
          word: data.word,
          hint: data.hint,
          imposterHint: data.imposterHint || data.hint,
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
