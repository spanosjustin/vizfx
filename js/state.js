export const state = {
    versionA: null,
    versionB: null,
    parsedA: null,
    parsedB: null,
    selectedProjectFileA: null,
    selectedProjectFileB: null,
    /** @type {string[]} Normalized fetch paths or URLs (not under project-data/). */
    customProjectPaths: [],
    /**
     * JSON files from a user-opened local folder (directory picker).
     * filesByKey keys and selection keys are `local::${relativePath}`.
     * @type {{ folderLabel: string, filesByKey: Map<string, File>, relativePaths: string[] } | null}
     */
    localProjectFolder: null,
    sourcePathA: null,
    sourcePathB: null,
    activeGraphVersion: "A",
    viewMode: "graph",
    logicSharedSelectionKey: null,
    logicPaneSelectionKey: {
      A: null,
      B: null,
    },
    logicPaneSelectionIsOverridden: {
      A: false,
      B: false,
    },
    logicPaneCollapsed: {
      A: false,
      B: false,
    },
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    /** Hide the page header (title + rotating tips) for more vertical space. */
    topbarCollapsed: false,
    leftPanelSectionsCollapsed: {
      loadJson: false,
      folder: false,
      filters: false,
      masterFx: false,
      versionDiff: false,
    },
    selectedNode: null,
    hoveredNodeIdA: null,
    hoveredNodeIdB: null,
    filters: {
      app: true,
      screens: true,
      files: true,
      formulas: true,
      variables: true,
      tables: true,
      columns: true,
    },
    /** Dependency graph view: filter graph to one screen file, or null for full graph. */
    dependencyGraphScreenFilterFileA: null,
    dependencyGraphScreenFilterFileB: null,

    /**
     * Dependency graph: when true, fade nodes/edges outside the selected node’s subtree-focus
     * neighborhood (see `dependencyGraphSubtreeFocusDirection` and `dependencyGraphSubtreeFocusDepth`).
     */
    dependencyGraphSubtreeFocus: {
      A: false,
      B: false,
    },

    /**
     * Dependency graph subtree focus: hop / step limit from the selection.
     * Undirected mode: undirected hops; upstream/downstream: directed steps along edges (arrow from→to).
     * `null` or `Infinity` = unlimited reach in that mode (WCC for undirected; full forward/back closure for directed).
     */
    dependencyGraphSubtreeFocusDepth: {
      A: null,
      B: null,
    },

    /**
     * Subtree focus edge direction: `undirected` (same as before), `upstream` (dependents — walk to→from),
     * `downstream` (dependencies — walk from→to). Arrows follow exported graph edges (dependent → dependency).
     */
    dependencyGraphSubtreeFocusDirection: {
      A: "undirected",
      B: "undirected",
    },

    /**
     * Code view: when true, show only formulas in the selected item’s dependency-graph
     * connected component (within the same visible subgraph as the graph view).
     */
    codeViewRelatedOnlyFocus: {
      A: false,
      B: false,
    },

    /**
     * Dependency graph view viewport state (Zoom/Pan) per pane.
     * Stored in app state so it survives `refreshGraph()` re-renders.
     */
    graphViewport: {
      A: { scale: 1, tx: 0, ty: 0 },
      B: { scale: 1, tx: 0, ty: 0 },
    },
    /**
     * Logic flow view viewport state (Zoom/Pan) per pane.
     * Also stores a selection token so viewport resets when formula changes.
     */
    logicViewport: {
      A: { scale: 1, tx: 0, ty: 0, selectionToken: null },
      B: { scale: 1, tx: 0, ty: 0, selectionToken: null },
    },

    /**
     * Tree view expansion persistence per pane (A/B).
     *
     * We store expanded/collapsed state in-memory so it survives
     * `refreshGraph()` re-renders (which rebuilds the tree DOM).
     */
    treeExpandedDetailsByPane: {
      A: new Set(),
      B: new Set(),
    },
    /**
     * Whether we've seeded default "top-level" nodes into the expansion set
     * for a pane. This prevents reseeding (and thus random resets) after the user
     * starts collapsing/expanding nodes.
     */
    treeExpandedDetailsInitializedByPane: {
      A: false,
      B: false,
    },

    /**
     * Tree UX behavior control:
     * When false, the next `refreshGraph()` in `viewMode === "tree"` will NOT
     * auto-expand the selected leaf path (used by "Collapse All").
     */
    treeAutoExpandSelectedLeafOnce: true,
  };