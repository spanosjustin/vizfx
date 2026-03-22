import { escapeHtml, COPY_ICON_SVG } from "./utils.js";

export function renderDetails(container, item, options = {}) {
  if (!item) {
    container.innerHTML = `<div class="empty-state">Click a node or formula to inspect details.</div>`;
    return;
  }

  if (item.nodeType === "formula" || item.formula) {
    renderFormulaDetails(container, item, options);
    return;
  }

  container.innerHTML = `
    <div class="details-card">
      <h3>${escapeHtml(item.label || item.id || "Node")}</h3>
      <p><strong>Type:</strong> ${escapeHtml(item.nodeType || "unknown")}</p>
      <p><strong>ID:</strong> ${escapeHtml(item.id || "")}</p>
      ${
        item.contextText
          ? `<p><strong>Context:</strong></p><div class="details-context-text">${escapeHtml(item.contextText)}</div>`
          : ""
      }
    </div>
  `;
}

export function renderFormulaDetails(container, formula, options = {}) {
  const refs = formula.references || {};
  const diffStatus =
    options.diffStatus === "added" || options.diffStatus === "removed" || options.diffStatus === "changed"
      ? options.diffStatus
      : null;
  const comparison = diffStatus === "changed" ? options.formulaComparison : null;
  const versionLabels = options.formulaVersionLabels || {};
  const labelA = versionLabels.A || "Version A";
  const labelB = versionLabels.B || "Version B";
  const formulaCardClass = diffStatus ? `details-card details-card--formula-${diffStatus}` : "details-card";
  const statusLabel =
    diffStatus === "added"
      ? "Added in Version B"
      : diffStatus === "removed"
        ? "Removed from Version B"
        : "Changed between versions";

  container.innerHTML = `
    <div class="details-card">
      <h3>${escapeHtml(formula.control)}.${escapeHtml(formula.property)}</h3>
      <p><strong>File:</strong> ${escapeHtml(formula.fileName || "")}</p>
      <p><strong>Type:</strong> ${escapeHtml(formula.fileType || "formula")}</p>
    </div>

    <div class="${formulaCardClass}">
      <h3>
        Formula
        ${diffStatus ? `<span class="formula-status-badge formula-status-badge--${diffStatus}">${statusLabel}</span>` : ""}
      </h3>
      ${
        comparison
          ? `
        <div class="formula-version-grid">
          <div class="formula-version">
            ${renderVersionHeading(labelA, "A")}
            ${codeBlockWithCopy(comparison.before?.formula || "")}
          </div>
          <div class="formula-version">
            ${renderVersionHeading(labelB, "B")}
            ${codeBlockWithCopy(comparison.after?.formula || "")}
          </div>
        </div>
      `
          : codeBlockWithCopy(formula.formula || "")
      }
    </div>

    <div class="details-card">
      <h3>References</h3>

      <p><strong>Variables Set</strong></p>
      ${renderReferenceTagList("variablesSet", refs.variablesSet, options)}

      <p><strong>Variables Used</strong></p>
      ${renderReferenceTagList("variablesUsed", refs.variablesUsed, options)}

      <p><strong>Controls Used</strong></p>
      ${renderReferenceTagList("controlsUsed", refs.controlsUsed, options)}

      <p><strong>Tables Used</strong></p>
      ${renderReferenceTagList("tablesUsed", refs.tablesUsed, options)}

      <p><strong>Columns Used</strong></p>
      ${renderReferenceTagList("columnsUsed", refs.columnsUsed, options)}

      <p><strong>Functions Used</strong></p>
      ${renderTagList(refs.functionsUsed)}
    </div>
  `;

  for (const btn of container.querySelectorAll("[data-action='copy-code-block']")) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const text = btn.getAttribute("data-copy-text") ?? "";
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("is-copied");
        const prev = btn.getAttribute("aria-label") || "";
        btn.setAttribute("aria-label", "Copied");
        window.setTimeout(() => {
          btn.classList.remove("is-copied");
          if (prev) btn.setAttribute("aria-label", prev);
        }, 1200);
      } catch {
        /* ignore */
      }
    });
  }

  for (const btn of container.querySelectorAll("[data-action='select-reference']")) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const cat = btn.getAttribute("data-ref-category") || "";
      const enc = btn.getAttribute("data-ref-name") || "";
      let name = "";
      try {
        name = decodeURIComponent(enc);
      } catch {
        name = enc;
      }
      options.onSelectReference?.(cat, name);
    });
  }
}

function codeBlockWithCopy(rawFormula) {
  const body = rawFormula ?? "";
  return `<div class="code-block-wrap code-block-wrap--details">
    <div class="code-block">${escapeHtml(body)}</div>
    <button type="button" class="code-block-copy code-block-copy--details" data-action="copy-code-block" data-copy-text="${escapeHtml(body)}" aria-label="Copy formula" title="Copy formula">${COPY_ICON_SVG}</button>
  </div>`;
}

function renderTagList(items = []) {
  if (!items.length) {
    return `<div class="tag-list"><span class="tag">None</span></div>`;
  }

  return `
    <div class="tag-list">
      ${items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

/**
 * @param {string} category — variablesSet | variablesUsed | controlsUsed | tablesUsed | columnsUsed
 * @param {string[]} items
 * @param {{ isReferenceResolvable?: (category: string, name: string) => boolean; onSelectReference?: (category: string, name: string) => void }} options
 */
function renderReferenceTagList(category, items = [], options = {}) {
  if (!items.length) {
    return `<div class="tag-list"><span class="tag">None</span></div>`;
  }

  const isResolvable = options.isReferenceResolvable;
  const onSelect = options.onSelectReference;

  return `
    <div class="tag-list tag-list--references">
      ${items
        .map((item) => {
          const name = String(item);
          const showSelect = Boolean(onSelect && isResolvable?.(category, name));
          const enc = encodeURIComponent(name);
          const btn = showSelect
            ? `<button type="button" class="reference-select-btn" data-action="select-reference" data-ref-category="${escapeHtml(
                category
              )}" data-ref-name="${enc}" aria-label="Select ${escapeHtml(name)} in graph" title="Select in graph">Select</button>`
            : "";
          return `<div class="reference-row"><span class="tag">${escapeHtml(name)}</span>${btn}</div>`;
        })
        .join("")}
    </div>
  `;
}

function renderVersionHeading(label, fallbackVersion) {
  const text = String(label || "").trim();
  const match = text.match(/^(.*)\s+\(Version\s+([A-Za-z0-9_-]+)\)$/);
  const namePart = match?.[1]?.trim() || text || `Version ${fallbackVersion}`;
  const versionPart = match?.[2]?.trim() || fallbackVersion;

  return `
    <h4 class="formula-version-heading">
      <span class="formula-version-name">${escapeHtml(namePart)}</span>
      <span class="formula-version-tag">(Version ${escapeHtml(versionPart)})</span>
    </h4>
  `;
}