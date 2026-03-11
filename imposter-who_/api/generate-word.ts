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
      categories && categories.length > 0 ? categories.join(", ") : "random";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });

    const seed = Math.floor(Math.random() * 99999);
    const prompt = `You are picking a word and a hint for a party game called "Imposter". [seed:${seed}]
    Pick one secret word from the category: "${categoriesStr}"
    Return ONLY valid JSON: {"word": "secretword", "type": "type", "hint": "hintword"}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text().trim();

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json({
      word: parsed.word.toLowerCase(),
      hint: parsed.hint.toLowerCase(),
    });
  } catch (err: any) {
    console.error("AI Generation failed:", err);
    return res.status(500).json({
      error: "AI Generation failed",
      details: err.message,
    });
  }
}
