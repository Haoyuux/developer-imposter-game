import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Return empty leaderboard for now (SQlite not easily portable to serverless)
  return res.status(200).json([]);
}
