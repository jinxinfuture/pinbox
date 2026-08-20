import { describe, it, expect } from 'vitest'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { createApp } from './server'

function listen(app: ReturnType<typeof createApp>): Promise<{ srv: Server; port: number }> {
  return new Promise((resolve) => {
    const srv = app.listen(0, () => {
      resolve({ srv, port: (srv.address() as AddressInfo).port })
    })
  })
}

describe('auth', () => {
  it('未配置 token 时 API 完全放行', async () => {
    const { srv, port } = await listen(createApp({ token: undefined, dbPath: ':memory:' }))
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/bookmarks`)
      expect(res.status).toBe(200)
    } finally {
      srv.close()
    }
  })

  it('配置后无 token 请求 401', async () => {
    const { srv, port } = await listen(createApp({ token: 'secret123', dbPath: ':memory:' }))
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/bookmarks`)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    } finally {
      srv.close()
    }
  })

  it('错误 token 401', async () => {
    const { srv, port } = await listen(createApp({ token: 'secret123', dbPath: ':memory:' }))
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/bookmarks`, {
        headers: { Authorization: 'Bearer wrong' },
      })
      expect(res.status).toBe(401)
    } finally {
      srv.close()
    }
  })

  it('正确 Bearer token 200', async () => {
    const { srv, port } = await listen(createApp({ token: 'secret123', dbPath: ':memory:' }))
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/bookmarks`, {
        headers: { Authorization: 'Bearer secret123' },
      })
      expect(res.status).toBe(200)
    } finally {
      srv.close()
    }
  })

  it('X-Pinbox-Token 头同样有效', async () => {
    const { srv, port } = await listen(createApp({ token: 'secret123', dbPath: ':memory:' }))
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/tags`, {
        headers: { 'X-Pinbox-Token': 'secret123' },
      })
      expect(res.status).toBe(200)
    } finally {
      srv.close()
    }
  })

  it('/health 不鉴权', async () => {
    const { srv, port } = await listen(createApp({ token: 'secret123', dbPath: ':memory:' }))
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      expect(res.status).toBe(200)
    } finally {
      srv.close()
    }
  })
})
