import { escapeHtml, formulaKey, COPY_ICON_SVG } from "./utils.js";
import { emptyStateMessageForCodeView } from "./logic.js";

function renderCodeEmptyState(ctx, options) {
  const isMissing = ctx.reason === "missingInVersionA" || ctx.reason === "missingInVersionB";
  const showNearestMatchBtn = isMissing;
  return `
    <div class="code-view code-view--empty">
      <div class="code-view-empty-wrap">
        <div class="code-view-empty">${escapeHtml(emptyStateMessageForCodeView(ctx))}</div>
        ${
          showNearestMatchBtn
            ? `<button type="button" class="logic-flow-toolbar-btn" data-action="logic-view-nearest-match" aria-label="View nearest match in this version">View nearest match in this version</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function fileDisplayLabel(fileName) {
  if (!fileName) return "App & shared";
  const base = String(fileName).split(/[/\\]/).pop() || fileName;
  return base.replace(/\.fx$/i, "") || fileName;
}

function sortFormulasInFile(formulas) {
  return [...formulas].sort((a, b) => {
    const fa = `${a.control || ""}|${a.property || ""}`;
    const fb = `${b.control || ""}|${b.property || ""}`;
    return fa.localeCompare(fb);
  });
}

/**
 * @param {object[]} formulas
 * @returns {{ fileName: string; formulas: object[] }[]}
 */
export function groupFormulasByFile(formulas) {
  const map = new Map();
  for (const f of formulas) {
    const fn = f.fileName || "";
    if (!map.has(fn)) map.set(fn, []);
    map.get(fn).push(f);
  }
  const keys = [...map.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((fileName) => ({
    fileName,
    formulas: sortFormulasInFile(map.get(fileName)),
  }));
}

/** All-view buffer: IDE-style single column with tree shape as text (see buildEntireBuffer). */
const ENTIRE_INDENT_CONTROL = "  ";
const ENTIRE_INDENT_PROP = "      ";
const ENTIRE_INDENT_BODY = "            ";

/**
 * One editor buffer: `[kind] file` → `[control] …` → `Control.Property` → indented formula body.
 * Example:
 *   [app] App
 *   [control] App
 *       App.OnStart
 *             Set( … )
 */
function buildEntireBuffer(groups) {
  const keyToStartLine = new Map();
  const lines = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const fileLabel = fileDisplayLabel(g.fileName);
    const fileKind = normalizeFileKind(g.formulas[0]?.fileType);
    if (gi > 0) lines.push("");
    lines.push(`[${fileKind}] ${fileLabel}`);

    const byControl = groupBy(g.formulas, (f) => f.control || "UnknownControl");
    const controlEntries = Object.entries(byControl).sort(([a], [b]) => a.localeCompare(b));

    for (const [control, items] of controlEntries) {
      const sorted = items.slice().sort((a, b) => (a.property || "").localeCompare(b.property || ""));
      lines.push(`${ENTIRE_INDENT_CONTROL}[control] ${control}`);

      for (const f of sorted) {
        const propPath = `${f.control || "?"}.${f.property || "?"}`;
        keyToStartLine.set(f.key, lines.length + 1);
        lines.push(`${ENTIRE_INDENT_PROP}${propPath}`);
        const body = typeof f.formula === "string" ? f.formula : "";
        if (body) {
          for (const bl of body.split("\n")) {
            lines.push(bl.length ? `${ENTIRE_INDENT_BODY}${bl}` : "");
          }
        }
      }
    }
  }

  const buffer = lines.join("\n");
  return { buffer, keyToStartLine, lineCount: Math.max(1, lines.length) };
}

function groupBy(arr, keyFn) {
  const out = {};
  for (const x of arr) {
    const k = keyFn(x);
    if (!out[k]) out[k] = [];
    out[k].push(x);
  }
  return out;
}

function formulaKeyFor(f, fileName) {
  return f.key || formulaKey({ control: f.control, property: f.property, fileName: f.fileName ?? fileName });
}

/** File category for badges: app, screen, component, or sanitized type / `file`. */
function normalizeFileKind(fileType) {
  const t = String(fileType || "").toLowerCase().trim();
  if (t === "app") return "app";
  if (t === "screen") return "screen";
  if (t === "component") return "component";
  if (t) return t.replace(/[^a-z0-9_-]/gi, "") || "file";
  return "file";
}

/** Stable class names for file-kind badge colors; unknown kinds use `other` + `data-kind`. */
function fileKindClassForCss(kind) {
  const k = String(kind || "file").toLowerCase();
  if (k === "app" || k === "screen" || k === "component" || k === "file") return k;
  return "other";
}

/**
 * All view: VS Code–style fold column + line numbers + text; native `<details>` for expand/collapse.
 */
function buildEntireFoldHtml(groups, selectedKey) {
  let lineN = 1;

  const parts = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const fileName = g.fileName || "";
    const fileLabel = fileDisplayLabel(fileName);
    const fileKind = normalizeFileKind(g.formulas[0]?.fileType);
    const fileKindClass = fileKindClassForCss(fileKind);
    if (gi > 0) parts.push(`<div class="code-view-all-file-gap" aria-hidden="true"></div>`);

    const byControl = groupBy(g.formulas, (f) => f.control || "UnknownControl");
    const controlEntries = Object.entries(byControl).sort(([a], [b]) => a.localeCompare(b));

    const fileLn = lineN;
    lineN++;

    const controlBlocks = controlEntries
      .map(([control, items]) => {
        const sorted = items.slice().sort((a, b) => (a.property || "").localeCompare(b.property || ""));
        const controlLn = lineN;
        lineN++;

        const formulasHtml = sorted
          .map((f) => {
            const rk = formulaKeyFor(f, fileName);
            const keyAttr = escapeHtml(rk);
            const propPath = `${f.control || "?"}.${f.property || "?"}`;
            const propLine = `${ENTIRE_INDENT_PROP}${propPath}`;
            const isSel = Boolean(selectedKey) && rk === selectedKey;
            const body = typeof f.formula === "string" ? f.formula : "";
            const bodyLines = body.length ? body.split("\n") : [""];

            const propLn = lineN;
            lineN++;
            const summaryRow = `<summary class="code-view-all-row code-view-all-summary">
              <span class="code-view-all-ln">${propLn}</span>
              <span class="code-view-all-fold-chevron" aria-hidden="true"></span>
              <span class="code-view-all-text code-view-all-text--code code-view-all-text--prop-line">${escapeHtml(propLine)}</span>
            </summary>`;

            const bodyHtml = bodyLines
              .map((bl) => {
                const text = bl.length ? `${ENTIRE_INDENT_BODY}${bl}` : "";
                const ln = lineN;
                lineN++;
                return `<div class="code-view-all-body-line code-view-all-row">
                  <span class="code-view-all-ln">${ln}</span>
                  <span class="code-view-all-fold-spacer" aria-hidden="true"></span>
                  <span class="code-view-all-text code-view-all-text--code">${escapeHtml(text)}</span>
                </div>`;
              })
              .join("");

            return `<details class="code-view-all-node code-view-all-node--formula${isSel ? " is-selected" : ""}" data-formula-key="${keyAttr}" open>
              ${summaryRow}
              <div class="code-block-wrap code-block-wrap--formula-all">
                <div class="code-view-all-formula-body">${bodyHtml}</div>
                <button type="button" class="code-block-copy code-block-copy--formula-all" data-action="copy-formula-block" data-copy-text="${escapeHtml(body)}" aria-label="Copy formula" title="Copy formula">${COPY_ICON_SVG}</button>
              </div>
            </details>`;
          })
          .join("");

        const controlSummary = `<summary class="code-view-all-row code-view-all-summary">
          <span class="code-view-all-ln">${controlLn}</span>
          <span class="code-view-all-fold-chevron" aria-hidden="true"></span>
          <span class="code-view-all-text code-view-all-text--code code-view-all-text--badged">
            <span class="code-view-all-indent">${escapeHtml(ENTIRE_INDENT_CONTROL)}</span><span class="code-view-all-badge code-view-all-badge--control">control</span><span class="code-view-all-after-badge"> ${escapeHtml(control)}</span>
          </span>
        </summary>`;

        return `<details class="code-view-all-node code-view-all-node--control" open>
          ${controlSummary}
          <div class="code-view-all-children">${formulasHtml}</div>
        </details>`;
      })
      .join("");

    const fileSummary = `<summary class="code-view-all-row code-view-all-summary">
      <span class="code-view-all-ln">${fileLn}</span>
      <span class="code-view-all-fold-chevron" aria-hidden="true"></span>
      <span class="code-view-all-text code-view-all-text--file">
        <span class="code-view-all-badge code-view-all-badge--${fileKindClass}" data-kind="${escapeHtml(fileKind)}" title="File type">${escapeHtml(fileKind)}</span><span class="code-view-all-after-badge code-view-all-file-title"> ${escapeHtml(fileLabel)}</span>
      </span>
    </summary>`;

    parts.push(`<details class="code-view-all-node code-view-all-node--file" open>
      ${fileSummary}
      <div class="code-view-all-children">${controlBlocks}</div>
    </details>`);
  }

  return { html: parts.join("") };
}

/**
 * @param {HTMLElement | null} container
 * @param {object} [options]
 * @param {(formulaKey: string) => void} [options.onSelectFormulaByKey] — select formula (syncs graph / inspector)
 */
export function renderCodeView(container, options = {}) {
  if (!container) return;

  const pane = options.paneVersion === "B" ? "B" : "A";
  if (options.hasParsed === false) {
    container.innerHTML = renderCodeEmptyState(
      { state: "none", reason: pane === "B" ? "noVersionLoadedB" : "noVersionLoadedA" },
      options
    );
    return;
  }

  const parsed = options.parsed;
  const flatSorted = [...(parsed?.formulas || [])].sort((a, b) => {
    const fa = `${a.fileName || ""}|${a.control || ""}|${a.property || ""}`;
    const fb = `${b.fileName || ""}|${b.control || ""}|${b.property || ""}`;
    return fa.localeCompare(fb);
  });

  if (!flatSorted.length) {
    container.innerHTML = renderCodeEmptyState({ state: "none", reason: "noFormulasInScope" }, options);
    return;
  }

  const groups = groupFormulasByFile(flatSorted);
  const selectedKey = options.selectedKey || null;

  const entireFoldHtml = buildEntireFoldHtml(groups, selectedKey).html;

  const scopeLabel = options.scopeLabel || "All screens";
  const docTitle = scopeLabel === "All screens" ? "All" : scopeLabel;
  const docMeta = `${flatSorted.length} formulas · ${scopeLabel}`;

  const mainClass = "code-view-ide-main code-view-ide-main--entire";

  container.innerHTML = `
    <div class="code-view code-view--ide">
      <div class="code-view-ide-toolbar">
        <div class="code-view-ide-toolbar-left">
          <span class="code-view-ide-brand">Formula code</span>
          <span class="code-view-ide-scope" title="Screen filter">${escapeHtml(scopeLabel)}</span>
        </div>
      </div>
      <div class="${mainClass}">
        <div class="code-view-editor-stack">
          <header class="code-view-doc-head">
            <div class="code-view-doc-head-text">
              <h2 class="code-view-doc-title">${escapeHtml(docTitle)}</h2>
              <p class="code-view-doc-meta" title="${escapeHtml(docMeta)}">${escapeHtml(docMeta)}</p>
            </div>
            <span class="code-view-doc-note" title="Editing is disabled">Read-only</span>
          </header>
          <div class="code-view-editor-scroll code-view-editor-scroll--all" data-code-editor-scroll>
            <div class="code-view-all-ide">${entireFoldHtml}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const scrollEl = container.querySelector("[data-code-editor-scroll]");
  if (selectedKey) {
    requestAnimationFrame(() => {
      if (!scrollEl) return;
      for (const el of container.querySelectorAll("[data-formula-key]")) {
        if (el.getAttribute("data-formula-key") === selectedKey) {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          break;
        }
      }
    });
  }

  container.addEventListener("click", async (e) => {
    const blockBtn = e.target.closest("[data-action='copy-formula-block']");
    if (!blockBtn || !container.contains(blockBtn)) return;
    e.preventDefault();
    e.stopPropagation();
    const text = blockBtn.getAttribute("data-copy-text") ?? "";
    try {
      await navigator.clipboard.writeText(text);
      flashCopyBlockBtn(blockBtn);
    } catch {
      /* ignore */
    }
  });

  container.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='copy-formula-block']")) return;
    const details = e.target.closest(".code-view-all-node--formula[data-formula-key]");
    if (!details || !container.contains(details)) return;
    if (typeof options.onSelectFormulaByKey !== "function") return;
    const key = details.getAttribute("data-formula-key");
    if (!key) return;
    options.onSelectFormulaByKey(key);
  });

}

function flashCopyBlockBtn(btn) {
  if (!btn) return;
  const prevLabel = btn.getAttribute("aria-label") || "";
  btn.classList.add("is-copied");
  btn.setAttribute("aria-label", "Copied");
  window.setTimeout(() => {
    btn.classList.remove("is-copied");
    if (prevLabel) btn.setAttribute("aria-label", prevLabel);
  }, 1200);
}

/**
 * Full Code View buffer for the current scope (matches the fold-tree body).
 * @param {{ formulas?: object[] } | null | undefined} parsedForPane
 */
export function getCodeViewCopyAllText(parsedForPane) {
  if (!parsedForPane?.formulas?.length) return "";
  const flatSorted = [...parsedForPane.formulas].sort((a, b) => {
    const fa = `${a.fileName || ""}|${a.control || ""}|${a.property || ""}`;
    const fb = `${b.fileName || ""}|${b.control || ""}|${b.property || ""}`;
    return fa.localeCompare(fb);
  });
  const groups = groupFormulasByFile(flatSorted);
  return buildEntireBuffer(groups).buffer;
}
