import Database from "better-sqlite3";
const db = new Database("game.db");
try {
  db.prepare("INSERT INTO leaderboard (team_name, score) VALUES (?, ?)").run(
    "Test Team",
    10,
  );
  console.log("Successfully inserted test data.");
} catch (e) {
  console.log("Insert failed:", e.message);
}
const rows = db.prepare("SELECT * FROM leaderboard").all();
console.log(JSON.stringify(rows, null, 2));
