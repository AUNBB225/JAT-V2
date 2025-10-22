'use client';

import { useState } from 'react';
import { Parcel } from '@/lib/supabase';

interface ParcelItemProps {
  parcel: Parcel;
  onUpdate: (parcel: Parcel) => void;
}

export default function ParcelItem({ parcel, onUpdate }: ParcelItemProps) {
  const [count, setCount] = useState(parcel.parcel_count);
  const [onTruck, setOnTruck] = useState(parcel.on_truck);
  const [loading, setLoading] = useState(false);

  const handleCheckbox = async () => {
    const newOnTruck = !onTruck;
    const newCount = newOnTruck ? 1 : 0;
    
    setOnTruck(newOnTruck);
    setCount(newCount);

    await fetch('/api/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub_district: parcel.sub_district,
        village: parcel.village,
        address: parcel.address,
        on_truck: newOnTruck,
        parcel_count: newCount,
      }),
    });

    onUpdate({ ...parcel, on_truck: newOnTruck, parcel_count: newCount });
  };

  const handleCountChange = async (delta: number) => {
    const newCount = Math.max(0, count + delta);
    setCount(newCount);

    await fetch('/api/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub_district: parcel.sub_district,
        village: parcel.village,
        address: parcel.address,
        parcel_count: newCount,
      }),
    });

    onUpdate({ ...parcel, parcel_count: newCount });
  };

  const handleSetLocation = async () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lng = position.coords.longitude.toFixed(6);

          await fetch('/api/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sub_district: parcel.sub_district,
              village: parcel.village,
              address: parcel.address,
              latitude: lat,
              longitude: lng,
            }),
          });

          setLoading(false);
          onUpdate({ ...parcel, latitude: lat, longitude: lng });
          alert('บันทึกพิกัดสำเร็จ');
        },
        (error) => {
          setLoading(false);
          alert('ไม่สามารถดึงตำแหน่งได้: ' + error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const openMap = () => {
    if (parcel.latitude && parcel.longitude) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${parcel.latitude},${parcel.longitude}`,
        '_blank'
      );
    }
  };

  return (
    <div className={`parcel-item ${onTruck ? 'checked' : ''}`}>
      <div className="flex items-center gap-3 mb-2">
        <div onClick={handleCheckbox} className="cursor-pointer">
          <div className={`custom-checkbox ${onTruck ? 'checked' : ''}`}></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <i className="fas fa-location-dot text-red-500"></i>
            <span className="font-semibold text-gray-800 truncate">{parcel.address}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {onTruck ? (
              <span className="badge-on-truck">
                <i className="fas fa-truck-fast"></i>บนรถแล้ว
              </span>
            ) : (
              <span className="badge-waiting">
                <i className="fas fa-clock"></i>รอจัดส่ง
              </span>
            )}
            {parcel.latitude && parcel.longitude && (
              <span className="badge-has-gps">
                <i className="fas fa-location-dot"></i>มี GPS
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleCountChange(-1)} className="count-btn minus">
            <i className="fas fa-minus"></i>
          </button>
          <span className="text-lg font-bold text-gray-800 min-w-[2rem] text-center">
            {count}
          </span>
          <button onClick={() => handleCountChange(1)} className="count-btn plus">
            <i className="fas fa-plus"></i>
          </button>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSetLocation}
          className={`gps-btn ${parcel.latitude && parcel.longitude ? 'has-location' : ''}`}
          title="บันทึกพิกัด GPS"
          disabled={loading}
        >
          {loading ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-location-crosshairs"></i>
          )}
        </button>
        {parcel.latitude && parcel.longitude && (
          <button
            onClick={openMap}
            className="flex-1 text-sm py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold"
          >
            <i className="fas fa-map-marked-alt mr-1"></i>ดูแผนที่
          </button>
        )}
      </div>
    </div>
  );
}
