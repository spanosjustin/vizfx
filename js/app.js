import { state } from "./state.js";
import { readJsonFile, escapeHtml, formulaKey } from "./utils.js";
import { listScreens, listAppFiles, parsePowerAppJson } from "./parser.js";
import { renderGraph, updateGraphFocus, formulaKeysWeaklyConnectedInVisibleGraph } from "./renderer.js";
import {
  downloadSvgElementAsFile,
  renderLogicFlow,
  slugForLogicFlowExportFilename,
} from "./logic.js";
import { renderCodeView, getCodeViewCopyAllText } from "./code-view.js";
import {
  autoExpandSelectedLeaf,
  collectAllTreeDetailsNodeIds,
  renderTree,
} from "./tree.js";
import { renderDetails, renderFormulaDetails } from "./details.js";
import { compareVersions, renderDiffSummary } from "./diff.js";

/** Same “expand view” glyph as Logic Flow popout (`logic.js`). */
function graphDependencyExpandWindowIconSvg(contract) {
  const cls = contract
    ? "graph-expand-window-btn__icon graph-expand-window-btn__icon--contract"
    : "graph-expand-window-btn__icon";
  return `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <path d="M2 6.25A2.25 2.25 0 0 1 4.25 4h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 1 1.5 0v2.5A2.25 2.25 0 0 1 9.75 14h-5.5A2.25 2.25 0 0 1 2 11.75v-5.5z"></path>
  <path d="M9.25 2A.75.75 0 0 0 9.25 3.5h2.69L7.47 7.97a.75.75 0 1 0 1.06 1.06L13 4.56v2.69a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 13.75 2h-4.5z"></path>
</svg>`;
}

function graphDependencySubtreeFocusEyeSvg() {
  return `<svg class="graph-subtree-focus-btn__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M8 4C4.82 4 2.14 6.02 1.2 8c.94 1.98 3.62 4 6.8 4s5.86-2.02 6.8-4C13.86 6.02 11.18 4 8 4zm0 6.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"></path>
</svg>`;
}

function clearDependencyGraphSubtreeFocus() {
  state.dependencyGraphSubtreeFocus.A = false;
  state.dependencyGraphSubtreeFocus.B = false;
  state.codeViewRelatedOnlyFocus.A = false;
  state.codeViewRelatedOnlyFocus.B = false;
}

const fileAInput = document.getElementById("fileA");
const fileBInput = document.getElementById("fileB");
const compareBtn = document.getElementById("compareBtn");
const resetBtn = document.getElementById("resetBtn");
const loadSamplesBtn = document.getElementById("loadSamplesBtn");

const graphPaneA = document.getElementById("graphPaneA");
const graphPaneB = document.getElementById("graphPaneB");
const graphContainerA = document.getElementById("graphContainerA");
const graphContainerB = document.getElementById("graphContainerB");
const graphSvgA = document.getElementById("graphSvgA");
const graphSvgB = document.getElementById("graphSvgB");
const graphEmptyA = document.getElementById("graphEmptyA");
const graphEmptyB = document.getElementById("graphEmptyB");
const treeContainerA = document.getElementById("treeContainerA");
const treeContainerB = document.getElementById("treeContainerB");
const logicContainerA = document.getElementById("logicContainerA");
const logicContainerB = document.getElementById("logicContainerB");
const codeContainerA = document.getElementById("codeContainerA");
const codeContainerB = document.getElementById("codeContainerB");

const versionAChip = document.getElementById("versionAChip");
const versionBChip = document.getElementById("versionBChip");
const viewGraphBtn = document.getElementById("viewGraphBtn");
const viewTreeBtn = document.getElementById("viewTreeBtn");
const viewLogicBtn = document.getElementById("viewLogicBtn");
const viewCodeBtn = document.getElementById("viewCodeBtn");
const toggleTopbarBtn = document.getElementById("toggleTopbarBtn");
const focusedViewBtn = document.getElementById("focusedViewBtn");
const fullViewBtn = document.getElementById("fullViewBtn");
const exportViewBtn = document.getElementById("exportViewBtn");
const toggleLogicPaneABtn = document.getElementById("toggleLogicPaneA");
const toggleLogicPaneBBtn = document.getElementById("toggleLogicPaneB");

const versionAPath = document.getElementById("versionAPath");
const versionBPath = document.getElementById("versionBPath");
const graphPaneAPath = document.getElementById("graphPaneAPath");
const graphPaneBPath = document.getElementById("graphPaneBPath");
const graphPaneAScreenChips = document.getElementById("graphPaneAScreenChips");
const graphPaneBScreenChips = document.getElementById("graphPaneBScreenChips");
const centerPanel = document.querySelector(".center-panel");
const detailsPanel = document.getElementById("detailsPanel");
const masterFxList = document.getElementById("masterFxList");
const diffSummary = document.getElementById("diffSummary");
const appSummary = document.getElementById("appSummary");
const formulaSearch = document.getElementById("formulaSearch");
const treeSearchRowA = document.getElementById("treeSearchRowA");
const treeSearchRowB = document.getElementById("treeSearchRowB");
const treeSearchInputA = document.getElementById("treeSearchA");
const treeSearchInputB = document.getElementById("treeSearchB");
const appShell = document.getElementById("appShell");
const leftPanel = document.getElementById("leftPanel");
const collapseLeftPanelBtn = document.getElementById("collapseLeftPanelBtn");
const expandLeftPanelBtn = document.getElementById("expandLeftPanelBtn");
const rightPanel = document.getElementById("rightPanel");
const collapseRightPanelBtn = document.getElementById("collapseRightPanelBtn");
const expandRightPanelBtn = document.getElementById("expandRightPanelBtn");

const projectFilesView = document.getElementById("projectFilesView");
const addProjectPathDialog = document.getElementById("addProjectPathDialog");
const howItWorksBtn = document.getElementById("howItWorksBtn");
const howItWorksDialog = document.getElementById("howItWorksDialog");
const howItWorksCloseBtn = document.getElementById("howItWorksCloseBtn");
const addProjectPathForm = document.getElementById("addProjectPathForm");
const addProjectPathInput = document.getElementById("addProjectPathInput");
const addProjectPathCancel = document.getElementById("addProjectPathCancel");
const addProjectPathError = document.getElementById("addProjectPathError");
const projectFolderPicker = document.getElementById("projectFolderPicker");

/** Prefix for keys of JSON files loaded from a local folder (see `state.localProjectFolder`). */
const LOCAL_PROJECT_KEY_PREFIX = "local::";

const objectIdByRef = new WeakMap();
let nextObjectId = 1;

const LEFT_PANEL_COLLAPSIBLE_SECTIONS = [
  {
    key: "loadJson",
    sectionId: "loadJsonSection",
    btnId: "toggleLoadJsonBtn",
    label: "Load JSON",
  },
  {
    key: "folder",
    sectionId: "folderSection",
    btnId: "toggleFolderBtn",
    label: "Folder",
  },
  {
    key: "filters",
    sectionId: "filtersSection",
    btnId: "toggleFiltersBtn",
    label: "Filters",
  },
  {
    key: "masterFx",
    sectionId: "masterFxSection",
    btnId: "toggleMasterFxBtn",
    label: "Master FX",
  },
  {
    key: "versionDiff",
    sectionId: "versionDiffSection",
    btnId: "toggleVersionDiffBtn",
    label: "Version Diff",
  },
];

const PROJECT_DATA_MANIFEST_PATH = "./project-data/manifest.json";
const TIPS_JSON_PATH = "./project-data/tips.json";
const TIP_ROTATE_MS = 16000;

const headerTipEl = document.getElementById("headerTip");
const tipRotationToggleBtn = document.getElementById("tipRotationToggleBtn");
const prevTipBtn = document.getElementById("prevTipBtn");
const nextTipBtn = document.getElementById("nextTipBtn");

/** Shown when tips.json is missing, invalid, or fetch fails (silent fallback). */
const FALLBACK_HEADER_TIPS = [
  "Pick Version A and Version B JSON under Load JSON, then Compare Versions for Version Diff.",
  "Load Sample pulls bundled sample-data/demo-v1.json into Version A for a quick first look.",
  "Reset clears loaded versions, selections, custom paths, and related UI.",
  "Folder lists project-data/; use + to open a local folder of JSON, or URL to add a path.",
  "Filters, Master FX, and Version Diff work across Graph, Tree, Logic Flow, and Code views.",
  "Try demo-v1-1.json in A and demo-v1-2.json in B for a richer compare.",
  "Opening via file:// can block fetch or modules—use a local static server for reliable loading.",
];

let headerTipStrings = [];
let headerTipIndex = 0;
let headerTipIntervalId = null;
let headerTipRotationPaused = false;

/**
 * Built-in project-data entries from manifest.json (`undefined` until fetch completes).
 * @type {string[] | undefined}
 */
let projectDataBuiltinFiles;

/** Used when manifest.json is missing or invalid. */
const PROJECT_DATA_FILES_FALLBACK = [
  "demo-v1-1.json",
  "demo-v1-2.json",
  "demo-v2-1.json",
];

const toggleApp = document.getElementById("toggleApp");
const toggleScreens = document.getElementById("toggleScreens");
const toggleFiles = document.getElementById("toggleFiles");
const toggleFormulas = document.getElementById("toggleFormulas");
const toggleVariables = document.getElementById("toggleVariables");
const toggleTables = document.getElementById("toggleTables");
const toggleColumns = document.getElementById("toggleColumns");

bindEvents();
renderProjectFilesView();
loadProjectDataManifest();
loadHeaderTips();
refreshUI();

const graphCodeChipsResizeObserver = new ResizeObserver(() => {
  syncGraphCodeStickyOffsets();
});
graphPaneAScreenChips && graphCodeChipsResizeObserver.observe(graphPaneAScreenChips);
graphPaneBScreenChips && graphCodeChipsResizeObserver.observe(graphPaneBScreenChips);
window.addEventListener(
  "resize",
  () => {
    requestAnimationFrame(() => syncGraphCodeStickyOffsets());
  },
  { passive: true }
);

function openAddProjectPathDialog() {
  if (!addProjectPathDialog) return;
  if (addProjectPathError) {
    addProjectPathError.hidden = true;
    addProjectPathError.textContent = "";
  }
  if (addProjectPathInput) addProjectPathInput.value = "";
  addProjectPathDialog.showModal();
  queueMicrotask(() => addProjectPathInput?.focus());
}

function ingestLocalProjectFolderFromPicker() {
  if (!projectFolderPicker?.files?.length) return;

  const files = Array.from(projectFolderPicker.files);
  const jsonFiles = files.filter((f) => /\.json$/i.test(f.name));
  if (!jsonFiles.length) {
    alert("No JSON files were found in that folder.");
    projectFolderPicker.value = "";
    return;
  }

  jsonFiles.sort((a, b) =>
    String(a.webkitRelativePath || a.name).localeCompare(String(b.webkitRelativePath || b.name), undefined, {
      sensitivity: "base",
    })
  );

  const filesByKey = new Map();
  const relativePaths = [];

  for (const file of jsonFiles) {
    const rel = String(file.webkitRelativePath || file.name).replace(/\\/g, "/");
    const key = `${LOCAL_PROJECT_KEY_PREFIX}${rel}`;
    if (filesByKey.has(key)) continue;
    filesByKey.set(key, file);
    relativePaths.push(rel);
  }

  const firstRel = relativePaths[0] || "";
  const folderLabel = firstRel.includes("/") ? firstRel.slice(0, firstRel.indexOf("/")) : "Local folder";

  state.localProjectFolder = {
    folderLabel,
    filesByKey,
    relativePaths,
  };

  projectFolderPicker.value = "";
  renderProjectFilesView();
}

function clearLocalProjectFolder() {
  if (!state.localProjectFolder) return;
  const keys = new Set(state.localProjectFolder.filesByKey.keys());
  if (state.selectedProjectFileA && keys.has(state.selectedProjectFileA)) {
    clearProjectDataVersion("A");
  }
  if (state.selectedProjectFileB && keys.has(state.selectedProjectFileB)) {
    clearProjectDataVersion("B");
  }
  state.localProjectFolder = null;
  if (projectFolderPicker) projectFolderPicker.value = "";
  renderProjectFilesView();
}

function getDocumentFullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

/**
 * While dependency expanded view is active: saved `leftPanelCollapsed` / `rightPanelCollapsed`
 * to restore after exiting browser fullscreen. Non-null only for our expand session.
 */
let dependencyFullscreenPanelRestore = null;

function isDependencyGraphShellFullscreen() {
  const fs = getDocumentFullscreenElement();
  return Boolean(
    appShell && fs === appShell && dependencyFullscreenPanelRestore !== null
  );
}

function syncDependencyGraphFullscreenFit() {
  const fs = getDocumentFullscreenElement();
  const hadDependencySession = dependencyFullscreenPanelRestore !== null;

  refreshDependencyGraphScreenChips();

  if (fs === appShell) {
    if (dependencyFullscreenPanelRestore !== null) {
      appShell?.classList?.add?.("app-shell--dependency-fullscreen");
      refreshLeftPanelUI();
      refreshRightPanelUI();
      requestAnimationFrame(() => {
        if (state.viewMode === "graph") {
          fitGraphViewport("A");
          fitGraphViewport("B");
        }
      });
    }
    return;
  }

  appShell?.classList?.remove?.("app-shell--dependency-fullscreen");

  if (hadDependencySession && fs !== appShell) {
    if (dependencyFullscreenPanelRestore) {
      state.leftPanelCollapsed = dependencyFullscreenPanelRestore.left;
      state.rightPanelCollapsed = dependencyFullscreenPanelRestore.right;
      dependencyFullscreenPanelRestore = null;
    }
    refreshLeftPanelUI();
    refreshRightPanelUI();
    requestAnimationFrame(() => {
      if (state.viewMode === "graph") {
        fitGraphViewport("A");
        fitGraphViewport("B");
      }
    });
  }
}

function toggleDependencyGraphFullscreen(version) {
  if (state.viewMode !== "graph") return;
  if (!appShell) return;
  const fs = getDocumentFullscreenElement();
  if (fs === appShell) {
    if (typeof document.exitFullscreen === "function") {
      void document.exitFullscreen();
    } else if (typeof document.webkitExitFullscreen === "function") {
      void document.webkitExitFullscreen();
    }
    return;
  }

  const saved = {
    left: !!state.leftPanelCollapsed,
    right: !!state.rightPanelCollapsed,
  };
  dependencyFullscreenPanelRestore = saved;
  state.leftPanelCollapsed = false;
  state.rightPanelCollapsed = false;
  refreshLeftPanelUI();
  refreshRightPanelUI();

  const enter = () => {
    if (typeof appShell.requestFullscreen === "function") {
      return appShell.requestFullscreen({ navigationUI: "hide" });
    }
    if (typeof appShell.webkitRequestFullscreen === "function") {
      appShell.webkitRequestFullscreen();
      return undefined;
    }
    return Promise.reject(new Error("Fullscreen not supported"));
  };

  const p = enter();
  if (p && typeof p.then === "function") {
    void p
      .then(() => {
        refreshLeftPanelUI();
        refreshRightPanelUI();
      })
      .catch(() => {
        dependencyFullscreenPanelRestore = null;
        state.leftPanelCollapsed = saved.left;
        state.rightPanelCollapsed = saved.right;
        refreshLeftPanelUI();
        refreshRightPanelUI();
      });
  }
}

function bindEvents() {
  fileAInput.addEventListener("change", async () => {
    try {
      const file = fileAInput.files?.[0];
      if (!file) return;
      state.versionA = await readJsonFile(fileAInput.files[0]);
      state.parsedA = parsePowerAppJson(state.versionA);
      resetTreeExpansionStateForPane("A");
      state.sourcePathA = file.name;
      state.dependencyGraphScreenFilterFileA = null;
      refreshUI();
    } catch (error) {
      alert(error.message);
    }
  });

  fileBInput.addEventListener("change", async () => {
    try {
      const file = fileBInput.files?.[0];
      if (!file) return;
      state.versionB = await readJsonFile(fileBInput.files[0]);
      state.parsedB = parsePowerAppJson(state.versionB);
      resetTreeExpansionStateForPane("B");
      state.sourcePathB = file.name;
      state.dependencyGraphScreenFilterFileB = null;
      refreshUI();
    } catch (error) {
      alert(error.message);
    }
  });

  compareBtn.addEventListener("click", () => {
    refreshDiff();
  });

  resetBtn.addEventListener("click", () => {
    state.versionA = null;
    state.versionB = null;
    state.parsedA = null;
    state.parsedB = null;
    resetTreeExpansionStateForPane("A");
    resetTreeExpansionStateForPane("B");
    state.selectedNode = null;
    state.hoveredNodeIdA = null;
    state.hoveredNodeIdB = null;
    state.selectedProjectFileA = null;
    state.selectedProjectFileB = null;
    state.customProjectPaths = [];
    state.localProjectFolder = null;
    if (projectFolderPicker) projectFolderPicker.value = "";
    state.sourcePathA = null;
    state.sourcePathB = null;
    state.activeGraphVersion = "A";
    state.viewMode = "graph";
    state.logicPaneCollapsed = { A: false, B: false };
    state.logicSharedSelectionKey = null;
    state.logicPaneSelectionKey = { A: null, B: null };
    state.logicPaneSelectionIsOverridden = { A: false, B: false };
    state.dependencyGraphScreenFilterFileA = null;
    state.dependencyGraphScreenFilterFileB = null;
    clearDependencyGraphSubtreeFocus();

    if (getDocumentFullscreenElement() === appShell) {
      if (typeof document.exitFullscreen === "function") void document.exitFullscreen();
      else if (typeof document.webkitExitFullscreen === "function") void document.webkitExitFullscreen();
    }
    dependencyFullscreenPanelRestore = null;
    appShell?.classList?.remove?.("app-shell--dependency-fullscreen");

    state.graphViewport = {
      A: { scale: 1, tx: 0, ty: 0 },
      B: { scale: 1, tx: 0, ty: 0 },
    };
    state.logicViewport = {
      A: { scale: 1, tx: 0, ty: 0, selectionToken: null },
      B: { scale: 1, tx: 0, ty: 0, selectionToken: null },
    };

    fileAInput.value = "";
    fileBInput.value = "";
    formulaSearch.value = "";
    treeSearchInputA && (treeSearchInputA.value = "");
    treeSearchInputB && (treeSearchInputB.value = "");

    refreshUI();
  });

  // Graph zoom/pan interactions (Dependency graph view only).
  bindGraphViewportInteractions("A", graphSvgA, graphContainerA);
  bindGraphViewportInteractions("B", graphSvgB, graphContainerB);

  loadSamplesBtn.addEventListener("click", async () => {
    try {
      const path = "./sample-data/demo-v1.json";
      const response = await fetch(path);
      const json = await response.json();
      state.versionA = json;
      state.parsedA = parsePowerAppJson(json);
      resetTreeExpansionStateForPane("A");
      state.sourcePathA = path;
      state.dependencyGraphScreenFilterFileA = null;
      refreshUI();
    } catch (error) {
      alert("Could not load sample JSON.");
    }
  });

  versionAChip?.addEventListener("click", () => {
    setActiveGraphVersion("A");
  });

  versionBChip?.addEventListener("click", () => {
    setActiveGraphVersion("B");
  });

  viewGraphBtn?.addEventListener("click", () => {
    setViewMode("graph");
  });

  viewTreeBtn?.addEventListener("click", () => {
    setViewMode("tree");
  });

  viewLogicBtn?.addEventListener("click", () => {
    setViewMode("logic");
  });

  toggleLogicPaneABtn?.addEventListener("click", () => {
    if (state.viewMode !== "logic") return;
    if (state.logicPaneCollapsed.B && !state.logicPaneCollapsed.A) {
      swapLogicPaneCollapsedSides();
    } else {
      toggleLogicPaneCollapsed("A");
    }
  });

  toggleLogicPaneBBtn?.addEventListener("click", () => {
    if (state.viewMode !== "logic") return;
    if (state.logicPaneCollapsed.A && !state.logicPaneCollapsed.B) {
      swapLogicPaneCollapsedSides();
    } else {
      toggleLogicPaneCollapsed("B");
    }
  });

  viewCodeBtn?.addEventListener("click", () => {
    setViewMode("code");
  });

  centerPanel?.addEventListener("click", (e) => {
    const expandAllBtn = e.target?.closest?.(".tree-expand-all-view-btn");
    const collapseAllBtn = e.target?.closest?.(".tree-collapse-all-view-btn");
    const treeToggleAllBtn = expandAllBtn || collapseAllBtn;
    if (treeToggleAllBtn && treeToggleAllBtn.closest(".graph-screen-chips")) {
      if (state.viewMode !== "tree") return;
      const version = treeToggleAllBtn.dataset.version;
      if (version !== "A" && version !== "B") return;

      const parsed = version === "B" ? state.parsedB : state.parsedA;
      const screenFilterFile =
        version === "B"
          ? state.dependencyGraphScreenFilterFileB
          : state.dependencyGraphScreenFilterFileA;
      const parsedForPane = filterParsedForScreen(parsed, screenFilterFile);

      const expandedSet = state.treeExpandedDetailsByPane?.[version];
      if (!expandedSet) return;

      // Suppress `autoExpandSelectedLeaf()` for this refresh so we don't add/remove
      // expansion state as a side-effect of selection visibility.
      state.treeAutoExpandSelectedLeafOnce = false;

      if (expandAllBtn) {
        expandedSet.clear();
        const allNodeIds = collectAllTreeDetailsNodeIds(parsedForPane);
        for (const nodeId of allNodeIds) expandedSet.add(nodeId);

        // Prevent reseeding "top-level" file groups during the next render.
        if (state.treeExpandedDetailsInitializedByPane) {
          state.treeExpandedDetailsInitializedByPane[version] = true;
        }
      } else {
        expandedSet.clear();

        // Prevent reseeding "top-level" file groups during the next render.
        if (state.treeExpandedDetailsInitializedByPane) {
          state.treeExpandedDetailsInitializedByPane[version] = true;
        }
      }

      refreshGraph();
      return;
    }

    // Code view reuses graph chip button classes for layout; handle by `data-action` before graph handlers.
    const scrollSelectedCodeBtn = e.target?.closest?.("[data-action='code-scroll-selected']");
    if (scrollSelectedCodeBtn && scrollSelectedCodeBtn.closest(".graph-screen-chips")) {
      if (state.viewMode !== "code") return;
      const version = scrollSelectedCodeBtn.dataset.version;
      if (version !== "A" && version !== "B") return;
      scrollCodeViewToSelectedFormula(version);
      return;
    }

    const copyAllFloating = e.target?.closest?.("[data-action='code-copy-all-floating']");
    if (copyAllFloating && copyAllFloating.closest(".graph-screen-chips")) {
      if (state.viewMode !== "code") return;
      const version = copyAllFloating.dataset.version;
      if (version !== "A" && version !== "B") return;
      const parsed = version === "B" ? state.parsedB : state.parsedA;
      const screenFilter =
        version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
      const parsedForPane = parsed ? filterParsedForScreen(parsed, screenFilter) : null;
      const keysFilter = getCodeViewVisibleFormulaKeysForPane(version);
      const text = getCodeViewCopyAllText(parsedForPane, keysFilter);
      if (!text) return;
      (async () => {
        try {
          await navigator.clipboard.writeText(text);
          const prev = copyAllFloating.textContent;
          copyAllFloating.textContent = "Copied";
          window.setTimeout(() => {
            copyAllFloating.textContent = prev;
          }, 1000);
        } catch {
          /* ignore */
        }
      })();
      return;
    }

    const focusBtn = e.target?.closest?.(".graph-focus-selected-view-btn");
    if (focusBtn && focusBtn.closest(".graph-screen-chips")) {
      const version = focusBtn.dataset.version;
      if (version === "A" || version === "B") focusAndFitSelected(version);
      return;
    }

    const centerBtn = e.target?.closest?.(".graph-center-view-btn");
    if (centerBtn && centerBtn.closest(".graph-screen-chips")) {
      const version = centerBtn.dataset.version;
      if (version === "A" || version === "B") centerGraphViewport(version);
      return;
    }

    const fitBtn = e.target?.closest?.(".graph-fit-view-btn");
    if (fitBtn && fitBtn.closest(".graph-screen-chips")) {
      const version = fitBtn.dataset.version;
      if (version === "A" || version === "B") fitGraphViewport(version);
      return;
    }

    const expandWinBtn = e.target?.closest?.(".graph-expand-window-btn");
    if (expandWinBtn && expandWinBtn.closest(".graph-screen-chips")) {
      const version = expandWinBtn.dataset.version;
      if (version === "A" || version === "B") toggleDependencyGraphFullscreen(version);
      return;
    }

    const codeRelatedOnlyBtn = e.target?.closest?.("[data-action='code-related-only']");
    if (codeRelatedOnlyBtn && codeRelatedOnlyBtn.closest(".graph-screen-chips")) {
      if (state.viewMode !== "code") return;
      const version = codeRelatedOnlyBtn.dataset.version;
      if (version !== "A" && version !== "B") return;
      if (codeRelatedOnlyBtn.disabled) return;
      state.codeViewRelatedOnlyFocus[version] = !state.codeViewRelatedOnlyFocus[version];
      refreshDependencyGraphScreenChips();
      refreshGraph();
      return;
    }

    const subtreeFocusBtn = e.target?.closest?.(".graph-subtree-focus-btn");
    if (subtreeFocusBtn && subtreeFocusBtn.closest(".graph-screen-chips")) {
      if (state.viewMode !== "graph") return;
      const version = subtreeFocusBtn.dataset.version;
      if (version !== "A" && version !== "B") return;
      if (subtreeFocusBtn.disabled) return;
      state.dependencyGraphSubtreeFocus[version] =
        !state.dependencyGraphSubtreeFocus[version];
      refreshDependencyGraphScreenChips();
      refreshGraph();
      return;
    }

    const chip = e.target.closest(".graph-screen-chip");
    if (!chip || !chip.closest(".graph-screen-chips")) return;

    const version = chip.dataset.version;
    if (version !== "A" && version !== "B") return;

    if (chip.dataset.screenScope === "all") {
      if (version === "A") state.dependencyGraphScreenFilterFileA = null;
      else state.dependencyGraphScreenFilterFileB = null;
    } else {
      const enc = chip.getAttribute("data-screen-file");
      const fileName = enc ? decodeURIComponent(enc) : null;
      if (!fileName) return;
      if (version === "A") state.dependencyGraphScreenFilterFileA = fileName;
      else state.dependencyGraphScreenFilterFileB = fileName;
    }

    // In tree mode, reset expansion so the filtered tree has a predictable
    // initial expanded root set.
    if (state.viewMode === "tree") resetTreeExpansionStateForPane(version);

    refreshDependencyGraphScreenChips();
    refreshGraph();
  });

  toggleTopbarBtn?.addEventListener("click", () => {
    state.topbarCollapsed = !state.topbarCollapsed;
    refreshTopbarUI();
  });

  focusedViewBtn?.addEventListener("click", () => {
    state.leftPanelCollapsed = true;
    state.rightPanelCollapsed = true;
    refreshLeftPanelUI();
    refreshRightPanelUI();
  });

  fullViewBtn?.addEventListener("click", () => {
    state.leftPanelCollapsed = false;
    state.rightPanelCollapsed = false;
    refreshLeftPanelUI();
    refreshRightPanelUI();
  });

  exportViewBtn?.addEventListener("click", () => {
    exportCurrentMainView();
  });

  collapseLeftPanelBtn?.addEventListener("click", () => {
    state.leftPanelCollapsed = !state.leftPanelCollapsed;
    refreshLeftPanelUI();
  });

  expandLeftPanelBtn?.addEventListener("click", () => {
    state.leftPanelCollapsed = false;
    refreshLeftPanelUI();
  });

  collapseRightPanelBtn?.addEventListener("click", () => {
    state.rightPanelCollapsed = !state.rightPanelCollapsed;
    refreshRightPanelUI();
  });

  expandRightPanelBtn?.addEventListener("click", () => {
    state.rightPanelCollapsed = false;
    refreshRightPanelUI();
  });

  window.matchMedia("(max-width: 1200px)").addEventListener("change", () => {
    refreshRightPanelUI();
  });

  formulaSearch.addEventListener("input", () => {
    renderMasterFx();
  });

  const debounce = (fn, waitMs = 150) => {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), waitMs);
    };
  };

  const refreshTreeFromSearchDebounced = debounce(() => {
    if (state.viewMode !== "tree") return;
    refreshGraph();
  });

  treeSearchInputA?.addEventListener("input", () => {
    refreshTreeFromSearchDebounced();
  });
  treeSearchInputB?.addEventListener("input", () => {
    refreshTreeFromSearchDebounced();
  });

  diffSummary?.addEventListener("click", (event) => {
    const target = event.target?.closest?.(".diff-item[data-diff-item='true']");
    if (!target) return;

    const version = target.dataset.version;
    const key = target.dataset.key;
    if (!key || (version !== "A" && version !== "B")) return;

    const parsed = version === "B" ? state.parsedB : state.parsedA;
    const formula = parsed?.formulasByKey?.[key];
    if (!formula) return;

    applyGlobalFormulaSelection(version, formula);
    setActiveGraphVersion(version);
    renderInspectorItem(formula);
    refreshGraph();
    refreshDependencyGraphScreenChips();
    renderMasterFx();
  });

  diffSummary?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target?.closest?.(".diff-item[data-diff-item='true']");
    if (!target) return;
    event.preventDefault();
    target.click();
  });

  [toggleApp, toggleScreens, toggleFiles, toggleFormulas, toggleVariables, toggleTables, toggleColumns].forEach((input) => {
    if (!input) return;
    input.addEventListener("change", () => {
      state.filters.app = toggleApp?.checked ?? true;
      state.filters.screens = toggleScreens?.checked ?? true;
      state.filters.files = toggleFiles.checked;
      state.filters.formulas = toggleFormulas.checked;
      state.filters.variables = toggleVariables.checked;
      state.filters.tables = toggleTables.checked;
      state.filters.columns = toggleColumns.checked;
      refreshGraph();
    });
  });

  bindLeftPanelCollapsibleSections();

  projectFilesView?.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-action='open-project-folder']")) {
      event.preventDefault();
      event.stopPropagation();
      if (projectFolderPicker) {
        projectFolderPicker.value = "";
        projectFolderPicker.click();
      }
      return;
    }
    if (event.target.closest?.("[data-action='clear-local-project-folder']")) {
      event.preventDefault();
      event.stopPropagation();
      clearLocalProjectFolder();
      return;
    }
    if (!event.target.closest?.("[data-action='add-project-path']")) return;
    event.preventDefault();
    event.stopPropagation();
    openAddProjectPathDialog();
  });

  projectFolderPicker?.addEventListener("change", () => {
    ingestLocalProjectFolderFromPicker();
  });

  addProjectPathCancel?.addEventListener("click", () => {
    addProjectPathDialog?.close();
  });

  howItWorksBtn?.addEventListener("click", () => {
    howItWorksDialog?.showModal();
  });
  howItWorksCloseBtn?.addEventListener("click", () => {
    howItWorksDialog?.close();
  });
  howItWorksDialog?.addEventListener("click", (event) => {
    if (event.target === howItWorksDialog) howItWorksDialog.close();
  });

  addProjectPathForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!addProjectPathInput || !addProjectPathError) return;

    addProjectPathError.hidden = true;
    addProjectPathError.textContent = "";

    const raw = addProjectPathInput.value;
    const submitBtn = document.getElementById("addProjectPathSubmit");

    if (submitBtn) submitBtn.disabled = true;
    try {
      const path = normalizeUserProjectPath(raw);
      if (state.customProjectPaths.includes(path)) {
        addProjectPathDialog?.close();
        return;
      }
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Could not load (${response.status}). Check the path or server.`);
      }
      const json = await response.json();
      parsePowerAppJson(json);
      state.customProjectPaths.push(path);
      addProjectPathDialog?.close();
      renderProjectFilesView();
    } catch (error) {
      addProjectPathError.textContent = error?.message || "Could not add this path.";
      addProjectPathError.hidden = false;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.addEventListener("fullscreenchange", syncDependencyGraphFullscreenFit);
  document.addEventListener("webkitfullscreenchange", syncDependencyGraphFullscreenFit);
}

function normalizeDependencyGraphScreenFilters() {
  for (const slot of ["A", "B"]) {
    const parsed = slot === "B" ? state.parsedB : state.parsedA;
    const key =
      slot === "B"
        ? "dependencyGraphScreenFilterFileB"
        : "dependencyGraphScreenFilterFileA";
    if (!parsed) {
      state[key] = null;
      continue;
    }
    const names = new Set(listScreens(parsed).map((s) => s.fileName));
    for (const a of listAppFiles(parsed)) {
      names.add(a.fileName);
    }
    if (!state[key] || !names.has(state[key])) {
      state[key] = null;
    }
  }
}

function refreshDependencyGraphScreenChips() {
  renderScreenChipsForPane(
    "A",
    graphPaneAScreenChips,
    state.parsedA,
    state.dependencyGraphScreenFilterFileA
  );
  renderScreenChipsForPane(
    "B",
    graphPaneBScreenChips,
    state.parsedB,
    state.dependencyGraphScreenFilterFileB
  );
}

/** Code View: pixel offset for sticky `.code-view-ide-toolbar` below `.graph-screen-chips` (wrap-aware). */
function syncGraphCodeStickyOffsets() {
  if (state.viewMode !== "code") {
    graphContainerA?.style.removeProperty("--graph-code-chips-sticky-offset");
    graphContainerB?.style.removeProperty("--graph-code-chips-sticky-offset");
    return;
  }
  for (const chips of [graphPaneAScreenChips, graphPaneBScreenChips]) {
    const gc = chips?.parentElement;
    if (!gc?.classList?.contains("graph-container")) continue;
    if (!chips || chips.hidden) {
      gc.style.setProperty("--graph-code-chips-sticky-offset", "0px");
      continue;
    }
    const h = Math.ceil(chips.getBoundingClientRect().height);
    gc.style.setProperty("--graph-code-chips-sticky-offset", `${h}px`);
  }
}

function renderScreenChipsForPane(version, container, parsed, selectedFileName) {
  if (!container) return;

  const screens = parsed ? listScreens(parsed) : [];
  const appFiles = parsed ? listAppFiles(parsed) : [];
  const selectedId = graphHighlightIdForPane(version);
  const isSelectedInPane = state.activeGraphVersion === version && Boolean(state.selectedNode);

  const isTreeMode = state.viewMode === "tree";
  const isCodeMode = state.viewMode === "code";
  const showGraph = Boolean(
    parsed && state.viewMode === "graph" && (screens.length > 0 || appFiles.length > 0 || isSelectedInPane)
  );
  const showTree = Boolean(parsed && isTreeMode);
  // Code view: always show scope row when parsed (All + screens, or All-only “full app” when no screen files).
  const showCode = Boolean(parsed && isCodeMode);
  const show = Boolean(showGraph || showTree || showCode);

  if (!show) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;

  if (isTreeMode) {
    const esc = escapeHtml;
    const allActive = !selectedFileName ? " is-active" : "";
    let html = "";

    // Scope selector: All, App (if present), then screens (same model as dependency graph view).
    const hasScopeChips = screens.length > 0 || appFiles.length > 0;
    if (hasScopeChips) {
      html += `<button type="button" class="graph-screen-chip${allActive}" data-version="${version}" data-screen-scope="all" aria-pressed="${!selectedFileName}">All</button>`;

      for (const { fileName, label } of appFiles) {
        const active = selectedFileName === fileName ? " is-active" : "";
        const encFile = encodeURIComponent(fileName);
        const safeLabel = esc(label);
        html += `<button type="button" class="graph-screen-chip${active}" data-version="${version}" data-screen-file="${encFile}" aria-pressed="${selectedFileName === fileName}">${safeLabel}</button>`;
      }

      for (const { fileName, label } of screens) {
        const active = selectedFileName === fileName ? " is-active" : "";
        const encFile = encodeURIComponent(fileName);
        const safeLabel = esc(label);
        html += `<button type="button" class="graph-screen-chip${active}" data-version="${version}" data-screen-file="${encFile}" aria-pressed="${selectedFileName === fileName}">${safeLabel}</button>`;
      }
    }

    // Tree utility buttons: aligned to the far right (per-pane).
    html += `<button type="button" class="graph-center-view-btn tree-expand-all-view-btn" data-version="${version}" aria-label="Expand all tree nodes" title="Expand all tree nodes">Expand All</button>`;
    html += `<button type="button" class="graph-center-view-btn tree-collapse-all-view-btn" data-version="${version}" aria-label="Collapse all tree nodes" title="Collapse all tree nodes">Collapse All</button>`;

    container.innerHTML = html;
    return;
  }

  const esc = escapeHtml;
  const allActive = !selectedFileName ? " is-active" : "";
  let html = "";

  const hasScopeChips = screens.length > 0 || appFiles.length > 0;
  if (hasScopeChips) {
    html += `<button type="button" class="graph-screen-chip${allActive}" data-version="${version}" data-screen-scope="all" aria-pressed="${!selectedFileName}">All</button>`;

    for (const { fileName, label } of appFiles) {
      const active = selectedFileName === fileName ? " is-active" : "";
      const encFile = encodeURIComponent(fileName);
      const safeLabel = esc(label);
      html += `<button type="button" class="graph-screen-chip${active}" data-version="${version}" data-screen-file="${encFile}" aria-pressed="${selectedFileName === fileName}">${safeLabel}</button>`;
    }

    for (const { fileName, label } of screens) {
      const active = selectedFileName === fileName ? " is-active" : "";
      const encFile = encodeURIComponent(fileName);
      const safeLabel = esc(label);
      html += `<button type="button" class="graph-screen-chip${active}" data-version="${version}" data-screen-file="${encFile}" aria-pressed="${selectedFileName === fileName}">${safeLabel}</button>`;
    }
  } else if (isCodeMode) {
    // No screen files: still show All (full-app scope) so Code view keeps a scope row.
    html += `<button type="button" class="graph-screen-chip${allActive}" data-version="${version}" data-screen-scope="all" aria-pressed="${!selectedFileName}">All</button>`;
  }

  if (isCodeMode) {
    const codeSelectedKey = resolveFormulaKeyForCodePaneScroll(version);
    const selectedBtnDisabled = !codeSelectedKey;
    const relatedFocusOn = state.codeViewRelatedOnlyFocus[version];
    html += `<button type="button" class="graph-subtree-focus-btn${
      relatedFocusOn ? " is-active" : ""
    }" data-version="${version}" data-action="code-related-only" aria-label="${
      relatedFocusOn ? "Show all formulas in scope" : "Show only formulas connected to the selection"
    }" title="${
      relatedFocusOn
        ? "Show all formulas in scope"
        : "Hide formulas that are not in the same connected group as the selection (same as dependency graph eye)"
    }" aria-pressed="${relatedFocusOn}"${
      selectedBtnDisabled ? " disabled aria-disabled=\"true\"" : ""
    }>${graphDependencySubtreeFocusEyeSvg()}</button>`;
    html += `<button type="button" class="graph-focus-selected-view-btn" data-version="${version}" data-action="code-scroll-selected" aria-label="Scroll to selected formula in code" title="Scroll to selected formula in code"${
      selectedBtnDisabled ? " disabled aria-disabled=\"true\"" : ""
    }>Selected</button>`;
    html += `<button type="button" class="graph-center-view-btn graph-code-copy-all-btn" data-version="${version}" data-action="code-copy-all-floating" aria-label="Copy all formulas in scope" title="Copy all formulas in scope">Copy all</button>`;
  }

  if (!isCodeMode) {
    const selectedBtnDisabled = !isSelectedInPane;
    html += `<button type="button" class="graph-focus-selected-view-btn" data-version="${version}" aria-label="Center and fit selected item" title="Center and fit selected item"${
      selectedBtnDisabled ? " disabled aria-disabled=\"true\"" : ""
    }>Selected</button>`;

    // Dependency graph view utility button: center graph, aligned to the right.
    html += `<button type="button" class="graph-center-view-btn" data-version="${version}" aria-label="Center dependency" title="Center dependency">Center</button>`;

    // Dependency graph view utility button: fit whole graph, aligned to the right.
    html += `<button type="button" class="graph-fit-view-btn" data-version="${version}" aria-label="Fit dependency to view" title="Fit dependency to view">Fit</button>`;

    if (state.viewMode === "graph") {
      const inFs = isDependencyGraphShellFullscreen();
      const subtreeOn = state.dependencyGraphSubtreeFocus[version];
      const eyeDisabled = !isSelectedInPane;
      html += `<button type="button" class="graph-expand-window-btn" data-version="${version}" aria-label="${
        inFs ? "Exit fullscreen" : "Expand dependency window"
      }" title="${inFs ? "Exit fullscreen" : "Expand window (fullscreen)"}">${graphDependencyExpandWindowIconSvg(inFs)}</button>`;
      html += `<div class="graph-screen-chips-util-secondary-row" role="group" aria-label="Dependency graph extra controls">`;
      html += `<button type="button" class="graph-subtree-focus-btn${
        subtreeOn ? " is-active" : ""
      }" data-version="${version}" aria-label="${
        subtreeOn ? "Show full graph" : "Hide nodes not connected to selection"
      }" title="${
        subtreeOn
          ? "Show full graph"
          : "Hide everything except the selected node and nodes connected to it by edges"
      }" aria-pressed="${subtreeOn}"${
        eyeDisabled ? " disabled aria-disabled=\"true\"" : ""
      }>${graphDependencySubtreeFocusEyeSvg()}</button>`;
      html += `</div>`;
    }
  }

  container.innerHTML = html;
}

function refreshUI() {
  normalizeDependencyGraphScreenFilters();
  refreshDependencyGraphScreenChips();
  refreshGraph();
  renderMasterFx();
  renderInspectorItem(state.selectedNode);
  refreshDiff();
  refreshSummary();
  renderProjectFilesView();
  refreshVersionPaths();
  refreshGraphToggleUI();
  refreshViewToggleUI();
  refreshLeftPanelUI();
  refreshRightPanelUI();
  refreshTopbarUI();
  refreshLeftPanelCollapsibleSections();
  requestAnimationFrame(() => {
    syncGraphCodeStickyOffsets();
  });
}

const GRAPH_VIEWPORT_MIN_SCALE = 0.5;
const GRAPH_VIEWPORT_MAX_SCALE = 2.5;
/** >1 inflates the fit box around the selected node (same center, slightly more zoomed out). */
const GRAPH_FOCUS_FIT_ZOOM_OUT_MARGIN = 3;
const GRAPH_ZOOM_SENSITIVITY = 0.0015; // Wheel delta -> exponential zoom factor.
const GRAPH_PAN_DRAG_THRESHOLD_PX = 3;
const GRAPH_PAN_SUPPRESS_CLICK_MS = 250;

const graphPanSuppressUntilByVersion = {
  A: 0,
  B: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clientToSvgPoint(svg, clientX, clientY) {
  const ctm = svg?.getScreenCTM?.();
  if (!ctm) return { x: clientX, y: clientY };

  const inv = ctm.inverse();
  const pt =
    typeof svg.createSVGPoint === "function"
      ? svg.createSVGPoint()
      : new DOMPoint(clientX, clientY);
  pt.x = clientX;
  pt.y = clientY;
  const res = pt.matrixTransform(inv);
  return { x: res.x, y: res.y };
}

function applyGraphViewportTransform(svg, version) {
  if (!svg) return;
  const viewport = svg.querySelector?.(".graph-viewport");
  const v = state.graphViewport?.[version];
  if (!viewport || !v) return;

  viewport.setAttribute(
    "transform",
    `translate(${v.tx} ${v.ty}) scale(${v.scale})`
  );
}

function centerGraphViewport(version) {
  if (state.viewMode !== "graph") return;

  const svg = version === "B" ? graphSvgB : graphSvgA;
  const container = version === "B" ? graphContainerB : graphContainerA;
  if (!svg || !container) return;

  const viewport = svg.querySelector?.(".graph-viewport");
  const v = state.graphViewport?.[version];
  if (!viewport || !v) return;

  // Compute the target point as the visual center of the scroll container.
  const containerRect = container.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0) return;

  const targetClientX = containerRect.left + containerRect.width / 2;
  const targetClientY = containerRect.top + containerRect.height / 2;
  const targetSvgPoint = clientToSvgPoint(svg, targetClientX, targetClientY);

  // Measure the graph content bounds in untransformed coordinates.
  const prevTransform = viewport.getAttribute("transform");
  viewport.setAttribute("transform", "");
  const bbox = viewport.getBBox?.();
  viewport.setAttribute("transform", prevTransform);
  if (!bbox || bbox.width === 0 || bbox.height === 0) return;

  const bboxCenterX = bbox.x + bbox.width / 2;
  const bboxCenterY = bbox.y + bbox.height / 2;

  // transform: p' = p*scale + translate  (matches our other zoom math)
  v.tx = targetSvgPoint.x - bboxCenterX * v.scale;
  v.ty = targetSvgPoint.y - bboxCenterY * v.scale;
  applyGraphViewportTransform(svg, version);
}

function fitGraphViewport(version) {
  if (state.viewMode !== "graph") return;

  const svg = version === "B" ? graphSvgB : graphSvgA;
  const container = version === "B" ? graphContainerB : graphContainerA;
  if (!svg || !container) return;

  const viewport = svg.querySelector?.(".graph-viewport");
  const v = state.graphViewport?.[version];
  if (!viewport || !v) return;

  const containerRect = container.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0) return;

  // Measure the graph content bounds in untransformed coordinates.
  const prevTransform = viewport.getAttribute("transform");
  viewport.setAttribute("transform", "");
  let bbox = null;
  try {
    bbox = viewport.getBBox?.();
  } finally {
    viewport.setAttribute("transform", prevTransform);
  }

  if (!bbox || bbox.width === 0 || bbox.height === 0) return;

  const paddingPx = 24;
  const availableWidth = Math.max(1, containerRect.width - paddingPx * 2);
  const availableHeight = Math.max(1, containerRect.height - paddingPx * 2);

  // Choose the largest uniform scale that fits both width and height.
  const nextScale = clamp(
    Math.min(availableWidth / bbox.width, availableHeight / bbox.height),
    GRAPH_VIEWPORT_MIN_SCALE,
    GRAPH_VIEWPORT_MAX_SCALE
  );

  // Center the fitted bbox within the scroll container.
  const targetClientX = containerRect.left + containerRect.width / 2;
  const targetClientY = containerRect.top + containerRect.height / 2;
  const targetSvgPoint = clientToSvgPoint(svg, targetClientX, targetClientY);

  const bboxCenterX = bbox.x + bbox.width / 2;
  const bboxCenterY = bbox.y + bbox.height / 2;

  v.scale = nextScale;
  v.tx = targetSvgPoint.x - bboxCenterX * v.scale;
  v.ty = targetSvgPoint.y - bboxCenterY * v.scale;
  applyGraphViewportTransform(svg, version);
}

function focusAndFitSelected(version) {
  if (state.viewMode !== "graph") return;

  const svg = version === "B" ? graphSvgB : graphSvgA;
  const container = version === "B" ? graphContainerB : graphContainerA;
  if (!svg || !container) return;

  const viewport = svg.querySelector?.(".graph-viewport");
  const v = state.graphViewport?.[version];
  if (!viewport || !v) return;

  const selectedId = graphHighlightIdForPane(version);
  if (!selectedId) return;

  const parsed = version === "B" ? state.parsedB : state.parsedA;
  if (!parsed) return;

  const containerRect = container.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0) return;

  // Fallback ids: selected node plus immediate neighbors (same as graph edges).
  const neighborhoodIds = new Set([selectedId]);
  for (const edge of parsed.edges || []) {
    if (edge.from === selectedId && edge.to) neighborhoodIds.add(edge.to);
    if (edge.to === selectedId && edge.from) neighborhoodIds.add(edge.from);
  }

  const prevTransform = viewport.getAttribute("transform");
  viewport.setAttribute("transform", "");

  /** Union bbox for node groups in untransformed SVG coordinates (viewport transform cleared). */
  const unionBoundsForNodeIds = (ids) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const idEsc =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(id)
          : id.replace(/"/g, '\\"');

      const el = svg.querySelector?.(
        `.graph-node-group[data-node-id="${idEsc}"]`
      );
      if (!el || typeof el.getBBox !== "function") continue;

      const b = el.getBBox?.();
      if (!b || b.width === 0 || b.height === 0) continue;

      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }
    return { minX, minY, maxX, maxY };
  };

  let bounds;
  try {
    // Center/zoom on the selected node only so incident edge highlighting stays the same;
    // fitting the whole neighborhood zooms out and shifts the focal point away from the selection.
    bounds = unionBoundsForNodeIds([selectedId]) || unionBoundsForNodeIds(neighborhoodIds);
  } finally {
    viewport.setAttribute("transform", prevTransform);
  }

  if (!bounds) return;

  const bbox = {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };

  const bboxCenterX = bbox.x + bbox.width / 2;
  const bboxCenterY = bbox.y + bbox.height / 2;
  const fitWidth = bbox.width * GRAPH_FOCUS_FIT_ZOOM_OUT_MARGIN;
  const fitHeight = bbox.height * GRAPH_FOCUS_FIT_ZOOM_OUT_MARGIN;

  const paddingPx = 18;
  const availableWidth = Math.max(1, containerRect.width - paddingPx * 2);
  const availableHeight = Math.max(1, containerRect.height - paddingPx * 2);

  // Fit a slightly larger box (same center) so the view is a bit more zoomed out than tight node bounds.
  const nextScale = clamp(
    Math.min(availableWidth / fitWidth, availableHeight / fitHeight),
    GRAPH_VIEWPORT_MIN_SCALE,
    GRAPH_VIEWPORT_MAX_SCALE
  );

  const targetClientX = containerRect.left + containerRect.width / 2;
  const targetClientY = containerRect.top + containerRect.height / 2;
  const targetSvgPoint = clientToSvgPoint(svg, targetClientX, targetClientY);

  v.scale = nextScale;
  v.tx = targetSvgPoint.x - bboxCenterX * v.scale;
  v.ty = targetSvgPoint.y - bboxCenterY * v.scale;
  applyGraphViewportTransform(svg, version);
}

function bindGraphViewportInteractions(version, svg, container) {
  if (!svg) return;
  if (svg.__graphViewportInteractionsBound) return;
  svg.__graphViewportInteractionsBound = true;

  const setPanningCursor = (panning) => {
    if (container) container.classList.toggle("is-graph-panning", panning);
    svg.classList.toggle("is-graph-panning", panning);
  };

  let isPanning = false;
  let activePointerId = null;
  let startSvgPoint = null;
  let startTx = 0;
  let startTy = 0;
  let didDrag = false;

  let wheelRafPending = false;
  let wheelLastArgs = null;

  svg.addEventListener(
    "wheel",
    (event) => {
      if (state.viewMode !== "graph") return;

      // Only handle zoom when the user is interacting with the graph itself.
      // (The handler is attached to the SVG element, so this should already be
      // scoped, but we also keep it defensive.)
      if (!svg.contains(event.target)) return;

      if (!event.cancelable) return;
      event.preventDefault();
      event.stopPropagation();

      const v = state.graphViewport?.[version];
      if (!v) return;

      wheelLastArgs = {
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      };

      if (wheelRafPending) return;
      wheelRafPending = true;

      requestAnimationFrame(() => {
        wheelRafPending = false;
        const args = wheelLastArgs;
        if (!args) return;

        const nextRawFactor = Math.exp(-args.deltaY * GRAPH_ZOOM_SENSITIVITY);
        const vNow = state.graphViewport?.[version];
        if (!vNow) return;
        const nextScale = clamp(
          vNow.scale * nextRawFactor,
          GRAPH_VIEWPORT_MIN_SCALE,
          GRAPH_VIEWPORT_MAX_SCALE
        );

        // Keep zoom centered around the cursor point.
        const pSvg = clientToSvgPoint(svg, args.clientX, args.clientY);
        const localX = (pSvg.x - vNow.tx) / vNow.scale;
        const localY = (pSvg.y - vNow.ty) / vNow.scale;

        const nextTx = pSvg.x - nextScale * localX;
        const nextTy = pSvg.y - nextScale * localY;

        vNow.scale = nextScale;
        vNow.tx = nextTx;
        vNow.ty = nextTy;
        applyGraphViewportTransform(svg, version);
      });
    },
    { passive: false }
  );

  svg.addEventListener("pointerdown", (event) => {
    if (state.viewMode !== "graph") return;
    if (event.button !== 0) return; // Left click only.

    // Preserve node click-selection. If the pointer is on a node group, don't
    // start panning.
    if (event.target?.closest?.(".graph-node-group")) return;

    if (!event.cancelable) return;
    event.preventDefault();
    event.stopPropagation();

    const v = state.graphViewport?.[version];
    if (!v) return;

    isPanning = true;
    activePointerId = event.pointerId;
    didDrag = false;

    startSvgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
    startTx = v.tx;
    startTy = v.ty;

    setPanningCursor(true);

    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // Ignore (some browsers may throw if capture is not supported).
    }
  });

  const onPointerMove = (event) => {
    if (!isPanning) return;
    if (activePointerId == null || event.pointerId !== activePointerId) return;

    const v = state.graphViewport?.[version];
    if (!v || !startSvgPoint) return;

    const currSvgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
    const dx = currSvgPoint.x - startSvgPoint.x;
    const dy = currSvgPoint.y - startSvgPoint.y;

    if (!didDrag && Math.hypot(dx, dy) > GRAPH_PAN_DRAG_THRESHOLD_PX) {
      didDrag = true;
    }

    v.tx = startTx + dx;
    v.ty = startTy + dy;
    applyGraphViewportTransform(svg, version);
  };

  const finishPan = (event) => {
    if (!isPanning) return;
    if (activePointerId == null || event.pointerId !== activePointerId) return;

    isPanning = false;
    activePointerId = null;
    startSvgPoint = null;
    setPanningCursor(false);

    try {
      svg.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore.
    }

    if (didDrag) {
      graphPanSuppressUntilByVersion[version] = Date.now() + GRAPH_PAN_SUPPRESS_CLICK_MS;
    }
  };

  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", finishPan);
  svg.addEventListener("pointercancel", finishPan);
}

function exportViewTimestampForFilename() {
  return new Date().toISOString().slice(0, 19).replace(/:/g, "-");
}

function downloadTextAsFile(text, filename, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resolveExportVersionForSinglePaneView() {
  let v = state.activeGraphVersion === "B" ? "B" : "A";
  if (v === "B" && !state.parsedB) v = "A";
  if (v === "A" && !state.parsedA && state.parsedB) v = "B";
  return v;
}

function buildTreeOutlineLinesFromEl(el, depth = 0) {
  const lines = [];
  if (!el) return lines;
  const pad = "  ".repeat(depth);
  for (const node of el.children) {
    if (node.tagName === "DETAILS") {
      const summary = node.querySelector(":scope > summary");
      const label = summary?.textContent?.replace(/\s+/g, " ").trim() || "(node)";
      lines.push(`${pad}${label}${node.open ? "" : " …"}`);
      if (node.open) {
        const children = node.querySelector(":scope > .tree-children");
        if (children) lines.push(...buildTreeOutlineLinesFromEl(children, depth + 1));
      }
    } else if (node.matches?.("[data-tree-leaf='true']")) {
      const title =
        node.querySelector(".tree-leaf-title")?.textContent?.replace(/\s+/g, " ").trim() || "";
      const sub =
        node.querySelector(".tree-leaf-subtitle")?.textContent?.replace(/\s+/g, " ").trim() || "";
      const leafLine = sub ? `${title} — ${sub}` : title || "(formula)";
      lines.push(`${pad}• ${leafLine}`);
    } else if (node.classList?.contains("tree")) {
      lines.push(...buildTreeOutlineLinesFromEl(node, depth));
    } else if (node.classList?.contains("tree-children")) {
      lines.push(...buildTreeOutlineLinesFromEl(node, depth));
    } else if (node.classList?.contains("empty-state")) {
      const t = node.textContent?.replace(/\s+/g, " ").trim();
      if (t) lines.push(`${pad}${t}`);
    }
  }
  return lines;
}

function buildTreeExportBody(version) {
  const container = version === "B" ? treeContainerB : treeContainerA;
  const treeRoot = container?.querySelector?.(".tree");
  const lines = buildTreeOutlineLinesFromEl(treeRoot, 0);
  const body =
    lines.length > 0
      ? lines.join("\n")
      : (container?.textContent?.replace(/\s+/g, " ").trim() || "No tree content.");
  const screen =
    version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  const screenLine = screen
    ? `Screen filter: ${screen}\n`
    : "Screen filter: (all screens)\n";
  return `Tree view — Version ${version}\n${screenLine}\n${body}\n`;
}

function dependencyGraphExportFilename(version, stamp) {
  const screen =
    version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  const screenPart = screen ? slugForLogicFlowExportFilename(screen) : "all-screens";
  return `dependency-graph-version-${version}-${screenPart}-${stamp}.svg`;
}

function exportDependencyGraphForVersion(version, stamp) {
  const svg = version === "B" ? graphSvgB : graphSvgA;
  if (!svg?.querySelector?.(".graph-viewport")) {
    alert("Nothing to export in the dependency graph.");
    return;
  }
  downloadSvgElementAsFile(svg, dependencyGraphExportFilename(version, stamp));
}

function exportTreeForVersion(version, stamp) {
  if (!getParsedForVersion(version)) {
    alert(`Version ${version} has no data loaded.`);
    return;
  }
  const name = slugForLogicFlowExportFilename(
    (version === "B" ? graphPaneBPath?.textContent : graphPaneAPath?.textContent) || `version-${version}`
  );
  downloadTextAsFile(
    buildTreeExportBody(version),
    `tree-view-version-${version}-${name}-${stamp}.txt`
  );
}

function exportCodeForVersion(version, stamp) {
  const parsed = getParsedForVersion(version);
  if (!parsed) {
    alert(`Version ${version} has no data loaded.`);
    return;
  }
  const screenFilter =
    version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  const parsedForPane = filterParsedForScreen(parsed, screenFilter);
  const keysFilter = getCodeViewVisibleFormulaKeysForPane(version);
  const text = getCodeViewCopyAllText(parsedForPane, keysFilter);
  if (!text) {
    alert("No formulas to export in Code view.");
    return;
  }
  const name = slugForLogicFlowExportFilename(
    (version === "B" ? graphPaneBPath?.textContent : graphPaneAPath?.textContent) || `version-${version}`
  );
  downloadTextAsFile(text, `code-view-version-${version}-${name}-${stamp}.txt`);
}

function exportLogicFlowsFromMainApp(stamp) {
  const jobs = [];
  const pushFromPane = (version, root) => {
    if (!root) return;
    const svgs = root.querySelectorAll(".logic-flow-canvas svg");
    svgs.forEach((svg, index) => {
      const flowRoot = svg.closest(".logic-flow");
      const titleEl = flowRoot?.querySelector(".logic-flow-title");
      let base = slugForLogicFlowExportFilename(titleEl?.textContent || `logic-flow-${index + 1}`);
      base = `${base}-version-${version}`;
      jobs.push({ svg, filename: `${base}-${stamp}.svg` });
    });
  };

  if (state.parsedA && graphPaneA && !graphPaneA.classList.contains("is-collapsed-logic")) {
    pushFromPane("A", logicContainerA);
  }
  if (state.parsedB && graphPaneB && !graphPaneB.classList.contains("is-collapsed-logic")) {
    pushFromPane("B", logicContainerB);
  }

  if (!jobs.length) {
    alert("No Logic Flow diagrams to export in the visible pane(s).");
    return;
  }

  jobs.forEach((job, index) => {
    window.setTimeout(() => downloadSvgElementAsFile(job.svg, job.filename), index * 220);
  });
}

function exportCurrentMainView() {
  const stamp = exportViewTimestampForFilename();
  const mode = state.viewMode;

  if (mode === "logic") {
    exportLogicFlowsFromMainApp(stamp);
    return;
  }

  if (!state.parsedA && !state.parsedB) {
    alert("Load a JSON file before exporting.");
    return;
  }

  const version = resolveExportVersionForSinglePaneView();
  if (!getParsedForVersion(version)) {
    alert("Nothing to export for the active version.");
    return;
  }

  if (mode === "graph") {
    exportDependencyGraphForVersion(version, stamp);
  } else if (mode === "tree") {
    exportTreeForVersion(version, stamp);
  } else if (mode === "code") {
    exportCodeForVersion(version, stamp);
  }
}

function resetTreeExpansionStateForPane(pane) {
  state.treeExpandedDetailsByPane?.[pane]?.clear?.();
  if (state.treeExpandedDetailsInitializedByPane) state.treeExpandedDetailsInitializedByPane[pane] = false;
}

function ensureTreeExpansionInitializedForPane(pane, parsed) {
  if (!parsed) return;
  if (state.treeExpandedDetailsInitializedByPane?.[pane]) return;

  const expandedSet = state.treeExpandedDetailsByPane?.[pane];
  if (!expandedSet) return;

  // Seed "top-level" file groups so initial render matches the previous UX,
  // while still allowing the user to collapse them persistently.
  const rawControls = Array.isArray(parsed.raw?.controls) ? parsed.raw.controls : null;
  if (rawControls?.length) {
    const fileNames = new Set();
    for (const c of rawControls) {
      const fileName = c.fileName || c.screen || "Unknown";
      fileNames.add(fileName);
    }
    for (const fileName of fileNames) expandedSet.add(`file::${String(fileName)}`);
  } else {
    const files = Array.isArray(parsed.files) ? parsed.files : [];
    for (const file of files) {
      const fileName = file.fileName || "Unknown file";
      expandedSet.add(`file::${String(fileName)}`);
    }
  }

  state.treeExpandedDetailsInitializedByPane[pane] = true;
}

/**
 * Tree view screen filtering:
 * - Keeps only the selected `fileName` in `parsed.files` (for explorer tree).
 * - Keeps only the selected `fileName` in `parsed.formulas` / `formulasByKey` (for leaf clicks).
 * - Filters `parsed.raw.controls` when it exists (for hierarchy tree).
 */
function filterParsedForScreen(parsed, fileName) {
  if (!parsed || !fileName) return parsed;

  const files = Array.isArray(parsed.files) ? parsed.files.filter((f) => f?.fileName === fileName) : [];
  const formulas = Array.isArray(parsed.formulas)
    ? parsed.formulas.filter((f) => f?.fileName === fileName)
    : [];

  const formulasByKey = Object.fromEntries((formulas || []).map((f) => [f.key, f]));

  let raw = parsed.raw;
  const rawControls = parsed?.raw?.controls;
  if (Array.isArray(rawControls)) {
    raw = {
      ...parsed.raw,
      controls: rawControls.filter((c) => (c?.fileName || c?.screen) === fileName),
    };
  }

  return {
    ...parsed,
    files,
    formulas,
    formulasByKey,
    raw,
  };
}

function refreshGraph() {
  // Keep animations lightweight: CSS transforms only, plus a short SVG opacity transition.
  // Graph SVG fades only when `viewMode === "graph"`; tree / logic / code update their own panes.
  const GRAPH_IN_MS = 240;
  const selectedKey = selectedFormulaKey();
  const shouldAutoExpandSelectedLeaf = state.viewMode === "tree" ? state.treeAutoExpandSelectedLeafOnce !== false : false;
  // One-shot: reset default as soon as we decide whether to auto-expand.
  if (state.viewMode === "tree") state.treeAutoExpandSelectedLeafOnce = true;

  const fadeSvgOut = (svg) => {
    if (!svg) return null;

    // Token helps prevent late timers from earlier refreshes from removing classes early.
    svg.__graphRefreshToken = (svg.__graphRefreshToken ?? 0) + 1;
    const token = svg.__graphRefreshToken;

    svg.classList.remove("graph-anim-in");
    svg.classList.add("graph-refresh-fade");
    svg.style.opacity = "0";

    // Force a style flush so the opacity transition starts before we rebuild the SVG DOM.
    // (Without this, the synchronous `renderGraph()` clear can cause an instant cut.)
    if (svg.style.opacity !== "0") svg.getBoundingClientRect?.();

    return token;
  };

  const animateSvgIn = (svg, token) => {
    if (!svg) return;
    if (token != null && svg.__graphRefreshToken !== token) return;

    svg.style.opacity = "1";
    svg.classList.add("graph-anim-in");

    // Remove class after the entrance animation finishes so it doesn't interfere with
    // existing hover/select dimming transitions (`.is-dimmed`).
    setTimeout(() => {
      if (token != null && svg.__graphRefreshToken !== token) return;
      svg.classList.remove("graph-anim-in");
    }, GRAPH_IN_MS + 50);
  };

  if (!state.parsedA) {
    graphSvgA.innerHTML = "";
    graphEmptyA.style.display = state.viewMode === "code" ? "none" : "grid";
    if (state.viewMode === "code" && codeContainerA) {
      renderCodeView(codeContainerA, getCodeViewOptionsForPane("A"));
    }
  } else {
    graphEmptyA.style.display = "none";
    if (state.viewMode === "tree") {
      const parsedForPane = filterParsedForScreen(state.parsedA, state.dependencyGraphScreenFilterFileA);
      ensureTreeExpansionInitializedForPane("A", parsedForPane);
      const expandedSet = state.treeExpandedDetailsByPane.A;
      renderTree(treeContainerA, parsedForPane, {
        onFormulaClick: (formula) => {
          applyGlobalFormulaSelection("A", formula);
          renderInspectorItem(formula);
          refreshGraphToggleUI();
          refreshDependencyGraphScreenChips();
          renderMasterFx();
          refreshGraph();
        },
        selectedKey,
        expandedDetailsSet: expandedSet,
        getFormulaDiffStatus,
        searchQuery: treeSearchInputA?.value || "",
        renderCacheKey: getTreeRenderCacheKeyForPane("A", parsedForPane, treeSearchInputA?.value || ""),
        onDetailsToggle: (nodeId, isOpen) => {
          if (isOpen) expandedSet.add(nodeId);
          else expandedSet.delete(nodeId);
        },
      });
      if (shouldAutoExpandSelectedLeaf) {
        autoExpandSelectedLeaf(treeContainerA, selectedKey, { expandedDetailsSet: expandedSet });
      }
    } else if (state.viewMode === "graph") {
      const token = fadeSvgOut(graphSvgA);
      renderGraph(
        graphSvgA,
        state.parsedA,
        state.filters,
        (node) => handleNodeClick("A", node),
        graphHighlightIdForPane("A"),
        state.dependencyGraphScreenFilterFileA,
        (nodeId) => handleNodeHover("A", nodeId),
        graphHoverIdForPane("A"),
        { subtreeFocus: state.dependencyGraphSubtreeFocus.A }
      );
      applyGraphViewportTransform(graphSvgA, "A");
      // Next frame makes sure opacity transition + entrance animation both start cleanly.
      requestAnimationFrame(() => animateSvgIn(graphSvgA, token));
    } else if (state.viewMode === "logic") {
      renderLogicFlow(logicContainerA, selectedLogicContextForPane("A"), {
        onNodeContext: handleLogicNodeContext,
        paneVersion: "A",
        getSplitPopoutFlows: () => ({
          A: logicContainerA?.querySelector?.(".logic-flow")?.outerHTML || "",
          B: logicContainerB?.querySelector?.(".logic-flow")?.outerHTML || "",
        }),
        getSplitPopoutFormulaContexts: () => ({
          A: selectedLogicContextForPane("A"),
          B: selectedLogicContextForPane("B"),
        }),
        getLogicPopoutPaneCollapse: () => ({
          A: !!state.logicPaneCollapsed.A,
          B: !!state.logicPaneCollapsed.B,
        }),
        getVersionPathText: (slot) => {
          const el = slot === "B" ? graphPaneBPath : graphPaneAPath;
          return el?.textContent?.trim() || "";
        },
        activeVersion: state.activeGraphVersion,
        viewportState: state.logicViewport?.A,
        onViewNearestMatch: () => {
          // Optional matching strategy not implemented yet.
        },
      });
    } else if (state.viewMode === "code") {
      renderCodeView(codeContainerA, getCodeViewOptionsForPane("A"));
    }
  }

  if (!state.parsedB) {
    graphSvgB.innerHTML = "";
    graphEmptyB.style.display = state.viewMode === "code" ? "none" : "grid";
    if (state.viewMode === "code" && codeContainerB) {
      renderCodeView(codeContainerB, getCodeViewOptionsForPane("B"));
    }
  } else {
    graphEmptyB.style.display = "none";
    if (state.viewMode === "tree") {
      const parsedForPane = filterParsedForScreen(state.parsedB, state.dependencyGraphScreenFilterFileB);
      ensureTreeExpansionInitializedForPane("B", parsedForPane);
      const expandedSet = state.treeExpandedDetailsByPane.B;
      renderTree(treeContainerB, parsedForPane, {
        onFormulaClick: (formula) => {
          applyGlobalFormulaSelection("B", formula);
          renderInspectorItem(formula);
          refreshGraphToggleUI();
          refreshDependencyGraphScreenChips();
          renderMasterFx();
          refreshGraph();
        },
        selectedKey,
        expandedDetailsSet: expandedSet,
        getFormulaDiffStatus,
        searchQuery: treeSearchInputB?.value || "",
        renderCacheKey: getTreeRenderCacheKeyForPane("B", parsedForPane, treeSearchInputB?.value || ""),
        onDetailsToggle: (nodeId, isOpen) => {
          if (isOpen) expandedSet.add(nodeId);
          else expandedSet.delete(nodeId);
        },
      });
      if (shouldAutoExpandSelectedLeaf) {
        autoExpandSelectedLeaf(treeContainerB, selectedKey, { expandedDetailsSet: expandedSet });
      }
    } else if (state.viewMode === "graph") {
      const token = fadeSvgOut(graphSvgB);
      renderGraph(
        graphSvgB,
        state.parsedB,
        state.filters,
        (node) => handleNodeClick("B", node),
        graphHighlightIdForPane("B"),
        state.dependencyGraphScreenFilterFileB,
        (nodeId) => handleNodeHover("B", nodeId),
        graphHoverIdForPane("B"),
        { subtreeFocus: state.dependencyGraphSubtreeFocus.B }
      );
      applyGraphViewportTransform(graphSvgB, "B");
      requestAnimationFrame(() => animateSvgIn(graphSvgB, token));
    } else if (state.viewMode === "logic") {
      renderLogicFlow(logicContainerB, selectedLogicContextForPane("B"), {
        onNodeContext: handleLogicNodeContext,
        paneVersion: "B",
        getSplitPopoutFlows: () => ({
          A: logicContainerA?.querySelector?.(".logic-flow")?.outerHTML || "",
          B: logicContainerB?.querySelector?.(".logic-flow")?.outerHTML || "",
        }),
        getSplitPopoutFormulaContexts: () => ({
          A: selectedLogicContextForPane("A"),
          B: selectedLogicContextForPane("B"),
        }),
        getLogicPopoutPaneCollapse: () => ({
          A: !!state.logicPaneCollapsed.A,
          B: !!state.logicPaneCollapsed.B,
        }),
        getVersionPathText: (slot) => {
          const el = slot === "B" ? graphPaneBPath : graphPaneAPath;
          return el?.textContent?.trim() || "";
        },
        activeVersion: state.activeGraphVersion,
        viewportState: state.logicViewport?.B,
        onViewNearestMatch: () => {
          // Optional matching strategy not implemented yet.
        },
      });
    } else if (state.viewMode === "code") {
      renderCodeView(codeContainerB, getCodeViewOptionsForPane("B"));
    }
  }

  syncGraphFocusFromSelection();
}

function getParsedForVersion(version) {
  return version === "B" ? state.parsedB : state.parsedA;
}

function currentLogicGlobalSelectionKey() {
  return (
    state.logicSharedSelectionKey ||
    state.logicPaneSelectionKey?.A ||
    state.logicPaneSelectionKey?.B ||
    selectedFormulaKey() ||
    null
  );
}

function syncLogicSelectionFromCurrentStateForEnter() {
  const selected = state.selectedNode;
  const selectedKey = selected?.key && selected?.formula ? selected.key : null;
  const selectedVersion = state.activeGraphVersion === "B" ? "B" : "A";
  const keyA = selectedVersion === "A" ? selectedKey : null;
  const keyB = selectedVersion === "B" ? selectedKey : null;
  const nextKey = keyA || keyB || null;
  state.logicSharedSelectionKey = nextKey;
  state.logicPaneSelectionKey.A = nextKey;
  state.logicPaneSelectionKey.B = nextKey;
  state.logicPaneSelectionIsOverridden.A = false;
  state.logicPaneSelectionIsOverridden.B = false;
}

function syncLogicSelectionToBothPanes(key) {
  state.logicSharedSelectionKey = key || null;
  state.logicPaneSelectionKey.A = key || null;
  state.logicPaneSelectionKey.B = key || null;
}

function getScreenScopeLabelForPane(version) {
  const parsed = getParsedForVersion(version);
  if (!parsed) return "All screens";
  const fileName = version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  if (!fileName) return "All screens";
  const appMatch = listAppFiles(parsed).find((a) => a.fileName === fileName);
  if (appMatch) return appMatch.label;
  const screens = listScreens(parsed);
  const match = screens.find((s) => s.fileName === fileName);
  return match ? match.label : fileName;
}

function selectedFormulaKeyForCodePane(version) {
  const screenFilter =
    version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  const parsed = getParsedForVersion(version);
  if (!parsed?.formulasByKey) return null;
  const filtered = filterParsedForScreen(parsed, screenFilter);
  if (!filtered?.formulasByKey) return null;
  const overrideEnabled = !!state.logicPaneSelectionIsOverridden?.[version];
  const overrideKey = overrideEnabled ? state.logicPaneSelectionKey?.[version] || null : null;
  const sharedKey = state.logicSharedSelectionKey || null;
  const fromSelected = selectedFormulaKey();
  const candidateKey = overrideKey || sharedKey || fromSelected;
  if (!candidateKey) return null;
  return filtered.formulasByKey[candidateKey] ? candidateKey : null;
}

/** Key for scrolling / highlighting when `selectedFormulaKey()` is null but `selectedNode.key` is in scope. */
function fallbackFormulaKeyForCodePane(version) {
  const snKey = state.selectedNode?.key;
  if (typeof snKey !== "string" || !snKey) return null;
  const parsed = getParsedForVersion(version);
  if (!parsed?.formulasByKey) return null;
  const screenFilter =
    version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  const filtered = filterParsedForScreen(parsed, screenFilter);
  if (!filtered?.formulasByKey?.[snKey]) return null;
  return snKey;
}

function resolveFormulaKeyForCodePaneScroll(version) {
  return selectedFormulaKeyForCodePane(version) || fallbackFormulaKeyForCodePane(version);
}

/**
 * When Code view “related only” is on, formula keys to show: weakly connected component in the
 * dependency graph (same visibility rules as the graph), intersected with formulas in the pane’s scope.
 */
function getCodeViewVisibleFormulaKeysForPane(version) {
  if (!state.codeViewRelatedOnlyFocus[version]) return null;
  const parsed = getParsedForVersion(version);
  if (!parsed) return null;
  const screenFilter =
    version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  const parsedForPane = filterParsedForScreen(parsed, screenFilter);
  const rootId = graphNodeIdFromSelectedItem(state.selectedNode);
  if (state.activeGraphVersion !== version || !rootId) return null;

  const connectedKeys = formulaKeysWeaklyConnectedInVisibleGraph(
    parsed,
    state.filters,
    screenFilter,
    rootId
  );
  const inScope = new Set((parsedForPane?.formulas || []).map((f) => f.key));
  const out = new Set();
  for (const k of connectedKeys) {
    if (inScope.has(k)) out.add(k);
  }
  const sel = resolveFormulaKeyForCodePaneScroll(version);
  if (sel && inScope.has(sel)) out.add(sel);

  return out.size ? out : null;
}

function openAncestorDetailsUpTo(el, boundary) {
  let n = el;
  while (n && n !== boundary) {
    if (n.nodeType === 1 && n.tagName === "DETAILS") {
      /** @type {HTMLDetailsElement} */ (n).open = true;
    }
    n = n.parentElement;
  }
}

/** First matching formula row in Code View (try resolved key, then `selectedNode.key`). */
function findCodeViewFormulaElement(container, primaryKey) {
  const keys = new Set();
  if (typeof primaryKey === "string" && primaryKey) keys.add(primaryKey);
  const sk = state.selectedNode?.key;
  if (typeof sk === "string" && sk) keys.add(sk);
  for (const k of keys) {
    for (const el of container.querySelectorAll("[data-formula-key]")) {
      if (el.getAttribute("data-formula-key") === k) return el;
    }
  }
  return null;
}

/**
 * Set scrollTop so `child`'s top sits `marginFromTopPx` below the top of `scrollParent`'s visible
 * client area (uses viewport geometry + current scrollTop — stable for nested scrollers).
 */
function scrollChildTopIntoParentAt(scrollParent, child, marginFromTopPx) {
  if (!scrollParent || scrollParent.clientHeight <= 0) return;
  const maxS = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
  if (maxS <= 0) return;

  const sRect = scrollParent.getBoundingClientRect();
  const cRect = child.getBoundingClientRect();
  const relTop = cRect.top - sRect.top + scrollParent.scrollTop;
  const next = relTop - marginFromTopPx;
  scrollParent.scrollTop = clamp(next, 0, maxS);
}

/** Extra keys to try when matching DOM (e.g. empty vs missing fileName). */
function extraFormulaKeysForDomLookup() {
  const sel = state.selectedNode;
  if (!sel || sel.control == null || sel.property == null) return [];
  const keys = [];
  const fn = sel.fileName;
  if (fn != null && fn !== undefined) {
    keys.push(formulaKey({ control: sel.control, property: sel.property, fileName: fn }));
  }
  keys.push(formulaKey({ control: sel.control, property: sel.property, fileName: "" }));
  return keys;
}

/**
 * Code view: align selected formula under sticky chips + inner scroller using explicit scrollTop
 * (avoids unreliable scrollIntoView with nested flex + sticky).
 */
function scrollCodeViewToSelectedFormula(version) {
  if (version !== "A" && version !== "B") return;
  const container = version === "B" ? codeContainerB : codeContainerA;
  if (!container) return;
  const key = resolveFormulaKeyForCodePaneScroll(version);
  if (!key) return;

  let target = findCodeViewFormulaElement(container, key);
  if (!target) {
    for (const ek of extraFormulaKeysForDomLookup()) {
      target = findCodeViewFormulaElement(container, ek);
      if (target) break;
    }
  }
  if (!target) return;

  const scrollEl = container.querySelector("[data-code-editor-scroll]");
  if (!scrollEl) return;

  openAncestorDetailsUpTo(target, scrollEl);

  const graphContainer = container.closest(".graph-container");

  const applyScroll = () => {
    const pad = 10;
    scrollChildTopIntoParentAt(scrollEl, target, pad);

    if (graphContainer) {
      const chips = graphContainer.querySelector(":scope > .graph-screen-chips");
      let chipInset = 0;
      if (chips && !chips.hidden && chips.getClientRects().length > 0) {
        const gr = graphContainer.getBoundingClientRect();
        const toolbar = container.querySelector(".code-view-ide-toolbar");
        if (state.viewMode === "code" && toolbar) {
          chipInset = Math.max(0, toolbar.getBoundingClientRect().bottom - gr.top);
        } else {
          chipInset = Math.max(0, chips.getBoundingClientRect().bottom - gr.top);
        }
      }
      scrollChildTopIntoParentAt(graphContainer, target, chipInset + pad);
    }

    if (graphContainer) {
      const gRect = graphContainer.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const maxG = Math.max(0, graphContainer.scrollHeight - graphContainer.clientHeight);
      if (maxG > 0 && tRect.bottom > gRect.bottom - pad) {
        graphContainer.scrollTop = clamp(
          graphContainer.scrollTop + (tRect.bottom - (gRect.bottom - pad)),
          0,
          maxG
        );
      }
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      applyScroll();
      window.setTimeout(applyScroll, 100);
      window.setTimeout(applyScroll, 280);
    });
  });
}

function getCodeViewOptionsForPane(version) {
  const parsed = getParsedForVersion(version);
  const screenFilter =
    version === "B" ? state.dependencyGraphScreenFilterFileB : state.dependencyGraphScreenFilterFileA;
  const parsedForPane = parsed ? filterParsedForScreen(parsed, screenFilter) : null;
  const visibleFormulaKeys = getCodeViewVisibleFormulaKeysForPane(version);
  let displayParsed = parsedForPane;
  if (parsedForPane?.formulas?.length && visibleFormulaKeys?.size) {
    const formulas = parsedForPane.formulas.filter((f) => visibleFormulaKeys.has(f.key));
    displayParsed = {
      ...parsedForPane,
      formulas,
      formulasByKey: Object.fromEntries(formulas.map((f) => [f.key, f])),
    };
  }
  return {
    paneVersion: version,
    hasParsed: !!parsed,
    parsed: displayParsed,
    selectedKey: parsed && parsedForPane ? resolveFormulaKeyForCodePaneScroll(version) : null,
    visibleFormulaKeys,
    scopeLabel: getScreenScopeLabelForPane(version),
    onViewNearestMatch: () => {
      // Optional matching strategy not implemented yet.
    },
    onSelectFormulaByKey: (formulaKey) => {
      const fullParsed = getParsedForVersion(version);
      const formula = fullParsed?.formulasByKey?.[formulaKey];
      if (!formula) return;
      if (selectedFormulaKey() === formulaKey && state.activeGraphVersion === version) {
        state.selectedNode = null;
        clearDependencyGraphSubtreeFocus();
        renderInspectorItem(null);
      } else {
        applyGlobalFormulaSelection(version, formula);
        renderInspectorItem(formula);
      }
      refreshGraphToggleUI();
      refreshDependencyGraphScreenChips();
      renderMasterFx();
      refreshGraph();
    },
  };
}

function applyGlobalFormulaSelection(version, formula) {
  state.activeGraphVersion = version === "B" ? "B" : "A";
  state.selectedNode = formula || null;
  const key = formula?.key || null;
  syncLogicSelectionToBothPanes(key);
  state.logicPaneSelectionIsOverridden.A = false;
  state.logicPaneSelectionIsOverridden.B = false;
}

function selectedLogicContextForPane(version) {
  const selected = state.selectedNode;
  const fallbackKey = null;
  const overrideEnabled = !!state.logicPaneSelectionIsOverridden?.[version];
  const overrideKey = overrideEnabled ? state.logicPaneSelectionKey?.[version] || null : null;
  const sharedKey = state.logicSharedSelectionKey || null;
  const candidateKey = overrideKey || sharedKey || fallbackKey;
  if (!candidateKey) {
    if (!selected) return { state: "none", reason: "noSharedSelection" };
    if (!selected.key || !selected.formula) {
      return { state: "nonFormula", reason: "nonFormulaSelection" };
    }
    return { state: "none", reason: "noSharedSelection" };
  }

  const parsed = getParsedForVersion(version);
  if (!parsed?.formulasByKey) return { state: "none", reason: "missingFormulaMap", selectedKey: candidateKey };
  const formula = parsed.formulasByKey[candidateKey];
  if (!formula) {
    const reason = version === "A" ? "missingInVersionA" : "missingInVersionB";
    return {
      state: "none",
      reason,
      selectedKey: candidateKey,
      targetVersion: version,
    };
  }
  return { state: "formula", formula };
}

function handleLogicNodeContext(payload) {
  const node = payload?.node;
  const formula = payload?.formula;
  if (!node || !formula) return; // Safe no-op.

  const fullContext = node.contextText || node.label || "";
  renderDetails(detailsPanel, {
    id: `logic::${formula.key || "selected"}::${node.id}`,
    nodeType: "logic",
    label: `${formula.control}.${formula.property} -> ${node.label}`,
    contextText: fullContext,
  });
}

function getStableObjectId(obj) {
  if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return "none";
  if (!objectIdByRef.has(obj)) objectIdByRef.set(obj, nextObjectId++);
  return String(objectIdByRef.get(obj));
}

function getTreeRenderCacheKeyForPane(version, parsedForPane, treeSearchQuery) {
  const query = String(treeSearchQuery || "").trim().toLowerCase();
  const expandedSet = state.treeExpandedDetailsByPane?.[version];
  const expandedSignature =
    expandedSet && expandedSet.size
      ? Array.from(expandedSet)
          .map((id) => String(id))
          .sort()
          .join(",")
      : "";
  // Diff badges depend on both sides; include both parse identities to invalidate when either changes.
  return [
    `pane:${version}`,
    `parsedPane:${getStableObjectId(parsedForPane)}`,
    `parsedA:${getStableObjectId(state.parsedA)}`,
    `parsedB:${getStableObjectId(state.parsedB)}`,
    `query:${query}`,
    `expanded:${expandedSignature}`,
  ].join("|");
}

function handleNodeClick(version, node) {
  if (Date.now() < (graphPanSuppressUntilByVersion?.[version] ?? 0)) return;

  const currentId = graphNodeIdFromSelectedItem(state.selectedNode);
  if (state.activeGraphVersion === version && currentId === node.id) {
    state.selectedNode = null;
    clearDependencyGraphSubtreeFocus();
    renderInspectorItem(null);
    refreshGraphToggleUI();
    refreshDependencyGraphScreenChips();
    refreshGraph();
    renderMasterFx();
    return;
  }

  state.activeGraphVersion = version;
  state.selectedNode = findBestDetailObject(version, node);
  if (state.selectedNode?.key && state.selectedNode?.formula) {
    applyGlobalFormulaSelection(version, state.selectedNode);
  }
  renderInspectorItem(state.selectedNode);
  refreshGraphToggleUI();
  refreshDependencyGraphScreenChips();
  refreshGraph();
  renderMasterFx();
}

function findBestDetailObject(version, node) {
  const parsed = version === "B" ? state.parsedB : state.parsedA;
  if (!parsed) return node;

  if (node.nodeType === "formula") {
    const match = parsed.formulas.find((formula) => {
      const expectedId = `formula::${formula.control}::${formula.property}::${formula.fileName}`;
      return expectedId === node.id;
    });

    return match || node;
  }

  return node;
}

/** Graph node id for the inspector selection (formula row or graph node). */
function graphNodeIdFromSelectedItem(selected) {
  if (!selected) return null;
  if (
    selected.control != null &&
    selected.property != null &&
    selected.fileName != null
  ) {
    return `formula::${selected.control}::${selected.property}::${selected.fileName}`;
  }
  if (typeof selected.id === "string") return selected.id;
  return null;
}

function graphHighlightIdForPane(version) {
  return state.activeGraphVersion === version ? graphNodeIdFromSelectedItem(state.selectedNode) : null;
}

function graphHoverIdForPane(version) {
  return version === "A" ? state.hoveredNodeIdA : state.hoveredNodeIdB;
}

function handleNodeHover(version, nodeId) {
  const key = version === "A" ? "hoveredNodeIdA" : "hoveredNodeIdB";
  if (state[key] === nodeId) return;
  state[key] = nodeId;

  // Only update SVG classes when the graph is visible.
  if (state.viewMode !== "graph") return;

  const svg = version === "A" ? graphSvgA : graphSvgB;
  if (!svg) return;

  updateGraphFocus(svg, graphHighlightIdForPane(version), nodeId, {
    subtreeFocus: state.dependencyGraphSubtreeFocus[version],
  });
}

/** Keep dependency graph dim/highlight in sync when selection changes from tree / code / etc. */
function syncGraphFocusFromSelection() {
  if (graphSvgA?.__graphIndex) {
    updateGraphFocus(graphSvgA, graphHighlightIdForPane("A"), graphHoverIdForPane("A"), {
      subtreeFocus: state.dependencyGraphSubtreeFocus.A,
    });
  }
  if (graphSvgB?.__graphIndex) {
    updateGraphFocus(graphSvgB, graphHighlightIdForPane("B"), graphHoverIdForPane("B"), {
      subtreeFocus: state.dependencyGraphSubtreeFocus.B,
    });
  }
}

function masterFxSelectedKey() {
  const key = state.selectedNode?.key;
  return typeof key === "string" ? key : null;
}

function selectedFormulaKey() {
  const selected = state.selectedNode;
  if (!selected) return null;
  if (selected.control == null || selected.property == null || selected.fileName == null) return null;
  return formulaKey(selected);
}

function renderMasterFx() {
  const parsed = state.activeGraphVersion === "B" ? state.parsedB : state.parsedA;

  if (!parsed) {
    masterFxList.innerHTML = `<div class="fx-item">No formulas loaded.</div>`;
    return;
  }

  const search = formulaSearch.value.trim().toLowerCase();
  const selectedKey = masterFxSelectedKey();

  const items = parsed.masterFx.filter((item) => {
    if (!search) return true;

    return (
      item.label.toLowerCase().includes(search) ||
      item.fileName.toLowerCase().includes(search) ||
      (item.formula || "").toLowerCase().includes(search)
    );
  });

  if (!items.length) {
    masterFxList.innerHTML = `<div class="fx-item">No matching formulas.</div>`;
    return;
  }

  masterFxList.innerHTML = items
    .map((item) => {
      const isSelected = item.key === selectedKey;
      const keyAttr = escapeHtml(item.key);
      return `
        <div class="fx-item${isSelected ? " is-selected" : ""}" data-key="${keyAttr}" ${
          isSelected ? 'aria-current="true"' : ""
        }>
          <div class="fx-item-title">${item.label}</div>
          <div class="fx-item-subtitle">${item.fileName}</div>
        </div>
      `;
    })
    .join("");

  masterFxList.querySelectorAll(".fx-item").forEach((element) => {
    element.addEventListener("click", () => {
      const key = element.dataset.key;
      const formula = parsed.formulasByKey[key];
      if (!formula) return;

      if (masterFxSelectedKey() === key) {
        state.selectedNode = null;
        clearDependencyGraphSubtreeFocus();
        renderInspectorItem(null);
      } else {
        applyGlobalFormulaSelection(state.activeGraphVersion, formula);
        renderInspectorItem(formula);
      }
      refreshGraph();
      refreshDependencyGraphScreenChips();
      renderMasterFx();
    });
  });
}

function refreshDiff() {
  const diff = compareVersions(state.parsedA, state.parsedB);
  renderDiffSummary(diffSummary, diff);
}

/**
 * Map an inspector reference label to a graph node or formula in the active version's parsed model.
 * @returns {{ type: "formula", formula: object } | { type: "node", node: object } | null}
 */
function resolveInspectorReferenceTarget(parsed, currentFormula, listCategory, refName) {
  if (!parsed || !currentFormula || refName == null) return null;
  const name = String(refName).trim();
  if (!name) return null;

  const nodes = parsed.nodes || [];
  const formulas = parsed.formulas || [];

  const kind =
    listCategory === "variablesSet" || listCategory === "variablesUsed"
      ? "variable"
      : listCategory === "controlsUsed"
        ? "control"
        : listCategory === "tablesUsed"
          ? "table"
          : listCategory === "columnsUsed"
            ? "column"
            : null;

  if (!kind) return null;

  if (kind === "table") {
    const id = `table::${name}`;
    const node = nodes.find((n) => n.id === id);
    return node ? { type: "node", node } : null;
  }

  if (kind === "column") {
    const colNodes = nodes.filter(
      (n) =>
        n.nodeType === "column" &&
        typeof n.id === "string" &&
        (n.id.endsWith(`::${name}`) || n.label === name)
    );
    if (!colNodes.length) return null;
    const tablesHint = currentFormula.references?.tablesUsed || [];
    if (tablesHint.length === 1) {
      const t = tablesHint[0];
      const wantId = `column::${t}::${name}`;
      const exact = colNodes.find((n) => n.id === wantId);
      if (exact) return { type: "node", node: exact };
    }
    const sorted = [...colNodes].sort((a, b) => a.id.localeCompare(b.id));
    return { type: "node", node: sorted[0] };
  }

  if (kind === "variable") {
    const fileName = currentFormula.fileName;
    if (fileName) {
      const preferred = nodes.find(
        (n) => n.nodeType === "variable" && n.id === `var::${name}::${fileName}`
      );
      if (preferred) return { type: "node", node: preferred };
    }
    const any = nodes.find(
      (n) =>
        n.nodeType === "variable" && typeof n.id === "string" && n.id.startsWith(`var::${name}::`)
    );
    return any ? { type: "node", node: any } : null;
  }

  if (kind === "control") {
    const matches = formulas.filter((f) => f.control === name);
    if (!matches.length) return null;
    const ck = currentFormula.key || formulaKey(currentFormula);
    const others = matches.filter((f) => (f.key || formulaKey(f)) !== ck);
    const pool = others.length ? others : matches;
    pool.sort((a, b) => {
      const fa = `${a.fileName || ""}|${a.property || ""}`;
      const fb = `${b.fileName || ""}|${b.property || ""}`;
      return fa.localeCompare(fb);
    });
    return { type: "formula", formula: pool[0] };
  }

  return null;
}

function isInspectorReferenceResolvable(parsed, currentFormula, listCategory, refName) {
  return resolveInspectorReferenceTarget(parsed, currentFormula, listCategory, refName) != null;
}

function applyInspectorReferenceSelection(listCategory, refName) {
  const version = state.activeGraphVersion === "B" ? "B" : "A";
  const parsed = getParsedForVersion(version);
  const current = state.selectedNode;
  if (!parsed || !current?.formula) return;

  const target = resolveInspectorReferenceTarget(parsed, current, listCategory, refName);
  if (!target) return;

  if (target.type === "formula") {
    applyGlobalFormulaSelection(version, target.formula);
    renderInspectorItem(target.formula);
  } else {
    state.activeGraphVersion = version;
    state.selectedNode = target.node;
    renderInspectorItem(target.node);
  }

  refreshGraphToggleUI();
  refreshDependencyGraphScreenChips();
  refreshGraph();
  renderMasterFx();
  requestAnimationFrame(() => {
    focusAndFitSelected(version);
  });
}

function renderInspectorItem(item) {
  if (!item) {
    renderDetails(detailsPanel, item);
    return;
  }

  if (item.nodeType === "formula" || item.formula) {
    const version = state.activeGraphVersion === "B" ? "B" : "A";
    const parsed = getParsedForVersion(version);
    renderFormulaDetails(detailsPanel, item, {
      diffStatus: getFormulaDiffStatus(item),
      formulaComparison: getFormulaComparison(item),
      formulaVersionLabels: getFormulaVersionLabels(),
      isReferenceResolvable: (cat, name) =>
        parsed ? isInspectorReferenceResolvable(parsed, item, cat, name) : false,
      onSelectReference: (cat, name) => applyInspectorReferenceSelection(cat, name),
    });
    return;
  }

  renderDetails(detailsPanel, item);
}

function getFormulaDiffStatus(formula) {
  if (!formula || !state.parsedA || !state.parsedB) return null;
  const key = formulaKey(formula);
  if (!key) return null;

  const formulaA = state.parsedA.formulasByKey?.[key];
  const formulaB = state.parsedB.formulasByKey?.[key];
  const inA = Boolean(state.parsedA.formulasByKey?.[key]);
  const inB = Boolean(state.parsedB.formulasByKey?.[key]);

  if (inB && !inA) return "added";
  if (inA && !inB) return "removed";
  if (formulaA && formulaB && formulasDiffer(formulaA, formulaB)) return "changed";
  return null;
}

function getFormulaComparison(formula) {
  if (!formula || !state.parsedA || !state.parsedB) return null;
  const key = formulaKey(formula);
  if (!key) return null;

  const before = state.parsedA.formulasByKey?.[key];
  const after = state.parsedB.formulasByKey?.[key];
  if (!before || !after) return null;
  if (!formulasDiffer(before, after)) return null;

  return { before, after };
}

function formulasDiffer(formulaA, formulaB) {
  return (
    formulaA.formula !== formulaB.formula ||
    JSON.stringify(formulaA.references || {}) !== JSON.stringify(formulaB.references || {})
  );
}

function getFormulaVersionLabels() {
  const labelA = formatVersionLabel("A", state.sourcePathA || state.selectedProjectFileA);
  const labelB = formatVersionLabel("B", state.sourcePathB || state.selectedProjectFileB);
  return { A: labelA, B: labelB };
}

function formatVersionLabel(slot, pathOrName) {
  if (!pathOrName) return `No file loaded (Version ${slot})`;
  const name = String(pathOrName).split(/[\\/]/).pop() || `Version ${slot}`;
  const baseName = name.replace(/\.json$/i, "");
  return `${baseName} (Version ${slot})`;
}

function refreshSummary() {
  const parsed = state.activeGraphVersion === "B" ? state.parsedB : state.parsedA;

  if (!parsed) {
    appSummary.textContent = "No file loaded.";
    return;
  }

  const summary = parsed.summary;
  appSummary.textContent =
    `${summary.appName} (${summary.versionLabel}) • ` +
    `${summary.fileCount} files • ` +
    `${summary.formulaCount} formulas • ` +
    `${summary.variableCount} variables • ` +
    `${summary.tableCount} tables • ` +
    `${summary.columnCount} columns`;
}

function normalizeUserProjectPath(input) {
  const t = String(input ?? "").trim();
  if (!t) {
    throw new Error("Enter a path or URL.");
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  if (t.startsWith("./") || t.startsWith("../")) {
    return t;
  }
  return `./${t.replace(/^\//, "")}`;
}

async function loadProjectDataFileIntoVersion(version, fileName) {
  const path = `./project-data/${fileName}`;

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }

  const json = await response.json();

  if (version === "A") {
    state.versionA = json;
    state.parsedA = parsePowerAppJson(json);
    resetTreeExpansionStateForPane("A");
    state.selectedProjectFileA = fileName;
    state.sourcePathA = path;
    state.dependencyGraphScreenFilterFileA = null;
  } else {
    state.versionB = json;
    state.parsedB = parsePowerAppJson(json);
    resetTreeExpansionStateForPane("B");
    state.selectedProjectFileB = fileName;
    state.sourcePathB = path;
    state.dependencyGraphScreenFilterFileB = null;
  }

  refreshUI();
}

async function loadProjectDataCustomPathIntoVersion(version, fetchPath) {
  const response = await fetch(fetchPath);
  if (!response.ok) {
    throw new Error(`Could not load ${fetchPath}`);
  }

  const json = await response.json();

  if (version === "A") {
    state.versionA = json;
    state.parsedA = parsePowerAppJson(json);
    resetTreeExpansionStateForPane("A");
    state.selectedProjectFileA = fetchPath;
    state.sourcePathA = fetchPath;
    state.dependencyGraphScreenFilterFileA = null;
  } else {
    state.versionB = json;
    state.parsedB = parsePowerAppJson(json);
    resetTreeExpansionStateForPane("B");
    state.selectedProjectFileB = fetchPath;
    state.sourcePathB = fetchPath;
    state.dependencyGraphScreenFilterFileB = null;
  }

  refreshUI();
}

async function loadProjectDataEntry(version, kind, pathKey) {
  if (kind === "custom") {
    await loadProjectDataCustomPathIntoVersion(version, pathKey);
  } else if (kind === "local") {
    await loadLocalProjectFileIntoVersion(version, pathKey);
  } else {
    await loadProjectDataFileIntoVersion(version, pathKey);
  }
}

async function loadLocalProjectFileIntoVersion(version, pathKey) {
  const file = state.localProjectFolder?.filesByKey.get(pathKey);
  if (!file) {
    throw new Error("That file is no longer available. Open the folder again.");
  }

  const text = await file.text();
  const json = JSON.parse(text);

  const displayPath = file.webkitRelativePath || file.name;

  if (version === "A") {
    state.versionA = json;
    state.parsedA = parsePowerAppJson(json);
    resetTreeExpansionStateForPane("A");
    state.selectedProjectFileA = pathKey;
    state.sourcePathA = displayPath;
    state.dependencyGraphScreenFilterFileA = null;
  } else {
    state.versionB = json;
    state.parsedB = parsePowerAppJson(json);
    resetTreeExpansionStateForPane("B");
    state.selectedProjectFileB = pathKey;
    state.sourcePathB = displayPath;
    state.dependencyGraphScreenFilterFileB = null;
  }

  refreshUI();
}

function clearProjectDataVersion(version) {
  if (version === "A") {
    state.versionA = null;
    state.parsedA = null;
    resetTreeExpansionStateForPane("A");
    state.selectedProjectFileA = null;
    state.sourcePathA = null;
    state.dependencyGraphScreenFilterFileA = null;
    fileAInput.value = "";
  } else {
    state.versionB = null;
    state.parsedB = null;
    resetTreeExpansionStateForPane("B");
    state.selectedProjectFileB = null;
    state.sourcePathB = null;
    state.dependencyGraphScreenFilterFileB = null;
    fileBInput.value = "";
  }

  if (state.activeGraphVersion === version) {
    state.activeGraphVersion = version === "A" ? "B" : "A";
  }

  state.selectedNode = null;
  clearDependencyGraphSubtreeFocus();
  state.logicSharedSelectionKey = null;
  state.logicPaneSelectionKey = { A: null, B: null };
  state.logicPaneSelectionIsOverridden = { A: false, B: false };
  refreshUI();
}

function setActiveGraphVersion(version) {
  state.activeGraphVersion = version === "B" ? "B" : "A";
  if (state.viewMode === "logic") {
    syncLogicSelectionToBothPanes(currentLogicGlobalSelectionKey());
    syncLogicPaneCollapseToActiveVersion();
  }
  refreshGraphToggleUI();
  refreshSummary();
  refreshDependencyGraphScreenChips();
  renderMasterFx();
}

/** Logic Flow: only the active version is full width; the other sits in the side rail. */
function syncLogicPaneCollapseToActiveVersion() {
  if (state.viewMode !== "logic") return;
  if (state.activeGraphVersion === "B") {
    state.logicPaneCollapsed.A = true;
    state.logicPaneCollapsed.B = false;
  } else {
    state.logicPaneCollapsed.A = false;
    state.logicPaneCollapsed.B = true;
  }
}

function swapLogicPaneCollapsedSides() {
  if (state.viewMode !== "logic") return;
  if (state.logicPaneCollapsed.A && !state.logicPaneCollapsed.B) {
    state.logicPaneCollapsed.A = false;
    state.logicPaneCollapsed.B = true;
  } else if (state.logicPaneCollapsed.B && !state.logicPaneCollapsed.A) {
    state.logicPaneCollapsed.B = false;
    state.logicPaneCollapsed.A = true;
  }
  refreshGraphToggleUI();
}

function toggleLogicPaneCollapsed(version) {
  if (state.viewMode !== "logic") return;
  if (version !== "A" && version !== "B") return;
  const other = version === "A" ? "B" : "A";
  const next = !state.logicPaneCollapsed?.[version];
  state.logicPaneCollapsed[version] = next;
  // Prevent both panes from being collapsed.
  if (state.logicPaneCollapsed[version] && state.logicPaneCollapsed[other]) {
    state.logicPaneCollapsed[other] = false;
  }
  refreshGraphToggleUI();
}

function setLogicPaneCollapsed(version, collapsed) {
  if (state.viewMode !== "logic") return;
  if (version !== "A" && version !== "B") return;
  state.logicPaneCollapsed[version] = !!collapsed;
  const other = version === "A" ? "B" : "A";
  if (state.logicPaneCollapsed[version] && state.logicPaneCollapsed[other]) {
    state.logicPaneCollapsed[other] = false;
  }
  refreshGraphToggleUI();
}

function refreshGraphToggleUI() {
  const isA = state.activeGraphVersion !== "B";
  const isLogicMode = state.viewMode === "logic";
  const showBothPanes = isLogicMode;
  const collapsedA = !!state.logicPaneCollapsed?.A;
  const collapsedB = !!state.logicPaneCollapsed?.B;
  if (centerPanel) centerPanel.classList.toggle("logic-split-layout", showBothPanes);
  if (centerPanel) centerPanel.classList.toggle("logic-pane-a-collapsed", isLogicMode && collapsedA);
  if (centerPanel) centerPanel.classList.toggle("logic-pane-b-collapsed", isLogicMode && collapsedB);

  if (graphPaneA) graphPaneA.classList.toggle("is-active", showBothPanes || isA);
  if (graphPaneB) graphPaneB.classList.toggle("is-active", showBothPanes || !isA);
  if (graphPaneA) graphPaneA.classList.toggle("is-collapsed-logic", isLogicMode && collapsedA);
  if (graphPaneB) graphPaneB.classList.toggle("is-collapsed-logic", isLogicMode && collapsedB);

  if (versionAChip) {
    versionAChip.classList.toggle("is-active", isA);
    versionAChip.setAttribute("aria-pressed", isA ? "true" : "false");
  }

  if (versionBChip) {
    versionBChip.classList.toggle("is-active", !isA);
    versionBChip.setAttribute("aria-pressed", !isA ? "true" : "false");
  }

  if (toggleLogicPaneABtn) {
    const isCollapsed = isLogicMode && collapsedA;
    const swapMode = isLogicMode && collapsedB && !collapsedA;
    toggleLogicPaneABtn.hidden = !isLogicMode;
    toggleLogicPaneABtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    const labelA = isCollapsed
      ? "Expand Version A pane"
      : swapMode
        ? "Swap: collapse Version A to rail and show Version B full width"
        : "Collapse Version A pane";
    toggleLogicPaneABtn.setAttribute("aria-label", labelA);
    toggleLogicPaneABtn.title = isCollapsed
      ? "Expand Version A"
      : swapMode
        ? "Swap which version is full width"
        : "Collapse Version A";
  }

  if (toggleLogicPaneBBtn) {
    const isCollapsed = isLogicMode && collapsedB;
    const swapMode = isLogicMode && collapsedA && !collapsedB;
    toggleLogicPaneBBtn.hidden = !isLogicMode;
    toggleLogicPaneBBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    const labelB = isCollapsed
      ? "Expand Version B pane"
      : swapMode
        ? "Swap: collapse Version B to rail and show Version A full width"
        : "Collapse Version B pane";
    toggleLogicPaneBBtn.setAttribute("aria-label", labelB);
    toggleLogicPaneBBtn.title = isCollapsed
      ? "Expand Version B"
      : swapMode
        ? "Swap which version is full width"
        : "Collapse Version B";
  }
}

function setViewMode(mode) {
  const prevMode = state.viewMode;
  if (mode === "tree" || mode === "logic" || mode === "code") {
    state.viewMode = mode;
  } else {
    state.viewMode = "graph";
  }
  if (state.viewMode === "logic" && prevMode !== "logic") {
    syncLogicSelectionFromCurrentStateForEnter();
    syncLogicPaneCollapseToActiveVersion();
  } else if (state.viewMode !== "logic") {
    state.logicPaneCollapsed.A = false;
    state.logicPaneCollapsed.B = false;
  }
  refreshUI();
}

function refreshViewToggleUI() {
  const mode = state.viewMode;
  const isGraph = mode === "graph";
  const isTree = mode === "tree";
  const isLogic = mode === "logic";
  const isCode = mode === "code";

  if (viewGraphBtn) {
    viewGraphBtn.classList.toggle("is-active", isGraph);
    viewGraphBtn.setAttribute("aria-pressed", isGraph ? "true" : "false");
  }
  if (viewTreeBtn) {
    viewTreeBtn.classList.toggle("is-active", isTree);
    viewTreeBtn.setAttribute("aria-pressed", isTree ? "true" : "false");
  }
  if (viewLogicBtn) {
    viewLogicBtn.classList.toggle("is-active", isLogic);
    viewLogicBtn.setAttribute("aria-pressed", isLogic ? "true" : "false");
  }
  if (viewCodeBtn) {
    viewCodeBtn.classList.toggle("is-active", isCode);
    viewCodeBtn.setAttribute("aria-pressed", isCode ? "true" : "false");
  }

  // Swap visibility in both panes (the active pane is controlled elsewhere).
  // Some browsers are inconsistent with toggleAttribute("hidden", ...) on SVG,
  // so we set both the hidden property and display style.
  if (graphSvgA) {
    graphSvgA.hidden = !isGraph;
    graphSvgA.style.display = isGraph ? "" : "none";
  }
  if (graphSvgB) {
    graphSvgB.hidden = !isGraph;
    graphSvgB.style.display = isGraph ? "" : "none";
  }
  if (treeContainerA) {
    treeContainerA.hidden = !isTree;
    treeContainerA.style.display = isTree ? "" : "none";
  }
  if (treeContainerB) {
    treeContainerB.hidden = !isTree;
    treeContainerB.style.display = isTree ? "" : "none";
  }
  if (treeSearchRowA) {
    treeSearchRowA.hidden = !isTree;
    treeSearchRowA.style.display = isTree ? "" : "none";
  }
  if (treeSearchRowB) {
    treeSearchRowB.hidden = !isTree;
    treeSearchRowB.style.display = isTree ? "" : "none";
  }
  if (logicContainerA) {
    logicContainerA.hidden = !isLogic;
    logicContainerA.style.display = isLogic ? "" : "none";
  }
  if (logicContainerB) {
    logicContainerB.hidden = !isLogic;
    logicContainerB.style.display = isLogic ? "" : "none";
  }
  if (codeContainerA) {
    codeContainerA.hidden = !isCode;
    codeContainerA.style.display = isCode ? "" : "none";
  }
  if (codeContainerB) {
    codeContainerB.hidden = !isCode;
    codeContainerB.style.display = isCode ? "" : "none";
  }

  graphContainerA?.classList.toggle("graph-container--code-view", isCode);
  graphContainerB?.classList.toggle("graph-container--code-view", isCode);
}

function refreshVersionPaths() {
  const aPath = state.sourcePathA || (state.selectedProjectFileA ? `./project-data/${state.selectedProjectFileA}` : null);
  const bPath = state.sourcePathB || (state.selectedProjectFileB ? `./project-data/${state.selectedProjectFileB}` : null);

  const toDisplayName = (pathOrName) => {
    if (!pathOrName) return null;
    return String(pathOrName).split(/[\\/]/).pop() || pathOrName;
  };

  const aDisplay = toDisplayName(aPath);
  const bDisplay = toDisplayName(bPath);

  const aText = aDisplay || "No file loaded.";
  const bText = bDisplay || "No file loaded.";

  if (versionAPath) versionAPath.textContent = aText;
  if (versionBPath) versionBPath.textContent = bText;
  if (graphPaneAPath) graphPaneAPath.textContent = aText;
  if (graphPaneBPath) graphPaneBPath.textContent = bText;
}

function bindLeftPanelCollapsibleSections() {
  for (const cfg of LEFT_PANEL_COLLAPSIBLE_SECTIONS) {
    document.getElementById(cfg.btnId)?.addEventListener("click", () => {
      const collapsed = state.leftPanelSectionsCollapsed;
      collapsed[cfg.key] = !collapsed[cfg.key];
      refreshLeftPanelCollapsibleSections();
    });
  }
}

function refreshLeftPanelCollapsibleSections() {
  const collapsed = state.leftPanelSectionsCollapsed;

  for (const cfg of LEFT_PANEL_COLLAPSIBLE_SECTIONS) {
    const section = document.getElementById(cfg.sectionId);
    const btn = document.getElementById(cfg.btnId);
    const isCollapsed = !!collapsed[cfg.key];
    const label = cfg.label;

    section?.classList.toggle("is-collapsed", isCollapsed);
    if (btn) {
      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      btn.title = isCollapsed ? `Show ${label}` : `Hide ${label}`;
      btn.setAttribute(
        "aria-label",
        isCollapsed ? `Show ${label} section` : `Hide ${label} section`
      );
    }
  }
}

function refreshTopbarUI() {
  const collapsed = !!state.topbarCollapsed;
  document.body.classList.toggle("topbar-collapsed", collapsed);
  if (toggleTopbarBtn) {
    toggleTopbarBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggleTopbarBtn.setAttribute(
      "aria-label",
      collapsed ? "Show tips header" : "Hide tips header"
    );
    toggleTopbarBtn.title = collapsed ? "Show tips header" : "Hide tips header";
  }
}

function refreshLeftPanelUI() {
  const isCollapsed = !!state.leftPanelCollapsed;
  const shellFs = isDependencyGraphShellFullscreen();
  const showLeftExpandTag = isCollapsed && shellFs;

  if (appShell) {
    appShell.classList.toggle("left-collapsed", isCollapsed);
  }
  if (leftPanel) {
    leftPanel.setAttribute("aria-hidden", "false");
  }
  if (collapseLeftPanelBtn) {
    collapseLeftPanelBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    if (isCollapsed) {
      collapseLeftPanelBtn.setAttribute("aria-label", "Expand Control Panel");
      collapseLeftPanelBtn.title = "Expand Control Panel";
    } else {
      collapseLeftPanelBtn.setAttribute("aria-label", "Collapse explorer panel");
      collapseLeftPanelBtn.title = "Collapse panel";
    }
  }
  if (expandLeftPanelBtn) {
    expandLeftPanelBtn.setAttribute("aria-hidden", showLeftExpandTag ? "false" : "true");
    expandLeftPanelBtn.tabIndex = showLeftExpandTag ? 0 : -1;
  }
}

function refreshRightPanelUI() {
  const isCollapsed = !!state.rightPanelCollapsed;
  const narrow = window.matchMedia("(max-width: 1200px)").matches;
  const shellFs = isDependencyGraphShellFullscreen();
  const showExpandTag = isCollapsed && (narrow || shellFs);

  if (appShell) {
    appShell.classList.toggle("right-collapsed", isCollapsed);
  }
  if (rightPanel) {
    rightPanel.setAttribute("aria-hidden", isCollapsed && narrow && !shellFs ? "true" : "false");
  }
  if (collapseRightPanelBtn) {
    collapseRightPanelBtn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    if (isCollapsed) {
      collapseRightPanelBtn.setAttribute("aria-label", "Expand Inspector");
      collapseRightPanelBtn.title = "Expand Inspector";
    } else {
      collapseRightPanelBtn.setAttribute("aria-label", "Collapse inspector panel");
      collapseRightPanelBtn.title = "Collapse panel";
    }
  }
  if (expandRightPanelBtn) {
    expandRightPanelBtn.setAttribute("aria-hidden", showExpandTag ? "false" : "true");
    expandRightPanelBtn.tabIndex = showExpandTag ? 0 : -1;
  }
}

/**
 * @param {string} label
 * @param {{ openFolder?: boolean, addPath?: boolean }} [actions]
 */
function renderProjectDataRootSummary(label, actions = {}) {
  const openFolder = !!actions.openFolder;
  const addPath = !!actions.addPath;
  const actionButtons = [];
  if (openFolder) {
    actionButtons.push(
      `<button type="button" class="secondary folder-add-path-btn" data-action="open-project-folder" title="Open local folder" aria-label="Open local folder"><span aria-hidden="true">+</span></button>`
    );
  }
  if (addPath) {
    actionButtons.push(
      `<button type="button" class="secondary folder-add-path-btn folder-add-path-text-btn" data-action="add-project-path" title="Add JSON by path or URL" aria-label="Add JSON by path or URL">URL</button>`
    );
  }
  const actionsHtml =
    actionButtons.length > 0
      ? `<span class="folder-tree-root-actions">${actionButtons.join("")}</span>`
      : "";
  return `
      <summary class="folder-tree-folder folder-tree-root-summary">
        <span class="folder-tree-root-label">${escapeHtml(label)}</span>
        ${actionsHtml}
      </summary>`;
}

function renderLocalFolderRootSummary(folderLabel) {
  return `
      <summary class="folder-tree-folder folder-tree-root-summary">
        <span class="folder-tree-root-label">${escapeHtml(folderLabel)}</span>
        <button type="button" class="secondary folder-add-path-btn folder-clear-local-btn" data-action="clear-local-project-folder" title="Remove this folder from the list" aria-label="Remove folder from list"><span aria-hidden="true">×</span></button>
      </summary>`;
}

async function loadProjectDataManifest() {
  try {
    const response = await fetch(PROJECT_DATA_MANIFEST_PATH);
    if (!response.ok) throw new Error("manifest not found");
    const data = await response.json();
    const raw = Array.isArray(data) ? data : data.files;
    if (!Array.isArray(raw)) throw new Error("invalid manifest");
    projectDataBuiltinFiles = raw
      .map((s) => String(s).trim().replace(/\\/g, "/"))
      .filter(
        (s) =>
          s.length > 0 &&
          s !== "manifest.json" &&
          !s.endsWith("/manifest.json") &&
          s !== "tips.json" &&
          !s.endsWith("/tips.json") &&
          !s.split("/").some((part) => part.startsWith(".")),
      );
  } catch {
    projectDataBuiltinFiles = [...PROJECT_DATA_FILES_FALLBACK];
  }
  renderProjectFilesView();
}

function normalizeTipsFromJson(data) {
  if (Array.isArray(data)) {
    return data.map((s) => String(s).trim()).filter(Boolean);
  }
  if (data && typeof data === "object" && Array.isArray(data.tips)) {
    return data.tips
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry.text === "string") return entry.text.trim();
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function setVisibleHeaderTip(text) {
  if (headerTipEl) headerTipEl.textContent = text;
}

function advanceHeaderTip() {
  if (headerTipStrings.length < 2) return;
  headerTipIndex = (headerTipIndex + 1) % headerTipStrings.length;
  setVisibleHeaderTip(headerTipStrings[headerTipIndex]);
}

function retreatHeaderTip() {
  if (headerTipStrings.length < 2) return;
  headerTipIndex =
    (headerTipIndex - 1 + headerTipStrings.length) % headerTipStrings.length;
  setVisibleHeaderTip(headerTipStrings[headerTipIndex]);
}

function stopHeaderTipRotation() {
  if (headerTipIntervalId != null) {
    window.clearInterval(headerTipIntervalId);
    headerTipIntervalId = null;
  }
}

function startHeaderTipRotation() {
  stopHeaderTipRotation();
  if (headerTipStrings.length < 2 || headerTipRotationPaused) return;
  headerTipIntervalId = window.setInterval(advanceHeaderTip, TIP_ROTATE_MS);
}

function syncTipRotationToggleUI() {
  if (!tipRotationToggleBtn) return;
  const canRotate = headerTipStrings.length >= 2;
  tipRotationToggleBtn.hidden = !canRotate;
  if (!canRotate) return;
  /* Playing: show pause icon. Paused: show play icon (see .is-tip-rotation-paused in CSS). */
  tipRotationToggleBtn.classList.toggle(
    "is-tip-rotation-paused",
    headerTipRotationPaused
  );
  if (headerTipRotationPaused) {
    tipRotationToggleBtn.setAttribute(
      "aria-label",
      "Resume automatic tip rotation"
    );
    tipRotationToggleBtn.setAttribute("aria-pressed", "true");
    tipRotationToggleBtn.title = "Play tips";
  } else {
    tipRotationToggleBtn.setAttribute(
      "aria-label",
      "Pause automatic tip rotation"
    );
    tipRotationToggleBtn.setAttribute("aria-pressed", "false");
    tipRotationToggleBtn.title = "Pause tips";
  }
}

function pauseHeaderTipRotation() {
  headerTipRotationPaused = true;
  stopHeaderTipRotation();
  syncTipRotationToggleUI();
}

function resumeHeaderTipRotation() {
  headerTipRotationPaused = false;
  startHeaderTipRotation();
  syncTipRotationToggleUI();
}

async function loadHeaderTips() {
  let list = [];
  try {
    const response = await fetch(TIPS_JSON_PATH);
    if (!response.ok) throw new Error("tips unavailable");
    const data = await response.json();
    list = normalizeTipsFromJson(data);
  } catch {
    /* keep empty; fallback below */
  }
  if (!list.length) {
    list = [...FALLBACK_HEADER_TIPS];
  }
  headerTipStrings = list;
  headerTipIndex =
    headerTipStrings.length > 0
      ? Math.floor(Math.random() * headerTipStrings.length)
      : 0;
  if (headerTipStrings.length) {
    setVisibleHeaderTip(headerTipStrings[headerTipIndex]);
  }
  const hideTipNav = headerTipStrings.length < 2;
  if (prevTipBtn) prevTipBtn.hidden = hideTipNav;
  if (nextTipBtn) nextTipBtn.hidden = hideTipNav;
  headerTipRotationPaused = false;
  syncTipRotationToggleUI();
  tipRotationToggleBtn?.addEventListener("click", () => {
    if (headerTipStrings.length < 2) return;
    if (headerTipRotationPaused) {
      resumeHeaderTipRotation();
    } else {
      pauseHeaderTipRotation();
    }
  });
  prevTipBtn?.addEventListener("click", () => {
    retreatHeaderTip();
  });
  nextTipBtn?.addEventListener("click", () => {
    advanceHeaderTip();
  });
  startHeaderTipRotation();
}

function renderProjectFilesView() {
  if (!projectFilesView) return;

  const loadingBuiltin = projectDataBuiltinFiles === undefined;
  const builtinList = loadingBuiltin ? [] : projectDataBuiltinFiles;

  const showBuiltinRoot = loadingBuiltin || builtinList.length > 0;
  const showAddOnAddedRoot = !loadingBuiltin && builtinList.length === 0;

  if (!showBuiltinRoot && !state.customProjectPaths.length && !state.localProjectFolder) {
    if (loadingBuiltin) {
      projectFilesView.innerHTML = `<p class="folder-tree-loading" role="status">Loading project-data…</p>`;
      return;
    }
    projectFilesView.textContent =
      "No built-in project-data files. Run node scripts/generate-project-data-manifest.mjs or add paths under project-data/, then refresh; use + to open a local JSON folder or add a path with URL.";
    return;
  }

  let html = "";

  if (showBuiltinRoot) {
    let builtinBody;
    if (loadingBuiltin) {
      builtinBody = `<p class="folder-tree-loading" role="status">Loading file list…</p>`;
    } else {
      const tree = buildProjectDataTree(builtinList, "builtin");
      sortFolderTreeNode(tree);
      builtinBody = renderProjectDataTreeChildren(tree);
    }
    html += `
    <details class="folder-tree-details folder-tree-root" open>
      ${renderProjectDataRootSummary("project-data", { openFolder: true, addPath: true })}
      ${builtinBody}
    </details>`;
  }

  if (state.localProjectFolder) {
    const { folderLabel, relativePaths } = state.localProjectFolder;
    const localTree = buildProjectDataTree(
      relativePaths,
      "local",
      (rel) => `${LOCAL_PROJECT_KEY_PREFIX}${rel}`
    );
    sortFolderTreeNode(localTree);
    html += `
    <details class="folder-tree-details folder-tree-root folder-tree-root--local" open>
      ${renderLocalFolderRootSummary(folderLabel)}
      ${renderProjectDataTreeChildren(localTree)}
    </details>`;
  }

  if (state.customProjectPaths.length) {
    const customTree = buildProjectDataTree(state.customProjectPaths, "custom");
    sortFolderTreeNode(customTree);
    html += `
    <details class="folder-tree-details folder-tree-root folder-tree-root--added" open>
      ${renderProjectDataRootSummary("Added paths", { addPath: showAddOnAddedRoot })}
      ${renderProjectDataTreeChildren(customTree)}
    </details>`;
  }

  projectFilesView.innerHTML = html;

  projectFilesView.querySelectorAll(".project-file-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const version = btn.dataset.load;
      const row = btn.closest(".project-file-row");
      const rowKind = row?.dataset?.kind;
      const kind = rowKind === "custom" ? "custom" : rowKind === "local" ? "local" : "builtin";
      const pathKey = decodeURIComponent(row?.dataset?.key || "");

      if (!pathKey || (version !== "A" && version !== "B")) return;

      const selectedForVersion =
        version === "A" ? state.selectedProjectFileA : state.selectedProjectFileB;
      const isSelected = selectedForVersion === pathKey;

      if (isSelected) {
        clearProjectDataVersion(version);
        return;
      }

      btn.disabled = true;
      try {
        await loadProjectDataEntry(version, kind, pathKey);
      } catch (error) {
        alert(error?.message || "Could not load project file.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function emptyFolderTreeNode() {
  return { folders: {}, files: [] };
}

function buildProjectDataTree(relativePaths, kind, getLeafKey) {
  const leafKeyFn = typeof getLeafKey === "function" ? getLeafKey : (rel) => rel;
  const root = emptyFolderTreeNode();
  for (const rel of relativePaths) {
    const parts = String(rel).split(/[/\\]/).filter(Boolean);
    if (!parts.length) continue;
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        cursor.files.push({ name: part, pathKey: leafKeyFn(rel), kind });
      } else {
        if (!cursor.folders[part]) cursor.folders[part] = emptyFolderTreeNode();
        cursor = cursor.folders[part];
      }
    }
  }
  return root;
}

function sortFolderTreeNode(node) {
  node.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const keys = Object.keys(node.folders).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  const next = {};
  for (const k of keys) {
    sortFolderTreeNode(node.folders[k]);
    next[k] = node.folders[k];
  }
  node.folders = next;
}

function renderProjectDataTreeChildren(node) {
  const folderNames = Object.keys(node.folders);
  const hasAny = folderNames.length > 0 || node.files.length > 0;
  if (!hasAny) {
    return `<p class="folder-tree-empty">No files in this folder.</p>`;
  }

  let html = `<ul class="folder-tree-list">`;
  for (const name of folderNames) {
    const child = node.folders[name];
    const inner = renderProjectDataTreeChildren(child);
    html += `
      <li class="folder-tree-item">
        <details class="folder-tree-details" open>
          <summary class="folder-tree-folder">${escapeHtml(name)}</summary>
          ${inner}
        </details>
      </li>`;
  }
  for (const f of node.files) {
    const pathKey = f.pathKey;
    const kind = f.kind === "custom" ? "custom" : f.kind === "local" ? "local" : "builtin";
    const safeKey = encodeURIComponent(pathKey);
    const isA = state.selectedProjectFileA === pathKey;
    const isB = state.selectedProjectFileB === pathKey;
    const titlePath =
      kind === "builtin"
        ? `project-data/${String(pathKey).replace(/\\/g, "/")}`
        : kind === "local"
          ? String(pathKey).startsWith(LOCAL_PROJECT_KEY_PREFIX)
            ? String(pathKey).slice(LOCAL_PROJECT_KEY_PREFIX.length)
            : String(pathKey).replace(/\\/g, "/")
          : String(pathKey).replace(/\\/g, "/");
    html += `
      <li class="folder-tree-item folder-tree-item--file">
        <div class="project-file-row" data-kind="${kind}" data-key="${safeKey}">
          <div class="project-file-path" title="${escapeHtml(titlePath)}">${escapeHtml(f.name)}</div>
          <div class="project-file-actions">
            <button class="project-file-btn secondary ${isB ? "is-selected" : ""}" data-load="B" aria-label="Load into Version B"${isB ? ' aria-pressed="true"' : ""}>B</button>
            <button class="project-file-btn ${isA ? "is-selected" : ""}" data-load="A" aria-label="Load into Version A"${isA ? ' aria-pressed="true"' : ""}>A</button>
          </div>
        </div>
      </li>`;
  }
  html += `</ul>`;
  return html;
}