import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from './db'
import { createStore } from './store'

let store = createStore(openDb(':memory:'))

beforeEach(() => {
  store = createStore(openDb(':memory:'))
})

describe('bookmarks', () => {
  it('add + list', () => {
    const b = store.addBookmark({ url: 'example.com/a', title: 'A' })
    expect(b.id).toBeGreaterThan(0)
    expect(b.url).toBe('https://example.com/a')
    expect(store.listBookmarks()).toHaveLength(1)
  })

  it('get + delete', () => {
    const b = store.addBookmark({ url: 'http://x.com' })
    expect(store.getBookmark(b.id)?.url).toBe('http://x.com')
    expect(store.deleteBookmark(b.id)).toBe(true)
    expect(store.getBookmark(b.id)).toBeUndefined()
  })
})

describe('collections', () => {
  it('支持嵌套', () => {
    const parent = store.createCollection('Tech')
    const child = store.createCollection('AI', parent.id)
    expect(child.parent_id).toBe(parent.id)
    expect(store.listCollections()).toHaveLength(2)
  })
})

describe('tags', () => {
  it('关联到书签并可按标签搜索', () => {
    store.addBookmark({ url: 'y.com', tags: ['read', 'later'] })
    expect(store.searchBookmarks({ tag: 'read' })).toHaveLength(1)
    expect(store.searchBookmarks({ tag: 'later' })).toHaveLength(1)
  })

  it('listTags 返回所有已用标签', () => {
    store.addBookmark({ url: 'a.com', tags: ['x', 'y'] })
    store.addBookmark({ url: 'b.com', tags: ['y', 'z'] })
    expect(store.listTags().sort()).toEqual(['x', 'y', 'z'])
  })
})

describe('metadata 随书签返回', () => {
  it('listBookmarks 带 tags 与 collections', () => {
    const c = store.createCollection('Fav')
    const b = store.addBookmark({ url: 'm.com', tags: ['go'], collections: [c.id] })
    const list = store.listBookmarks()
    expect(list).toHaveLength(1)
    expect(list[0].tags).toEqual(['go'])
    expect(list[0].collections).toEqual(['Fav'])
    expect(b.tags).toEqual(['go'])
    expect(b.collections).toEqual(['Fav'])
  })

  it('getBookmark 带 tags 与 collections', () => {
    store.addBookmark({ url: 'n.com', tags: ['t1'] })
    const got = store.getBookmark(1)
    expect(got?.tags).toEqual(['t1'])
    expect(got?.collections).toEqual([])
  })

  it('searchBookmarks 返回结果带 tags', () => {
    store.addBookmark({ url: 's.com', title: 'S', tags: ['hot'] })
    const r = store.searchBookmarks({ text: 'S' })
    expect(r).toHaveLength(1)
    expect(r[0].tags).toEqual(['hot'])
  })
})

describe('search', () => {
  it('按文本搜索', () => {
    store.addBookmark({ url: 'news.com', title: 'Breaking News' })
    store.addBookmark({ url: 'blog.com', title: 'Cooking' })
    expect(store.searchBookmarks({ text: 'news' })).toHaveLength(1)
  })

  it('按集合搜索', () => {
    const c = store.createCollection('Fav')
    store.addBookmark({ url: 'a.com', collections: [c.id] })
    store.addBookmark({ url: 'b.com' })
    expect(store.searchBookmarks({ collection: 'Fav' })).toHaveLength(1)
  })
})

describe('updateBookmark', () => {
  it('更新字段', () => {
    const b = store.addBookmark({ url: 'old.com', title: 'Old', description: 'd' })
    const u = store.updateBookmark(b.id, { title: 'New', description: 'updated' })
    expect(u?.title).toBe('New')
    expect(u?.description).toBe('updated')
    expect(u?.url).toBe('https://old.com')
    expect(store.getBookmark(b.id)?.title).toBe('New')
  })

  it('重写标签（旧标签移除、新标签生效）', () => {
    const b = store.addBookmark({ url: 't.com', tags: ['a', 'b'] })
    const u = store.updateBookmark(b.id, { tags: ['b', 'c'] })
    expect(u?.tags?.sort()).toEqual(['b', 'c'])
    expect(store.searchBookmarks({ tag: 'a' })).toHaveLength(0)
    expect(store.searchBookmarks({ tag: 'c' })).toHaveLength(1)
  })

  it('重写集合关联', () => {
    const c1 = store.createCollection('C1')
    const c2 = store.createCollection('C2')
    const b = store.addBookmark({ url: 'u.com', collections: [c1.id] })
    const u = store.updateBookmark(b.id, { collections: [c2.id] })
    expect(u?.collections).toEqual(['C2'])
    expect(store.searchBookmarks({ collection: 'C1' })).toHaveLength(0)
    expect(store.searchBookmarks({ collection: 'C2' })).toHaveLength(1)
  })

  it('不存在的 id 返回 undefined', () => {
    expect(store.updateBookmark(999, { title: 'x' })).toBeUndefined()
  })
})

describe('export/import', () => {
  it('导出包含书签/集合/标签', () => {
    const c = store.createCollection('阅读')
    const b = store.addBookmark({
      url: 'https://e.com',
      title: '导出测试',
      tags: ['go', 'demo'],
      collections: [c.id],
    })
    const data = store.exportData()
    expect(data.version).toBe(1)
    expect(data.tags).toEqual(expect.arrayContaining(['go', 'demo']))
    expect(data.collections.map((x) => x.name)).toContain('阅读')
    const exported = data.bookmarks.find((x) => x.id === b.id)
    expect(exported).toBeDefined()
    expect(exported!.tags).toEqual(expect.arrayContaining(['go', 'demo']))
    expect(exported!.collections).toContain('阅读')
  })

  it('导入到空库重建数据', () => {
    const store2 = createStore(openDb(':memory:'))
    const result = store2.importData({
      version: 1,
      tags: ['go'],
      collections: [{ id: 1, name: '阅读', parent_id: null }],
      bookmarks: [
        {
          url: 'https://imp.com',
          title: '导入的',
          tags: ['go'],
          collections: ['阅读'],
        },
      ],
    })
    expect(result.imported).toBe(1)
    const list = store2.listBookmarks()
    expect(list).toHaveLength(1)
    expect(list[0].tags).toContain('go')
    expect(list[0].collections).toContain('阅读')
  })

  it('导入重复 URL 自动跳过', () => {
    store.addBookmark({ url: 'https://dup.com' })
    const before = store.listBookmarks().length
    const result = store.importData({
      bookmarks: [{ url: 'https://dup.com' }, { url: 'https://new.com' }],
    })
    expect(result.imported).toBe(1)
    expect(store.listBookmarks()).toHaveLength(before + 1)
  })

  it('导出→导入往返后数据一致', () => {
    const data = store.exportData()
    const store3 = createStore(openDb(':memory:'))
    const result = store3.importData(data)
    expect(result.imported).toBe(store.listBookmarks().length)
    expect(store3.listBookmarks().length).toBe(store.listBookmarks().length)
  })
})
