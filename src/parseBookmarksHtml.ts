import type { ImportBookmark, ImportCollection, ImportData } from './store'

/**
 * 解析浏览器导出的书签 HTML（Chrome / Firefox / Edge 的 bookmarks.html，
 * NETSCAPE-Bookmark-file-1 格式），输出与 store.importData() 兼容的 ImportData。
 *
 * 结构约定：
 *   <DT><H3 ...>文件夹名</H3>
 *   <DL><p>            ← 文件夹的子内容（含该文件夹全部子条目）
 *     <DT><A HREF="...">标题</A>
 *     <DT><H3 ...>子文件夹</H3>
 *     <DL><p>...</DL><p>
 *   </DL><p>
 *
 * 解析策略：
 *   1. splitTopLevelEntries 按"深度 0 的 <DT>"切分条目（<DL>/</DL> 只更新深度，
 *      嵌套 <DT> 保留在条目内容里）；
 *   2. 文件夹条目：提取 H3 名，再用 extractMatchingDl 深度匹配其嵌套 <DL> 块，递归解析；
 *   3. 书签条目：匹配 <A HREF>。
 */

interface ParsedNode {
  kind: 'folder' | 'bookmark'
  name: string
  url?: string
  children: ParsedNode[]
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/** 从内容中提取第一个 <DL> 块（深度匹配到其闭合 </DL>）的内部文本，无则返回 null。 */
function extractMatchingDl(content: string): string | null {
  const dlOpen = content.match(/<dl[^>]*>/i)
  if (!dlOpen || dlOpen.index === undefined) return null
  const start = dlOpen.index + dlOpen[0].length
  let depth = 1
  const re = /<(\/?)(dl)\b[^>]*>/gi
  re.lastIndex = start
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m[1]) {
      depth--
      if (depth === 0) return content.slice(start, m.index)
    } else {
      depth++
    }
  }
  return null
}

/** 按深度 0 的 <DT> 切分 DL 块内容为条目；<DL>/</DL> 仅用于深度跟踪，嵌套 <DT> 保留。 */
function splitTopLevelEntries(block: string): string[] {
  const entries: string[] = []
  let depth = 0
  let current = ''
  let last = 0
  const re = /<(\/?)(dt|dl)\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    current += block.slice(last, m.index)
    last = re.lastIndex
    const [, closing, tag] = m
    if (tag.toLowerCase() === 'dl') {
      if (closing) depth = Math.max(0, depth - 1)
      else depth++
      current += m[0] // 保留 <dl>/</dl>，供 extractMatchingDl 深度匹配
    } else if (depth === 0) {
      if (current.trim()) entries.push(current)
      current = ''
    } else {
      current += m[0] // 嵌套 <DT> 保留，递归时重新切分
    }
  }
  current += block.slice(last)
  if (current.trim()) entries.push(current)
  return entries
}

/** 解析一个 <DL> 块的内容，返回其下的条目列表。 */
function parseDlBlock(block: string): ParsedNode[] {
  const nodes: ParsedNode[] = []
  for (const entry of splitTopLevelEntries(block)) {
    const h3 = entry.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)
    if (h3) {
      const child = extractMatchingDl(entry)
      nodes.push({
        kind: 'folder',
        name: stripTags(h3[1]),
        children: child ? parseDlBlock(child) : [],
      })
      continue
    }
    const a = entry.match(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
    if (a) {
      nodes.push({ kind: 'bookmark', name: stripTags(a[2]), url: a[1], children: [] })
    }
  }
  return nodes
}

/** 把解析树扁平化为 ImportData（集合带父子关系，书签挂所属文件夹名）。 */
function flatten(
  nodes: ParsedNode[],
  parentId: number | null,
  parentName: string | null,
  out: { collections: ImportCollection[]; bookmarks: ImportBookmark[] },
): void {
  let nextId = out.collections.length + 1
  for (const n of nodes) {
    if (n.kind === 'folder') {
      const id = nextId++
      out.collections.push({ id, name: n.name, parent_id: parentId })
      flatten(n.children, id, n.name, out)
    } else if (n.url) {
      out.bookmarks.push({
        url: n.url,
        title: n.name,
        collections: parentName ? [parentName] : undefined,
      })
    }
  }
}

export interface ParseResult {
  data: ImportData
  parsedBookmarks: number
}

export function parseBookmarksHtml(html: string): ParseResult {
  const root = extractMatchingDl(html)
  const nodes = root ? parseDlBlock(root) : []
  const out: { collections: ImportCollection[]; bookmarks: ImportBookmark[] } = {
    collections: [],
    bookmarks: [],
  }
  flatten(nodes, null, null, out)
  const bookmarks = out.bookmarks.map((b) => ({ ...b, collections: b.collections ?? [] }))
  return { data: { version: 1, bookmarks, collections: out.collections }, parsedBookmarks: bookmarks.length }
}
