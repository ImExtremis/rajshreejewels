import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Next.js on-demand ISR cache revalidation API route.
 * Security: Validates the request against the shared REVALIDATE_SECRET env token.
 * Route: POST /api/revalidate or GET /api/revalidate
 */
export async function GET(request: NextRequest) {
  return handleRevalidation(request);
}

export async function POST(request: NextRequest) {
  return handleRevalidation(request);
}

async function handleRevalidation(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const slug = searchParams.get('slug');
    const tag = searchParams.get('tag');

    // Secure token assertion
    const systemSecret = process.env.REVALIDATE_SECRET || 'rajshree_revalidate_secret_2026';
    if (secret !== systemSecret) {
      return NextResponse.json({ error: 'Unauthorised secret validation failure' }, { status: 401 });
    }

    if (tag) {
      // Purge by specific Next cache tag
      revalidateTag(tag);
      return NextResponse.json({ revalidated: true, type: 'tag', target: tag, timestamp: Date.now() });
    }

    if (slug) {
      // Purge specific product details route and general shop page
      revalidatePath(`/shop/${slug}`);
      revalidatePath('/shop');
      revalidatePath('/'); // refresh homepage grids if any
      revalidateTag(`product-${slug}`);
      revalidateTag('products');
      return NextResponse.json({ revalidated: true, type: 'slug', target: slug, timestamp: Date.now() });
    }

    // Default catch-all: clear general collection shells
    revalidatePath('/shop');
    return NextResponse.json({ revalidated: true, type: 'path', target: '/shop', timestamp: Date.now() });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Cache Purging Failed' }, { status: 500 });
  }
}
