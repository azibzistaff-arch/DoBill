import { useEffect } from 'react';

export const useBarcodeScanner = (onScan: (barcode: string) => void) => {
  useEffect(() => {
    let buffer = '';
    let lastTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is pressing modifier keys alone
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

      const currentTime = Date.now();
      
      // Hardware scanners usually send characters very fast (< 50ms)
      // We reset common human typing speed (usually > 100ms per char)
      if (currentTime - lastTime > 150) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          const code = buffer.trim();
          console.log('Barcode Scanned:', code);
          // Only prevent default if we're not in a situation where we want standard Enter behavior
          // But usually for scanners, we want to intercept it.
          e.preventDefault();
          onScan(code);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }

      lastTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
};
