export const ALL_PERMISSIONS = {
  // Listings
  LISTING_CREATE:           'listing.create',
  LISTING_EDIT:             'listing.edit',
  LISTING_DELETE:           'listing.delete',
  LISTING_PUBLISH:          'listing.publish',
  LISTING_RELIST:           'listing.relist',
  LISTING_EDIT_PRICE:       'listing.edit_price',
  LISTING_EDIT_DISCOUNT:    'listing.edit_discount',
  LISTING_REORDER_IMAGES:   'listing.reorder_images',
  LISTING_RE_ENHANCE_AI:    'listing.re_enhance_ai',
  LISTING_MANAGE_TAGS:      'listing.manage_tags',
  LISTING_MANAGE_COLLECTIONS: 'listing.manage_collections',

  // Orders
  ORDERS_VIEW:              'orders.view',
  ORDERS_UPDATE_STATUS:     'orders.update_status',
  ORDERS_BOOK_COURIER:      'orders.book_courier',
  ORDERS_MANUAL_SHIPPING:   'orders.manual_shipping',
  ORDERS_CANCEL:            'orders.cancel',
  ORDERS_ADD_NOTE:          'orders.add_note',
  ORDERS_VIEW_CUSTOMER:     'orders.view_customer',    // If off — buyer name/contact blurred

  // Finance
  FINANCE_VIEW_REVENUE:     'finance.view_revenue',
  FINANCE_ISSUE_REFUND:     'finance.issue_refund',
  FINANCE_VIEW_INVOICES:    'finance.view_invoices',
  FINANCE_MANAGE_COUPONS:   'finance.manage_coupons',
  FINANCE_MANAGE_SALES:     'finance.manage_sales',

  // Customers
  CUSTOMERS_VIEW:           'customers.view',
  CUSTOMERS_VIEW_FULL_DATA: 'customers.view_full_data',  // Phone, address

  // Settings
  SETTINGS_STORE:           'settings.store',
  SETTINGS_SHIPPING:        'settings.shipping',
  SETTINGS_PAYMENTS:        'settings.payments',
  SETTINGS_ANNOUNCEMENTS:   'settings.announcements',
  SETTINGS_SOCIAL:          'settings.social',

  // Analytics
  ANALYTICS_VIEW:           'analytics.view',

  // Users & Roles (owner-only — cannot be assigned to any role)
  USERS_MANAGE:             'users.manage',
  ROLES_MANAGE:             'roles.manage',
} as const;

export type Permission = typeof ALL_PERMISSIONS[keyof typeof ALL_PERMISSIONS];

export type PermissionSet = {
  [K in Permission]: boolean;
};

export function emptyPermissions(): PermissionSet {
  return Object.fromEntries(
    Object.values(ALL_PERMISSIONS).map(p => [p, false])
  ) as PermissionSet;
}

export function fullPermissions(): PermissionSet {
  return Object.fromEntries(
    Object.values(ALL_PERMISSIONS).map(p => [p, true])
  ) as PermissionSet;
}

// Owner-only perms — never storable on a role
export const OWNER_ONLY_PERMISSIONS: Permission[] = [
  'users.manage',
  'roles.manage',
];
