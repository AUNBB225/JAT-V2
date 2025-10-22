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
  const [filteredParcels, setFilteredParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
          const sortedData = data.sort((a: Parcel, b: Parcel) => {
            if (a.on_truck === b.on_truck) {
              return (a.display_order || 0) - (b.display_order || 0);
            }
            return a.on_truck ? -1 : 1;
          });
          setParcels(sortedData);
          setFilteredParcels(sortedData);
          setLoading(false);
        })
        .catch(() => {
          setParcels([]);
          setFilteredParcels([]);
          setLoading(false);
        });
    } else {
      setParcels([]);
      setFilteredParcels([]);
    }
  }, [selectedSubDistrict, selectedVillage]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredParcels(parcels);
    } else {
      const query = searchQuery.toLowerCase().trim();
      const filtered = parcels.filter(parcel => 
        parcel.address.toLowerCase().includes(query)
      );
      setFilteredParcels(filtered);
    }
  }, [searchQuery, parcels]);

  const stats = {
    onTruck: parcels.filter((p) => p.on_truck).reduce((sum, p) => sum + p.parcel_count, 0),
    total: parcels.length,
    filtered: filteredParcels.length,
  };

  const openRoute = () => {
    const parcelsWithGPS = filteredParcels.filter((p) => p.latitude && p.longitude);
    if (parcelsWithGPS.length === 0) {
      alert('ไม่มีพิกัด GPS ในรายการที่กรอง');
      return;
    }

    const coordinates = parcelsWithGPS.map((p) => `${p.latitude},${p.longitude}`);
    const url = `https://www.google.com/maps/dir/${coordinates.join('/')}/`;
    window.open(url, '_blank');
  };

  const handleUpdateParcel = (updated: Parcel) => {
    const newParcels = parcels.map((p) => (p.id === updated.id ? updated : p));
    
    const sortedParcels = newParcels.sort((a, b) => {
      if (a.on_truck === b.on_truck) {
        return (a.display_order || 0) - (b.display_order || 0);
      }
      return a.on_truck ? -1 : 1;
    });
    
    setParcels(sortedParcels);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="container mx-auto min-h-screen py-6 px-4">
      {/* Header */}
      <div className="app-header mb-6">
        <div className="text-center">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center netflix-gradient shadow-lg">
              <span className="text-white font-bold text-2xl"></span>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold app-title mb-0">ระบบติดตามพัสดุ</h1>
              <p className="text-sm app-subtitle"></p>
            </div>
          </div>
          
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/database" className="btn-primary">
              <i className="fas fa-database"></i> จัดการ DATABASE
            </Link>
            <Link href="/add-address" className="btn-secondary">
              <i className="fas fa-plus"></i> เพิ่มที่อยู่
            </Link>
            <Link href="/import" className="btn-secondary">
              <i className="fas fa-file-import"></i> นำเข้า CSV
            </Link>
          </div>
        </div>
      </div>

      {/* Area Selection */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <i className="fas fa-location-dot" style={{ color: 'var(--primary)' }}></i>
          เลือกพื้นที่จัดส่ง
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-text-secondary">
              <i className="fas fa-city mr-2"></i>ตำบล
            </label>
            <select
              className="input-field"
              value={selectedSubDistrict}
              onChange={(e) => {
                setSelectedSubDistrict(e.target.value);
                setSelectedVillage('');
                setSearchQuery('');
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
            <label className="block text-sm font-semibold mb-2 text-text-secondary">
              <i className="fas fa-house-user mr-2"></i>หมู่
            </label>
            <select
              className="input-field"
              value={selectedVillage}
              onChange={(e) => {
                setSelectedVillage(e.target.value);
                setSearchQuery('');
              }}
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

        {/* Search Bar - ใต้ dropdown */}
        {parcels.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-text-secondary">
              <i className="fas fa-search mr-2"></i>ค้นหาที่อยู่
            </label>
            <div className="relative">
              <input
                type="text"
                className="input-field"
                placeholder="ค้นหาที่อยู่... (เช่น 50/4, ก๊วยจั๊บ)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingRight: searchQuery ? '3rem' : '1rem' }}
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}
                  type="button"
                >
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-text-secondary text-sm mt-2">
                <i className="fas fa-filter mr-2 text-primary"></i>
                พบ <strong className="text-primary">{filteredParcels.length}</strong> จาก {parcels.length} รายการ
              </p>
            )}
          </div>
        )}

        {/* Google Maps Button */}
        {filteredParcels.some((p) => p.latitude && p.longitude) && (
          <button onClick={openRoute} className="btn-primary w-full">
            <i className="fas fa-route mr-2"></i>
            ดูเส้นทางใน GOOGLE MAPS
            {searchQuery && filteredParcels.length !== parcels.length && (
              <span className="ml-2 opacity-75">
                ({filteredParcels.filter(p => p.latitude && p.longitude).length} ที่อยู่)
              </span>
            )}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon primary">
            <i className="fas fa-truck-fast"></i>
          </div>
          <p className="text-xs mb-1 text-text-secondary">พัสดุบนรถ</p>
          <p className="text-3xl font-bold text-primary">{stats.onTruck}</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon secondary">
            <i className="fas fa-map-location-dot"></i>
          </div>
          <p className="text-xs mb-1 text-text-secondary">ที่อยู่ทั้งหมด</p>
          <p className="text-3xl font-bold text-text-primary">{stats.total}</p>
        </div>
      </div>

      {/* Parcel List */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
          <i className="fas fa-boxes-stacked text-primary"></i>
          <span>รายการพัสดุ</span>
          {searchQuery && (
            <span className="text-sm font-normal text-text-secondary bg-surface-elevated px-3 py-1 rounded-full">
              ค้นหา: &quot;{searchQuery}&quot;
            </span>
          )}
        </h2>
        
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 glass-card rounded-xl">
            <div className="spinner"></div>
            <p className="mt-4 text-text-secondary">กำลังโหลด...</p>
          </div>
        ) : filteredParcels.length === 0 && parcels.length > 0 ? (
          <div className="empty-state">
            <i className="fas fa-search"></i>
            <h3>ไม่พบผลการค้นหา</h3>
            <p>ไม่พบที่อยู่ที่ตรงกับ &quot;{searchQuery}&quot;</p>
            <button onClick={clearSearch} className="btn-secondary mt-4">
              <i className="fas fa-times mr-2"></i>ล้างการค้นหา
            </button>
          </div>
        ) : filteredParcels.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-box-open"></i>
            <h3>ไม่มีข้อมูลพัสดุในพื้นที่นี้</h3>
            <p>เลือกพื้นที่หรือเพิ่มที่อยู่ใหม่</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredParcels.filter(p => p.on_truck).length > 0 && (
              <>
                <div className="parcel-section-header">
                  <i className="fas fa-truck-fast text-primary text-xl"></i>
                  <h3>บนรถแล้ว</h3>
                  <span className="parcel-section-count">
                    {filteredParcels.filter(p => p.on_truck).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredParcels.filter(p => p.on_truck).map((parcel) => (
                    <ParcelItem
                      key={parcel.id}
                      parcel={parcel}
                      onUpdate={handleUpdateParcel}
                    />
                  ))}
                </div>
              </>
            )}
            
            {filteredParcels.filter(p => !p.on_truck).length > 0 && (
              <>
                <div className="parcel-section-header" style={{ borderLeftColor: 'var(--text-secondary)', marginTop: filteredParcels.filter(p => p.on_truck).length > 0 ? '2rem' : '0' }}>
                  <i className="fas fa-clock text-text-secondary text-xl"></i>
                  <h3>รอจัดส่ง</h3>
                  <span className="parcel-section-count" style={{ background: 'var(--divider)' }}>
                    {filteredParcels.filter(p => !p.on_truck).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredParcels.filter(p => !p.on_truck).map((parcel) => (
                    <ParcelItem
                      key={parcel.id}
                      parcel={parcel}
                      onUpdate={handleUpdateParcel}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
