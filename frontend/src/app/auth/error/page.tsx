'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get('error');

  const errorMessages: Record<string, string> = {
    'CredentialsSignin': 'Invalid email or password.',
    'MissingCSRF': 'Session expired. Please try signing in again.',
    'Default': 'An unexpected authentication error occurred. Please try again.',
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-surface">
      <div className="max-w-md w-full mx-auto bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body text-center">
        
        <div className="space-y-2">
          {/* Elegant Alert/Error Icon */}
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-error-custom/10 border border-error-custom/30 flex items-center justify-center text-error-custom">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wide text-primary">Authentication Error</h1>
          <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Rajshree Jewels Security</p>
        </div>

        <div className="bg-error-custom/5 border border-error-custom/20 rounded-card p-4 text-xs font-medium text-text/80 leading-relaxed">
          {errorMessages[error || ''] || errorMessages['Default']}
        </div>

        <div className="pt-2">
          <Link
            href="/auth/login"
            className="inline-block w-full luxury-btn py-3 rounded-card text-xs font-bold uppercase tracking-widest transition-all"
          >
            Back to Login
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex justify-center items-center bg-surface">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
