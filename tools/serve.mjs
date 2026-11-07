/**
 * 本地静态服务器：给 harness 页和将来的调试页用。
 *
 * 只用 127.0.0.1（secure context，剪贴板 API 可用），无缓存，跟随仓库根目录。
 */

import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT ?? 8123)
const host = '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${host}:${port}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname.endsWith('/')) pathname += 'index.html'

  const target = normalize(join(root, pathname))
  if (!target.startsWith(root + sep)) {
    res.writeHead(403).end('forbidden')
    return
  }

  try {
    const stat = statSync(target)
    if (!stat.isFile()) throw new Error('not a file')
  } catch {
    res.writeHead(404).end('not found')
    return
  }

  res.writeHead(200, {
    'content-type': MIME[extname(target)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(target).pipe(res)
}).listen(port, host, () => {
  console.log(`harness: http://${host}:${port}/tools/harness/`)
})
