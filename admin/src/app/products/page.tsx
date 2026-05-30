'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithRetry } from '../utils/api';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

interface ProductImage {
  urlThumb: string;
}

interface Product {
  id: string;
  name: string;
  displayName: string;
  description: string;
  shortDesc: string;
  category: string;
  priceINR: number;
  originalPriceINR: number | null;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNLISTED';
  listedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
  occasion: string | null;
  primaryImageUrl: string;
  images: ProductImage[];
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: '',
    shortDesc: '',
    description: '',
    priceINR: 0,
    originalPriceINR: '' as string | number,
    occasion: '',
    metaTitle: '',
    metaDescription: '',
    keywordsStr: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);

  // Global messages
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const filterParam = statusFilter === 'All' ? 'All' : statusFilter.toUpperCase();
      const res = await fetchWithRetry(
        `${BACKEND_URL}/admin/products?status=${filterParam}&page=${page}&limit=24&search=${searchQuery}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!res.ok) throw new Error('Failed to load products');

      const data = await res.json();
      setProducts(data.products);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Error loading products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditForm({
      displayName: p.displayName || '',
      shortDesc: p.shortDesc || '',
      description: p.description || '',
      priceINR: p.priceINR || 0,
      originalPriceINR: p.originalPriceINR !== null ? p.originalPriceINR : '',
      occasion: p.occasion || '',
      metaTitle: p.metaTitle || '',
      metaDescription: p.metaDescription || '',
      keywordsStr: p.keywords ? p.keywords.join(', ') : '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editForm.displayName.trim() || !editForm.priceINR || !editForm.shortDesc.trim() || !editForm.description.trim()) {
      showError('Please fill out all required fields: Display Name, Price, Short Description, and Description.');
      return;
    }

    setSaveLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      
      const originalPayload = {
        displayName: editingProduct.displayName || '',
        shortDesc: editingProduct.shortDesc || '',
        description: editingProduct.description || '',
        priceINR: Number(editingProduct.priceINR),
        originalPriceINR: editingProduct.originalPriceINR !== null && editingProduct.originalPriceINR !== undefined ? Number(editingProduct.originalPriceINR) : null,
        occasion: editingProduct.occasion || '',
        metaTitle: editingProduct.metaTitle || '',
        metaDescription: editingProduct.metaDescription || '',
        keywords: editingProduct.keywords ? editingProduct.keywords.map(s => s.trim()).filter(Boolean) : [],
      };

      const currentPayload = {
        displayName: editForm.displayName || '',
        shortDesc: editForm.shortDesc || '',
        description: editForm.description || '',
        priceINR: Number(editForm.priceINR),
        originalPriceINR: editForm.originalPriceINR !== '' ? Number(editForm.originalPriceINR) : null,
        occasion: editForm.occasion || '',
        metaTitle: editForm.metaTitle || '',
        metaDescription: editForm.metaDescription || '',
        keywords: editForm.keywordsStr ? editForm.keywordsStr.split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      const changes: Record<string, any> = {};
      for (const key in currentPayload) {
        const currentVal = (currentPayload as any)[key];
        const originalVal = (originalPayload as any)[key];

        if (Array.isArray(currentVal) && Array.isArray(originalVal)) {
          if (JSON.stringify(currentVal) !== JSON.stringify(originalVal)) {
            changes[key] = currentVal;
          }
        } else if (currentVal !== originalVal) {
          changes[key] = currentVal;
        }
      }

      if (Object.keys(changes).length === 0) {
        showSuccess('No changes to save');
        setEditingProduct(null);
        return;
      }

      const res = await fetch(`${BACKEND_URL}/admin/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      });

      if (!res.ok) throw new Error('Failed to update product details');

      showSuccess('Product details updated successfully');
      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      showError(err.message || 'Failed to save product');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleStatusChange = async (productId: string, newStatus: 'AVAILABLE' | 'UNLISTED') => {
    const confirmation = newStatus === 'AVAILABLE'
      ? 'Relist this item? It will go live immediately and trigger wishlist notifications.'
      : 'Hide this item? It will not be viewable by storefront customers.';

    if (!confirm(confirmation)) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/products/${productId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update product status');

      showSuccess(`Product status updated to ${newStatus}`);
      fetchProducts();
    } catch (err: any) {
      showError(err.message || 'Failed to update status');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to soft delete this product? It will preserve order history but hide it permanently.')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to soft delete product');

      showSuccess('Product deleted (unlisted) successfully');
      fetchProducts();
    } catch (err: any) {
      showError(err.message || 'Failed to delete product');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="badge badge-green">Available</span>;
      case 'RESERVED':
        return <span className="badge badge-yellow">Reserved</span>;
      case 'SOLD':
        return <span className="badge badge-grey">Sold</span>;
      case 'UNLISTED':
        return <span className="badge badge-red">Unlisted</span>;
      default:
        return <span className="badge badge-grey">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Store Inventory</h2>
          <div style={{ fontSize: '12px', color: '#666' }}>{total} Items Registered</div>
        </div>
        <button onClick={() => router.push('/products/new')} className="btn btn-primary" style={{ backgroundColor: '#C9A84C', color: '#111', fontWeight: 'bold' }}>
          ＋ New Listing
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="tabs-bar">
        {['All', 'Available', 'Sold', 'Unlisted'].map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`tab-btn ${statusFilter === status ? 'active' : ''}`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Search by name, display name, category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-control"
          style={{ maxWidth: '400px' }}
        />
        <button type="submit" className="btn btn-secondary">Search</button>
        {searchQuery && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setPage(1); setTimeout(() => fetchProducts(), 50); }}
            className="btn btn-secondary"
            style={{ color: '#888' }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Table grid */}
      <div className="table-container">
        <table className="dense-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Thumbnail</th>
              <th>Display Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Listed Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.primaryImageUrl && (
                      <img
                        src={p.primaryImageUrl}
                        alt={p.displayName}
                        style={{ width: '45px', height: '45px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border)' }}
                      />
                    )}
                  </td>
                  <td>
                    <div style={{ color: '#fff', fontWeight: 'bold' }}>{p.displayName}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>SKU/ID: {p.id}</div>
                  </td>
                  <td style={{ fontSize: '13px' }}>{p.category}</td>
                  <td>
                    <div style={{ fontWeight: 'bold' }}>₹{p.priceINR.toLocaleString('en-IN')}</div>
                    {p.originalPriceINR && (
                      <div style={{ textDecoration: 'line-through', fontSize: '11px', color: '#666' }}>
                        ₹{p.originalPriceINR.toLocaleString('en-IN')}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: '#888' }}>
                    {new Date(p.listedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>{getStatusBadge(p.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => router.push(`/products/${p.id}/edit`)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px' }}>
                        Edit
                      </button>

                      {p.status === 'AVAILABLE' ? (
                        <button
                          onClick={() => handleStatusChange(p.id, 'UNLISTED')}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--warning)' }}
                        >
                          Unlist
                        </button>
                      ) : (p.status === 'SOLD' || p.status === 'UNLISTED') ? (
                        <button
                          onClick={() => handleStatusChange(p.id, 'AVAILABLE')}
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                        >
                          Relist
                        </button>
                      ) : null}

                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        disabled={p.status === 'UNLISTED'}
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                  {loading ? 'SYNCHRONIZING DIGITAL ASSETS...' : 'NO INVENTORY RECORDED MATCHING FILTERS'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '40px' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="btn btn-secondary"
          >
            Prev
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px', color: '#666' }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="btn btn-secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Product edit Modal dialog */}
      {editingProduct && (
        <div className="modal-backdrop" onClick={() => setEditingProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '600px' }}>
            <div className="modal-header">
              <span className="drawer-title">Edit Product: {editingProduct.name}</span>
              <button onClick={() => setEditingProduct(null)} style={{ background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="form-control"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price INR (₹)</label>
                    <input
                      type="number"
                      value={editForm.priceINR}
                      onChange={(e) => setEditForm({ ...editForm, priceINR: parseInt(e.target.value) })}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Original/Strike Price INR (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 1999"
                      value={editForm.originalPriceINR}
                      onChange={(e) => setEditForm({ ...editForm, originalPriceINR: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Short Description (55 chars max)</label>
                  <input
                    type="text"
                    maxLength={55}
                    value={editForm.shortDesc}
                    onChange={(e) => setEditForm({ ...editForm, shortDesc: e.target.value })}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SEO Description (~150 words)</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="form-control"
                    style={{ minHeight: '120px' }}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Occasion</label>
                    <input
                      type="text"
                      placeholder="e.g. Bridal, Festive, Daily Wear"
                      value={editForm.occasion}
                      onChange={(e) => setEditForm({ ...editForm, occasion: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Meta Title (under 60 chars)</label>
                  <input
                    type="text"
                    value={editForm.metaTitle}
                    onChange={(e) => setEditForm({ ...editForm, metaTitle: e.target.value })}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Meta Description (under 155 chars)</label>
                  <textarea
                    maxLength={155}
                    value={editForm.metaDescription}
                    onChange={(e) => setEditForm({ ...editForm, metaDescription: e.target.value })}
                    className="form-control"
                    style={{ minHeight: '60px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Keywords (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. gold jhumka, bridal earrings, kundan imitation"
                    value={editForm.keywordsStr}
                    onChange={(e) => setEditForm({ ...editForm, keywordsStr: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditingProduct(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={saveLoading} className="btn btn-primary">
                  {saveLoading ? 'Storing...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Success and Error toast notifications */}
      <div className="toast-container">
        {successToast && <div className="toast toast-success">{successToast}</div>}
        {errorToast && <div className="toast toast-error">{errorToast}</div>}
      </div>
    </div>
  );
}
