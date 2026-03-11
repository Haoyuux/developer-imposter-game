import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
  }

  try {
    const { categories } = req.body;
    const catStr = categories?.length ? categories.join(", ") : "random";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    const prompt = `Game: Imposter. 
    Task: Generate ONE secret word from category: ${catStr} and its HINT.
    Format: Return ONLY JSON like {"word": "...", "hint": "..."}`;

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
    console.error("AI Generation error:", err);
    return res.status(500).json({ error: "AI failed", details: err.message });
  }
}
