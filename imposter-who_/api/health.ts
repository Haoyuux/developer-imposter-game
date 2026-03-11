import { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ status: "error", message: "API key missing" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });
    const result = await model.generateContent("ping");
    const text = (await result.response).text();
    return res.status(200).json({ status: "ok", message: "AI Ready" });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}
