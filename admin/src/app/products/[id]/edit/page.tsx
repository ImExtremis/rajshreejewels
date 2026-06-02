'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

const CATEGORIES = ['NECKLACE', 'EARRINGS', 'BANGLES', 'BRACELET', 'RING', 'ANKLET', 'MAANG_TIKKA', 'NOSE_PIN', 'PENDANT', 'SET', 'OTHER'];
const METALS = ['GOLD_1GRAM', 'SILVER', 'BRASS', 'COPPER', 'ALLOY', 'NONE'];
const FINISHES = ['GOLD_POLISH', 'SILVER_POLISH', 'ANTIQUE', 'MATTE', 'RHODIUM', 'OXIDISED', 'MEENAKARI', 'KUNDAN', 'NONE'];

interface ProductImage {
  id: string;
  url: string;
  urlThumb: string;
  urlMedium: string;
  urlFull: string;
  order: number;
}

interface Product {
  id: string;
  name: string;
  displayName: string;
  description: string;
  shortDesc: string;
  category: string;
  metal: string;
  finish: string;
  weightGrams: number | null;
  stoneType: string | null;
  occasion: string | null;
  priceINR: number;
  originalPriceINR: number | null;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNLISTED';
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
  images: ProductImage[];
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  // Loading product details on mount
  const [initLoading, setInitLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [initialProduct, setInitialProduct] = useState<Product | null>(null);

  // Form fields state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('NECKLACE');
  const [metal, setMetal] = useState('NONE');
  const [finish, setFinish] = useState('NONE');
  const [weightGrams, setWeightGrams] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [occasion, setOccasion] = useState('');
  const [priceINR, setPriceINR] = useState('');
  const [originalPriceINR, setOriginalPriceINR] = useState('');
  const [status, setStatus] = useState<'AVAILABLE' | 'SOLD' | 'UNLISTED'>('UNLISTED');

  // Images state
  const [images, setImages] = useState<ProductImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Preview / Edit states
  const [previewName, setPreviewName] = useState('');
  const [previewDescription, setPreviewDescription] = useState('');
  const [previewShortDesc, setPreviewShortDesc] = useState('');
  const [previewMetaTitle, setPreviewMetaTitle] = useState('');
  const [previewMetaDescription, setPreviewMetaDescription] = useState('');
  const [previewKeywordsStr, setPreviewKeywordsStr] = useState('');

  // AI Pipeline States
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState<'idle' | 'uploading' | 'writing' | 'processing' | 'done'>('idle');

  // Fetch product data on mount
  useEffect(() => {
    if (!productId) return;
    fetchProductDetails();
  }, [productId]);

  const fetchProductDetails = async () => {
    setInitLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/products/id/${productId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Product not found or access denied');
      const data: Product = await res.json();
      setInitialProduct(data);

      // Populate input states
      setName(data.name || '');
      setCategory(data.category || 'NECKLACE');
      setMetal(data.metal || 'NONE');
      setFinish(data.finish || 'NONE');
      setWeightGrams(data.weightGrams !== null ? data.weightGrams.toString() : '');
      setStoneType(data.stoneType || '');
      setOccasion(data.occasion || '');
      setPriceINR(data.priceINR ? data.priceINR.toString() : '');
      setOriginalPriceINR(data.originalPriceINR !== null ? data.originalPriceINR.toString() : '');
      setStatus(data.status === 'RESERVED' ? 'UNLISTED' : data.status);

      // Populate images
      setImages(data.images || []);

      // Populate live preview edit panels
      setPreviewName(data.displayName || data.name || '');
      setPreviewDescription(data.description || '');
      setPreviewShortDesc(data.shortDesc || '');
      setPreviewMetaTitle(data.metaTitle || '');
      setPreviewMetaDescription(data.metaDescription || '');
      setPreviewKeywordsStr(data.keywords ? data.keywords.join(', ') : '');

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load product details.');
    } finally {
      setInitLoading(false);
    }
  };

  // Sync basic info if preview fields are empty or not custom edited yet
  useEffect(() => {
    if (!previewName && name) {
      setPreviewName(name);
    }
    if (!previewShortDesc && category) {
      setPreviewShortDesc(`Beautiful ${category.toLowerCase().replace('_', ' ')} finished in ${finish.toLowerCase().replace('_', ' ')}.`);
    }
  }, [name, category, finish]);

  // Drag and Drop Handling for adding new images
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      uploadNewImages(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadNewImages(Array.from(e.target.files));
    }
  };

  // Direct backend upload for newly selected files
  const uploadNewImages = async (files: File[]) => {
    const validFiles = files.filter(file => {
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      const isUnder10MB = file.size <= 10 * 1024 * 1024;
      return isImage && isUnder10MB;
    });

    if (validFiles.length === 0) return;

    if (images.length + validFiles.length > 6) {
      setErrorMsg('You can upload a maximum of 6 images per product.');
      return;
    }

    setUploadingImages(true);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      validFiles.forEach(file => {
        formData.append('images', file);
      });

      const res = await fetch(`${BACKEND_URL}/admin/products/${productId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload new images');
      }

      const updatedImages = await res.json();
      setImages(updatedImages);
      setSuccessMsg('✨ New images uploaded and optimized successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Image upload failed.');
    } finally {
      setUploadingImages(false);
    }
  };

  // Delete physical/db image
  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image? This action will immediately clean up the files on the server.')) return;

    setErrorMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete image');

      setImages(prev => prev.filter(img => img.id !== imageId));
      setSuccessMsg('Image deleted successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete image');
    }
  };

  // Drag and drop existing images to reorder
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDropImage = async (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const nextImages = [...images];
    const [dragged] = nextImages.splice(sourceIndex, 1);
    nextImages.splice(targetIndex, 0, dragged);

    // Optimistically set order state
    setImages(nextImages);

    // Save back to backend reorder endpoint
    try {
      const token = localStorage.getItem('admin_token');
      const imageIds = nextImages.map(img => img.id);

      const res = await fetch(`${BACKEND_URL}/admin/products/${productId}/images/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ imageOrder: imageIds })
      });

      if (!res.ok) throw new Error('Failed to reorder images on server');
      
      const refreshedImages = await res.json();
      setImages(refreshedImages);
    } catch (err: any) {
      setErrorMsg('Failed to persist image sorting. Reverting...');
      fetchProductDetails(); // Re-fetch to undo
    }
  };

  // Trigger AI enhancement loop (re-enhance)
  const handleEnhanceAI = async () => {
    if (images.length === 0) {
      setErrorMsg('Product must have at least 1 image uploaded before running AI enhancement.');
      return;
    }

    // AI re-enhance requires product status to be UNLISTED. Let's ask the user to confirm if it is currently AVAILABLE
    if (status !== 'UNLISTED') {
      const confirmUnlist = confirm('Re-enhancing requires the product to be set to UNLISTED status. Proceed?');
      if (!confirmUnlist) return;
      
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch(`${BACKEND_URL}/admin/products/${productId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'UNLISTED' })
        });
        if (!res.ok) throw new Error('Failed to change product status to UNLISTED');
        setStatus('UNLISTED');
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to prepare product for enhancement.');
        return;
      }
    }

    setIsEnhancing(true);
    setEnhanceProgress('uploading');
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('admin_token');
      
      // Save current form inputs first so re-enhance has the latest specs
      await fetch(`${BACKEND_URL}/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: name,
          priceINR: parseInt(priceINR, 10),
          originalPriceINR: originalPriceINR ? parseInt(originalPriceINR, 10) : null,
          occasion: occasion || null,
        })
      });

      // Call re-enhance trigger
      const enhanceRes = await fetch(`${BACKEND_URL}/listing/re-enhance/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!enhanceRes.ok) {
        const errData = await enhanceRes.json();
        throw new Error(errData.error || 'Failed to trigger AI enhancement');
      }

      const data = await enhanceRes.json();
      setEnhanceProgress('writing');
      startPollingStatus(data.jobId);

    } catch (err: any) {
      setErrorMsg(err.message || 'AI request failed');
      setIsEnhancing(false);
      setEnhanceProgress('idle');
    }
  };

  // Polling status
  const startPollingStatus = (jobId: string) => {
    const token = localStorage.getItem('admin_token');
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        setErrorMsg('AI enhancement timed out. Please try again.');
        setIsEnhancing(false);
        setEnhanceProgress('idle');
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/listing/status/${jobId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'processing') {
          setEnhanceProgress('processing');
        } else if (data.status === 'done') {
          clearInterval(interval);
          setEnhanceProgress('done');
          setIsEnhancing(false);
          
          // Populate states with AI enhanced content
          setPreviewName(data.preview.displayName || name);
          setPreviewShortDesc(data.preview.shortDesc || '');
          setPreviewDescription(data.preview.description || '');
          setPreviewMetaTitle(data.preview.metaTitle || `${data.preview.displayName} | Rajshree Jewels`);
          setPreviewMetaDescription(data.preview.metaDescription || data.preview.shortDesc || '');
          setPreviewKeywordsStr(data.preview.keywords ? data.preview.keywords.join(', ') : '');
          
          setSuccessMsg('✨ AI copy write and image cleanups completed successfully!');
          setTimeout(() => setSuccessMsg(null), 3000);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setErrorMsg(data.error || 'AI process failed.');
          setIsEnhancing(false);
          setEnhanceProgress('idle');
        }
      } catch (err) {
        // Continue polling
      }
    }, 2000);
  };

  // Save changes back to DB
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !priceINR) {
      setErrorMsg('Item name and price are required.');
      return;
    }

    setInitLoading(true);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('admin_token');

      // 1. Submit PUT update for text details and SEO previews (only if dirty/changed)
      const updatePayload: any = {};
      if (initialProduct) {
        if (previewName !== (initialProduct.displayName || initialProduct.name || '')) {
          updatePayload.displayName = previewName;
        }
        if (previewShortDesc !== (initialProduct.shortDesc || '')) {
          updatePayload.shortDesc = previewShortDesc;
        }
        if (previewDescription !== (initialProduct.description || '')) {
          updatePayload.description = previewDescription;
        }
        const parsedPrice = parseInt(priceINR, 10);
        if (parsedPrice !== initialProduct.priceINR) {
          updatePayload.priceINR = parsedPrice;
        }
        const parsedOrigPrice = originalPriceINR ? parseInt(originalPriceINR, 10) : null;
        if (parsedOrigPrice !== initialProduct.originalPriceINR) {
          updatePayload.originalPriceINR = parsedOrigPrice;
        }
        const finalOccasion = occasion || '';
        const initialOccasion = initialProduct.occasion || '';
        if (finalOccasion !== initialOccasion) {
          updatePayload.occasion = finalOccasion || null;
        }
        const defaultMetaTitle = `${previewName} | Rajshree Jewels`;
        const currentMetaTitle = previewMetaTitle || defaultMetaTitle;
        if (currentMetaTitle !== (initialProduct.metaTitle || '')) {
          updatePayload.metaTitle = currentMetaTitle;
        }
        const currentMetaDesc = previewMetaDescription || previewShortDesc;
        if (currentMetaDesc !== (initialProduct.metaDescription || '')) {
          updatePayload.metaDescription = currentMetaDesc;
        }
        const currentKeywords = previewKeywordsStr ? previewKeywordsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const initialKeywords = initialProduct.keywords || [];
        if (JSON.stringify(currentKeywords) !== JSON.stringify(initialKeywords)) {
          updatePayload.keywords = currentKeywords;
        }
        if (status !== initialProduct.status) {
          updatePayload.status = status;
        }
      } else {
        updatePayload.displayName = previewName;
        updatePayload.shortDesc = previewShortDesc;
        updatePayload.description = previewDescription;
        updatePayload.priceINR = parseInt(priceINR, 10);
        updatePayload.originalPriceINR = originalPriceINR ? parseInt(originalPriceINR, 10) : null;
        updatePayload.occasion = occasion || null;
        updatePayload.metaTitle = previewMetaTitle || `${previewName} | Rajshree Jewels`;
        updatePayload.metaDescription = previewMetaDescription || previewShortDesc;
        updatePayload.keywords = previewKeywordsStr ? previewKeywordsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        updatePayload.status = status;
      }

      if (Object.keys(updatePayload).length > 0) {
        const res = await fetch(`${BACKEND_URL}/admin/products/${productId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatePayload)
        });

        if (!res.ok) throw new Error('Failed to update product details in database');
      }

      // 2. If status was changed, explicitly apply it (for relisting safety / notification triggers)
      if (!initialProduct || status !== initialProduct.status) {
        const statusRes = await fetch(`${BACKEND_URL}/admin/products/${productId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status })
        });

        if (!statusRes.ok) throw new Error('Failed to update product inventory status');
      }

      setSuccessMsg('✨ Exquisite jewellery piece updated successfully!');
      setTimeout(() => {
        router.push('/products');
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save product details.');
      setInitLoading(false);
    }
  };

  if (initLoading && !name) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', color: '#C9A84C', fontWeight: 'bold' }}>
        RETRIEVING STORE INVENTORY METADATA...
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '22px', borderBottom: '2px solid #C9A84C', paddingBottom: '6px', display: 'inline-block' }}>
            ✎ Edit Jewellery Listing
          </h2>
          <p style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>MODIFY IMMUTABLE SPECS AND FINE-TUNE DIGITAL ASSETS</p>
        </div>
        <button onClick={() => router.push('/products')} className="btn btn-secondary">
          ← Back to Inventory
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontSize: '12px' }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontSize: '12px' }}>
          {successMsg}
        </div>
      )}

      {/* Two column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Left Column — Listing Form */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
          
          {/* Section 1 — Photos */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#C9A84C', borderBottom: '1px solid #222', paddingBottom: '6px', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Section 1 — Photos ({images.length}/6)
            </h3>
            
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: dragOver ? '2px dashed #C9A84C' : '2px dashed #222',
                background: dragOver ? 'rgba(201, 168, 76, 0.05)' : '#0d0d0d',
                borderRadius: '6px',
                padding: '30px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '15px'
              }}
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                ref={fileInputRef}
                onChange={handleFileBrowse}
                style={{ display: 'none' }}
              />
              <svg style={{ height: '32px', width: '32px', color: dragOver ? '#C9A84C' : '#555', margin: '0 auto 10px auto' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                {uploadingImages ? 'Uploading assets...' : 'Drag & Drop new images here to append'}
              </div>
              <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>Accepts JPEG, PNG, WebP — up to 10MB each</div>
            </div>

            {/* Thumbnail Grid */}
            {images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropImage(e, idx)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      border: '1px solid #222',
                      borderRadius: '4px',
                      background: '#111',
                      overflow: 'hidden',
                      cursor: 'grab'
                    }}
                  >
                    <img
                      src={img.urlThumb}
                      alt={`Product ${idx}`}
                      style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', top: '2px', left: '2px', background: 'rgba(0,0,0,0.7)', color: '#C9A84C', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', fontWeight: 'bold' }}>
                      {idx === 0 ? 'PRIMARY' : idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }}
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: 'rgba(239, 68, 68, 0.85)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '14px',
                        height: '14px',
                        fontSize: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Remove Image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2 — Item Details */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#C9A84C', borderBottom: '1px solid #222', paddingBottom: '6px', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Section 2 — Item Details
            </h3>
            
            <div className="form-group">
              <label className="form-label">Item Name (Internal reference)</label>
              <input
                type="text"
                placeholder="e.g. Traditional Kundan Peacock Choker"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select value={category} disabled className="form-control" style={{ opacity: 0.6 }}>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Base Metal</label>
                <select value={metal} disabled className="form-control" style={{ opacity: 0.6 }}>
                  {METALS.map(met => (
                    <option key={met} value={met}>{met.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Polish/Finish</label>
                <select value={finish} disabled className="form-control" style={{ opacity: 0.6 }}>
                  {FINISHES.map(fin => (
                    <option key={fin} value={fin}>{fin.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
              * Core item specs (Category, Metal, Finish) are fixed. Re-list or recreate if metal compositions vary.
            </div>

            <div className="form-row" style={{ marginTop: '15px' }}>
              <div className="form-group">
                <label className="form-label">Weight in Grams (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 18.5"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Stones / Details (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Kundan, Ruby glass beads"
                  value={stoneType}
                  onChange={(e) => setStoneType(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Occasion (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Bridal, Festive Wear"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>
          </div>

          {/* Section 3 — Pricing & Listing Status */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#C9A84C', borderBottom: '1px solid #222', paddingBottom: '6px', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Section 3 — Pricing & Status
            </h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Price ₹ (Required)</label>
                <input
                  type="number"
                  placeholder="Selling price in Rupees, e.g. 1499"
                  value={priceINR}
                  onChange={(e) => setPriceINR(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Original Price ₹ (Optional)</label>
                <input
                  type="number"
                  placeholder="Listed strike-through price, e.g. 1999"
                  value={originalPriceINR}
                  onChange={(e) => setOriginalPriceINR(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Listing Visibility</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="form-control">
                  <option value="AVAILABLE">Live on Storefront (AVAILABLE)</option>
                  <option value="UNLISTED">Hidden / Draft (UNLISTED)</option>
                  <option value="SOLD">Sold Out (SOLD)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4 — AI Enhancement */}
          <div>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#C9A84C', borderBottom: '1px solid #222', paddingBottom: '6px', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Section 4 — AI Optimization
            </h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleEnhanceAI}
                disabled={isEnhancing || images.length === 0}
                className="btn btn-gold"
                style={{
                  padding: '12px 24px'
                }}
              >
                {isEnhancing ? 'Enhancing...' : '✨ Re-enhance Copy with AI'}
              </button>
              
              {isEnhancing && (
                <div style={{ flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>
                    <span>Progress Tracker</span>
                    <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>
                      {enhanceProgress === 'uploading' && 'Re-verifying assets...'}
                      {enhanceProgress === 'writing' && 'AI is re-writing luxury copy...'}
                      {enhanceProgress === 'processing' && 'Sharp processing assets...'}
                    </span>
                  </div>
                  <div style={{ height: '4px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        background: '#C9A84C',
                        width:
                          enhanceProgress === 'uploading' ? '25%' :
                          enhanceProgress === 'writing' ? '60%' :
                          enhanceProgress === 'processing' ? '85%' : '100%',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
              * Re-enhancement takes ~10-15s to run standard OpenAI text generation on your core item specifications.
            </div>
          </div>

        </div>

        {/* Right Column — Live Preview */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#fff', borderBottom: '2px solid #C9A84C', paddingBottom: '6px', marginBottom: '16px', letterSpacing: '0.5px', fontWeight: 'bold' }}>
            Live Preview (Real-time)
          </h3>

          <div style={{ background: '#111', border: '1px solid #222', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            
            {/* Visual Header / Carousel */}
            <div style={{ aspectRatio: '1.4', background: '#fff', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {images.length > 0 ? (
                <img
                  src={images[0].urlMedium}
                  alt="Listing preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#aaa', fontFamily: 'sans-serif', padding: '20px' }}>
                  <svg style={{ height: '48px', width: '48px', color: '#888', margin: '0 auto 10px auto' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p style={{ fontSize: '13px', fontWeight: 'bold' }}>Upload photos to see card preview</p>
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: status === 'AVAILABLE' ? '#2D7A3A' : status === 'SOLD' ? '#555' : '#b91c1c',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '3px 8px',
                  borderRadius: '10px'
                }}
              >
                {status}
              </div>
            </div>

            {/* Product description details panel */}
            <div style={{ padding: '20px' }}>
              
              {/* Editable Fields directly in Preview */}
              <div className="form-group">
                <label className="form-label" style={{ color: '#C9A84C' }}>Display Title</label>
                <input
                  type="text"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  className="form-control"
                  style={{ background: '#0a0a0a', border: '1px solid #333', fontSize: '15px', fontWeight: 'bold' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '15px', alignItems: 'baseline', marginBottom: '15px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
                  ₹{priceINR ? parseInt(priceINR, 10).toLocaleString('en-IN') : '0'}
                </span>
                {originalPriceINR && parseInt(originalPriceINR, 10) > (parseInt(priceINR, 10) || 0) && (
                  <span style={{ textDecoration: 'line-through', fontSize: '12px', color: '#666' }}>
                    ₹{parseInt(originalPriceINR, 10).toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              {/* Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                <span style={{ fontSize: '9px', background: '#1c1c1c', border: '1px solid #333', color: '#aaa', padding: '2px 8px', borderRadius: '2px' }}>
                  Category: {category}
                </span>
                <span style={{ fontSize: '9px', background: '#1c1c1c', border: '1px solid #333', color: '#aaa', padding: '2px 8px', borderRadius: '2px' }}>
                  Metal: {metal}
                </span>
                <span style={{ fontSize: '9px', background: '#1c1c1c', border: '1px solid #333', color: '#aaa', padding: '2px 8px', borderRadius: '2px' }}>
                  Finish: {finish}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#C9A84C' }}>Short Card Description (55 chars max)</label>
                <input
                  type="text"
                  maxLength={55}
                  value={previewShortDesc}
                  onChange={(e) => setPreviewShortDesc(e.target.value)}
                  className="form-control"
                  style={{ background: '#0a0a0a', border: '1px solid #333', fontSize: '11px', color: '#888' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#C9A84C' }}>AI Handcrafted Storytelling</label>
                <textarea
                  value={previewDescription}
                  onChange={(e) => setPreviewDescription(e.target.value)}
                  className="form-control"
                  style={{ background: '#0a0a0a', border: '1px solid #333', minHeight: '120px', fontSize: '12px', lineHeight: '1.6' }}
                />
              </div>

              {/* SEO preview */}
              <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '14px', marginTop: '20px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#C9A84C', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Google Search Snippet Preview
                </div>
                
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label">Meta SEO Title</label>
                  <input
                    type="text"
                    value={previewMetaTitle}
                    onChange={(e) => setPreviewMetaTitle(e.target.value)}
                    className="form-control"
                    style={{ background: '#0d0d0d', border: '1px solid #222', fontSize: '11px', padding: '6px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label">Meta SEO Description (155 chars max)</label>
                  <textarea
                    maxLength={155}
                    value={previewMetaDescription}
                    onChange={(e) => setPreviewMetaDescription(e.target.value)}
                    className="form-control"
                    style={{ background: '#0d0d0d', border: '1px solid #222', fontSize: '11px', minHeight: '50px', padding: '6px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">SEO Keywords (Comma-separated)</label>
                  <input
                    type="text"
                    value={previewKeywordsStr}
                    onChange={(e) => setPreviewKeywordsStr(e.target.value)}
                    placeholder="e.g. kundan necklace, gold bangles"
                    className="form-control"
                    style={{ background: '#0d0d0d', border: '1px solid #222', fontSize: '11px', padding: '6px' }}
                  />
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* Sticky footer action bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #222',
          padding: '12px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 900
        }}
      >
        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#666' }}>
          Jewellery ID: <span style={{ color: '#aaa', fontWeight: 'bold' }}>{productId}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            type="button"
            onClick={() => router.push('/products')}
            className="btn btn-secondary"
            style={{ padding: '10px 20px' }}
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSaveProduct}
            className="btn btn-gold"
            style={{
              padding: '10px 30px'
            }}
          >
            Save Listing
          </button>
        </div>
      </div>
    </div>
  );
}
