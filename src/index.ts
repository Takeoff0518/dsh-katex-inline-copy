/**
 * 客户端插件入口（`window.__ModuleLoader__.load` 的 factory 体）。
 *
 * 只做一件事：在文档上挂一个 `copy` 监听。没有 UI、没有 slot、没有 Host 依赖，
 * 因此对 DSH 自身的渲染/流式/折叠行为零侵入。
 */

import { installCopyHandler } from './install.ts'

/** 本地开关（未设置时默认开启；设为 `off` 可关闭）。 */
const ENABLED_KEY = 'dsh-katex-inline-copy.enabled'

/** 防止同一页面重复安装（插件重载/热更时）。 */
const INSTALLED_FLAG = '__dshKatexInlineCopyInstalled'

/**
 * 读取开关。
 *
 * @returns 是否启用。
 */
export function isEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * 插件挂载点，由 DSH 客户端 loader 调用。
 *
 * @returns 无。
 */
export function apply(): void {
  const scope = window as unknown as Record<string, unknown>
  if (scope[INSTALLED_FLAG]) return
  scope[INSTALLED_FLAG] = true

  installCopyHandler({ isEnabled })
  console.info('[dsh-katex-inline-copy] installed')
}

/** 不需要注入任何客户端服务。 */
export const inject: string[] = []
