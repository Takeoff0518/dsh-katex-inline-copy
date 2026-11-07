/**
 * Host 半边：本插件全部逻辑都在浏览器里。
 *
 * Host 只需要一个能干净挂载的插件，让 Loader 条目存在、并让 `dsh.client`
 * 声明被扫描到（客户端由 Web 端加载 `lib/client.js`）。
 *
 * @module dsh-katex-inline-copy
 */

/** Loader/插件标识。 */
export const name = 'dsh-katex-inline-copy'

/** 不注入任何 Host 服务。 */
export const inject = []

/**
 * 挂载一个惰性 Host 插件。
 *
 * @returns 无。
 */
export function apply() {}
