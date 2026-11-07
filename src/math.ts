/**
 * KaTeX 节点定位与 TeX 提取。
 *
 * DSH 用 `katex.renderToString(tex, { displayMode, throwOnError: true })` 渲染公式
 * （见 web 包 `lib/types/markdown/katex.js`），所以每个公式在 DOM 里都是：
 *
 *   <span class="katex">
 *     <span class="katex-mathml">
 *       <math><semantics><mrow>…</mrow>
 *         <annotation encoding="application/x-tex">TeX 源码</annotation>
 *       </semantics></math>
 *     </span>
 *     <span class="katex-html" aria-hidden="true">…</span>
 *   </span>
 *
 * 块级公式外面再套一层 `<span class="katex-display">`。
 * 源码永远在 annotation 里，不需要额外的 `data-math` 属性。
 */

/** 公式最内层的 KaTeX 根节点。 */
export const KATEX_ROOT = '.katex'

/** 块级公式的外层包裹节点。 */
export const KATEX_DISPLAY = '.katex-display'

/** 保存 TeX 源码的 MathML annotation。 */
export const TEX_ANNOTATION = 'annotation[encoding="application/x-tex"]'

/** 节点类型常数，避免依赖全局 `Node`（jsdom 单测里不存在）。 */
const ELEMENT_NODE = 1

/**
 * 取得节点所属元素（文本节点取 parentElement）。
 *
 * @param node - 任意 DOM 节点。
 * @returns 元素；文本节点没有父元素时返回 null。
 */
export function elementOf(node: Node | null | undefined): Element | null {
  if (!node) return null
  if (node.nodeType === ELEMENT_NODE) return node as Element
  return node.parentElement ?? null
}

/**
 * 找到选区端点所在的 KaTeX 公式节点。
 *
 * @param node - 选区端点节点。
 * @returns 最内层 `.katex` 元素；不在公式内或公式渲染失败时返回 null。
 */
export function closestKatex(node: Node | null | undefined): Element | null {
  const element = elementOf(node)
  if (!element || typeof element.closest !== 'function') return null
  const katex = element.closest(KATEX_ROOT)
  if (!katex || katex.classList.contains('katex-error')) return null
  return katex
}

/**
 * 公式是否为块级（KaTeX 会额外包一层 `.katex-display`）。
 *
 * @param node - KaTeX 根节点或其后代。
 * @returns 是否块级。
 */
export function isDisplayMath(node: Element): boolean {
  if (node.classList.contains('katex-display')) return true
  return node.closest(KATEX_DISPLAY) !== null
}

/**
 * 从公式节点里读回 TeX 源码。
 *
 * @param node - KaTeX 根节点（或其祖先）。
 * @returns 去首尾空白的 TeX；缺失时返回空字符串。
 */
export function texSource(node: Element): string {
  const annotation = node.querySelector(TEX_ANNOTATION)
  const tex = annotation?.textContent
  return tex ? tex.trim() : ''
}

/**
 * 按 Gemini 的约定包裹 TeX 源码。
 *
 * @param tex - TeX 源码。
 * @param display - 是否块级。
 * @returns `$…$` 或 `$$…$$`。
 */
export function wrapTex(tex: string, display: boolean): string {
  const fence = display ? '$$' : '$'
  return fence + tex + fence
}
