'use client';

import { useState, useEffect } from 'react';
import { Parcel } from '@/lib/supabase';
import DatabaseTable from '@/components/DatabaseTable';
import Link from 'next/link';

export default function DatabaseManager() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ subDistrict: '', village: '' });

  useEffect(() => {
    fetchParcels();
  }, []);

  const fetchParcels = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/parcels');
      const data = await response.json();
      setParcels(data);
    } catch (error) {
      console.error('Error fetching parcels:', error);
    }
    setLoading(false);
  };

  const filteredParcels = parcels.filter(p => {
    if (filter.subDistrict && p.sub_district !== filter.subDistrict) return false;
    if (filter.village && p.village !== filter.village) return false;
    return true;
  });

  const uniqueSubDistricts = [...new Set(parcels.map(p => p.sub_district))];
  const uniqueVillages = filter.subDistrict
    ? [...new Set(parcels.filter(p => p.sub_district === filter.subDistrict).map(p => p.village))]
    : [];

  return (
    <div className="container mx-auto min-h-screen py-6">
      {/* Header */}
      <div className="app-header mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="app-title">Database Manager</h1>
            <p className="app-subtitle">จัดการข้อมูลพัสดุทั้งหมดในระบบ</p>
          </div>
          <Link href="/" className="btn-secondary">
            <i className="fas fa-arrow-left"></i> กลับหน้าหลัก
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon primary">
            <i className="fas fa-database"></i>
          </div>
          <p className="text-text-secondary text-sm mb-1">รายการทั้งหมด</p>
          <p className="text-3xl font-bold">{parcels.length}</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon secondary">
            <i className="fas fa-truck-fast"></i>
          </div>
          <p className="text-text-secondary text-sm mb-1">พัสดุบนรถ</p>
          <p className="text-3xl font-bold">
            {parcels.filter(p => p.on_truck).reduce((sum, p) => sum + p.parcel_count, 0)}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-icon secondary">
            <i className="fas fa-location-dot"></i>
          </div>
          <p className="text-text-secondary text-sm mb-1">มี GPS</p>
          <p className="text-3xl font-bold">
            {parcels.filter(p => p.latitude && p.longitude).length}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-icon secondary">
            <i className="fas fa-map-marked-alt"></i>
          </div>
          <p className="text-text-secondary text-sm mb-1">พื้นที่</p>
          <p className="text-3xl font-bold">{uniqueSubDistricts.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">
              <i className="fas fa-filter mr-2"></i>กรองตำบล
            </label>
            <select
              className="input-field"
              value={filter.subDistrict}
              onChange={(e) => setFilter({ subDistrict: e.target.value, village: '' })}
            >
              <option value="">ทั้งหมด</option>
              {uniqueSubDistricts.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">
              <i className="fas fa-filter mr-2"></i>กรองหมู่
            </label>
            <select
              className="input-field"
              value={filter.village}
              onChange={(e) => setFilter({ ...filter, village: e.target.value })}
              disabled={!filter.subDistrict}
            >
              <option value="">ทั้งหมด</option>
              {uniqueVillages.map(village => (
                <option key={village} value={village}>{village}</option>
              ))}
            </select>
          </div>
          <div>
            <button onClick={fetchParcels} className="btn-secondary w-full">
              <i className="fas fa-sync-alt mr-2"></i> รีเฟรช
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20">
          <div className="spinner"></div>
          <p className="mt-4 text-text-secondary">กำลังโหลด...</p>
        </div>
      ) : (
        <DatabaseTable
          parcels={filteredParcels}
          onUpdate={fetchParcels}
        />
      )}
    </div>
  );
}
