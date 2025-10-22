'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddAddress() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    sub_district: '',
    village: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [existingSubDistricts, setExistingSubDistricts] = useState<string[]>([]);
  const [existingVillages, setExistingVillages] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => {
        const uniqueSubDistricts = Object.keys(data).sort();
        setExistingSubDistricts(uniqueSubDistricts);
        setAllLocations(data);
      })
      .catch(() => setExistingSubDistricts([]));
  }, []);

  useEffect(() => {
    if (formData.sub_district && allLocations[formData.sub_district]) {
      setExistingVillages(allLocations[formData.sub_district]);
    } else {
      setExistingVillages([]);
    }
  }, [formData.sub_district, allLocations]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          });
          setLocationLoading(false);
          showToast('ดึงตำแหน่งสำเร็จ!', 'success');
        },
        (error) => {
          setLocationLoading(false);
          showToast('ไม่สามารถดึงตำแหน่งได้: ' + error.message, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      showToast('เบราว์เซอร์นี้ไม่รองรับ Geolocation', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sub_district || !formData.village || !formData.address) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parcel_count: 0,
          on_truck: false,
        }),
      });

      const responseData = await response.json();
      setLoading(false);

      if (response.ok) {
        showToast('เพิ่มที่อยู่สำเร็จ!', 'success');
        setTimeout(() => router.push('/'), 1000);
      } else {
        showToast('เกิดข้อผิดพลาด: ' + (responseData.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      setLoading(false);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  };

  return (
    <div className="add-address-page">
      <div className="add-address-container">
        <div className="add-address-back">
          <Link href="/" className="btn-secondary">
            <i className="fas fa-arrow-left"></i>
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>

        <div className="glass-card add-address-card">
          <div className="add-address-deco-1"></div>

          <div className="add-address-header">
            <div className="add-address-header-content">
              <div className="add-address-icon">
                <i className="fas fa-map-location-dot"></i>
              </div>
              <div>
                <h2 className="add-address-title">เพิ่มที่อยู่ใหม่</h2>
                <p className="add-address-subtitle">กรอกข้อมูลที่อยู่ของคุณเพื่อรับพัสดุ</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="add-address-form">
            <div className="form-group">
              <label className="form-label">
                <i className="fas fa-city"></i>
                ตำบล
              </label>
              <input
                type="text"
                className="input-field"
                list="subdistrict-list"
                placeholder="พิมพ์หรือเลือกตำบล"
                value={formData.sub_district}
                onChange={(e) => setFormData({ ...formData, sub_district: e.target.value, village: '' })}
                required
              />
              <datalist id="subdistrict-list">
                {existingSubDistricts.map(sub => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
              <p className="form-hint">
                <i className="fas fa-info-circle"></i>
                เลือกจากรายการหรือพิมพ์ตำบลใหม่
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                <i className="fas fa-house-user"></i>
                หมู่
              </label>
              <input
                type="text"
                className="input-field"
                list="village-list"
                placeholder="พิมพ์หรือเลือกหมู่"
                value={formData.village}
                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                disabled={!formData.sub_district}
                required
              />
              <datalist id="village-list">
                {existingVillages.map(village => (
                  <option key={village} value={village} />
                ))}
              </datalist>
              <p className="form-hint">
                <i className="fas fa-info-circle"></i>
                {formData.sub_district ? 'เลือกจากรายการหรือพิมพ์หมู่ใหม่' : 'เลือกตำบลก่อน'}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                <i className="fas fa-location-dot"></i>
                ที่อยู่
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="เช่น 50/4 ถนนสุขุมวิท"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <i className="fas fa-map-marked-alt"></i>
                พิกัดตำแหน่ง (GPS)
              </label>
              <div className="gps-inputs">
                <input
                  type="text"
                  className="input-field gps-readonly"
                  placeholder="Latitude"
                  value={formData.latitude}
                  readOnly
                />
                <input
                  type="text"
                  className="input-field gps-readonly"
                  placeholder="Longitude"
                  value={formData.longitude}
                  readOnly
                />
              </div>
            </div>

            <button
              type="button"
              onClick={getCurrentLocation}
              className="btn-secondary w-full"
              disabled={locationLoading}
            >
              <i className={`fas ${locationLoading ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`}></i>
              {locationLoading ? 'กำลังดึงตำแหน่ง...' : 'ใช้ตำแหน่งปัจจุบัน GPS'}
            </button>

            <div className="form-divider"></div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-plus-circle'}`}></i>
              {loading ? 'กำลังบันทึก...' : 'บันทึกที่อยู่'}
            </button>

            <div className="info-box">
              <i className="fas fa-info-circle"></i>
              <div>
                <p>
                  <strong>คำแนะนำ:</strong> กดปุ่ม &quot;ใช้ตำแหน่งปัจจุบัน GPS&quot; เพื่อระบุพิกัดที่อยู่ของคุณอัตโนมัติ 
                  ระบบจะใช้พิกัดนี้ในการคำนวณเส้นทางที่เหมาะสมที่สุด
                </p>
              </div>
            </div>
          </form>
        </div>

        <div className="feature-cards">
          <div className="glass-card feature-card">
            <div className="feature-icon success">
              <i className="fas fa-shield-check"></i>
            </div>
            <h3>ปลอดภัย 100%</h3>
            <p>ข้อมูลของคุณได้รับการเข้ารหัสและปกป้องอย่างปลอดภัย</p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon info">
              <i className="fas fa-route"></i>
            </div>
            <h3>เส้นทางที่ดีที่สุด</h3>
            <p>ระบบจะคำนวณเส้นทางที่สั้นและรวดเร็วที่สุด</p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon primary">
              <i className="fas fa-clock-rotate-left"></i>
            </div>
            <h3>แก้ไขได้ตลอด</h3>
            <p>สามารถแก้ไขหรืออัปเดตที่อยู่ของคุณได้ทุกเมื่อ</p>
          </div>
        </div>
      </div>
    </div>
  );
}
