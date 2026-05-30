# Developer Technical Architecture & Code Guide

This document is intended for engineers maintaining, debugging, or extending the **Rajshree Jewels** codebase.

---

## 1. High-Level System Architecture

The project is structured as a monolithic monorepo. It communicates via lightweight REST APIs, backed by a persistent PostgreSQL database and an in-memory Redis layer for rate-limiting, session storage, and analytical caching.

```
                  ┌────────────────────────────────┐
                  │      Next.js Storefront        │
                  │         (Port 3000)            │
                  └───────────────┬────────────────┘
                                  │
                                  │ GET / POST (Public Routes)
                                  ▼
┌────────────────┐  REST APIs   ┌──────────────────┐               ┌────────────────┐
│  Next.js Admin │ <──────────> │   Express API    │ <───────────> │ Redis Cache    │
│  (Port 3001)   │  JWT Auth    │   (Port 4000)    │  Session /    │ Rate Limits    │
└────────────────┘              └────────┬─────────┘  Deduplication└────────────────┘
                                         │
                                         │ Prisma ORM
                                         ▼
                                ┌──────────────────┐
                                │    PostgreSQL    │
                                │   (Port 5432)    │
                                └──────────────────┘
```

---

## 2. Prisma Database Model Overview

Below is the conceptual layout of the new tables introduced during the Final Feature Sprint:

### Security & Roles Schema
- `AdminUser`: Represents dashboard operators. Contains standard login details and an `isOwner` flag.
- `Role`: Standard role definitions (`ADMIN`, `MANAGER`, `PROCESSOR`).
- `UserRole`: Many-to-many relationship mapping `AdminUser` to `Role`.
- `PermissionOverride`: Single permission explicit rules (`ALLOW`, `DENY`) overrideable per user.

### Offers & Campaigns Schema
- `Coupon`: Stores discount codes, types (`PERCENTAGE`, `FIXED`), rates, min requirements, and expiry dates.
- `CouponUse`: Stores tracking records linking a customer purchase to the redeemed coupon.
- `SiteSale`: Stores the storewide markdown percentage, promotional announcements, and countdown timestamps.

### Collections & Taxonomies Schema
- `Tag`: Standard keywords (e.g. `Kundan`, `Choker`).
- `ProductTag`: Relation mapping individual jewellery products to multiple tags.
- `Collection`: Curated list structures containing metadata (e.g., `Royal Kundan Chokers`).
- `CollectionProduct`: Relation mapping products into collections with custom sorting priority flags (`orderIndex`).

### Analytics & Communications Schema
- `ProductView`: Individual logs recording unique shopper views, IP hashes, and timestamping.
- `OrderMessage`: Real-time conversation thread records containing text bodies, author types (`CUSTOMER`, `ADMIN`), and read markers.

---

## 3. The Permission Validation Engine

Access control is managed dynamically in the backend.

### Helper Method (`backend/src/services/permissions.ts`)
Resolves if an administrator has a specific permission by processing role hierarchy, then applying individual user-level overrides:

```typescript
export async function hasPermission(adminId: string, permissionCode: string): boolean {
  // 1. Owners possess automatic, unconditional permission bypass
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (admin?.isOwner) return true;

  // 2. Check for explicit overrides on the user
  const override = await prisma.permissionOverride.findFirst({
    where: { adminUserId: adminId, permission: permissionCode }
  });
  if (override) {
    return override.state === 'ALLOW'; // State can be ALLOW or DENY
  }

  // 3. Fallback to permissions configured inside user roles
  const roles = await prisma.userRole.findMany({
    where: { adminUserId: adminId },
    include: { role: true }
  });
  
  return roles.some(ur => ur.role.permissions.includes(permissionCode));
}
```

### Route Guard Middleware (`backend/src/middleware/requirePermission.ts`)
Secures routes directly:
```typescript
export function requirePermission(code: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const adminId = req.user.id;
    const allowed = await hasPermission(adminId, code);
    if (!allowed) {
      return res.status(403).json({ error: 'Permission Denied: Missing ' + code });
    }
    next();
  };
}
```

---

## 4. Cache Purging & Revalidator Service

To support highly responsive static-page delivery (Next.js Incremental Static Regeneration) while keeping sales and settings data fresh, we utilize an on-demand revalidator.

### Revalidator Client (`backend/src/services/revalidator.ts`)
Triggers an HTTP POST to the storefront API, instructing Next.js to recreate the static file in the background:

```typescript
import fetch from 'node-fetch';

export async function triggerRevalidation(paths: string[]) {
  const secret = process.env.REVALIDATION_SECRET || 'rajshree_revalidate_secret_2026';
  const storefrontUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${storefrontUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Revalidate-Secret': secret
      },
      body: JSON.stringify({ paths })
    });

    if (res.ok) {
      console.log(`Successfully revalidated: ${paths.join(', ')}`);
    } else {
      console.error(`Revalidation endpoint returned status: ${res.status}`);
    }
  } catch (err) {
    console.error('Error during storefront revalidation:', err);
  }
}
```
Whenever an administrator edits a collection, changes product metadata, or modifies a sitewide sale, this service is invoked on the backend to immediately refresh the public pages.
