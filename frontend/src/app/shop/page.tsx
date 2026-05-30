'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from '../../components/product/ProductCard';
import { Product, Category, Metal, Finish, ItemStatus } from '../../types';

// Mock catalog for testing fallback
const mockCatalog: Product[] = [
  {
    id: 'p1',
    slug: 'kundan-bridal-choker-set-brass-kundan-kp01',
    name: 'Kundan Choker',
    displayName: 'Kundan Bridal Floral Choker Set',
    description: 'A spectacular, royal Kundan choker set complete with matching earrings.',
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
    description: 'Exquisite 1-gram gold polish bangles showcasing delicate classic filigree craftsmanship.',
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
    description: 'Charming oxidised silver jhumka earrings featuring elegant twin-peacock motifs.',
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
    description: 'A grand temple style necklace set in deep antique matte finish with delicate jasmine leaf shapes.',
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

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filter States
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMetal, setSelectedMetal] = useState<string>('');
  const [selectedFinish, setSelectedFinish] = useState<string>('');
  const [priceRange, setPriceRange] = useState<number>(5000);
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [products, setProducts] = useState<Product[]>(mockCatalog);
  const [loading, setLoading] = useState<boolean>(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  // Initialize states from URL query parameters
  useEffect(() => {
    const cat = searchParams.get('category');
    const metal = searchParams.get('metal');
    const finish = searchParams.get('finish');
    const maxPrice = searchParams.get('maxPrice');
    const sort = searchParams.get('sort');
    const q = searchParams.get('search');

    setSelectedCategories(cat ? cat.split(',') : []);
    setSelectedMetal(metal || '');
    setSelectedFinish(finish || '');
    setPriceRange(maxPrice ? Number(maxPrice) : 5000);
    setSortOrder(sort || 'newest');
    setSearchTerm(q || '');
  }, [searchParams]);

  // Fetch products from backend with filters
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const queryParts = [];
        if (selectedCategories.length > 0) queryParts.push(`category=${selectedCategories.join(',')}`);
        if (selectedMetal) queryParts.push(`metal=${selectedMetal}`);
        if (selectedFinish) queryParts.push(`finish=${selectedFinish}`);
        if (priceRange < 5000) queryParts.push(`maxPrice=${priceRange}`);
        if (sortOrder) queryParts.push(`sort=${sortOrder}`);
        if (searchTerm) queryParts.push(`search=${encodeURIComponent(searchTerm)}`);

        const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
        const res = await fetch(`/api/v1/products${queryStr}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || mockCatalog);
        } else {
          // Graceful fallback to filtered mock client-side
          applyClientSideFilters();
        }
      } catch (err) {
        applyClientSideFilters();
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [selectedCategories, selectedMetal, selectedFinish, priceRange, sortOrder, searchTerm]);

  const applyClientSideFilters = () => {
    let filtered = [...mockCatalog];
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(p => selectedCategories.includes(p.category.toString()));
    }
    if (selectedMetal) {
      filtered = filtered.filter(p => p.metal.toString() === selectedMetal);
    }
    if (selectedFinish) {
      filtered = filtered.filter(p => p.finish.toString() === selectedFinish);
    }
    filtered = filtered.filter(p => p.priceINR <= priceRange);
    
    // Sort
    if (sortOrder === 'price_asc') {
      filtered.sort((a, b) => a.priceINR - b.priceINR);
    } else if (sortOrder === 'price_desc') {
      filtered.sort((a, b) => b.priceINR - a.priceINR);
    }
    
    setProducts(filtered);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedMetal('');
    setSelectedFinish('');
    setPriceRange(5000);
    setSearchTerm('');
    router.push('/shop');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-body">
      <div className="flex flex-col space-y-6">
        
        {/* Title & Search summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide">
              {searchTerm ? `Search Results for "${searchTerm}"` : 'All Collections'}
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
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
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
                      checked={selectedCategories.includes(cat)}
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
              <select
                value={selectedMetal}
                onChange={(e) => setSelectedMetal(e.target.value)}
                className="w-full border border-border-custom bg-surface rounded-card p-2 text-xs focus:outline-none focus:border-accent"
              >
                <option value="">All Metals</option>
                {Object.keys(Metal).map((m) => (
                  <option key={m} value={m}>{m.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            {/* Finish Filter */}
            <div className="space-y-3">
              <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Finish Type</h4>
              <select
                value={selectedFinish}
                onChange={(e) => setSelectedFinish(e.target.value)}
                className="w-full border border-border-custom bg-surface rounded-card p-2 text-xs focus:outline-none focus:border-accent"
              >
                <option value="">All Finishes</option>
                {Object.keys(Finish).map((f) => (
                  <option key={f} value={f}>{f.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            {/* Price Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wide">
                <h4 className="font-display">Max Price</h4>
                <span className="font-mono text-accent">₹{priceRange}</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="100"
                value={priceRange}
                onChange={(e) => setPriceRange(Number(e.target.value))}
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
                        checked={selectedCategories.includes(cat)}
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
                <select
                  value={selectedMetal}
                  onChange={(e) => setSelectedMetal(e.target.value)}
                  className="w-full border border-border-custom bg-surface rounded-card p-2 text-xs focus:outline-none focus:border-accent"
                >
                  <option value="">All Metals</option>
                  {Object.keys(Metal).map((m) => (
                    <option key={m} value={m}>{m.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Finish */}
              <div className="space-y-3">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wide">Finish Type</h4>
                <select
                  value={selectedFinish}
                  onChange={(e) => setSelectedFinish(e.target.value)}
                  className="w-full border border-border-custom bg-surface rounded-card p-2 text-xs focus:outline-none focus:border-accent"
                >
                  <option value="">All Finishes</option>
                  {Object.keys(Finish).map((f) => (
                    <option key={f} value={f}>{f.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wide">
                  <h4 className="font-display">Max Price</h4>
                  <span className="font-mono text-accent">₹{priceRange}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
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
