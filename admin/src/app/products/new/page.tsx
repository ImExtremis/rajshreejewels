'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

const CATEGORIES = ['NECKLACE', 'EARRINGS', 'BANGLES', 'BRACELET', 'RING', 'ANKLET', 'MAANG_TIKKA', 'NOSE_PIN', 'PENDANT', 'SET', 'OTHER'];
const METALS = ['GOLD_1GRAM', 'SILVER', 'BRASS', 'COPPER', 'ALLOY', 'NONE'];
const FINISHES = ['GOLD_POLISH', 'SILVER_POLISH', 'ANTIQUE', 'MATTE', 'RHODIUM', 'OXIDISED', 'MEENAKARI', 'KUNDAN', 'NONE'];

interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
}

export default function NewListingPage() {
  const router = useRouter();

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

  // Image Upload State
  const [images, setImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // AI Pipeline States
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState<'idle' | 'uploading' | 'writing' | 'processing' | 'done'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [aiEnhancedProduct, setAiEnhancedProduct] = useState<any>(null);
  const [aiProductCreatedId, setAiProductCreatedId] = useState<string | null>(null);

  // Preview / Edit states (initially pre-populated from standard text/afterwards edited)
  const [previewName, setPreviewName] = useState('');
  const [previewDescription, setPreviewDescription] = useState('');
  const [previewShortDesc, setPreviewShortDesc] = useState('');
  const [previewMetaTitle, setPreviewMetaTitle] = useState('');
  const [previewMetaDescription, setPreviewMetaDescription] = useState('');
  const [previewKeywords, setPreviewKeywords] = useState<string[]>([]);
  const [previewKeywordsStr, setPreviewKeywordsStr] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync real-time updates before AI runs
  useEffect(() => {
    if (!aiEnhancedProduct) {
      setPreviewName(name || 'Exquisite Jewellery Piece');
      setPreviewShortDesc(`Beautiful ${category.toLowerCase().replace('_', ' ')} finished in ${finish.toLowerCase().replace('_', ' ')}.`);
      setPreviewDescription('Real-time preview will be populated with a spectacular, handcrafted SEO product description after you click "Enhance with AI".');
      setPreviewMetaTitle(`${name || 'Jewellery'} | Rajshree Jewels`);
      setPreviewMetaDescription(`Shop premium handcrafted ${category.toLowerCase().replace('_', ' ')} at Rajshree Jewels.`);
      setPreviewKeywords([category, metal, finish].filter(Boolean));
    }
  }, [name, category, metal, finish, aiEnhancedProduct]);

  // Sync keywords array on manual change
  useEffect(() => {
    if (previewKeywordsStr) {
      setPreviewKeywords(previewKeywordsStr.split(',').map(s => s.trim()).filter(Boolean));
    }
  }, [previewKeywordsStr]);

  // Drag and Drop Handling
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
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      const isUnder10MB = file.size <= 10 * 1024 * 1024;
      return isImage && isUnder10MB;
    });

    if (images.length + validFiles.length > 6) {
      setErrorMsg('You can upload a maximum of 6 images.');
      return;
    }

    const newUploaded: UploadedImage[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0
    }));

    setImages(prev => [...prev, ...newUploaded]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(img => img.id !== id);
    });
  };

  // Drag to reorder images
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDropImage = (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    setImages(prev => {
      const next = [...prev];
      const [dragged] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, dragged);
      return next;
    });
  };

  // Save draft without running AI pipeline (UNLISTED status)
  const handleSaveDraft = async () => {
    if (!name || !priceINR) {
      setErrorMsg('Item name and price are required to save a draft.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      
      // 1. Create product record in DB
      const createRes = await fetch(`${BACKEND_URL}/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          category,
          metal,
          finish,
          weightGrams: weightGrams ? parseFloat(weightGrams) : null,
          stoneType: stoneType || null,
          occasion: occasion || null,
          priceINR: parseInt(priceINR, 10),
          originalPriceINR: originalPriceINR ? parseInt(originalPriceINR, 10) : null,
          status: 'UNLISTED'
        })
      });

      if (!createRes.ok) throw new Error('Failed to create draft record in database');
      const product = await createRes.json();

      // 2. Upload images separately if any
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach(img => {
          formData.append('images', img.file);
        });

        const uploadRes = await fetch(`${BACKEND_URL}/admin/products/${product.id}/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Product draft saved, but image uploads failed.');
      }

      setSuccessMsg('✨ Product saved as draft successfully!');
      setTimeout(() => {
        router.push('/products');
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save draft.');
    } finally {
      setLoading(false);
    }
  };

  // Enhance with AI
  const handleEnhanceAI = async () => {
    if (!name || !priceINR || images.length === 0) {
      setErrorMsg('Please enter name, price, and upload at least 1 image before running AI enhancement.');
      return;
    }

    setIsEnhancing(true);
    setEnhanceProgress('uploading');
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('admin_token');
      
      // Build listing payload (Multipart Form)
      const formData = new FormData();
      formData.append('name', name);
      formData.append('category', category);
      formData.append('metal', metal);
      formData.append('finish', finish);
      if (weightGrams) formData.append('weightGrams', weightGrams);
      if (stoneType) formData.append('stoneType', stoneType);
      if (occasion) formData.append('occasion', occasion);
      formData.append('priceINR', priceINR);
      if (originalPriceINR) formData.append('originalPriceINR', originalPriceINR);
      
      // Append images
      images.forEach(img => {
        formData.append('images', img.file);
      });

      const res = await fetch(`${BACKEND_URL}/listing/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'AI enhancement request failed');
      }

      const data = await res.json();
      setJobId(data.jobId);
      setAiProductCreatedId(data.productId);

      // Start polling
      setEnhanceProgress('writing');
      startPollingStatus(data.jobId);

    } catch (err: any) {
      setErrorMsg(err.message || 'AI request failed');
      setIsEnhancing(false);
      setEnhanceProgress('idle');
    }
  };

  // Polling routine
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

        if (!res.ok) return; // Keep polling
        const data = await res.json();

        if (data.status === 'processing') {
          setEnhanceProgress('processing');
        } else if (data.status === 'done') {
          clearInterval(interval);
          setEnhanceProgress('done');
          setIsEnhancing(false);
          
          // Populate states with AI enhanced content
          setAiEnhancedProduct(data.preview);
          setPreviewName(data.preview.displayName || name);
          setPreviewShortDesc(data.preview.shortDesc || '');
          setPreviewDescription(data.preview.description || '');
          setPreviewMetaTitle(data.preview.metaTitle || `${data.preview.displayName} | Rajshree Jewels`);
          setPreviewMetaDescription(data.preview.metaDescription || data.preview.shortDesc || '');
          setPreviewKeywords(data.preview.keywords || []);
          setPreviewKeywordsStr(data.preview.keywords ? data.preview.keywords.join(', ') : '');
          
          setSuccessMsg('✨ AI copy write and image cleanups completed successfully!');
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setErrorMsg(data.error || 'AI process failed.');
          setIsEnhancing(false);
          setEnhanceProgress('idle');
        }
      } catch (err) {
        // Suppress and continue polling
      }
    }, 2000);
  };

  // Publish dynamic creation
  const handlePublishNow = async () => {
    if (!aiProductCreatedId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('admin_token');

      // 1. Save any manually edited copy back to DB first
      const saveRes = await fetch(`${BACKEND_URL}/admin/products/${aiProductCreatedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: previewName,
          shortDesc: previewShortDesc,
          description: previewDescription,
          metaTitle: previewMetaTitle,
          metaDescription: previewMetaDescription,
          keywords: previewKeywords,
        })
      });

      if (!saveRes.ok) throw new Error('Failed to save listing copy overrides');

      // 2. Trigger Publish endpoint (sets AVAILABLE and refreshes lists)
      const pubRes = await fetch(`${BACKEND_URL}/listing/publish/${aiProductCreatedId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: previewName,
          description: previewDescription
        })
      });

      if (!pubRes.ok) throw new Error('Failed to set listing status to AVAILABLE.');

      setSuccessMsg('✨ Exquisite jewellery piece published and live on storefront!');
      setTimeout(() => {
        router.push('/products');
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '22px', borderBottom: '2px solid #C9A84C', paddingBottom: '6px', display: 'inline-block' }}>
            ＋ New Jewellery Listing
          </h2>
          <p style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>CREATE DIGITAL METADATA AND OPTIMISE LUXURY ASSETS</p>
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
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Drag & Drop product images here</div>
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
                      src={img.previewUrl}
                      alt={`Upload ${idx}`}
                      style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', top: '2px', left: '2px', background: 'rgba(0,0,0,0.7)', color: '#C9A84C', fontSize: '8px', padding: '1px 4px', borderRadius: '2px', fontWeight: 'bold' }}>
                      {idx === 0 ? 'PRIMARY' : idx + 1}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
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
                      title="Remove"
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
              <label className="form-label">Item Name</label>
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
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-control">
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Base Metal</label>
                <select value={metal} onChange={(e) => setMetal(e.target.value)} className="form-control">
                  {METALS.map(met => (
                    <option key={met} value={met}>{met.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Polish/Finish</label>
                <select value={finish} onChange={(e) => setFinish(e.target.value)} className="form-control">
                  {FINISHES.map(fin => (
                    <option key={fin} value={fin}>{fin.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginTop: '10px' }}>
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

          {/* Section 3 — Pricing */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#C9A84C', borderBottom: '1px solid #222', paddingBottom: '6px', marginBottom: '16px', letterSpacing: '0.5px' }}>
              Section 3 — Pricing
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
                <span style={{ fontSize: '10px', color: '#555', marginTop: '4px', display: 'block' }}>
                  Shown as strike-through. Leave blank if not discounted.
                </span>
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
                className="btn btn-primary"
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#C9A84C',
                  color: '#111',
                  fontWeight: '700',
                  boxShadow: '0 4px 15px rgba(201, 168, 76, 0.2)'
                }}
              >
                {isEnhancing ? 'Enhancing...' : '✨ Enhance with AI'}
              </button>
              
              {isEnhancing && (
                <div style={{ flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>
                    <span>Progress Tracker</span>
                    <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>
                      {enhanceProgress === 'uploading' && 'Uploading assets...'}
                      {enhanceProgress === 'writing' && 'AI is writing copy...'}
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
                  src={images[0].previewUrl}
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
              <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#2D7A3A', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '10px' }}>
                AVAILABLE
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
                  disabled={!aiEnhancedProduct}
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

                {/* Google mockup rendering */}
                <div style={{ borderTop: '1px solid #222', marginTop: '12px', paddingTop: '12px', fontFamily: 'arial, sans-serif', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: '#202124', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ background: '#f1f3f4', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>💎</span>
                    <span>rajshreejewels.com › shop › {name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'product'}</span>
                  </div>
                  <div style={{ fontSize: '18px', color: '#1a0dab', textDecoration: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                    {previewMetaTitle}
                  </div>
                  <div style={{ fontSize: '12px', color: '#4d5156', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {previewMetaDescription}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Sticky Action Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '240px',
          right: 0,
          background: '#111',
          borderTop: '1px solid #222',
          padding: '16px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 500
        }}
      >
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={loading || isEnhancing}
          className="btn btn-secondary"
          style={{ padding: '12px 24px' }}
        >
          Save as Draft
        </button>

        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            type="button"
            onClick={handleEnhanceAI}
            disabled={isEnhancing || images.length === 0}
            className="btn btn-secondary"
            style={{ padding: '12px 24px', borderColor: '#C9A84C', color: '#C9A84C' }}
          >
            {isEnhancing ? 'Enhancing with AI...' : 'Enhance & Preview'}
          </button>
          
          <button
            type="button"
            onClick={handlePublishNow}
            disabled={loading || !aiProductCreatedId || !aiEnhancedProduct}
            className="btn btn-primary"
            style={{ padding: '12px 28px', backgroundColor: '#C9A84C', color: '#111', fontWeight: 'bold' }}
          >
            {loading ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
