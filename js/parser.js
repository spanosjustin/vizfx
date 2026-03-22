import { formulaKey, uniqueArray } from "./utils.js";

export function parsePowerAppJson(raw) {
  if (!raw || !raw.app) {
    throw new Error("JSON missing required app metadata.");
  }

  const files = raw.files || [];
  const variables = raw.variables || [];
  const dataSources = raw.dataSources || [];
  const nodes = raw.nodes || [];
  const edges = raw.edges || [];

  const formulas = files.flatMap((file) =>
    (file.formulas || []).map((formula) => ({
      ...formula,
      fileName: file.fileName,
      fileType: file.type,
      key: formulaKey({
        control: formula.control,
        property: formula.property,
        fileName: file.fileName,
      }),
    }))
  );

  const formulasByKey = Object.fromEntries(
    formulas.map((formula) => [formula.key, formula])
  );

  const variablesByName = groupVariablesByName(variables);

  const summary = {
    appName: raw.app?.name || "Unknown App",
    versionLabel: raw.app?.versionLabel || "Unknown Version",
    generatedAt: raw.app?.generatedAt || "",
    fileCount: raw.summary?.fileCount ?? files.length,
    formulaCount: raw.summary?.formulaCount ?? formulas.length,
    variableCount: raw.summary?.variableCount ?? variables.length,
    tableCount: raw.summary?.tableCount ?? dataSources.length,
    columnCount:
      raw.summary?.columnCount ??
      dataSources.reduce((sum, ds) => sum + (ds.columns?.length || 0), 0),
  };

  return {
    raw,
    app: raw.app,
    files,
    formulas,
    formulasByKey,
    variables,
    variablesByName,
    dataSources,
    nodes,
    edges,
    summary,
    masterFx: buildMasterFx(formulas),
    relationships: buildRelationships(formulas),
  };
}

/**
 * Screen files for chart filters: unique fileName with a display label (control name when present).
 * @param {{ files?: unknown[]; formulas?: unknown[] } | null | undefined} parsed
 * @returns {{ fileName: string; label: string }[]}
 */
export function listScreens(parsed) {
  if (!parsed) return [];

  /** @type {Map<string, string>} */
  const byFile = new Map();

  for (const f of parsed.files || []) {
    if (f.type === "screen" && f.fileName) {
      const label =
        f.control || String(f.fileName).replace(/\.fx$/i, "") || f.fileName;
      byFile.set(f.fileName, label);
    }
  }

  for (const fo of parsed.formulas || []) {
    if (fo.fileType === "screen" && fo.fileName && !byFile.has(fo.fileName)) {
      const label =
        fo.control || String(fo.fileName).replace(/\.fx$/i, "") || fo.fileName;
      byFile.set(fo.fileName, label);
    }
  }

  return [...byFile.entries()]
    .map(([fileName, label]) => ({ fileName, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * App-level `.fx` files for chart filters (e.g. App.fx). Label is a short chip title ("App" for App.fx).
 * @param {{ files?: unknown[]; formulas?: unknown[] } | null | undefined} parsed
 * @returns {{ fileName: string; label: string }[]}
 */
export function listAppFiles(parsed) {
  if (!parsed) return [];

  /** @type {Map<string, string>} */
  const byFile = new Map();

  for (const f of parsed.files || []) {
    if (f.type === "app" && f.fileName) {
      byFile.set(f.fileName, appFileChipLabel(f.fileName));
    }
  }

  for (const fo of parsed.formulas || []) {
    if (fo.fileType === "app" && fo.fileName && !byFile.has(fo.fileName)) {
      byFile.set(fo.fileName, appFileChipLabel(fo.fileName));
    }
  }

  return [...byFile.entries()]
    .map(([fileName, label]) => ({ fileName, label }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function appFileChipLabel(fileName) {
  const base = String(fileName).split(/[/\\]/).pop() || fileName;
  const stripped = base.replace(/\.fx$/i, "") || fileName;
  return stripped === "App" ? "App" : stripped;
}

function groupVariablesByName(variables) {
  const grouped = {};

  for (const variable of variables) {
    if (!grouped[variable.name]) {
      grouped[variable.name] = [];
    }
    grouped[variable.name].push(variable);
  }

  return grouped;
}

function buildMasterFx(formulas) {
  return formulas
    .map((formula) => ({
      key: formula.key,
      label: `${formula.control}.${formula.property}`,
      fileName: formula.fileName,
      control: formula.control,
      property: formula.property,
      formula: formula.formula,
      references: formula.references || {},
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildRelationships(formulas) {
  return formulas.map((formula) => ({
    key: formula.key,
    control: formula.control,
    property: formula.property,
    fileName: formula.fileName,
    sets: uniqueArray(formula.references?.variablesSet || []),
    usesVariables: uniqueArray(formula.references?.variablesUsed || []),
    usesControls: uniqueArray(formula.references?.controlsUsed || []),
    usesTables: uniqueArray(formula.references?.tablesUsed || []),
    usesColumns: uniqueArray(formula.references?.columnsUsed || []),
    usesFunctions: uniqueArray(formula.references?.functionsUsed || []),
  }));
}