import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url = "" } = req;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(`[NeuralBrain] Incoming ${method} request to: ${url}`);

  if (!apiKey) {
    console.error("[NeuralBrain] GEMINI_API_KEY IS MISSING!!!");
    return res.status(500).json({
      status: "error",
      message: "API key is missing in Vercel settings.",
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const masked =
    apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);

  // 1. Diagnostics/Health Check
  if (url.includes("/health") || url.endsWith("/health")) {
    console.log(`[NeuralBrain] Key Check: Found (${masked})`);

    try {
      await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: "ping",
      });
      return res.status(200).json({
        status: "ok",
        message: "Neural Core Online",
        diagnostics: {
          keyDetected: true,
          model: "gemini-1.5-flash",
          keyMasked: masked,
        },
      });
    } catch (err: any) {
      console.error("[NeuralBrain] AI test failed:", err.message);
      return res.status(200).json({
        status: "error",
        message: "API key recognized but Google returned an error.",
        details: err.message,
        keyUsed: masked,
      });
    }
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
      console.error("[NeuralBrain] Gen failure:", err.message);
      return res
        .status(500)
        .json({ error: "AI Generation failure", details: err.message });
    }
  }

  // 3. Leaderboard (Stubbed for stability)
  if (url.includes("/leaderboard") || url.endsWith("/leaderboard"))
    return res.status(200).json([]);
  if (url.includes("/score") || url.endsWith("/score"))
    return res.status(200).json({ success: true });

  // Generic Fallback
  console.log(`[NeuralBrain] Path fallback reached for URL: ${url}`);
  return res.status(200).json({
    message: "Neural Core reached, but route unknown.",
    url: url,
    method: method,
    advice: "Check your App.tsx fetch paths. The URL being received is: " + url,
  });
}
