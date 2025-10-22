'use client';

import { useState, useEffect } from 'react';
import { Parcel } from '@/lib/supabase';
import ParcelItem from '@/components/ParcelItem';
import Link from 'next/link';

export default function Home() {
  const [locations, setLocations] = useState<Record<string, string[]>>({});
  const [selectedSubDistrict, setSelectedSubDistrict] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => setLocations(data))
      .catch(() => setLocations({}));
  }, []);

  useEffect(() => {
    if (selectedSubDistrict && selectedVillage) {
      setLoading(true);
      fetch(`/api/parcels?sub_district=${selectedSubDistrict}&village=${selectedVillage}`)
        .then((res) => res.json())
        .then((data) => {
          // เรียงลำดับ: on_truck = true ก่อน, แล้วตาม display_order
          const sortedData = data.sort((a: Parcel, b: Parcel) => {
            if (a.on_truck === b.on_truck) {
              return (a.display_order || 0) - (b.display_order || 0);
            }
            return a.on_truck ? -1 : 1;
          });
          setParcels(sortedData);
          setLoading(false);
        })
        .catch(() => {
          setParcels([]);
          setLoading(false);
        });
    } else {
      setParcels([]);
    }
  }, [selectedSubDistrict, selectedVillage]);

  const stats = {
    onTruck: parcels.filter((p) => p.on_truck).reduce((sum, p) => sum + p.parcel_count, 0),
    total: parcels.length,
  };

  const openRoute = () => {
    const parcelsWithGPS = parcels.filter((p) => p.latitude && p.longitude);
    if (parcelsWithGPS.length === 0) {
      alert('ไม่มีพิกัด GPS ในพื้นที่นี้');
      return;
    }

    const coordinates = parcelsWithGPS.map((p) => `${p.latitude},${p.longitude}`);
    const url = `https://www.google.com/maps/dir/${coordinates.join('/')}/`;
    window.open(url, '_blank');
  };

  const handleUpdateParcel = (updated: Parcel) => {
    const newParcels = parcels.map((p) => (p.id === updated.id ? updated : p));
    
    // เรียงลำดับใหม่: on_truck = true ก่อน
    const sortedParcels = newParcels.sort((a, b) => {
      if (a.on_truck === b.on_truck) {
        return (a.display_order || 0) - (b.display_order || 0);
      }
      return a.on_truck ? -1 : 1;
    });
    
    setParcels(sortedParcels);
  };

  return (
    <div className="container mx-auto min-h-screen py-6">
      <div className="app-header mb-6">
        <div className="text-center">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center netflix-gradient">
              <span className="text-white font-bold text-xl"></span>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold app-title mb-0">ระบบติดตามพัสดุ</h1>
              <p className="text-sm app-subtitle"></p>
            </div>
          </div>
          
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/database" className="btn-primary">
              <i className="fas fa-database"></i> จัดการ Database
            </Link>
            <Link href="/add-address" className="btn-secondary">
              <i className="fas fa-plus"></i> เพิ่มที่อยู่
            </Link>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <i className="fas fa-location-dot" style={{ color: 'var(--primary)' }}></i>
          เลือกพื้นที่จัดส่ง
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              <i className="fas fa-city mr-2"></i>ตำบล
            </label>
            <select
              className="input-field"
              value={selectedSubDistrict}
              onChange={(e) => {
                setSelectedSubDistrict(e.target.value);
                setSelectedVillage('');
              }}
            >
              <option value="">เลือกตำบล</option>
              {Object.keys(locations).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              <i className="fas fa-house-user mr-2"></i>หมู่
            </label>
            <select
              className="input-field"
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={!selectedSubDistrict}
            >
              <option value="">เลือกหมู่</option>
              {selectedSubDistrict &&
                locations[selectedSubDistrict]?.map((village) => (
                  <option key={village} value={village}>
                    {village}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {parcels.some((p) => p.latitude && p.longitude) && (
          <button onClick={openRoute} className="btn-primary w-full">
            <i className="fas fa-route"></i> ดูเส้นทางใน Google Maps
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon primary">
            <i className="fas fa-truck-fast"></i>
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>พัสดุบนรถ</p>
          <p className="text-3xl font-bold">{stats.onTruck}</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon secondary">
            <i className="fas fa-map-location-dot"></i>
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>ที่อยู่ทั้งหมด</p>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <i className="fas fa-boxes-stacked" style={{ color: 'var(--primary)' }}></i>
          รายการพัสดุ
        </h2>
        
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 glass-card rounded-xl">
            <div className="spinner"></div>
            <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>กำลังโหลด...</p>
          </div>
        ) : parcels.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-box-open"></i>
            <h3>ไม่มีข้อมูลพัสดุในพื้นที่นี้</h3>
            <p>เลือกพื้นที่หรือเพิ่มที่อยู่ใหม่</p>
          </div>
        ) : (
          <div className="space-y-3">
            {parcels.filter(p => p.on_truck).length > 0 && (
              <>
                <div className="parcel-section-header">
                  <i className="fas fa-truck-fast text-primary text-xl"></i>
                  <h3>บนรถแล้ว</h3>
                  <span className="parcel-section-count">
                    {parcels.filter(p => p.on_truck).length}
                  </span>
                </div>
                {parcels.filter(p => p.on_truck).map((parcel) => (
                  <ParcelItem
                    key={parcel.id}
                    parcel={parcel}
                    onUpdate={handleUpdateParcel}
                  />
                ))}
              </>
            )}
            
            {parcels.filter(p => !p.on_truck).length > 0 && (
              <>
                <div className="parcel-section-header" style={{ borderLeftColor: 'var(--text-secondary)' }}>
                  <i className="fas fa-clock text-text-secondary text-xl"></i>
                  <h3>รอจัดส่ง</h3>
                  <span className="parcel-section-count" style={{ background: 'var(--divider)' }}>
                    {parcels.filter(p => !p.on_truck).length}
                  </span>
                </div>
                {parcels.filter(p => !p.on_truck).map((parcel) => (
                  <ParcelItem
                    key={parcel.id}
                    parcel={parcel}
                    onUpdate={handleUpdateParcel}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
