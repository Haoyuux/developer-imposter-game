import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url = "" } = req;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey)
    return res
      .status(500)
      .json({ status: "error", message: "API key missing." });

  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1" });
  const masked =
    apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);

  if (url.includes("/health") || url.endsWith("/health")) {
    try {
      console.log("[NeuralBrain] Attempting to find available models...");

      const foundModels: string[] = [];
      const modelsIterator = await ai.models.list();

      // Iterate through the async iterator to get model names
      for await (const model of modelsIterator) {
        foundModels.push(model.name);
        if (foundModels.length >= 15) break;
      }

      if (foundModels.length > 0) {
        return res.status(200).json({
          status: "ok",
          message: "Neural Core reached. Found active models.",
          keyUsed: masked,
          availableModels: foundModels,
        });
      }

      return res.status(200).json({
        status: "error",
        message:
          "No models found for this API key. Is the Generative Language API enabled?",
        keyUsed: masked,
      });
    } catch (err: any) {
      return res.status(200).json({
        status: "error",
        message: "Discovery failed.",
        keyUsed: masked,
        error: err.message,
        stack: err.stack?.split("\n").slice(0, 3).join(" | "),
      });
    }
  }

  // Word Gen
  if (url.includes("/generate-word") || url.endsWith("/generate-word")) {
    try {
      const { categories = ["random"] } = req.body || {};

      // We try common names. If discovery worked above, we can refine this.
      const resAI = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `JSON format: {"word":"...","hint":"..."} for category: ${categories.join(",")}`,
      });
      return res
        .status(200)
        .json(JSON.parse(resAI.text.trim().replace(/```json\s*|```\s*/gi, "")));
    } catch (err: any) {
      return res.status(500).json({
        error: "Generation failed",
        details: err.message,
        keyUsed: masked,
      });
    }
  }

  return res.status(200).json({ message: "Neural reached", url });
}
