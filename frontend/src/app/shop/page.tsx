'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from '../../components/product/ProductCard';
import { Product, Category, Metal, Finish } from '../../types';

interface ShopFilters {
  categories: string[];
  metals: string[];
  finishes: string[];
  minPrice: number;
  maxPrice: number;
  search: string;
  sort: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function buildProductsUrl(filters: ShopFilters, page: number, maxPrice?: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '24');
  
  if (filters.categories && filters.categories.length > 0) {
    params.set('category', filters.categories.join(','));
  }
  if (filters.metals && filters.metals.length > 0) {
    params.set('metal', filters.metals.join(','));
  }
  if (filters.finishes && filters.finishes.length > 0) {
    params.set('finish', filters.finishes.join(','));
  }
  if (filters.minPrice && filters.minPrice > 0) {
    params.set('minPrice', String(filters.minPrice));
  }
  const actualMaxPrice = maxPrice !== undefined ? maxPrice : filters.maxPrice;
  if (actualMaxPrice && actualMaxPrice < 50000) {
    params.set('maxPrice', String(actualMaxPrice));
  }
  if (filters.search && filters.search.trim() !== '') {
    params.set('search', filters.search.trim());
  }
  if (filters.sort && filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }
  
  return `/api/v1/products?${params.toString()}`;
}

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filter States
  const [filters, setFilters] = useState<ShopFilters>({
    categories: [],
    metals: [],
    finishes: [],
    minPrice: 0,
    maxPrice: 50000,
    search: '',
    sort: 'newest',
  });

  const [sliderMaxPrice, setSliderMaxPrice] = useState<number>(50000);
  const debouncedMaxPrice = useDebounce(sliderMaxPrice, 500);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  // Synchronize URL query changes to state
  const updateUrl = (updated: Partial<ShopFilters>) => {
    const nextFilters = { ...filters, ...updated };
    const params = new URLSearchParams();
    
    if (nextFilters.categories && nextFilters.categories.length > 0) {
      params.set('category', nextFilters.categories.join(','));
    }
    if (nextFilters.metals && nextFilters.metals.length > 0) {
      params.set('metal', nextFilters.metals.join(','));
    }
    if (nextFilters.finishes && nextFilters.finishes.length > 0) {
      params.set('finish', nextFilters.finishes.join(','));
    }
    if (nextFilters.minPrice && nextFilters.minPrice > 0) {
      params.set('minPrice', String(nextFilters.minPrice));
    }
    if (nextFilters.maxPrice && nextFilters.maxPrice < 50000) {
      params.set('maxPrice', String(nextFilters.maxPrice));
    }
    if (nextFilters.search && nextFilters.search.trim() !== '') {
      params.set('search', nextFilters.search.trim());
    }
    if (nextFilters.sort && nextFilters.sort !== 'newest') {
      params.set('sort', nextFilters.sort);
    }
    
    const queryStr = params.toString();
    router.replace(`/shop${queryStr ? `?${queryStr}` : ''}`, { scroll: false });
  };

  // Initialize states from URL query parameters
  useEffect(() => {
    const cat = searchParams.get('category');
    const metal = searchParams.get('metal');
    const finish = searchParams.get('finish');
    const maxPrice = searchParams.get('maxPrice');
    const sort = searchParams.get('sort');
    const q = searchParams.get('search');

    const parsedMaxPrice = maxPrice ? Number(maxPrice) : 50000;
    const parsedCategories = cat ? cat.split(',').filter(Boolean) : [];
    const parsedMetals = metal ? metal.split(',').filter(Boolean) : [];
    const parsedFinishes = finish ? finish.split(',').filter(Boolean) : [];

    setFilters({
      categories: parsedCategories,
      metals: parsedMetals,
      finishes: parsedFinishes,
      minPrice: 0,
      maxPrice: parsedMaxPrice,
      sort: sort || 'newest',
      search: q || '',
    });
    setSliderMaxPrice(parsedMaxPrice);
  }, [searchParams]);

  // Synchronize debouncedMaxPrice back to URL search parameters
  useEffect(() => {
    if (debouncedMaxPrice !== filters.maxPrice) {
      updateUrl({ maxPrice: debouncedMaxPrice });
    }
  }, [debouncedMaxPrice]);

  // Fetch products from backend with filters
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const url = buildProductsUrl(filters, 1, debouncedMaxPrice);
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

    fetchProducts();
  }, [
    debouncedMaxPrice,
    filters.categories.join(','),
    filters.metals.join(','),
    filters.finishes.join(','),
    filters.sort,
    filters.search
  ]);

  const handleCategoryChange = (cat: string) => {
    const nextCategories = filters.categories.includes(cat)
      ? filters.categories.filter(c => c !== cat)
      : [...filters.categories, cat];
    updateUrl({ categories: nextCategories });
  };

  const handleMetalChange = (met: string) => {
    const nextMetals = filters.metals.includes(met)
      ? filters.metals.filter(m => m !== met)
      : [...filters.metals, met];
    updateUrl({ metals: nextMetals });
  };

  const handleFinishChange = (fin: string) => {
    const nextFinishes = filters.finishes.includes(fin)
      ? filters.finishes.filter(f => f !== fin)
      : [...filters.finishes, fin];
    updateUrl({ finishes: nextFinishes });
  };

  const clearFilters = () => {
    setFilters({
      categories: [],
      metals: [],
      finishes: [],
      minPrice: 0,
      maxPrice: 50000,
      search: '',
      sort: 'newest',
    });
    setSliderMaxPrice(50000);
    router.push('/shop');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-body">
      <div className="flex flex-col space-y-6">
        
        {/* Title & Search summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide">
              {filters.search ? `Search Results for "${filters.search}"` : 'All Collections'}
            </h1>
            <p className="text-2xs text-text-muted mt-1 uppercase tracking-wider font-semibold">
              Showing {products.length} elegant {products.length === 1 ? 'piece' : 'pieces'}
            </p>
          </div>
          
          {/* Sorting and Mobile Filter Toggle */}
          <div className="flex gap-4 w-full sm:w-auto items-center justify-between sm:justify-end">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden flex items-center gap-2 border border-border-custom px-4 py-2 rounded-card text-xs font-semibold text-primary uppercase bg-surface-2"
            >
              Filters
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>

            <select
              value={filters.sort}
              onChange={(e) => updateUrl({ sort: e.target.value })}
              className="border border-border-custom bg-surface rounded-card py-2 px-3 text-xs font-medium focus:outline-none focus:border-accent text-text"
            >
              <option value="newest">Sort: Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Main layout grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          
          {/* Desktop Sidebar Filters */}
          <div className="hidden md:flex flex-col space-y-8 bg-surface-2 border border-border-custom p-6 rounded-card shadow-sm sticky top-24">
            <div className="flex justify-between items-center border-b border-border-custom/50 pb-3">
              <h3 className="font-display text-lg font-bold tracking-wide uppercase">Filters</h3>
              <button onClick={clearFilters} className="text-3xs uppercase tracking-wider font-bold text-accent hover:underline">
                Clear All
              </button>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Category</h4>
              <div className="space-y-2 text-xs text-text-muted">
                {Object.keys(Category).map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer hover:text-accent">
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(cat)}
                      onChange={() => handleCategoryChange(cat)}
                      className="accent-accent h-4 w-4"
                    />
                    <span>{cat.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Metal Filter */}
            <div className="space-y-3">
              <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Metal Type</h4>
              <div className="space-y-2 text-xs text-text-muted">
                {Object.keys(Metal).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer hover:text-accent">
                    <input
                      type="checkbox"
                      checked={filters.metals.includes(m)}
                      onChange={() => handleMetalChange(m)}
                      className="accent-accent h-4 w-4"
                    />
                    <span>{m.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Finish Filter */}
            <div className="space-y-3">
              <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Finish Type</h4>
              <div className="space-y-2 text-xs text-text-muted">
                {Object.keys(Finish).map((f) => (
                  <label key={f} className="flex items-center gap-2 cursor-pointer hover:text-accent">
                    <input
                      type="checkbox"
                      checked={filters.finishes.includes(f)}
                      onChange={() => handleFinishChange(f)}
                      className="accent-accent h-4 w-4"
                    />
                    <span>{f.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wide">
                <h4 className="font-display">Max Price</h4>
                <span className="font-mono text-accent">₹{sliderMaxPrice}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50000"
                step="500"
                value={sliderMaxPrice}
                onChange={(e) => setSliderMaxPrice(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="md:col-span-3">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 bg-surface-2 border border-border-custom rounded-card">
                <p className="font-display text-xl text-text-muted mb-4">No gorgeous pieces match your filters.</p>
                <button onClick={clearFilters} className="luxury-btn py-2 px-6 rounded-card text-xs uppercase tracking-widest font-bold">
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Drawer Slide-over */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
          <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]" onClick={() => setMobileFiltersOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xs bg-surface p-6 flex flex-col space-y-6 overflow-y-auto">
              <div className="flex justify-between items-center border-b border-border-custom pb-3">
                <h3 className="font-display text-lg font-bold uppercase tracking-wide">Filters</h3>
                <button onClick={() => setMobileFiltersOpen(false)} className="text-text-muted hover:text-accent">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Category */}
              <div className="space-y-3">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Category</h4>
                <div className="space-y-2 text-xs text-text-muted">
                  {Object.keys(Category).map((cat) => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer hover:text-accent">
                      <input
                        type="checkbox"
                        checked={filters.categories.includes(cat)}
                        onChange={() => handleCategoryChange(cat)}
                        className="accent-accent h-4 w-4"
                      />
                      <span>{cat.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Metal */}
              <div className="space-y-3">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Metal Type</h4>
                <div className="space-y-2 text-xs text-text-muted">
                  {Object.keys(Metal).map((m) => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer hover:text-accent">
                      <input
                        type="checkbox"
                        checked={filters.metals.includes(m)}
                        onChange={() => handleMetalChange(m)}
                        className="accent-accent h-4 w-4"
                      />
                      <span>{m.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Finish */}
              <div className="space-y-3">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Finish Type</h4>
                <div className="space-y-2 text-xs text-text-muted">
                  {Object.keys(Finish).map((f) => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer hover:text-accent">
                      <input
                        type="checkbox"
                        checked={filters.finishes.includes(f)}
                        onChange={() => handleFinishChange(f)}
                        className="accent-accent h-4 w-4"
                      />
                      <span>{f.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wide">
                  <h4 className="font-display">Max Price</h4>
                  <span className="font-mono text-accent">₹{sliderMaxPrice}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="500"
                  value={sliderMaxPrice}
                  onChange={(e) => setSliderMaxPrice(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  clearFilters();
                  setMobileFiltersOpen(false);
                }}
                className="border border-border-custom/50 py-2.5 w-full rounded-card text-2xs uppercase tracking-widest text-text font-bold"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
