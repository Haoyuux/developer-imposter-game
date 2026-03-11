import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ status: "error", message: "API key missing in Vercel." });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });
    await model.generateContent("ping");
    return res
      .status(200)
      .json({ status: "ok", message: "Health check passed." });
  } catch (err: any) {
    return res.status(500).json({ status: "error", details: err.message });
  }
}
