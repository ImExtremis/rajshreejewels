'use client';

import React, { useState, useEffect } from 'react';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: {
    products: number;
  };
}

interface Product {
  id: string;
  displayName: string;
  priceINR: number;
  status: string;
}

interface CollectionProductRelation {
  collectionId: string;
  productId: string;
  sortOrder: number;
  product: Product;
}

export default function CollectionsAdminPage() {
  const [token, setToken] = useState<string | null>(null);

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [selectedColId, setSelectedColId] = useState<string | null>(null);

  // Detail panel state
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [colProducts, setColProducts] = useState<CollectionProductRelation[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Product picker state
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [colSubmitting, setColSubmitting] = useState(false);

  // Modal / Drawer state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    description: '',
    bannerImageUrl: '',
    isActive: true,
  });
  const [createError, setCreateError] = useState('');

  // Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      fetchCollections(savedToken);
      fetchAllProducts(savedToken);
    }
  }, []);

  const fetchCollections = async (authToken: string) => {
    try {
      setCollectionsLoading(true);
      const res = await fetch(`${BACKEND_URL}/collections/admin/list`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
        if (data.length > 0 && !selectedColId) {
          handleSelectCollection(data[0].id, authToken);
        }
      }
    } catch (err) {
      console.error('Failed to load collections', err);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const fetchAllProducts = async (authToken: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/products?limit=100`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to fetch product catalog', err);
    }
  };

  const handleSelectCollection = async (id: string, authToken = token) => {
    if (!authToken) return;
    try {
      setSelectedColId(id);
      setLoadingDetail(true);
      const res = await fetch(`${BACKEND_URL}/collections/admin/detail/${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEditingCollection({
          id: data.id,
          name: data.name,
          slug: data.slug,
          description: data.description || '',
          bannerImageUrl: data.bannerImageUrl || '',
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        });
        setColProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to load collection details', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!createForm.name.trim() || !createForm.slug.trim()) {
      setCreateError('Name and URL Slug are required.');
      return;
    }

    setColSubmitting(true);
    setCreateError('');

    try {
      const res = await fetch(`${BACKEND_URL}/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...createForm,
          sortOrder: collections.length
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create collection');

      triggerToast('✨ Curated Collection created successfully!');
      setShowCreateModal(false);
      setCreateForm({ name: '', slug: '', description: '', bannerImageUrl: '', isActive: true });
      fetchCollections(token);
      handleSelectCollection(data.id, token);
    } catch (err: any) {
      setCreateError(err.message || 'Creation failed');
    } finally {
      setColSubmitting(false);
    }
  };

  const handleUpdateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingCollection) return;

    if (!editingCollection.name.trim() || !editingCollection.slug.trim()) {
      triggerToast('Name and URL Slug are required.', 'error');
      return;
    }

    setColSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_URL}/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingCollection)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update collection');

      triggerToast('Collection properties updated.');
      fetchCollections(token);
    } catch (err: any) {
      triggerToast(err.message || 'Update failed', 'error');
    } finally {
      setColSubmitting(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!token || !confirm('Are you absolutely sure you want to delete this collection? Products in it will not be deleted.')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/collections/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToast('Collection deleted.');
        setSelectedColId(null);
        setEditingCollection(null);
        setColProducts([]);
        fetchCollections(token);
      }
    } catch (err: any) {
      triggerToast(err.message || 'Deletion failed', 'error');
    }
  };

  // Add product to collection
  const handleAddProduct = async (pId: string) => {
    if (!token || !selectedColId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/collections/${selectedColId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productIds: [pId] })
      });

      if (res.ok) {
        triggerToast('Product added to collection.');
        handleSelectCollection(selectedColId);
        fetchCollections(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Remove product from collection
  const handleRemoveProduct = async (pId: string) => {
    if (!token || !selectedColId || !confirm('Remove product from collection?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/collections/${selectedColId}/products/${pId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        triggerToast('Product removed from collection.');
        handleSelectCollection(selectedColId);
        fetchCollections(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Native HTML5 Drag and Drop Reordering of Collections
  const handleDragStartCol = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('col_drag_idx', index.toString());
  };

  const handleDragOverCol = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropCol = async (e: React.DragEvent, targetIndex: number) => {
    const sourceIdxStr = e.dataTransfer.getData('col_drag_idx');
    if (!sourceIdxStr || !token) return;
    const sourceIndex = parseInt(sourceIdxStr, 10);
    if (sourceIndex === targetIndex) return;

    const list = [...collections];
    const [dragged] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, dragged);

    // Recalculate sortOrder fields
    const updated = list.map((item, idx) => ({
      ...item,
      sortOrder: idx
    }));

    setCollections(updated);

    try {
      await fetch(`${BACKEND_URL}/collections/admin/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orders: updated.map(col => ({ id: col.id, sortOrder: col.sortOrder }))
        })
      });
      triggerToast('Collections display order updated.');
    } catch (err) {
      console.error('Failed to save display order reorder', err);
    }
  };

  // Native HTML5 Drag and Drop Reordering of Products inside Collection
  const handleDragStartProd = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('prod_drag_idx', index.toString());
  };

  const handleDragOverProd = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropProd = async (e: React.DragEvent, targetIndex: number) => {
    const sourceIdxStr = e.dataTransfer.getData('prod_drag_idx');
    if (!sourceIdxStr || !token || !selectedColId) return;
    const sourceIndex = parseInt(sourceIdxStr, 10);
    if (sourceIndex === targetIndex) return;

    const list = [...colProducts];
    const [dragged] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, dragged);

    // Recalculate sortOrder fields
    const updated = list.map((item, idx) => ({
      ...item,
      sortOrder: idx
    }));

    setColProducts(updated);

    try {
      await fetch(`${BACKEND_URL}/collections/${selectedColId}/products/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orders: updated.map(item => ({ productId: item.productId, sortOrder: item.sortOrder }))
        })
      });
      triggerToast('Product ordering inside collection updated.');
    } catch (err) {
      console.error('Failed to save product reordering', err);
    }
  };

  // Filter products for the picker that are NOT in the active collection already
  const filteredCatalog = allProducts.filter(p => {
    const alreadyIn = colProducts.some(cp => cp.productId === p.id);
    const matchesSearch = p.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    return !alreadyIn && matchesSearch;
  });

  return (
    <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#e0e0e0', padding: '10px' }}>
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#C9A84C',
          color: '#000',
          padding: '12px 20px',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          {toast.text.toUpperCase()}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h2 style={{ color: '#C9A84C', fontSize: '22px', letterSpacing: '2px', fontWeight: 'bold', margin: 0, fontFamily: 'Cinzel, Georgia, serif' }}>STOREFRONT CURATIONS</h2>
          <p style={{ fontSize: '10px', color: '#666', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Design Curated Collections & Reorder Display Priorities</p>
        </div>

        <button
          onClick={() => {
            setCreateError('');
            setShowCreateModal(true);
          }}
          className="btn btn-primary"
          style={{ padding: '8px 16px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
        >
          + New Collection
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Left Panel: Collections Display order */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '20px' }}>
          <h3 style={{ fontSize: '12px', color: '#C9A84C', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '15px', letterSpacing: '0.5px' }}>
            🔄 Drag to Reorder Collections
          </h3>

          {collectionsLoading ? (
            <div style={{ color: '#666', fontSize: '11px', padding: '20px 0', textAlign: 'center' }}>LOADING VAULT CURATIONS...</div>
          ) : collections.length === 0 ? (
            <div style={{ color: '#666', fontSize: '11px', padding: '20px 0', textAlign: 'center', border: '1px dashed #222' }}>NO DYNAMIC COLLECTIONS REGISTERED</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {collections.map((col, idx) => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleDragStartCol(e, idx)}
                  onDragOver={handleDragOverCol}
                  onDrop={(e) => handleDropCol(e, idx)}
                  onClick={() => handleSelectCollection(col.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: selectedColId === col.id ? 'rgba(201, 168, 76, 0.05)' : '#0a0a0a',
                    border: selectedColId === col.id ? '1px solid #C9A84C' : '1px solid #222',
                    borderRadius: '4px',
                    cursor: 'grab',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#444', fontSize: '14px', cursor: 'grab' }}>☰</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: col.isActive ? '#fff' : '#666' }}>{col.name}</h4>
                      <span style={{ fontSize: '9px', color: '#666' }}>/{col.slug} • {col._count?.products || 0} items</span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: col.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: col.isActive ? '#22c55e' : '#ef4444'
                  }}>
                    {col.isActive ? 'LIVE' : 'HIDDEN'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Collection Detail & Product Picker */}
        <div>
          {loadingDetail ? (
            <div style={{ background: '#111', border: '1px solid #222', padding: '50px', borderRadius: '4px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
              FETCHING DETAILS FOR SELECTED CURATION...
            </div>
          ) : !editingCollection ? (
            <div style={{ background: '#111', border: '1px solid #222', padding: '50px', borderRadius: '4px', textAlign: 'center', color: '#555', fontSize: '12px' }}>
              SELECT A CURATION FROM THE Display LIST ON THE LEFT TO MODIFY PROPERTIES
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* Properties Form */}
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', color: '#C9A84C', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                    COLLECTION PROPERTIES
                  </h3>
                  <button
                    onClick={() => handleDeleteCollection(editingCollection.id)}
                    style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    Delete Collection
                  </button>
                </div>

                <form onSubmit={handleUpdateCollection}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Curation Name</label>
                      <input
                        type="text"
                        value={editingCollection.name}
                        onChange={(e) => setEditingCollection({ ...editingCollection, name: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Slug (URL slug)</label>
                      <input
                        type="text"
                        value={editingCollection.slug}
                        onChange={(e) => setEditingCollection({ ...editingCollection, slug: e.target.value.toLowerCase().trim() })}
                        style={{ width: '100%', padding: '10px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Description</label>
                    <textarea
                      value={editingCollection.description}
                      onChange={(e) => setEditingCollection({ ...editingCollection, description: e.target.value })}
                      placeholder="Enter brief description of curation (shown on storefront)..."
                      style={{ width: '100%', height: '70px', padding: '10px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', resize: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '25px', alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Banner Image URL</label>
                      <input
                        type="text"
                        value={editingCollection.bannerImageUrl}
                        onChange={(e) => setEditingCollection({ ...editingCollection, bannerImageUrl: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0a0a0a', padding: '12px', border: '1px solid #222', borderRadius: '4px', marginTop: '16px' }}>
                      <input
                        type="checkbox"
                        id="editColActive"
                        checked={editingCollection.isActive}
                        onChange={(e) => setEditingCollection({ ...editingCollection, isActive: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#C9A84C', cursor: 'pointer' }}
                      />
                      <label htmlFor="editColActive" style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: editingCollection.isActive ? '#C9A84C' : '#666', cursor: 'pointer' }}>
                        Active Curation
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={colSubmitting}
                    style={{ padding: '10px 24px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer' }}
                  >
                    {colSubmitting ? 'UPDATING...' : 'Update Properties'}
                  </button>
                </form>
              </div>

              {/* Products in Collection Manager */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                {/* Left Curation Drawer: drag reorder products */}
                <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '25px' }}>
                  <h3 style={{ fontSize: '12px', color: '#C9A84C', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '15px', letterSpacing: '0.5px' }}>
                    📦 Reorder Products Inside ({colProducts.length})
                  </h3>

                  {colProducts.length === 0 ? (
                    <div style={{ color: '#666', fontSize: '11px', padding: '40px 0', textAlign: 'center', border: '1px dashed #222' }}>
                      NO PRODUCTS ARE ASSIGNED TO THIS CURATION
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
                      {colProducts.map((cp, idx) => (
                        <div
                          key={cp.productId}
                          draggable
                          onDragStart={(e) => handleDragStartProd(e, idx)}
                          onDragOver={handleDragOverProd}
                          onDrop={(e) => handleDropProd(e, idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#0a0a0a',
                            border: '1px solid #222',
                            borderRadius: '4px',
                            cursor: 'grab',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#444', fontSize: '12px' }}>☰</span>
                            <span style={{ fontWeight: 'bold', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cp.product?.displayName}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleRemoveProduct(cp.productId)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                            title="Remove from Curation"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Picker: Add products search box */}
                <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '25px' }}>
                  <h3 style={{ fontSize: '12px', color: '#C9A84C', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '15px', letterSpacing: '0.5px' }}>
                    🔍 Search & Add Products
                  </h3>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by product name..."
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', marginBottom: '15px' }}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '330px', overflowY: 'auto' }}>
                    {filteredCatalog.length === 0 ? (
                      <div style={{ color: '#555', fontSize: '11px', padding: '20px 0', textAlign: 'center' }}>
                        {searchQuery ? 'NO CREATIONS MATCH SEARCH' : 'TYPE PRODUCT NAME TO BEGIN SEARCH'}
                      </div>
                    ) : (
                      filteredCatalog.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#0a0a0a',
                            border: '1px solid #222',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold' }}>{p.displayName}</span>
                            <span style={{ fontSize: '9px', color: '#666' }}>₹{p.priceINR.toLocaleString('en-IN')} • {p.status}</span>
                          </div>
                          
                          <button
                            onClick={() => handleAddProduct(p.id)}
                            style={{
                              background: '#C9A84C',
                              color: '#000',
                              border: 'none',
                              padding: '3px 8px',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '10px'
                            }}
                          >
                            + ADD
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>

      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '4px',
            width: '500px',
            padding: '30px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#C9A84C', fontSize: '15px', letterSpacing: '1px', borderBottom: '1px solid #222', paddingBottom: '10px', textTransform: 'uppercase' }}>
              Create New curated Curation
            </h3>

            {createError && (
              <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '11px', borderRadius: '2px', marginBottom: '20px' }}>
                {createError.toUpperCase()}
              </div>
            )}

            <form onSubmit={handleCreateCollection} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Curation Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                  placeholder="e.g. Bridal Masterpieces"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>URL Slug</label>
                <input
                  type="text"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().trim() })}
                  placeholder="e.g. bridal-masterpieces"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Shown as tagline on collection view..."
                  style={{ width: '100%', height: '60px', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', resize: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Banner Image URL</label>
                <input
                  type="text"
                  value={createForm.bannerImageUrl}
                  onChange={(e) => setCreateForm({ ...createForm, bannerImageUrl: e.target.value })}
                  placeholder="Optional relative/absolute image path"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <input
                  type="checkbox"
                  id="createColActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#C9A84C', cursor: 'pointer' }}
                />
                <label htmlFor="createColActive" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', cursor: 'pointer' }}>Set Live Immediately</label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', background: 'none', border: '1px solid #333', color: '#aaa', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={colSubmitting}
                  style={{ padding: '8px 18px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  {colSubmitting ? 'CREATING...' : 'Create Curation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
