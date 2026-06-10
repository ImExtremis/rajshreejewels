import React from 'react';
export const revalidate = 3600; // Cache for 1 hour by default, revalidated on demand
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from '../../../components/product/ProductDetailClient';
import { Product, ItemStatus } from '../../../types';

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
  } catch (err) {}

  return null;
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
