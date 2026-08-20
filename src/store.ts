import type Database from 'better-sqlite3'
import { normalizeUrl } from './normalize'

export interface Bookmark {
  id: number
  url: string
  title: string
  description: string
  created_at: string
}
export interface Collection {
  id: number
  name: string
  parent_id: number | null
}
export interface Tag {
  id: number
  name: string
}

export interface AddBookmarkInput {
  url: string
  title?: string
  description?: string
  tags?: string[]
  collections?: number[]
}

export function createStore(db: Database.Database) {
  const stmtAddBookmark = db.prepare(
    'INSERT INTO bookmarks (url, title, description) VALUES (?, ?, ?)',
  )
  const stmtGetBookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?')
  const stmtListBookmarks = db.prepare(
    'SELECT * FROM bookmarks ORDER BY created_at DESC',
  )
  const stmtDeleteBookmark = db.prepare('DELETE FROM bookmarks WHERE id = ?')
  const stmtInsertCollection = db.prepare(
    'INSERT INTO collections (name, parent_id) VALUES (?, ?)',
  )
  const stmtListCollections = db.prepare('SELECT * FROM collections ORDER BY name')
  const stmtInsertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
  const stmtGetTagByName = db.prepare('SELECT * FROM tags WHERE name = ?')
  const stmtLinkTag = db.prepare(
    'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)',
  )
  const stmtLinkCollection = db.prepare(
    'INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)',
  )

  return {
    addBookmark(input: AddBookmarkInput): Bookmark {
      const url = normalizeUrl(input.url)
      const info = stmtAddBookmark.run(url, input.title ?? '', input.description ?? '')
      const id = Number(info.lastInsertRowid)
      for (const t of input.tags ?? []) {
        stmtInsertTag.run(t)
        const tag = stmtGetTagByName.get(t) as Tag
        stmtLinkTag.run(id, tag.id)
      }
      for (const c of input.collections ?? []) stmtLinkCollection.run(id, c)
      return stmtGetBookmark.get(id) as Bookmark
    },

    getBookmark(id: number): Bookmark | undefined {
      return stmtGetBookmark.get(id) as Bookmark | undefined
    },

    listBookmarks(): Bookmark[] {
      return stmtListBookmarks.all() as Bookmark[]
    },

    deleteBookmark(id: number): boolean {
      return stmtDeleteBookmark.run(id).changes > 0
    },

    createCollection(name: string, parentId: number | null = null): Collection {
      const info = stmtInsertCollection.run(name, parentId)
      return { id: Number(info.lastInsertRowid), name, parent_id: parentId }
    },

    listCollections(): Collection[] {
      return stmtListCollections.all() as Collection[]
    },

    addTag(name: string): Tag {
      stmtInsertTag.run(name)
      return stmtGetTagByName.get(name) as Tag
    },

    searchBookmarks(opts: { text?: string; tag?: string; collection?: string } = {}): Bookmark[] {
      let sql = 'SELECT DISTINCT b.* FROM bookmarks b'
      const where: string[] = []
      const params: unknown[] = []
      if (opts.tag) {
        sql += ' JOIN bookmark_tags bt ON bt.bookmark_id = b.id JOIN tags t ON t.id = bt.tag_id'
        where.push('t.name = ?')
        params.push(opts.tag)
      }
      if (opts.collection) {
        sql +=
          ' JOIN bookmark_collections bc ON bc.bookmark_id = b.id JOIN collections c ON c.id = bc.collection_id'
        where.push('c.name = ?')
        params.push(opts.collection)
      }
      if (opts.text) {
        where.push('(b.url LIKE ? OR b.title LIKE ? OR b.description LIKE ?)')
        params.push(`%${opts.text}%`, `%${opts.text}%`, `%${opts.text}%`)
      }
      if (where.length) sql += ' WHERE ' + where.join(' AND ')
      sql += ' ORDER BY b.created_at DESC'
      return db.prepare(sql).all(...params) as Bookmark[]
    },
  }
}
