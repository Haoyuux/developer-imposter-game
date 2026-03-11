import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("--- NEURAL CORE HEALTH CHECK START ---");
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error(
      "CRITICAL: GEMINI_API_KEY is missing in Vercel Environment Variables!",
    );
    return res.status(500).json({
      status: "error",
      message:
        "API key is missing in Vercel. Please check Project Settings > Environment Variables.",
    });
  }

  // Print a masked version to the Vercel Logs so we can verify it's there
  const maskedKey =
    apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);
  console.log("System detected API Key:", maskedKey);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    // Lightweight check to confirm key works
    await model.generateContent("ping");

    console.log("AI Verification: SUCCESS");
    return res.status(200).json({
      status: "ok",
      message: "Neural Core Online",
      envCheck: "GEMINI_API_KEY detected and verified",
    });
  } catch (err: any) {
    console.error("AI Verification: FAILED", err.message);
    return res.status(500).json({ status: "error", details: err.message });
  }
}
