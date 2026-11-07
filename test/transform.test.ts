import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPayload, collectText, normalizeText } from '../src/transform.ts'
import { docWith, renderTex, wholeRange } from './fixture.ts'

const TEX = 'T(n) = aT\\left(\\frac{n}{b}\\right) + f(n)'

test('行内公式 → $...$', () => {
  const doc = docWith(`<p>主定理的递归式是 ${renderTex(TEX)} ，记作 T。</p>`)
  const payload = buildPayload(wholeRange(doc), doc)
  assert.ok(payload)
  assert.match(payload.text, /\$T\(n\) = aT\\left\(\\frac\{n\}\{b\}\\right\) \+ f\(n\)\$/)
  assert.match(payload.html, /\$T\(n\)/)
  assert.doesNotMatch(payload.html, /class="katex"/)
})

test('块级公式 → $$...$$，独占一行', () => {
  const doc = docWith(`<p>如下：</p>${renderTex(TEX, true)}<p>结束。</p>`)
  const payload = buildPayload(wholeRange(doc), doc)
  assert.ok(payload)
  assert.match(payload.text, /^如下：\n\n\$\$T\(n\)[\s\S]*\$\$\n\n结束。$/)
})

test('单独复制一个块级公式', () => {
  const doc = docWith(renderTex(TEX, true))
  const payload = buildPayload(wholeRange(doc), doc)
  assert.ok(payload)
  assert.equal(payload.text, `$$${TEX}$$`)
})

test('一段里多个公式全部转换', () => {
  const doc = docWith(
    `<p>${renderTex('a \\ge 1')} 与 ${renderTex('b > 1')} 都是参数。</p>`,
  )
  const payload = buildPayload(wholeRange(doc), doc)
  assert.ok(payload)
  assert.match(payload.text, /^\\?\$a \\ge 1\$ 与 \$b > 1\$ 都是参数。$/)
})

test('列表结构保留', () => {
  const doc = docWith(`<ul><li>第一项 ${renderTex('x^2')}</li><li>第二项</li></ul>`)
  const payload = buildPayload(wholeRange(doc), doc)
  assert.ok(payload)
  assert.match(payload.html, /<ul>/)
  assert.match(payload.html, /<li>/)
  assert.match(payload.text, /第一项 \$x\^2\$\n第二项/)
})

test('没有公式时返回 null', () => {
  const doc = docWith('<p>纯文本，没有公式。</p>')
  assert.equal(buildPayload(wholeRange(doc), doc), null)
})

test('annotation 缺失时不做替换', () => {
  const doc = docWith('<p><span class="katex"><span class="katex-html">x</span></span></p>')
  assert.equal(buildPayload(wholeRange(doc), doc), null)
})

test('normalizeText 收敛空白', () => {
  assert.equal(normalizeText('\n\n  文本  \n\n\n\n下一段\n'), '文本\n\n下一段')
  assert.equal(normalizeText('a\u00a0b'), 'a b')
})

test('collectText 给块级元素补换行', () => {
  const doc = docWith('<p>一</p><p>二</p>')
  assert.equal(collectText(doc.querySelector('.markdown') as Element), '一\n\n二')
})
