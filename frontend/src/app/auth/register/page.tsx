'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits').max(15).optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFields = z.infer<typeof registerSchema>;

/* ── Eye icon SVGs ─────────────────────────────────────────────── */
function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
  });

  const onRegisterSubmit = async (data: RegisterFields) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Registration failed');
      }

      if (typeof window !== 'undefined' && body.accessToken) {
        localStorage.setItem('access_token', body.accessToken);
        if (body.refreshToken) {
          localStorage.setItem('refresh_token', body.refreshToken);
        }
        if (body.user) {
          localStorage.setItem('user', JSON.stringify(body.user));
        }
      }

      // Then trigger NextAuth session using the stored credentials
      const result = await signIn('credentials', {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (result?.ok) {
        router.push('/account');
        router.refresh();
      } else {
        // Fallback - redirect anyway since backend registration succeeded
        router.push('/account');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-surface">
      <div className="max-w-md w-full mx-auto glass-card p-8 rounded-card shadow-card space-y-6 font-body animate-fade-in">
        
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-wide">Create Account</h1>
          <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Join Rajshree Jewels storefront</p>
        </div>

        {error && (
          <div className="bg-error-custom/10 border border-error-custom text-error-custom text-xs rounded-card p-3 font-semibold uppercase tracking-wider text-center animate-slide-up">
            {error === 'EMAIL_EXISTS' ? 'An account with this email/phone number already exists' : error}
          </div>
        )}

        <form onSubmit={handleSubmit(onRegisterSubmit)} className="space-y-4 text-xs">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="font-semibold text-primary uppercase tracking-wide">Full Name</label>
            <input
              type="text"
              {...register('name')}
              placeholder="Your name"
              className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text"
            />
            {errors.name && (
              <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errors.name.message}</p>
            )}
          </div>

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

          {/* Phone */}
          <div className="space-y-1">
            <label className="font-semibold text-primary uppercase tracking-wide">Phone Number</label>
            <input
              type="tel"
              {...register('phone')}
              placeholder="98765 43210"
              className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text"
            />
            {errors.phone && (
              <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="font-semibold text-primary uppercase tracking-wide">Password</label>
            <div className="pw-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder="Min 8 characters"
                className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full luxury-btn py-3 rounded-card text-xs font-bold uppercase tracking-widest transition-all mt-4 disabled:opacity-55"
          >
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center text-xs text-text-muted mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent hover:underline font-bold uppercase tracking-wider text-2xs">
            Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}
