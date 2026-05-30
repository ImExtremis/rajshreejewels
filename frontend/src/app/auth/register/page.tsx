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

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      }

      // 2. Auto-login via NextAuth using the same credentials
      const signInRes = await signIn('credentials', {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (signInRes?.error) {
        throw new Error(signInRes.error || 'Failed to automatically sign you in');
      }

      router.push('/account');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-16 bg-surface">
      <div className="max-w-md w-full mx-auto bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body">
        
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-wide">Create Account</h1>
          <p className="text-2xs text-text-muted uppercase tracking-wider font-semibold">Join Rajshree Jewels storefront</p>
        </div>

        {error && (
          <div className="bg-error-custom/10 border border-error-custom text-error-custom text-xs rounded-card p-3 font-semibold uppercase tracking-wider text-center">
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
            <input
              type="password"
              {...register('password')}
              placeholder="Min 8 characters"
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
