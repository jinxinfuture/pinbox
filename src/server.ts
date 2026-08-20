import express from 'express'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, name: 'pinbox' })
})

const port = Number(process.env.PORT) || 3000
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Pinbox listening on :${port}`)
  })
}

export { app }
