import React from 'react';
export const revalidate = 3600; // Cache for 1 hour by default, revalidated on demand
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from '../../../components/product/ProductDetailClient';
import { Product, Category, Metal, Finish, ItemStatus } from '../../../types';

// Mock catalog for SSR fallback
const mockCatalog: Product[] = [
  {
    id: 'p1',
    slug: 'kundan-bridal-choker-set-brass-kundan-kp01',
    name: 'Kundan Choker',
    displayName: 'Kundan Bridal Floral Choker Set',
    description: 'A spectacular, royal Kundan choker set complete with matching earrings. Intricately handcrafted in Jaipur, showcasing premium glass ruby beads and fine meenakari work on reverse. Perfect for weddings and grand festive occasions.',
    shortDesc: 'Premium Jaipur Kundan choker set with earrings.',
    category: Category.SET,
    metal: Metal.BRASS,
    finish: Finish.KUNDAN,
    priceINR: 2499,
    originalPriceINR: 3499,
    status: ItemStatus.AVAILABLE,
    primaryImageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=600&auto=format&fit=crop',
    images: [],
    keywords: ['kundan', 'set'],
    listedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'p2',
    slug: 'gold-polish-bangles-set-gold-1gram-gold-polish-bg02',
    name: '1-Gram Bangles',
    displayName: '1-Gram Gold Polish Filigree Bangles (Set of 4)',
    description: 'Exquisite 1-gram gold polish bangles showcasing delicate classic filigree craftsmanship. These premium copper-base bangles mimic solid gold perfectly and feature a highly durable anti-tarnish micro-plating.',
    shortDesc: 'Filigree filleted 1-gram gold polish bangles.',
    category: Category.BANGLES,
    metal: Metal.GOLD_1GRAM,
    finish: Finish.GOLD_POLISH,
    priceINR: 1299,
    status: ItemStatus.AVAILABLE,
    primaryImageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=600&auto=format&fit=crop',
    images: [],
    keywords: ['bangles', 'gold'],
    listedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'p3',
    slug: 'oxidised-silver-jhumka-silver-oxidised-er03',
    name: 'Oxidised Jhumkas',
    displayName: 'Oxidised Silver Traditional Peacock Jhumkas',
    description: 'Charming oxidised silver jhumka earrings featuring elegant twin-peacock motifs and tiny white pearls. Extremely lightweight and perfectly styled for bohemian, casual, or ethnic daywear.',
    shortDesc: 'Peacock motif oxidised silver jhumka earrings.',
    category: Category.EARRINGS,
    metal: Metal.SILVER,
    finish: Finish.OXIDISED,
    priceINR: 499,
    originalPriceINR: 799,
    status: ItemStatus.AVAILABLE,
    primaryImageUrl: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?q=80&w=600&auto=format&fit=crop',
    images: [],
    keywords: ['earrings', 'jhumka'],
    listedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'p4',
    slug: 'antique-matte-floral-necklace-brass-antique-nl04',
    name: 'Floral Necklace',
    displayName: 'Antique Matte Gold Leaf Floral Temple Necklace',
    description: 'A grand temple style necklace set in deep antique matte finish with delicate jasmine leaf shapes and ruby-red accents. Offers a highly premium, solid traditional weight and appearance.',
    shortDesc: 'Deep antique matte traditional floral necklace.',
    category: Category.NECKLACE,
    metal: Metal.BRASS,
    finish: Finish.ANTIQUE,
    priceINR: 1899,
    status: ItemStatus.SOLD,
    primaryImageUrl: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=600&auto=format&fit=crop',
    images: [],
    keywords: ['necklace', 'antique'],
    listedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Helper to fetch single product details (SSR with tag-based caching)
async function getProduct(slug: string): Promise<Product | null> {
  try {
    const BACKEND = process.env.BACKEND_URL || 'http://backend:4000';
    const res = await fetch(`${BACKEND}/api/v1/products/${slug}`, {
      next: { tags: [`product-${slug}`], revalidate: 3600 }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) { }

  // Graceful fallback to mock data during static compile or if API is offline
  return mockCatalog.find(p => p.slug === slug) || null;
}

interface PageProps {
  params: {
    slug: string;
  };
}

// Generate premium Dynamic Metadata for SEO (Section 7.1)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getProduct(params.slug);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  const title = product.metaTitle || `${product.displayName} | Rajshree Jewels`;
  const description = product.metaDescription || product.shortDesc;

  return {
    title,
    description,
    keywords: product.keywords.join(', '),
    openGraph: {
      title: product.displayName,
      description: product.shortDesc,
      images: [{ url: product.primaryImageUrl, width: 800, height: 800 }],
      type: 'music.song', // maps to generic og structures
    },
    alternates: {
      canonical: `https://rajshreejewels.com/shop/${product.slug}`,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const product = await getProduct(params.slug);

  if (!product) {
    notFound();
  }

  // Define structured JSON-LD data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.displayName,
    'description': product.description,
    'image': [
      product.primaryImageUrl,
      ...(product.images?.map(img => img.urlFull) || [])
    ],
    'offers': {
      '@type': 'Offer',
      'priceCurrency': 'INR',
      'price': product.priceINR,
      'availability': product.status === ItemStatus.SOLD
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      'seller': {
        '@type': 'Organization',
        'name': 'Rajshree Jewels'
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Insert JSON-LD structured data in header */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ProductDetailClient initialProduct={product} />
    </div>
  );
}
