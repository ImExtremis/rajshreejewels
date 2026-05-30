import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth';
import WishlistClient from './WishlistClient';

export default async function WishlistPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/auth/login?redirect=/wishlist');
  }

  const sessionUser = {
    id: (session.user as any).id,
    name: session.user.name || '',
    email: session.user.email || '',
    phone: (session.user as any).phone || '',
    accessToken: (session as any).accessToken || '',
  };

  return <WishlistClient sessionUser={sessionUser} />;
}
