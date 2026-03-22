import { getNodeColor } from "./utils.js";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 58;
const NODE_RADIUS = 10;

let edgeArrowMarkerIdCounter = 0;

const EDGE_LABEL_SPARSE_THRESHOLD = 10;
const EDGE_LABEL_FALLBACK_COUNT = 6;

/**
 * Presentation attrs for edges/labels when the SVG is opened without styles.css (export).
 * Strokes align with the in-app theme; label fills are darker than the on-screen CSS so text
 * stays readable on typical light preview/print backgrounds (in-app, `.edge-label` CSS wins).
 */
const EDGE_STROKE_DEFAULT = "#64748b";
const EDGE_STROKE_SETS = "#22c55e";
const EDGE_STROKE_USES = "#38bdf8";
const EDGE_LABEL_FILL_DEFAULT = "#334155";
const EDGE_LABEL_FILL_SETS = "#166534";
const EDGE_LABEL_FILL_USES = "#075985";

function edgePresentationColors(relationType) {
  if (relationType === "sets") {
    return { stroke: EDGE_STROKE_SETS, labelFill: EDGE_LABEL_FILL_SETS };
  }
  if (relationType === "uses") {
    return { stroke: EDGE_STROKE_USES, labelFill: EDGE_LABEL_FILL_USES };
  }
  return { stroke: EDGE_STROKE_DEFAULT, labelFill: EDGE_LABEL_FILL_DEFAULT };
}

/**
 * Toggle graph focus styles (selected + hover) without re-rendering SVG.
 *
 * Requires that this SVG was previously produced by `renderGraph()`, which
 * stores a small adjacency index on `svg.__graphIndex`.
 */
export function updateGraphFocus(
  svg,
  selectedNodeId,
  hoveredNodeId,
  focusOptions = {}
) {
  const index = svg?.__graphIndex;
  if (!index) return;

  applyGraphFocusClasses(svg, index, selectedNodeId, hoveredNodeId, focusOptions);
}

export function renderGraph(
  svg,
  parsed,
  filters,
  onNodeClick,
  highlightNodeId = null,
  screenFileName = null,
  onNodeHover = null,
  hoverNodeId = null,
  graphFocusOptions = {}
) {
  svg.innerHTML = "";
  delete svg.__graphIndex;

  if (!parsed) return;

  const svgNS = "http://www.w3.org/2000/svg";

  // Marker defs must be inside the rendered SVG since `renderGraph()` clears `innerHTML`.
  // Using `context-stroke` makes the arrowhead match the edge stroke color (and opacity).
  const markerId = `edge-arrowhead-${++edgeArrowMarkerIdCounter}`;
  svg.dataset.edgeArrowMarkerId = markerId;
  addEdgeArrowMarkers(svg, markerId);

  // Wrap all nodes/edges so we can apply a single zoom/pan transform.
  const viewport = document.createElementNS(svgNS, "g");
  viewport.setAttribute("class", "graph-viewport");
  svg.appendChild(viewport);

  const formulaTypeByNodeId = buildFormulaTypeByNodeId(parsed);
  const screenNodeIds = screenFileName
    ? buildScreenSubgraphNodeIds(parsed, screenFileName)
    : null;

  const visibleNodes = parsed.nodes.filter(
    (node) =>
      isNodeVisible(node, filters, formulaTypeByNodeId) &&
      (!screenNodeIds || screenNodeIds.has(node.id))
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

  const visibleEdges = parsed.edges.filter(
    (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
  );

  const effectiveHighlightId =
    highlightNodeId && visibleNodeIds.has(highlightNodeId) ? highlightNodeId : null;
  const effectiveHoverId =
    hoverNodeId && visibleNodeIds.has(hoverNodeId) ? hoverNodeId : null;

  const shouldSparseEdgeLabels = visibleEdges.length > EDGE_LABEL_SPARSE_THRESHOLD;
  svg.classList.toggle("edge-label-mode-sparse", shouldSparseEdgeLabels);

  const hasFocus = Boolean(effectiveHighlightId || effectiveHoverId);
  const showEdgeLabelFallbacks =
    shouldSparseEdgeLabels && !hasFocus && visibleEdges.length > 0;

  let edgeIndex = 0;

  const layout = createSimpleLayout(visibleNodes);
  // Size the SVG to the actual rendered graph height so the container can scroll
  // instead of the whole page. This also keeps the coordinate system stable.
  const maxY =
    visibleNodes.reduce((acc, node) => {
      const position = layout[node.id];
      if (!position) return acc;
      return Math.max(acc, position.y + NODE_HEIGHT);
    }, 0) || 0;
  const svgHeight = Math.max(600, maxY + 60); // padding for readability
  svg.style.height = `${svgHeight}px`;
  const markerIdForEdges = markerId;

  for (const edge of visibleEdges) {
    const from = layout[edge.from];
    const to = layout[edge.to];
    if (!from || !to) continue;

    const showFallbackLabel =
      showEdgeLabelFallbacks && edgeIndex < EDGE_LABEL_FALLBACK_COUNT;

    drawEdge(
      viewport,
      from,
      to,
      edge.from,
      edge.to,
      edge.relation,
      effectiveHighlightId,
      effectiveHoverId,
      showFallbackLabel,
      shouldSparseEdgeLabels,
      markerIdForEdges
    );
    edgeIndex++;
  }

  for (const node of visibleNodes) {
    const position = layout[node.id];
    if (!position) continue;

    drawNode(
      viewport,
      node,
      position,
      formulaTypeByNodeId,
      onNodeClick,
      effectiveHighlightId,
      onNodeHover
    );
  }

  const graphIndex = buildGraphIndex(svg);
  svg.__graphIndex = graphIndex;
  applyGraphFocusClasses(
    svg,
    graphIndex,
    effectiveHighlightId,
    effectiveHoverId,
    graphFocusOptions
  );
}

/** All node ids in the same weakly connected component as `rootId` (edges treated as undirected). */
function computeWeaklyConnectedNodeIdsFromEdgeElements(edgeEls, rootId) {
  if (!rootId) return new Set();

  const adj = new Map();
  for (const edgeEl of edgeEls) {
    const from = edgeEl.dataset.fromId;
    const to = edgeEl.dataset.toId;
    if (!from || !to) continue;
    let a = adj.get(from);
    if (!a) adj.set(from, (a = []));
    a.push(to);
    let b = adj.get(to);
    if (!b) adj.set(to, (b = []));
    b.push(from);
  }

  const out = new Set([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const n = stack.pop();
    for (const t of adj.get(n) || []) {
      if (!out.has(t)) {
        out.add(t);
        stack.push(t);
      }
    }
  }
  return out;
}

function buildFormulaTypeByNodeId(parsed) {
  const map = new Map();

  for (const formula of parsed.formulas || []) {
    const nodeId = `formula::${formula.control}::${formula.property}::${formula.fileName}`;
    map.set(nodeId, formula.fileType);
  }

  return map;
}

/** Nodes tied to this screen file plus anything reachable by following edges forward from them. */
function buildScreenSubgraphNodeIds(parsed, screenFileName) {
  const nodes = parsed.nodes || [];
  const edges = parsed.edges || [];
  const suffix = `::${screenFileName}`;

  /** @type {Set<string>} */
  const allowed = new Set();

  for (const node of nodes) {
    if (node.nodeType === "file" && node.id === `file::${screenFileName}`) {
      allowed.add(node.id);
      continue;
    }
    if (typeof node.id === "string" && node.id.endsWith(suffix)) {
      allowed.add(node.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (allowed.has(edge.from) && !allowed.has(edge.to)) {
        allowed.add(edge.to);
        changed = true;
      }
    }
  }

  return allowed;
}

function isNodeVisible(node, filters, formulaTypeByNodeId) {
  if (node.nodeType === "file") return filters.files;
  if (node.nodeType === "formula") {
    const formulaType = formulaTypeByNodeId?.get(node.id);

    if (formulaType === "app") return filters.app;
    if (formulaType === "screen") return filters.screens;

    return filters.formulas;
  }
  if (node.nodeType === "variable") return filters.variables;
  if (node.nodeType === "table") return filters.tables;
  if (node.nodeType === "column") return filters.columns;
  return true;
}

function createSimpleLayout(nodes) {
  const groups = {
    file: [],
    formula: [],
    variable: [],
    table: [],
    column: [],
    other: [],
  };

  for (const node of nodes) {
    if (groups[node.nodeType]) {
      groups[node.nodeType].push(node);
    } else {
      groups.other.push(node);
    }
  }

  // Layout orientation:
  // - Types flow top-to-bottom (y grows by type group)
  // - Nodes within each type group are packed into a small grid
  //   to avoid exploding the SVG width.
  const typeOrder = ["file", "formula", "variable", "table", "column", "other"];
  const yStart = 90;
  const yStep = 110;
  const xBase = 90;
  const xStep = 200;
  const nodesPerRow = 4;
  const groupPadding = 60;
  const layout = {};

  let yCursor = yStart;
  typeOrder.forEach((type) => {
    const group = groups[type];
    if (!group.length) return;

    const rowsNeeded = Math.ceil(group.length / nodesPerRow);
    group.forEach((node, indexWithinGroup) => {
      const rowIndex = Math.floor(indexWithinGroup / nodesPerRow);
      const colIndex = indexWithinGroup % nodesPerRow;

      layout[node.id] = {
        x: xBase + colIndex * xStep,
        y: yCursor + rowIndex * yStep,
      };
    });

    yCursor += rowsNeeded * yStep + groupPadding;
  });

  return layout;
}

function drawNode(
  viewport,
  node,
  position,
  formulaTypeByNodeId,
  onNodeClick,
  highlightNodeId,
  onNodeHover
) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "graph-node-group");
  group.dataset.nodeId = node.id;

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", position.x);
  rect.setAttribute("y", position.y);
  rect.setAttribute("width", String(NODE_WIDTH));
  rect.setAttribute("height", String(NODE_HEIGHT));
  rect.setAttribute("rx", String(NODE_RADIUS));
  rect.setAttribute("fill", getNodeColor(node.nodeType));
  rect.setAttribute("class", "node");

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", position.x + 10);
  text.setAttribute("y", position.y + 22);
  text.setAttribute("class", "node-label");

  const displayType =
    node.nodeType === "formula"
      ? formulaTypeByNodeId?.get(node.id) || node.nodeType
      : node.nodeType;

  const titleLine = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
  titleLine.textContent = node.label;
  titleLine.setAttribute("x", String(position.x + 10));
  titleLine.setAttribute("dy", "0");

  const typeLine = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
  typeLine.textContent = `Type: ${displayType || "unknown"}`;
  typeLine.setAttribute("x", String(position.x + 10));
  typeLine.setAttribute("dy", "16");
  typeLine.setAttribute("class", "node-label-sub");

  text.appendChild(titleLine);
  text.appendChild(typeLine);

  group.appendChild(rect);
  group.appendChild(text);

  group.addEventListener("click", () => onNodeClick(node));

  if (onNodeHover) {
    group.addEventListener("pointerenter", () => onNodeHover(node.id));
    group.addEventListener("pointerleave", () => onNodeHover(null));
  }

  viewport.appendChild(group);
}

function addEdgeArrowMarkers(svg, markerId) {
  const svgNS = "http://www.w3.org/2000/svg";

  const defs = document.createElementNS(svgNS, "defs");

  const marker = document.createElementNS(svgNS, "marker");
  marker.setAttribute("id", markerId);
  marker.setAttribute("viewBox", "0 -5 10 10");
  marker.setAttribute("refX", "10"); // Align arrow tip with the end of the edge.
  marker.setAttribute("refY", "0");
  marker.setAttribute("markerWidth", "6");
  marker.setAttribute("markerHeight", "6");
  marker.setAttribute("orient", "auto");
  marker.setAttribute("markerUnits", "strokeWidth");

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", "M0,-5 L10,0 L0,5 Z");
  // Inherit stroke color from the referencing edge (works with relation-specific stroke updates later).
  path.setAttribute("fill", "context-stroke");

  marker.appendChild(path);
  defs.appendChild(marker);
  svg.appendChild(defs);
}

function drawEdge(
  viewport,
  from,
  to,
  fromId,
  toId,
  relation,
  highlightNodeId,
  hoverNodeId,
  showFallbackLabel,
  shouldSparseEdgeLabels,
  markerId
) {
  // For vertical flows we prefer bottom-to-top connections between node types.
  // (We use y-direction rather than x-direction to match the new layout.)
  const fromTop = from.y;
  const fromBottom = from.y + NODE_HEIGHT;
  const toTop = to.y;
  const toBottom = to.y + NODE_HEIGHT;

  let x1;
  let y1;
  let x2;
  let y2;

  if (to.y >= from.y) {
    x1 = from.x + NODE_WIDTH / 2; // bottom center
    y1 = fromBottom;
    x2 = to.x + NODE_WIDTH / 2; // top center
    y2 = toTop;
  } else {
    // Arrow/edge going up
    x1 = from.x + NODE_WIDTH / 2; // top center
    y1 = fromTop;
    x2 = to.x + NODE_WIDTH / 2; // bottom center
    y2 = toBottom;
  }

  const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeGroup.setAttribute("class", "graph-edge-group");

  const relationType =
    typeof relation === "string" ? relation.trim().toLowerCase() : "";
  if (relationType) {
    edgeGroup.dataset.relation = relationType;
    if (relationType === "sets" || relationType === "uses") {
      edgeGroup.classList.add(`edge--${relationType}`);
    }
  }

  edgeGroup.dataset.fromId = fromId;
  edgeGroup.dataset.toId = toId;

  // Fallback label visibility for sparse mode (only applies when there is no focus).
  if (showFallbackLabel) edgeGroup.classList.add("is-label-visible");

  // Use marker-end so the arrowhead visually points edge.from -> edge.to.
  // SVG markers work on paths as well, so we render the curve as a single path element.
  const edgeShape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  edgeShape.setAttribute("class", "edge");
  edgeShape.setAttribute("fill", "none");
  edgeShape.setAttribute("marker-end", `url(#${markerId})`);

  // Quadratic Bézier curve to reduce overlaps vs straight lines.
  // Control point strategy: keep the curve stable for top-to-bottom layout, and
  // nudge left/right based on dx (with a deterministic fallback when dx==0).
  const dx = x2 - x1;
  const dy = y2 - y1;
  const absDy = Math.abs(dy);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const hashString = (s) => {
    // Small deterministic hash for stable curvature sign decisions.
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  };

  const dxSign = Math.sign(dx);
  const curveSign = dxSign !== 0 ? dxSign : hashString(`${fromId}->${toId}:${relation}`) % 2 ? 1 : -1;

  const curveAmount = Math.min(
    70,
    Math.max(18, Math.abs(dx) * 0.1 + absDy * 0.06)
  );
  const cx = midX + curveSign * curveAmount;
  const cy = midY;

  edgeShape.setAttribute("d", `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);

  const { stroke: edgeStroke, labelFill } = edgePresentationColors(relationType);
  edgeShape.setAttribute("stroke", edgeStroke);
  edgeShape.setAttribute("stroke-width", "2");
  edgeShape.setAttribute("opacity", "0.9");

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  // Midpoint on the quadratic (t=0.5); same as 0.25*P0 + 0.5*C + 0.25*P2.
  let labelX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  let labelY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;

  // Nudge the label off the edge path: perpendicular to chord P0→P2 (tangent at t=0.5),
  // on the side opposite the curve bulge (bulge follows curveSign vs chord midpoint).
  const tdx = x2 - x1;
  const tdy = y2 - y1;
  const tLen = Math.hypot(tdx, tdy) || 1;
  const nx = (-tdy / tLen) * curveSign;
  const ny = (tdx / tLen) * curveSign;
  const labelOutset = Math.min(18, Math.max(10, 8 + absDy * 0.04));
  labelX += nx * labelOutset;
  labelY += ny * labelOutset;

  label.setAttribute("x", labelX);
  label.setAttribute("y", labelY);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "middle");
  label.setAttribute("class", "edge-label");
  label.setAttribute("fill", labelFill);
  label.textContent = relation;

  edgeGroup.appendChild(edgeShape);
  edgeGroup.appendChild(label);
  viewport.appendChild(edgeGroup);
}

function buildGraphIndex(svg) {
  const nodeEls = Array.from(svg.querySelectorAll(".graph-node-group"));
  const edgeEls = Array.from(svg.querySelectorAll(".graph-edge-group"));

  const nodesById = new Map();
  for (const nodeEl of nodeEls) {
    const nodeId = nodeEl.dataset.nodeId;
    if (!nodeId) continue;
    nodesById.set(nodeId, nodeEl);
  }

  // nodeId -> Set<edgeEl>
  const edgesByNodeId = new Map();
  // nodeId -> Set<nodeId> (endpoints of incident edges)
  const incidentNodesByNodeId = new Map();

  for (const edgeEl of edgeEls) {
    const fromId = edgeEl.dataset.fromId;
    const toId = edgeEl.dataset.toId;
    if (!fromId || !toId) continue;

    let edgesFrom = edgesByNodeId.get(fromId);
    if (!edgesFrom) edgesByNodeId.set(fromId, (edgesFrom = new Set()));
    edgesFrom.add(edgeEl);

    let edgesTo = edgesByNodeId.get(toId);
    if (!edgesTo) edgesByNodeId.set(toId, (edgesTo = new Set()));
    edgesTo.add(edgeEl);

    let incidentFrom = incidentNodesByNodeId.get(fromId);
    if (!incidentFrom)
      incidentNodesByNodeId.set(fromId, (incidentFrom = new Set()));
    incidentFrom.add(fromId);
    incidentFrom.add(toId);

    let incidentTo = incidentNodesByNodeId.get(toId);
    if (!incidentTo) incidentNodesByNodeId.set(toId, (incidentTo = new Set()));
    incidentTo.add(toId);
    incidentTo.add(fromId);
  }

  const fallbackLabelEdgeEls = new Set(
    edgeEls.filter((e) => e.classList.contains("is-label-visible"))
  );

  return {
    isSparseMode: svg.classList.contains("edge-label-mode-sparse"),
    nodesById,
    nodeEls,
    edges: edgeEls,
    edgesByNodeId,
    incidentNodesByNodeId,
    fallbackLabelEdgeEls,
  };
}

function applyGraphFocusClasses(
  svg,
  graphIndex,
  selectedNodeId,
  hoveredNodeId,
  focusOptions = {}
) {
  const {
    isSparseMode,
    nodesById,
    nodeEls,
    edges,
    edgesByNodeId,
    incidentNodesByNodeId,
    fallbackLabelEdgeEls,
  } = graphIndex;

  const subtreeFocus = Boolean(focusOptions.subtreeFocus);

  const selectedId =
    selectedNodeId && nodesById.has(selectedNodeId) ? selectedNodeId : null;
  const hoveredId =
    hoveredNodeId && nodesById.has(hoveredNodeId) ? hoveredNodeId : null;

  const hasFocus = Boolean(selectedId || hoveredId);

  const subtreeFocusActive = Boolean(
    subtreeFocus && selectedId && !hoveredId
  );
  const connectedIds = subtreeFocusActive
    ? computeWeaklyConnectedNodeIdsFromEdgeElements(edges, selectedId)
    : null;

  const hoveredIncidentNodes = hoveredId
    ? incidentNodesByNodeId.get(hoveredId)
    : null;

  const selectedEdges = selectedId ? edgesByNodeId.get(selectedId) : null;
  const hoveredEdges = hoveredId ? edgesByNodeId.get(hoveredId) : null;

  // Nodes: hovered/selected stay bright; non-incident dim.
  for (const nodeEl of nodeEls) {
    const nodeId = nodeEl.dataset.nodeId;

    nodeEl.classList.remove(
      "is-dimmed",
      "is-outside-subtree-focus",
      "is-selected",
      "is-hovered"
    );

    if (selectedId && nodeId === selectedId) nodeEl.classList.add("is-selected");
    if (hoveredId && nodeId === hoveredId) nodeEl.classList.add("is-hovered");

    if (hasFocus) {
      // Node dimming behavior:
      // - When only selected: keep ONLY the selected node visible (matches
      //   existing click-selection behavior), unless subtree focus is on — then
      //   hide everything outside the weakly connected component of the selection.
      // - When hovering (with or without selection): keep the hovered node and
      //   its incident neighborhood visible, plus the selected node styling.
      if (hoveredId) {
        const keep =
          nodeId === selectedId ||
          nodeId === hoveredId ||
          hoveredIncidentNodes?.has(nodeId);
        if (!keep) nodeEl.classList.add("is-dimmed");
      } else if (connectedIds) {
        if (!connectedIds.has(nodeId))
          nodeEl.classList.add("is-outside-subtree-focus");
      } else {
        if (nodeId !== selectedId) nodeEl.classList.add("is-dimmed");
      }
    }
  }

  // Edges: emphasize incident edges and dim the rest.
  for (const edgeEl of edges) {
    const fromId = edgeEl.dataset.fromId;
    const toId = edgeEl.dataset.toId;

    const incidentSelected =
      Boolean(selectedEdges && selectedEdges.has(edgeEl)) ||
      (selectedId && (fromId === selectedId || toId === selectedId));

    const incidentHovered =
      Boolean(hoveredEdges && hoveredEdges.has(edgeEl)) ||
      (hoveredId && (fromId === hoveredId || toId === hoveredId));

    const edgeInsideConnected =
      connectedIds &&
      connectedIds.has(fromId) &&
      connectedIds.has(toId);

    edgeEl.classList.remove(
      "is-dimmed",
      "is-outside-subtree-focus",
      "is-incident-to-selected",
      "is-incident-to-hover"
    );

    if (incidentSelected || edgeInsideConnected)
      edgeEl.classList.add("is-incident-to-selected");
    if (incidentHovered) edgeEl.classList.add("is-incident-to-hover");

    if (hasFocus) {
      if (hoveredId) {
        if (!incidentSelected && !incidentHovered) edgeEl.classList.add("is-dimmed");
      } else if (connectedIds) {
        if (!edgeInsideConnected)
          edgeEl.classList.add("is-outside-subtree-focus");
      } else if (!incidentSelected) {
        edgeEl.classList.add("is-dimmed");
      }
    }
  }

  // Sparse edge label mode: update fallback label visibility only when the
  // focus state flips (idle <-> focusing). Incident labels are controlled
  // by is-incident-to-selected/is-incident-to-hover classes above.
  const nextShowFallbackLabels = isSparseMode && !hasFocus;
  const prevShowFallbackLabels = graphIndex.__showFallbackLabels;

  if (isSparseMode && prevShowFallbackLabels !== nextShowFallbackLabels) {
    if (nextShowFallbackLabels) {
      for (const edgeEl of edges) {
        if (fallbackLabelEdgeEls.has(edgeEl)) edgeEl.classList.add("is-label-visible");
        else edgeEl.classList.remove("is-label-visible");
      }
    } else {
      for (const edgeEl of edges) edgeEl.classList.remove("is-label-visible");
    }
    graphIndex.__showFallbackLabels = nextShowFallbackLabels;
  }

  if (!isSparseMode) {
    for (const edgeEl of edges) edgeEl.classList.remove("is-label-visible");
  }
}