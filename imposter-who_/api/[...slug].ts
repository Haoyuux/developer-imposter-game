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

      // The SDK returns an async iterator
      for await (const m of modelsIterator) {
        found.push(m.name);
        if (found.length >= 20) break;
      }

      return res.status(200).json({
        status: "ok",
        message:
          found.length > 0
            ? "Neural Core Online (Discovery Success)"
            : "Neural Core reached but no models found",
        diagnostics: {
          keyUsed: masked,
          availableModels: found,
          recommendation:
            found.find((n) => n.includes("flash")) ||
            (found.length > 0 ? found[0] : "None"),
        },
      });
    } catch (err: any) {
      console.error("[NeuralBrain] Discovery failed:", err.message);
      return res.status(200).json({
        status: "error",
        message:
          "Discovery failed. The API key might be invalid or restricted.",
        details: err.message,
        keyUsed: masked,
      });
    }
  }

  // 2. Word Generation with Smart Fallback
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};
      const prompt = `Game: "Imposter". Category: "${categories.join(", ")}". 
      Generate ONE common secret word and one hint associated with it but NOT the same type.
      Return format: PURE JSON ONLY. e.g. {"word": "pizza", "hint": "box"}`;

      // Try 1: Standard ID
      try {
        const result = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt,
        });
        const text = (result.text || "")
          .trim()
          .replace(/```json\s*|```\s*/gi, "");
        const data = JSON.parse(text);
        return res.status(200).json({
          word: (data.word || "error").toLowerCase(),
          hint: (data.hint || "error").toLowerCase(),
        });
      } catch (innerErr) {
        console.warn(
          "[NeuralBrain] Standard model failed, attempting discovery fallback...",
        );

        // Try 2: Auto-Discovery
        let modelToUse = "";
        const modelsIterator = await ai.models.list();
        for await (const m of modelsIterator) {
          if (m.name.includes("flash")) {
            modelToUse = m.name;
            break;
          }
        }

        if (!modelToUse) {
          // Last ditch effort: pick the very first model available
          const secondIterator = await ai.models.list();
          for await (const m of secondIterator) {
            modelToUse = m.name;
            break;
          }
        }

        if (!modelToUse)
          throw new Error("No usable models found for this API key.");

        const result = await ai.models.generateContent({
          model: modelToUse,
          contents: prompt,
        });
        const text = (result.text || "")
          .trim()
          .replace(/```json\s*|```\s*/gi, "");
        const data = JSON.parse(text);
        return res.status(200).json({
          word: (data.word || "error").toLowerCase(),
          hint: (data.hint || "error").toLowerCase(),
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        error: "AI Discovery & Generation failed",
        details: err.message,
        keyUsed: masked,
      });
    }
  }

  return res.status(200).json({
    message: "Neural Core reached, but route unknown.",
    url: url,
    keyUsed: masked,
  });
}
