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
    <div className="container">
      {/* Header */}
      <div className="app-header">
        <h1 className="app-title">J&T</h1>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <Link href="/database" className="btn-primary">
            <i className="fas fa-database"></i> จัดการ DATABASE
          </Link>
          <Link href="/add-address" className="btn-secondary">
            <i className="fas fa-plus-circle"></i> เพิ่มที่อยู่
          </Link>
          <Link href="/import" className="btn-secondary">
            <i className="fas fa-file-upload"></i> นำเข้า CSV
          </Link>
          <Link href="/sort-csv" className="btn-secondary">
  <i className="fas fa-sort"></i> จัดลำดับ CSV
</Link>
          <Link href="/scan" className="btn-secondary">
  <i className="fas fa-sort"></i> SCAN
</Link>

        </div>
      </div>

      {/* Area Selection */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="fas fa-map-marked-alt" style={{ color: 'var(--primary)' }}></i>
          เลือกพื้นที่จัดส่ง
        </h2>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr', marginBottom: '0' }}>
          <div>
            <label className="form-label">
              <i className="fas fa-building"></i> ตำบล
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
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">
              <i className="fas fa-home"></i> หมู่
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
                  <option key={village} value={village}>{village}</option>
                ))}
            </select>
          </div>
        </div>
      </div>



      {/* Google Maps Button */}
      {filteredParcels.some((p) => p.latitude && p.longitude) && (
        <button onClick={openRoute} className="btn-primary" style={{ width: '100%', marginBottom: '1.5rem' }}>
          <i className="fas fa-map-marked-alt"></i>
          ดูเส้นทางใน GOOGLE MAPS
          {searchQuery && filteredParcels.length !== parcels.length && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>
              ({filteredParcels.filter(p => p.latitude && p.longitude).length} ที่อยู่)
            </span>
          )}
        </button>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon primary">
            <i className="fas fa-truck"></i>
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>พัสดุบนรถ</p>
            <h3 style={{ fontSize: '2rem', fontWeight: '900' }}>{stats.onTruck}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon secondary">
            <i className="fas fa-box"></i>
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>ที่อยู่ทั้งหมด</p>
            <h3 style={{ fontSize: '2rem', fontWeight: '900' }}>{stats.total}</h3>
          </div>
        </div>
      </div>

            {/* Search Bar - ใต้ dropdown */}
      {parcels.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.75rem' }}>
            <i className="fas fa-search"></i> ค้นหาที่อยู่
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="พิมพ์ที่อยู่เพื่อค้นหา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingRight: searchQuery ? '3rem' : '1rem' }}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
          {searchQuery && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              พบ {filteredParcels.length} จาก {parcels.length} รายการ
            </p>
          )}
        </div>
      )}

      {/* Parcel List */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="fas fa-list" style={{ color: 'var(--primary)' }}></i>
          รายการพัสดุ
          {searchQuery && (
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              ค้นหา: "{searchQuery}"
            </span>
          )}
        </h2>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
            <div className="spinner"></div>
            <p style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>กำลังโหลด...</p>
          </div>
        ) : filteredParcels.length === 0 && parcels.length > 0 ? (
          <div className="empty-state">
            <i className="fas fa-search"></i>
            <h3>ไม่พบผลการค้นหา</h3>
            <p style={{ marginBottom: '1.5rem' }}>ไม่พบที่อยู่ที่ตรงกับ "{searchQuery}"</p>
            <button onClick={clearSearch} className="btn-primary">
              <i className="fas fa-times"></i>
              ล้างการค้นหา
            </button>
          </div>
        ) : filteredParcels.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-box-open"></i>
            <h3>ไม่มีข้อมูลพัสดุในพื้นที่นี้</h3>
            <p>เลือกพื้นที่หรือเพิ่มที่อยู่ใหม่</p>
          </div>
        ) : (
          <div>
            {/* บนรถแล้ว */}
            {filteredParcels.filter(p => p.on_truck).length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>
                    <i className="fas fa-check-circle"></i> บนรถแล้ว
                  </h3>
                  <span className="badge badge-primary">
                    {filteredParcels.filter(p => p.on_truck).length}
                  </span>
                </div>
                {filteredParcels.filter(p => p.on_truck).map((parcel, index) => (
                  <ParcelItem 
                    key={parcel.id} 
                    parcel={parcel} 
                    onUpdate={handleUpdateParcel}
                    displayNumber={index + 1}
                  />
                ))}
              </>
            )}

            {/* รอจัดส่ง */}
            {filteredParcels.filter(p => !p.on_truck).length > 0 && (
              <>
                <div style={{ marginTop: filteredParcels.filter(p => p.on_truck).length > 0 ? '2rem' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      <i className="fas fa-clock"></i> รอจัดส่ง
                    </h3>
                    <span className="badge badge-secondary">
                      {filteredParcels.filter(p => !p.on_truck).length}
                    </span>
                  </div>
                  {filteredParcels.filter(p => !p.on_truck).map((parcel, index) => (
                    <ParcelItem 
                      key={parcel.id} 
                      parcel={parcel} 
                      onUpdate={handleUpdateParcel}
                      displayNumber={filteredParcels.filter(p => p.on_truck).length + index + 1}
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
