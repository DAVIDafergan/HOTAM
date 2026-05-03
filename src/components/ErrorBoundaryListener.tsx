'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/lib/error-emitter';
import { DatabasePermissionError } from '@/lib/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function ErrorBoundaryListener() {
  const [error, setError] = useState<DatabasePermissionError | null>(null);

  useEffect(() => {
    const handleError = (err: DatabasePermissionError) => {
      setError(err);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (error) {
    throw error;
  }

  return null;
}
