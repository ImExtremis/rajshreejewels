'use client';

import React, { useState, useEffect } from 'react';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Invite form state
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRoleIds, setInviteRoleIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  // Edit form state
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editOverrides, setEditOverrides] = useState<Record<string, boolean | null>>({});
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('admin_token');

    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/admin/roles`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!usersRes.ok || !rolesRes.ok) {
        throw new Error('Failed to load users or roles from backend. Ensure you are logged in as Owner.');
      }

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();

      setUsers(usersData);
      setRoles(rolesData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setInviting(true);

    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch(`${BACKEND_URL}/admin/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          username: inviteUsername,
          roleIds: inviteRoleIds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invitation failed');

      setSuccessMsg(`Team member ${inviteName} invited successfully! Temporary password sent to email.`);
      setInviteModalOpen(false);
      resetInviteForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const resetInviteForm = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteUsername('');
    setInviteRoleIds([]);
  };

  const openEditDrawer = (user: any) => {
    setSelectedUser(user);
    setEditRoleIds(user.roles.map((r: any) => r.id));
    
    // Process overrides: start with empty overrides, load from db overrides
    const initialOverrides: Record<string, boolean | null> = {};
    const dbOverrides = user.adminUser?.permissionOverrides || {};
    
    setEditOverrides(dbOverrides);
    setEditDrawerOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setError('');
    setSuccessMsg('');
    setSavingUser(true);

    const token = localStorage.getItem('admin_token');

    try {
      // 1. Save Roles
      const rolesRes = await fetch(`${BACKEND_URL}/admin/users/${selectedUser.id}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roleIds: editRoleIds })
      });
      if (!rolesRes.ok) throw new Error('Failed to update roles');

      // 2. Save Overrides
      const overridesRes = await fetch(`${BACKEND_URL}/admin/users/${selectedUser.id}/overrides`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ overrides: editOverrides })
      });
      if (!overridesRes.ok) throw new Error('Failed to update permission overrides');

      setSuccessMsg(`User ${selectedUser.name} permissions updated successfully.`);
      setEditDrawerOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you absolutely sure you want to delete ${userName}? This action is permanent.`)) return;

    setError('');
    setSuccessMsg('');
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch(`${BACKEND_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Deletion failed');

      setSuccessMsg(`User ${userName} deleted successfully.`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleInviteRoleCheckbox = (roleId: string) => {
    if (inviteRoleIds.includes(roleId)) {
      setInviteRoleIds(inviteRoleIds.filter(id => id !== roleId));
    } else {
      setInviteRoleIds([...inviteRoleIds, roleId]);
    }
  };

  const toggleEditRoleCheckbox = (roleId: string) => {
    if (editRoleIds.includes(roleId)) {
      setEditRoleIds(editRoleIds.filter(id => id !== roleId));
    } else {
      setEditRoleIds([...editRoleIds, roleId]);
    }
  };

  // Resolves inherited role permission for a spec permission
  const getInheritedPermissionState = (permission: string): boolean => {
    if (!selectedUser) return false;
    
    // Check if any of the user's selected roles yields TRUE for this permission
    for (const roleId of editRoleIds) {
      const role = roles.find(r => r.id === roleId);
      if (role?.permissions?.[permission] === true) {
        return true;
      }
    }
    return false;
  };

  // Changes override state between: Granted (true) -> Revoked (false) -> Inherited (undefined/delete)
  const cycleOverrideState = (permission: string) => {
    const current = editOverrides[permission];
    const newOverrides = { ...editOverrides };

    if (current === undefined || current === null) {
      // Inherited -> Granted
      newOverrides[permission] = true;
    } else if (current === true) {
      // Granted -> Revoked
      newOverrides[permission] = false;
    } else {
      // Revoked -> Inherited (delete from override map)
      delete newOverrides[permission];
    }
    setEditOverrides(newOverrides);
  };

  const getOverrideButtonStyles = (permission: string) => {
    const state = editOverrides[permission];
    if (state === true) {
      return { label: 'Granted (Override)', bg: '#2D7A3A', color: '#fff' };
    }
    if (state === false) {
      return { label: 'Revoked (Override)', bg: '#B91C1C', color: '#fff' };
    }
    const inherited = getInheritedPermissionState(permission);
    return { 
      label: `Inherited (${inherited ? 'Active' : 'Inactive'})`, 
      bg: '#222', 
      color: inherited ? '#E8C97A' : '#777' 
    };
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  if (loading) {
    return (
      <div style={{ color: '#aaa', padding: '40px', fontFamily: 'monospace' }}>
        LOADING TEAM RECORDS...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', background: '#0a0a0a', minHeight: '100vh', color: '#e0e0e0', position: 'relative' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #1a1a1a', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '26px', color: '#fff', margin: 0, fontFamily: 'Georgia, serif', letterSpacing: '0.5px' }}>Team Management</h1>
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>Configure access rights, staff roles, and overrides for the store.</p>
        </div>
        <button
          onClick={() => setInviteModalOpen(true)}
          className="btn btn-gold"
          style={{ padding: '12px 24px' }}
        >
          Invite Team Member
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

      {/* Users table */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#151515', borderBottom: '1px solid #222', color: '#888', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px' }}>
              <th style={{ padding: '18px 24px' }}>Team Member</th>
              <th style={{ padding: '18px 24px' }}>Username</th>
              <th style={{ padding: '18px 24px' }}>Email Address</th>
              <th style={{ padding: '18px 24px' }}>Assigned Roles</th>
              <th style={{ padding: '18px 24px' }}>Status</th>
              <th style={{ padding: '18px 24px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #1c1c1c', transition: 'background-color 0.2s' }}>
                <td style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: u.isOwner ? '#C9A84C' : '#333', color: u.isOwner ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                    {getInitials(u.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{u.name}</div>
                    {u.isOwner && <div style={{ fontSize: '10px', color: '#C9A84C', textTransform: 'uppercase', marginTop: '2px', fontWeight: 'bold' }}>Store Owner</div>}
                  </div>
                </td>
                <td style={{ padding: '20px 24px', color: '#aaa', fontFamily: 'monospace' }}>{u.adminUser?.username || '—'}</td>
                <td style={{ padding: '20px 24px', color: '#aaa' }}>{u.email}</td>
                <td style={{ padding: '20px 24px' }}>
                  {u.isOwner ? (
                    <span style={{ background: 'rgba(201, 168, 76, 0.1)', color: '#C9A84C', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: '1px solid rgba(201, 168, 76, 0.2)' }}>
                      ALL_BYPASS
                    </span>
                  ) : u.roles.length > 0 ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {u.roles.map((r: any) => (
                        <span key={r.id} style={{ background: `${r.color}22`, color: r.color, border: `1px solid ${r.color}44`, padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                          {r.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#555', fontStyle: 'italic' }}>No roles assigned</span>
                  )}
                </td>
                <td style={{ padding: '20px 24px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: u.isAdmin ? '#2D7A3A' : '#777', fontSize: '12px', fontWeight: 'bold' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.isAdmin ? '#2D7A3A' : '#777' }}></span>
                    {u.isAdmin ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                  {!u.isOwner ? (
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEditDrawer(u)}
                        style={{ background: 'transparent', border: '1px solid #333', color: '#E8C97A', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        Adjust Rights
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        style={{ background: 'transparent', border: '1px solid rgba(185, 28, 28, 0.2)', color: '#b91c1c', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        Revoke Access
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#555', fontSize: '11px', fontStyle: 'italic' }}>Root Lock</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '480px', background: '#111', border: '1px solid #222', padding: '35px', borderRadius: '6px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <h2 style={{ fontSize: '18px', color: '#fff', margin: '0 0 8px 0', fontFamily: 'Georgia, serif' }}>Invite Admin User</h2>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '25px' }}>Add a new administrator. They will receive an email with login credentials.</p>

            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ramesh@rajshreejewels.com"
                  style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Username</label>
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="ramesh_lister"
                  style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Assign Initial Roles</label>
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #222', padding: '12px', background: '#0a0a0a', borderRadius: '4px' }}>
                  {roles.map(role => (
                    <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={inviteRoleIds.includes(role.id)}
                        onChange={() => toggleInviteRoleCheckbox(role.id)}
                        style={{ accentColor: '#C9A84C' }}
                      />
                      <span style={{ color: role.color, fontWeight: 'bold' }}>{role.name}</span>
                    </label>
                  ))}
                  {roles.length === 0 && <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic' }}>No roles defined. Create roles first.</div>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setInviteModalOpen(false); resetInviteForm(); }}
                  style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="btn btn-gold"
                  style={{ padding: '10px 24px' }}
                >
                  {inviting ? 'SENDING INVITE...' : 'SEND INVITATION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rights Drawer */}
      {editDrawerOpen && selectedUser && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '560px', background: '#111', borderLeft: '1px solid #222', zIndex: 1001, boxShadow: '-10px 0 40px rgba(0,0,0,0.8)', padding: '40px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          
          {/* Drawer Header */}
          <div style={{ borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', color: '#fff', margin: 0, fontFamily: 'Georgia, serif' }}>Adjust Access Rights</h2>
              <button
                onClick={() => setEditDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px' }}
              >
                &times;
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>Configure roles and direct overrides for <strong>{selectedUser.name}</strong>.</p>
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '10px', marginBottom: '25px' }}>
            
            {/* Roles Selection */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '12px', color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', fontWeight: 'bold' }}>Roles Assignment</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {roles.map(role => {
                  const active = editRoleIds.includes(role.id);
                  return (
                    <div
                      key={role.id}
                      onClick={() => toggleEditRoleCheckbox(role.id)}
                      style={{
                        padding: '8px 14px',
                        background: active ? `${role.color}22` : '#181818',
                        border: `1px solid ${active ? role.color : '#222'}`,
                        borderRadius: '20px',
                        color: active ? role.color : '#888',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s',
                        userSelect: 'none'
                      }}
                    >
                      {role.name}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overrides Table */}
            <div>
              <h3 style={{ fontSize: '12px', color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '15px', fontWeight: 'bold' }}>Permission Overrides</h3>
              <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.4', marginBottom: '18px' }}>
                Click to cycle overrides: <strong>Inherited (gray)</strong> → <strong>Granted (green)</strong> → <strong>Revoked (red)</strong>. Revoking revokes access even if roles grant it.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries({
                  Listings: [
                    { perm: 'listing.create', name: 'Create Listing', desc: 'Allows drafting new product items' },
                    { perm: 'listing.edit', name: 'Edit Listing', desc: 'Allows modifying existing item copy/images' },
                    { perm: 'listing.delete', name: 'Delete Listing', desc: 'Allows soft-deleting/unlisting products' },
                    { perm: 'listing.publish', name: 'Publish Drafts', desc: 'Allows publishing AI draft products' },
                    { perm: 'listing.relist', name: 'Relist Products', desc: 'Allows flipping SOLD/UNLISTED status' },
                    { perm: 'listing.reorder_images', name: 'Reorder Images', desc: 'Allows re-sequencing images' },
                    { perm: 'listing.re_enhance_ai', name: 'AI Re-enhancement', desc: 'Allows re-triggering OpenAI pipeline' },
                    { perm: 'listing.manage_tags', name: 'Manage Tags', desc: 'Allows adding/removing search tags' },
                    { perm: 'listing.manage_collections', name: 'Manage Collections', desc: 'Allows product collections sorting' },
                  ],
                  Orders: [
                    { perm: 'orders.view', name: 'View Orders', desc: 'Allows viewing transactions and queues' },
                    { perm: 'orders.update_status', name: 'Update Status', desc: 'Allows modifying shipping/delivery state' },
                    { perm: 'orders.book_courier', name: 'Book Courier', desc: 'Allows automated Shiprocket dispatch' },
                    { perm: 'orders.manual_shipping', name: 'Manual Shipping', desc: 'Allows entering AWB tracking manually' },
                    { perm: 'orders.cancel', name: 'Cancel Order', desc: 'Allows voiding active orders' },
                    { perm: 'orders.add_note', name: 'Add Notes', desc: 'Allows writing internal operations remarks' },
                    { perm: 'orders.view_customer', name: 'View Customer Info', desc: 'Allows viewing unblurred buyer details' },
                  ],
                  Finance: [
                    { perm: 'finance.view_revenue', name: 'View Revenue', desc: 'Allows reading cashflows and aggregate sales' },
                    { perm: 'finance.issue_refund', name: 'Issue Refund', desc: 'Allows triggering Razorpay refunds' },
                    { perm: 'finance.view_invoices', name: 'View Invoices', desc: 'Allows downloading invoice PDFs' },
                    { perm: 'finance.manage_coupons', name: 'Manage Coupons', desc: 'Allows creating discount coupons' },
                    { perm: 'finance.manage_sales', name: 'Manage Sitewide Sales', desc: 'Allows running discounts and sales' },
                  ],
                  Analytics: [
                    { perm: 'analytics.view', name: 'View Analytics', desc: 'Allows viewing performance graphs' },
                  ],
                  Settings: [
                    { perm: 'settings.store', name: 'Manage Storefront Settings', desc: 'Allows editing brand headers, tags, cod flags' },
                  ]
                }).map(([category, perms]) => (
                  <div key={category} style={{ border: '1px solid #1c1c1c', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                    <div style={{ background: '#161616', padding: '10px 15px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', borderBottom: '1px solid #1c1c1c', color: '#aaa' }}>
                      {category}
                    </div>
                    {perms.map(p => {
                      const buttonStyles = getOverrideButtonStyles(p.perm);
                      return (
                        <div
                          key={p.perm}
                          onClick={() => cycleOverrideState(p.perm)}
                          style={{
                            padding: '12px 15px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            background: '#0d0d0d',
                            borderBottom: '1px solid #181818',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          <div style={{ flexGrow: 1, paddingRight: '15px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{p.name}</div>
                            <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{p.desc}</div>
                          </div>
                          <button
                            type="button"
                            style={{
                              background: buttonStyles.bg,
                              color: buttonStyles.color,
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              minWidth: '130px',
                              textAlign: 'center'
                            }}
                          >
                            {buttonStyles.label}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Drawer Actions */}
          <div style={{ borderTop: '1px solid #222', paddingTop: '20px', display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditDrawerOpen(false)}
              style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveUser}
              disabled={savingUser}
              className="btn btn-gold"
              style={{ padding: '10px 24px' }}
            >
              {savingUser ? 'SAVING CHANGES...' : 'SAVE RIGHTS'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
