import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

export const db = new Database(process.env.DB_PATH ?? "./agentpay.db");
db.pragma("journal_mode = WAL");
db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
