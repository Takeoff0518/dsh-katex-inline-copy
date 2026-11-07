import assert from 'node:assert/strict'
import test from 'node:test'

import { JSDOM } from 'jsdom'
import { installCopyHandler } from '../src/install.ts'
import { renderTex } from './fixture.ts'

/**
 * 建一个带选区能力的 jsdom 页面。
 *
 * jsdom 没有 DataTransfer/ClipboardEvent，这里用一个只记录 setData 的假对象，
 * 再用 defineProperty 挂到原生 Event 上。
 */
function setup(bodyHtml: string) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="markdown">${bodyHtml}</div></body></html>`,
    { pretendToBeVisual: true },
  )
  const doc = dom.window.document
  const calls: { type: string; value: string }[] = []
  const fakeData = {
    setData(type: string, value: string) {
      calls.push({ type, value })
    },
  }

  installCopyHandler({ doc })

  /** 在元素上派发 copy，返回事件。 */
  const copy = (target: Element) => {
    const event = new dom.window.Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: fakeData })
    target.dispatchEvent(event)
    return event
  }

  /** 选中元素内容。 */
  const select = (element: Element) => {
    const range = doc.createRange()
    range.selectNodeContents(element)
    const selection = dom.window.getSelection() as Selection
    selection.removeAllRanges()
    selection.addRange(range)
  }

  return { dom, doc, calls, copy, select }
}

test('选中含公式的段落，写入 $...$', () => {
  const tex = 'a \\ge 1'
  const { doc, calls, copy, select } = setup(`<p>其中 ${renderTex(tex)} 是参数。</p>`)
  const p = doc.querySelector('p') as Element
  select(p)
  const event = copy(p)

  assert.equal(event.defaultPrevented, true)
  const text = calls.find((call) => call.type === 'text/plain')?.value ?? ''
  const html = calls.find((call) => call.type === 'text/html')?.value ?? ''
  assert.match(text, /\$a \\ge 1\$/)
  assert.match(html, /\$a \\ge 1\$/)
})

test('代码块里的复制不接管', () => {
  const { doc, calls, copy, select } = setup(
    `<pre data-code-block-content="">echo "$T(n)$"</pre>`,
  )
  const pre = doc.querySelector('pre') as Element
  select(pre)
  const event = copy(pre)

  assert.equal(event.defaultPrevented, false)
  assert.equal(calls.length, 0)
})

test('纯文本段落不接管', () => {
  const { doc, calls, copy, select } = setup('<p>没有公式的一段话。</p>')
  const p = doc.querySelector('p') as Element
  select(p)
  const event = copy(p)

  assert.equal(event.defaultPrevented, false)
  assert.equal(calls.length, 0)
})

test('只选公式里的一个字符，也会补成整条公式', () => {
  const { doc, calls, copy } = setup(renderTex('x^2'))
  const katex = doc.querySelector('.katex') as Element

  let textNode: Node | null = null
  const walker = doc.createTreeWalker(katex, 4 /* NodeFilter.SHOW_TEXT */)
  while (walker.nextNode()) {
    const current = walker.currentNode
    if (current.textContent && current.textContent.trim() !== '') {
      textNode = current
      break
    }
  }
  assert.ok(textNode, '公式里应当有文本节点')

  const range = doc.createRange()
  range.setStart(textNode as Node, 0)
  range.setEnd(textNode as Node, 1)
  const selection = (doc.defaultView as unknown as Window).getSelection() as Selection
  selection.removeAllRanges()
  selection.addRange(range)

  const event = copy(katex)
  assert.equal(event.defaultPrevented, true)
  const text = calls.find((call) => call.type === 'text/plain')?.value ?? ''
  assert.equal(text, '$x^2$')
})

test('isEnabled 返回 false 时不接管', () => {
  const dom = new JSDOM(
    `<!doctype html><html><body><div class="markdown"><p>${renderTex('y')}</p></div></body></html>`,
    { pretendToBeVisual: true },
  )
  const doc = dom.window.document
  const calls: string[] = []
  installCopyHandler({ doc, isEnabled: () => false })

  const range = doc.createRange()
  range.selectNodeContents(doc.querySelector('.markdown') as Element)
  const selection = dom.window.getSelection() as Selection
  selection.removeAllRanges()
  selection.addRange(range)

  const event = new dom.window.Event('copy', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { setData: () => calls.push('x') },
  })
  ;(doc.querySelector('.markdown') as Element).dispatchEvent(event)

  assert.equal(event.defaultPrevented, false)
  assert.equal(calls.length, 0)
})
