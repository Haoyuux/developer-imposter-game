import { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
  }

  try {
    const { categories } = req.body;
    const categoriesStr =
      categories && categories.length > 0 ? categories.join(", ") : "general";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });

    const seed = Math.floor(Math.random() * 99999);
    const prompt = `Pick one secret word from the category: "${categoriesStr}" and a associated hint. [seed:${seed}] 
    Rules for hint: one associated word but NOT the same type (e.g. food -> fork).
    Return ONLY pure JSON: {"word": "word", "hint": "hint"}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text().trim();

    // Clean potential markdown or extra text
    const cleaned = raw.replace(/```json\s*|```\s*/gi, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json({
      word: (parsed.word || "error").toLowerCase(),
      hint: (parsed.hint || "error").toLowerCase(),
    });
  } catch (err: any) {
    console.error("AI Generation failed:", err);
    return res.status(500).json({
      error: "AI Generation failed",
      details: err.message,
    });
  }
}
