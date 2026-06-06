/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_KEY?: string;
}

declare module '*.html?raw' {
  const content: string;
  export default content;
}

declare module '*.jsx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType;
  export default Component;
}
