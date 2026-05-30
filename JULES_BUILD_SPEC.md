# Jewellery Store — Full Build Specification
> **For:** Google Jules AI Agent  
> **Project type:** Self-hosted e-commerce platform  
> **Hardware target:** Raspberry Pi 4 (4GB+) or any x86 PC running Ubuntu Server 22.04  
> **Domain niche:** 1-gram gold jewellery, imitation jewellery, fashion jewellery — India market  
> **Last updated:** 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Tech Stack](#3-tech-stack)
4. [Database Schema](#4-database-schema)
5. [Backend API — Full Spec](#5-backend-api--full-spec)
6. [Frontend — Website Spec](#6-frontend--website-spec)
7. [SEO Strategy](#7-seo-strategy)
8. [Inventory System — One-of-a-Kind Logic](#8-inventory-system--one-of-a-kind-logic)
9. [AI Listing Pipeline](#9-ai-listing-pipeline)
10. [Mobile Listing App](#10-mobile-listing-app)
11. [Payment Integration — Razorpay](#11-payment-integration--razorpay)
12. [Order Management & Delivery](#12-order-management--delivery)
13. [Admin Dashboard](#13-admin-dashboard)
14. [Email & SMS Notifications](#14-email--sms-notifications)
15. [Authentication & User Accounts](#15-authentication--user-accounts)
16. [Infrastructure & Self-Hosting](#16-infrastructure--self-hosting)
17. [Environment Variables](#17-environment-variables)
18. [Build Phases & Checklist](#18-build-phases--checklist)
19. [Things Not to Miss](#19-things-not-to-miss)

---

## 1. Project Overview

A fully custom, self-hosted jewellery e-commerce store. No Shopify, no third-party store builders. Everything runs on a local server exposed to the internet via Cloudflare Tunnel.

### Business Context
- **Product type:** Physical jewellery — each piece is a one-of-a-kind item. No variants, no quantities. One item = one DB row. When sold, it is gone.
- **Category focus:** 1-gram gold jewellery, imitation/fashion jewellery, silver-finish, antique-finish, kundan, meenakari
- **Target market:** India — tier 1, 2, 3 cities; primarily women 18–45; mobile-first buyers
- **Price range:** ₹150 – ₹3,500 per piece
- **Seller workflow:** Owner photographs items on phone → uses mobile listing app → AI enhances copy + images → item goes live → customer buys → Shiprocket auto-books courier

### Core Constraints
- Everything runs locally — no managed cloud compute
- Images stored on local disk (external HDD recommended)
- All services containerized via Docker Compose
- Public access via Cloudflare Tunnel (free tier) — no static IP required
- Payment via Razorpay (India-native — UPI, cards, wallets, netbanking)

---

## 2. Repository Structure

```
jewellery-store/
├── docker-compose.yml
├── .env
├── nginx/
│   ├── nginx.conf
│   └── ssl/                        # Let's Encrypt certs (auto via certbot)
│
├── backend/                        # Node.js + Express API
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.ts                # Entry point
│   │   ├── config.ts               # Env + constants
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── adminGuard.ts
│   │   │   └── rateLimiter.ts
│   │   ├── routes/
│   │   │   ├── products.ts
│   │   │   ├── orders.ts
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── admin.ts
│   │   │   ├── payments.ts
│   │   │   └── listing.ts          # AI listing ingestion endpoint
│   │   ├── services/
│   │   │   ├── inventory.ts        # Status state machine
│   │   │   ├── payment.ts          # Razorpay logic
│   │   │   ├── shiprocket.ts       # Courier booking
│   │   │   ├── notifications.ts    # Email + SMS
│   │   │   ├── aiEnhance.ts        # OpenAI calls
│   │   │   └── imageProcessor.ts   # Sharp pipeline
│   │   └── utils/
│   │       ├── logger.ts
│   │       └── errors.ts
│
├── frontend/                       # Next.js 14 storefront
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── og-default.jpg          # Default Open Graph image
│   │   └── sitemap.xml             # Auto-generated
│   └── src/
│       ├── app/                    # App Router
│       │   ├── layout.tsx          # Root layout — fonts, metadata
│       │   ├── page.tsx            # Homepage
│       │   ├── shop/
│       │   │   ├── page.tsx        # Product grid
│       │   │   └── [slug]/
│       │   │       └── page.tsx    # Product detail (SSR for SEO)
│       │   ├── cart/
│       │   │   └── page.tsx
│       │   ├── checkout/
│       │   │   └── page.tsx
│       │   ├── account/
│       │   │   ├── page.tsx        # Profile + order history
│       │   │   └── orders/
│       │   │       └── [id]/
│       │   │           └── page.tsx
│       │   ├── auth/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── categories/
│       │   │   └── [category]/
│       │   │       └── page.tsx    # Category landing pages (SEO)
│       │   ├── sitemap.ts          # Dynamic sitemap generator
│       │   ├── robots.ts
│       │   └── api/                # Next.js API routes (thin proxies to backend)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.tsx
│       │   │   ├── Footer.tsx
│       │   │   └── MobileMenu.tsx
│       │   ├── product/
│       │   │   ├── ProductCard.tsx
│       │   │   ├── ProductGrid.tsx
│       │   │   ├── ProductImageGallery.tsx
│       │   │   ├── ProductBadge.tsx   # AVAILABLE / SOLD badge
│       │   │   └── FilterSidebar.tsx
│       │   ├── cart/
│       │   │   ├── CartDrawer.tsx
│       │   │   └── CartItem.tsx
│       │   ├── checkout/
│       │   │   ├── AddressForm.tsx
│       │   │   ├── OrderSummary.tsx
│       │   │   └── PaymentButton.tsx
│       │   └── ui/
│       │       ├── Badge.tsx
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       └── Toast.tsx
│       ├── lib/
│       │   ├── api.ts              # Typed API client
│       │   ├── auth.ts             # NextAuth config
│       │   └── store.ts            # Zustand stores
│       └── types/
│           └── index.ts
│
├── admin/                          # Separate Next.js admin dashboard
│   ├── Dockerfile
│   └── src/
│       └── app/
│           ├── page.tsx            # Overview stats
│           ├── orders/page.tsx
│           ├── products/page.tsx
│           └── settings/page.tsx
│
├── listing-app/                    # React Native (Expo) mobile app
│   ├── package.json
│   ├── app.json
│   └── src/
│       ├── screens/
│       │   ├── HomeScreen.tsx
│       │   ├── NewListingScreen.tsx
│       │   ├── PreviewScreen.tsx
│       │   └── PublishedScreen.tsx
│       └── services/
│           └── api.ts
│
└── scripts/
    ├── backup.sh                   # Daily DB + image backup to external HDD
    ├── health-check.sh
    └── tunnel-start.sh             # Starts cloudflared tunnel
```

---

## 3. Tech Stack

### Backend
| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Stable, large ecosystem |
| Framework | Express.js | Lightweight, full control |
| Language | TypeScript | Type safety |
| ORM | Prisma | Clean schema, migrations, type-safe queries |
| Database | PostgreSQL 15 | Relational, ACID — critical for inventory atomicity |
| Cache / Sessions | Redis 7 | Session store, reservation TTL, rate limiting |
| Image processing | Sharp | Fast, native — resize, WebP convert, compress |
| Job queue | Bull (Redis-backed) | Async AI enhance jobs, email queue |
| Auth | JWT (access) + HttpOnly cookie (refresh) | Stateless API auth |
| Validation | Zod | Runtime schema validation |
| Email | Nodemailer + Gmail SMTP / SMTP2Go | Transactional emails |
| SMS | Twilio / MSG91 | Order + delivery SMS |

### Frontend (Storefront)
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Animations | Framer Motion |
| Auth | NextAuth.js v5 |
| SEO | Next.js Metadata API (native) |
| Image CDN | Served directly from backend (local disk via Nginx) |

### Mobile Listing App
| Layer | Technology |
|---|---|
| Framework | React Native via Expo (SDK 51+) |
| Navigation | Expo Router |
| Image picker | expo-image-picker |
| Camera | expo-camera |
| HTTP | Axios |
| Storage | expo-secure-store (JWT token) |

### AI & Enrichment
| Task | Service |
|---|---|
| Product copywriting | OpenAI GPT-4o |
| Image enhancement + bg removal | OpenAI GPT-Image-1 (gpt-image-1) |
| SEO meta generation | GPT-4o (same call, extended output) |

### Infrastructure
| Component | Technology |
|---|---|
| Containerisation | Docker + Docker Compose |
| Reverse proxy | Nginx |
| Public tunnel | Cloudflare Tunnel (cloudflared) |
| SSL | Let's Encrypt via certbot (or Cloudflare proxy SSL) |
| Process manager | PM2 inside containers / systemd on host |
| Backups | Bash cron scripts → external HDD |
| Monitoring | Uptime Kuma (self-hosted, lightweight) |

---

## 4. Database Schema

Full Prisma schema. Run `npx prisma migrate dev` to apply.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ────────────────────────────────────────────────

enum ItemStatus {
  AVAILABLE
  RESERVED      // Checkout started — 15-min TTL
  SOLD
  UNLISTED      // Admin hid it manually
}

enum OrderStatus {
  PENDING_PAYMENT
  PAYMENT_FAILED
  CONFIRMED
  PROCESSING      // Admin acknowledged
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum Metal {
  GOLD_1GRAM
  SILVER
  BRASS
  COPPER
  ALLOY
  NONE          // Purely fabric/stone pieces
}

enum Finish {
  GOLD_POLISH
  SILVER_POLISH
  ANTIQUE
  MATTE
  RHODIUM
  OXIDISED
  MEENAKARI
  KUNDAN
  NONE
}

enum Category {
  NECKLACE
  EARRINGS
  BANGLES
  BRACELET
  RING
  ANKLET
  MAANG_TIKKA
  NOSE_PIN
  PENDANT
  SET             // Matched necklace + earring set
  OTHER
}

enum PaymentMethod {
  UPI
  CARD
  NETBANKING
  WALLET
  COD
}

// ─── USERS ────────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  phone         String?   @unique
  name          String
  passwordHash  String?
  googleId      String?   @unique
  isAdmin       Boolean   @default(false)
  isVerified    Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  addresses     Address[]
  orders        Order[]
  wishlist      WishlistItem[]
  sessions      Session[]
}

model Session {
  id          String    @id @default(cuid())
  userId      String
  token       String    @unique
  expiresAt   DateTime
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Address {
  id            String    @id @default(cuid())
  userId        String
  label         String    @default("Home")   // Home / Work / Other
  name          String                        // Recipient name
  phone         String
  line1         String
  line2         String?
  city          String
  state         String
  pincode       String
  isDefault     Boolean   @default(false)
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders        Order[]
}

// ─── PRODUCTS ─────────────────────────────────────────────

model Product {
  id              String      @id @default(cuid())
  slug            String      @unique             // URL slug — auto-generated from name
  name            String                          // Raw name entered by seller
  displayName     String                          // AI-enhanced display name
  description     String                          // AI-written SEO description (150-200 words)
  shortDesc       String                          // One-liner for cards (50 chars max)
  
  // Classification
  category        Category
  metal           Metal       @default(NONE)
  finish          Finish      @default(NONE)
  
  // Specifications
  weightGrams     Float?                          // Physical weight
  dimensions      String?                         // e.g. "Length: 18 inches"
  stoneType       String?                         // e.g. "Kundan", "Ruby (glass)"
  occasion        String?                         // e.g. "Bridal, Festive, Casual"
  
  // Pricing
  priceINR        Int                             // Price in paise? No — store in rupees as Int
  originalPriceINR Int?                           // Strike-through price (if on discount)
  
  // Status
  status          ItemStatus  @default(AVAILABLE)
  reservedAt      DateTime?                       // When RESERVED state started
  reservedByUserId String?                        // Who reserved it
  soldAt          DateTime?
  
  // SEO
  metaTitle       String?
  metaDescription String?                         // 155 chars max
  keywords        String[]                        // Array of SEO keywords
  
  // Images — stored on disk, paths in DB
  images          ProductImage[]
  primaryImageUrl String                          // Denormalised for fast card rendering
  
  // AI metadata
  aiEnhanced      Boolean     @default(false)
  rawInputData    Json?                           // Original seller input (for audit)
  
  // Timestamps
  listedAt        DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  orders          Order[]
  wishlistItems   WishlistItem[]
  
  @@index([status])
  @@index([category])
  @@index([metal])
  @@index([priceINR])
  @@index([slug])
}

model ProductImage {
  id          String    @id @default(cuid())
  productId   String
  url         String                      // Relative path: /images/products/{productId}/{filename}
  urlThumb    String                      // 300×300 WebP
  urlMedium   String                      // 800×800 WebP
  urlFull     String                      // 1600×1600 WebP
  order       Int       @default(0)       // Display order (0 = primary)
  altText     String?
  
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
}

// ─── ORDERS ───────────────────────────────────────────────

model Order {
  id                String        @id @default(cuid())
  orderNumber       String        @unique   // Human-readable: ORD-2024-0001
  
  userId            String
  productId         String
  addressId         String
  
  // Pricing snapshot (frozen at time of order)
  priceINR          Int
  shippingINR       Int           @default(0)
  totalINR          Int
  
  // Status
  status            OrderStatus   @default(PENDING_PAYMENT)
  
  // Payment
  paymentMethod     PaymentMethod?
  razorpayOrderId   String?       @unique
  razorpayPaymentId String?       @unique
  razorpaySignature String?
  paidAt            DateTime?
  
  // Shipping
  courierName       String?
  awbCode           String?       // Airway Bill Number — tracking ID
  shiprocketOrderId String?
  shiprocketShipmentId String?
  trackingUrl       String?
  shippedAt         DateTime?
  deliveredAt       DateTime?
  
  // Notes
  buyerNote         String?       // Optional note from buyer at checkout
  adminNote         String?
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  user              User          @relation(fields: [userId], references: [id])
  product           Product       @relation(fields: [productId], references: [id])
  address           Address       @relation(fields: [addressId], references: [id])
  invoice           Invoice?
}

model Invoice {
  id          String    @id @default(cuid())
  orderId     String    @unique
  invoiceNo   String    @unique     // INV-2024-0001
  pdfPath     String                // Local path to generated PDF
  issuedAt    DateTime  @default(now())
  
  order       Order     @relation(fields: [orderId], references: [id])
}

// ─── WISHLIST ─────────────────────────────────────────────

model WishlistItem {
  id          String    @id @default(cuid())
  userId      String
  productId   String
  addedAt     DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  @@unique([userId, productId])
}

// ─── SETTINGS ─────────────────────────────────────────────

model SiteSetting {
  key         String    @id
  value       String
  updatedAt   DateTime  @updatedAt
}

// Keys used:
// store_name, store_tagline, store_phone, store_email
// shipping_free_above_inr, shipping_flat_rate_inr
// razorpay_enabled, cod_enabled
// announcement_banner (text shown in top bar)
// instagram_url, facebook_url, whatsapp_number
```

---

## 5. Backend API — Full Spec

Base URL: `https://yourdomain.com/api/v1`

All authenticated routes require `Authorization: Bearer <access_token>` header.  
All admin routes additionally require `isAdmin: true` on the JWT payload.

### 5.1 Authentication Routes — `/api/v1/auth`

```
POST   /auth/register          — Create account (name, email, phone, password)
POST   /auth/login             — Login → returns { accessToken, user }
POST   /auth/logout            — Invalidate refresh token
POST   /auth/refresh           — Get new access token from refresh cookie
POST   /auth/google            — Google OAuth callback
POST   /auth/forgot-password   — Send reset email
POST   /auth/reset-password    — Reset with token
POST   /auth/verify-email      — Verify email with OTP
```

### 5.2 Product Routes — `/api/v1/products`

```
GET    /products               — List all AVAILABLE products
       Query params:
         ?category=EARRINGS
         ?metal=GOLD_1GRAM
         ?finish=KUNDAN
         ?minPrice=500&maxPrice=2000
         ?sort=newest|price_asc|price_desc
         ?search=kundan+necklace
         ?page=1&limit=24

GET    /products/:slug         — Single product detail (SSR on frontend)
GET    /products/category/:category — Category listing page
GET    /products/search        — Full-text search (PostgreSQL ts_vector)
```

### 5.3 Cart & Checkout — `/api/v1/cart`

```
GET    /cart                   — Get current cart (stored in Redis by sessionId)
POST   /cart/add               — Add item { productId }
                                 → Checks item is AVAILABLE
                                 → Returns error if already RESERVED/SOLD
DELETE /cart/remove/:productId — Remove from cart
POST   /cart/clear             — Clear cart
```

### 5.4 Orders — `/api/v1/orders`

```
POST   /orders/initiate        — Create order
       Body: { productId, addressId, paymentMethod }
       → Sets item status to RESERVED
       → Creates Razorpay order
       → Sets 15-min Redis TTL key: reservation:{productId}
       → Returns { orderId, razorpayOrderId, amount }

POST   /orders/confirm-payment — Verify Razorpay signature
       Body: { orderId, razorpayPaymentId, razorpaySignature }
       → Validates HMAC signature
       → Sets item status to SOLD
       → Creates Order record
       → Triggers invoice generation job
       → Triggers confirmation email/SMS
       → Triggers Shiprocket booking job

GET    /orders/:id             — Get single order (auth required — own order only)
GET    /orders/my              — User's order history
```

### 5.5 Payments — `/api/v1/payments`

```
POST   /payments/webhook       — Razorpay webhook (no auth — verified by HMAC signature)
       Events handled:
         payment.captured     → mark order CONFIRMED
         payment.failed       → mark order PAYMENT_FAILED, release reservation
         refund.created       → mark order REFUNDED
```

### 5.6 User — `/api/v1/users`

```
GET    /users/me               — Get profile
PUT    /users/me               — Update name, phone
POST   /users/me/addresses     — Add address
PUT    /users/me/addresses/:id — Update address
DELETE /users/me/addresses/:id — Delete address
PUT    /users/me/addresses/:id/default — Set default
GET    /users/me/wishlist      — Get wishlist
POST   /users/me/wishlist      — Add to wishlist { productId }
DELETE /users/me/wishlist/:productId — Remove from wishlist
```

### 5.7 Admin Routes — `/api/v1/admin` (isAdmin guard)

```
GET    /admin/dashboard        — Stats { totalOrders, revenue, pendingShipments, newToday }
GET    /admin/orders           — All orders with filters (?status=CONFIRMED&page=1)
PUT    /admin/orders/:id/status — Update order status
PUT    /admin/orders/:id/shipping — Add AWB, courier name, tracking URL
POST   /admin/orders/:id/book-courier — Trigger Shiprocket booking
GET    /admin/products         — All products including SOLD and UNLISTED
PUT    /admin/products/:id/status — Flip status (e.g. relist a returned item)
DELETE /admin/products/:id     — Soft delete (set UNLISTED)
GET    /admin/settings         — Get all SiteSettings
PUT    /admin/settings         — Update settings { key, value }
```

### 5.8 Listing Ingestion — `/api/v1/listing` (Admin auth)

```
POST   /listing/new            — Ingest new product from mobile listing app
       Multipart form:
         name: string
         category: Category enum
         metal: Metal enum
         finish: Finish enum
         weightGrams: number
         stoneType: string
         occasion: string
         priceINR: number
         originalPriceINR?: number
         images: File[] (up to 6 JPEGs)
       
       Server pipeline:
         1. Validate all fields with Zod
         2. Save raw images to temp dir
         3. Queue Bull job: aiEnhanceJob(productId, rawData, imagePaths)
         4. Return { jobId, status: "processing" }

GET    /listing/status/:jobId  — Poll job status (mobile app polls this)
       Returns: { status: "pending"|"done"|"failed", productId?, previewUrl? }

POST   /listing/publish/:productId — Admin confirms and publishes preview
```

---

## 6. Frontend — Website Spec

### 6.1 Pages

#### Homepage (`/`)
- Full-width hero banner — "Handcrafted Jewellery. One of a Kind."
- Subheadline: "1-gram gold, imitation & fashion jewellery — delivered across India"
- CTA: "Shop Now" button → `/shop`
- Section: "New Arrivals" — 4 latest AVAILABLE products
- Section: "Shop by Category" — 8 category tiles with icons
  - 1 Gram Gold | Earrings | Necklaces | Bangles | Bracelets | Rings | Sets | Anklets
- Section: "Why Shop With Us" — trust signals:
  - Genuine 1-gram gold polish | Fast shipping | Easy returns | Secure payments
- Section: "Featured Pieces" — 4 hand-picked items (admin-selectable)
- Footer — links, contact, social, WhatsApp button

#### Shop Page (`/shop`)
- Filter sidebar (desktop) / Filter drawer (mobile):
  - Category checkboxes
  - Metal type
  - Finish type
  - Price range slider (₹0 – ₹5,000)
  - Occasion (Bridal / Festive / Daily Wear / Casual)
- Product grid — 2 cols mobile, 3 cols tablet, 4 cols desktop
- Sort: Newest | Price: Low to High | Price: High to Low
- Each product card shows:
  - Primary image (lazy loaded)
  - Name (display name)
  - Price (with strike-through if originalPrice exists)
  - "SOLD" overlay badge on sold items (greyed out, not clickable)
  - Quick wishlist button (heart icon)
- Pagination — 24 items per page

#### Product Detail Page (`/shop/[slug]`)
- Image gallery — main image + thumbnails, pinch-zoom on mobile
- Full displayName, shortDesc above fold
- Price — large, with originalPrice strike-through if applicable
- AVAILABLE badge (green) or SOLD badge (red/grey)
- "Add to Cart" button — disabled + "Sold Out" text if SOLD
- "Add to Wishlist" button
- Full description (AI-written, ~150 words)
- Specifications table:
  - Metal type | Finish | Weight | Stone type | Dimensions | Occasion
- Shipping info accordion:
  - "Ships within 2-3 business days via Delhivery / BlueDart"
  - "Free shipping on orders above ₹999"
- Return policy accordion
- Share buttons: WhatsApp, Instagram, Copy Link

#### Category Pages (`/categories/[category]`)
- SEO-optimised heading: e.g. "1 Gram Gold Necklaces — Buy Online India"
- Description paragraph (static, keyword-rich)
- Same grid + filters as shop page but pre-filtered

#### Cart (`/cart`)
- List of cart items (jewellery only — 1 item max per unique piece)
- Item image, name, price
- Remove button
- Order summary — subtotal, shipping, total
- Note: Because items are one-of-a-kind, cart cannot have qty > 1 per item
- "Proceed to Checkout" → redirect to login if not authenticated

#### Checkout (`/checkout`)
- Step 1: Address — list saved addresses + "Add New" form
- Step 2: Order summary — item, price, shipping
- Step 3: Payment — Razorpay checkout opens as overlay
- On success: redirect to `/account/orders/[id]?success=true`

#### Account (`/account`)
- Profile: name, email, phone — editable
- Address book: list, add, edit, delete, set default
- Order History: list with status badges, click to expand details
- Wishlist tab: saved items with current status (available/sold)

#### Order Detail (`/account/orders/[id]`)
- Order number, date, item details
- Payment status
- Shipping status with tracking link (when shipped)
- Download invoice PDF

### 6.2 Components — Key Notes

**ProductCard**
```tsx
// Shows SOLD overlay without removing from grid (for social proof)
// sold items still appear but are visually greyed + not clickable
// Wishlist toggle — optimistic UI update
```

**Availability Badge**
```tsx
// Real-time status display
// AVAILABLE → green dot + "Available"
// RESERVED  → orange dot + "Reserved" (someone is in checkout)
// SOLD      → grey     + "Sold"
// Poll /api/v1/products/:slug every 30s on product detail page
// if item becomes RESERVED while user is viewing → show warning toast
```

**Cart Drawer**
```tsx
// Slide-in from right
// If item in cart becomes SOLD (payment by someone else)
// → show inline error, remove item, suggest wishlist
```

### 6.3 Design Tokens

```css
/* Jewellery store — refined, warm, luxury-adjacent */
--color-primary: #1a1a1a;       /* Near black */
--color-accent: #C9A84C;        /* Warm gold */
--color-accent-light: #E8C97A;  /* Light gold hover */
--color-surface: #FDFAF5;       /* Warm off-white background */
--color-surface-2: #F5EFE3;     /* Card backgrounds */
--color-border: #E2D9C8;        /* Warm grey borders */
--color-text: #1a1a1a;
--color-text-muted: #7a6f5e;
--color-success: #2D7A3A;
--color-error: #B91C1C;
--color-sold: #9CA3AF;          /* Grey for sold items */

--font-display: 'Cormorant Garamond', serif;   /* Headings — elegant serif */
--font-body: 'DM Sans', sans-serif;            /* Body — clean, readable */
--font-mono: 'IBM Plex Mono', monospace;       /* Prices, codes */

--radius-card: 8px;
--shadow-card: 0 2px 12px rgba(0,0,0,0.06);
```

Google Fonts to import: `Cormorant+Garamond:wght@400;600;700` + `DM+Sans:wght@400;500;600`

---

## 7. SEO Strategy

### 7.1 Technical SEO

Every page must have:
```tsx
// In Next.js App Router — generateMetadata() per page
export async function generateMetadata({ params }) {
  return {
    title: `${product.metaTitle} | StoreName`,
    description: product.metaDescription,
    keywords: product.keywords.join(', '),
    openGraph: {
      title: product.displayName,
      description: product.shortDesc,
      images: [{ url: product.primaryImageUrl, width: 800, height: 800 }],
      type: 'product',
    },
    alternates: {
      canonical: `https://yourdomain.com/shop/${product.slug}`,
    },
  }
}
```

- Sitemap: auto-generated at `/sitemap.xml` — includes all AVAILABLE product slugs + category pages
- Robots.txt: allow all, disallow `/admin`, `/checkout`, `/api`
- Structured data (JSON-LD) on product pages:
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{displayName}}",
  "description": "{{description}}",
  "image": ["{{image1}}", "{{image2}}"],
  "offers": {
    "@type": "Offer",
    "priceCurrency": "INR",
    "price": "{{priceINR}}",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "{{storeName}}" }
  }
}
```
- For SOLD items: `"availability": "https://schema.org/SoldOut"`

### 7.2 Target Keywords by Category

| Category | Primary Keywords | Long-tail |
|---|---|---|
| 1 Gram Gold | "1 gram gold jewellery online", "1 gram gold necklace" | "1 gram gold necklace set under 500", "1 gram gold earrings with price" |
| Earrings | "imitation earrings online India", "fashion earrings" | "kundan earrings for wedding", "oxidised earrings jhumka" |
| Necklaces | "artificial necklace set online", "fashion necklace" | "long necklace set with earrings", "bridal necklace set artificial" |
| Bangles | "artificial bangles online", "fashion bangles" | "kundan bangles set of 6", "meenakari bangles" |
| Sets | "artificial jewellery sets online" | "necklace earring set for wedding", "bridal imitation jewellery set" |

### 7.3 Category Page Static Content

Each `/categories/[category]` page should have:
- H1: keyword-rich heading
- 100–150 word introductory paragraph with keywords
- H2: "Browse Our Collection"
- FAQ section (accordion) — 3-4 questions targeting voice search
  - "What is 1 gram gold jewellery?"
  - "Is artificial jewellery safe to wear?"
  - "How long does gold polish last?"

### 7.4 URL Structure

```
/shop                                    — All products
/shop/[slug]                             — e.g. /shop/kundan-necklace-set-gold-polish-kjn001
/categories/1-gram-gold                  — Category landing
/categories/earrings
/categories/necklaces
/categories/bangles
/categories/bracelets
/categories/rings
/categories/anklets
/categories/sets
```

Slug format: `{descriptive-name}-{metal}-{finish}-{short-id}`  
Example: `kundan-jhumka-earrings-gold-polish-ej2401`

---

## 8. Inventory System — One-of-a-Kind Logic

This is the most critical system. Each product is a single physical item. The state machine must be atomic.

### 8.1 Item States

```
AVAILABLE → RESERVED → SOLD
                ↓ (timer expired or payment failed)
           AVAILABLE
           
AVAILABLE / SOLD → UNLISTED (admin action)
UNLISTED → AVAILABLE (admin relists — e.g. after return)
```

### 8.2 Reservation Logic

```typescript
// services/inventory.ts

const RESERVATION_TTL_SECONDS = 900; // 15 minutes

async function reserveItem(productId: string, userId: string, orderId: string) {
  // Use a Postgres transaction for atomicity
  return await prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE — locks the row
    const product = await tx.$queryRaw`
      SELECT id, status FROM "Product" 
      WHERE id = ${productId} AND status = 'AVAILABLE'
      FOR UPDATE NOWAIT
    `;
    
    if (!product || product.length === 0) {
      throw new Error('ITEM_NOT_AVAILABLE');
    }
    
    // Update status
    await tx.product.update({
      where: { id: productId },
      data: {
        status: 'RESERVED',
        reservedAt: new Date(),
        reservedByUserId: userId,
      }
    });
    
    // Set Redis TTL key — worker watches this
    await redis.setEx(
      `reservation:${productId}`,
      RESERVATION_TTL_SECONDS,
      orderId
    );
    
    return true;
  });
}

async function releaseExpiredReservations() {
  // Called by a Bull cron job every 2 minutes
  // Also triggered by Redis keyspace notification on expiry
  
  const expiredProducts = await prisma.product.findMany({
    where: {
      status: 'RESERVED',
      reservedAt: {
        lt: new Date(Date.now() - RESERVATION_TTL_SECONDS * 1000)
      }
    }
  });
  
  for (const product of expiredProducts) {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { status: 'AVAILABLE', reservedAt: null, reservedByUserId: null }
      }),
      prisma.order.updateMany({
        where: { productId: product.id, status: 'PENDING_PAYMENT' },
        data: { status: 'PAYMENT_FAILED' }
      })
    ]);
  }
}

async function markSold(productId: string) {
  await prisma.product.update({
    where: { id: productId },
    data: { status: 'SOLD', soldAt: new Date() }
  });
  await redis.del(`reservation:${productId}`);
}
```

### 8.3 Edge Case Handling

- **Two users click "Buy" simultaneously:** `SELECT FOR UPDATE NOWAIT` ensures only one gets the lock. The second gets `ITEM_NOT_AVAILABLE` error → frontend shows "Someone just reserved this item" toast.
- **Payment page open but timer expired:** On Razorpay callback, if item is no longer RESERVED by this user → cancel order, refund initiated.
- **User closes tab mid-checkout:** Redis TTL fires → reservation released. Order marked PAYMENT_FAILED.
- **Return/relist:** Admin manually sets status to AVAILABLE in admin dashboard → item shows back in store.

---

## 9. AI Listing Pipeline

### 9.1 Flow (Server-side Bull Job)

```typescript
// services/aiEnhance.ts

interface RawListingInput {
  name: string;
  category: Category;
  metal: Metal;
  finish: Finish;
  weightGrams?: number;
  stoneType?: string;
  occasion?: string;
  priceINR: number;
  imagePaths: string[];  // Local temp paths
}

async function enhanceListing(productId: string, input: RawListingInput) {
  
  // STEP 1: Generate copy via GPT-4o
  const copyResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a luxury jewellery copywriter for an Indian jewellery brand. 
Write in English. Tone: warm, aspirational, elegant — never salesy or generic.
Always mention the specific material and craftsmanship technique.
Output must be valid JSON matching the schema exactly. No markdown, no extra text.`
      },
      {
        role: 'user',
        content: `Generate product listing content for this jewellery piece:
Name: ${input.name}
Category: ${input.category}
Metal: ${input.metal}
Finish: ${input.finish}
Stone/Detail: ${input.stoneType || 'none'}
Weight: ${input.weightGrams ? input.weightGrams + 'g' : 'not specified'}
Occasion: ${input.occasion || 'not specified'}
Price: ₹${input.priceINR}

Return JSON:
{
  "displayName": "Short elegant product name (5-8 words)",
  "shortDesc": "One-line description under 55 characters",
  "description": "SEO product description — 130-160 words. Include material, craftsmanship, occasion, and styling tip. Warm, aspirational tone.",
  "metaTitle": "SEO title under 60 chars — include key material + category + India",
  "metaDescription": "SEO meta description under 155 chars — compelling, include price signal",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "slug": "url-slug-lowercase-hyphens-descriptive-under-60-chars"
}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });
  
  const copy = JSON.parse(copyResponse.choices[0].message.content);

  // STEP 2: Enhance images via GPT-Image-1
  const enhancedImagePaths = [];
  
  for (const imagePath of input.imagePaths) {
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });
    
    const enhancedResponse = await openai.images.edit({
      model: 'gpt-image-1',
      image: fs.createReadStream(imagePath),
      prompt: `Professional jewellery product photography. 
Remove the background completely. Replace with pure white (#FFFFFF) or very light cream background.
Add soft, even studio lighting — no harsh shadows.
The jewellery should appear centered, well-lit, and sharp.
Make it look like a professional e-commerce product photo.
Do not add any props, hands, or accessories.`,
      size: '1024x1024',
      n: 1,
    });
    
    const enhancedBase64 = enhancedResponse.data[0].b64_json;
    const enhancedPath = `/tmp/${productId}_enhanced_${Date.now()}.png`;
    fs.writeFileSync(enhancedPath, Buffer.from(enhancedBase64, 'base64'));
    enhancedImagePaths.push(enhancedPath);
  }

  // STEP 3: Process images with Sharp
  const outputDir = `/data/images/products/${productId}`;
  fs.mkdirSync(outputDir, { recursive: true });
  
  const processedImages = [];
  
  for (let i = 0; i < enhancedImagePaths.length; i++) {
    const base = `${outputDir}/img_${i}`;
    
    await sharp(enhancedImagePaths[i])
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(`${base}_thumb.webp`);
    
    await sharp(enhancedImagePaths[i])
      .resize(800, 800, { fit: 'cover' })
      .webp({ quality: 88 })
      .toFile(`${base}_medium.webp`);
    
    await sharp(enhancedImagePaths[i])
      .resize(1600, 1600, { fit: 'contain', background: '#FFFFFF' })
      .webp({ quality: 92 })
      .toFile(`${base}_full.webp`);
    
    processedImages.push({
      productId,
      url: `/images/products/${productId}/img_${i}_full.webp`,
      urlThumb: `/images/products/${productId}/img_${i}_thumb.webp`,
      urlMedium: `/images/products/${productId}/img_${i}_medium.webp`,
      urlFull: `/images/products/${productId}/img_${i}_full.webp`,
      order: i,
      altText: `${copy.displayName} - image ${i + 1}`,
    });
  }

  // STEP 4: Write to DB
  await prisma.product.update({
    where: { id: productId },
    data: {
      slug: copy.slug,
      displayName: copy.displayName,
      shortDesc: copy.shortDesc,
      description: copy.description,
      metaTitle: copy.metaTitle,
      metaDescription: copy.metaDescription,
      keywords: copy.keywords,
      primaryImageUrl: processedImages[0]?.urlMedium,
      aiEnhanced: true,
      images: { createMany: { data: processedImages } },
    }
  });
}
```

---

## 10. Mobile Listing App

**Stack:** React Native + Expo (SDK 51)  
**Auth:** Expo SecureStore — stores JWT token  
**Connects to:** `POST /api/v1/listing/new`

### 10.1 Screens

#### HomeScreen
- "New Listing" large button
- "Recent Listings" — last 5 items with status (Processing / Live / Failed)
- Logout

#### NewListingScreen
Fields (in order):
1. **Photos** — tap to pick up to 6 from camera roll (or capture live)
   - Shows thumbnails in row — tap × to remove
   - Min 1 photo required
2. **Item Name** — text input (raw, e.g. "Kundan necklace with red stones")
3. **Category** — picker (dropdown)
4. **Metal** — picker
5. **Finish** — picker
6. **Weight (grams)** — numeric input (optional)
7. **Stone / Detail** — text input (e.g. "Kundan, glass ruby", optional)
8. **Occasion** — text input (e.g. "Bridal, Festive")
9. **Price (₹)** — numeric input
10. **Original Price (₹)** — numeric input, optional (shows as strike-through on site)
11. **Enhance & Preview** button

On submit:
- Validate locally (Zod)
- Show upload progress indicator
- POST multipart to `/api/v1/listing/new`
- Poll `/api/v1/listing/status/:jobId` every 3 seconds
- Navigate to PreviewScreen when status = "done"

#### PreviewScreen
- Shows AI-generated `displayName`, `shortDesc`, `description`
- Shows enhanced images (from server)
- "Edit Description" — tap to manually edit before publishing
- "Publish" button → `POST /api/v1/listing/publish/:productId`
- "Re-enhance" button → re-runs AI pipeline
- On publish → navigate to PublishedScreen

#### PublishedScreen
- "🎉 Item is now live!"
- Shows item URL (copy button)
- "List Another Item" button
- "View on Store" deep link

### 10.2 API Authentication
```typescript
// All requests from listing app include:
headers: {
  'Authorization': `Bearer ${await SecureStore.getItemAsync('admin_token')}`,
  'Content-Type': 'multipart/form-data',
}
```

Admin logs in once via a simple PIN + email screen. JWT stored in SecureStore. Refresh token auto-renews.

---

## 11. Payment Integration — Razorpay

### 11.1 Flow

```
1. Frontend: "Buy Now" clicked
2. Backend: POST /orders/initiate
   → Create Razorpay order via API
   → Reserve item in DB
   → Return { razorpayOrderId, amount, currency: 'INR' }

3. Frontend: Open Razorpay checkout (JS SDK)
   options = {
     key: RAZORPAY_KEY_ID,
     amount: amountInPaise,
     currency: 'INR',
     order_id: razorpayOrderId,
     name: STORE_NAME,
     description: product.displayName,
     image: product.primaryImageUrl,
     prefill: { name: user.name, email: user.email, contact: user.phone },
     theme: { color: '#C9A84C' },
     handler: function(response) {
       // response = { razorpay_payment_id, razorpay_order_id, razorpay_signature }
       // POST to /orders/confirm-payment
     }
   }

4. Backend: POST /orders/confirm-payment
   → Verify HMAC: SHA256(order_id + '|' + payment_id, RAZORPAY_KEY_SECRET)
   → If valid: mark SOLD, create order, trigger downstream jobs
   → Return { success: true, orderId }

5. Webhook (parallel safety net):
   → POST /payments/webhook
   → Verify webhook signature
   → Handle payment.captured (idempotent — check if already SOLD)
```

### 11.2 Refund Handling

```typescript
async function initiateRefund(orderId: string, reason: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  
  await razorpay.payments.refund(order.razorpayPaymentId, {
    amount: order.totalINR * 100,  // in paise
    notes: { reason, orderId }
  });
  
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'REFUNDED' }
  });
  
  // Relist item if it wasn't shipped
  if (!order.awbCode) {
    await prisma.product.update({
      where: { id: order.productId },
      data: { status: 'AVAILABLE', soldAt: null }
    });
  }
}
```

---

## 12. Order Management & Delivery

### 12.1 Shiprocket Integration

```typescript
// services/shiprocket.ts

async function bookShipment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: true, address: true, user: true }
  });

  // Shiprocket: Create order
  const srOrder = await shiprocketAPI.post('/orders/create/adhoc', {
    order_id: order.orderNumber,
    order_date: order.createdAt.toISOString(),
    pickup_location: 'Primary',           // Pre-configured in Shiprocket account
    billing_customer_name: order.address.name,
    billing_address: order.address.line1,
    billing_address_2: order.address.line2,
    billing_city: order.address.city,
    billing_pincode: order.address.pincode,
    billing_state: order.address.state,
    billing_country: 'India',
    billing_email: order.user.email,
    billing_phone: order.address.phone,
    shipping_is_billing: true,
    order_items: [{
      name: order.product.displayName,
      sku: order.product.id,
      units: 1,
      selling_price: order.priceINR,
      discount: 0,
      tax: 0,
      hsn: 7113,                          // HSN code for jewellery
    }],
    payment_method: 'Prepaid',
    sub_total: order.priceINR,
    weight: order.product.weightGrams || 0.1,  // kg — default 100g
  });

  // Shiprocket: Auto-assign best courier
  const shipment = await shiprocketAPI.post('/courier/assign/awb', {
    shipment_id: srOrder.data.shipment_id,
  });

  // Generate label
  await shiprocketAPI.post('/courier/generate/label', {
    shipment_id: [srOrder.data.shipment_id],
  });

  // Update order in DB
  await prisma.order.update({
    where: { id: orderId },
    data: {
      shiprocketOrderId: srOrder.data.order_id.toString(),
      shiprocketShipmentId: srOrder.data.shipment_id.toString(),
      awbCode: shipment.data.awb_code,
      courierName: shipment.data.courier_name,
      trackingUrl: `https://shiprocket.co/tracking/${shipment.data.awb_code}`,
      status: 'SHIPPED',
      shippedAt: new Date(),
    }
  });

  // Notify buyer
  await sendShippingNotification(order, shipment.data.awb_code);
}
```

### 12.2 Shiprocket Webhook

Register at Shiprocket dashboard → `POST /api/v1/orders/shiprocket-webhook`

Events to handle:
- `PICKUP_SCHEDULED` → update order status
- `IN_TRANSIT` → push notification to user (optional)
- `DELIVERED` → update order status to DELIVERED, send thank-you email
- `UNDELIVERED` → alert admin via email
- `RTO_INITIATED` → alert admin (returned to origin)

---

## 13. Admin Dashboard

Separate Next.js app running on `http://localhost:3001` (not publicly exposed — admin accesses via local network or VPN).

Alternatively: accessible at `https://yourdomain.com/admin` behind Nginx auth or a separate subdomain.

### Pages

#### Overview (`/admin`)
- Stats cards: Today's Revenue | Orders Today | Items Live | Pending Shipments
- Recent orders table (last 10)
- Quick actions: "Book Courier" for CONFIRMED orders not yet shipped

#### Orders (`/admin/orders`)
- Table: Order # | Item | Buyer | Amount | Status | Date | Actions
- Filter by status
- Row actions: View Detail | Book Courier | Update Status | Issue Refund
- Order detail modal: full buyer info, item, payment details, shipping history

#### Products (`/admin/products`)
- All products including SOLD and UNLISTED
- Table: Image | Name | Category | Price | Status | Listed Date | Actions
- Row actions: Edit | Relist (if SOLD) | Unlist | Delete
- "Edit" opens a form to update price, description, status

#### Settings (`/admin/settings`)
- Store name, tagline, contact info
- Shipping rates (free above X, flat rate)
- Enable/disable COD
- Announcement banner text
- Social media links

---

## 14. Email & SMS Notifications

### 14.1 Emails (Nodemailer)

All emails use HTML templates (handlebars/mjml).

| Trigger | Subject | Content |
|---|---|---|
| Registration | Welcome to {StoreName} | Welcome + verify email link |
| Email verification | Verify your email | OTP or magic link |
| Order placed | Order #{orderNumber} Received | Item details, estimated dispatch |
| Payment failed | Your payment failed | Retry link |
| Order confirmed | Payment Received ✓ | Order summary, what happens next |
| Order shipped | Your order is on the way! | AWB, tracking link, courier name |
| Order delivered | Your order has been delivered | Thank you, review request |
| Refund initiated | Refund Initiated | Amount, 5-7 business days |
| Password reset | Reset your password | Link (expires 1 hour) |
| Admin: new order | 🛍 New Order #{n} | Full order details for admin |
| Admin: new listing published | New item live | Item name, preview link |

### 14.2 SMS (MSG91 or Twilio)

Short, to the point. Only key events.

| Trigger | Message |
|---|---|
| Order confirmed | "Hi {name}, your order #{n} for {item} is confirmed! We'll dispatch soon. - {StoreName}" |
| Order shipped | "Order #{n} shipped via {courier}. Track: {trackingUrl}" |
| Order delivered | "Your order #{n} has been delivered. Thank you for shopping with {StoreName}!" |

---

## 15. Authentication & User Accounts

### 15.1 Auth Flow

- **Registration:** Email + password OR Google OAuth
- **Login:** JWT access token (15 min) + HttpOnly refresh token cookie (7 days)
- **Token refresh:** Silent on 401 — refresh endpoint called, new access token issued
- **Admin auth:** Same flow + `isAdmin` flag on JWT — checked server-side on every admin route

### 15.2 Email Verification

- On register → send 6-digit OTP to email
- OTP valid for 10 minutes
- User cannot checkout without verified email

### 15.3 Password Reset

- Input email → send reset link with signed JWT (1-hour expiry)
- Click link → show new password form
- On submit → invalidate all existing sessions

### 15.4 Google OAuth

- NextAuth.js handles OAuth flow
- On first login → create User record if not exists
- Link Google account to existing email account if email matches

---

## 16. Infrastructure & Self-Hosting

### 16.1 Docker Compose

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: jewellery_store
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"          # Internal only — Nginx does not expose this

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/redis:/data

  backend:
    build: ./backend
    restart: always
    depends_on:
      - postgres
      - redis
    env_file: .env
    volumes:
      - /mnt/hdd/jewellery-images:/data/images    # External HDD mount
    ports:
      - "4000:4000"

  frontend:
    build: ./frontend
    restart: always
    depends_on:
      - backend
    env_file: .env
    ports:
      - "3000:3000"

  admin:
    build: ./admin
    restart: always
    depends_on:
      - backend
    env_file: .env
    ports:
      - "3001:3001"

  nginx:
    image: nginx:alpine
    restart: always
    depends_on:
      - frontend
      - backend
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - /mnt/hdd/jewellery-images:/var/www/images:ro   # Serve images statically
    ports:
      - "80:80"
      - "443:443"

  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: always
    volumes:
      - ./data/uptime-kuma:/app/data
    ports:
      - "3002:3001"           # Access at localhost:3002 — not exposed publicly
```

### 16.2 Nginx Config

```nginx
# nginx/nginx.conf

events { worker_connections 1024; }

http {
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;

  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
  limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

  server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Static image serving (bypass backend)
    location /images/ {
      root /var/www;
      expires 30d;
      add_header Cache-Control "public, immutable";
    }

    # API
    location /api/ {
      limit_req zone=api burst=10 nodelay;
      proxy_pass http://backend:4000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    # Auth endpoints — stricter rate limit
    location /api/v1/auth/ {
      limit_req zone=auth burst=5 nodelay;
      proxy_pass http://backend:4000;
    }

    # Frontend
    location / {
      proxy_pass http://frontend:3000;
      proxy_set_header Host $host;
    }
  }
}
```

### 16.3 Cloudflare Tunnel Setup

```bash
# Install cloudflared on host
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create jewellery-store

# Config file: ~/.cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: /home/user/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: yourdomain.com
    service: http://localhost:80
  - service: http_status:404

# Run as systemd service
cloudflared service install
sudo systemctl enable --now cloudflared
```

### 16.4 Backup Script

```bash
#!/bin/bash
# scripts/backup.sh — run daily via cron: 0 2 * * * /path/to/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/mnt/hdd/backups"

# PostgreSQL dump
docker exec jewellery-store-postgres-1 pg_dump -U $DB_USER jewellery_store \
  > "$BACKUP_DIR/db_$DATE.sql"

# Keep last 14 days only
find "$BACKUP_DIR" -name "db_*.sql" -mtime +14 -delete

echo "Backup complete: $DATE"
```

Add to crontab: `0 2 * * * /home/user/jewellery-store/scripts/backup.sh`

Note: Images on external HDD are already safe as the primary copy. Backup DB only unless you want a second image copy.

### 16.5 Hardware Recommendations

| Component | Minimum | Recommended |
|---|---|---|
| Hardware | Raspberry Pi 4 4GB | Old PC / mini PC, 8GB RAM |
| OS | Ubuntu Server 22.04 LTS | Same |
| Storage | 256GB SSD (OS + DB) | 512GB SSD |
| Image storage | External USB HDD 1TB | Same |
| UPS | Required | APC 600VA or similar |
| Cooling | Pi: official fan case | PC: ensure ventilation |
| Network | 50 Mbps broadband (upload matters) | 100 Mbps+ |

Cloudflare Tunnel routes traffic — your home IP is never exposed.

---

## 17. Environment Variables

```bash
# .env

# App
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://yourdomain.com
ADMIN_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/jewellery_store
DB_USER=jewellery_user
DB_PASSWORD=change_this_strong_password

# Redis
REDIS_URL=redis://:change_this_redis_password@redis:6379
REDIS_PASSWORD=change_this_redis_password

# Auth
JWT_SECRET=change_this_64_char_random_string
JWT_REFRESH_SECRET=change_this_different_64_char_random_string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxxx
RAZORPAY_KEY_SECRET=xxxx
RAZORPAY_WEBHOOK_SECRET=xxxx

# OpenAI
OPENAI_API_KEY=sk-xxxx

# Shiprocket
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourstore@gmail.com
SMTP_PASS=app_specific_password
EMAIL_FROM=Your Store <yourstore@gmail.com>

# SMS (MSG91)
MSG91_AUTH_KEY=
MSG91_SENDER_ID=STORENAME
MSG91_TEMPLATE_ID_ORDER=
MSG91_TEMPLATE_ID_SHIPPED=
MSG91_TEMPLATE_ID_DELIVERED=

# Store config
STORE_NAME=Your Store Name
STORE_TAGLINE=Handcrafted Jewellery, One of a Kind
```

---

## 18. Build Phases & Checklist

### Phase 1 — Core Store (Week 1–2)
- [ ] Initialize monorepo, Docker Compose, Postgres, Redis
- [ ] Prisma schema + migrations
- [ ] Backend: product routes (GET list, GET slug)
- [ ] Next.js frontend scaffold with design tokens
- [ ] Homepage with hero, category grid, new arrivals
- [ ] Shop page with filter sidebar + product grid
- [ ] Product detail page with SSR + JSON-LD schema
- [ ] Category pages with static SEO content
- [ ] Sitemap + robots.txt

### Phase 2 — Auth + Cart (Week 3)
- [ ] Auth routes: register, login, logout, refresh
- [ ] Google OAuth via NextAuth
- [ ] Email verification (OTP)
- [ ] Password reset
- [ ] User profile page + address management
- [ ] Cart (Redis-backed, session + user)
- [ ] Wishlist functionality

### Phase 3 — AI Listing App (Week 4–5)
- [ ] Listing ingestion endpoint (`/api/v1/listing/new`)
- [ ] Bull job queue setup
- [ ] GPT-4o copy generation with prompt template
- [ ] GPT-Image-1 background removal + enhancement
- [ ] Sharp image pipeline (3 sizes, WebP)
- [ ] React Native Expo app scaffold
- [ ] NewListingScreen with form + image picker
- [ ] API integration + polling
- [ ] PreviewScreen + PublishScreen
- [ ] Expo APK build for Android (TestFlight for iOS if needed)

### Phase 4 — Payments (Week 6)
- [ ] Razorpay account setup + KYC
- [ ] Order initiation endpoint with reservation logic
- [ ] Razorpay checkout integration (frontend JS SDK)
- [ ] Payment confirmation + HMAC verification
- [ ] Webhook handler (payment.captured, payment.failed, refund)
- [ ] Reservation TTL worker (release on expiry)
- [ ] Invoice PDF generation
- [ ] Payment failure handling + user feedback

### Phase 5 — Operations + Delivery (Week 7)
- [ ] Shiprocket account setup + API keys
- [ ] Admin dashboard (orders view, stats)
- [ ] Shiprocket booking integration
- [ ] Shiprocket webhook handler
- [ ] Email templates (all triggers)
- [ ] SMS notifications
- [ ] Admin order management (status updates, notes)
- [ ] Refund flow

### Phase 6 — Production (Week 8)
- [ ] Nginx config + SSL cert (Let's Encrypt)
- [ ] Cloudflare Tunnel setup + systemd service
- [ ] Cloudflare DNS setup
- [ ] Full Docker Compose production deploy
- [ ] Backup cron job
- [ ] Uptime Kuma monitoring setup
- [ ] Load test (wrk or k6 — simulate 50 concurrent users)
- [ ] Security audit: rate limits, CORS, SQL injection check (Prisma safe by default)
- [ ] Google Search Console + Bing Webmaster setup
- [ ] Google Analytics 4 setup
- [ ] Razorpay go-live (submit docs, exit test mode)

---

## 19. Things Not to Miss

These are easy to forget and cause production problems.

### Inventory & Orders
- **Idempotency on webhook:** Razorpay may fire `payment.captured` multiple times. Check `razorpayPaymentId` before processing — skip if already handled.
- **Order number sequence:** Use a separate counter table or DB sequence for human-readable order numbers (ORD-2024-0001). Don't use cuid for this.
- **Sold items in sitemap:** Exclude SOLD products from sitemap. Google shouldn't index unavailable product pages.
- **SOLD item canonical:** If a sold item is viewed directly, show a "This piece has been sold" page — do not 404 (preserves backlinks).

### Payments
- **COD option:** Add a flag in SiteSetting. For COD orders: no Razorpay, order confirmed immediately, admin packs and ships on trust. Add "Pay on Delivery" to PaymentMethod enum.
- **GST:** If turnover crosses GST threshold, invoices need GSTIN + 3% GST on jewellery. Add `gstEnabled` setting and calculate accordingly.
- **Razorpay test mode:** All dev/staging work in test mode. Switch to live only after Razorpay account is KYC verified.
- **Amount in paise:** Razorpay takes amounts in paise (₹100 = 10000). Always multiply priceINR × 100 when calling Razorpay API.

### SEO
- **Image alt text:** Every product image must have descriptive alt text (AI-generated with listing).
- **Next.js image component:** Use `next/image` for all product images — automatic WebP, lazy loading, LQIP.
- **Canonical URLs:** Prevent duplicate content — set canonical on filtered/paginated shop pages.
- **Page speed:** Jewellery stores live and die by mobile page speed. Target LCP < 2.5s. Serve WebP images, preload hero.

### Security
- **Admin dashboard network:** Ideally admin runs only on local network — not exposed via Cloudflare Tunnel. Use Nginx `allow 192.168.0.0/24; deny all;` for admin routes.
- **File upload validation:** In listing endpoint — validate that uploaded files are actually images (check MIME type + magic bytes). Reject non-images. Limit to 10MB per file.
- **SQL injection:** Prisma parameterises all queries by default. Only risk is raw SQL (`$queryRaw`) — used for `SELECT FOR UPDATE`. Verify those specifically.
- **Environment secrets:** Never commit `.env` to git. Add to `.gitignore`. Use Docker secrets or environment injection.
- **CORS:** Backend CORS — allow only `FRONTEND_URL` and `ADMIN_URL`. Reject all other origins.

### UX
- **WhatsApp button:** Floating WhatsApp button on storefront (`wa.me/{number}?text=Hi, I saw your jewellery store...`). Converts well for Indian buyers.
- **COD trust signal:** Show "Cash on Delivery Available" in hero/checkout. Huge trust signal for tier-2/3 buyers.
- **Mobile-first:** 70%+ of Indian shoppers are on mobile. Test every flow on a real phone, not just DevTools.
- **Low stock urgency:** Since each item is unique, "Only 1 left" is always true. Show it. Drives conversions.
- **Wishlist → back-in-stock:** When a SOLD item is relisted (after return), email users who wishlisted it.
- **Size guide:** For bangles and rings, add a size guide modal. Reduces returns.

### Operations
- **Shiprocket pickup address:** Must be configured in Shiprocket dashboard before first shipment. Set this up during Phase 5.
- **Packaging weight:** Add 50–100g to product weight when creating Shiprocket shipment to account for packaging.
- **HSN code for jewellery:** 7113 (articles of jewellery of precious metal or of metal clad with precious metal). Required for Shiprocket + GST.
- **Return address:** Configure clearly in Shiprocket and on website. Indian couriers require a valid return address.
- **Uptime Kuma monitors:** Set up checks for frontend URL, backend `/health`, and database connectivity. Alert via email or Telegram.

### Business
- **Terms & Conditions page:** Required for Razorpay live mode approval. Include cancellation, return, and refund policy.
- **Privacy Policy page:** Required. Mention data collected (email, phone, address), how it's used, no third-party sale.
- **Shipping Policy page:** Delivery time, couriers used, free shipping threshold, COD charges (if any).
- **Return Policy:** Jewellery is often non-returnable. State clearly. Razorpay and Indian consumer law require this.
- **Contact page:** Physical address (or city at least), email, phone, WhatsApp. Builds trust.
```
