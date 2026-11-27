import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared modal shell: renders on document.body (so no parent can clip it or put the header above it),
 * locks the page behind it, and scrolls inside itself when the content is taller than the screen.
 */
export const ModalPortal: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = 'bg-slate-900/70 backdrop-blur-sm', children }) => {
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  return createPortal(
    <div className={`fixed inset-0 z-[1000] overflow-y-auto overscroll-contain ${className}`}>
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">{children}</div>
    </div>,
    document.body
  );
};
