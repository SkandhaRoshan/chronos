import Database from "better-sqlite3";
export let db: any;

export function initializeDatabase(path: string) {
  db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS protocol_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      chainId INTEGER NOT NULL,
      aaveApy REAL NOT NULL,
      uniswapApy REAL NOT NULL,
      stakingApy REAL NOT NULL
    )
  `);
}

export function closeDatabase() { if (db) db.close(); }

export function insertProtocolSnapshot(snapshot: { timestamp: string; chainId: number; aaveApy: number; uniswapApy: number; stakingApy: number }) {
  if (!db) return;
  const stmt = db.prepare(`INSERT INTO protocol_snapshots (timestamp, chainId, aaveApy, uniswapApy, stakingApy) VALUES (?, ?, ?, ?, ?)`);
  stmt.run(snapshot.timestamp, snapshot.chainId, snapshot.aaveApy, snapshot.uniswapApy, snapshot.stakingApy);
}
