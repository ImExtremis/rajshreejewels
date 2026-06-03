'use client';

import React from 'react';
import Link from 'next/link';
import { Product, ItemStatus } from '../../types';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const isSold = product.status === ItemStatus.SOLD;
  const isReserved = product.status === ItemStatus.RESERVED;
  const hasDiscount = product.originalPriceINR && product.originalPriceINR > product.priceINR;

  const CardContent = (
    <div className={`group relative bg-surface-2 border border-border-custom rounded-card overflow-hidden shadow-card hover:shadow-lg transition-all duration-300 flex flex-col h-full ${isSold ? 'opacity-60 cursor-not-allowed' : 'gold-glow'}`}>
      
      {/* Image container */}
      <div className="relative aspect-square w-full bg-white overflow-hidden">
        <img
          src={product.primaryImageUrl}
          alt={product.displayName}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${!isSold && 'group-hover:scale-105'}`}
          loading="lazy"
        />

        {/* Wishlist button */}
        {!isSold && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Wishlist toggle callback
            }}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-surface/80 border border-border-custom text-text-muted hover:text-error-custom hover:bg-surface transition-colors z-10"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        )}

        {/* SOLD Overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center z-10">
            <span className="font-display text-2xl font-bold tracking-widest text-white border-2 border-white px-4 py-2 uppercase rotate-[-6deg]">
              SOLD OUT
            </span>
          </div>
        )}

        {/* RESERVED Badge */}
        {isReserved && (
          <div className="absolute top-3 left-3 bg-accent text-primary text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm z-10 animate-pulse">
            RESERVED
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && !isSold && (
          <div className="absolute top-3 left-3 bg-accent-red text-white text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm z-10">
            SAVE {Math.round(((product.originalPriceINR! - product.priceINR) / product.originalPriceINR!) * 100)}%
          </div>
        )}
      </div>

      {/* Info container */}
      <div className="p-4 flex flex-col flex-grow">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-accent-red mb-1 font-body">
          {product.category}
        </span>
        <h3 className="font-display text-base font-semibold text-primary group-hover:text-accent transition-colors line-clamp-1 mb-1">
          {product.displayName}
        </h3>
        <p className="font-body text-2xs text-text-muted line-clamp-2 mb-4 flex-grow">
          {product.shortDesc}
        </p>

        {/* Price and Action */}
        <div className="flex items-baseline justify-between mt-auto">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-base font-semibold text-primary">
              ₹{product.priceINR.toLocaleString('en-IN')}
            </span>
            {hasDiscount && (
              <span className="font-mono text-xs text-text-muted line-through">
                ₹{product.originalPriceINR!.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          
          <span className="text-2xs uppercase tracking-widest font-semibold text-accent group-hover:underline">
            {isSold ? 'View Details' : 'Buy Now →'}
          </span>
        </div>
      </div>
    </div>
  );

  if (isSold) {
    // Sold items are visually greyed out and not clickable, but we keep the detail link working to protect SEO backlinks as per "Things Not to Miss"
    return (
      <Link href={`/shop/${product.slug}`} className="cursor-pointer block h-full">
        {CardContent}
      </Link>
    );
  }

  return (
    <Link href={`/shop/${product.slug}`} className="block h-full">
      {CardContent}
    </Link>
  );
}
