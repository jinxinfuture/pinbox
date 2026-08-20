import { describe, it, expect } from 'vitest'
import { normalizeUrl } from './normalize'

describe('normalizeUrl', () => {
  it('缺少协议时补全 https', () => {
    expect(normalizeUrl('example.com').startsWith('https://')).toBe(true)
  })
  it('保留已有协议', () => {
    expect(normalizeUrl('http://a.com')).toBe('http://a.com')
  })
  it('去除首尾空白与内部空格', () => {
    expect(normalizeUrl('  https://a.com/foo bar ')).toBe('https://a.com/foobar')
  })
})
