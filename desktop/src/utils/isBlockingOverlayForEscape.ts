/**
 * Detects UI layers that should receive Escape before app-level "back" navigation.
 * Layout registers a capture-phase Escape listener; this must match MUI Dialog/Drawer/Modal
 * and other overlays even when focus is not yet inside the dialog paper.
 */
function isVisibleElement(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  return true;
}

export function isBlockingOverlayForEscape(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    if (
      active.closest(
        [
          '[role="dialog"]',
          '[role="alertdialog"]',
          '[aria-modal="true"]',
          '[data-tally-picker-modal]',
          '.MuiPopover-root',
          '.MuiMenu-root',
          '.MuiAutocomplete-popper',
          '[role="listbox"]',
        ].join(', ')
      )
    ) {
      return true;
    }
  }

  // MUI marks open Modal / Dialog / Drawer with this class on the modal root (v5+).
  if (document.querySelector('.MuiModal-open')) return true;

  for (const node of document.querySelectorAll('[aria-modal="true"]')) {
    if (node instanceof HTMLElement && isVisibleElement(node)) return true;
  }
  for (const node of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
    if (node instanceof HTMLElement && isVisibleElement(node)) return true;
  }

  return false;
}
