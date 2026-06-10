import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth';
import CheckoutClient from './CheckoutClient';

interface PageProps {
  searchParams: { [key: string]: string | undefined };
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session || !session.user) {
    const productId = searchParams?.productId;
    const redirectUrl = productId ? `/checkout?productId=${productId}` : '/checkout';
    redirect(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`);
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
