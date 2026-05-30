'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
});

type ForgotPasswordFields = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFields>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFields) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Password reset request failed');
      }

      setSuccessMessage(body.message || 'If that email exists, a reset link has been sent');
    } catch (err: any) {
      setError(err.message || 'An error occurred while requesting password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-surface">
      <div className="max-w-md w-full mx-auto bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body">
        
        {successMessage ? (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-success-custom/10 border border-success-custom text-success-custom">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-wide">Link Sent</h1>
            <p className="text-xs text-text-muted leading-relaxed uppercase tracking-wider">
              {successMessage}
            </p>
            <div className="pt-4">
              <Link href="/auth/login" className="luxury-btn py-2.5 px-6 rounded-card text-2xs uppercase tracking-widest font-bold font-body inline-block">
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <h1 className="font-display text-3xl font-bold tracking-wide">Reset Password</h1>
              <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Enter email to recover your account</p>
            </div>

            {error && (
              <div className="bg-error-custom/10 border border-error-custom text-error-custom text-xs rounded-card p-3 font-semibold uppercase tracking-wider text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
              {/* Email */}
              <div className="space-y-1">
                <label className="font-semibold text-primary uppercase tracking-wide">Email Address</label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="name@email.com"
                  className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text"
                />
                {errors.email && (
                  <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full luxury-btn py-3 rounded-card text-xs font-bold uppercase tracking-widest transition-all mt-4 disabled:opacity-55"
              >
                {loading ? 'Sending Request...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="text-center text-xs text-text-muted mt-4">
              Remembered your password?{' '}
              <Link href="/auth/login" className="text-accent hover:underline font-bold uppercase tracking-wider text-2xs">
                Sign In
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
