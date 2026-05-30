# Admin Dashboard Operations Guide

Welcome to the admin control center. This guide outlines how to manage first-time configuration, staff roles, promotional campaigns, collections, and client communications.

---

## 1. First-Time Setup Flow

On initial installation, if zero administrator accounts exist in the database, the dashboard enters a secure lock-down state:

```
[Request any Admin URL]
       │
       ▼
Status check: GET /api/v1/admin/setup/status
       │
       ├─── Setup Complete = false ───► Force Redirect to /admin/setup
       │
       └─── Setup Complete = true  ───► Continue to requested page / login
```

### Initial Owner Registration
1. Visit `admin.rajshreejewels.com` (you will be auto-redirected to `/setup`).
2. Supply the store details and set your owner administrator account credentials.
3. Upon clicking **Create Account**, the system designates you as the **Owner** (`isOwner: true`), bypasses standard permission checks (granting absolute access), and flags setup as complete.
4. Future visits to `/setup` will automatically redirect to the login screen.

---

## 2. Granular Permissions & Role Assignment

To securely scale operations, the system supports robust staff access control.

### Default System Roles
- **Owner:** Full system privileges (cannot be deleted, modified, or restricted).
- **Manager:** Authorized to update inventory, manage tags, and review sales performance.
- **Order Processor:** Focused entirely on viewing orders, changing logistics statuses, printing invoices, and customer communications.

### Granular Override Matrix
Within the **Admin > Users & Roles** dashboard, admins can set individual permission overrides across three states:
- **Inherit (Default):** Adhere to the default permissions associated with the user's role.
- **Explicit Allow:** Grant the permission regardless of their standard role limits.
- **Explicit Deny:** Restrict this permission even if their role would otherwise permit it.

> [!WARNING]
> **Customer PII Blurring:** If an administrator role or override does not possess explicit `orders.view_customer` permission, all customer names, phone numbers, email addresses, and shipping locations are automatically blurred with CSS overlay filters and redacted in API responses.

---

## 3. Offers, Coupons & Sitewide Sales

Create and coordinate marketing campaigns to incentivize high-value jewellery shoppers.

### Coupon Code Rules
- **Fixed Amount:** Subtract a specific rupee value (e.g. ₹500 off).
- **Percentage Discount:** Deduct a proportion of the product price (e.g. 10% off).
- **Minimum Order Value:** Coupons can enforce a threshold (e.g., valid only on items above ₹2,000).
- **Unique Inventory Check:** Coupons apply exclusively to the product cost; because each piece is uniquely numbered, coupons do not duplicate across multiple quantities.

### Sitewide Sales & Countdown Timers
When launching a storewide event:
1. Specify a **Sales Markdown Percentage** (e.g. 5% off everything).
2. Set a **Promotional Announcement Text** to display in the website banner.
3. Configure the **Sale End Date** to activate the real-time countdown clock.
4. **Live Cache Invalidation:** Saving changes triggers an on-demand revalidation of active product pages, immediately showing the struck-through original price alongside the discounted sale price.

---

## 4. Product Collections & Curations

Create responsive, premium visual grids of handpicked jewellery pieces.

### Visual Reordering via HTML5 Drag & Drop
- **Collections Ordering:** In the **Collections Manager**, drag collection banners vertically to rearrange their presentation priority in the navigation menu.
- **Product Sorting:** Click into a specific collection to view all attached products. Drag items horizontally to arrange their grid order.
- **Search Picker:** Quickly add items to a curation by typing in the search bar, returning matching products in stock.

---

## 5. Direct Order Chat inquiries

Admin handles all communication inside the dense order dashboard.

- **Unread Notification Badges:** Orders with active customer messages containing unread text show a glowing red `NEW CHAT` indicator in the orders table.
- **Live Thread Polling:** When clicking an order, a dedicated slide-in panel reveals the chat history. The admin panel automatically syncs with the database on a 10-second polling cycle.
- **SMTP Alerts:** Sending a message dispatches an immediate email alert to the client containing a direct hyperlink back to their order ledger.
