import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url = "" } = req;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(`[NeuralBrain] Incoming ${method} request to: ${url}`);

  // 1. Diagnostics/Health Check
  if (url.includes("/health") || url.endsWith("/health")) {
    if (!apiKey) {
      console.error("[NeuralBrain] GEMINI_API_KEY IS MISSING!!!");
      return res.status(500).json({
        status: "error",
        message: "API key is missing in Vercel settings.",
      });
    }

    const masked =
      apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`[NeuralBrain] Key Check: Found (${masked})`);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });
      await model.generateContent("ping");
      return res.status(200).json({
        status: "ok",
        message: "Neural Core Online",
        diagnostics: { keyDetected: true, model: "gemini-1.5-flash" },
      });
    } catch (err: any) {
      console.error("[NeuralBrain] AI test failed:", err.message);
      return res.status(200).json({
        status: "error",
        message: "API found but AI test failed.",
        details: err.message,
      });
    }
  }

  // 2. Word Generation
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      if (!apiKey) throw new Error("API key missing.");
      const { categories = ["random"] } = req.body || {};

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

      const prompt = `Game: "Imposter". Category: "${categories.join(", ")}". 
      Generate ONE common secret word and one hint associated with it but NOT the same type (e.g. word: 'pizza', hint: 'box').
      Return format: PURE JSON ONLY. No markdown.
      Example: {"word": "pizza", "hint": "box"}`;

      const result = await model.generateContent(prompt);
      const text = (await result.response)
        .text()
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
