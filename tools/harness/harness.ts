/**
 * 本地调试页：用与 DSH 完全相同的管线渲染公式，再挂上真实的复制处理器。
 *
 * DSH 的渲染路径是 `katex.renderToString()` → `DOMParser` → DOM，
 * 这里照抄，保证 `.katex` / `.katex-display` / `annotation` 结构与线上一致。
 */

import katex from 'katex'
import { installCopyHandler } from '../../src/install.ts'

/** 把一段 TeX 渲染成与 DSH 同构的 DOM 节点。 */
function renderTex(tex: string, display: boolean): Node[] {
  const html = katex.renderToString(tex, { displayMode: display, throwOnError: true })
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(parsed.body.childNodes, (node) => document.importNode(node, true))
}

/** 建一个段落。 */
function paragraph(...parts: (string | Node)[]): HTMLParagraphElement {
  const p = document.createElement('p')
  for (const part of parts) p.append(part)
  return p
}

/** 建一个行内公式节点。 */
function inline(tex: string): Node[] {
  return renderTex(tex, false)
}

/** 建一个块级公式节点。 */
function block(tex: string): Node[] {
  return renderTex(tex, true)
}

const ROOT = document.getElementById('root')
const LOG = document.getElementById('log')

const fixture: (Node | string)[] = [
  paragraph(
    '主定理（Master Theorem）用于分析分治算法的时间复杂度。它的递归式是 ',
    ...inline('T(n) = aT\\left(\\frac{n}{b}\\right) + f(n)'),
    '，其中 ',
    ...inline('a \\ge 1'),
    ' 是子问题数量。',
  ),
  paragraph(...block('T(n) = aT\\left(\\frac{n}{b}\\right) + f(n)')),
  paragraph('比较 ', ...inline('f(n)'), ' 与 ', ...inline('n^{\\log_b a}'), ' 的渐进大小。'),
  (() => {
    const ul = document.createElement('ul')
    const li = document.createElement('li')
    li.append('当 ', ...inline('f(n) = O(n^{\\log_b a - \\epsilon})'), ' 时，', ...inline('T(n) = \\Theta(n^{\\log_b a})'))
    ul.append(li)
    return ul
  })(),
  (() => {
    const pre = document.createElement('pre')
    pre.setAttribute('data-code-block-content', '')
    pre.textContent = 'echo "$T(n)$" # 代码块里的 $ 不应被改写'
    return pre
  })(),
]

for (const node of fixture) {
  if (typeof node === 'string') ROOT?.append(node)
  else ROOT?.append(node)
}

/** 把最近一次载荷打到页面上，方便肉眼/截图核对。 */
function show(payload: { html: string; text: string }): void {
  if (!LOG) return
  LOG.textContent = `text/plain:\n${payload.text}\n\n---\n\ntext/html:\n${payload.html}`
  ;(window as unknown as Record<string, unknown>).__lastPayload = payload
}

installCopyHandler({ onCopy: show })

const status = document.getElementById('status')
if (status) status.textContent = 'copy handler installed'
