import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

function getJwtExpMs(token?: string): number {
  if (!token) return 0;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function refreshAccessToken(token: any) {
  try {
    const BACKEND = process.env.BACKEND_URL || 'http://backend:4000';
    const res = await fetch(`${BACKEND}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });

    if (!res.ok) throw new Error('Backend refresh failed');

    const data = await res.json();
    return {
      ...token,
      accessToken: data.accessToken,
      accessTokenExpires: getJwtExpMs(data.accessToken),
    };
  } catch {
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpires: 0,
      error: 'RefreshAccessTokenError',
    };
  }
}

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
          refreshToken: data.refreshToken,
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
        token.refreshToken = (user as any).refreshToken;
        token.accessTokenExpires = getJwtExpMs((user as any).accessToken);
        token.isAdmin = (user as any).isAdmin;
        token.isOwner = (user as any).isOwner;
        token.isVerified = (user as any).isVerified;
        token.userId = user.id;
      }
      if (token.accessToken && Date.now() < ((token as any).accessTokenExpires || 0) - 30000) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
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
    error: '/auth/error',
  },
  session: { strategy: 'jwt' as const },
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
