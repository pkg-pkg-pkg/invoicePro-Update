import { PropsWithChildren, useEffect } from 'react';
import { focusRegistry } from '../services/focus/focusRegistry';

const FocusProvider = ({ children }: PropsWithChildren<{}>) => {
  useEffect(() => {
    const handleKeyDown = focusRegistry.handleKeyDown;
    const handleFocusIn = focusRegistry.handleFocusIn;

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('focusin', handleFocusIn, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('focusin', handleFocusIn, true);
    };
  }, []);

  return <>{children}</>;
};

export default FocusProvider;
