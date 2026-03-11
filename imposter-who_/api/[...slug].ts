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

  // 1. Diagnostics/Health Check
  if (url.includes("/health") || url.endsWith("/health")) {
    const results: any = {};
    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
    ];

    for (const modelName of modelsToTry) {
      try {
        await ai.models.generateContent({
          model: modelName,
          contents: "ping",
        });
        return res.status(200).json({
          status: "ok",
          message: `Neural Core Online (Success with ${modelName})`,
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
      message:
        "Multiple models attempted but all failed. Your API key might be restricted to specific models or regionalized.",
      keyUsed: masked,
      attempts: results,
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

      // Try 1.5 Flash first as it has most reliable free quota
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

  // 3. Leaderboard/Score logic (Stubs)
  if (url.includes("/leaderboard") || url.endsWith("/leaderboard"))
    return res.json([]);
  if (url.includes("/score") || url.endsWith("/score"))
    return res.json({ success: true });

  return res.status(200).json({
    message: "Neural Core reached, but route unknown.",
    url: url,
    keyUsed: masked,
  });
}
