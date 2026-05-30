import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth';
import CartClient from './CartClient';

export default async function CartPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/auth/login?redirect=/cart');
  }

  const sessionUser = {
    id: (session.user as any).id,
    name: session.user.name || '',
    email: session.user.email || '',
    phone: (session.user as any).phone || '',
    accessToken: (session as any).accessToken || '',
  };

  return <CartClient sessionUser={sessionUser} />;
}
