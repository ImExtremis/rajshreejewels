import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth';
import CheckoutClient from './CheckoutClient';

export default async function CheckoutPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/auth/login?redirect=/checkout');
  }

  const sessionUser = {
    id: (session.user as any).id,
    name: session.user.name || '',
    email: session.user.email || '',
    phone: (session.user as any).phone || '',
    accessToken: (session as any).accessToken || '',
  };

  return <CheckoutClient sessionUser={sessionUser} />;
}
