import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    /** Main content area (router outlet) */
    content: string;
    /** Left navigation drawer */
    sidebar: string;
  }
}
