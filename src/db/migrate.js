import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists
const dataDir = path.join(new URL('.', import.meta.url).pathname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'wallu_telegram.db'));

// Create migrations table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
                                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                                          name TEXT NOT NULL UNIQUE,
                                          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Get all migration files
const migrationsDir = path.join(new URL('.', import.meta.url).pathname, 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort();

// Run migrations
db.transaction(() => {
  for (const file of migrationFiles) {
    const migrationName = path.parse(file).name;

    // Check if migration has been executed
    const executed = db.prepare('SELECT 1 FROM migrations WHERE name = ?')
      .get(migrationName);

    if (!executed) {
      console.log(`Running migration: ${file}`);

      // Execute migration
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);

      // Mark as executed
      db.prepare('INSERT INTO migrations (name) VALUES (?)')
        .run(migrationName);

      console.log(`Completed migration: ${file}`);
    }
  }
})();

console.log('All migrations completed');
db.close();
