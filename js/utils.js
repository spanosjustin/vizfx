export function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected."));
        return;
      }
  
      const reader = new FileReader();
  
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error("Invalid JSON file."));
        }
      };
  
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsText(file);
    });
  }
  
  export function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /** Clipboard icon for small copy buttons (uses currentColor). */
  export const COPY_ICON_SVG = `<svg class="code-block-copy-icon" width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M4 1.5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3z"/></svg>`;
  
  export function formulaKey(item) {
    return `${item.control}::${item.property}::${item.fileName}`;
  }
  
  export function uniqueArray(arr = []) {
    return [...new Set(arr)];
  }
  
  export function getNodeColor(nodeType) {
    switch (nodeType) {
      case "file":
        return "#60a5fa";
      case "formula":
        return "#34d399";
      case "variable":
        return "#fbbf24";
      case "table":
        return "#f472b6";
      case "column":
        return "#a78bfa";
      default:
        return "#94a3b8";
    }
  }