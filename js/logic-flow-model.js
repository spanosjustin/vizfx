const MAX_LABEL_LEN = 72;

/**
 * Build a normalized per-formula logic-flow model.
 * The parser is intentionally best-effort and conservative:
 * - It understands top-level `;` sequences.
 * - It detects `If(...)` and `Switch(...)` as decision structures.
 * - If input looks risky/unparseable, it falls back to linear flow.
 *
 * @param {string} formulaString
 * @returns {{
 *   nodes: Array<{ id: string, kind: "start" | "decision" | "action" | "end", label: string, contextText?: string, hideLabel?: boolean }>,
 *   edges: Array<{ from: string, to: string, label?: string }>,
 *   meta: { confidence: "high" | "medium" | "low", fallback: boolean, notes: string[] }
 * }}
 */
export function buildLogicFlow(formulaString) {
  const text = String(formulaString || "").trim();
  if (!text) {
    return buildFallbackFlow(text, ["Formula is empty."], "low");
  }

  if (!isTopLevelBalanced(text)) {
    return buildFallbackFlow(text, ["Parentheses or strings are not balanced."], "low");
  }

  const state = createGraphState();
  const notes = [];
  let confidence = "high";
  let fallback = false;

  const startId = state.addNode("start", "Start");
  const sequence = splitTopLevel(text, ";").map((part) => part.trim()).filter(Boolean);
  if (sequence.length > 1) notes.push(`Detected ${sequence.length} top-level sequential step(s).`);

  try {
    let tailId = startId;
    const steps = sequence.length ? sequence : [text];
    for (const step of steps) {
      const res = appendStep(step, tailId, state);
      tailId = res.tailId;
      if (res.confidence === "medium" && confidence === "high") confidence = "medium";
      if (res.note) notes.push(res.note);
    }
    const endId = state.addNode("end", "End");
    state.addEdge(tailId, endId);
  } catch {
    fallback = true;
    confidence = "low";
    notes.push("Parser exception occurred; using fallback linear flow.");
    return buildFallbackFlow(text, notes, confidence);
  }

  if (state.nodes.length < 2 || state.edges.length < 1) {
    fallback = true;
    confidence = "low";
    notes.push("No usable flow structure generated; using fallback linear flow.");
    return buildFallbackFlow(text, notes, confidence);
  }

  return {
    nodes: state.nodes,
    edges: state.edges,
    meta: { confidence, fallback, notes },
  };
}

function createGraphState() {
  const nodes = [];
  const edges = [];
  let nextId = 1;
  return {
    nodes,
    edges,
    addNode(kind, label, contextText = "", options = null) {
      const id = `n${nextId++}`;
      const node = { id, kind, label: compactLabel(label) };
      if (contextText) node.contextText = normalizeContextText(contextText);
      if (options?.hideLabel) node.hideLabel = true;
      nodes.push(node);
      return id;
    },
    addEdge(from, to, label = "") {
      const edge = { from, to };
      if (label) edge.label = label;
      edges.push(edge);
    },
  };
}

function appendStep(stepText, sourceId, state) {
  const parsedIf = parseIf(stepText);
  if (parsedIf) {
    const decisionId = state.addNode(
      "decision",
      `If: ${summarizeExpression(parsedIf.condition)}`,
      parsedIf.condition
    );
    const trueId = state.addNode("action", simplifyActionLabel(parsedIf.trueBranch), parsedIf.trueBranch);
    const falseId = state.addNode("action", simplifyActionLabel(parsedIf.falseBranch), parsedIf.falseBranch);
    const joinId = state.addNode("action", "", "Join branches", { hideLabel: true });

    state.addEdge(sourceId, decisionId);
    state.addEdge(decisionId, trueId, "Yes");
    state.addEdge(decisionId, falseId, "No");
    state.addEdge(trueId, joinId);
    state.addEdge(falseId, joinId);

    return { tailId: joinId, confidence: "high", note: "Parsed If(...) decision." };
  }

  const parsedSwitch = parseSwitch(stepText);
  if (parsedSwitch) {
    const decisionId = state.addNode(
      "decision",
      `Switch on: ${summarizeExpression(parsedSwitch.expression)}`,
      parsedSwitch.expression
    );
    const joinId = state.addNode("action", "", "Join branches", { hideLabel: true });
    state.addEdge(sourceId, decisionId);

    for (const branch of parsedSwitch.branches) {
      const branchId = state.addNode("action", simplifyActionLabel(branch.result), branch.result);
      state.addEdge(decisionId, branchId, branch.label);
      state.addEdge(branchId, joinId);
    }
    return { tailId: joinId, confidence: "high", note: "Parsed Switch(...) decision." };
  }

  const actionId = state.addNode("action", simplifyActionLabel(stepText), stepText);
  state.addEdge(sourceId, actionId);
  return {
    tailId: actionId,
    confidence: "medium",
    note: "Treated one step as a generic action.",
  };
}

function parseIf(text) {
  const call = parseFunctionCall(text, "If");
  if (!call) return null;
  const args = splitTopLevel(call.inner, ",");
  if (args.length < 3) return null;

  return {
    condition: args[0].trim(),
    trueBranch: args[1].trim(),
    falseBranch: args[2].trim(),
  };
}

function parseSwitch(text) {
  const call = parseFunctionCall(text, "Switch");
  if (!call) return null;
  const args = splitTopLevel(call.inner, ",").map((s) => s.trim());
  if (args.length < 3) return null;

  const rest = args.slice(1);
  const branches = [];
  for (let i = 0; i < rest.length; i += 2) {
    const maybeCase = rest[i];
    const maybeResult = rest[i + 1];
    if (maybeResult == null) {
      branches.push({ label: "Default", result: maybeCase });
    } else {
      branches.push({ label: `Case: ${summarizeExpression(maybeCase)}`, result: maybeResult });
    }
  }
  return { expression: args[0], branches };
}

function parseFunctionCall(text, fnName) {
  const raw = String(text || "").trim();
  if (!raw.toLowerCase().startsWith(`${fnName.toLowerCase()}(`)) return null;
  if (!raw.endsWith(")")) return null;
  const inner = raw.slice(raw.indexOf("(") + 1, -1);
  if (!isTopLevelBalanced(inner)) return null;
  return { inner };
}

/**
 * Split by a delimiter only at top-level depth.
 * Important: we ignore delimiter hits inside:
 * - nested parentheses
 * - single/double-quoted string literals
 */
function splitTopLevel(text, delimiterChar) {
  const result = [];
  let current = "";
  let depth = 0;
  let quote = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quote) {
      current += ch;
      if (ch === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "(") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }

    if (ch === delimiterChar && depth === 0) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function isTopLevelBalanced(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && quote == null;
}

function simplifyActionLabel(stepText) {
  const raw = compactLabel(stepText);
  const lower = raw.toLowerCase();

  const setVarMatch = raw.match(/\bSet\s*\(\s*([A-Za-z_][\w]*)/i);
  if (setVarMatch) return `Set ${setVarMatch[1]}`;

  const updateCtxMatch = raw.match(/\bUpdateContext\s*\(\s*\{\s*([A-Za-z_][\w]*)/i);
  if (updateCtxMatch) return `Set ${updateCtxMatch[1]}`;

  const navigateMatch = raw.match(/\bNavigate\s*\(\s*([A-Za-z_][\w]*)/i);
  if (navigateMatch) return `Navigate ${navigateMatch[1]}`;

  const fnMatch = raw.match(/^([A-Za-z_][\w]*)\s*\(/);
  const fn = fnMatch ? fnMatch[1].toLowerCase() : "";
  if (fn) {
    const args = parseCallArgs(raw, fnMatch[1]);
    const first = args[0] || "";
    const second = args[1] || "";
    const target1 = summarizeExpression(first);
    const target2 = summarizeExpression(second);

    if (fn === "notify") return target1 ? `Notify: ${target1}` : "Notify user";
    if (fn === "patch") return target1 ? `Patch ${target1}` : "Patch record";
    if (fn === "submitform") return target1 ? `Submit ${target1}` : "Submit form";
    if (fn === "collect") return target1 ? `Collect ${target1}` : "Collect records";
    if (fn === "clearcollect") return target1 ? `Refresh ${target1}` : "Refresh collection";
    if (fn === "clear") return target1 ? `Clear ${target1}` : "Clear collection";
    if (fn === "remove") return target1 ? `Remove from ${target1}` : "Remove record";
    if (fn === "removeif") return target1 ? `Remove in ${target1}` : "Remove records";
    if (fn === "reset") return target1 ? `Reset ${target1}` : "Reset control";
    if (fn === "updaterecord" || fn === "updateif") return target1 ? `Update ${target1}` : "Update records";
    if (fn === "concurrent") return "Run concurrent actions";
    if (fn === "launch") return target1 ? `Open ${target1}` : "Open link";
    if (fn === "setproperty") return target1 && target2 ? `Set ${target1}.${target2}` : "Set property";
  }

  if (lower.startsWith("set(")) return "Set variable";
  if (lower.startsWith("updatecontext(")) return "Update context";
  if (lower.startsWith("navigate(")) return "Navigate";

  return raw;
}

function parseCallArgs(text, fnName) {
  const call = parseFunctionCall(text, fnName);
  if (!call) return [];
  return splitTopLevel(call.inner, ",").map((s) => s.trim()).filter(Boolean);
}

function summarizeExpression(value) {
  const raw = compactLabel(value);
  if (!raw || raw === "Step") return "condition";

  const ops = [
    { re: /\s&&\s|\sAnd\s/i, token: "and" },
    { re: /\s\|\|\s|\sOr\s/i, token: "or" },
    { re: /\s<=\s/, token: "<=" },
    { re: /\s>=\s/, token: ">=" },
    { re: /\s<>\s/, token: "!=" },
    { re: /\s=\s/, token: "=" },
    { re: /\s<\s/, token: "<" },
    { re: /\s>\s/, token: ">" },
    { re: /\s in \s/i, token: "in" },
  ];
  for (const op of ops) {
    if (!op.re.test(raw)) continue;
    const parts = raw.split(op.re).map((s) => stripOuterParens(s.trim())).filter(Boolean);
    if (parts.length >= 2) {
      const left = summarizeToken(parts[0]);
      const right = summarizeToken(parts[1]);
      return compactLabel(`${left} ${op.token} ${right}`);
    }
  }

  const call = raw.match(/^([A-Za-z_][\w]*)\s*\((.*)\)$/);
  if (call) {
    const fn = call[1];
    const args = parseCallArgs(raw, fn);
    const first = args[0] ? summarizeToken(args[0]) : "";
    return first ? `${fn}(${first})` : `${fn}(...)`;
  }

  return summarizeToken(raw);
}

function summarizeToken(value) {
  const v = stripOuterParens(String(value || "").trim());
  if (!v) return "value";
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return compactLabel(v.slice(1, -1));
  }
  const dotted = v.match(/^([A-Za-z_][\w]*)(\.[A-Za-z_][\w]*)+$/);
  if (dotted) return compactLabel(v);
  const ident = v.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/);
  if (ident) return compactLabel(ident[0]);
  return compactLabel(v);
}

function stripOuterParens(value) {
  let out = String(value || "").trim();
  while (out.startsWith("(") && out.endsWith(")") && isTopLevelBalanced(out.slice(1, -1))) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

/**
 * Deterministic demo examples for label behavior without test framework wiring.
 * Consumers can run this in devtools to inspect label quality quickly.
 */
export function demoLogicFlowLabelExamples() {
  const formulas = [
    `If(IsBlank(txtEmail.Text), Notify("Email required"), SubmitForm(frmSignup))`,
    `Switch(ddStatus.Selected.Value, "New", Collect(colNew, ThisItem), "Closed", Remove(colOpen, ThisItem), Notify("Unknown"))`,
    `Set(varMode, "Edit"); Navigate(scrEditor, ScreenTransition.Fade)`,
    `If(CountRows(colCart) > 0, Patch(Orders, Defaults(Orders), { Total: Sum(colCart, Price) }), Notify("Cart is empty"))`,
  ];

  return formulas.map((formula) => {
    const graph = buildLogicFlow(formula);
    return {
      formula,
      labels: graph.nodes.map((n) => ({ kind: n.kind, label: n.label, hideLabel: !!n.hideLabel })),
      confidence: graph.meta?.confidence || "low",
    };
  });
}

function buildFallbackFlow(formulaText, notes, confidence = "low") {
  const trimmed = String(formulaText || "").trim();
  const state = createGraphState();
  const startId = state.addNode("start", "Start");
  const actionId = state.addNode("action", simplifyActionLabel(trimmed || "Formula"), trimmed || "Formula");
  const endId = state.addNode("end", "End");
  state.addEdge(startId, actionId);
  state.addEdge(actionId, endId);

  return {
    nodes: state.nodes,
    edges: state.edges,
    meta: {
      confidence,
      fallback: true,
      notes: notes && notes.length ? notes : ["Used fallback linear flow."],
    },
  };
}

function compactLabel(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Step";
  if (text.length <= MAX_LABEL_LEN) return text;
  return `${text.slice(0, MAX_LABEL_LEN - 1)}...`;
}

function normalizeContextText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || "Step";
}
