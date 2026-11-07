/*
 * dsh-katex-inline-copy v0.1.0
 * 选中含公式的内容复制时，把 KaTeX 渲染结果替换成 $...$ / $$...$$。
 * 自动生成，请改 src/ 后运行 `npm run build`。
 */
window.__ModuleLoader__.load({
  id: "dsh-katex-inline-copy",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
      "use strict";
      var __dshKatexInlineCopy = (() => {
        var __defProp = Object.defineProperty;
        var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
        var __getOwnPropNames = Object.getOwnPropertyNames;
        var __hasOwnProp = Object.prototype.hasOwnProperty;
        var __export = (target, all) => {
          for (var name in all)
            __defProp(target, name, { get: all[name], enumerable: true });
        };
        var __copyProps = (to, from, except, desc) => {
          if (from && typeof from === "object" || typeof from === "function") {
            for (let key of __getOwnPropNames(from))
              if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
          }
          return to;
        };
        var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

        // src/index.ts
        var index_exports = {};
        __export(index_exports, {
          apply: () => apply,
          inject: () => inject,
          isEnabled: () => isEnabled
        });

        // src/math.ts
        var KATEX_ROOT = ".katex";
        var KATEX_DISPLAY = ".katex-display";
        var TEX_ANNOTATION = 'annotation[encoding="application/x-tex"]';
        var ELEMENT_NODE = 1;
        function elementOf(node) {
          if (!node) return null;
          if (node.nodeType === ELEMENT_NODE) return node;
          return node.parentElement ?? null;
        }
        function closestKatex(node) {
          const element = elementOf(node);
          if (!element || typeof element.closest !== "function") return null;
          const katex = element.closest(KATEX_ROOT);
          if (!katex || katex.classList.contains("katex-error")) return null;
          return katex;
        }
        function isDisplayMath(node) {
          if (node.classList.contains("katex-display")) return true;
          return node.closest(KATEX_DISPLAY) !== null;
        }
        function texSource(node) {
          const annotation = node.querySelector(TEX_ANNOTATION);
          const tex = annotation?.textContent;
          return tex ? tex.trim() : "";
        }
        function wrapTex(tex, display) {
          const fence = display ? "$$" : "$";
          return fence + tex + fence;
        }

        // src/transform.ts
        var ELEMENT_NODE2 = 1;
        var TEXT_NODE = 3;
        var PARAGRAPH_TAGS = /* @__PURE__ */ new Set([
          "P",
          "DIV",
          "UL",
          "OL",
          "H1",
          "H2",
          "H3",
          "H4",
          "H5",
          "H6",
          "PRE",
          "BLOCKQUOTE",
          "TABLE",
          "SECTION",
          "ARTICLE",
          "FIGCAPTION"
        ]);
        var LINE_TAGS = /* @__PURE__ */ new Set(["LI", "TR"]);
        function outermostMathNodes(root) {
          const all = Array.from(root.querySelectorAll(`${KATEX_DISPLAY}, ${KATEX_ROOT}`));
          return all.filter((element) => {
            const parent = element.parentElement;
            return !parent || parent.closest(`${KATEX_DISPLAY}, ${KATEX_ROOT}`) === null;
          });
        }
        function collectText(root) {
          let out = "";
          const breakLines = (count) => {
            const existing = /\n*$/.exec(out)?.[0].length ?? 0;
            if (existing < count) out += "\n".repeat(count - existing);
          };
          const walk = (node) => {
            if (node.nodeType === TEXT_NODE) {
              out += node.data;
              return;
            }
            if (node.nodeType !== ELEMENT_NODE2) return;
            const element = node;
            const tag = element.tagName;
            if (tag === "BR") {
              out += "\n";
              return;
            }
            const paragraph = PARAGRAPH_TAGS.has(tag);
            const line = LINE_TAGS.has(tag);
            if (paragraph) breakLines(2);
            else if (line) breakLines(1);
            for (const child of Array.from(element.childNodes)) walk(child);
            if (paragraph) breakLines(2);
            else if (line) breakLines(1);
          };
          walk(root);
          return normalizeText(out);
        }
        function normalizeText(text) {
          return text.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        }
        function buildPayload(range, doc) {
          const fragment = range.cloneContents();
          const holder = doc.createElement("div");
          holder.appendChild(fragment);
          let converted = 0;
          for (const element of outermostMathNodes(holder)) {
            const tex = texSource(element);
            if (!tex) continue;
            const display = isDisplayMath(element);
            const value = wrapTex(tex, display);
            element.replaceWith(doc.createTextNode(display ? `
      ${value}
      ` : value));
            converted += 1;
          }
          if (converted === 0) return null;
          return { html: holder.innerHTML, text: collectText(holder) };
        }

        // src/install.ts
        var EDITABLE_SELECTOR = [
          "input",
          "textarea",
          '[contenteditable=""]',
          '[contenteditable="true"]',
          '[contenteditable="plaintext-only"]'
        ].join(", ");
        var CODE_SELECTOR = "[data-code-block-content], [data-code-block-banner], pre";
        var MIME_HTML = "text/html";
        var MIME_TEXT = "text/plain";
        function rangeTouchesMath(range, doc) {
          const nodes = doc.querySelectorAll(KATEX_ROOT);
          for (const node of Array.from(nodes)) {
            try {
              if (range.intersectsNode(node)) return true;
            } catch {
            }
          }
          return false;
        }
        function expandToWholeMath(range) {
          const startMath = closestKatex(range.startContainer);
          const endMath = closestKatex(range.endContainer);
          if (startMath) {
            const anchor = startMath.closest(KATEX_DISPLAY) ?? startMath;
            try {
              range.setStartBefore(anchor);
            } catch {
            }
          }
          if (endMath) {
            const anchor = endMath.closest(KATEX_DISPLAY) ?? endMath;
            try {
              range.setEndAfter(anchor);
            } catch {
            }
          }
          return range;
        }
        async function writeViaClipboardApi(payload) {
          const clipboard = navigator.clipboard;
          if (!clipboard || typeof clipboard.write !== "function" || typeof ClipboardItem === "undefined") return;
          await clipboard.write([
            new ClipboardItem({
              [MIME_HTML]: new Blob([payload.html], { type: MIME_HTML }),
              [MIME_TEXT]: new Blob([payload.text], { type: MIME_TEXT })
            })
          ]);
        }
        function installCopyHandler(options = {}) {
          const doc = options.doc ?? document;
          const isEnabled2 = options.isEnabled ?? (() => true);
          const handler = (event) => {
            try {
              if (!isEnabled2()) return;
              const selection = doc.getSelection();
              if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
              const range = selection.getRangeAt(0);
              const startElement = elementOf(range.startContainer);
              const endElement = elementOf(range.endContainer);
              if (!startElement || !endElement) return;
              if (startElement.closest(EDITABLE_SELECTOR) || endElement.closest(EDITABLE_SELECTOR)) return;
              if (startElement.closest(CODE_SELECTOR) || endElement.closest(CODE_SELECTOR)) return;
              if (!rangeTouchesMath(range, doc)) return;
              const expanded = expandToWholeMath(range.cloneRange());
              const payload = buildPayload(expanded, doc);
              if (!payload) return;
              const clipboardEvent = event;
              clipboardEvent.preventDefault();
              if (clipboardEvent.clipboardData) {
                clipboardEvent.clipboardData.setData(MIME_TEXT, payload.text);
                clipboardEvent.clipboardData.setData(MIME_HTML, payload.html);
              } else {
                void writeViaClipboardApi(payload).catch((error) => {
                  console.warn("[dsh-katex-inline-copy] clipboard write failed", error);
                });
              }
              options.onCopy?.(payload);
            } catch (error) {
              console.warn("[dsh-katex-inline-copy] copy interception failed", error);
            }
          };
          doc.addEventListener("copy", handler, true);
          return () => doc.removeEventListener("copy", handler, true);
        }

        // src/index.ts
        var ENABLED_KEY = "dsh-katex-inline-copy.enabled";
        var INSTALLED_FLAG = "__dshKatexInlineCopyInstalled";
        function isEnabled() {
          try {
            return localStorage.getItem(ENABLED_KEY) !== "off";
          } catch {
            return true;
          }
        }
        function apply() {
          const scope = window;
          if (scope[INSTALLED_FLAG]) return;
          scope[INSTALLED_FLAG] = true;
          installCopyHandler({ isEnabled });
          console.info("[dsh-katex-inline-copy] installed");
        }
        var inject = [];
        return __toCommonJS(index_exports);
      })();

    return __dshKatexInlineCopy;
  },
});
