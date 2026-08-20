import { describe, it, expect } from 'vitest'
import { parseBookmarksHtml } from './parseBookmarksHtml'
import { openDb } from './db'
import { createStore } from './store'

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000001" PERSONAL_TOOLBAR_FOLDER="true">书签栏</H3>
    <DL><p>
        <DT><A HREF="https://www.google.com/" ADD_DATE="1700000002">Google</A>
        <DT><A HREF="https://github.com/" ADD_DATE="1700000003">GitHub</A>
        <DT><H3 ADD_DATE="1700000004">工具</H3>
        <DL><p>
            <DT><A HREF="https://translate.google.com/" ADD_DATE="1700000005">翻译</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://news.ycombinator.com/" ADD_DATE="1700000006">Hacker News</A>
    <DT><A HREF="https://www.google.com/" ADD_DATE="1700000007">Google (重复)</A>
</DL><p>
`

describe('parseBookmarksHtml', () => {
  it('解析文件夹层级与书签', () => {
    const { data, parsedBookmarks } = parseBookmarksHtml(SAMPLE)
    expect(parsedBookmarks).toBe(5)
    const collections = data.collections ?? []
    expect(collections).toHaveLength(2) // 书签栏、工具
    const bar = collections.find((c) => c.name === '书签栏')
    const tools = collections.find((c) => c.name === '工具')
    expect(bar).toBeDefined()
    expect(tools).toBeDefined()
    expect(tools!.parent_id).toBe(bar!.id) // 工具 是 书签栏 的子文件夹
  })

  it('书签归入所属文件夹集合', () => {
    const { data } = parseBookmarksHtml(SAMPLE)
    const bookmarks = data.bookmarks ?? []
    const translate = bookmarks.find((b) => b.url === 'https://translate.google.com/')
    const google = bookmarks.find((b) => b.url === 'https://www.google.com/')
    const hn = bookmarks.find((b) => b.url === 'https://news.ycombinator.com/')
    expect(translate!.collections).toContain('工具')
    expect(google!.collections).toContain('书签栏')
    expect(hn!.collections).toEqual([]) // 根级书签无集合
  })

  it('导入到 store：集合与关联完整', () => {
    const store = createStore(openDb(':memory:'))
    const { data } = parseBookmarksHtml(SAMPLE)
    const result = store.importData(data)
    expect(result.imported).toBe(4) // Google 重复（本次导入内）被去重 → 4
    const list = store.listBookmarks()
    expect(list).toHaveLength(4)
    const tools = store.searchBookmarks({ collection: '工具' })
    expect(tools).toHaveLength(1)
    expect(tools[0].url).toBe('https://translate.google.com/')
  })

  it('空输入返回零', () => {
    const { parsedBookmarks, data } = parseBookmarksHtml('')
    expect(parsedBookmarks).toBe(0)
    expect(data.bookmarks).toEqual([])
  })
})
