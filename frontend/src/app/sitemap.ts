import { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://rajshreejewels.com';

  // Base routes
  const routes = [
    '',
    '/shop',
    '/categories/necklace',
    '/categories/earrings',
    '/categories/bangles',
    '/categories/bracelet',
    '/categories/ring',
    '/categories/set',
    '/categories/anklet',
    '/categories/1-gram-gold',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // Fetch only AVAILABLE products from database to prevent Google indexing SOLD products (technical SEO requirement)
  let products: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    const BACKEND = process.env.BACKEND_URL || 'http://backend:4000';
    const res = await fetch(`${BACKEND}/api/v1/products?limit=100`);
    if (res.ok) {
      const data = await res.json();
      // Only include AVAILABLE products
      products = (data.products || [])
        .filter((p: any) => p.status === 'AVAILABLE')
        .map((p: any) => ({
          slug: p.slug,
          updatedAt: new Date(p.updatedAt),
        }));
    }
  } catch (err) {}

  const productRoutes = products.map((product) => ({
    url: `${baseUrl}/shop/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...routes, ...productRoutes];
}
