'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ImportCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [subDistrict, setSubDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [result, setResult] = useState<{ success: number; error: number; errors: string[] } | null>(null);
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
    if (subDistrict && allLocations[subDistrict]) {
      setExistingVillages(allLocations[subDistrict]);
    } else {
      setExistingVillages([]);
    }
  }, [subDistrict, allLocations]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return data;
  };

  const handleImport = async () => {
    if (!file || !subDistrict || !village) {
      alert('กรุณาเลือกไฟล์ และกรอกตำบล/หมู่');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          const response = await fetch('/api/parcels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sub_district: subDistrict,
              village: village,
              address: row['Address'] || row['address'],
              parcel_count: parseInt(row['Parcel Count'] || row['parcel_count']) || 0,
              on_truck: (row['On Truck'] || row['on_truck'] || 'FALSE').toUpperCase() === 'TRUE',
              latitude: row['Latitude'] || row['latitude'] || null,
              longitude: row['Longitude'] || row['longitude'] || null,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            const data = await response.json();
            errorCount++;
            errors.push(`${row['Address']}: ${data.error || 'Unknown error'}`);
          }
        } catch (error) {
          errorCount++;
          errors.push(`${row['Address']}: Network error`);
        }

        // หน่วงเวลาเล็กน้อยเพื่อไม่ให้ overload
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setResult({ success: successCount, error: errorCount, errors });
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
    }

    setLoading(false);
  };

  return (
    <div className="container mx-auto min-h-screen py-6">
      <div className="app-header mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="app-title">นำเข้าข้อมูล CSV</h1>
            <p className="app-subtitle">อัปโหลดไฟล์ CSV เพื่อนำเข้าข้อมูลจำนวนมาก</p>
          </div>
          <Link href="/" className="btn-secondary">
            <i className="fas fa-arrow-left"></i> กลับหน้าหลัก
          </Link>
        </div>
      </div>

      <div className="glass-card p-8 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              value={subDistrict}
              onChange={(e) => {
                setSubDistrict(e.target.value);
                setVillage('');
              }}
              required
            />
            <datalist id="subdistrict-list">
              {existingSubDistricts.map(sub => (
                <option key={sub} value={sub} />
              ))}
            </datalist>
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
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              disabled={!subDistrict}
              required
            />
            <datalist id="village-list">
              {existingVillages.map(v => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="form-divider mb-6"></div>

        <div className="form-group">
          <label className="form-label">
            <i className="fas fa-file-csv"></i>
            เลือกไฟล์ CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="input-field"
          />
          <p className="form-hint">
            <i className="fas fa-info-circle"></i>
            รูปแบบ: Address, Parcel Count, On Truck, Latitude, Longitude
          </p>
        </div>

        {file && (
          <div className="mb-6 p-4 bg-surface-elevated rounded-lg border border-divider">
            <p className="text-text-primary flex items-center gap-2 mb-2">
              <i className="fas fa-file-alt text-primary"></i>
              <strong>ไฟล์:</strong> {file.name}
            </p>
            <p className="text-text-secondary text-sm">
              <strong>ขนาด:</strong> {(file.size / 1024).toFixed(2)} KB
            </p>
            <p className="text-text-primary text-sm mt-2">
              <strong>นำเข้าไปที่:</strong> {subDistrict || '...'} › {village || '...'}
            </p>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || !subDistrict || !village || loading}
          className="btn-primary w-full"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
          {loading ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="stat-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-secondary text-sm">สำเร็จ</p>
                    <p className="text-3xl font-bold text-success">{result.success}</p>
                  </div>
                  <i className="fas fa-check-circle text-success text-4xl"></i>
                </div>
              </div>

              <div className="stat-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-secondary text-sm">ล้มเหลว</p>
                    <p className="text-3xl font-bold text-error">{result.error}</p>
                  </div>
                  <i className="fas fa-exclamation-circle text-error text-4xl"></i>
                </div>
              </div>
            </div>

            {result.error > 0 && (
              <div className="p-4 bg-surface-elevated rounded-lg border border-error">
                <h3 className="font-bold text-error mb-3 flex items-center gap-2">
                  <i className="fas fa-list"></i>
                  รายการที่มีปัญหา ({result.error}):
                </h3>
                <ul className="text-sm text-text-secondary space-y-1 max-h-64 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-error">•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={() => window.location.reload()} className="btn-secondary w-full">
              <i className="fas fa-redo"></i> นำเข้าไฟล์ใหม่
            </button>
          </div>
        )}

        <div className="info-box mt-6">
          <i className="fas fa-lightbulb"></i>
          <div>
            <p className="mb-2">
              <strong>ตัวอย่างไฟล์ CSV:</strong>
            </p>
            <pre className="text-xs bg-background p-3 rounded overflow-x-auto border border-divider">
{`Address,Parcel Count,On Truck,Latitude,Longitude
ก๊วยจั๊บชายคลอง,0,FALSE,14.165043,100.309651
81/1,0,FALSE,14.16476,100.3096
67/1,2,TRUE,14.1668556,100.3098777
76/1,5,FALSE,14.16683,100.3099`}
            </pre>
            <p className="text-xs text-text-secondary mt-2">
              * Parcel Count และ On Truck เป็น optional (ถ้าไม่มีจะเป็น 0 และ FALSE)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
