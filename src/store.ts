import type Database from 'better-sqlite3'
import { normalizeUrl } from './normalize'

export interface Bookmark {
  id: number
  url: string
  title: string
  description: string
  created_at: string
  tags?: string[]
  collections?: string[]
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

export interface UpdateBookmarkInput {
  url?: string
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
  const stmtTagsForBookmark = db.prepare(
    'SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ? ORDER BY t.name',
  )
  const stmtColsForBookmark = db.prepare(
    'SELECT c.name FROM collections c JOIN bookmark_collections bc ON bc.collection_id = c.id WHERE bc.bookmark_id = ? ORDER BY c.name',
  )
  const stmtListTags = db.prepare('SELECT name FROM tags ORDER BY name')
  const stmtUpdateBookmark = db.prepare(
    'UPDATE bookmarks SET url = ?, title = ?, description = ? WHERE id = ?',
  )
  const stmtDeleteBookmarkTags = db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?')
  const stmtDeleteBookmarkCols = db.prepare(
    'DELETE FROM bookmark_collections WHERE bookmark_id = ?',
  )

  function withMeta(b: Bookmark | undefined): Bookmark | undefined {
    if (!b) return b
    return {
      ...b,
      tags: (stmtTagsForBookmark.all(b.id) as { name: string }[]).map((r) => r.name),
      collections: (stmtColsForBookmark.all(b.id) as { name: string }[]).map((r) => r.name),
    }
  }

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
      return withMeta(stmtGetBookmark.get(id) as Bookmark) as Bookmark
    },

    getBookmark(id: number): Bookmark | undefined {
      return withMeta(stmtGetBookmark.get(id) as Bookmark | undefined)
    },

    listBookmarks(): Bookmark[] {
      return (stmtListBookmarks.all() as Bookmark[]).map((b) => withMeta(b) as Bookmark)
    },

    listTags(): string[] {
      return (stmtListTags.all() as { name: string }[]).map((r) => r.name)
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

    updateBookmark(id: number, input: UpdateBookmarkInput): Bookmark | undefined {
      const existing = stmtGetBookmark.get(id) as Bookmark | undefined
      if (!existing) return undefined
      const url = input.url !== undefined ? normalizeUrl(input.url) : existing.url
      const title = input.title !== undefined ? input.title : existing.title
      const description =
        input.description !== undefined ? input.description : existing.description
      stmtUpdateBookmark.run(url, title, description, id)
      if (input.tags !== undefined) {
        stmtDeleteBookmarkTags.run(id)
        for (const t of input.tags) {
          stmtInsertTag.run(t)
          const tag = stmtGetTagByName.get(t) as Tag
          stmtLinkTag.run(id, tag.id)
        }
      }
      if (input.collections !== undefined) {
        stmtDeleteBookmarkCols.run(id)
        for (const c of input.collections) stmtLinkCollection.run(id, c)
      }
      return withMeta(stmtGetBookmark.get(id) as Bookmark) as Bookmark
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
      return (db.prepare(sql).all(...params) as Bookmark[]).map((b) => withMeta(b) as Bookmark)
    },
  }
}
