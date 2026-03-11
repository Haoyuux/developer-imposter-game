import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

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

  // 1. Diagnostics & Auto-Discovery
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

  // 2. Word Generation
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};

      // PROMPT UPDATED FOR HARDER HINTS
      const prompt = `Game: "Imposter". Category: "${categories.join(", ")}". 
      STEP 1: Pick ONE common secret word.
      STEP 2: Generate a slightly cryptic/challenging HINT.
      HINT RULES:
      - ONE Word only.
      - AVOID the most obvious or direct association (e.g., if word is 'Coffee', don't use 'Cup' or 'Drink').
      - Use a 'diagonal' or second-order association (e.g., word: 'Coffee', hint: 'Roast' or 'Morning').
      - The hint must be fair but require a moment of thought.
      Return format: PURE JSON ONLY. e.g. {"word": "secret", "hint": "clue"}`;

      // Smart Model Fallback Wrapper
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
          word: (data.word || "error").toLowerCase(),
          hint: (data.hint || "error").toLowerCase(),
        });
      } catch (innerErr) {
        // Fallback to discovered model
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
          word: (data.word || "error").toLowerCase(),
          hint: (data.hint || "error").toLowerCase(),
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        error: "AI Generation failed",
        details: err.message,
        keyUsed: masked,
      });
    }
  }

  return res.status(200).json({ message: "Neural reached", keyUsed: masked });
}
