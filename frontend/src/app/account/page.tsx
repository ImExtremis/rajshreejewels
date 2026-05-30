import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth';
import AccountClient from './AccountClient';

export default async function AccountPage() {
  // Fetch session server-side (NextAuth v5 unified auth)
  const session = await auth();

  if (!session || !session.user) {
    redirect('/auth/login?redirect=/account');
  }

  const sessionUser = {
    id: (session.user as any).id,
    name: session.user.name || '',
    email: session.user.email || '',
    phone: (session.user as any).phone || '',
    accessToken: (session as any).accessToken || '',
  };

  return <AccountClient sessionUser={sessionUser} />;
}
