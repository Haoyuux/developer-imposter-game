import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "game.db");
const db = new Database(dbPath);

console.log("--- Rooms ---");
const rooms = db.prepare("SELECT * FROM rooms").all();
console.log(rooms);

console.log("\n--- Players ---");
const players = db.prepare("SELECT * FROM players").all();
console.log(players);
