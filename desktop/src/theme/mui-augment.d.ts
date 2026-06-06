import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    /** Main content area (router outlet) */
    content: string;
    /** Navigation chrome (menu bar / sidebar) */
    sidebar: string;
    /** Top title bar */
    header: string;
    /** Secondary elevated surface */
    elevated: string;
    /** Card surface (dark enterprise) */
    card: string;
  }

  interface Palette {
    gold: Palette['primary'];
  }

  interface PaletteOptions {
    gold?: PaletteOptions['primary'];
  }
}
