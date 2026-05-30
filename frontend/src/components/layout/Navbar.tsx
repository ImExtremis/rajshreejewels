'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collections, setCollections] = useState<any[]>([]);
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated';

  const categories = [
    { name: 'Necklaces', slug: 'necklace' },
    { name: 'Earrings', slug: 'earrings' },
    { name: 'Bangles', slug: 'bangles' },
    { name: 'Bracelets', slug: 'bracelet' },
    { name: 'Rings', slug: 'ring' },
    { name: 'Sets', slug: 'set' },
  ];

  useEffect(() => {
    fetch('/api/v1/collections')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCollections(data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo.png" alt="Rajshree Jewels" className="h-10 sm:h-12 w-auto" />
            </Link>
          </div>

          {/* Large Viewport Categories & Collections */}
          <div className="hidden lg:flex space-x-8 items-center">
            {categories.map((cat) => {
              const isActive = pathname === `/categories/${cat.slug}`;
              return (
                <Link
                  key={cat.slug}
                  href={`/categories/${cat.slug}`}
                  className={`${isActive ? 'text-accent-red' : 'text-primary hover:text-accent-red'} font-body text-sm font-medium tracking-wide uppercase transition-colors`}
                >
                  {cat.name}
                </Link>
              );
            })}

            {/* Curated Collections Hover Dropdown */}
            {collections.length > 0 && (
              <div className="relative group py-4">
                <button className="text-primary group-hover:text-accent-red font-body text-sm font-medium tracking-wide uppercase transition-colors flex items-center gap-1 focus:outline-none">
                  <span>Collections</span>
                  <svg className="h-3 w-3 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute top-full left-0 hidden group-hover:block bg-surface border border-border-custom shadow-xl py-2 w-48 rounded animate-fade-in">
                  {collections.map((col) => {
                    const isActive = pathname === `/collections/${col.slug}`;
                    return (
                      <Link
                        key={col.slug}
                        href={`/collections/${col.slug}`}
                        className={`block px-4 py-2 text-3xs font-bold uppercase tracking-wider ${isActive ? 'text-accent-red' : 'text-primary hover:text-accent-red'} hover:bg-surface-2 transition-colors`}
                      >
                        {col.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <Link
              href="/shop"
              className={`${pathname === '/shop' ? 'text-accent-red font-bold' : 'text-primary hover:text-accent-red font-bold'} font-body text-sm tracking-wide uppercase transition-colors`}
            >
              Shop All
            </Link>
          </div>

          {/* Medium Viewports Condensed Links */}
          <div className="hidden md:flex lg:hidden space-x-6 items-center">
            {collections.length > 0 && (
              <div className="relative group py-4">
                <button className="text-primary group-hover:text-accent-red font-body text-sm font-medium tracking-wide uppercase transition-colors flex items-center gap-1 focus:outline-none">
                  <span>Collections</span>
                  <svg className="h-3 w-3 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute top-full left-0 hidden group-hover:block bg-surface border border-border-custom shadow-xl py-2 w-48 rounded animate-fade-in">
                  {collections.map((col) => {
                    const isActive = pathname === `/collections/${col.slug}`;
                    return (
                      <Link
                        key={col.slug}
                        href={`/collections/${col.slug}`}
                        className={`block px-4 py-2 text-3xs font-bold uppercase tracking-wider ${isActive ? 'text-accent-red' : 'text-primary hover:text-accent-red'} hover:bg-surface-2 transition-colors`}
                      >
                        {col.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <Link
              href="/shop"
              className={`${pathname === '/shop' ? 'text-accent-red font-bold' : 'text-primary hover:text-accent-red font-bold'} font-body text-sm tracking-wide uppercase transition-colors`}
            >
              Shop All
            </Link>
          </div>

          {/* Right menu (Search, Cart, Wishlist, User) */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Search */}
            <form action="/shop" method="GET" className="relative">
              <input
                type="text"
                name="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collection..."
                className="bg-surface-2/60 border border-border-custom rounded-full py-1.5 px-4 pr-10 text-sm focus:outline-none focus:border-accent-red text-text w-48 transition-all"
              />
              <button type="submit" className="absolute right-3 top-2.5 text-primary hover:text-accent-red">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>

            <Link href="/wishlist" className="text-primary hover:text-accent-red p-1 transition-colors relative">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>

            <Link href="/cart" className="text-primary hover:text-accent-red p-1 transition-colors relative">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {/* Cart Badge - Static for Phase 1 */}
              <span className="absolute -top-1 -right-1 bg-accent-red text-surface text-xs w-4 h-4 rounded-full flex items-center justify-center font-mono font-bold scale-90">
                0
              </span>
            </Link>

            {/* Profile / Account link */}
            <Link
              href={isLoggedIn ? "/account" : "/auth/login"}
              className="text-primary hover:text-accent-red p-1 transition-colors"
              title={isLoggedIn ? "My Account" : "Sign In"}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          </div>

          {/* Mobile hamburger menu button */}
          <div className="flex lg:hidden items-center space-x-4">
            <Link
              href={isLoggedIn ? "/account" : "/auth/login"}
              className="text-primary hover:text-accent-red p-1 transition-colors"
              title={isLoggedIn ? "My Account" : "Sign In"}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>

            <Link href="/cart" className="text-primary hover:text-accent-red relative p-1">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="absolute top-0 right-0 bg-accent-red text-surface text-[10px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono font-bold">
                0
              </span>
            </Link>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-primary hover:text-accent-red focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="lg:hidden bg-surface border-t border-border-custom px-4 pt-4 pb-6 space-y-3 shadow-xl transition-all">
          <form action="/shop" method="GET" className="relative mb-4">
            <input
              type="text"
              name="search"
              placeholder="Search collection..."
              className="bg-surface-2/65 border border-border-custom rounded-full py-2 px-4 pr-10 text-sm focus:outline-none focus:border-accent-red text-text w-full"
            />
            <button type="submit" className="absolute right-3 top-2.5 text-primary hover:text-accent-red">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>

          {categories.map((cat) => {
            const isActive = pathname === `/categories/${cat.slug}`;
            return (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                onClick={() => setIsOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${isActive ? 'text-accent-red bg-surface-2' : 'text-primary hover:text-accent-red hover:bg-surface-2'} transition-all uppercase tracking-wider`}
              >
                {cat.name}
              </Link>
            );
          })}
          {/* Mobile Curated Collections list */}
          {collections.length > 0 && (
            <div className="border-t border-border-custom/50 pt-3 space-y-1">
              <span className="block px-3 py-1 text-3xs font-bold text-accent-red uppercase tracking-widest">Curated Collections</span>
              {collections.map((col) => {
                const isActive = pathname === `/collections/${col.slug}`;
                return (
                  <Link
                    key={col.slug}
                    href={`/collections/${col.slug}`}
                    onClick={() => setIsOpen(false)}
                    className={`block px-6 py-2 rounded-md text-sm font-medium ${isActive ? 'text-accent-red bg-surface-2' : 'text-primary hover:text-accent-red hover:bg-surface-2'} transition-all uppercase tracking-wider`}
                  >
                    {col.name}
                  </Link>
                );
              })}
            </div>
          )}

          <Link
            href="/shop"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-md text-base font-bold ${pathname === '/shop' ? 'text-accent-red bg-surface-2' : 'text-primary hover:text-accent-red hover:bg-surface-2'} transition-all uppercase tracking-wider border-t border-border-custom/50 pt-3`}
          >
            Shop All
          </Link>

          <Link
            href={isLoggedIn ? "/account" : "/auth/login"}
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-md text-base font-bold ${pathname === '/account' || pathname === '/auth/login' ? 'text-accent-red bg-surface-2' : 'text-primary hover:text-accent-red hover:bg-surface-2'} transition-all uppercase tracking-wider border-t border-border-custom/50 pt-3`}
          >
            {isLoggedIn ? 'My Account' : 'Sign In / Register'}
          </Link>
        </div>
      )}
    </nav>
  );
}
