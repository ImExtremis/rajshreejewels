'use client';

import React, { useState, useEffect } from 'react';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    activeListings: number;
    soldCount: number;
    sellThroughRate: number;
  };
  salesTimeline: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    revenue: number;
  }>;
  topProductViews: Array<{
    productId: string;
    name: string;
    price: number;
    views: number;
  }>;
}

export default function AnalyticsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredTimelineIdx, setHoveredTimelineIdx] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      fetchAnalytics(savedToken);
    }
  }, []);

  const fetchAnalytics = async (authToken: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/analytics/overview`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to load analytics dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#666', padding: '50px', textAlign: 'center', fontSize: '12px' }}>
        GATHERING HISTORIC INVENTORY & REVENUE INDICATORS...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#ef4444', padding: '50px', textAlign: 'center', fontSize: '12px' }}>
        FAILED TO INGEST STORE ANALYTICAL METRICS
      </div>
    );
  }

  // Helper values for drawing Custom SVG Revenue Area Chart
  const timeline = data.salesTimeline || [];
  const maxRevenue = Math.max(...timeline.map(t => t.revenue), 1000);
  const chartHeight = 220;
  const chartWidth = 700;
  const paddingX = 40;
  const paddingY = 20;

  // Generate SVG coordinates for dynamic paths
  const points = timeline.map((t, idx) => {
    const x = paddingX + (idx / (timeline.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (t.revenue / maxRevenue) * (chartHeight - paddingY * 2);
    return { x, y, ...t };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : '';

  // Category breakdown helpers
  const categories = data.categoryBreakdown || [];
  const maxCategoryRevenue = Math.max(...categories.map(c => c.revenue), 1);

  return (
    <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#e0e0e0', padding: '10px' }}>
      <div style={{ borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '30px' }}>
        <h2 style={{ color: '#C9A84C', fontSize: '22px', letterSpacing: '2px', fontWeight: 'bold', margin: 0, fontFamily: 'Cinzel, Georgia, serif' }}>STORE INTELLIGENCE & PERFORMANCE</h2>
        <p style={{ fontSize: '10px', color: '#666', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Real-time unique client metrics, revenue, and product velocity charts</p>
      </div>

      {/* Grid Highlights Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        
        <div style={{ background: '#111', border: '1px solid #222', padding: '20px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
          <span style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Revenue (All-Time)</span>
          <h3 style={{ margin: '8px 0 0 0', fontSize: '22px', fontWeight: 'bold', color: '#C9A84C' }}>
            ₹{data.summary.totalRevenue.toLocaleString('en-IN')}
          </h3>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '40px', height: '40px', background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)' }}></div>
        </div>

        <div style={{ background: '#111', border: '1px solid #222', padding: '20px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
          <span style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Masterpieces</span>
          <h3 style={{ margin: '8px 0 0 0', fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>
            {data.summary.activeListings} <span style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>pieces</span>
          </h3>
        </div>

        <div style={{ background: '#111', border: '1px solid #222', padding: '20px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
          <span style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jewelleries Sold Out</span>
          <h3 style={{ margin: '8px 0 0 0', fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>
            {data.summary.soldCount} <span style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>sold</span>
          </h3>
        </div>

        <div style={{ background: '#111', border: '1px solid #222', padding: '20px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
          <span style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sell-Through Rate</span>
          <h3 style={{ margin: '8px 0 0 0', fontSize: '22px', fontWeight: 'bold', color: '#22c55e' }}>
            {data.summary.sellThroughRate}%
          </h3>
          <div style={{ height: '3px', width: '100%', background: '#222', position: 'absolute', bottom: 0, left: 0 }}>
            <div style={{ height: '100%', width: `${data.summary.sellThroughRate}%`, background: '#22c55e', transition: 'width 1s ease' }}></div>
          </div>
        </div>

      </div>

      {/* Main Charts area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px', marginBottom: '30px' }}>
        
        {/* SVG Revenue Line Graph */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '25px' }}>
          <h3 style={{ fontSize: '13px', color: '#C9A84C', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '20px', letterSpacing: '0.5px' }}>
            📈 Rolling 30-Day Revenue Trend (₹)
          </h3>

          <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
            <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="#1f1f1f" strokeDasharray="3 3" />
              <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="#1f1f1f" strokeDasharray="3 3" />
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#222" />

              {/* Y Axis Guides */}
              <text x={paddingX - 10} y={paddingY + 4} fill="#555" fontSize="9" textAnchor="end">₹{(maxRevenue / 1000).toFixed(0)}k</text>
              <text x={paddingX - 10} y={chartHeight / 2 + 4} fill="#555" fontSize="9" textAnchor="end">₹{(maxRevenue / 2000).toFixed(0)}k</text>
              <text x={paddingX - 10} y={chartHeight - paddingY + 4} fill="#555" fontSize="9" textAnchor="end">₹0</text>

              {/* Area & Line */}
              {points.length > 0 && (
                <>
                  <path d={areaPath} fill="url(#chartGrad)" />
                  <path d={linePath} fill="none" stroke="#C9A84C" strokeWidth="2.5" />
                </>
              )}

              {/* Data points & Interaction dots */}
              {points.map((p, idx) => (
                <g key={idx}>
                  {idx % 5 === 0 && (
                    <text x={p.x} y={chartHeight - 4} fill="#555" fontSize="8" textAnchor="middle">{p.date}</text>
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredTimelineIdx === idx ? 6 : 3.5}
                    fill={hoveredTimelineIdx === idx ? '#fff' : '#C9A84C'}
                    stroke="#111"
                    strokeWidth="1.5"
                    style={{ transition: 'all 0.15s', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredTimelineIdx(idx)}
                    onMouseLeave={() => setHoveredTimelineIdx(null)}
                  />
                </g>
              ))}
            </svg>

            {/* Interactive Tooltip HUD overlay */}
            {hoveredTimelineIdx !== null && points[hoveredTimelineIdx] && (
              <div style={{
                position: 'absolute',
                top: '40px',
                left: `${(hoveredTimelineIdx / (timeline.length - 1)) * 90}%`,
                background: '#0a0a0a',
                border: '1px solid #C9A84C',
                padding: '10px 14px',
                borderRadius: '4px',
                zIndex: 100,
                fontSize: '11px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.6)'
              }}>
                <span style={{ color: '#666', fontSize: '9px', textTransform: 'uppercase', display: 'block' }}>Date: {points[hoveredTimelineIdx].date}</span>
                <span style={{ fontWeight: 'bold', color: '#C9A84C', display: 'block', marginTop: '3px' }}>Sales: ₹{points[hoveredTimelineIdx].revenue.toLocaleString('en-IN')}</span>
                <span style={{ color: '#aaa', display: 'block', marginTop: '2px' }}>Orders: {points[hoveredTimelineIdx].orders}</span>
              </div>
            )}
          </div>
        </div>

        {/* Custom Category Breakdown Bar Chart */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '25px' }}>
          <h3 style={{ fontSize: '13px', color: '#C9A84C', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '20px', letterSpacing: '0.5px' }}>
            📊 Category Revenue Breakdowns
          </h3>

          {categories.length === 0 ? (
            <div style={{ color: '#666', fontSize: '11px', padding: '40px 0', textAlign: 'center' }}>NO TRANSACTION LOGS AVAILABLE FOR SEGMENTATION</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {categories.map((c) => {
                const widthPct = Math.max(10, Math.round((c.revenue / maxCategoryRevenue) * 100));
                return (
                  <div key={c.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{c.category}</span>
                      <span style={{ color: '#aaa' }}>
                        ₹{c.revenue.toLocaleString('en-IN')} <span style={{ color: '#444', fontSize: '9px' }}>({c.count} items)</span>
                      </span>
                    </div>
                    <div style={{ height: '8px', width: '100%', background: '#0a0a0a', border: '1px solid #222', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${widthPct}%`, background: 'linear-gradient(90deg, #9E8130 0%, #C9A84C 100%)', borderRadius: '2px' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Top Viewed Products HUD widget */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', padding: '25px' }}>
        <h3 style={{ fontSize: '13px', color: '#C9A84C', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '20px', letterSpacing: '0.5px' }}>
          👀 Top Masterpieces by Client Views (Unique Hits)
        </h3>

        {data.topProductViews.length === 0 ? (
          <div style={{ color: '#666', fontSize: '11px', padding: '20px 0', textAlign: 'center' }}>NO SHOPPERS VISITS LOGGED IN SYSTEM YET</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px' }}>
            {data.topProductViews.map((p, idx) => (
              <div
                key={p.productId}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #222',
                  borderRadius: '4px',
                  padding: '20px',
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  color: '#666',
                  background: '#111',
                  width: '20px',
                  height: '20px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #222'
                }}>
                  #{idx + 1}
                </span>

                <h4 style={{ margin: '15px 0 8px 0', fontSize: '11px', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', height: '32px', lineHeight: '1.4' }}>
                  {p.name}
                </h4>

                <span style={{ display: 'block', fontSize: '10px', color: '#666', margin: '8px 0' }}>₹{p.price.toLocaleString('en-IN')}</span>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)', padding: '4px 10px', borderRadius: '15px' }}>
                  <span style={{ fontSize: '12px' }}>👁️</span>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#C9A84C' }}>{p.views} views</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
