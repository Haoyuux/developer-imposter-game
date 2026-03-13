import Database from "better-sqlite3";
const db = new Database("game.db");
const rows = db.prepare("SELECT * FROM leaderboard").all();
console.log(JSON.stringify(rows, null, 2));
