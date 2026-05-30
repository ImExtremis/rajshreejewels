'use client';

import React, { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const resetSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetFields = z.infer<typeof resetSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const token = searchParams.get('token');

  const { register, handleSubmit, formState: { errors } } = useForm<ResetFields>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetFields) => {
    if (!token) {
      setError('Invalid or missing secure reset token.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: data.password,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Password reset failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during password override');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md w-full mx-auto bg-surface-2 border border-border-custom p-8 rounded-card text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-error-custom">Invalid Link</h1>
        <p className="text-xs text-text-muted">The password reset link is invalid or has expired.</p>
        <Link href="/auth/login" className="luxury-btn inline-block py-2 px-6 rounded-card text-2xs uppercase tracking-widest font-bold font-body">
          Return to Sign In
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md w-full mx-auto bg-surface-2 border border-border-custom p-8 rounded-card text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-success-custom">🎉 Success!</h1>
        <p className="text-xs text-text-muted">Your password has been successfully updated. Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-wide">New Password</h1>
        <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Establish a secure password for your profile</p>
      </div>

      {error && (
        <div className="bg-error-custom/10 border border-error-custom text-error-custom text-xs rounded-card p-3 font-semibold uppercase tracking-wider text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
        {/* New Password */}
        <div className="space-y-1">
          <label className="font-semibold text-primary uppercase tracking-wide">New Password</label>
          <input
            type="password"
            {...register('password')}
            placeholder="••••••••"
            className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text"
          />
          {errors.password && (
            <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label className="font-semibold text-primary uppercase tracking-wide">Confirm Password</label>
          <input
            type="password"
            {...register('confirmPassword')}
            placeholder="••••••••"
            className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text"
          />
          {errors.confirmPassword && (
            <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full luxury-btn py-3 rounded-card text-xs font-bold uppercase tracking-widest transition-all mt-4 disabled:opacity-55"
        >
          {loading ? 'Updating...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-surface">
      <Suspense fallback={
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
