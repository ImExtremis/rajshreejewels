import React from 'react';
import { Metadata } from 'next';
import ProductCard from '../../../components/product/ProductCard';
import { Product } from '../../../types';

interface CollectionData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerImageUrl: string | null;
  products: Product[];
}

async function getCollection(slug: string): Promise<CollectionData | null> {
  try {
    const BACKEND = process.env.BACKEND_URL || 'http://backend:4000';
    const res = await fetch(`${BACKEND}/api/v1/collections/${slug}`, {
      next: { revalidate: 3600, tags: [`collection-${slug}`] } // Cache and tag for ISR revalidation
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch collection details for slug: ${slug}`, err);
    return null;
  }
}

// Generate Dynamic SEO Metadata
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const collection = await getCollection(params.slug);
  
  if (!collection) {
    return {
      title: 'Collection Not Found | Rajshree Jewels',
      description: 'The requested curated jewellery collection could not be located.'
    };
  }

  const title = `${collection.name} Curated Collection | Rajshree Jewels`;
  const description = collection.description || `Explore our premium, handcrafted ${collection.name} pieces. Unique, one-of-a-kind jewellery creations.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: collection.bannerImageUrl ? [{ url: collection.bannerImageUrl }] : []
    }
  };
}

export default async function CollectionDetailPage({ params }: { params: { slug: string } }) {
  const collection = await getCollection(params.slug);

  if (!collection) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="font-display text-3xl font-semibold mb-4 text-primary">Collection Not Found</h2>
        <p className="text-text-muted font-body text-sm mb-8">The curated jewellery catalog you requested does not exist or has been unlisted.</p>
        <a href="/shop" className="inline-block bg-primary text-surface font-body text-xs font-bold uppercase tracking-wider py-3 px-8 rounded-md hover:bg-accent transition-colors">
          Return to Gallery
        </a>
      </div>
    );
  }

  const products = collection.products || [];

  // Structured Data (JSON-LD) for Rich Snippets
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': collection.name,
    'description': collection.description || `Exquisite handcrafted ${collection.name} collection.`,
    'url': `http://localhost:3000/collections/${collection.slug}`,
    'numberOfItems': products.length,
    'itemListElement': products.map((prod, idx) => ({
      '@type': 'ListItem',
      'position': idx + 1,
      'url': `http://localhost:3000/shop/${prod.slug}`,
      'name': prod.displayName,
      'image': prod.primaryImageUrl
    }))
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-body">
      {/* Inject JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Banner Section */}
      <div className="relative overflow-hidden rounded-lg border border-border-custom bg-surface-2/30 backdrop-blur-sm p-8 sm:p-12 mb-10 text-center flex flex-col items-center justify-center min-h-[250px]">
        {collection.bannerImageUrl && (
          <div 
            className="absolute inset-0 z-0 opacity-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${collection.bannerImageUrl})` }}
          />
        )}
        <div className="relative z-10 max-w-2xl">
          <span className="text-2xs uppercase tracking-widest text-accent font-semibold block mb-2">Curated Premium Showcase</span>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-primary mb-4 uppercase">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-text-muted text-sm sm:text-base leading-relaxed font-light">
              {collection.description}
            </p>
          )}
        </div>
      </div>

      {/* Product List Grid */}
      <div>
        <div className="flex justify-between items-center mb-6 border-b border-border-custom/50 pb-3">
          <h3 className="font-display text-lg font-bold tracking-wide uppercase">
            Available Creations ({products.length})
          </h3>
          <a href="/shop" className="text-3xs uppercase tracking-wider font-bold text-accent hover:underline">
            ← View All Products
          </a>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 bg-surface-2/40 border border-border-custom rounded-lg">
            <p className="font-display text-xl text-text-muted mb-4">No gorgeous pieces are currently in this collection.</p>
            <a href="/shop" className="luxury-btn py-2 px-6 rounded-card text-xs uppercase tracking-widest font-bold">
              Explore Store Gallery
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
