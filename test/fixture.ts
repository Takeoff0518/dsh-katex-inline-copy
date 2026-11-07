/**
 * 测试夹具：用真实 KaTeX 生成与 DSH 同构的 DOM。
 */

import katex from 'katex'
import { JSDOM } from 'jsdom'

/**
 * 渲染一段 TeX。
 *
 * @param tex - TeX 源码。
 * @param display - 是否块级。
 * @returns KaTeX 的 HTML 字符串。
 */
export function renderTex(tex: string, display = false): string {
  return katex.renderToString(tex, { displayMode: display, throwOnError: true })
}

/**
 * 建一个带 `.markdown` 容器的文档。
 *
 * @param bodyHtml - 容器内的 HTML。
 * @returns jsdom 文档。
 */
export function docWith(bodyHtml: string): Document {
  const dom = new JSDOM(`<!doctype html><html><body><div class="markdown">${bodyHtml}</div></body></html>`)
  return dom.window.document
}

/**
 * 选中整个容器并返回 Range。
 *
 * @param doc - 文档。
 * @returns 覆盖 `.markdown` 内容的 Range。
 */
export function wholeRange(doc: Document): Range {
  const range = doc.createRange()
  range.selectNodeContents(doc.querySelector('.markdown') as Element)
  return range
}
