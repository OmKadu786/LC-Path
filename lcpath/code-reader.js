// code-reader.js — runs in MAIN world (has access to window.monaco)
// Listens for a 'lcpath-read-code' event from the isolated content script,
// reads the Monaco editor value, and dispatches it back as 'lcpath-code-result'.

window.addEventListener('lcpath-read-code', () => {
  let code = null;

  try {
    // Try getEditors() API
    const editors = window.monaco?.editor?.getEditors?.() || [];
    if (editors.length > 0) {
      code = editors[0].getModel?.()?.getValue?.() || null;
    }
  } catch (e) {}

  if (!code) {
    try {
      // Fallback: iterate all models and pick the one with content
      const models = window.monaco?.editor?.getModels?.() || [];
      for (const m of models) {
        const v = m.getValue?.();
        if (v && v.trim().length > 0) { code = v; break; }
      }
    } catch (e) {}
  }

  window.dispatchEvent(new CustomEvent('lcpath-code-result', {
    detail: { code: code || null }
  }));
});
