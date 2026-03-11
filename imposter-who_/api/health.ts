import { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return response.status(500).json({
      status: "error",
      message: "GEMINI_API_KEY is missing in Vercel environment variables.",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });

    // Tiny test prompt
    const result = await model.generateContent("ping");
    const res = await result.response;

    if (res.text()) {
      return response
        .status(200)
        .json({ status: "ok", message: "AI is ready" });
    }
    throw new Error("Empty response from AI");
  } catch (err: any) {
    console.error("Health check failed:", err);
    return response.status(503).json({
      status: "error",
      message: "AI service unavailable",
      details: err.message,
    });
  }
}
