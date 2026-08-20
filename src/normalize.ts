/**
 * URL 规范化：补全协议、去除空白。
 * 纯函数，便于单元测试（Issue #1 冒烟测试用）。
 */
export function normalizeUrl(input: string): string {
  let u = input.trim()
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u.replace(/\s+/g, '')
}
