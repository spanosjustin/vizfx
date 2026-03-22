import { escapeHtml } from "./utils.js";
import { buildLogicFlow } from "./logic-flow-model.js";

const POPOUT_RAIL_CHEVRON_A =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" focusable="false" aria-hidden="true"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06L7.28 12.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/></svg>';
const POPOUT_RAIL_CHEVRON_B =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" focusable="false" aria-hidden="true"><path d="M9.78 3.22a.75.75 0 0 0-1.06 0L4.47 7.47a.75.75 0 0 0 0 1.06l4.25 4.25a.75.75 0 0 0 1.06-1.06L6.06 8l3.72-3.72a.75.75 0 0 0 0-1.06z"/></svg>';
const POPOUT_SWAP_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" focusable="false" aria-hidden="true"><path d="M2.5 6h7.09L8.22 4.63l1.06-1.06L12.56 7l-3.28 3.43-1.06-1.06L9.59 7H2.5a.75.75 0 0 1 0-1.5zm11 4H6.41l1.37 1.37-1.06 1.06L3.44 9l3.28-3.43 1.06 1.06L6.41 9h7.09a.75.75 0 0 1 0 1.5z"/></svg>';

/** Export-style icon (matches `exportViewBtn`) — only on the disabled control inside the Logic Flow popup. */
const LOGIC_FLOW_EXPORT_ICON_IN_POPUP_SVG = `<svg class="logic-flow-toolbar-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <path d="M8.75 1.5a.75.75 0 0 0-1.5 0v6.19L5.53 5.97a.75.75 0 1 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l3-3a.75.75 0 0 0-1.06-1.06L8.75 7.69V1.5zM2 10.75A.75.75 0 0 1 2.75 10h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75zm1.75 2.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5z"></path>
</svg>`;

/** Same paths as export toolbar icon; sized for the popout FAB. */
const LOGIC_POPOUT_EXPORT_FAB_ICON_SVG = `<svg class="logic-flow-toolbar-icon logic-popout-export-fab__svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <path d="M8.75 1.5a.75.75 0 0 0-1.5 0v6.19L5.53 5.97a.75.75 0 1 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l3-3a.75.75 0 0 0-1.06-1.06L8.75 7.69V1.5zM2 10.75A.75.75 0 0 1 2.75 10h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75zm1.75 2.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5z"></path>
</svg>`;

function buildLogicPopoutPaneHeader(version, toggleId, pathText) {
  const title = version === "B" ? "Version B" : "Version A";
  const label = version === "B" ? "B" : "A";
  const railSvg = version === "B" ? POPOUT_RAIL_CHEVRON_B : POPOUT_RAIL_CHEVRON_A;
  const safePath = escapeHtml(pathText || "");
  return `
    <div class="graph-pane-header">
      <div class="graph-pane-title">${escapeHtml(title)}</div>
      <div class="graph-pane-path">${safePath}</div>
      <button
        type="button"
        id="${escapeHtml(toggleId)}"
        class="graph-pane-collapse-btn"
        aria-expanded="true"
      >
        <span class="graph-pane-collapse-btn__icon graph-pane-collapse-btn__icon--rail" aria-hidden="true">${railSvg}</span>
        <span class="graph-pane-collapse-btn__icon graph-pane-collapse-btn__icon--swap" aria-hidden="true">${POPOUT_SWAP_ICON}</span>
        <span class="graph-pane-collapse-btn__label">Hide</span>
      </button>
      <span class="graph-pane-rail-label" aria-hidden="true">${escapeHtml(label)}</span>
    </div>
  `;
}

function buildLogicPopoutSplitMarkup(flowA, flowB, pathA, pathB) {
  const bodyA = flowA || `<div class="logic-empty-state">Version A has no Logic Flow to display.</div>`;
  const bodyB = flowB || `<div class="logic-empty-state">Version B has no Logic Flow to display.</div>`;
  return `
    <div class="logic-popout-split-layout" data-logic-popout-split role="group" aria-label="Split Logic Flow expanded view">
      <section id="logicPopoutPaneA" class="logic-popout-split-pane graph-pane is-active" data-popout-version="A">
        ${buildLogicPopoutPaneHeader("A", "logicPopoutToggleA", pathA)}
        <div class="logic-popout-pane-body graph-container">${bodyA}</div>
      </section>
      <section id="logicPopoutPaneB" class="logic-popout-split-pane graph-pane is-active" data-popout-version="B">
        ${buildLogicPopoutPaneHeader("B", "logicPopoutToggleB", pathB)}
        <div class="logic-popout-pane-body graph-container">${bodyB}</div>
      </section>
    </div>
  `;
}

function attachLogicPopoutSplitCollapse(host, options) {
  const layout = host.querySelector("[data-logic-popout-split]");
  if (!layout) return;

  const getCollapse =
    typeof options?.getLogicPopoutPaneCollapse === "function" ? options.getLogicPopoutPaneCollapse : null;
  const init = getCollapse?.() || {};
  let collapsedA = init.A === true;
  let collapsedB = init.B === true;

  if (!getCollapse && (options?.activeVersion === "A" || options?.activeVersion === "B")) {
    collapsedA = options.activeVersion === "B";
    collapsedB = options.activeVersion === "A";
  }

  if (collapsedA && collapsedB) {
    collapsedB = false;
  }

  const paneA = layout.querySelector("#logicPopoutPaneA");
  const paneB = layout.querySelector("#logicPopoutPaneB");
  const btnA = layout.querySelector("#logicPopoutToggleA");
  const btnB = layout.querySelector("#logicPopoutToggleB");

  function swapSides() {
    if (collapsedA && !collapsedB) {
      collapsedA = false;
      collapsedB = true;
    } else if (collapsedB && !collapsedA) {
      collapsedB = false;
      collapsedA = true;
    }
  }

  function refreshUi() {
    layout.classList.toggle("logic-pane-a-collapsed", collapsedA);
    layout.classList.toggle("logic-pane-b-collapsed", collapsedB);
    paneA?.classList.toggle("is-collapsed-logic", collapsedA);
    paneB?.classList.toggle("is-collapsed-logic", collapsedB);

    if (btnA) {
      btnA.setAttribute("aria-expanded", collapsedA ? "false" : "true");
      const swapMode = collapsedB && !collapsedA;
      const labelA = collapsedA
        ? "Expand Version A pane"
        : swapMode
          ? "Swap: collapse Version A to rail and show Version B full width"
          : "Collapse Version A pane";
      btnA.setAttribute("aria-label", labelA);
      btnA.title = collapsedA ? "Expand Version A" : swapMode ? "Swap which version is full width" : "Collapse Version A";
    }
    if (btnB) {
      btnB.setAttribute("aria-expanded", collapsedB ? "false" : "true");
      const swapMode = collapsedA && !collapsedB;
      const labelB = collapsedB
        ? "Expand Version B pane"
        : swapMode
          ? "Swap: collapse Version B to rail and show Version A full width"
          : "Collapse Version B pane";
      btnB.setAttribute("aria-label", labelB);
      btnB.title = collapsedB ? "Expand Version B" : swapMode ? "Swap which version is full width" : "Collapse Version B";
    }
    syncLogicPopoutExportFabVisibility(host.closest("dialog"));
  }

  function onToggleA() {
    if (collapsedB && !collapsedA) {
      swapSides();
    } else {
      collapsedA = !collapsedA;
      if (collapsedA && collapsedB) collapsedB = false;
    }
    refreshUi();
  }

  function onToggleB() {
    if (collapsedA && !collapsedB) {
      swapSides();
    } else {
      collapsedB = !collapsedB;
      if (collapsedB && collapsedA) collapsedA = false;
    }
    refreshUi();
  }

  btnA?.addEventListener("click", onToggleA);
  btnB?.addEventListener("click", onToggleB);
  refreshUi();
}

const NODE_WIDTH = 210;
const NODE_HEIGHT = 68;
const LAYER_GAP_Y = 110;
const NODE_GAP_X = 48;
const PADDING_X = 24;
const PADDING_Y = 20;
const LOGIC_VIEWPORT_MIN_SCALE = 0.05;
const LOGIC_VIEWPORT_MAX_SCALE = 2.5;
const LOGIC_ZOOM_SENSITIVITY = 0.00105;
const LOGIC_PAN_DRAG_THRESHOLD_PX = 3;
const LOGIC_PAN_SUPPRESS_CLICK_MS = 220;
const LOGIC_CANVAS_MIN_HEIGHT = 180;
const LOGIC_CANVAS_MAX_HEIGHT = 460;

export function renderLogicFlow(container, formulaInput, options = {}) {
  if (!container) return;

  const ctx = normalizeLogicRenderInput(formulaInput);

  if (ctx.state === "none") {
    container.innerHTML = renderLogicEmptyState(ctx, options);
    attachLogicEmptyStateInteractions(container, ctx, options);
    return;
  }
  if (ctx.state === "nonFormula") {
    container.innerHTML = renderLogicEmptyState(ctx, options);
    attachLogicEmptyStateInteractions(container, ctx, options);
    return;
  }

  try {
    const graph = buildLogicFlow(ctx.formula.formula);
    const svgMarkup = renderFlowSvg(graph);
    const simplified = graph.meta?.fallback || graph.meta?.confidence === "low";
    const simplifiedTooltip =
      "Best-effort parse only; this flow may omit nested or unsupported syntax.";

    container.innerHTML = `
      <div class="logic-flow">
        <div class="logic-flow-meta">
          <div class="logic-flow-title">${escapeHtml(ctx.formula.control || "Unknown")}.${escapeHtml(
            ctx.formula.property || "Unknown"
          )}</div>
          <div class="logic-flow-subtitle">${escapeHtml(ctx.formula.fileName || "Unknown file")}</div>
          <div class="logic-flow-legend" role="note" aria-label="Logic Flow legend">
            <div class="logic-flow-legend-group">
              <span class="logic-flow-legend-label">Nodes</span>
              <span class="logic-flow-legend-item">
                <span class="logic-flow-legend-swatch logic-flow-legend-swatch--start-end" aria-hidden="true"></span>
                Start/End
              </span>
              <span class="logic-flow-legend-item">
                <span class="logic-flow-legend-swatch logic-flow-legend-swatch--decision" aria-hidden="true"></span>
                Decision
              </span>
              <span class="logic-flow-legend-item">
                <span class="logic-flow-legend-swatch logic-flow-legend-swatch--action" aria-hidden="true"></span>
                Action
              </span>
            </div>
            <div class="logic-flow-legend-group">
              <span class="logic-flow-legend-label">Branches</span>
              <span class="logic-flow-legend-item">
                <span class="logic-flow-legend-line logic-flow-legend-line--yes" aria-hidden="true"></span>
                Yes/True
              </span>
              <span class="logic-flow-legend-item">
                <span class="logic-flow-legend-line logic-flow-legend-line--no" aria-hidden="true"></span>
                No/False
              </span>
              <span class="logic-flow-legend-item">
                <span class="logic-flow-legend-line logic-flow-legend-line--case" aria-hidden="true"></span>
                Case
              </span>
              <span class="logic-flow-legend-item">
                <span class="logic-flow-legend-line logic-flow-legend-line--default" aria-hidden="true"></span>
                Default
              </span>
            </div>
          </div>
        </div>
        <div class="logic-flow-toolbar" role="toolbar" aria-label="Logic Flow controls">
          <button type="button" class="logic-flow-toolbar-btn" data-action="logic-zoom-in" aria-label="Zoom in Logic Flow">+</button>
          <button type="button" class="logic-flow-toolbar-btn" data-action="logic-zoom-out" aria-label="Zoom out Logic Flow">-</button>
          <span class="logic-flow-toolbar-spacer" aria-hidden="true"></span>
          <button type="button" class="logic-flow-toolbar-btn" data-action="logic-selected" aria-label="Zoom to selected Logic Flow node">Selected</button>
          <button type="button" class="logic-flow-toolbar-btn" data-action="logic-center" aria-label="Center Logic Flow view">Center</button>
          <button type="button" class="logic-flow-toolbar-btn" data-action="logic-fit" aria-label="Fit Logic Flow to view">Fit</button>
          <button type="button" class="logic-flow-toolbar-btn logic-flow-toolbar-btn--icon logic-flow-toolbar-btn--popout" data-action="logic-popout" aria-label="Expand Logic Flow" title="Expand Logic Flow">
            <svg class="logic-flow-toolbar-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M2 6.25A2.25 2.25 0 0 1 4.25 4h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 1 1.5 0v2.5A2.25 2.25 0 0 1 9.75 14h-5.5A2.25 2.25 0 0 1 2 11.75v-5.5z"></path>
              <path d="M9.25 2A.75.75 0 0 0 9.25 3.5h2.69L7.47 7.97a.75.75 0 1 0 1.06 1.06L13 4.56v2.69a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 13.75 2h-4.5z"></path>
            </svg>
          </button>
        </div>
        <div class="logic-flow-canvas">
          ${svgMarkup}
        </div>
        <div class="logic-flow-parser-meta">
          ${
            simplified
              ? `<span class="logic-flow-simplified-indicator" title="${escapeHtml(
                  simplifiedTooltip
                )}" aria-label="${escapeHtml(simplifiedTooltip)}">Simplified view</span>`
              : ""
          }
          <span class="logic-flow-meta-chip">Confidence: ${escapeHtml(graph.meta?.confidence || "low")}</span>
          ${graph.meta?.fallback ? `<span class="logic-flow-meta-chip">Fallback</span>` : ""}
        </div>
        ${
          Array.isArray(graph.meta?.notes) && graph.meta.notes.length
            ? `<ul class="logic-flow-parser-notes">${graph.meta.notes
                .map((note) => `<li>${escapeHtml(String(note || ""))}</li>`)
                .join("")}</ul>`
            : ""
        }
      </div>
    `;
    attachLogicInteractions(container, graph, ctx.formula, options);
    attachLogicViewportInteractions(container, options, ctx.formula, graph);
  } catch {
    container.innerHTML = `
      <div class="logic-flow">
        <div class="logic-empty-state">
          Logic Flow could not be fully rendered. Showing safe fallback view.
        </div>
        <div class="logic-flow-parser-meta">
          <span class="logic-flow-simplified-indicator" title="Fallback due to rendering error.">Simplified view</span>
          <span class="logic-flow-meta-chip">Confidence: low</span>
          <span class="logic-flow-meta-chip">Fallback</span>
        </div>
      </div>
    `;
  }
}

function renderLogicEmptyState(ctx, options) {
  const isMissing = ctx.reason === "missingInVersionA" || ctx.reason === "missingInVersionB";
  const showNearestMatchBtn = isMissing;
  return `
    <div class="logic-empty-state-wrap">
      <div class="logic-empty-state">${escapeHtml(emptyStateMessageForContext(ctx))}</div>
      ${
        showNearestMatchBtn
          ? `<button type="button" class="logic-flow-toolbar-btn" data-action="logic-view-nearest-match" aria-label="View nearest match in this version">View nearest match in this version</button>`
          : ""
      }
    </div>
  `;
}

export function attachLogicEmptyStateInteractions(container, ctx, options) {
  const onViewNearestMatch =
    typeof options?.onViewNearestMatch === "function" ? options.onViewNearestMatch : null;
  if (!onViewNearestMatch || !container) return;
  if (ctx.reason !== "missingInVersionA" && ctx.reason !== "missingInVersionB") return;
  const btn = container.querySelector("[data-action='logic-view-nearest-match']");
  if (!btn) return;
  btn.addEventListener("click", () => onViewNearestMatch(ctx));
}

function normalizeLogicRenderInput(input) {
  if (!input) return { state: "none" };
  if (input.state === "none" || input.state === "nonFormula" || input.state === "formula") return input;
  if (typeof input.formula === "string") return { state: "formula", formula: input };
  return { state: "none" };
}

function renderFlowSvg(graph) {
  if (!graph?.nodes?.length || !graph?.edges?.length) {
    return `<div class="logic-empty-state">No flow steps were generated.</div>`;
  }

  const positioned = layoutGraph(graph);
  const edgeMarkup = graph.edges
    .map((edge) => renderEdge(edge, positioned.nodeById))
    .filter(Boolean)
    .join("");

  const nodeMarkup = positioned.nodes
    .map((node) => {
      const p = positioned.nodeById.get(node.id);
      if (!p) return "";
      const x = p.x;
      const y = p.y;
      const nodeAriaLabel = node.hideLabel
        ? `Logic node ${escapeHtml(node.contextText || node.kind || "step")}`
        : `Logic node ${escapeHtml(node.label)}`;
      return `
        <g class="logic-svg-node logic-svg-node--${escapeHtml(node.kind)}" data-node-id="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="${nodeAriaLabel}">
          <title>${escapeHtml(node.contextText || node.label || "Logic step")}</title>
          <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="10"></rect>
          <text x="${x + 12}" y="${y + 21}" class="logic-svg-node-kind">${escapeHtml(node.kind)}</text>
          ${node.hideLabel ? "" : renderSvgWrappedText(x + 12, y + 40, node.label)}
        </g>
      `;
    })
    .join("");

  return `
    <svg class="logic-svg" viewBox="0 0 ${positioned.width} ${positioned.height}" aria-label="Logic flow diagram">
      <defs>
        <marker id="logic-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>
      </defs>
      <g class="logic-svg-viewport">
        <g class="logic-svg-edges">${edgeMarkup}</g>
        <g class="logic-svg-nodes">${nodeMarkup}</g>
      </g>
    </svg>
  `;
}

function emptyStateMessageForContext(ctx) {
  if (ctx.reason === "missingInVersionA") {
    return "This formula exists in Version B but not Version A.";
  }
  if (ctx.reason === "missingInVersionB") {
    return "This formula exists in Version A but not Version B.";
  }
  if (ctx.reason === "noSharedSelection") {
    return "No shared formula is selected. Select a formula from Master FX, tree, or graph to compare in Logic Flow.";
  }
  if (ctx.reason === "inactiveVersion") {
    return `This pane is not the active version. Use the Version A / Version B chips in the toolbar to switch the active version.`;
  }
  if (ctx.reason === "noSelection") {
    return "No item is selected. Select a formula node in the graph, tree, or Master FX list to view Logic Flow steps.";
  }
  if (ctx.reason === "nonFormulaSelection" || ctx.state === "nonFormula") {
    return "The selected item is not a formula. Choose a formula node or a Master FX formula entry to generate Logic Flow.";
  }
  if (ctx.reason === "missingFormulaMap" || ctx.reason === "missingFormulaInMap") {
    return "The selected formula could not be resolved in the parsed formula map. Re-select the formula or reload this version to rebuild mappings.";
  }
  return "Select a formula in the active version to view its Logic Flow.";
}

/** Empty-state copy for Code View (same `ctx` shape as Logic Flow / `selectedLogicContextForPane`). */
export function emptyStateMessageForCodeView(ctx) {
  if (ctx.reason === "noVersionLoadedA") {
    return "Load a JSON file for Version A to view formula code.";
  }
  if (ctx.reason === "noVersionLoadedB") {
    return "Load a JSON file for Version B to view formula code.";
  }
  if (ctx.reason === "missingInVersionA") {
    return "This formula exists in Version B but not Version A.";
  }
  if (ctx.reason === "missingInVersionB") {
    return "This formula exists in Version A but not Version B.";
  }
  if (ctx.reason === "noSharedSelection") {
    return "No shared formula is selected. Select a formula from Master FX, tree, or graph to compare formula code.";
  }
  if (ctx.reason === "inactiveVersion") {
    return `This pane is not the active version. Use the Version A / Version B chips in the toolbar to switch the active version.`;
  }
  if (ctx.reason === "noSelection") {
    return "No item is selected. Select a formula node in the graph, tree, or Master FX list to view its Power Fx formula.";
  }
  if (ctx.reason === "nonFormulaSelection" || ctx.state === "nonFormula") {
    return "The selected item is not a formula. Choose a formula node or a Master FX formula entry to view formula code.";
  }
  if (ctx.reason === "missingFormulaMap" || ctx.reason === "missingFormulaInMap") {
    return "The selected formula could not be resolved in the parsed formula map. Re-select the formula or reload this version to rebuild mappings.";
  }
  if (ctx.reason === "noFormulasInScope") {
    return "No formulas match the current screen scope. Choose All or another screen above.";
  }
  return "Select a formula in the active version to view its Power Fx formula.";
}

function layoutGraph(graph) {
  const nodeById = new Map();
  const incomingCount = new Map();
  const outgoing = new Map();
  for (const node of graph.nodes) {
    nodeById.set(node.id, node);
    incomingCount.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    outgoing.get(edge.from).push(edge.to);
    incomingCount.set(edge.to, (incomingCount.get(edge.to) || 0) + 1);
  }

  const start = graph.nodes.find((n) => n.kind === "start")?.id || graph.nodes[0].id;
  const layerById = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    const layer = layerById.get(id) || 0;
    for (const next of outgoing.get(id) || []) {
      const nextLayer = layer + 1;
      if (!layerById.has(next) || nextLayer > layerById.get(next)) {
        layerById.set(next, nextLayer);
        queue.push(next);
      }
    }
  }
  for (const node of graph.nodes) {
    if (!layerById.has(node.id)) layerById.set(node.id, 0);
  }

  const ordered = [...graph.nodes].sort((a, b) => {
    const la = layerById.get(a.id) || 0;
    const lb = layerById.get(b.id) || 0;
    if (la !== lb) return la - lb;
    const ia = incomingCount.get(a.id) || 0;
    const ib = incomingCount.get(b.id) || 0;
    if (ia !== ib) return ia - ib;
    return a.id.localeCompare(b.id);
  });

  const layers = new Map();
  for (const node of ordered) {
    const layer = layerById.get(node.id) || 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer).push(node.id);
  }

  const maxLayerWidth = Math.max(...[...layers.values()].map((ids) => ids.length), 1);
  const width =
    PADDING_X * 2 + maxLayerWidth * NODE_WIDTH + Math.max(0, maxLayerWidth - 1) * NODE_GAP_X;
  const height = PADDING_Y * 2 + layers.size * NODE_HEIGHT + Math.max(0, layers.size - 1) * LAYER_GAP_Y;

  for (const [layer, ids] of layers.entries()) {
    const layerContentWidth = ids.length * NODE_WIDTH + Math.max(0, ids.length - 1) * NODE_GAP_X;
    const startX = Math.round((width - layerContentWidth) / 2);
    const y = PADDING_Y + layer * (NODE_HEIGHT + LAYER_GAP_Y);
    ids.forEach((id, idx) => {
      const x = startX + idx * (NODE_WIDTH + NODE_GAP_X);
      nodeById.set(id, { ...nodeById.get(id), x, y });
    });
  }

  return { nodes: graph.nodes, nodeById, width, height };
}

function renderEdge(edge, nodeById) {
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  if (!from || !to || from.x == null || to.x == null) return "";

  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y + NODE_HEIGHT;
  const x2 = to.x + NODE_WIDTH / 2;
  const y2 = to.y;
  const midY = Math.round((y1 + y2) / 2);
  const pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  const branchClass = classifyBranchLabel(edge.label);

  const labelMarkup = edge.label
    ? `<text x="${Math.round((x1 + x2) / 2)}" y="${midY - 6}" class="logic-svg-edge-label">${escapeHtml(
        edge.label
      )}</text>`
    : "";

  return `<g class="logic-svg-edge logic-svg-edge--${branchClass}" data-from-id="${escapeHtml(
    edge.from
  )}" data-to-id="${escapeHtml(edge.to)}"><path d="${pathD}"></path>${labelMarkup}</g>`;
}

function classifyBranchLabel(label) {
  const value = String(label || "").trim().toLowerCase();
  if (!value) return "neutral";
  if (value === "yes" || value === "true") return "yes";
  if (value === "no" || value === "false") return "no";
  if (value.startsWith("case")) return "case";
  if (value === "default" || value.startsWith("default ")) return "default";
  return "neutral";
}

function renderSvgWrappedText(x, y, text) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return `<text x="${x}" y="${y}" class="logic-svg-node-label">Step</text>`;

  const lines = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > 28) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  const visibleLines = lines.slice(0, 2);
  const needsEllipsis = lines.length > 2;
  if (needsEllipsis) {
    visibleLines[1] = `${visibleLines[1].slice(0, Math.max(0, visibleLines[1].length - 1))}...`;
  }

  return `<text x="${x}" y="${y}" class="logic-svg-node-label">${visibleLines
    .map((line, idx) => `<tspan x="${x}" dy="${idx === 0 ? 0 : 14}">${escapeHtml(line)}</tspan>`)
    .join("")}</text>`;
}

function attachLogicInteractions(container, graph, formula, options) {
  const onNodeContext = typeof options?.onNodeContext === "function" ? options.onNodeContext : null;
  const viewportState = options?.viewportState && typeof options.viewportState === "object" ? options.viewportState : null;
  if (!container || !graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const incidentByNodeId = new Map();
  for (const edge of graph.edges || []) {
    if (!incidentByNodeId.has(edge.from)) incidentByNodeId.set(edge.from, new Set());
    if (!incidentByNodeId.has(edge.to)) incidentByNodeId.set(edge.to, new Set());
    incidentByNodeId.get(edge.from).add(`${edge.from}::${edge.to}`);
    incidentByNodeId.get(edge.to).add(`${edge.from}::${edge.to}`);
  }

  const nodeEls = Array.from(container.querySelectorAll(".logic-svg-node[data-node-id]"));
  const edgeEls = Array.from(container.querySelectorAll(".logic-svg-edge[data-from-id][data-to-id]"));

  const clearFocus = () => {
    for (const n of nodeEls) n.classList.remove("is-dimmed", "is-hovered");
    for (const e of edgeEls) e.classList.remove("is-dimmed", "is-hovered");
  };

  const applyFocus = (nodeId) => {
    const keepEdgeKeys = incidentByNodeId.get(nodeId) || new Set();
    const keepNodeIds = new Set([nodeId]);
    for (const edgeKey of keepEdgeKeys) {
      const [fromId, toId] = edgeKey.split("::");
      if (fromId) keepNodeIds.add(fromId);
      if (toId) keepNodeIds.add(toId);
    }
    for (const n of nodeEls) {
      const id = n.dataset.nodeId;
      if (id === nodeId) n.classList.add("is-hovered");
      else if (keepNodeIds.has(id)) n.classList.add("is-path");
      else n.classList.add("is-dimmed");
    }
    for (const e of edgeEls) {
      const key = `${e.dataset.fromId}::${e.dataset.toId}`;
      if (keepEdgeKeys.has(key)) e.classList.add("is-hovered");
      else e.classList.add("is-dimmed");
    }
  };

  for (const nodeEl of nodeEls) {
    const nodeId = nodeEl.dataset.nodeId;
    if (!nodeId) continue;

    const activate = () => {
      if (viewportState && Date.now() < (viewportState.suppressClickUntil || 0)) return;
      const node = nodeMap.get(nodeId);
      if (!node || !onNodeContext) return; // Safe no-op if mapping callback unavailable.
      for (const n of nodeEls) n.classList.remove("is-selected");
      nodeEl.classList.add("is-selected");
      if (viewportState) viewportState.selectedNodeId = nodeId;
      onNodeContext({
        node,
        formula,
        contextText: node.contextText || "",
      });
    };

    nodeEl.addEventListener("pointerenter", () => {
      clearFocus();
      applyFocus(nodeId);
    });
    nodeEl.addEventListener("pointerleave", clearFocus);
    nodeEl.addEventListener("focus", () => {
      clearFocus();
      applyFocus(nodeId);
    });
    nodeEl.addEventListener("blur", clearFocus);
    nodeEl.addEventListener("click", activate);
    nodeEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    });
  }
}

function attachLogicViewportInteractions(container, options, formula, graph) {
  if (!container) return;
  if (typeof container.__logicViewportCleanup === "function") {
    try {
      container.__logicViewportCleanup();
    } catch {
      // Ignore cleanup failures.
    }
  }
  const logicFlow = container.querySelector(".logic-flow");
  const canvas = container.querySelector(".logic-flow-canvas");
  const svg = container.querySelector(".logic-svg");
  const viewport = svg?.querySelector(".logic-svg-viewport");
  if (!logicFlow || !canvas || !svg || !viewport) return;
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute(
    "aria-label",
    "Logic Flow canvas. Use mouse wheel or plus/minus to zoom, drag to pan, F to fit, S for selected, C to center."
  );

  const state = ensureLogicViewportState(options, formula);
  const resizeCanvasToAvailableSpace = () => {
    const containerHeight = container.clientHeight || 0;
    if (!containerHeight) return;

    const flowStyles = window.getComputedStyle(logicFlow);
    const flowPadTop = Number.parseFloat(flowStyles.paddingTop || "0") || 0;
    const flowPadBottom = Number.parseFloat(flowStyles.paddingBottom || "0") || 0;
    const flowGap = Number.parseFloat(flowStyles.rowGap || flowStyles.gap || "0") || 0;

    const flowChildren = Array.from(logicFlow.children);
    const nonCanvasChildren = flowChildren.filter((el) => !el.classList.contains("logic-flow-canvas"));
    const nonCanvasHeight = nonCanvasChildren.reduce((acc, el) => acc + el.getBoundingClientRect().height, 0);
    const gapCount = Math.max(0, flowChildren.length - 1);
    const available = containerHeight - flowPadTop - flowPadBottom - nonCanvasHeight - gapCount * flowGap - 8;
    const isPopout = Boolean(container.closest(".logic-popout-host"));
    const maxHeight = isPopout ? Math.max(LOGIC_CANVAS_MIN_HEIGHT, available) : LOGIC_CANVAS_MAX_HEIGHT;
    const minHeight = isPopout ? 260 : LOGIC_CANVAS_MIN_HEIGHT;
    const height = clamp(available, minHeight, maxHeight);
    canvas.style.height = `${Math.round(height)}px`;
  };

  const applyTransform = () => {
    viewport.setAttribute("transform", `translate(${state.tx} ${state.ty}) scale(${state.scale})`);
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const clientToSvgPoint = (clientX, clientY) => {
    const ctm = svg?.getScreenCTM?.();
    if (!ctm) return { x: clientX, y: clientY };
    const inv = ctm.inverse();
    const pt = typeof svg.createSVGPoint === "function" ? svg.createSVGPoint() : new DOMPoint(clientX, clientY);
    pt.x = clientX;
    pt.y = clientY;
    const res = pt.matrixTransform(inv);
    return { x: res.x, y: res.y };
  };

  const fitViewport = () => {
    // Keep fit aligned with the baseline full-diagram framing users expect.
    // This avoids over-zooming caused by aggressive bbox-derived scaling.
    resetViewport();
  };

  const resetViewport = () => {
    state.scale = 1;
    state.tx = 0;
    state.ty = 0;
    applyTransform();
  };
  const centerViewport = () => {
    const bounds = measureViewportBounds(viewport);
    if (!bounds || !bounds.width || !bounds.height) return;
    const rect = canvas.getBoundingClientRect();
    const centerClient = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const targetSvgPoint = clientToSvgPoint(centerClient.x, centerClient.y);
    const boundsCenterX = bounds.x + bounds.width / 2;
    const boundsCenterY = bounds.y + bounds.height / 2;
    state.tx = targetSvgPoint.x - boundsCenterX * state.scale;
    state.ty = targetSvgPoint.y - boundsCenterY * state.scale;
    applyTransform();
  };
  const focusSelectedNode = () => {
    const selectedId = state.selectedNodeId || "";
    const selectedEl =
      (selectedId && container.querySelector(`.logic-svg-node[data-node-id="${selectedId}"]`)) ||
      container.querySelector(".logic-svg-node.is-selected");
    if (!selectedEl) {
      centerViewport();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const centerClient = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const targetSvgPoint = clientToSvgPoint(centerClient.x, centerClient.y);
    const nodeRect = selectedEl.querySelector("rect");
    const x = Number.parseFloat(nodeRect?.getAttribute("x") || "0");
    const y = Number.parseFloat(nodeRect?.getAttribute("y") || "0");
    const w = Number.parseFloat(nodeRect?.getAttribute("width") || String(NODE_WIDTH));
    const h = Number.parseFloat(nodeRect?.getAttribute("height") || String(NODE_HEIGHT));
    const nextScale = clamp(Math.max(state.scale, 1.35), LOGIC_VIEWPORT_MIN_SCALE, LOGIC_VIEWPORT_MAX_SCALE);
    const nodeCenterX = x + w / 2;
    const nodeCenterY = y + h / 2;
    state.scale = nextScale;
    state.tx = targetSvgPoint.x - nodeCenterX * state.scale;
    state.ty = targetSvgPoint.y - nodeCenterY * state.scale;
    applyTransform();
  };

  resizeCanvasToAvailableSpace();
  applyTransform();
  if (state.shouldFitOnRender) {
    fitViewport();
    state.shouldFitOnRender = false;
  }
  const onWindowResize = () => {
    resizeCanvasToAvailableSpace();
    if (state.shouldFitOnRender) fitViewport();
  };
  window.addEventListener("resize", onWindowResize);

  let observer = null;
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(() => {
      resizeCanvasToAvailableSpace();
    });
    observer.observe(container);
  }

  container.__logicViewportCleanup = () => {
    window.removeEventListener("resize", onWindowResize);
    observer?.disconnect?.();
  };

  let wheelRafPending = false;
  let wheelLastArgs = null;
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!event.cancelable) return;
      event.preventDefault();
      event.stopPropagation();
      wheelLastArgs = { clientX: event.clientX, clientY: event.clientY, deltaY: event.deltaY };
      if (wheelRafPending) return;
      wheelRafPending = true;
      requestAnimationFrame(() => {
        wheelRafPending = false;
        const args = wheelLastArgs;
        if (!args) return;
        // Trackpads can emit dense wheel streams; a gentler factor reduces jumpiness.
        const factor = Math.exp(-args.deltaY * LOGIC_ZOOM_SENSITIVITY);
        const nextScale = clamp(state.scale * factor, LOGIC_VIEWPORT_MIN_SCALE, LOGIC_VIEWPORT_MAX_SCALE);
        const pSvg = clientToSvgPoint(args.clientX, args.clientY);
        const localX = (pSvg.x - state.tx) / state.scale;
        const localY = (pSvg.y - state.ty) / state.scale;
        state.scale = nextScale;
        state.tx = pSvg.x - nextScale * localX;
        state.ty = pSvg.y - nextScale * localY;
        applyTransform();
      });
    },
    { passive: false }
  );

  const setPanningCursor = (panning) => canvas.classList.toggle("is-logic-panning", panning);
  let isPanning = false;
  let activePointerId = null;
  let startSvgPoint = null;
  let startTx = 0;
  let startTy = 0;
  let didDrag = false;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target?.closest?.(".logic-svg-node")) return;
    if (!event.cancelable) return;
    event.preventDefault();
    event.stopPropagation();
    isPanning = true;
    activePointerId = event.pointerId;
    didDrag = false;
    startSvgPoint = clientToSvgPoint(event.clientX, event.clientY);
    startTx = state.tx;
    startTy = state.ty;
    setPanningCursor(true);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Ignore.
    }
  });

  const finishPan = (event) => {
    if (!isPanning) return;
    if (activePointerId == null || event.pointerId !== activePointerId) return;
    isPanning = false;
    activePointerId = null;
    startSvgPoint = null;
    setPanningCursor(false);
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore.
    }
    if (didDrag) state.suppressClickUntil = Date.now() + LOGIC_PAN_SUPPRESS_CLICK_MS;
  };

  canvas.addEventListener("pointermove", (event) => {
    if (!isPanning) return;
    if (activePointerId == null || event.pointerId !== activePointerId) return;
    const curr = clientToSvgPoint(event.clientX, event.clientY);
    const dx = curr.x - startSvgPoint.x;
    const dy = curr.y - startSvgPoint.y;
    if (!didDrag && Math.hypot(dx, dy) > LOGIC_PAN_DRAG_THRESHOLD_PX) didDrag = true;
    state.tx = startTx + dx;
    state.ty = startTy + dy;
    applyTransform();
  });
  canvas.addEventListener("pointerup", finishPan);
  canvas.addEventListener("pointercancel", finishPan);

  const bindControl = (selector, handler) => {
    const btn = container.querySelector(selector);
    if (!btn) return;
    btn.addEventListener("click", handler);
  };
  bindControl("[data-action='logic-fit']", fitViewport);
  bindControl("[data-action='logic-selected']", focusSelectedNode);
  bindControl("[data-action='logic-center']", centerViewport);
  bindControl("[data-action='logic-zoom-in']", () => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const pSvg = clientToSvgPoint(cx, cy);
    const nextScale = clamp(state.scale * 1.2, LOGIC_VIEWPORT_MIN_SCALE, LOGIC_VIEWPORT_MAX_SCALE);
    const localX = (pSvg.x - state.tx) / state.scale;
    const localY = (pSvg.y - state.ty) / state.scale;
    state.scale = nextScale;
    state.tx = pSvg.x - nextScale * localX;
    state.ty = pSvg.y - nextScale * localY;
    applyTransform();
  });
  bindControl("[data-action='logic-zoom-out']", () => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const pSvg = clientToSvgPoint(cx, cy);
    const nextScale = clamp(state.scale / 1.2, LOGIC_VIEWPORT_MIN_SCALE, LOGIC_VIEWPORT_MAX_SCALE);
    const localX = (pSvg.x - state.tx) / state.scale;
    const localY = (pSvg.y - state.ty) / state.scale;
    state.scale = nextScale;
    state.tx = pSvg.x - nextScale * localX;
    state.ty = pSvg.y - nextScale * localY;
    applyTransform();
  });
  bindControl("[data-action='logic-popout']", () => {
    if (!graph) return;
    openLogicFlowPopout(container, graph, formula, options);
  });

  canvas.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (key === "f" || key === "F") {
      event.preventDefault();
      fitViewport();
      return;
    }
    if (key === "c" || key === "C" || key === "0") {
      event.preventDefault();
      centerViewport();
      return;
    }
    if (key === "s" || key === "S") {
      event.preventDefault();
      focusSelectedNode();
      return;
    }
    if (key === "+" || key === "=") {
      event.preventDefault();
      const btn = container.querySelector("[data-action='logic-zoom-in']");
      btn?.click();
      return;
    }
    if (key === "-" || key === "_") {
      event.preventDefault();
      const btn = container.querySelector("[data-action='logic-zoom-out']");
      btn?.click();
      return;
    }
    const panStep = event.shiftKey ? 56 : 32;
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      if (key === "ArrowLeft") state.tx += panStep;
      if (key === "ArrowRight") state.tx -= panStep;
      if (key === "ArrowUp") state.ty += panStep;
      if (key === "ArrowDown") state.ty -= panStep;
      applyTransform();
    }
  });
}

function cleanupLogicPopoutHostViewports(host) {
  if (!host) return;
  for (const el of host.querySelectorAll(".logic-popout-pane-body.graph-container")) {
    if (typeof el.__logicViewportCleanup === "function") {
      try {
        el.__logicViewportCleanup();
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
  if (typeof host.__logicViewportCleanup === "function") {
    try {
      host.__logicViewportCleanup();
    } catch {
      // Ignore cleanup failures.
    }
  }
}

/** Show "Export all" only when split A/B popout has both panes expanded (not collapsed to rail). */
function syncLogicPopoutExportFabVisibility(dialog) {
  const fab = dialog?.querySelector?.("[data-action='logic-popout-export-all']");
  if (!fab) return;
  const host = dialog?.querySelector?.(".logic-popout-host");
  const layout = host?.querySelector?.("[data-logic-popout-split]");
  if (!layout) {
    fab.hidden = true;
    return;
  }
  const collapsedA = layout.classList.contains("logic-pane-a-collapsed");
  const collapsedB = layout.classList.contains("logic-pane-b-collapsed");
  fab.hidden = collapsedA || collapsedB;
}

function buildGraphAndFormulaForLogicAttach(formulaInput) {
  const ctx = normalizeLogicRenderInput(formulaInput);
  if (ctx.state !== "formula" || !ctx.formula) {
    return { graph: null, formula: null };
  }
  try {
    const graph = buildLogicFlow(ctx.formula.formula);
    return { graph, formula: ctx.formula };
  } catch {
    return { graph: null, formula: ctx.formula };
  }
}

/** Wire pan/zoom + node clicks for each pane in split Logic Flow popout (cloned HTML only). */
function attachSplitPopoutLogicInteractions(host, options) {
  const getContexts =
    typeof options?.getSplitPopoutFormulaContexts === "function"
      ? options.getSplitPopoutFormulaContexts
      : null;
  const contexts = getContexts?.() || {};
  const paneSpecs = [
    { version: "A", sectionSel: "#logicPopoutPaneA" },
    { version: "B", sectionSel: "#logicPopoutPaneB" },
  ];
  for (const { version, sectionSel } of paneSpecs) {
    const section = host.querySelector(sectionSel);
    const body = section?.querySelector(".logic-popout-pane-body.graph-container");
    if (!body) continue;
    const { graph, formula } = buildGraphAndFormulaForLogicAttach(contexts[version]);
    const viewportState = {
      scale: 1,
      tx: 0,
      ty: 0,
      suppressClickUntil: 0,
      shouldFitOnRender: true,
    };
    const popoutOptions = { ...options, viewportState };
    attachLogicInteractions(body, graph, formula, popoutOptions);
    attachLogicViewportInteractions(body, popoutOptions, formula, graph);
  }
}

function openLogicFlowPopout(sourceContainer, graph, formula, options) {
  const dialog = ensureLogicPopoutDialog();
  if (!dialog) return;
  const host = dialog.querySelector(".logic-popout-host");
  if (!host) return;

  cleanupLogicPopoutHostViewports(host);

  const getSplitPopoutFlows =
    typeof options?.getSplitPopoutFlows === "function" ? options.getSplitPopoutFlows : null;

  if (getSplitPopoutFlows) {
    const split = getSplitPopoutFlows() || {};
    const flowA = String(split.A || "");
    const flowB = String(split.B || "");
    const getPath =
      typeof options?.getVersionPathText === "function" ? options.getVersionPathText : null;
    const pathA = getPath ? String(getPath("A") || "") : "";
    const pathB = getPath ? String(getPath("B") || "") : "";
    if (flowA || flowB) {
      host.innerHTML = buildLogicPopoutSplitMarkup(flowA, flowB, pathA, pathB);
      attachLogicPopoutSplitCollapse(host, options);
    }
  }

  if (!host.innerHTML.trim()) {
    const sourceFlow = sourceContainer?.querySelector(".logic-flow");
    if (!sourceFlow) return;
    host.innerHTML = sourceFlow.outerHTML;
  }

  host.querySelectorAll("[data-action='logic-popout']").forEach((popoutBtn) => {
    popoutBtn.innerHTML = LOGIC_FLOW_EXPORT_ICON_IN_POPUP_SVG;
    popoutBtn.disabled = true;
    popoutBtn.setAttribute("aria-disabled", "true");
    popoutBtn.setAttribute("title", "Already in popup");
    popoutBtn.setAttribute("aria-label", "Logic Flow already open in popup");
  });

  const titleEl = dialog.querySelector(".logic-popout-title");
  if (titleEl) {
    titleEl.textContent = "Logic Flow - Interactive view";
  }

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "open");
  }

  // Viewport sizing uses host `clientHeight`; that is 0 until the modal is shown and laid out.
  // Defer wiring so pan/zoom, wheel, and node hit-testing work in the popout.
  const attachPopoutInteractions = () => {
    const splitLayout = host.querySelector("[data-logic-popout-split]");
    if (splitLayout) {
      attachSplitPopoutLogicInteractions(host, options);
    } else {
      const viewportState = {
        scale: 1,
        tx: 0,
        ty: 0,
        suppressClickUntil: 0,
        shouldFitOnRender: true,
      };
      const popoutOptions = { ...options, viewportState };
      attachLogicInteractions(host, graph, formula, popoutOptions);
      attachLogicViewportInteractions(host, popoutOptions, formula, graph);
    }
    syncLogicPopoutExportFabVisibility(dialog);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(attachPopoutInteractions);
  });
}

export function slugForLogicFlowExportFilename(text) {
  const raw = String(text || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return raw.slice(0, 72) || "logic-flow";
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** CSS that normally lives under `.logic-flow` in styles.css — required for standalone SVG files. */
const LOGIC_SVG_STANDALONE_STYLES = `
.logic-svg-export-bg { fill: rgb(2, 6, 23); }
.logic-svg-edge path {
  fill: none;
  stroke: rgba(148, 163, 184, 0.72);
  stroke-width: 1.8;
  marker-end: url(#logic-arrowhead);
}
.logic-svg-edge-label {
  fill: rgba(224, 242, 254, 0.98);
  font-size: 12px;
  font-weight: 700;
  paint-order: stroke;
  stroke: rgba(2, 6, 23, 0.9);
  stroke-width: 2.8px;
  stroke-linejoin: round;
  text-anchor: middle;
  letter-spacing: 0.01em;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.logic-svg defs marker path { fill: rgba(148, 163, 184, 0.9); }
.logic-svg-edge--yes path { stroke: rgba(74, 222, 128, 0.86); }
.logic-svg-edge--yes .logic-svg-edge-label { fill: rgba(220, 252, 231, 0.98); }
.logic-svg-edge--no path {
  stroke: rgba(248, 113, 113, 0.84);
  stroke-dasharray: 6 4;
}
.logic-svg-edge--no .logic-svg-edge-label { fill: rgba(254, 226, 226, 0.98); }
.logic-svg-edge--case path { stroke: rgba(56, 189, 248, 0.86); }
.logic-svg-edge--default path {
  stroke: rgba(251, 191, 36, 0.86);
  stroke-dasharray: 2 4;
}
.logic-svg-node rect { stroke-width: 1.2; }
.logic-svg-node--start rect,
.logic-svg-node--end rect {
  fill: rgba(56, 189, 248, 0.1);
  stroke: rgba(56, 189, 248, 0.42);
}
.logic-svg-node--decision rect {
  fill: rgba(250, 204, 21, 0.1);
  stroke: rgba(250, 204, 21, 0.48);
}
.logic-svg-node--action rect {
  fill: rgba(52, 211, 153, 0.1);
  stroke: rgba(52, 211, 153, 0.44);
}
.logic-svg-node-kind {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  fill: rgba(148, 163, 184, 0.9);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.logic-svg-node-label {
  font-size: 12px;
  fill: rgba(226, 232, 240, 0.98);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.logic-svg-node.is-selected rect {
  stroke: rgba(96, 165, 250, 0.92);
  stroke-width: 2;
  filter: brightness(1.08);
}
.logic-svg-node.is-dimmed rect,
.logic-svg-edge.is-dimmed path { opacity: 0.42; }
.logic-svg-node.is-dimmed .logic-svg-node-kind,
.logic-svg-node.is-dimmed .logic-svg-node-label { opacity: 0.62; }
.logic-svg-edge.is-dimmed .logic-svg-edge-label { opacity: 0.64; }
.logic-svg-node.is-hovered rect,
.logic-svg-edge.is-hovered path {
  opacity: 1;
  stroke-width: 2;
}
.logic-svg-node.is-path rect,
.logic-svg-edge.is-path path { opacity: 0.92; }
.logic-svg-edge.is-hovered .logic-svg-edge-label,
.logic-svg-node.is-hovered .logic-svg-node-kind,
.logic-svg-node.is-hovered .logic-svg-node-label { opacity: 1; }
`.trim();

function embedLogicFlowSvgForExport(svgClone) {
  if (!svgClone?.classList?.contains?.("logic-svg")) return;
  let defs = svgClone.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    svgClone.insertBefore(defs, svgClone.firstChild);
  }
  if (!defs.querySelector("style[data-logic-svg-export-styles]")) {
    const styleEl = document.createElementNS(SVG_NS, "style");
    styleEl.setAttribute("type", "text/css");
    styleEl.setAttribute("data-logic-svg-export-styles", "1");
    styleEl.textContent = LOGIC_SVG_STANDALONE_STYLES;
    defs.appendChild(styleEl);
  }
  const viewport = svgClone.querySelector(".logic-svg-viewport");
  const vb = svgClone.getAttribute("viewBox")?.trim()?.split(/\s+/)?.filter(Boolean);
  if (viewport && vb?.length === 4 && !svgClone.querySelector(".logic-svg-export-bg")) {
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("class", "logic-svg-export-bg");
    bg.setAttribute("x", vb[0]);
    bg.setAttribute("y", vb[1]);
    bg.setAttribute("width", vb[2]);
    bg.setAttribute("height", vb[3]);
    svgClone.insertBefore(bg, viewport);
  }
}

export function downloadSvgElementAsFile(svgEl, filename) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  embedLogicFlowSvgForExport(clone);
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(clone);
  if (!/\sxmlns\s*=/.test(source)) {
    source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/^\s*<\?xml/i.test(source.trim())) {
    source = `<?xml version="1.0" encoding="UTF-8"?>\n${source}`;
  }
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download every Logic Flow diagram SVG currently shown in the popout (single or split). */
function exportAllLogicFlowsFromPopoutHost(host) {
  if (!host) return;
  const svgs = host.querySelectorAll(".logic-flow-canvas svg");
  if (!svgs.length) return;
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  svgs.forEach((svg, index) => {
    const flowRoot = svg.closest(".logic-flow");
    const section = svg.closest("[data-popout-version]");
    const version = section?.getAttribute("data-popout-version");
    const titleEl = flowRoot?.querySelector(".logic-flow-title");
    let base = slugForLogicFlowExportFilename(titleEl?.textContent || `logic-flow-${index + 1}`);
    if (version === "A" || version === "B") {
      base = `${base}-version-${version}`;
    } else if (svgs.length > 1) {
      base = `${base}-pane-${index + 1}`;
    }
    const filename = `${base}-${stamp}.svg`;
    window.setTimeout(() => downloadSvgElementAsFile(svg, filename), index * 220);
  });
}

function attachLogicPopoutExportFab(dialog) {
  if (!dialog) return;
  let fab = dialog.querySelector("[data-action='logic-popout-export-all']");
  if (!fab) {
    const host = dialog.querySelector(".logic-popout-host");
    if (!host) return;
    let body = host.parentElement;
    if (!body?.classList.contains("logic-popout-body")) {
      body = document.createElement("div");
      body.className = "logic-popout-body";
      host.replaceWith(body);
      body.appendChild(host);
    }
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "logic-popout-export-fab";
    fab.dataset.action = "logic-popout-export-all";
    fab.setAttribute("aria-label", "Export all Logic Flow diagrams as SVG files");
    fab.title = "Export all";
    fab.innerHTML = LOGIC_POPOUT_EXPORT_FAB_ICON_SVG;
    fab.hidden = true;
    body.appendChild(fab);
  }
  if (fab.dataset.logicPopoutExportWired === "1") return;
  fab.dataset.logicPopoutExportWired = "1";
  fab.addEventListener("click", () => {
    const host = dialog.querySelector(".logic-popout-host");
    exportAllLogicFlowsFromPopoutHost(host);
  });
}

function ensureLogicPopoutDialog() {
  let dialog = document.getElementById("logicFlowPopoutDialog");
  if (dialog) {
    attachLogicPopoutExportFab(dialog);
    return dialog;
  }
  dialog = document.createElement("dialog");
  dialog.id = "logicFlowPopoutDialog";
  dialog.className = "logic-popout-dialog";
  dialog.setAttribute("aria-label", "Logic Flow popout");
  dialog.innerHTML = `
    <div class="logic-popout-shell">
      <header class="logic-popout-header">
        <h3 class="logic-popout-title">Logic Flow - Interactive view</h3>
        <button type="button" class="logic-popout-close" data-action="logic-popout-close" aria-label="Close Logic Flow popout">Close</button>
      </header>
      <div class="logic-popout-body">
        <div class="logic-popout-host"></div>
        <button
          type="button"
          class="logic-popout-export-fab"
          data-action="logic-popout-export-all"
          aria-label="Export all Logic Flow diagrams as SVG files"
          title="Export all"
          hidden
        >
          ${LOGIC_POPOUT_EXPORT_FAB_ICON_SVG}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const closeBtn = dialog.querySelector("[data-action='logic-popout-close']");
  closeBtn?.addEventListener("click", () => {
    dialog.close?.();
  });

  attachLogicPopoutExportFab(dialog);

  dialog.addEventListener("close", () => {
    const host = dialog.querySelector(".logic-popout-host");
    cleanupLogicPopoutHostViewports(host);
    if (host) host.innerHTML = "";
    syncLogicPopoutExportFabVisibility(dialog);
  });

  return dialog;
}

function ensureLogicViewportState(options, formula) {
  const externalState = options?.viewportState;
  const selectionToken = formula?.key || `${formula?.control || ""}.${formula?.property || ""}.${formula?.fileName || ""}`;
  if (!externalState || typeof externalState !== "object") {
    return { scale: 1, tx: 0, ty: 0, selectionToken, suppressClickUntil: 0, shouldFitOnRender: true };
  }
  if (typeof externalState.scale !== "number") externalState.scale = 1;
  if (typeof externalState.tx !== "number") externalState.tx = 0;
  if (typeof externalState.ty !== "number") externalState.ty = 0;
  if (typeof externalState.suppressClickUntil !== "number") externalState.suppressClickUntil = 0;
  if (externalState.selectionToken !== selectionToken) {
    externalState.scale = 1;
    externalState.tx = 0;
    externalState.ty = 0;
    externalState.selectionToken = selectionToken;
    externalState.shouldFitOnRender = true;
  }
  if (typeof externalState.shouldFitOnRender !== "boolean") externalState.shouldFitOnRender = false;
  return externalState;
}

function measureViewportBounds(viewport) {
  if (!viewport) return null;
  const prev = viewport.getAttribute("transform");
  viewport.setAttribute("transform", "");
  let bbox = null;
  try {
    bbox = viewport.getBBox?.();
  } finally {
    viewport.setAttribute("transform", prev || "");
  }
  if (!bbox) return null;
  return bbox;
}
