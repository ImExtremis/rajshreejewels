import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL || 'http://backend:4000') + '/api/v1';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'mock_google_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_google_secret',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        accessToken: { label: 'Access Token', type: 'text' },
        user: { label: 'User JSON', type: 'text' },
      },
      async authorize(credentials) {
        if (credentials?.accessToken && credentials?.user) {
          try {
            const parsedUser = JSON.parse(credentials.user as string);
            return {
              id: parsedUser.id,
              name: parsedUser.name,
              email: parsedUser.email,
              phone: parsedUser.phone,
              isAdmin: parsedUser.isAdmin,
              accessToken: credentials.accessToken as string,
            };
          } catch (e) {
            console.error('❌ Failed to parse direct signin user:', e);
          }
        }

        if (!credentials?.email || !credentials?.password) return null;

        try {
          // Trigger login on Express API backend
          const res = await fetch(`${process.env.BACKEND_URL || 'http://backend:4000'}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Invalid credentials');
          }

          const data = await res.json();
          // Returns user object containing the JWT access token
          if (data && data.user && data.accessToken) {
            return {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              phone: data.user.phone,
              isAdmin: data.user.isAdmin,
              accessToken: data.accessToken,
            };
          }
        } catch (err: any) {
          throw new Error(err.message || 'Server error occurred');
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Sync Google logins with our Express backend
      if (account?.provider === 'google' && user) {
        try {
          const res = await fetch(`${process.env.BACKEND_URL || 'http://backend:4000'}/api/v1/auth/google/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleId: account.providerAccountId,
              email: user.email,
              name: user.name,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            token.accessToken = data.accessToken;
            token.id = data.user.id;
            token.phone = data.user.phone;
            token.isAdmin = data.user.isAdmin;
          }
        } catch (err) {
          console.error('❌ Google sync with backend failed:', err);
        }
      } else if (user) {
        // Credentials login path
        const u = user as any;
        token.accessToken = u.accessToken;
        token.id = u.id;
        token.phone = u.phone;
        token.isAdmin = u.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any;
        u.id = token.id as string;
        u.phone = token.phone as string;
        u.isAdmin = token.isAdmin as boolean;
        (session as any).accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback_secret_64_char_minimum',
});
export default auth;
