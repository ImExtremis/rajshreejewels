'use client';

import React, { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFields = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectPath = searchParams.get('redirect') || '/account';

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFields) => {
    setLoading(true);
    setError(null);
    try {
      const res = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (res?.error) {
        const errorMessages: Record<string, string> = {
          'CredentialsSignin': 'Invalid email or password.',
          'MissingCSRF': 'Session expired. Please try again.',
          'Default': 'Invalid credentials entered.',
        };
        setError(errorMessages[res.error] || errorMessages['Default']);
      } else {
        router.push(redirectPath);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: redirectPath });
  };

  return (
    <div className="max-w-md w-full mx-auto bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-wide">Sign In</h1>
        <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Access your Rajshree Jewels account</p>
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

        {/* Password */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="font-semibold text-primary uppercase tracking-wide">Password</label>
            <Link href="/auth/forgot-password" className="text-accent hover:underline font-bold text-2xs uppercase tracking-wide">
              Forgot?
            </Link>
          </div>
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

        <button
          type="submit"
          disabled={loading}
          className="w-full luxury-btn py-3 rounded-card text-xs font-bold uppercase tracking-widest transition-all mt-4 disabled:opacity-55"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center justify-between text-2xs uppercase tracking-wider text-text-muted font-bold py-2">
        <span className="h-[1px] bg-border-custom/50 flex-grow"></span>
        <span className="px-3">or</span>
        <span className="h-[1px] bg-border-custom/50 flex-grow"></span>
      </div>

      {/* Google Login */}
      <button
        onClick={handleGoogleSignIn}
        className="w-full py-3 bg-white border border-border-custom text-primary text-xs font-bold uppercase tracking-widest rounded-card flex items-center justify-center gap-3 shadow-sm hover:bg-surface transition-all"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      <div className="text-center text-xs text-text-muted mt-4">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-accent hover:underline font-bold uppercase tracking-wider text-2xs">
          Sign Up
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-surface">
      <Suspense fallback={
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
