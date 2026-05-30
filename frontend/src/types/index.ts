export enum ItemStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  UNLISTED = 'UNLISTED',
}

export enum Category {
  NECKLACE = 'NECKLACE',
  EARRINGS = 'EARRINGS',
  BANGLES = 'BANGLES',
  BRACELET = 'BRACELET',
  RING = 'RING',
  ANKLET = 'ANKLET',
  MAANG_TIKKA = 'MAANG_TIKKA',
  NOSE_PIN = 'NOSE_PIN',
  PENDANT = 'PENDANT',
  SET = 'SET',
  OTHER = 'OTHER',
}

export enum Metal {
  GOLD_1GRAM = 'GOLD_1GRAM',
  SILVER = 'SILVER',
  BRASS = 'BRASS',
  COPPER = 'COPPER',
  ALLOY = 'ALLOY',
  NONE = 'NONE',
}

export enum Finish {
  GOLD_POLISH = 'GOLD_POLISH',
  SILVER_POLISH = 'SILVER_POLISH',
  ANTIQUE = 'ANTIQUE',
  MATTE = 'MATTE',
  RHODIUM = 'RHODIUM',
  OXIDISED = 'OXIDISED',
  MEENAKARI = 'MEENAKARI',
  KUNDAN = 'KUNDAN',
  NONE = 'NONE',
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  urlThumb: string;
  urlMedium: string;
  urlFull: string;
  order: number;
  altText?: string | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string;
  shortDesc: string;
  category: Category;
  metal: Metal;
  finish: Finish;
  weightGrams?: number | null;
  dimensions?: string | null;
  stoneType?: string | null;
  occasion?: string | null;
  priceINR: number;
  originalPriceINR?: number | null;
  status: ItemStatus;
  reservedAt?: string | null;
  reservedByUserId?: string | null;
  soldAt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords: string[];
  primaryImageUrl: string;
  images: ProductImage[];
  listedAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
}

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  name: string;
  isAdmin: boolean;
  isVerified: boolean;
}
