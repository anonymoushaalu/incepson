import { db } from "../src/db.js";
console.log("db file:", db.name);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("tables:", tables);
console.log("epoch:", db.prepare("SELECT * FROM budget_epoch").all());
db.close();
