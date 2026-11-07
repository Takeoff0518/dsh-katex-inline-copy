/**
 * 选区 → 剪贴板载荷。
 *
 * 与 Gemini `inline-copy-host` 同一思路：克隆选区，把每个公式节点替换成
 * `$…$` / `$$…$$` 纯文本，再序列化成 `text/html` + `text/plain`。
 * 全程改的是克隆体，原始消息 DOM 一个字节都不动。
 */

import {
  KATEX_DISPLAY,
  KATEX_ROOT,
  isDisplayMath,
  texSource,
  wrapTex,
} from './math.ts'

/** 一次复制最终要写进剪贴板的两种口味。 */
export interface CopyPayload {
  /** `text/html`：保留段落/列表结构，公式位置是可识别的 `$…$` 文本。 */
  html: string
  /** `text/plain`：公式为 `$…$` / `$$…$$`，可直接粘进 Markdown。 */
  text: string
}

const ELEMENT_NODE = 1
const TEXT_NODE = 3

/** 段落级标签：纯文本里空一行。 */
const PARAGRAPH_TAGS = new Set([
  'P',
  'DIV',
  'UL',
  'OL',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'PRE',
  'BLOCKQUOTE',
  'TABLE',
  'SECTION',
  'ARTICLE',
  'FIGCAPTION',
])

/** 行级标签：纯文本里只换一行。 */
const LINE_TAGS = new Set(['LI', 'TR'])

/**
 * 列出片段里最外层的公式节点（块级取 `.katex-display`，行内取 `.katex`）。
 *
 * @param root - 克隆出来的容器。
 * @returns 由外到内的 outermost 公式节点。
 */
export function outermostMathNodes(root: ParentNode): Element[] {
  const all = Array.from(root.querySelectorAll(`${KATEX_DISPLAY}, ${KATEX_ROOT}`))
  return all.filter((element) => {
    const parent = element.parentElement
    return !parent || parent.closest(`${KATEX_DISPLAY}, ${KATEX_ROOT}`) === null
  })
}

/**
 * 把容器内的纯文本拼出来，块级元素之间补换行。
 *
 * @param root - 已替换过公式的容器。
 * @returns 规整后的文本。
 */
export function collectText(root: Node): string {
  let out = ''

  /** 保证尾部至少有 count 个换行。 */
  const breakLines = (count: number): void => {
    const existing = /\n*$/.exec(out)?.[0].length ?? 0
    if (existing < count) out += '\n'.repeat(count - existing)
  }

  const walk = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      out += (node as Text).data
      return
    }
    if (node.nodeType !== ELEMENT_NODE) return

    const element = node as Element
    const tag = element.tagName

    if (tag === 'BR') {
      out += '\n'
      return
    }

    const paragraph = PARAGRAPH_TAGS.has(tag)
    const line = LINE_TAGS.has(tag)
    if (paragraph) breakLines(2)
    else if (line) breakLines(1)

    for (const child of Array.from(element.childNodes)) walk(child)

    if (paragraph) breakLines(2)
    else if (line) breakLines(1)
  }

  walk(root)
  return normalizeText(out)
}

/**
 * 收敛空白：NBSP → 空格、行尾空格、连续空行。
 *
 * @param text - 原始文本。
 * @returns 规整后的文本。
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 克隆选区并把公式替换成 LaTeX 源码。
 *
 * @param range - 已扩展到完整公式的选区。
 * @param doc - 用来创建节点的文档（测试时可注入 jsdom）。
 * @returns 载荷；选区里没有可转换的公式时返回 null。
 */
export function buildPayload(range: Range, doc: Document): CopyPayload | null {
  const fragment = range.cloneContents()
  const holder = doc.createElement('div')
  holder.appendChild(fragment)

  let converted = 0
  for (const element of outermostMathNodes(holder)) {
    const tex = texSource(element)
    if (!tex) continue
    const display = isDisplayMath(element)
    const value = wrapTex(tex, display)
    element.replaceWith(doc.createTextNode(display ? `\n${value}\n` : value))
    converted += 1
  }

  if (converted === 0) return null
  return { html: holder.innerHTML, text: collectText(holder) }
}
