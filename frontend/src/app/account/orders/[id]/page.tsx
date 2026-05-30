import { redirect } from 'next/navigation';
import { auth } from '../../../../lib/auth';
import OrderDetailClient from './OrderDetailClient';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  // Fetch session server-side (NextAuth v5 unified auth)
  const session = await auth();

  if (!session || !session.user) {
    redirect(`/auth/login?redirect=/account/orders/${params.id}`);
  }

  const sessionUser = {
    id: (session.user as any).id,
    name: session.user.name || '',
    email: session.user.email || '',
    accessToken: (session as any).accessToken || '',
  };

  return <OrderDetailClient orderId={params.id} sessionUser={sessionUser} />;
}
