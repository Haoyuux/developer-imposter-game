import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({
        status: "error",
        message: "GEMINI_API_KEY is not set in Vercel.",
      });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    // Test call
    await model.generateContent("ping");

    return res
      .status(200)
      .json({ status: "ok", message: "Neural Core Online" });
  } catch (err: any) {
    console.error("Health check error:", err);
    return res.status(500).json({ status: "error", details: err.message });
  }
}
