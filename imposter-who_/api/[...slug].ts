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

  // FORCE API VERSION TO 'v1' TO AVOID 404s ON BETA ENDPOINTS
  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1" });
  const masked =
    apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);

  // 1. Diagnostics/Health Check
  if (url.includes("/health") || url.endsWith("/health")) {
    const results: any = {};
    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
    ];

    for (const modelName of modelsToTry) {
      try {
        await ai.models.generateContent({
          model: modelName,
          contents: "ping",
        });
        return res.status(200).json({
          status: "ok",
          message: `Neural Core Online (Success with ${modelName} on v1 API)`,
          diagnostics: {
            activeModel: modelName,
            keyUsed: masked,
          },
        });
      } catch (err: any) {
        results[modelName] = err.message;
      }
    }

    // If ALL failed:
    return res.status(200).json({
      status: "error",
      message: "Every model failed on the stable v1 API endpoint.",
      keyUsed: masked,
      details: results,
    });
  }

  // 2. Word Generation
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};

      const prompt = `Game: "Imposter". Category: "${categories.join(", ")}". 
      Generate ONE common secret word and one hint associated with it but NOT the same type (e.g. word: 'pizza', hint: 'box').
      Return format: PURE JSON ONLY. No markdown.
      Example: {"word": "pizza", "hint": "box"}`;

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
    } catch (err: any) {
      return res.status(500).json({
        error: "AI Generation failure",
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
