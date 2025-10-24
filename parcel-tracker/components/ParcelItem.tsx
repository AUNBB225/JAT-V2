'use client';

import { useState } from 'react';
import { Parcel } from '@/lib/supabase';

interface ParcelItemProps {
  parcel: Parcel;
  onUpdate: (updated: Parcel) => void;
  displayNumber?: number;
}

export default function ParcelItem({ parcel, onUpdate, displayNumber }: ParcelItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const toggleOnTruck = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/parcels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parcel.id,
          on_truck: !parcel.on_truck,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate(updated);
      }
    } catch (error) {
      console.error('Error updating parcel:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // ฟังก์ชันเพิ่ม/ลดจำนวนชิ้น
  const updateParcelCount = async (newCount: number) => {
    if (newCount < 0) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/parcels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parcel.id,
          parcel_count: newCount,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate(updated);
      }
    } catch (error) {
      console.error('Error updating parcel count:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const openInGoogleMaps = () => {
    if (parcel.latitude && parcel.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${parcel.latitude},${parcel.longitude}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className={`parcel-item ${parcel.on_truck ? 'checked' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        {/* เลขลำดับ */}
        {displayNumber && (
          <div style={{
            minWidth: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: parcel.on_truck 
              ? 'linear-gradient(135deg, var(--primary), var(--accent))' 
              : 'var(--surface-elevated)',
            border: parcel.on_truck ? 'none' : '2px solid var(--divider)',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: '800',
            color: parcel.on_truck ? 'white' : 'var(--text-secondary)',
            flexShrink: 0,
          }}>
            {displayNumber}
          </div>
        )}

        {/* Custom Checkbox */}
        <div
          className={`custom-checkbox ${parcel.on_truck ? 'checked' : ''}`}
          onClick={toggleOnTruck}
          style={{
            opacity: isUpdating ? 0.5 : 1,
            cursor: isUpdating ? 'not-allowed' : 'pointer',
          }}
        >
          {parcel.on_truck && (
            <i className="fas fa-check" style={{ color: 'white', fontSize: '16px', fontWeight: '900' }}></i>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* ที่อยู่ */}
          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ 
              fontSize: '0.95rem', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              lineHeight: '1.5',
              wordBreak: 'break-word',
            }}>
              {parcel.address}
            </p>
          </div>

          {/* รายละเอียดและปุ่มควบคุม */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '0.75rem', 
            alignItems: 'center',
          }}>
            {/* ปุ่มลดจำนวน */}
            <button
              className="count-btn minus"
              onClick={() => updateParcelCount(parcel.parcel_count - 1)}
              disabled={isUpdating || parcel.parcel_count <= 0}
              style={{ opacity: parcel.parcel_count <= 0 ? 0.3 : 1 }}
            >
              <i className="fas fa-minus"></i>
            </button>

            {/* แสดงจำนวน */}
            <div style={{
              minWidth: '60px',
              textAlign: 'center',
              padding: '0.5rem 0.75rem',
              background: 'var(--surface-elevated)',
              borderRadius: '8px',
              border: '2px solid var(--divider)',
            }}>
              <span style={{ 
                fontSize: '1.1rem', 
                fontWeight: '800',
                color: 'var(--text-primary)',
              }}>
                {parcel.parcel_count}
              </span>
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-secondary)',
                marginLeft: '0.25rem'
              }}>
                ชิ้น
              </span>
            </div>

            {/* ปุ่มเพิ่มจำนวน */}
            <button
              className="count-btn plus"
              onClick={() => updateParcelCount(parcel.parcel_count + 1)}
              disabled={isUpdating}
            >
              <i className="fas fa-plus"></i>
            </button>

            {/* GPS Button */}
            {parcel.latitude && parcel.longitude && (
              <button
                onClick={openInGoogleMaps}
                className="gps-btn has-location"
              >
                <i className="fas fa-map-marker-alt"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
