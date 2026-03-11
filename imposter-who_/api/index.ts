import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Helper to get Gemini model
const getModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
};

// 1. Health check (the one failing 404)
app.get("/api/health", async (req, res) => {
  try {
    const model = getModel();
    const result = await model.generateContent("ping");
    res.json({ status: "ok", message: "AI Responsive" });
  } catch (err: any) {
    res.status(503).json({ status: "error", details: err.message });
  }
});

// 2. Word generation
app.post("/api/generate-word", async (req, res) => {
  try {
    const model = getModel();
    const { categories } = req.body;
    const catStr = categories?.length ? categories.join(", ") : "random";
    const seed = Math.floor(Math.random() * 99999);

    const prompt = `Pick one secret word and hint for "Imposter" game. Category: "${catStr}". [seed:${seed}] 
    Return JSON: {"word": "...", "hint": "..."}`;

    const result = await model.generateContent(prompt);
    const raw = (await result.response).text().trim();
    const cleaned = raw.replace(/```json\s*|```\s*/gi, "").trim();
    const parsed = JSON.parse(cleaned);

    res.json({
      word: parsed.word.toLowerCase(),
      hint: parsed.hint.toLowerCase(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Generation failed", details: err.message });
  }
});

// 3. Simple Mock Leaderboard (Prevents SQLite crashes on Vercel)
app.get("/api/leaderboard", (req, res) => res.json([]));
app.post("/api/score", (req, res) => res.json({ success: true }));

// CRITICAL: DO NOT use app.listen() here. Vercel handles that!
export default app;
