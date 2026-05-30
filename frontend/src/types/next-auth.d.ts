import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      name: string;
      email: string;
      isAdmin: boolean;
      isOwner: boolean;
      isVerified: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string;
    userId: string;
    isAdmin: boolean;
    isOwner: boolean;
    isVerified: boolean;
  }
}
