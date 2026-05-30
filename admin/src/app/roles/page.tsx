'use client';

import React, { useState, useEffect } from 'react';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

// PRESET PALETTE OF 10 HARMONIOUS COLORS FOR BADGES
const PRESET_COLORS = [
  '#C9A84C', // Warm Gold
  '#3B82F6', // Sleek Blue
  '#10B981', // Emerald Green
  '#F59E0B', // Bright Amber
  '#EF4444', // Crimson Red
  '#EC4899', // Elegant Pink
  '#8B5CF6', // Royal Purple
  '#06B6D4', // Cool Cyan
  '#6366F1', // Indigo Indigo
  '#84CC16'  // Fresh Lime
];

const MATRIX_DEFINITIONS = {
  Listings: [
    { perm: 'listing.create', name: 'Create Listings', desc: 'Allows drafting new product items' },
    { perm: 'listing.edit', name: 'Edit Listings', desc: 'Allows modifying existing product copy and specifications' },
    { perm: 'listing.delete', name: 'Delete Listings', desc: 'Allows soft-deleting/unlisting products' },
    { perm: 'listing.publish', name: 'Publish Drafts', desc: 'Allows confirming and publishing AI draft products' },
    { perm: 'listing.relist', name: 'Relist Products', desc: 'Allows flipping SOLD/UNLISTED items back to AVAILABLE' },
    { perm: 'listing.reorder_images', name: 'Reorder Images', desc: 'Allows sorting and sequencing product showcase photos' },
    { perm: 'listing.re_enhance_ai', name: 'AI Re-enhancement', desc: 'Allows re-triggering OpenAI copywriting/sharpening pipeline' },
    { perm: 'listing.manage_tags', name: 'Manage Search Tags', desc: 'Allows creating and assigning categorization tags' },
    { perm: 'listing.manage_collections', name: 'Manage Collections', desc: 'Allows sorting product collections and storefront sections' },
  ],
  Orders: [
    { perm: 'orders.view', name: 'View Orders', desc: 'Allows viewing order queues, statuses, and transaction details' },
    { perm: 'orders.update_status', name: 'Update Order Status', desc: 'Allows updating delivery logs and courier statuses' },
    { perm: 'orders.book_courier', name: 'Book Courier via Shiprocket', desc: 'Allows launching automated shipping dispatches' },
    { perm: 'orders.manual_shipping', name: 'Manual Shipping Entry', desc: 'Allows writing custom AWB tracking IDs' },
    { perm: 'orders.cancel', name: 'Cancel Orders', desc: 'Allows voiding active payments and orders' },
    { perm: 'orders.add_note', name: 'Write Staff Notes', desc: 'Allows appending internal operations remarks' },
    { perm: 'orders.view_customer', name: 'View Customer Contact Info', desc: 'Allows viewing unblurred buyer names, emails, and phones' },
  ],
  Finance: [
    { perm: 'finance.view_revenue', name: 'View Financial Revenue', desc: 'Allows reading cashflows, chart stats, and revenue metrics' },
    { perm: 'finance.issue_refund', name: 'Issue Razorpay Refunds', desc: 'Allows triggering electronic payment refunds' },
    { perm: 'finance.view_invoices', name: 'View & Download Invoices', desc: 'Allows fetching printable purchase receipt PDFs' },
    { perm: 'finance.manage_coupons', name: 'Manage Discount Coupons', desc: 'Allows creating and editing cart coupons' },
    { perm: 'finance.manage_sales', name: 'Manage Sitewide Sales', desc: 'Allows running discounts and site banners' },
  ],
  Analytics: [
    { perm: 'analytics.view', name: 'View Analytics Overview', desc: 'Allows opening graphs, inventory rates, and category statistics' },
  ],
  Settings: [
    { perm: 'settings.store', name: 'Manage Store Settings', desc: 'Allows configuring free shipping thresholds, social links, and COD toggles' },
  ]
};

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editor drawer state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null); // null = New Role

  // Form states
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleColor, setRoleColor] = useState(PRESET_COLORS[0]);
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch(`${BACKEND_URL}/admin/roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load roles from backend. Ensure you are Owner.');

      const data = await res.json();
      setRoles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (role: any = null) => {
    setError('');
    setSuccessMsg('');
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleDesc(role.description || '');
      setRoleColor(role.color || PRESET_COLORS[0]);
      setRolePerms(role.permissions || {});
    } else {
      setEditingRole(null);
      setRoleName('');
      setRoleDesc('');
      setRoleColor(PRESET_COLORS[0]);
      setRolePerms({});
    }
    setEditorOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (roleName.trim().length < 2) {
      setError('Role name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      let bodyData: any = {
        name: roleName,
        description: roleDesc,
        color: roleColor,
        permissions: rolePerms
      };

      if (editingRole) {
        const changes: Record<string, any> = {};
        if (roleName !== editingRole.name) changes.name = roleName;
        if (roleDesc !== (editingRole.description || '')) changes.description = roleDesc;
        if (roleColor !== (editingRole.color || '')) changes.color = roleColor;
        
        const originalPerms = editingRole.permissions || {};
        const permsChanged = Object.keys(rolePerms).some(key => rolePerms[key] !== originalPerms[key]) ||
                             Object.keys(originalPerms).some(key => rolePerms[key] !== originalPerms[key]);
        if (permsChanged) {
          changes.permissions = rolePerms;
        }

        if (Object.keys(changes).length === 0) {
          setSuccessMsg('No changes to save.');
          setEditorOpen(false);
          return;
        }
        bodyData = changes;
      }

      const url = editingRole 
        ? `${BACKEND_URL}/admin/roles/${editingRole.id}`
        : `${BACKEND_URL}/admin/roles`;

      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Saving role failed');

      setSuccessMsg(`Role "${roleName}" saved successfully.`);
      setEditorOpen(false);
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete role "${name}"? This will fail if users are currently assigned to it.`)) return;

    setError('');
    setSuccessMsg('');
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch(`${BACKEND_URL}/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'ROLE_IN_USE') {
          throw new Error(`Cannot delete: This role is currently assigned to ${data.userCount} user(s). Reassign them first.`);
        }
        throw new Error(data.message || 'Deletion failed');
      }

      setSuccessMsg(`Role "${name}" deleted successfully.`);
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const togglePermission = (perm: string) => {
    setRolePerms(prev => ({
      ...prev,
      [perm]: !prev[perm]
    }));
  };

  const handleSelectAllSection = (sectionKey: string, selectAll: boolean) => {
    const list = MATRIX_DEFINITIONS[sectionKey as keyof typeof MATRIX_DEFINITIONS] || [];
    const updated = { ...rolePerms };
    for (const item of list) {
      updated[item.perm] = selectAll;
    }
    setRolePerms(updated);
  };

  if (loading) {
    return (
      <div style={{ color: '#aaa', padding: '40px', fontFamily: 'monospace' }}>
        LOADING ROLE MATRIX...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', background: '#0a0a0a', minHeight: '100vh', color: '#e0e0e0', position: 'relative' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #1a1a1a', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '26px', color: '#fff', margin: 0, fontFamily: 'Georgia, serif', letterSpacing: '0.5px' }}>Roles & Permission Matrix</h1>
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>Establish reusable staff roles and assign access vectors systematically.</p>
        </div>
        <button
          onClick={() => openEditor()}
          style={{ background: '#C9A84C', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}
        >
          Create Custom Role
        </button>
      </div>

      {successMsg && (
        <div style={{ padding: '15px', background: 'rgba(45, 122, 58, 0.1)', border: '1px solid rgba(45, 122, 58, 0.3)', color: '#2d7a3a', borderRadius: '4px', marginBottom: '25px', fontSize: '14px' }}>
          ✓ {successMsg}
        </div>
      )}

      {error && (
        <div style={{ padding: '15px', background: 'rgba(185, 28, 28, 0.1)', border: '1px solid rgba(185, 28, 28, 0.3)', color: '#b91c1c', borderRadius: '4px', marginBottom: '25px', fontSize: '14px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Role Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
        {roles.map(role => {
          const activePermsCount = Object.values(role.permissions || {}).filter(v => v === true).length;
          const userCount = role._count?.users || 0;
          return (
            <div
              key={role.id}
              style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: '6px',
                padding: '25px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                position: 'relative',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
            >
              {/* Top Row Color Dot & Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: role.color }}></span>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>{role.name}</h2>
              </div>

              {/* Description */}
              <p style={{ fontSize: '12px', color: '#666', lineHeight: '1.5', margin: '0 0 20px 0', flexGrow: 1 }}>
                {role.description || 'No description provided.'}
              </p>

              {/* Stats Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1a1a1a', paddingTop: '15px', fontSize: '11px', color: '#aaa', fontWeight: 'bold' }}>
                <div>
                  <span style={{ color: '#888' }}>Staff Count:</span> <span style={{ color: '#C9A84C' }}>{userCount}</span>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Active Vectors:</span> <span style={{ color: '#C9A84C' }}>{activePermsCount}</span>
                </div>
              </div>

              {/* Action Buttons Overlay */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid #1a1a1a', paddingTop: '15px' }}>
                <button
                  onClick={() => openEditor(role)}
                  style={{ background: 'transparent', border: '1px solid #333', color: '#E8C97A', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', flexGrow: 1 }}
                >
                  Edit Matrix
                </button>
                <button
                  onClick={() => handleDeleteRole(role.id, role.name)}
                  style={{ background: 'transparent', border: '1px solid rgba(185, 28, 28, 0.1)', color: '#b91c1c', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Drawer */}
      {editorOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '580px', background: '#111', borderLeft: '1px solid #222', zIndex: 1001, boxShadow: '-10px 0 40px rgba(0,0,0,0.8)', padding: '40px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          
          {/* Editor Header */}
          <div style={{ borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'Georgia, serif' }}>
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
              </h2>
              <button
                onClick={() => setEditorOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px' }}
              >
                &times;
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>Configure credentials and permission matrix for this role.</p>
          </div>

          <form onSubmit={handleSaveRole} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '10px', marginBottom: '25px' }}>
              
              {/* Role Details */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Role Name</label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Inventory Lister"
                  style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', boxSizing: 'border-box', marginBottom: '15px' }}
                />

                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Description</label>
                <textarea
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Summarize what users with this role can execute..."
                  style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', boxSizing: 'border-box', height: '60px', fontFamily: 'inherit', resize: 'none', marginBottom: '15px' }}
                />

                {/* Color Picker */}
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Role Color Badge</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {PRESET_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setRoleColor(c)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        border: `2px solid ${roleColor === c ? '#fff' : 'transparent'}`,
                        boxShadow: roleColor === c ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
                        transition: 'all 0.1s'
                      }}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Permission Matrix */}
              <div>
                <h3 style={{ fontSize: '12px', color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '15px', fontWeight: 'bold' }}>Permission Matrix</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {Object.entries(MATRIX_DEFINITIONS).map(([sectionKey, perms]) => (
                    <div key={sectionKey} style={{ border: '1px solid #1c1c1c', borderRadius: '4px', overflow: 'hidden' }}>
                      
                      {/* Section Header with Select All / Deselect All */}
                      <div style={{ background: '#161616', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c1c1c' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#aaa', letterSpacing: '0.5px' }}>{sectionKey} Permissions</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectAllSection(sectionKey, true)}
                            style={{ background: 'transparent', border: 'none', color: '#E8C97A', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.5px' }}
                          >
                            Select All
                          </button>
                          <span style={{ color: '#333', fontSize: '9px' }}>|</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllSection(sectionKey, false)}
                            style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.5px' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Row List */}
                      {perms.map(p => {
                        const active = !!rolePerms[p.perm];
                        return (
                          <div
                            key={p.perm}
                            onClick={() => togglePermission(p.perm)}
                            style={{
                              padding: '12px 18px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              background: active ? 'rgba(201, 168, 76, 0.02)' : '#0d0d0d',
                              borderBottom: '1px solid #181818',
                              transition: 'background-color 0.1s'
                            }}
                          >
                            <div style={{ flexGrow: 1, paddingRight: '15px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 'bold', color: active ? '#E8C97A' : '#bbb' }}>{p.name}</div>
                              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{p.desc}</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => {}} // handled by row onClick
                              style={{ accentColor: '#C9A84C', width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Editor Footer */}
            <div style={{ borderTop: '1px solid #222', paddingTop: '20px', display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ background: '#C9A84C', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
              >
                {saving ? 'SAVING ROLE...' : 'SAVE ROLE MATRIX'}
              </button>
            </div>
          </form>

        </div>
      )}

    </div>
  );
}
