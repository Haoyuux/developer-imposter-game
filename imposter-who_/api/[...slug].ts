import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url = "" } = req;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey)
    return res.status(500).json({ status: "error", message: "Key missing" });

  // Use default configuration first
  const ai = new GoogleGenAI({ apiKey });
  const masked =
    apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);

  if (url.includes("/health") || url.endsWith("/health")) {
    try {
      console.log("[NeuralBrain] Attempting to list available models...");

      // CALL LIST TO SEE WHAT THIS KEY ACTUALLY HAS ACCESS TO
      const modelsResponse = await ai.models.list();
      const availableModels = modelsResponse.map((m: any) => m.name);

      return res.status(200).json({
        status: "ok",
        message: "Neural Core reached. Listing available models for this key.",
        keyUsed: masked,
        availableModels: availableModels.slice(0, 10), // Show first 10
      });
    } catch (err: any) {
      console.error("[NeuralBrain] List failed:", err.message);

      // If listing fails, try forcing a specific known ID format
      try {
        await ai.models.generateContent({
          model: "models/gemini-1.5-flash", // TRY WITH THE models/ PREFIX
          contents: "ping",
        });
        return res.status(200).json({
          status: "ok",
          message: "Success using models/gemini-1.5-flash prefix",
          keyUsed: masked,
        });
      } catch (innerErr: any) {
        return res.status(200).json({
          status: "error",
          message: "Could not list models or ping gemini.",
          keyUsed: masked,
          listError: err.message,
          pingError: innerErr.message,
        });
      }
    }
  }

  // Word Gen
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};
      const resAI = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `JSON only: {"word":"...","hint":"..."} for category: ${categories.join(",")}`,
      });
      return res
        .status(200)
        .json(JSON.parse(resAI.text.trim().replace(/```json\s*|```\s*/gi, "")));
    } catch (err: any) {
      // Fallback attempt with prefix
      try {
        const resAI = await ai.models.generateContent({
          model: "models/gemini-1.5-flash",
          contents: `JSON only: {"word":"...","hint":"..."} for category: ${categories.join(",")}`,
        });
        return res
          .status(200)
          .json(
            JSON.parse(resAI.text.trim().replace(/```json\s*|```\s*/gi, "")),
          );
      } catch (finalErr: any) {
        return res.status(500).json({
          error: "AI Generation failure",
          details: err.message,
          fallback_details: finalErr.message,
          keyUsed: masked,
        });
      }
    }
  }

  return res.status(200).json({ status: "not_found" });
}
