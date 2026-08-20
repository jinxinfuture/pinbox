import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { openDb } from './db'
import { createStore } from './store'
import { parseBookmarksHtml } from './parseBookmarksHtml'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())
app.use(express.static(join(__dirname, '..', 'public')))

app.get('/health', (_req, res) => {
  res.json({ ok: true, name: 'pinbox' })
})

const db = openDb(process.env.PINBOX_DB || 'pinbox.db')
const store = createStore(db)

app.post('/api/bookmarks', (req, res) => {
  const b = store.addBookmark(req.body)
  res.status(201).json(b)
})
app.get('/api/bookmarks', (_req, res) => {
  res.json(store.listBookmarks())
})
app.get('/api/bookmarks/:id', (req, res) => {
  const b = store.getBookmark(Number(req.params.id))
  if (!b) return res.status(404).json({ error: 'not found' })
  res.json(b)
})
app.delete('/api/bookmarks/:id', (req, res) => {
  const ok = store.deleteBookmark(Number(req.params.id))
  res.status(ok ? 204 : 404).end()
})
app.put('/api/bookmarks/:id', (req, res) => {
  const b = store.updateBookmark(Number(req.params.id), req.body)
  if (!b) return res.status(404).json({ error: 'not found' })
  res.json(b)
})

app.post('/api/collections', (req, res) => {
  const c = store.createCollection(req.body.name, req.body.parent_id ?? null)
  res.status(201).json(c)
})
app.get('/api/collections', (_req, res) => {
  res.json(store.listCollections())
})

app.get('/api/tags', (_req, res) => {
  res.json(store.listTags())
})

app.post('/api/tags', (req, res) => {
  const t = store.addTag(req.body.name)
  res.status(201).json(t)
})

app.get('/api/search', (req, res) => {
  res.json(
    store.searchBookmarks({
      text: req.query.text as string,
      tag: req.query.tag as string,
      collection: req.query.collection as string,
    }),
  )
})

app.get('/api/export', (_req, res) => {
  res.json(store.exportData())
})

app.post('/api/import', (req, res) => {
  try {
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'invalid payload' })
    }
    const result = store.importData(data)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'import failed' })
  }
})

app.post('/api/import/html', (req, res) => {
  const html = req.body?.html
  if (typeof html !== 'string' || !html.trim()) {
    return res.status(400).json({ error: 'html required' })
  }
  try {
    const { data, parsedBookmarks } = parseBookmarksHtml(html)
    const result = store.importData(data)
    res.json({ imported: result.imported, skipped: parsedBookmarks - result.imported })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'import failed' })
  }
})

const port = Number(process.env.PORT) || 3000
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Pinbox listening on :${port}`)
  })
}

export { app }
