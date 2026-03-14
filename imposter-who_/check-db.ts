import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "game.db");
const db = new Database(dbPath);

console.log("--- Leaderboard ---");
const leaderboard = db.prepare("SELECT * FROM leaderboard").all();
console.log(JSON.stringify(leaderboard, null, 2));

console.log("\n--- Active Players ---");
const players = db.prepare("SELECT * FROM players").all();
console.log(JSON.stringify(players, null, 2));

console.log("\n--- Rooms ---");
const rooms = db.prepare("SELECT * FROM rooms").all();
console.log(JSON.stringify(rooms, null, 2));
