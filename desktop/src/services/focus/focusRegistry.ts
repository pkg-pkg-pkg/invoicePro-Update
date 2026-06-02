import { nanoid } from 'nanoid';
import { findDOMNode } from 'react-dom';

export type FocusDirection = 'next' | 'prev';

export interface FocusMeta {
  screenId: string;
  order: number;
  section?: string;
  row?: number;
  col?: number;
  disabled?: boolean;
  onBeforeNext?: () => boolean | void;
  onBeforePrev?: () => boolean | void;
}

export interface RegisterOptions extends FocusMeta {
  id?: string;
}

interface FocusEntry {
  id: string;
  meta: FocusMeta;
  element: HTMLElement;
}

const compareEntries = (a: FocusEntry, b: FocusEntry) => {
  const sectionA = a.meta.section ?? '';
  const sectionB = b.meta.section ?? '';
  if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

  const orderDiff = (a.meta.order ?? 0) - (b.meta.order ?? 0);
  if (orderDiff !== 0) return orderDiff;

  const rowDiff = (a.meta.row ?? 0) - (b.meta.row ?? 0);
  if (rowDiff !== 0) return rowDiff;

  return (a.meta.col ?? 0) - (b.meta.col ?? 0);
};

const isElementInteractable = (element: HTMLElement | null) => {
  if (!element) return false;
  if (element.hasAttribute('disabled')) return false;
  if ('disabled' in element && (element as any).disabled) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  if (!element.offsetParent && element !== document.activeElement) return false;
  return true;
};

export const isElementEmpty = (element: EventTarget | null) => {
  if (!element || !(element instanceof HTMLElement)) return true;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return (element.value ?? '').toString().length === 0;
  }
  if (element.getAttribute('contenteditable') === 'true') {
    return (element.textContent ?? '').trim().length === 0;
  }
  const dataValue = element.getAttribute('data-focus-value');
  if (dataValue != null) {
    return dataValue.length === 0;
  }
  return (element.textContent ?? '').trim().length === 0;
};

class FocusRegistry {
  private entries = new Map<string, FocusEntry>();
  private elementToId = new WeakMap<HTMLElement, string>();
  private activeId: string | null = null;
  private pendingFocusId: string | null = null;

  register(meta: FocusMeta, rawElement: Element | null | undefined, requestedId?: string) {
    const element = this.resolveElement(rawElement);
    if (!element) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('focusRegistry: unable to register node without DOM element', meta);
      }
      return requestedId ?? createFocusId();
    }

    const id = requestedId ?? createFocusId();
    const existing = this.entries.get(id);
    if (existing) {
      existing.meta = meta;
      existing.element = element;
      this.elementToId.set(element, id);
      element.setAttribute('data-focus-id', id);
      return id;
    }

    const entry: FocusEntry = { id, meta, element };
    this.entries.set(id, entry);
    this.elementToId.set(element, id);
    element.setAttribute('data-focus-id', id);

    if (this.pendingFocusId && this.pendingFocusId === id) {
      this.pendingFocusId = null;
      this.focusEntry(entry);
    }

    return id;
  }

  unregister(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.element.removeAttribute('data-focus-id');
    this.entries.delete(id);
    if (this.activeId === id) {
      this.activeId = null;
    }
  }

  updateMeta(id: string, meta: FocusMeta) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.meta = meta;
  }

  updateElement(id: string, rawElement: Element | null | undefined) {
    const element = this.resolveElement(rawElement);
    if (!element) return;
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.element = element;
    this.elementToId.set(element, id);
    element.setAttribute('data-focus-id', id);
  }

  queueFocus(id: string) {
    this.pendingFocusId = id;
  }

  focusById(id: string) {
    const entry = this.entries.get(id);
    if (entry) {
      this.focusEntry(entry);
    } else {
      this.pendingFocusId = id;
    }
  }

  setActiveByElement(element: HTMLElement | null) {
    if (!element) return;
    const id = this.elementToId.get(element) ?? element.getAttribute('data-focus-id');
    if (!id) return;
    this.activeId = id;
  }

  getEntryByElement(element: HTMLElement | null) {
    if (!element) return null;
    const id = this.elementToId.get(element) ?? element.getAttribute('data-focus-id');
    if (!id) return null;
    return this.entries.get(id) ?? null;
  }

  moveActive(direction: FocusDirection) {
    if (!this.activeId) return;
    this.moveFrom(this.activeId, direction);
  }

  private moveFrom(id: string, direction: FocusDirection) {
    const entry = this.entries.get(id);
    if (!entry) return;

    if (direction === 'next' && entry.meta.onBeforeNext) {
      const proceed = entry.meta.onBeforeNext();
      if (proceed === false) return;
    }
    if (direction === 'prev' && entry.meta.onBeforePrev) {
      const proceed = entry.meta.onBeforePrev();
      if (proceed === false) return;
    }

    const ordered = this.getOrderedEntries(entry.meta.screenId);
    if (ordered.length === 0) return;
    const index = ordered.findIndex((e) => e.id === id);
    if (index < 0) return;

    const target = direction === 'next' ? ordered[index + 1] : ordered[index - 1];
    if (!target) return;
    this.focusEntry(target);
  }

  private focusEntry(entry: FocusEntry) {
    if (!isElementInteractable(entry.element)) return;
    requestAnimationFrame(() => {
      if (!isElementInteractable(entry.element)) return;
      entry.element.focus();
      if ('select' in entry.element && typeof (entry.element as any).select === 'function') {
        try {
          (entry.element as any).select();
        } catch {
          /* ignore */
        }
      }
      this.activeId = entry.id;
    });
  }

  private getOrderedEntries(screenId: string) {
    return Array.from(this.entries.values())
      .filter((entry) => entry.meta.screenId === screenId && !entry.meta.disabled && isElementInteractable(entry.element))
      .sort(compareEntries);
  }

  handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    // Modals (MUI Dialog, pickers) must receive Enter/Backspace — do not move voucher focus from behind the dialog.
    if (target?.closest?.('[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-tally-picker-modal]')) {
      return;
    }
    const entry = this.getEntryByElement(target);
    if (!entry) return;

    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      this.moveFrom(entry.id, 'next');
      return;
    }

    if (event.key === 'Backspace' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
      if (!isElementEmpty(target)) return;
      event.preventDefault();
      this.moveFrom(entry.id, 'prev');
    }
  };

  handleFocusIn = (event: FocusEvent) => {
    this.setActiveByElement(event.target as HTMLElement | null);
  };

  private resolveElement(node: Element | null | undefined) {
    if (!node) return null;
    if (typeof (node as any).setAttribute === 'function') {
      return node as HTMLElement;
    }
    try {
      const resolved = findDOMNode(node as any);
      if (resolved && typeof (resolved as any).setAttribute === 'function') {
        return resolved as HTMLElement;
      }
    } catch {
      // ignore, we'll warn below
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('focusRegistry: failed to resolve DOM element for node', node);
    }
    return null;
  }
}

class FocusIdGenerator {
  next() {
    return `focus-${nanoid(8)}`;
  }
}

export const focusRegistry = new FocusRegistry();
export const focusIdGenerator = new FocusIdGenerator();

export const createFocusId = () => focusIdGenerator.next();
