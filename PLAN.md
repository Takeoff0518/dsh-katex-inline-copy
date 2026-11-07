# dsh-katex-inline-copy — 实施计划

> 目标：在 DeepSeek Harness 的对话界面里，选中含公式的内容复制时，剪贴板里拿到的是
> `$...$` / `$$...$$` 的 LaTeX 源码，而不是 KaTeX 渲染后的 DOM 碎片。
> 灵感与算法来自 Gemini Web 的 `inline-copy-host` 实现。

---

## 0. 交付物与验收标准

**交付物**

- 一个可安装的 DSH 客户端插件包：`E:\code\dsh-katex-inline-copy`
- 单元测试 + 浏览器 fixture
- `README.md` / `PLAN.md` / git 历史

**验收标准（Definition of Done）**

| # | 场景 | 期望 |
|---|---|---|
| 1 | 复制一段含行内公式的正文 | `text/plain` 中公式为 `$...$`，正文不变 |
| 2 | 复制一个块级公式 | `text/plain` 为 `$$...$$`，独占一行 |
| 3 | 只选中公式中的半个字符 | 扩到整条公式，得到完整 LaTeX |
| 4 | `text/html` | 保留段落/列表结构，公式位置是可识别的轻量标记 |
| 5 | 粘贴到 KaTeX/Markdown 编辑器 | 直接渲染成公式 |
| 6 | `Ctrl+Shift+V` | 得到同样的 LaTeX 源码 |
| 7 | 代码块内复制 | 行为不变（不接管） |
| 8 | 输入框内复制普通文本 | 行为不变 |
| 9 | 插件停用 | 行为完全回到原生 |

---

## 1. 技术路线

| 方案 | 说明 | 结论 |
|---|---|---|
| **A. 客户端插件（采用）** | 通过 `dsh.client` 注入 `lib/client.js`，在渲染进程挂 `copy` 监听，改剪贴板 | ✅ 不动 core、可卸载、可随版本独立发布 |
| B. 改 core 渲染器 | 在 `lib/types/markdown/katex.js` 里加 `data-math` + 复制逻辑，需改 `app.asar` | ❌ 打包产物、升级即失效 |
| C. 系统剪贴板钩子 | 跨进程监听 Ctrl+C，读选区 | ❌ 拿不到 DOM 选区，平台耦合 |

选 A。DSH 已有成熟范式：`dsh-chat-avatar`（纯客户端插件，`lib/client.js` 走
`window.__ModuleLoader__.load({ id, factory })`，可用 `require("react")`），安装方式是
`dsh plugin add <绝对路径>` 或 `plugin_manager`。

---

## 2. 已核实的技术事实

1. **DSH 用 KaTeX 渲染公式**：`lib/types/markdown/katex.js` →
   `katex.renderToString(value, { displayMode, throwOnError: true })`
   → `DOMParser` → React 元素。默认 `output = "htmlAndMathml"`。
2. **因此 DOM 里一定有**：
   ```html
   <span class="katex"><span class="katex-mathml"><math>
     <semantics><mrow>…</mrow>
     <annotation encoding="application/x-tex">T(n)=aT\left(\frac{n}{b}\right)+f(n)</annotation>
   </semantics></math></span><span class="katex-html" aria-hidden="true">…</span></span>
   ```
   块级还会多一层 `<span class="katex-display">`。
3. **消息容器类名**：`.markdown`（CSS Modules 编译，选择器要避开 hash 前缀，
   用 `.katex` 语义选择器即可）。
4. **Gemini 的最终算法**（逆向结论，供本实现对照）：
   - `copy` 监听 → 选区命中 `.math-inline/.math-block` 才接管；
   - 把选区边界扩到完整公式节点；
   - clone 到隐藏 div，把每个公式节点 `textContent` 换成 `$…$`（块级 `$$…$$`）；
   - `new ClipboardItem({ "text/html": blob, "text/plain": blob })` → `navigator.clipboard.write`；
   - 同时保留一个同步 `clipboardData.setData` 兜底。

---

## 3. 仓库结构

```
dsh-katex-inline-copy/
├─ package.json            # name/version/dsh.manifestVersion/client.platform=web
├─ cordis.patch.yml        # bundle loader 条目
├─ lib/
│  ├─ index.js             # Host 半边：空插件（仅为让 loader 条目存在）
│  └─ client.js            # 构建产物：ModuleLoader 包装后的浏览器代码
├─ src/
│  ├─ math.ts              # 选区 ↔ 公式节点、TeX 提取、$ 包裹
│  ├─ transform.ts         # clone → 替换 → 生成 {html, text}
│  ├─ install.ts           # copy 监听、选区扩展、写剪贴板、兜底
│  └─ index.ts             # 入口：读开关、绑定、清理
├─ test/
│  ├─ math.test.ts
│  ├─ transform.test.ts
│  └─ install.test.ts      # jsdom + ClipboardItem stub
├─ tools/
│  ├─ build.mjs            # esbuild → ModuleLoader 包装
│  ├─ harness/index.html   # 与 DSH 同构的 KaTeX fixture，免装插件调试
│  └─ read-clipboard.ps1   # 读 text/html + text/plain 验证用
├─ .github/workflows/ci.yml（可选，仅跑 test + build）
├─ .gitignore
├─ PLAN.md
└─ README.md
```

---

## 4. 分阶段任务

### P0 — 仓库初始化（已完成部分）
- `git init`、`.gitignore`、提交 `PLAN.md`
- 约定：`main` 分支、Conventional Commits、每个阶段一次提交

### P1 — 现场验证（约 1h）
1. 在真实 DSH GUI 里确认三件事：
   - `.katex` / `.katex-display` / `annotation[encoding="application/x-tex"]` 确实存在；
   - 当前复制行为基线（`text/plain` 是乱码还是字形拼接）；
   - `navigator.clipboard.write` 在该 origin 下可用、是否需要用户手势。
2. 手段：临时插件（一个 `console.log` 探针）或 `tools/harness` + 手动粘贴比对；
   剪贴板用 PowerShell `Get-Clipboard` / `HTML Format` 读取。
3. 产出：`docs/baseline.md` 记录基线与结论。

### P2 — 核心实现（约 2h）
- `math.ts`
  - `findMathNode(range)`：`commonAncestorContainer.closest('.katex, .katex-display')`
  - `isDisplay(node)`：`closest('.katex-display')` 或 `math[display="block"]`
  - `texOf(node)`：`annotation[encoding="application/x-tex"].textContent`
  - `wrap(tex, display)`：`$…$` / `$$…$$`
- `transform.ts`
  - `cloneSelection(range)` → 隐藏 `div`
  - 遍历所有 `.katex`，替换为对应文本节点；`katex-error` 原样保留
  - 归一化块级公式独占行（前后补换行）
  - 输出 `{ html, text }`
- `install.ts`
  - `document.addEventListener('copy', handler, true)`（capture 优先）
  - 命中判断 → `preventDefault` → 尝试 `navigator.clipboard.write`
  - 失败兜底：`event.clipboardData.setData('text/plain' | 'text/html', …)`
  - 只处理消息区（`.markdown`），排除 `[data-code-block-content]`、输入框、contenteditable

### P3 — 测试（约 1.5h）
- 单测（vitest + jsdom）：构造与 DSH 同构的 KaTeX 片段
  - 行内/块级识别、TeX 提取、空 annotation、多公式、部分选区、跨段落、代码块排除
- `tools/harness/index.html`：真实 KaTeX 渲染 + 加载同一份 `client.js`，
  手动验证复制 → 粘贴到 Typora/网页编辑器

### P4 — 打包与安装（约 1h）
- `tools/build.mjs`：esbuild 打包 `src/index.ts` → 包进
  `window.__ModuleLoader__.load({ id: "dsh-katex-inline-copy", factory })`
- `package.json` 补 `dsh` 字段（照抄 chat-avatar 结构）
- `dsh plugin add E:\code\dsh-katex-inline-copy` → 重启/刷新 GUI
- 真机验证 4 条验收标准 + 卸载干净

### P5 — 打磨（约 1h）
- 表格内公式、列表内公式、嵌套 blockquote
- 复制写入带 HTML 注释的标记？（保持轻量，不加）
- 与 DSH 自带「代码块复制按钮」共存验证
- 失败路径：无 focus、Safari/WebView 兼容、ClipboardItem 不可用

### P6 — 文档与可选设置（约 1h）
- README：安装、使用、原理、兼容性
- 可选：设置页开关（localStorage），默认开启

**总计约 6–7 小时**，每阶段一次 commit，P4 结束即为可用版本。

---

## 5. 边界情况清单

| 情况 | 处理 |
|---|---|
| 选区完全在公式内 | 扩到整条公式 |
| 选区部分覆盖公式 | 同上（Gemini 同策略） |
| 跨多个公式/段落 | 逐个替换，正文保留 |
| 块级公式 | `$$…$$` 且前后保证换行 |
| `katex-error`（源码解析失败） | 跳过，保持原样 |
| 代码块 | 整体不接管 |
| 输入框 / contenteditable | 不接管 |
| annotation 缺失 | 退回原始 clone（不吞内容） |
| 无 `navigator.clipboard.write` | 同步 `setData` 兜底 |
| 流式输出中复制 | clone 是快照，安全 |
| 表格单元格内公式 | 公式替换，表格结构保留 |

---

## 6. 验收测试矩阵

| # | 操作 | text/plain 期望 | text/html 期望 |
|---|---|---|---|
| 1 | 选正文 + 行内公式 | 正文原样，公式 `$Θ$` | 段落结构 + 公式标记 |
| 2 | 选块级公式 | `$$T(n)=…$$` | 独占一段 |
| 3 | 选半个公式 | 完整 `$$…$$` | 同上 |
| 4 | 选整段（含列表） | 列表文本 + `$…$` | `<ul>/<li>` 保留 |
| 5 | 代码块内选择 | 原生行为 | 原生行为 |
| 6 | 粘贴到 Typora/网页 KaTeX | —— | 正常渲染 |

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| `clipboard.write` 需要手势/焦点 | 写入失败 | 在 copy 事件内调用（属手势），并保留同步兜底 |
| Electron 自定义 origin 非 secure context | API 不可用 | 用 `127.0.0.1`（secure）；兜底 `execCommand` |
| DSH 升级改 class 名 | 失效 | 只用 `.katex` 语义选择器；启动时探测并降级 |
| 与代码块复制按钮冲突 | 双写 | 容器级排除 + capture 顺序控制 |
| 插件改动不热更 | 迭代慢 | `tools/harness` 独立调试；真机每天一次安装验证 |
| 用户自定义 `$` 分隔符偏好 | 不兼容 | v1 固定 `$`/`$$`，README 说明 |

---

## 8. 里程碑

- **M1（P1 结束）**：真实 GUI 基线数据落盘，技术假设全部证实
- **M2（P3 结束）**：核心逻辑 + 单测通过，harness 手动验证通过
- **M3（P4 结束）**：插件可安装、真机 4 条验收通过 → 可用版本
- **M4（P6 结束）**：文档齐备、可选开关、发布 tag `v0.1.0`

---

## 9. 不做的事（明确边界）

- 不改 DSH core / 不 patch `app.asar`
- 不做图片化公式（MathML→PNG）路线
- 不接管代码块复制
- 不做跨应用（Word/飞书）专用格式，只保证标准 `text/html` + `text/plain`
