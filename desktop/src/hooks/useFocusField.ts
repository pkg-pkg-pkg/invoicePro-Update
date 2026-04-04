import { useCallback, useEffect, useRef } from 'react';
import { focusRegistry, RegisterOptions } from '../services/focus/focusRegistry';

export const useFocusField = <T extends HTMLElement>(options: RegisterOptions) => {
  const nodeIdRef = useRef<string | undefined>(options.id);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!nodeIdRef.current) return;
    const { id: _id, ...meta } = optionsRef.current;
    focusRegistry.updateMeta(nodeIdRef.current, meta);
  }, [
    options.screenId,
    options.section,
    options.order,
    options.row,
    options.col,
    options.disabled,
    options.onBeforeNext,
    options.onBeforePrev,
  ]);

  useEffect(() => {
    if (options.id) {
      nodeIdRef.current = options.id;
    }
  }, [options.id]);

  const setRef = useCallback((node: T | null) => {
    if (node) {
      const { id, ...meta } = optionsRef.current;
      const assignedId = focusRegistry.register(meta, node, id ?? nodeIdRef.current);
      nodeIdRef.current = assignedId;
    } else if (nodeIdRef.current) {
      focusRegistry.unregister(nodeIdRef.current);
      nodeIdRef.current = undefined;
    }
  }, []);

  return setRef;
};
