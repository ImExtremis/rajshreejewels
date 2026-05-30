import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProductCard from '../components/product/ProductCard';
import { Product, ItemStatus, Category, Metal, Finish } from '../types';

// Mock products for pristine display on first load
const mockArrivals: Product[] = [
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
    primaryImageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=600&auto=format&fit=crop', // Beautiful placeholder
    images: [],
    keywords: ['kundan choker set', 'bridal artificial set'],
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
    keywords: ['1 gram gold bangles', 'artificial bangles set'],
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
    keywords: ['oxidised silver jhumkas', 'boho earrings online'],
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
    status: ItemStatus.SOLD, // Social proof test
    primaryImageUrl: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=600&auto=format&fit=crop',
    images: [],
    keywords: ['antique temple necklace', 'matte gold jewellery'],
    listedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const categoryTiles = [
  { name: '1-Gram Gold', slug: 'necklace?metal=GOLD_1GRAM', img: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?q=80&w=300&auto=format&fit=crop' },
  { name: 'Necklaces', slug: 'necklace', img: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=300&auto=format&fit=crop' },
  { name: 'Earrings', slug: 'earrings', img: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?q=80&w=300&auto=format&fit=crop' },
  { name: 'Bangles', slug: 'bangles', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=300&auto=format&fit=crop' },
  { name: 'Bracelets', slug: 'bracelet', img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=300&auto=format&fit=crop' },
  { name: 'Rings', slug: 'ring', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=300&auto=format&fit=crop' },
  { name: 'Bridal Sets', slug: 'set', img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=300&auto=format&fit=crop' },
  { name: 'Anklets', slug: 'anklet', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=300&auto=format&fit=crop' }
];

export default function Homepage() {
  return (
    <div className="flex flex-col space-y-20 pb-20">
      
      {/* 1. Hero Section */}
      <section className="relative bg-primary h-[55vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <Image
            src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=1600&auto=format&fit=crop"
            alt="Luxury background"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent" />
        </div>
        
        <div className="relative max-w-5xl mx-auto px-4 text-center space-y-6 z-10">
          <span className="text-accent uppercase tracking-widest text-xs sm:text-sm font-semibold font-body block animate-fade-in">
            Exclusive Indian Craftsmanship
          </span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-surface tracking-wide leading-tight">
            Handcrafted Jewellery.<br />One of a Kind.
          </h1>
          <p className="font-body text-xs sm:text-base text-white/90 max-w-xl mx-auto font-light leading-relaxed">
            Discover exquisite 1-gram gold, fine antique replicas, and Kundan pieces. Because each creation is physical, when it’s gone, it’s gone forever.
          </p>
          <div className="pt-6">
            <Link
              href="/shop"
              className="inline-block px-8 py-3.5 bg-accent-red hover:bg-accent-red-light text-white font-body text-xs font-bold uppercase tracking-widest rounded-card shadow-lg transition-all transform hover:translate-y-[-2px]"
            >
              Shop the Collection
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Trust Signals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-surface-2 border border-border-custom p-8 rounded-card shadow-card">
          
          <div className="text-center space-y-2">
            <div className="text-accent flex justify-center">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h4 className="font-display font-bold text-sm text-primary uppercase tracking-wide">1-Gram Gold Polish</h4>
            <p className="font-body text-3xs text-text-muted">Premium long-lasting gold microplating.</p>
          </div>

          <div className="text-center space-y-2">
            <div className="text-accent flex justify-center">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h4 className="font-display font-bold text-sm text-primary uppercase tracking-wide">One-of-a-Kind</h4>
            <p className="font-body text-3xs text-text-muted">Every piece is physical, unique and irreplaceable.</p>
          </div>

          <div className="text-center space-y-2">
            <div className="text-accent flex justify-center">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="font-display font-bold text-sm text-primary uppercase tracking-wide">Cash on Delivery</h4>
            <p className="font-body text-3xs text-text-muted">Pay on delivery available across India.</p>
          </div>

          <div className="text-center space-y-2">
            <div className="text-accent flex justify-center">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="font-display font-bold text-sm text-primary uppercase tracking-wide">Insured Shipping</h4>
            <p className="font-body text-3xs text-text-muted">Safe delivery via BlueDart & Delhivery aggregators.</p>
          </div>

        </div>
      </section>

      {/* 3. Category Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-primary">Shop by Category</h2>
          <p className="font-body text-xs text-text-muted">Curated designs crafted specifically for the elegant modern woman.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {categoryTiles.map((cat, idx) => (
            <Link
              key={idx}
              href={`/categories/${cat.slug}`}
              className="group relative h-48 sm:h-56 rounded-card overflow-hidden border border-border-custom/50 shadow-sm"
            >
              <Image
                src={cat.img}
                alt={cat.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/85 group-hover:via-black/45 transition-all duration-300" />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <span className="font-display text-lg sm:text-xl font-bold tracking-widest text-surface border-b-2 border-transparent group-hover:border-accent-red pb-1 uppercase transition-all">
                  {cat.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. New Arrivals (Products) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-4 border-b border-border-custom pb-4">
          <div className="space-y-2">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-primary">New Arrivals</h2>
            <p className="font-body text-xs text-text-muted">Freshly designed, high-lustre additions to our catalogue.</p>
          </div>
          <Link href="/shop" className="font-body text-xs uppercase tracking-widest font-bold text-accent hover:underline">
            View All Pieces →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {mockArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

    </div>
  );
}
