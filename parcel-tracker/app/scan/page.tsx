'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Parcel } from '@/lib/supabase';

interface ScanResult {
  match: boolean;
  message: string;
  scannedText?: string;
  scannedRouteCode?: string;
  scannedAddress?: string;
  expectedRouteCode?: string;
  parcel?: Parcel;
  error?: string;
}

export default function ScanParcelPage() {
  const [locations, setLocations] = useState<Record<string, string[]>>({});
  const [selectedSubDistrict, setSelectedSubDistrict] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [routeCode, setRouteCode] = useState('');
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio refs
  const scanSoundRef = useRef<HTMLAudioElement | null>(null);
  const successSoundRef = useRef<HTMLAudioElement | null>(null);
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);
  const duplicateSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      scanSoundRef.current = new Audio('/sounds/scan.mp3');
      successSoundRef.current = new Audio('/sounds/success.mp3');
      errorSoundRef.current = new Audio('/sounds/error.mp3');
      duplicateSoundRef.current = new Audio('/sounds/duplicate.mp3');
    }
  }, []);

  // Initialize voices on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Text-to-Speech function with Thai voice
  const speak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      utterance.pitch = 1.2;
      utterance.volume = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      console.log('Total voices available:', voices.length);
      
      // หา Thai voice
      const thaiVoice = voices.find(voice => {
        console.log(`Checking voice: ${voice.name} (${voice.lang})`);
        return voice.lang === 'th-TH' || voice.lang.startsWith('th');
      });
      
      if (thaiVoice) {
        utterance.voice = thaiVoice;
        console.log('Using Thai voice:', thaiVoice.name);
      } else {
        console.log('No Thai voice found, using default');
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Play sound function
  const playSound = (soundRef: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(e => console.error('Sound play error:', e));
    }
  };

  useEffect(() => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => setLocations(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedSubDistrict && selectedVillage) {
      fetch(`/api/parcels?sub_district=${selectedSubDistrict}&village=${selectedVillage}`)
        .then((res) => res.json())
        .then((data) => {
          const sorted = [...data].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          setParcels(sorted);
        })
        .catch(console.error);
    }
  }, [selectedSubDistrict, selectedVillage]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      setMessage('❌ ไม่สามารถเข้าถึงกล้องได้');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  // Manual entry function
  const handleManualEntry = async () => {
    if (!manualAddress.trim()) {
      setMessage('❌ กรุณากรอกที่อยู่');
      playSound(errorSoundRef);
      speak('กรุณากรอกที่อยู่');
      return;
    }

    playSound(scanSoundRef);
    setMessage('🔍 กำลังค้นหา...');
    setLastScanResult(null);

    try {
      const response = await fetch(
        `/api/parcels?sub_district=${selectedSubDistrict}&village=${selectedVillage}`
      );
      const allParcels = await response.json();

      const scannedClean = manualAddress.replace(/[^0-9\/]/g, '');
      
      // Priority 1: Exact start match
      let matchedParcel = allParcels.find((p: Parcel) => {
        const addressTrimmed = p.address.trim();
        const firstPart = addressTrimmed.split(/[\s,]/)[0];
        const firstPartClean = firstPart.replace(/[^0-9\/]/g, '');
        return firstPartClean === scannedClean;
      });

      // Priority 2: Starts with
      if (!matchedParcel) {
        matchedParcel = allParcels.find((p: Parcel) => {
          const addressClean = p.address.replace(/[^0-9\/]/g, '');
          return addressClean.startsWith(scannedClean);
        });
      }

      // Priority 3: Contains
      if (!matchedParcel) {
        matchedParcel = allParcels.find((p: Parcel) => {
          const addressClean = p.address.replace(/[^0-9\/]/g, '');
          return addressClean === scannedClean || addressClean.includes(scannedClean);
        });
      }

      const scanResult: ScanResult = {
        match: false,
        message: '',
        scannedAddress: manualAddress,
        expectedRouteCode: routeCode,
      };

      setLastScanResult(scanResult);

      if (matchedParcel) {
        const isDuplicate = matchedParcel.on_truck === true;
        
if (isDuplicate) {
  const scannedList = parcels.filter((p) => p.on_truck === true);
  const duplicateIndex = scannedList.findIndex(p => p.id === matchedParcel.id) + 1;
  
  scanResult.match = true;
  scanResult.message = `พัสดุนี้สแกนแล้ว - ลำดับที่ ${duplicateIndex}`;
  scanResult.parcel = matchedParcel;
  setMessage(`⚠️ ${scanResult.message}`);
  
  playSound(duplicateSoundRef);
  speak(`พัสดุนี้สแกนแล้ว ลำดับที่ ${duplicateIndex}`);

  // Update parcel_count เมื่อสแกนซ้ำ
  try {
    console.log('Incrementing parcel_count...');
    
    const updateResponse = await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parcel_id: matchedParcel.id,
        on_truck: true,
        isDuplicate: true
      }),
    });

    if (updateResponse.ok) {
      console.log('Incremented parcel_count');
      
      // Refetch to get updated count
      const refreshResponse = await fetch(
        `/api/parcels?sub_district=${selectedSubDistrict}&village=${selectedVillage}`
      );
      const updatedParcels = await refreshResponse.json();
      
      const sortedParcels = [...updatedParcels].sort((a: Parcel, b: Parcel) => 
        (a.display_order || 0) - (b.display_order || 0)
      );
      setParcels(sortedParcels);
    } else {
      console.error('Failed to update parcel_count');
    }
  } catch (error) {
    console.error('Failed to update parcel_count:', error);
  }
} else {
  scanResult.match = true;
  scanResult.message = `พบพัสดุ: ${matchedParcel.address} ✓`;
  scanResult.parcel = matchedParcel;
  setMessage(`✅ ${scanResult.message}`);

  try {
    console.log('Updating on_truck status...');
    
    const updateResponse = await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parcel_id: matchedParcel.id,
        on_truck: true,
        isDuplicate: false  // ครั้งแรก
      }),
    });


            if (updateResponse.ok) {
              console.log('Updated on_truck to: true');
              
              const refreshResponse = await fetch(
                `/api/parcels?sub_district=${selectedSubDistrict}&village=${selectedVillage}`
              );
              const updatedParcels = await refreshResponse.json();
              
              const sortedParcels = [...updatedParcels].sort((a: Parcel, b: Parcel) => 
                (a.display_order || 0) - (b.display_order || 0)
              );
              setParcels(sortedParcels);
              
              const updatedScannedList = sortedParcels.filter((p: Parcel) => p.on_truck === true);
              const displayIndex = updatedScannedList.findIndex((p: Parcel) => p.id === matchedParcel.id) + 1;
              
              playSound(successSoundRef);
              speak(`สแกนสำเร็จ ลำดับที่ ${displayIndex}`);
              
              // Clear manual entry
              setManualAddress('');
              setShowManualEntry(false);
            } else {
              const errorText = await updateResponse.text();
              console.error('Failed to update on_truck:', errorText);
              playSound(errorSoundRef);
              speak('ไม่สามารถบันทึกการสแกน');
            }
          } catch (error) {
            console.error('Failed to update on_truck:', error);
            playSound(errorSoundRef);
            speak('เกิดข้อผิดพลาดในการบันทึก');
          }
        }
      } else {
        scanResult.message = `ไม่พบพัสดุ "${manualAddress}" ในระบบ`;
        setMessage(`❌ ${scanResult.message}`);
        
        playSound(errorSoundRef);
        speak(`ไม่พบพัสดุ ${manualAddress} ในระบบ`);
      }

      setLastScanResult(scanResult);
    } catch (error) {
      console.error('Error:', error);
      setMessage('❌ เกิดข้อผิดพลาดในการค้นหา');
      playSound(errorSoundRef);
      speak('เกิดข้อผิดพลาดในการค้นหา');
    }
  };

  const captureAndScan = async () => {
    if (!canvasRef.current || !videoRef.current) return;

    if (!selectedSubDistrict || !selectedVillage || !routeCode) {
      setMessage('❌ กรุณาเลือกตำบล หมู่ และระบุรหัสนำส่งก่อน');
      playSound(errorSoundRef);
      speak('กรุณาเลือกตำบล หมู่ และระบุรหัสนำส่งก่อน');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0);

    setIsScanning(true);
    setMessage('🔍 กำลังสแกน...');
    setLastScanResult(null);

    playSound(scanSoundRef);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setIsScanning(false);
        setMessage('❌ ไม่สามารถถ่ายภาพได้');
        playSound(errorSoundRef);
        speak('ไม่สามารถถ่ายภาพได้');
        return;
      }

      try {
        const formData = new FormData();
        formData.append('image', blob, 'capture.jpg');

        console.log('Sending image to OCR...');
        
        const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`OCR API returned ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
          setMessage('❌ ' + result.error);
          playSound(errorSoundRef);
          speak('เกิดข้อผิดพลาด');
          setIsScanning(false);
          return;
        }

        console.log('OCR Text:', result.text);
        await processScannedText(result.text);
      } catch (error) {
        console.error('OCR Error:', error);
        
        if (error instanceof Error) {
          setMessage('❌ เกิดข้อผิดพลาด: ' + error.message);
        } else {
          setMessage('❌ เกิดข้อผิดพลาดในการสแกน');
        }
        
        playSound(errorSoundRef);
        speak('เกิดข้อผิดพลาดในการสแกน');
        setIsScanning(false);
      }
    }, 'image/jpeg', 0.95);
  };

  const processScannedText = async (detectedText: string) => {
    try {
      let cleanText = detectedText
        .replace(/[oO]/gi, '0')
        .replace(/[lI|]/g, '1')
        .replace(/[sS]/g, '5')
        .replace(/[zZ]/g, '2')
        .replace(/[gG]/g, '9')
        .replace(/[bB]/g, '8')
        .replace(/~/g, '')
        .replace(/\s+/g, ' ')
        .toUpperCase()
        .trim();

      console.log('Original Text:', detectedText);
      console.log('Clean Text:', cleanText);

      let scannedAddress = null;
      const addressWithSlash = cleanText.match(/\b(\d{1,4}\/\d{1,2})\b/);
      if (addressWithSlash) {
        scannedAddress = addressWithSlash[1];
        console.log('Found address with slash:', scannedAddress);
      }

      if (!scannedAddress) {
        const allNumbers = cleanText.match(/\d+/g) || [];
        const validNumbers = allNumbers.filter(n => 
          n.length >= 2 && n.length <= 4 && parseInt(n) < 9999 && parseInt(n) > 9
        );
        if (validNumbers.length > 0) {
          scannedAddress = validNumbers.sort((a, b) => {
            if (a.length === 3 && b.length !== 3) return -1;
            if (b.length === 3 && a.length !== 3) return 1;
            return b.length - a.length;
          })[0];
        }
      }

      let scannedRouteCode = null;
      const allAlphaNum = cleanText.match(/[A-Z]\d+|[A-Z]+\d+|\d+[A-Z]/g) || [];
      
      const routePatterns = [
        /\b(\d{3}[A-Z])\b/,
        /\b([A-Z]+\d+-?\d+)\b/,
        /\b([A-Z]\d+[A-Z]?\d*)\b/,
      ];

      for (const pattern of routePatterns) {
        const match = cleanText.match(pattern);
        if (match) {
          scannedRouteCode = match[1];
          break;
        }
      }

      if (!scannedRouteCode && allAlphaNum.length > 0) {
        const filtered = allAlphaNum.filter(a => a !== scannedAddress);
        if (filtered.length > 0) {
          scannedRouteCode = filtered.reduce((a, b) => a.length > b.length ? a : b);
        }
      }

      console.log('Extracted:', { scannedRouteCode, scannedAddress });

      const scanResult: ScanResult = {
        match: false,
        message: '',
        scannedText: detectedText,
        scannedRouteCode: scannedRouteCode || undefined,
        scannedAddress: scannedAddress || undefined,
        expectedRouteCode: routeCode,
      };

      setLastScanResult(scanResult);

      if (!scannedAddress) {
        scanResult.message = 'ไม่สามารถอ่านที่อยู่ได้ - ลองถ่ายใหม่ให้ชัดขึ้น';
        setMessage(`❌ ${scanResult.message}`);
        playSound(errorSoundRef);
        speak('ไม่สามารถอ่านที่อยู่ได้');
        setIsScanning(false);
        return;
      }

      if (scannedRouteCode && routeCode) {
        const routeCodeNormalized = scannedRouteCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const expectedRouteCodeNormalized = routeCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        
        const routeMatch = routeCodeNormalized.includes(expectedRouteCodeNormalized) || 
                          expectedRouteCodeNormalized.includes(routeCodeNormalized) ||
                          (routeCodeNormalized.length >= 3 && 
                           expectedRouteCodeNormalized.includes(routeCodeNormalized.substring(0, 3)));
        
        if (!routeMatch) {
          scanResult.message = `รหัสนำส่งไม่ตรงกับเส้นทาง (พบ: ${scannedRouteCode}, ต้องการ: ${routeCode})`;
          setMessage(`❌ ${scanResult.message}`);
          playSound(errorSoundRef);
          speak('รหัสนำส่งไม่ตรงกับเส้นทาง');
          setIsScanning(false);
          return;
        }
      }

      const response = await fetch(
        `/api/parcels?sub_district=${selectedSubDistrict}&village=${selectedVillage}`
      );
      const allParcels = await response.json();

      console.log('All parcels:', allParcels.map((p: Parcel) => p.address));

      const scannedClean = scannedAddress.replace(/[^0-9\/]/g, '');

      let matchedParcel = allParcels.find((p: Parcel) => {
        const addressTrimmed = p.address.trim();
        const firstPart = addressTrimmed.split(/[\s,]/)[0];
        const firstPartClean = firstPart.replace(/[^0-9\/]/g, '');
        return firstPartClean === scannedClean;
      });

      console.log('Priority 1 - Exact start match:', matchedParcel?.address);

      if (!matchedParcel) {
        matchedParcel = allParcels.find((p: Parcel) => {
          const addressClean = p.address.replace(/[^0-9\/]/g, '');
          return addressClean.startsWith(scannedClean);
        });
        console.log('Priority 2 - Starts with match:', matchedParcel?.address);
      }

      if (!matchedParcel) {
        matchedParcel = allParcels.find((p: Parcel) => {
          const addressClean = p.address.replace(/[^0-9\/]/g, '');
          return addressClean === scannedClean || addressClean.includes(scannedClean);
        });
        console.log('Priority 3 - Contains match:', matchedParcel?.address);
      }

      console.log('Final matched parcel:', matchedParcel?.address || 'Not found');

      if (matchedParcel) {
        const isDuplicate = matchedParcel.on_truck === true;
        
        if (isDuplicate) {
          const scannedList = parcels.filter((p) => p.on_truck === true);
          const duplicateIndex = scannedList.findIndex(p => p.id === matchedParcel.id) + 1;
          
          scanResult.match = true;
          scanResult.message = `พัสดุนี้สแกนแล้ว - ลำดับที่ ${duplicateIndex}`;
          scanResult.parcel = matchedParcel;
          setMessage(`⚠️ ${scanResult.message}`);
          
          playSound(duplicateSoundRef);
          speak(`พัสดุนี้สแกนแล้ว ลำดับที่ ${duplicateIndex}`);
        } else {
          scanResult.match = true;
          scanResult.message = `พบพัสดุ: ${matchedParcel.address} ✓`;
          scanResult.parcel = matchedParcel;
          setMessage(`✅ ${scanResult.message}`);

          try {
            console.log('Updating on_truck status...');
            
            const updateResponse = await fetch('/api/update-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parcel_id: matchedParcel.id,
                on_truck: true
              }),
            });

            if (updateResponse.ok) {
              console.log('Updated on_truck to: true');
              
              const refreshResponse = await fetch(
                `/api/parcels?sub_district=${selectedSubDistrict}&village=${selectedVillage}`
              );
              const updatedParcels = await refreshResponse.json();
              
              const sortedParcels = [...updatedParcels].sort((a: Parcel, b: Parcel) => 
                (a.display_order || 0) - (b.display_order || 0)
              );
              setParcels(sortedParcels);
              
              const updatedScannedList = sortedParcels.filter((p: Parcel) => p.on_truck === true);
              const displayIndex = updatedScannedList.findIndex((p: Parcel) => p.id === matchedParcel.id) + 1;
              
              playSound(successSoundRef);
              speak(`สแกนสำเร็จ ลำดับที่ ${displayIndex}`);
            } else {
              const errorText = await updateResponse.text();
              console.error('Failed to update on_truck:', errorText);
              playSound(errorSoundRef);
              speak('ไม่สามารถบันทึกการสแกน');
            }
          } catch (error) {
            console.error('Failed to update on_truck:', error);
            playSound(errorSoundRef);
            speak('เกิดข้อผิดพลาดในการบันทึก');
          }
        }
      } else {
        scanResult.message = `ไม่พบพัสดุ "${scannedAddress}" ในระบบ`;
        setMessage(`❌ ${scanResult.message}`);
        
        playSound(errorSoundRef);
        speak(`ไม่พบพัสดุ ${scannedAddress} ในระบบ`);
      }

      setLastScanResult(scanResult);
    } catch (error) {
      console.error('Processing error:', error);
      setMessage('❌ เกิดข้อผิดพลาดในการประมวลผล');
      playSound(errorSoundRef);
      speak('เกิดข้อผิดพลาดในการประมวลผล');
    } finally {
      setIsScanning(false);
    }
  };

  const scannedParcelsList = parcels.filter((p) => p.on_truck === true);
  const unscannedParcelsList = parcels.filter((p) => p.on_truck !== true);

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <Link href="/" className="btn-secondary" style={{ margin: 0 }}>
          <i className="fas fa-arrow-left"></i> กลับ
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
          📦 สแกนพัสดุ
        </h1>
        <div style={{ width: '100px' }}></div>
      </div>

      {/* Info Box */}
      <div style={{
        background: 'rgba(255, 169, 40, 0.1)',
        border: '1px solid rgba(255, 169, 40, 0.3)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1rem',
        fontSize: '0.875rem'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <i className="fas fa-lightbulb" style={{ color: '#ffa928', fontSize: '1.25rem' }}></i>
          <div style={{ color: 'var(--text-primary)' }}>
            <strong>เคล็ดลับ:</strong> วางป้ายพัสดุให้ชัดในกรอบแดง ให้แสงสว่างเพียงพอ และถือกล้องให้นิ่ง
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              ตำบล
            </label>
            <select
              value={selectedSubDistrict}
              onChange={(e) => {
                setSelectedSubDistrict(e.target.value);
                setSelectedVillage('');
              }}
              className="input-field"
              style={{ fontSize: '0.875rem', padding: '0.625rem', height: 'auto' }}
            >
              <option value="">เลือกตำบล</option>
              {Object.keys(locations).map((subDistrict) => (
                <option key={subDistrict} value={subDistrict}>
                  {subDistrict}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              หมู่
            </label>
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              disabled={!selectedSubDistrict}
              className="input-field"
              style={{ fontSize: '0.875rem', padding: '0.625rem', height: 'auto' }}
            >
              <option value="">เลือกหมู่</option>
              {selectedSubDistrict &&
                locations[selectedSubDistrict]?.map((village) => (
                  <option key={village} value={village}>
                    หมู่ {village}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              รหัสนำส่ง
            </label>
            <input
              type="text"
              value={routeCode}
              onChange={(e) => setRouteCode(e.target.value.toUpperCase())}
              placeholder="002A"
              className="input-field"
              style={{ fontSize: '0.875rem', padding: '0.625rem', height: 'auto' }}
            />
          </div>
        </div>
      </div>

      {/* Manual Entry Section */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setShowManualEntry(!showManualEntry)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--divider)',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            marginBottom: showManualEntry ? '1rem' : '0',
          }}
        >
          <i className="fas fa-keyboard" style={{ marginRight: '0.5rem' }}></i>
          {showManualEntry ? 'ซ่อนการกรอกที่อยู่' : 'กรอกที่อยู่เอง'}
        </button>

        {showManualEntry && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="ป้อนที่อยู่ เช่น 219/5"
              className="input-field"
              style={{ fontSize: '0.875rem', padding: '0.625rem', flex: 1 }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleManualEntry();
                }
              }}
            />
            <button
              onClick={handleManualEntry}
              className="btn-primary"
              style={{ padding: '0.625rem 1rem', fontSize: '0.875rem' }}
            >
              <i className="fas fa-search"></i>
              ค้นหา
            </button>
          </div>
        )}
      </div>

      {/* Camera View */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '60vh',
              display: cameraActive ? 'block' : 'none',
            }}
          />
          
          {!cameraActive && (
            <div style={{
              aspectRatio: '4/3',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              background: 'var(--surface)',
              padding: '2rem'
            }}>
              <i className="fas fa-camera" style={{ fontSize: '3rem', color: 'var(--divider)' }}></i>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem' }}>
                กดปุ่ม "เปิดกล้อง" เพื่อเริ่มสแกนพัสดุ
              </p>
            </div>
          )}

          {cameraActive && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              maxWidth: '300px',
              aspectRatio: '3/2',
              border: '3px solid var(--primary)',
              borderRadius: '12px',
              pointerEvents: 'none',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            }}>
              <div style={{
                position: 'absolute',
                top: '-30px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--primary)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                📦 วางป้ายพัสดุในกรอบ
              </div>
            </div>
          )}
        </div>

        {/* Camera Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              <i className="fas fa-video"></i>
              เปิดกล้อง
            </button>
          ) : (
            <>
              <button
                onClick={captureAndScan}
                disabled={isScanning || !selectedSubDistrict || !selectedVillage || !routeCode}
                className="btn-primary"
                style={{ flex: 2 }}
              >
                <i className="fas fa-camera"></i>
                {isScanning ? 'กำลังสแกน...' : 'สแกน'}
              </button>
              <button
                onClick={stopCamera}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                <i className="fas fa-times"></i>
                ปิด
              </button>
            </>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Message */}
      {message && (
        <div
          style={{
            padding: '0.875rem 1rem',
            background: message.includes('✅')
              ? 'rgba(70, 211, 105, 0.1)'
              : message.includes('⚠️')
              ? 'rgba(255, 169, 40, 0.1)'
              : 'rgba(229, 9, 20, 0.1)',
            borderRadius: '12px',
            marginBottom: '1rem',
            border: `2px solid ${
              message.includes('✅') 
                ? 'rgba(70, 211, 105, 0.3)' 
                : message.includes('⚠️')
                ? 'rgba(255, 169, 40, 0.3)'
                : 'rgba(229, 9, 20, 0.3)'
            }`,
            color: message.includes('✅') 
              ? '#46d369' 
              : message.includes('⚠️')
              ? '#ffa928'
              : '#e50914',
            fontSize: '0.95rem',
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {message}
        </div>
      )}

      {/* Scan Result Details */}
      {lastScanResult && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fas fa-info-circle" style={{ color: 'var(--primary)' }}></i>
            ข้อมูลที่ค้นหา
          </h3>
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {lastScanResult.scannedText && (
              <div style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  ข้อความทั้งหมด:
                </div>
                <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                  {lastScanResult.scannedText}
                </div>
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {lastScanResult.scannedRouteCode && (
                <div style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    รหัส:
                  </div>
                  <div style={{ 
                    color: '#46d369', 
                    fontWeight: '700',
                    fontSize: '1rem'
                  }}>
                    {lastScanResult.scannedRouteCode}
                  </div>
                </div>
              )}

              {lastScanResult.scannedAddress && (
                <div style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    ที่อยู่:
                  </div>
                  <div style={{ 
                    color: '#46d369', 
                    fontWeight: '700',
                    fontSize: '1rem'
                  }}>
                    {lastScanResult.scannedAddress}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {parcels.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            background: 'rgba(70, 211, 105, 0.1)',
            border: '1px solid rgba(70, 211, 105, 0.3)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#46d369', fontWeight: '600', marginBottom: '0.25rem' }}>
              สแกนแล้ว
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#46d369' }}>
              {scannedParcelsList.length}
            </div>
          </div>
          <div style={{
            background: 'rgba(229, 9, 20, 0.1)',
            border: '1px solid rgba(229, 9, 20, 0.3)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600', marginBottom: '0.25rem' }}>
              รอสแกน
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--primary)' }}>
              {unscannedParcelsList.length}
            </div>
          </div>
        </div>
      )}

      {/* Scanned Parcels */}
      {scannedParcelsList.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#46d369', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fas fa-check-circle"></i>
            สแกนแล้ว ({scannedParcelsList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {scannedParcelsList.map((parcel, index) => (
              <div 
                key={parcel.id} 
                style={{
                  background: 'rgba(70, 211, 105, 0.1)',
                  border: '1px solid rgba(70, 211, 105, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div
                  style={{
                    minWidth: '32px',
                    height: '32px',
                    background: 'linear-gradient(135deg, #46d369, #2ecc71)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: '800',
                    color: 'white',
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>
                    {parcel.address}
                  </p>
                </div>
                <i className="fas fa-check-circle" style={{ color: '#46d369', fontSize: '1.25rem' }}></i>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unscanned Parcels */}
      {unscannedParcelsList.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fas fa-clock"></i>
            รอสแกน ({unscannedParcelsList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {unscannedParcelsList.map((parcel) => (
              <div 
                key={parcel.id}
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--divider)',
                  borderRadius: '8px',
                  padding: '0.75rem'
                }}
              >
                <p style={{ fontSize: '0.875rem', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                  {parcel.address}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
