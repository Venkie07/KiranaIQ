import type { ReactNode } from 'react';

interface SafeTextProps {
  children: ReactNode;
  fallback?: string;
  className?: string;
}

/**
 * SafeText prevents the "Cannot convert object to primitive value" crash.
 * It ensures that whatever is passed to the UI is rendered as a string.
 */
export function SafeText({ children, fallback = '—', className = '' }: SafeTextProps) {
  if (children === null || children === undefined) {
    return <span className={className}>{fallback}</span>;
  }

  if (typeof children === 'object') {
    console.warn('SafeText received an object. Please pass a string or number.');
    return <span className={className}>{fallback}</span>;
  }

  return <span className={className}>{String(children)}</span>;
}
