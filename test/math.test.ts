import assert from 'node:assert/strict'
import test from 'node:test'

import { closestKatex, isDisplayMath, texSource, wrapTex } from '../src/math.ts'
import { docWith, renderTex } from './fixture.ts'

const TEX = 'T(n) = aT\\left(\\frac{n}{b}\\right) + f(n)'

test('closestKatex 命中行内公式', () => {
  const doc = docWith(`<p>前 ${renderTex('a \\ge 1')} 后</p>`)
  const katex = doc.querySelector('.katex') as Element
  const text = katex.querySelector('.katex-html')?.firstChild ?? katex
  assert.equal(closestKatex(text), katex)
})

test('closestKatex 在公式外返回 null', () => {
  const doc = docWith('<p>纯文本</p>')
  assert.equal(closestKatex(doc.querySelector('p')), null)
})

test('texSource 读回 annotation', () => {
  const doc = docWith(renderTex('\\Theta'))
  const tex = texSource(doc.querySelector('.katex') as Element)
  assert.equal(tex, '\\Theta')
})

test('块级公式被识别为 display', () => {
  const doc = docWith(renderTex(TEX, true))
  const katex = doc.querySelector('.katex') as Element
  assert.equal(isDisplayMath(katex), true)
  assert.ok(doc.querySelector('.katex-display'))
})

test('行内公式不是 display', () => {
  const doc = docWith(`<p>${renderTex('x')}</p>`)
  const katex = doc.querySelector('.katex') as Element
  assert.equal(isDisplayMath(katex), false)
})

test('wrapTex 按块级/行内加围栏', () => {
  assert.equal(wrapTex('x', false), '$x$')
  assert.equal(wrapTex('x', true), '$$x$$')
})

test('katex-error 不被当作公式', () => {
  const doc = docWith('<span class="katex-error" title="bad">\\oops</span>')
  assert.equal(closestKatex(doc.querySelector('.katex-error')), null)
})
