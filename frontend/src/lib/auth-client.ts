'use client';

import { useSession } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user ? {
    id: (session.user as any).id,
    name: session.user.name,
    email: session.user.email,
    phone: (session.user as any).phone,
    isAdmin: (session.user as any).isAdmin || false,
    accessToken: (session as any).accessToken,
  } : null;

  return {
    user,
    isLoading,
    isAuthenticated,
  };
}
