# Power Fx Visualizer

**Documentation and code review tool for Power Apps / Power Fx** — inspect, navigate, and compare exported Power Apps JSON (developers, reviewers, or solution owners working from app exports).

## Features

### Loading and comparing

- **Version A** / **Version B** — file pickers under **Load JSON** for `.json` exports.
- **Compare Versions** — refreshes **Version Diff** when both parses are loaded.
- **Load Sample** — loads bundled [`sample-data/demo-v1.json`](sample-data/demo-v1.json) into Version A.
- **Reset** — clears loaded versions, selections, custom paths, and related UI state.
- **Folder** — built-in list from [`project-data/manifest.json`](project-data/manifest.json); click a file to load it. Use **+** to open a local folder of JSON (browser directory picker) or **Add JSON path** to register a relative path (e.g. `datatest.json`) or `http(s)` URL.

### Control panel (left)

- **Filters** — show or hide **App**, **Screens**, **Files**, **Formulas**, **Variables**, **Tables**, and **Columns** in the main views.
- **Master FX** — searchable list of formulas; selecting syncs with the graph, tree, code, and inspector where applicable.
- **Version Diff** — summary when two versions are loaded and compared.

### Main workspace (center)

- **Version A / B** chips — choose which version’s content drives single-pane behaviors (graph focus, exports, etc.).
- **Views** — **Dependency** (interactive SVG graph), **Tree View**, **Logic Flow**, **Code View**. Filters and selection apply across modes where relevant.
- **Toolbar** — hide/show the **tips** header, **Focused view** (hide side panels), **Full view** (show panels), **Export** (depends on active view; see [Exports](#exports) below).

### Dependency graph

- **Screen chips** (when applicable) — narrow the graph to one screen or **All**.
- **Center** / **Fit** — recenter or fit the viewport.
- **Expand** — fullscreen-style expansion of the dependency workspace.
- **Eye** (enabled when a node is selected) — hides every node and edge except the selected node and anything **connected to it** in the graph (same connected component along dependency edges). Click again to show the full graph.

### Logic Flow & Code

- **Logic Flow** — per-pane collapse and swap controls on the pane headers; formula-level logic diagrams where the parser provides them.
- **Code View** — consolidated formula text per loaded app, respecting the screen filter when set.

### Inspector (right)

- **Properties** — details for the selected graph node, tree row, or Master FX item.

### Header tips

- Rotating usage tips from [`project-data/tips.json`](project-data/tips.json). **Last** / **Next** navigate; the control beside them **pauses** or **resumes** auto-rotation.

## Run locally

The app loads [`js/app.js`](js/app.js) as an ES module and uses `fetch()` for samples, project data, and tips.

1. **Opening `index.html` directly** — Some browsers block ES modules or `fetch` from `file://`, so loading may be incomplete. Prefer a local server.

2. **Static HTTP server (recommended)** — From the repo root:

   ```bash
   python3 -m http.server 8000
   ```

   Then open `http://localhost:8000` (port may vary). Alternatives: `npx --yes serve .` or any static file server for this directory.

## Loading data

1. Use **Version A** / **Version B** to pick exports, then **Compare Versions** when both are loaded.
2. Or **Load Sample** to populate Version A from the repo.
3. Or pick a file from **Folder** (entries come from `project-data/manifest.json`).
4. Or add paths via **+** → **Add JSON path** for files not under `project-data/`.

**Try:** `demo-v1-1.json` in A and `demo-v1-2.json` in B for a richer compare (both ship under [`project-data/`](project-data/)). [`sample-data/demo-v1.json`](sample-data/demo-v1.json) is the small bundled sample used by **Load Sample**.

## Exports

From the toolbar **Export** button, behavior depends on the active view:

| View        | What gets downloaded |
|------------|------------------------|
| Dependency | SVG of the current dependency graph for the active version (filename includes screen scope and timestamp). |
| Tree View  | Text export of the tree for the active version. |
| Code View  | Text of formulas for the active version (respects screen filter). |
| Logic Flow | One SVG per visible logic-flow diagram in non-collapsed panes (staggered downloads). |

## Project layout

```
index.html
css/
  styles.css          # Layout, panels, graph / tree / logic / code UI
js/
  app.js              # Entry: wiring, load/compare/reset, folder & tips, views, export
  code-view.js        # Code view rendering
  details.js          # Inspector / properties panel
  diff.js             # Version diff summary
  logic.js            # Logic Flow UI, popout, interactions
  logic-flow-model.js # Logic flow structure from parsed formulas
  parser.js           # Power Apps JSON → graph/tree/formulas model
  renderer.js         # Dependency graph SVG layout and focus/hover styling
  state.js            # Application state
  tree.js             # Tree view
  utils.js            # Shared helpers
project-data/
  manifest.json       # Auto-generated list of bundled app JSON for the Folder UI
  tips.json           # Header tip strings (optional; app falls back if missing)
  demo-v1-1.json, demo-v1-2.json, demo-v2-1.json   # Example exports (see manifest)
sample-data/
  demo-v1.json        # Bundled sample for **Load Sample**
scripts/
  generate-project-data-manifest.mjs   # Regenerates project-data/manifest.json (excludes tips.json)
```

After adding or removing files under `project-data/`, regenerate the manifest:

```bash
node scripts/generate-project-data-manifest.mjs
```

## Data format

The tool expects Power Apps–style app JSON (as produced by typical export flows). For a concrete shape, open a representative file under [`project-data/`](project-data/) (for example [`project-data/demo-v1-1.json`](project-data/demo-v1-1.json)) rather than embedding large payloads in documentation.
