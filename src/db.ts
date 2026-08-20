import Database from 'better-sqlite3'

/** 打开（或创建）SQLite 数据库并执行建表迁移。测试用 ':memory:'。 */
export function openDb(path: string = 'pinbox.db'): Database.Database {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      UNIQUE(name, parent_id)
    );
    CREATE TABLE IF NOT EXISTS bookmark_collections (
      bookmark_id INTEGER NOT NULL,
      collection_id INTEGER NOT NULL,
      PRIMARY KEY (bookmark_id, collection_id),
      FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (bookmark_id, tag_id),
      FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `)
}
