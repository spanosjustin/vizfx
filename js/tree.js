import { escapeHtml, formulaKey } from "./utils.js";

function fileNodeId(fileName) {
  return `file::${String(fileName)}`;
}

function explorerControlNodeId(fileName, controlName) {
  return `control::${String(fileName)}::${String(controlName)}`;
}

function hierarchyControlNodeId(fileName, control) {
  const name = control?.name ?? "Unnamed";
  const type = control?.type ?? "control";
  // Prefer stable numeric/string IDs when available.
  const idPart = control?.id != null && control?.id !== "" ? String(control.id) : `noid:${String(name)}`;
  // Include parentId as a weak disambiguator for missing IDs.
  const parentPart = control?.parentId != null && control?.parentId !== "" ? String(control.parentId) : "noparent";
  return `control::${String(fileName)}::${idPart}::${parentPart}::${String(type)}`;
}

function isNodeOpen(expandedDetailsSet, nodeId, baseOpen = false) {
  if (!expandedDetailsSet) return Boolean(baseOpen);
  return expandedDetailsSet.has(nodeId);
}

/**
 * Tree rendering strategy:
 * - If parsed.raw.controls exists (best-practice schema), render a true hierarchy using parentId.
 * - Otherwise fall back to a file -> control -> property tree derived from parsed.files[].formulas[].
 */
export function renderTree(
  container,
  parsed,
  {
    onFormulaClick,
    selectedKey,
    expandedDetailsSet,
    onDetailsToggle,
    getFormulaDiffStatus,
    searchQuery,
    renderCacheKey,
  } = {}
) {
  if (!container) return;

  const q = String(searchQuery ?? "").trim();
  const queryLower = q ? q.toLowerCase() : "";
  const hasQuery = Boolean(queryLower);

  bindTreeDetailsToggle(container, onDetailsToggle);
  bindTreeLeafClicks(container, parsed, onFormulaClick);

  if (!parsed) {
    container.innerHTML = `<div class="empty-state">No data loaded.</div>`;
    container.__leafAncestorDetailsMap = null;
    container.__treeRenderCacheKey = "__empty__";
    return;
  }

  const rawControls = Array.isArray(parsed.raw?.controls) ? parsed.raw.controls : null;
  const effectiveRenderCacheKey = String(
    renderCacheKey ??
      `${rawControls?.length ? "hierarchy" : "explorer"}::q=${queryLower}::expanded=${getExpandedSetSignature(
        expandedDetailsSet
      )}`
  );
  if (container.__treeRenderCacheKey === effectiveRenderCacheKey) {
    updateTreeSelection(container, selectedKey);
    return;
  }

  // Tree DOM is re-rendered wholesale; clear any cached ancestor index.
  container.__leafAncestorDetailsMap = null;
  container.__treeRenderCacheKey = effectiveRenderCacheKey;

  if (rawControls?.length) {
    container.innerHTML = renderControlHierarchyTree(parsed, rawControls, selectedKey, expandedDetailsSet, {
      getFormulaDiffStatus,
      searchQueryLower: queryLower,
      hasQuery,
    });
    bindTreeKeyboardNavigation(container);
    return;
  }

  container.innerHTML = renderExplorerTree(parsed, selectedKey, expandedDetailsSet, {
    getFormulaDiffStatus,
    searchQueryLower: queryLower,
    hasQuery,
  });
  bindTreeKeyboardNavigation(container);
}

function bindTreeDetailsToggle(container, onDetailsToggle) {
  // Bind once per container to avoid accumulating listeners across refreshes.
  if (!container.__treeDetailsToggleBound) {
    container.__treeDetailsToggleBound = true;
    container.addEventListener(
      "toggle",
      (event) => {
        const details = event?.target;
        if (!details || details.tagName !== "DETAILS") return;
        const nodeId = details.dataset?.treeNodeId;
        if (!nodeId) return;
        // Keep summary's aria-expanded in sync for accessible semantics.
        const summary = details.querySelector?.(":scope > summary");
        if (summary) summary.setAttribute("aria-expanded", details.open ? "true" : "false");
        container.__treeDetailsToggleCallback?.(nodeId, Boolean(details.open));
      },
      true
    );
  }
  container.__treeDetailsToggleCallback = onDetailsToggle;
}

function bindTreeKeyboardNavigation(container) {
  // Bind once per container to avoid accumulating listeners across refreshes.
  if (!container || container.__treeKeyboardNavigationBound) return;
  container.__treeKeyboardNavigationBound = true;

  const focusableSelector = "[data-tree-leaf='true'], details > summary";

  const isElementVisibleInTree = (el) => {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (!container.contains(el)) return false;
    if (el.hidden) return false;
    if (el.closest?.("[hidden]")) return false;

    // Details content should only be visible when all ancestor <details> are open,
    // except that a <summary> remains visible even when its own <details> is closed.
    const ignoreDetails = el.tagName === "SUMMARY" ? el.parentElement : null;
    let curr = el.parentElement;
    while (curr && curr !== container) {
      if (curr.tagName === "DETAILS" && curr !== ignoreDetails && !curr.open) return false;
      curr = curr.parentElement;
    }

    return true;
  };

  const getVisibleTreeFocusableElements = () => {
    const all = Array.from(container.querySelectorAll(focusableSelector));
    return all.filter((el) => isElementVisibleInTree(el));
  };

  const getFocusedTreeFocusable = () => {
    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement)) return null;
    if (!container.contains(active)) return null;
    if (active.tagName === "SUMMARY") return active;
    const leaf = active.closest?.("[data-tree-leaf='true']");
    return leaf || null;
  };

  const focusElement = (el) => {
    if (!el || !(el instanceof HTMLElement)) return;
    // Keep focus without sudden scrolling when possible.
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    el.scrollIntoView?.({ block: "nearest" });
  };

  const getClosestParentDetailsSummary = (detailsEl) => {
    if (!detailsEl || !(detailsEl instanceof HTMLElement)) return null;
    const parentDetails = detailsEl.parentElement?.closest?.("details");
    if (!parentDetails) return null;
    return parentDetails.querySelector?.(":scope > summary") || null;
  };

  container.addEventListener(
    "keydown",
    (event) => {
      if (!event) return;
      const key = event.key;
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(key)) {
        return;
      }

      const focused = getFocusedTreeFocusable();
      if (!focused) return;

      const focusables = getVisibleTreeFocusableElements();
      if (focusables.length === 0) return;
      const idx = focusables.indexOf(focused);
      const safeIdx = idx >= 0 ? idx : 0;

      const moveFocusBy = (delta) => {
        const nextIdx = Math.max(0, Math.min(focusables.length - 1, safeIdx + delta));
        focusElement(focusables[nextIdx]);
      };

      const jumpTo = (pos) => {
        const next = Math.max(0, Math.min(focusables.length - 1, pos));
        focusElement(focusables[next]);
      };

      // Navigation between visible nodes/leaves.
      if (key === "ArrowDown") {
        event.preventDefault();
        moveFocusBy(1);
        return;
      }
      if (key === "ArrowUp") {
        event.preventDefault();
        moveFocusBy(-1);
        return;
      }

      // Expand/collapse via keyboard.
      if (key === "ArrowRight") {
        event.preventDefault();
        if (focused.tagName !== "SUMMARY") return;

        const detailsEl = focused.parentElement;
        if (!detailsEl || detailsEl.tagName !== "DETAILS") return;

        if (!detailsEl.open) detailsEl.open = true;
        const detailsSummary = detailsEl.querySelector?.(":scope > summary");
        if (detailsSummary) detailsSummary.setAttribute("aria-expanded", "true");
        const nodeId = detailsEl.dataset?.treeNodeId;
        if (nodeId) container.__treeDetailsToggleCallback?.(nodeId, true);

        // Focus the first visible item in the expanded subtree.
        const subtreeFocusableSelector = focusableSelector;
        const subtreeCandidates = Array.from(detailsEl.querySelectorAll(subtreeFocusableSelector)).filter(
          (el) => el !== focused && isElementVisibleInTree(el)
        );
        if (subtreeCandidates.length > 0) {
          focusElement(subtreeCandidates[0]);
        }
        return;
      }

      if (key === "ArrowLeft") {
        event.preventDefault();

        if (focused.tagName === "SUMMARY") {
          const detailsEl = focused.parentElement;
          if (!detailsEl || detailsEl.tagName !== "DETAILS") return;

          if (detailsEl.open) {
            detailsEl.open = false;
            const detailsSummary = detailsEl.querySelector?.(":scope > summary");
            if (detailsSummary) detailsSummary.setAttribute("aria-expanded", "false");
            const nodeId = detailsEl.dataset?.treeNodeId;
            if (nodeId) container.__treeDetailsToggleCallback?.(nodeId, false);
            focusElement(focused);
            return;
          }

          const parentSummary = getClosestParentDetailsSummary(detailsEl);
          if (parentSummary) focusElement(parentSummary);
          return;
        }

        // Leaf -> collapse its nearest containing details and move focus to that node.
        const detailsEl = focused.closest?.("details");
        if (detailsEl && detailsEl.tagName === "DETAILS") {
          if (detailsEl.open) {
            detailsEl.open = false;
            const detailsSummary = detailsEl.querySelector?.(":scope > summary");
            if (detailsSummary) detailsSummary.setAttribute("aria-expanded", "false");
            const nodeId = detailsEl.dataset?.treeNodeId;
            if (nodeId) container.__treeDetailsToggleCallback?.(nodeId, false);
          }
          const summary = detailsEl.querySelector?.(":scope > summary");
          if (summary) focusElement(summary);
        }
        return;
      }

      if (key === "Home") {
        event.preventDefault();
        jumpTo(0);
        return;
      }
      if (key === "End") {
        event.preventDefault();
        jumpTo(focusables.length - 1);
        return;
      }
    },
    true
  );
}

/**
 * Ensures the selected formula leaf is visible by expanding only its ancestor
 * <details> elements (path-to-leaf), never collapsing anything.
 *
 * @param {HTMLElement} container
 * @param {string|null} selectedKey Raw formulaKey string (control::property::fileName).
 */
export function autoExpandSelectedLeaf(container, selectedKey, { expandedDetailsSet } = {}) {
  if (!container) return;
  if (!selectedKey) return;

  // Leaf `data-key` values are HTML-escaped in markup, but the browser decodes
  // entities when exposing `el.dataset.key`. So we must use the raw formulaKey
  // string here (matching the existing click handler lookup).
  const safeKey = String(selectedKey);

  if (!container.__leafAncestorDetailsMap) {
    container.__leafAncestorDetailsMap = buildLeafAncestorDetailsMap(container);
  }

  const chain = container.__leafAncestorDetailsMap.get(safeKey);
  if (!chain || chain.length === 0) return;

  // Expand outer -> inner to ensure nested sections become visible.
  for (const details of chain) {
    if (!details || details.open) continue;
    details.open = true;
    const summary = details.querySelector?.(":scope > summary");
    if (summary) summary.setAttribute("aria-expanded", "true");

    // Persist auto-expands so future rerenders don't randomly collapse the path.
    if (expandedDetailsSet) {
      const nodeId = details.dataset?.treeNodeId;
      if (nodeId) expandedDetailsSet.add(nodeId);
    }
  }
}

function buildLeafAncestorDetailsMap(container) {
  const map = new Map();

  const leaves = container.querySelectorAll("[data-tree-leaf='true'][data-key]");
  leaves.forEach((leaf) => {
    const key = leaf.dataset.key;
    if (!key) return;

    // Walk up to collect the ancestor <details> nodes that control visibility.
    const detailsChain = [];
    let el = leaf;
    while (el && el !== container) {
      el = el.parentElement;
      if (!el) break;
      if (el.tagName === "DETAILS") detailsChain.push(el);
    }

    // Outer-first makes the opening deterministic for nested sections.
    detailsChain.reverse();
    map.set(key, detailsChain);
  });

  return map;
}

function getFormulaKindLabel(property) {
  const p = String(property || "");
  if (/^On[A-Z]/.test(p)) return "behavior";
  if (/^Items$/i.test(p)) return "data";
  return "property";
}

function normalizeTreeSearchQueryLower(qLower) {
  const s = String(qLower ?? "");
  return s.trim() ? s.toLowerCase() : "";
}

function textIncludesQuery(text, queryLower) {
  if (!queryLower) return false;
  return String(text ?? "").toLowerCase().includes(queryLower);
}

function highlightText(text, queryLower) {
  if (!queryLower) return escapeHtml(text);

  const raw = String(text ?? "");
  const lower = raw.toLowerCase();
  let idx = 0;
  let out = "";

  while (idx < raw.length) {
    const pos = lower.indexOf(queryLower, idx);
    if (pos === -1) {
      out += escapeHtml(raw.slice(idx));
      break;
    }

    if (pos > idx) out += escapeHtml(raw.slice(idx, pos));
    out += `<mark class="tree-highlight">${escapeHtml(raw.slice(pos, pos + queryLower.length))}</mark>`;
    idx = pos + queryLower.length;
  }

  return out;
}

function renderExplorerTree(
  parsed,
  selectedKey,
  expandedDetailsSet,
  { getFormulaDiffStatus, searchQueryLower, hasQuery } = {}
) {
  const files = parsed.files || [];

  const queryLower = normalizeTreeSearchQueryLower(searchQueryLower);
  const effectiveHasQuery = Boolean(hasQuery && queryLower);

  const fileDetails = files
    .map((file) => {
      const fileName = file.fileName || "Unknown file";
      const fileId = fileNodeId(fileName);
      const fileOpen = effectiveHasQuery ? true : isNodeOpen(expandedDetailsSet, fileId, true);
      const formulas = Array.isArray(file.formulas) ? file.formulas : [];
      const byControl = groupBy(formulas, (f) => f.control || "UnknownControl");

      const controlDetails = Object.entries(byControl)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([control, items]) => {
          const sorted = items.slice().sort((a, b) => (a.property || "").localeCompare(b.property || ""));

          const leaves = sorted
            .map((f) => {
              const propertyLabel = f.property || "(property)";
              const kindLabel = getFormulaKindLabel(f.property);
              const fileLabel = file.fileName || "Unknown file";
              const contextInline = `control: ${control} | file: ${fileLabel}`;
              const tooltipTitle = `control: ${control} | file: ${fileLabel} | property: ${propertyLabel}`;
              const rawKey = formulaKey({ control: f.control, property: f.property, fileName: file.fileName });
              const key = escapeHtml(rawKey);
              const isSelected = Boolean(selectedKey) && rawKey === selectedKey;

              const leafMatches =
                !effectiveHasQuery ||
                textIncludesQuery(propertyLabel, queryLower) ||
                textIncludesQuery(control, queryLower) ||
                textIncludesQuery(fileLabel, queryLower);

              if (!leafMatches) return null;

              // Explorer tree leaves are built from `parsed.files[].formulas`,
              // so those formula objects may not include `fileName`.
              // Diff logic relies on `control::property::fileName` keys.
              const diffStatus = getFormulaDiffStatus?.({ ...f, fileName: file.fileName }) ?? null;
              const statusLabel = diffStatus || "";
              const statusTitle =
                diffStatus === "added"
                  ? "Added in Version B"
                  : diffStatus === "removed"
                    ? "Removed from Version B"
                    : diffStatus === "changed"
                      ? "Changed between versions"
                      : "";
              const tooltipDiff = statusLabel ? ` | ${statusTitle}` : "";
              const tooltipContent = `${tooltipTitle}${tooltipDiff}`;
              const diffBadge =
                diffStatus === "added" || diffStatus === "removed" || diffStatus === "changed"
                  ? `<span class="formula-status-badge formula-status-badge--${diffStatus} tree-leaf-diff-badge" title="${escapeHtml(statusTitle)}">${escapeHtml(statusLabel)}</span>`
                  : "";

              const propertyInner = effectiveHasQuery ? highlightText(propertyLabel, queryLower) : escapeHtml(propertyLabel);
              const kindInner = effectiveHasQuery ? highlightText(kindLabel, queryLower) : escapeHtml(kindLabel);
              const contextInner = effectiveHasQuery ? highlightText(contextInline, queryLower) : escapeHtml(contextInline);

              return `
                <button type="button" class="tree-leaf tree-tooltip${isSelected ? " is-selected" : ""}" data-tree-leaf="true" data-key="${key}" title="${escapeHtml(tooltipContent)}" data-tooltip="${escapeHtml(tooltipContent)}" aria-label="${escapeHtml(
                  tooltipContent
                )}" ${
                  isSelected ? 'aria-current="true"' : ""
                }>
                  <div class="tree-leaf-main">
                    <div class="tree-leaf-title" title="${escapeHtml(propertyLabel)}">${propertyInner}</div>
                    <div class="tree-leaf-subtitle" title="${escapeHtml(kindLabel + " | " + contextInline)}">
                      ${kindInner} <span class="tree-leaf-subtitle-context" title="${escapeHtml(contextInline)}">${contextInner}</span>
                    </div>
                  </div>
                  ${diffBadge}
                </button>
              `;
            })
            .filter(Boolean)
            .join("");

          if (effectiveHasQuery && !leaves) return null;

          const controlId = explorerControlNodeId(fileName, control);
          const controlOpen = effectiveHasQuery ? true : isNodeOpen(expandedDetailsSet, controlId, false);

          return `
            <details${controlOpen ? " open" : ""} data-tree-node-id="${escapeHtml(controlId)}">
              <summary class="tree-tooltip" aria-expanded="${controlOpen ? "true" : "false"}" title="${escapeHtml(control)}" data-tooltip="${escapeHtml(
                control
              )}">
                <span class="tree-badge">control</span>
                <span>${effectiveHasQuery ? highlightText(control, queryLower) : escapeHtml(control)}</span>
              </summary>
              <div class="tree-children">
                ${leaves || `<div class="empty-state">No formulas.</div>`}
              </div>
            </details>
          `;
        })
        .filter(Boolean)
        .join("");

      if (effectiveHasQuery && !controlDetails) return null;

      return `
        <details${fileOpen ? " open" : ""} data-tree-node-id="${escapeHtml(fileId)}">
          <summary class="tree-tooltip" aria-expanded="${fileOpen ? "true" : "false"}" title="${escapeHtml(
            fileName
          )}" data-tooltip="${escapeHtml(fileName)}">
            <span class="tree-badge">${escapeHtml(file.type || "file")}</span>
            <span>${effectiveHasQuery ? highlightText(fileName, queryLower) : escapeHtml(fileName)}</span>
          </summary>
          <div class="tree-children">
            ${controlDetails || `<div class="empty-state">No controls.</div>`}
          </div>
        </details>
      `;
    })
    .filter(Boolean)
    .join("");

  if (effectiveHasQuery && !fileDetails) {
    return `<div class="tree"><div class="empty-state">No matching tree items.</div></div>`;
  }

  return `<div class="tree">${fileDetails || `<div class="empty-state">No files found.</div>`}</div>`;
}

function renderControlHierarchyTree(
  parsed,
  controls,
  selectedKey,
  expandedDetailsSet,
  { getFormulaDiffStatus, searchQueryLower, hasQuery } = {}
) {
  // Expected best-practice control schema:
  // raw.controls: [{ id, name, type, parentId, fileName, properties?: string[] }]
  // formulas already live in files[].formulas[]; we attach leaves by (fileName, controlName, property).

  const controlsByFile = groupBy(controls, (c) => c.fileName || c.screen || "Unknown");
  const files = Object.keys(controlsByFile).sort((a, b) => a.localeCompare(b));
  const queryLower = normalizeTreeSearchQueryLower(searchQueryLower);
  const effectiveHasQuery = Boolean(hasQuery && queryLower);

  const out = files
    .map((fileName) => {
      const fileControls = controlsByFile[fileName] || [];
      const byId = new Map(fileControls.map((c) => [c.id, c]));
      const childrenByParent = new Map();

      for (const c of fileControls) {
        const parentId = c.parentId || null;
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        childrenByParent.get(parentId).push(c);
      }

      for (const [, kids] of childrenByParent) {
        kids.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      }

      const roots = childrenByParent.get(null) || childrenByParent.get("") || [];

      const treeNodes = roots
        .map((root) =>
          renderControlNode(root, childrenByParent, fileName, parsed, selectedKey, expandedDetailsSet, {
            getFormulaDiffStatus,
            searchQueryLower: queryLower,
            hasQuery: effectiveHasQuery,
          })
        )
        .filter(Boolean)
        .join("");

      const fileId = fileNodeId(fileName);
      const fileOpen = effectiveHasQuery ? true : isNodeOpen(expandedDetailsSet, fileId, true);

      if (effectiveHasQuery && !treeNodes) return null;

      return `
        <details${fileOpen ? " open" : ""} data-tree-node-id="${escapeHtml(fileId)}">
          <summary class="tree-tooltip" title="${escapeHtml(fileName)}" data-tooltip="${escapeHtml(fileName)}">
            <span class="tree-badge">file</span>
            <span>${escapeHtml(fileName)}</span>
          </summary>
          <div class="tree-children">
            ${treeNodes || `<div class="empty-state">No controls.</div>`}
          </div>
        </details>
      `;
    })
    .filter(Boolean)
    .join("");

  if (effectiveHasQuery && !out) {
    return `<div class="tree"><div class="empty-state">No matching controls.</div></div>`;
  }

  return `<div class="tree">${out || `<div class="empty-state">No controls found.</div>`}</div>`;
}

function renderControlNode(
  control,
  childrenByParent,
  fileName,
  parsed,
  selectedKey,
  expandedDetailsSet,
  { getFormulaDiffStatus, searchQueryLower, hasQuery } = {}
) {
  const name = control.name || "Unnamed";
  const type = control.type || "control";
  const queryLower = normalizeTreeSearchQueryLower(searchQueryLower);
  const effectiveHasQuery = Boolean(hasQuery && queryLower);

  const formulas = parsed.formulas?.filter((f) => f.fileName === fileName && f.control === name) || [];
  const controlMatches = effectiveHasQuery ? textIncludesQuery(name, queryLower) : false;

  const formulaLeaves = formulas
    .slice()
    .sort((a, b) => String(a.property || "").localeCompare(String(b.property || "")))
    .map((f) => {
      const propertyLabel = f.property || "(property)";
      const kindLabel = getFormulaKindLabel(f.property);
      const contextInline = `control: ${name} | file: ${fileName}`;
      const tooltipTitle = `control: ${name} | file: ${fileName} | property: ${propertyLabel}`;
      const rawKey = formulaKey(f);
      const key = escapeHtml(rawKey);
      const isSelected = Boolean(selectedKey) && rawKey === selectedKey;

      const leafPropertyMatches = effectiveHasQuery ? textIncludesQuery(propertyLabel, queryLower) : false;
      const leafMatches = !effectiveHasQuery || controlMatches || leafPropertyMatches;

      if (!leafMatches) return null;

      const diffStatus = getFormulaDiffStatus?.(f) ?? null;
      const statusLabel = diffStatus || "";
      const statusTitle =
        diffStatus === "added"
          ? "Added in Version B"
          : diffStatus === "removed"
            ? "Removed from Version B"
            : diffStatus === "changed"
              ? "Changed between versions"
              : "";
      const tooltipDiff = statusLabel ? ` | ${statusTitle}` : "";
      const tooltipContent = `${tooltipTitle}${tooltipDiff}`;
      const diffBadge =
        diffStatus === "added" || diffStatus === "removed" || diffStatus === "changed"
          ? `<span class="formula-status-badge formula-status-badge--${diffStatus} tree-leaf-diff-badge" title="${escapeHtml(statusTitle)}">${escapeHtml(statusLabel)}</span>`
        : "";

      const propertyInner = effectiveHasQuery ? highlightText(propertyLabel, queryLower) : escapeHtml(propertyLabel);
      const kindInner = effectiveHasQuery ? highlightText(kindLabel, queryLower) : escapeHtml(kindLabel);
      const contextInner = effectiveHasQuery ? highlightText(contextInline, queryLower) : escapeHtml(contextInline);

      return `
        <button type="button" class="tree-leaf tree-tooltip${isSelected ? " is-selected" : ""}" data-tree-leaf="true" data-key="${key}" title="${escapeHtml(
          tooltipContent
        )}" data-tooltip="${escapeHtml(tooltipContent)}" aria-label="${escapeHtml(tooltipContent)}" ${
          isSelected ? 'aria-current="true"' : ""
        }>
          <div class="tree-leaf-main">
            <div class="tree-leaf-title" title="${escapeHtml(propertyLabel)}">${propertyInner}</div>
            <div class="tree-leaf-subtitle" title="${escapeHtml(kindLabel + " | " + contextInline)}">
              ${kindInner} <span class="tree-leaf-subtitle-context" title="${escapeHtml(contextInline)}">${contextInner}</span>
            </div>
          </div>
          ${diffBadge}
        </button>
      `;
    })
    .filter(Boolean)
    .join("");

  const children = childrenByParent.get(control.id) || [];
  const childBlocks = children
    .map((c) =>
      renderControlNode(c, childrenByParent, fileName, parsed, selectedKey, expandedDetailsSet, {
        getFormulaDiffStatus,
        searchQueryLower,
        hasQuery: effectiveHasQuery,
      })
    )
    .filter(Boolean)
    .join("");

  if (effectiveHasQuery && !formulaLeaves && !childBlocks) return "";

  const body = `
    <div class="tree-children">
      ${formulaLeaves}
      ${childBlocks}
      ${!formulaLeaves && !childBlocks ? `<div class="empty-state">No items.</div>` : ""}
    </div>
  `;

  const nodeId = hierarchyControlNodeId(fileName, control);
  const open = effectiveHasQuery ? true : isNodeOpen(expandedDetailsSet, nodeId, false);

  return `
    <details${open ? " open" : ""} data-tree-node-id="${escapeHtml(nodeId)}">
      <summary class="tree-tooltip" aria-expanded="${open ? "true" : "false"}" title="${escapeHtml(
        name
      )}" data-tooltip="${escapeHtml(name)}">
        <span class="tree-badge">${escapeHtml(type)}</span>
        <span>${effectiveHasQuery ? highlightText(name, queryLower) : escapeHtml(name)}</span>
      </summary>
      ${body}
    </details>
  `;
}

function bindTreeLeafClicks(container, parsed, onFormulaClick) {
  container.__treeLeafParsed = parsed;
  container.__treeLeafClickHandler = onFormulaClick;

  if (container.__treeLeafClicksBound) return;
  container.__treeLeafClicksBound = true;

  const triggerLeaf = (el) => {
    if (!el) return;
    const key = el.dataset?.key;
    if (!key) return;
    const formula = container.__treeLeafParsed?.formulasByKey?.[key];
    if (!formula) return;
    container.__treeLeafClickHandler?.(formula);
  };

  container.addEventListener("click", (event) => {
    const leaf = event?.target?.closest?.("[data-tree-leaf='true']");
    if (!leaf || !container.contains(leaf)) return;
    triggerLeaf(leaf);
  });

  container.addEventListener("keydown", (event) => {
    const leaf = event?.target?.closest?.("[data-tree-leaf='true']");
    if (!leaf || !container.contains(leaf)) return;
    if (leaf.tagName === "BUTTON") return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    triggerLeaf(leaf);
  });
}

function getExpandedSetSignature(expandedDetailsSet) {
  if (!expandedDetailsSet || typeof expandedDetailsSet.size !== "number") return "none";
  let hash = 0;
  for (const value of expandedDetailsSet) {
    const s = String(value);
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) | 0;
    }
  }
  return `${expandedDetailsSet.size}:${hash}`;
}

export function updateTreeSelection(container, selectedKey) {
  if (!container) return;
  const rawKey = selectedKey ? String(selectedKey) : "";
  const selected = container.querySelector(".tree-leaf.is-selected");
  if (selected && selected.dataset?.key !== rawKey) {
    selected.classList.remove("is-selected");
    selected.removeAttribute("aria-current");
  }
  if (!rawKey) return;
  const escapedKey =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(rawKey)
      : rawKey.replace(/["\\]/g, "\\$&");
  const next = container.querySelector(`[data-tree-leaf='true'][data-key="${escapedKey}"]`);
  if (!next) return;
  if (!next.classList.contains("is-selected")) {
    next.classList.add("is-selected");
    next.setAttribute("aria-current", "true");
  }
}

function groupBy(items, getKey) {
  const grouped = {};
  for (const item of items || []) {
    const key = getKey(item);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return grouped;
}

/**
 * Collect all <details> node IDs that this pane's tree can render.
 *
 * This is used by "Expand all" / "Collapse all" to update the preserved
 * expansion state set (`state.treeExpandedDetailsByPane[pane]`) deterministically
 * across rerenders.
 */
export function collectAllTreeDetailsNodeIds(parsed) {
  const out = new Set();
  if (!parsed) return out;

  const rawControls = Array.isArray(parsed.raw?.controls) ? parsed.raw.controls : null;

  // Best-practice schema: render a hierarchy from raw.controls (parentId).
  if (rawControls?.length) {
    const controlsByFile = groupBy(rawControls, (c) => c.fileName || c.screen || "Unknown");
    for (const fileName of Object.keys(controlsByFile)) {
      out.add(fileNodeId(fileName));
      for (const control of controlsByFile[fileName] || []) {
        out.add(hierarchyControlNodeId(fileName, control));
      }
    }
    return out;
  }

  // Fallback schema: explorer tree derived from parsed.files[].formulas.
  const files = Array.isArray(parsed.files) ? parsed.files : [];
  for (const file of files) {
    const fileName = file?.fileName || "Unknown file";
    out.add(fileNodeId(fileName));

    const formulas = Array.isArray(file?.formulas) ? file.formulas : [];
    const byControl = groupBy(formulas, (f) => f?.control || "UnknownControl");
    for (const controlName of Object.keys(byControl)) {
      out.add(explorerControlNodeId(fileName, controlName));
    }
  }

  return out;
}

