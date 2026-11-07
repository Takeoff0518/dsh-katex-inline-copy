/**
 * 在 `copy` 事件里接管含公式的选区。
 *
 * 流程（对应 Gemini web 的 `inline-copy-host`）：
 *   1. 有选区、不在输入框/代码块里；
 *   2. 选区确实碰到 KaTeX 公式；
 *   3. 把选区端点扩到整条公式（只选半个公式也补全）；
 *   4. 克隆 → 公式替换成 `$…$` / `$$…$$`；
 *   5. `preventDefault` 后写 `text/plain` + `text/html`。
 *
 * 写剪贴板优先走同步 `clipboardData.setData`：它在 copy 事件里是权威写入，
 * 不受权限/焦点影响；只有在浏览器没给 clipboardData 时才退回异步 ClipboardItem。
 */

import { KATEX_DISPLAY, KATEX_ROOT, closestKatex, elementOf } from './math.ts'
import { buildPayload, type CopyPayload } from './transform.ts'

/** 输入区域的边界：这些位置里的复制保持原生行为。 */
const EDITABLE_SELECTOR = [
  'input',
  'textarea',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
].join(', ')

/** 代码块：DSH 自带复制按钮，且代码里的 `$` 不应被改写。 */
const CODE_SELECTOR = '[data-code-block-content], [data-code-block-banner], pre'

/** 异步兜底时用的剪贴板类型。 */
const MIME_HTML = 'text/html'
const MIME_TEXT = 'text/plain'

/** 安装选项。 */
export interface InstallOptions {
  /** 目标文档，默认全局 `document`。 */
  doc?: Document
  /** 运行期开关；返回 false 时不接管。 */
  isEnabled?: () => boolean
  /** 调试钩子：每次成功生成载荷后回调。 */
  onCopy?: (payload: CopyPayload) => void
}

/**
 * 判断选区里是否真的含有公式。
 *
 * @param range - 当前选区。
 * @param doc - 文档。
 * @returns 命中任一 `.katex` 时为 true。
 */
function rangeTouchesMath(range: Range, doc: Document): boolean {
  const nodes = doc.querySelectorAll(KATEX_ROOT)
  for (const node of Array.from(nodes)) {
    try {
      if (range.intersectsNode(node)) return true
    } catch {
      // 跨文档等异常直接当作未命中。
    }
  }
  return false
}

/**
 * 把选区两端补到完整公式节点。
 *
 * @param range - 选区（会原地扩展）。
 * @returns 扩展后的选区。
 */
function expandToWholeMath(range: Range): Range {
  const startMath = closestKatex(range.startContainer)
  const endMath = closestKatex(range.endContainer)

  if (startMath) {
    const anchor = startMath.closest(KATEX_DISPLAY) ?? startMath
    try {
      range.setStartBefore(anchor)
    } catch {
      /* 边界已在外侧时忽略 */
    }
  }
  if (endMath) {
    const anchor = endMath.closest(KATEX_DISPLAY) ?? endMath
    try {
      range.setEndAfter(anchor)
    } catch {
      /* 同上 */
    }
  }
  return range
}

/**
 * 异步兜底：clipboardData 不可用时用 Clipboard API 写。
 *
 * @param payload - 已生成的两种口味。
 */
async function writeViaClipboardApi(payload: CopyPayload): Promise<void> {
  const clipboard = navigator.clipboard
  if (!clipboard || typeof clipboard.write !== 'function' || typeof ClipboardItem === 'undefined') return
  await clipboard.write([
    new ClipboardItem({
      [MIME_HTML]: new Blob([payload.html], { type: MIME_HTML }),
      [MIME_TEXT]: new Blob([payload.text], { type: MIME_TEXT }),
    }),
  ])
}

/**
 * 安装复制监听。
 *
 * @param options - 文档、开关、调试钩子。
 * @returns 卸载函数。
 */
export function installCopyHandler(options: InstallOptions = {}): () => void {
  const doc = options.doc ?? document
  const isEnabled = options.isEnabled ?? (() => true)

  const handler = (event: Event): void => {
    try {
      if (!isEnabled()) return

      const selection = doc.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

      const range = selection.getRangeAt(0)
      const startElement = elementOf(range.startContainer)
      const endElement = elementOf(range.endContainer)
      if (!startElement || !endElement) return
      if (startElement.closest(EDITABLE_SELECTOR) || endElement.closest(EDITABLE_SELECTOR)) return
      if (startElement.closest(CODE_SELECTOR) || endElement.closest(CODE_SELECTOR)) return
      if (!rangeTouchesMath(range, doc)) return

      const expanded = expandToWholeMath(range.cloneRange())
      const payload = buildPayload(expanded, doc)
      if (!payload) return

      const clipboardEvent = event as ClipboardEvent
      clipboardEvent.preventDefault()

      if (clipboardEvent.clipboardData) {
        clipboardEvent.clipboardData.setData(MIME_TEXT, payload.text)
        clipboardEvent.clipboardData.setData(MIME_HTML, payload.html)
      } else {
        void writeViaClipboardApi(payload).catch((error: unknown) => {
          console.warn('[dsh-katex-inline-copy] clipboard write failed', error)
        })
      }

      options.onCopy?.(payload)
    } catch (error) {
      // 任何意外都不能影响用户正常复制：不 preventDefault，交回原生行为。
      console.warn('[dsh-katex-inline-copy] copy interception failed', error)
    }
  }

  doc.addEventListener('copy', handler, true)
  return () => doc.removeEventListener('copy', handler, true)
}
