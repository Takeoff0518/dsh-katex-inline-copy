/**
 * 构建脚本。
 *
 *   1. `src/index.ts`  → `lib/client.js`（包进 DSH 的 `__ModuleLoader__` 外壳）
 *   2. `tools/harness/harness.ts` → `tools/harness/harness.js`（含 KaTeX，供本地页调试）
 */

import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

/**
 * 用 esbuild 打一份 IIFE，并返回代码字符串。
 *
 * @param {string} entry - 入口文件绝对路径。
 * @param {string} globalName - IIFE 暴露的全局名。
 * @returns {Promise<string>}
 */
async function bundleIife(entry, globalName) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    globalName,
    target: 'es2020',
    platform: 'browser',
    write: false,
    legalComments: 'none',
    logLevel: 'warning',
  })
  return result.outputFiles[0].text
}

/** 逐行缩进，便于嵌进 factory。 */
function indent(text, spaces = 6) {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n')
}

const body = await bundleIife(join(root, 'src', 'index.ts'), '__dshKatexInlineCopy')

const banner = [
  '/*',
  ` * dsh-katex-inline-copy v${pkg.version}`,
  ' * 选中含公式的内容复制时，把 KaTeX 渲染结果替换成 $...$ / $$...$$。',
  ' * 自动生成，请改 src/ 后运行 `npm run build`。',
  ' */',
].join('\n')

const client = `${banner}
window.__ModuleLoader__.load({
  id: "dsh-katex-inline-copy",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${indent(body)}
    return __dshKatexInlineCopy;
  },
});
`

await mkdir(join(root, 'lib'), { recursive: true })
await writeFile(join(root, 'lib', 'client.js'), client, 'utf8')

const harness = await bundleIife(join(here, 'harness', 'harness.ts'), '__dshHarness')
await mkdir(join(here, 'harness'), { recursive: true })
await writeFile(join(here, 'harness', 'harness.js'), harness, 'utf8')

console.log(`built lib/client.js (${(client.length / 1024).toFixed(1)} KB)`)
console.log(`built tools/harness/harness.js (${(harness.length / 1024).toFixed(1)} KB)`)
