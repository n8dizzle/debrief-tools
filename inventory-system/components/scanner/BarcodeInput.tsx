'use client';

import { forwardRef, useEffect, useRef } from 'react';

/**
 * Autofocused, large-typeface barcode input.
 *
 * Works with USB/Bluetooth scanners (which type the barcode and press
 * Enter), and with manual typing on a phone keyboard. Submits the
 * surrounding form on Enter — that's the standard scanner behaviour.
 */
export const BarcodeInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function BarcodeInput(props, ref) {
    const innerRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
      // Always autofocus on mount so a scanner just works.
      innerRef.current?.focus();
    }, []);
    return (
      <input
        {...props}
        ref={(el) => {
          innerRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode={props.inputMode ?? 'text'}
        className={`w-full bg-bg-secondary border-2 border-christmas-green rounded-lg px-4 py-4 text-lg font-mono outline-none focus:ring-2 focus:ring-christmas-green-light ${props.className ?? ''}`}
      />
    );
  },
);
