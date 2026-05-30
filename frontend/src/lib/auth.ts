import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const BACKEND = process.env.BACKEND_URL || 'http://backend:4000';
        const res = await fetch(`${BACKEND}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: credentials?.email,
            password: credentials?.password,
          }),
        });
        
        if (!res.ok) return null;
        const data = await res.json();
        
        return {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          accessToken: data.accessToken,
          isAdmin: data.user.isAdmin,
          isOwner: data.user.isOwner,
          isVerified: data.user.isVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.isAdmin = (user as any).isAdmin;
        token.isOwner = (user as any).isOwner;
        token.isVerified = (user as any).isVerified;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken as string;
      if (session.user) {
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.isOwner = token.isOwner as boolean;
        session.user.isVerified = token.isVerified as boolean;
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  session: { strategy: 'jwt' as const },
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
