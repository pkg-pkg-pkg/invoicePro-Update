import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter, HashRouter } from 'react-router-dom';

import App from './App';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
  },
});

const isElectron =
  typeof navigator !== 'undefined' && /\bElectron\//i.test(navigator.userAgent);
const useHashRouter =
  isElectron ||
  (typeof window !== 'undefined' && window.location.protocol === 'file:');
const Router = useHashRouter ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <App />
      </Router>
    </ThemeProvider>
  </React.StrictMode>
);

