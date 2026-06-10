'use client';

import React, { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import ProductCard from '../../../components/product/ProductCard';
import { Product, Category } from '../../../types';

interface CategoryPageProps {
  params: {
    category: string;
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const categoryParam = params.category.toUpperCase();
  
  // Validate category mapping
  const categoryKeys = Object.keys(Category);
  const matchedKey = categoryKeys.find(k => k.toLowerCase() === params.category.toLowerCase());
  
  if (!matchedKey && params.category !== '1-gram-gold') {
    notFound();
  }

  const categoryTitle = matchedKey ? matchedKey.replace('_', ' ') : '1-GRAM GOLD';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchCategoryProducts() {
      setLoading(true);
      try {
        let url = `/api/v1/products?limit=50`;
        if (matchedKey) {
          url += `&category=${matchedKey}`;
        } else if (params.category === '1-gram-gold') {
          url += `&metal=GOLD_1GRAM`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        } else {
          setProducts([]);
        }
      } catch (err) {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCategoryProducts();
  }, [matchedKey, params.category]);

  // Voice Search optimized FAQs targeting search engines
  const faqs = [
    {
      q: "What is 1 gram gold jewellery?",
      a: "1-gram gold jewellery is crafted by depositing a micro-layer of 24-carat gold over high-quality base metals like copper or brass. This matches the rich, lustrous shine of solid gold at a fraction of the cost."
    },
    {
      q: "Is artificial jewellery safe to wear?",
      a: "Yes. All our jewellery is lead-free, nickel-free, and hypoallergenic, preventing skin irritation. Ideal for sensitive skin during hot Indian festive seasons."
    },
    {
      q: "How long does gold polish last?",
      a: "With correct care, our premium gold micro-plating lasts up to 1 to 2 years of frequent wear. Store inside airtight pouches and keep away from sanitizers, perfumes, and water."
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-body space-y-16">
      
      {/* 1. SEO Static Content Section (Section 7.3) */}
      <section className="space-y-4 max-w-4xl">
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wide text-primary uppercase">
          {categoryTitle} JEWELLERY ONLINE INDIA
        </h1>
        <p className="text-xs sm:text-sm text-text-muted leading-relaxed font-light">
          Experience the pinnacle of luxury-grade elegance with our curated {categoryTitle.toLowerCase()} collection. 
          Individually handcrafted by master artisans in Jaipur, each exclusive design captures traditional heritage 
          while remaining lightweight for modern lifestyles. Perfect for weddings, grand festive functions, or casual daywear, 
          our premium micro-plating processes ensure unmatched brilliance and lasting shine. Since each of our items is physically unique, 
          when it sells out, it is gone permanently.
        </p>
      </section>

      {/* 2. Collection Showcase */}
      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold tracking-wide uppercase border-b border-border-custom pb-3">
          Browse Our Collection
        </h2>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-surface-2 rounded-card border border-border-custom text-text-muted text-xs">
            No active listings found in this collection. Relisting soon!
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 3. FAQ Section Accordions (Voice-search SEO) */}
      <section className="bg-surface-2 border border-border-custom p-8 rounded-card max-w-3xl space-y-6">
        <h2 className="font-display text-xl font-bold tracking-wide uppercase">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <details key={idx} className="group border-b border-border-custom/50 pb-4">
              <summary className="flex justify-between items-center text-xs font-semibold uppercase tracking-wide cursor-pointer list-none select-none hover:text-accent">
                <span>{faq.q}</span>
                <span className="transition-transform group-open:rotate-180">↓</span>
              </summary>
              <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

    </div>
  );
}
