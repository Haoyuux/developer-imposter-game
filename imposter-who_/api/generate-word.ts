import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow simple GET for browser testing or POST from app
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "GEMINI_API_KEY is missing in Vercel." });
  }

  try {
    const categories = req.body?.categories || ["random"];
    const catStr = categories.join(", ");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    const prompt = `You are a game engine for "Imposter".
    Task: Secret Word and Hint generation.
    Category: ${catStr}
    Return format: PURE JSON ONLY. No markdown.
    Example: {"word": "pizza", "hint": "pepperoni"}
    Pick a common but interesting word.`;

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
    console.error(err);
    return res.status(500).json({ error: "AI Failed", details: err.message });
  }
}
