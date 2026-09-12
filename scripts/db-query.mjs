// Node-based substitute for the `sqlite3` CLI, which is not installed on
// this machine. Usage: node scripts/db-query.mjs "SELECT * FROM payment_requests"
import { db } from "../src/db.js";

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: node scripts/db-query.mjs "SELECT ..."');
  process.exit(1);
}
console.table(db.prepare(sql).all());
db.close();
