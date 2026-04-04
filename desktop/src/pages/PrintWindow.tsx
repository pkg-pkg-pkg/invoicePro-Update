import { useEffect } from 'react';

export default function PrintWindow() {
  useEffect(() => {
    const html = localStorage.getItem('pve_print_html') || '';
    if (!html) {
      try {
        window.close();
      } catch {
        // ignore
      }
      return;
    }

    const close = () => {
      try {
        window.close();
      } catch {
        // ignore
      }
    };

    try {
      window.onafterprint = () => close();
    } catch {
      // ignore
    }

    try {
      document.open();
      document.write(html);
      document.close();
    } catch {
      close();
      return;
    }

    requestAnimationFrame(() => {
      try {
        window.focus();
        window.print();
      } catch {
        close();
      }
    });

    setTimeout(close, 30000);
  }, []);

  return null;
}
