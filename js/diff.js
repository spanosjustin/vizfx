import { formulaKey, escapeHtml } from "./utils.js";

export function compareVersions(parsedA, parsedB) {
  if (!parsedA || !parsedB) {
    return null;
  }

  const formulaMapA = new Map(parsedA.formulas.map((f) => [formulaKey(f), f]));
  const formulaMapB = new Map(parsedB.formulas.map((f) => [formulaKey(f), f]));

  const variableNamesA = new Set(parsedA.variables.map((v) => `${v.name}::${v.kind}::${v.scope}`));
  const variableNamesB = new Set(parsedB.variables.map((v) => `${v.name}::${v.kind}::${v.scope}`));

  const addedFormulas = [];
  const removedFormulas = [];
  const changedFormulas = [];

  for (const [key, formulaB] of formulaMapB) {
    if (!formulaMapA.has(key)) {
      addedFormulas.push(formulaB);
      continue;
    }

    const formulaA = formulaMapA.get(key);

    const formulaChanged =
      formulaA.formula !== formulaB.formula ||
      JSON.stringify(formulaA.references || {}) !== JSON.stringify(formulaB.references || {});

    if (formulaChanged) {
      changedFormulas.push({
        key,
        before: formulaA,
        after: formulaB,
      });
    }
  }

  for (const [key, formulaA] of formulaMapA) {
    if (!formulaMapB.has(key)) {
      removedFormulas.push(formulaA);
    }
  }

  const addedVariables = [...variableNamesB].filter((v) => !variableNamesA.has(v));
  const removedVariables = [...variableNamesA].filter((v) => !variableNamesB.has(v));

  const changedDataUsage = findChangedDataUsage(changedFormulas);

  return {
    addedFormulas,
    removedFormulas,
    changedFormulas,
    addedVariables,
    removedVariables,
    changedDataUsage,
  };
}

function findChangedDataUsage(changedFormulas) {
  return changedFormulas
    .filter(({ before, after }) => {
      const beforeTables = JSON.stringify(before.references?.tablesUsed || []);
      const afterTables = JSON.stringify(after.references?.tablesUsed || []);
      const beforeColumns = JSON.stringify(before.references?.columnsUsed || []);
      const afterColumns = JSON.stringify(after.references?.columnsUsed || []);

      return beforeTables !== afterTables || beforeColumns !== afterColumns;
    })
    .map(({ key, before, after }) => ({
      key,
      control: before.control,
      property: before.property,
      beforeTables: before.references?.tablesUsed || [],
      afterTables: after.references?.tablesUsed || [],
      beforeColumns: before.references?.columnsUsed || [],
      afterColumns: after.references?.columnsUsed || [],
    }));
}

export function renderDiffSummary(container, diffResult) {
  if (!diffResult) {
    container.innerHTML = `<div class="empty-state">Load two versions to compare.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="details-card">
      <p><strong>Added formulas:</strong> ${diffResult.addedFormulas.length}</p>
      <p><strong>Removed formulas:</strong> ${diffResult.removedFormulas.length}</p>
      <p><strong>Changed formulas:</strong> ${diffResult.changedFormulas.length}</p>
      <p><strong>Added variables:</strong> ${diffResult.addedVariables.length}</p>
      <p><strong>Removed variables:</strong> ${diffResult.removedVariables.length}</p>
      <p><strong>Changed data usage:</strong> ${diffResult.changedDataUsage.length}</p>
    </div>

    ${renderDiffItems("Added Formulas", diffResult.addedFormulas, "diff-added")}
    ${renderDiffItems("Removed Formulas", diffResult.removedFormulas, "diff-removed")}
    ${renderChangedFormulaItems(diffResult.changedFormulas)}
  `;
}

function renderDiffItems(title, items, className) {
  if (!items.length) return "";

  return `
    <div class="details-card">
      <h3>${escapeHtml(title)}</h3>
      ${items
        .map(
          (item) => `
            <div class="diff-item ${className}" role="button" tabindex="0" data-diff-item="true" data-key="${escapeHtml(
              formulaKey(item)
            )}" data-version="${className === "diff-removed" ? "A" : "B"}">
              <strong>${escapeHtml(item.control)}.${escapeHtml(item.property)}</strong><br>
              <span>${escapeHtml(item.fileName)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderChangedFormulaItems(items) {
  if (!items.length) return "";

  return `
    <div class="details-card">
      <h3>Changed Formulas</h3>
      ${items
        .map(
          ({ key, before }) => `
            <div class="diff-item diff-changed" role="button" tabindex="0" data-diff-item="true" data-key="${escapeHtml(
              key
            )}" data-version="B">
              <strong>${escapeHtml(before.control)}.${escapeHtml(before.property)}</strong><br>
              <span>${escapeHtml(before.fileName)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}