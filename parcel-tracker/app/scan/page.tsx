'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Parcel } from '@/lib/supabase';

interface ScanResult {
  match: boolean;
  message: string;
  scannedText?: string;
  scannedRouteCode?: string;
  scannedAddress?: string;
  expectedRouteCode?: string;
  parcel?: Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string };
  error?: string;
}

export default function ScanParcelPage() {
  const [locations, setLocations] = useState<Record<string, string[]>>({});
  const [villageNames, setVillageNames] = useState<Record<string, string>>({});
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
  const [searchQuery, setSearchQuery] = useState(''); // เพิ่ม state สำหรับค้นหา
  const [startTime, setStartTime] = useState<number | null>(null); // เพิ่ม state สำหรับเวลา
  const [frameBounds, setFrameBounds] = useState({
    x: 0,
    y: 0,
    width: 300,
    height: 200
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

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

  // ✅ Set start time when village is selected
  useEffect(() => {
    if (selectedVillage && parcels.length > 0 && !startTime) {
      setStartTime(Date.now());
    }
  }, [selectedVillage, parcels, startTime]);

  // ✅ Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (scanSoundRef.current) {
        scanSoundRef.current.pause();
        scanSoundRef.current.currentTime = 0;
      }
      if (successSoundRef.current) {
        successSoundRef.current.pause();
        successSoundRef.current.currentTime = 0;
      }
      if (errorSoundRef.current) {
        errorSoundRef.current.pause();
        errorSoundRef.current.currentTime = 0;
      }
      if (duplicateSoundRef.current) {
        duplicateSoundRef.current.pause();
        duplicateSoundRef.current.currentTime = 0;
      }
      // Cancel speech synthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ✅ Auto-clear lastScanResult หลัง 5 วินาที
  useEffect(() => {
    if (!lastScanResult || isScanning) return;
    const timer = setTimeout(() => {
      setLastScanResult(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [lastScanResult, isScanning]);

  // ✅ Text-to-Speech function with Thai voice + auto cleanup
  const speak = useCallback((text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      utterance.pitch = 1.2;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const thaiVoice = voices.find(voice => {
        return voice.lang === 'th-TH' || voice.lang.startsWith('th');
      });
      if (thaiVoice) {
        utterance.voice = thaiVoice;
      }
      // ✅ Auto cleanup on end
      utterance.onend = () => {
        window.speechSynthesis.cancel();
      };
      // ✅ Auto cleanup on error
      utterance.onerror = () => {
        window.speechSynthesis.cancel();
      };
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // ✅ Play sound function
  const playSound = useCallback((soundRef: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(() => {
        // Silent fail
      });
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        // ✅ Parallel fetch แทน Sequential
        const [locRes, namesRes] = await Promise.all([
          fetch('/api/locations'),
          fetch('/api/village-names')
        ]);
        const locData = await locRes.json();
        const namesData = await namesRes.json();
        setLocations(locData);
        setVillageNames(namesData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  // Handle village change - fetch parcels ตามชื่อเต็ม
  const handleVillageChange = async (villageName: string) => {
    setSelectedVillage(villageName);
    try {
      const response = await fetch(
        `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(villageName)}`
      );
      const data = await response.json();
      const sorted = [...data].sort((a, b) => {
        if (a.display_order && b.display_order) {
          return a.display_order - b.display_order;
        }
        if (a.display_order) return -1;
        if (b.display_order) return 1;
        return 0;
      });
      setParcels(sorted);
      setStartTime(null); // Reset timer
    } catch (error) {
      console.error('Error fetching parcels:', error);
      setParcels([]);
    }
  };

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
        setTimeout(() => {
          if (frameRef.current && videoRef.current) {
            const rect = frameRef.current.getBoundingClientRect();
            const videoRect = videoRef.current.getBoundingClientRect();
            setFrameBounds({
              x: rect.left - videoRect.left,
              y: rect.top - videoRect.top,
              width: rect.width,
              height: rect.height
            });
          }
        }, 500);
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

  // ✅ ฟังก์ชันสำหรับยกเลิกการสแกนพัสดุแต่ละชิ้น
  const handleCancelScan = async (parcelId: string) => {
    try {
      const response = await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcel_id: parcelId,
          on_truck: false,
        }),
      });

      if (response.ok) {
        const refreshResponse = await fetch(
          `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
        );
        const updatedParcels = await refreshResponse.json();
        const sortedParcels = [...updatedParcels].sort((a: Parcel, b: Parcel) =>
          (a.display_order || 0) - (b.display_order || 0)
        );
        setParcels(sortedParcels);
        setMessage('✅ ยกเลิกการสแกนแล้ว');
        playSound(successSoundRef);
        speak('ยกเลิกการสแกนแล้ว');
      }
    } catch (error) {
      console.error('Failed to cancel scan:', error);
      setMessage('❌ ไม่สามารถยกเลิกการสแกนได้');
      playSound(errorSoundRef);
    }
  };

  // ✅ ฟังก์ชันเคลียร์ทั้งหมด
  const handleClearAll = async () => {
    const confirm = window.confirm('คุณแน่ใจหรือว่าต้องการเคลียร์ทั้งหมด?');
    if (!confirm) return;

    try {
      // Update all scanned parcels back to on_truck: false
      const scannedList = parcels.filter((p) => p.on_truck === true);
      
      await Promise.all(
        scannedList.map((parcel) =>
          fetch('/api/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parcel_id: parcel.id,
              on_truck: false,
            }),
          })
        )
      );

      // Refresh data
      const refreshResponse = await fetch(
        `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
      );
      const updatedParcels = await refreshResponse.json();
      const sortedParcels = [...updatedParcels].sort((a: Parcel, b: Parcel) =>
        (a.display_order || 0) - (b.display_order || 0)
      );
      setParcels(sortedParcels);
      setStartTime(null); // Reset timer
      setMessage('✅ เคลียร์ทั้งหมดแล้ว');
      playSound(successSoundRef);
      speak('เคลียร์ทั้งหมดแล้ว');
    } catch (error) {
      console.error('Failed to clear all:', error);
      setMessage('❌ ไม่สามารถเคลียร์ทั้งหมดได้');
      playSound(errorSoundRef);
    }
  };

  // ✅ Function to find matching parcel (shared logic)
  const findMatchingParcel = useCallback((
    allParcels: Parcel[],
    scannedAddress: string,
    searchAllVillages = false
  ): (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string }) | null => {
    const scannedClean = scannedAddress.replace(/[^0-9\/]/g, '');
    let matchedParcel: (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string }) | null = null;
    let isFromDifferentVillage = false;

    // ถ้า clean แล้วเหลือตัวเลข → ค้นหาแบบตัวเลข
    if (scannedClean && scannedClean.length >= 2 && !scannedClean.startsWith('0')) {
      // กรอง: เฉพาะที่อยู่ที่ขึ้นต้นด้วยตัวเลข
      const addressesStartWithNumber = allParcels.filter((p: Parcel) =>
        /^[\d\/]/.test(p.address.trim())
      );

      // Priority 1: Match เฉพาะส่วนตัวเลข/slash ที่ขึ้นต้น
      const priority1Match = addressesStartWithNumber.find((p: Parcel) => {
        const addressTrimmed = p.address.trim();
        const houseNumberMatch = addressTrimmed.match(/^([\d\/]+)/);
        if (!houseNumberMatch) return false;
        const houseNumber = houseNumberMatch[1];
        const houseNumberClean = houseNumber.replace(/[^0-9\/]/g, '');
        return houseNumberClean === scannedClean;
      });
      if (priority1Match) {
        matchedParcel = priority1Match as (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string });
      }

      // Priority 2: ถ้าไม่เจอ ลอง clean แล้วเทียบ
      if (!matchedParcel) {
        const priority2Match = addressesStartWithNumber.find((p: Parcel) => {
          const addressTrimmed = p.address.trim();
          const firstPart = addressTrimmed.split(/[\s,]/)[0];
          const firstPartClean = firstPart.replace(/[^0-9\/]/g, '');
          return firstPartClean === scannedClean && firstPartClean.length > 0;
        });
        if (priority2Match) {
          matchedParcel = priority2Match as (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string });
        }
      }

      // Priority 3: Starts with (เช่น 67 → 67/1) - ต้องยาวกว่า 2 ตัว
      if (!matchedParcel && scannedClean.length >= 3) {
        const priority3Match = addressesStartWithNumber.find((p: Parcel) => {
          const addressClean = p.address.replace(/[^0-9\/]/g, '');
          return addressClean.startsWith(scannedClean);
        });
        if (priority3Match) {
          matchedParcel = priority3Match as (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string });
        }
      }

      // Priority 4: Contains (ใช้เมื่อจำเป็น - ต้องยาวกว่า 3 ตัว)
      if (!matchedParcel && scannedClean.length >= 4) {
        const priority4Match = allParcels.find((p: Parcel) => {
          const addressClean = p.address.replace(/[^0-9\/]/g, '');
          return addressClean.includes(scannedClean);
        });
        if (priority4Match) {
          matchedParcel = priority4Match as (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string });
        }
      }

      // ถ้าเจออยู่แล้ว ตรวจสอบว่าอยู่หมู่เดียวกันไหม
      if (matchedParcel && matchedParcel.village !== selectedVillage) {
        isFromDifferentVillage = true;
      }
    } else if (!scannedClean || scannedClean.length === 0) {
      // ถ้า clean แล้วไม่เหลืออะไร → ค้นหาแบบชื่อสถานที่
      // ค้นหาแบบ contains ชื่อเต็ม
      const fullNameMatch = allParcels.find((p: Parcel) => {
        const addressLower = p.address.toLowerCase();
        const scannedLower = scannedAddress.toLowerCase();
        return addressLower.includes(scannedLower);
      });
      if (fullNameMatch) {
        matchedParcel = fullNameMatch as (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string });
      } else {
        // ถ้ายังไม่เจอ ลองค้นหาแบบบางส่วน
        const words = scannedAddress.split(/[\s,]/);
        const partialNameMatch = allParcels.find((p: Parcel) => {
          const addressLower = p.address.toLowerCase();
          return words.some(word =>
            word.length > 0 && addressLower.includes(word.toLowerCase())
          );
        });
        if (partialNameMatch) {
          matchedParcel = partialNameMatch as (Parcel & { foundInDifferentVillage?: boolean; foundVillage?: string; foundSubDistrict?: string });
        }
      }
      // ตรวจสอบว่าอยู่หมู่เดียวกันไหม
      if (matchedParcel && matchedParcel.village !== selectedVillage) {
        isFromDifferentVillage = true;
      }
    }

    if (matchedParcel) {
      matchedParcel.foundInDifferentVillage = isFromDifferentVillage;
      if (isFromDifferentVillage) {
        matchedParcel.foundVillage = matchedParcel.village;
        matchedParcel.foundSubDistrict = matchedParcel.sub_district;
      }
    }
    return matchedParcel;
  }, [selectedVillage]);

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
        `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
      );
      const allParcels = await response.json();
      let matchedParcel = findMatchingParcel(allParcels, manualAddress);

      if (!matchedParcel) {
        const allSubDistrictResponse = await fetch(
          `/api/parcels?sub_district=${selectedSubDistrict}`
        );
        const allSubDistrictParcels = await allSubDistrictResponse.json();
        matchedParcel = findMatchingParcel(allSubDistrictParcels, manualAddress, true);
      }

      const scanResult: ScanResult = {
        match: false,
        message: '',
        scannedAddress: manualAddress,
        expectedRouteCode: routeCode,
      };

      if (matchedParcel) {
        const isDuplicate = matchedParcel.on_truck === true;

        if (matchedParcel.foundInDifferentVillage) {
          const warningMsg = `⚠️ ที่อยู่นี้อยู่ในหมู่ ${matchedParcel.foundVillage}, ${matchedParcel.foundSubDistrict}`;
          setMessage(warningMsg);
          speak(`ที่อยู่นี้อยู่ในหมู่ ${matchedParcel.foundVillage}`);
          playSound(errorSoundRef);
        }

        if (isDuplicate) {
          const scannedList = parcels.filter((p) => p.on_truck === true);
          const duplicateIndex = scannedList.findIndex(p => p.id === matchedParcel.id) + 1;
          scanResult.match = true;
          scanResult.message = `พัสดุนี้สแกนแล้ว - ลำดับที่ ${duplicateIndex}`;
          scanResult.parcel = matchedParcel;
          if (!matchedParcel.foundInDifferentVillage) {
            setMessage(`⚠️ ${scanResult.message}`);
          }
          playSound(duplicateSoundRef);
          speak(`พัสดุนี้สแกนแล้ว ลำดับที่ ${duplicateIndex}`);

          try {
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
              const refreshResponse = await fetch(
                `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
              );
              const updatedParcels = await refreshResponse.json();
              const sortedParcels = [...updatedParcels].sort((a: Parcel, b: Parcel) =>
                (a.display_order || 0) - (b.display_order || 0)
              );
              setParcels(sortedParcels);
            }
          } catch (error) {
            console.error('Failed to update parcel_count:', error);
          }
        } else {
          if (!matchedParcel.foundInDifferentVillage) {
            scanResult.match = true;
            scanResult.message = `พบพัสดุ: ${matchedParcel.address} ✓`;
            scanResult.parcel = matchedParcel;
            setMessage(`✅ ${scanResult.message}`);
          }

          try {
            const updateResponse = await fetch('/api/update-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parcel_id: matchedParcel.id,
                on_truck: true,
                isDuplicate: false
              }),
            });

            if (updateResponse.ok) {
              if (!matchedParcel.foundInDifferentVillage) {
                const refreshResponse = await fetch(
                  `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
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
              }
              setManualAddress('');
              setShowManualEntry(false);
            } else {
              console.error('Failed to update on_truck');
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
        const notFoundMsg = `ไม่พบพัสดุ "${manualAddress}" ในระบบ`;
        scanResult.message = notFoundMsg;
        setMessage(`❌ ${notFoundMsg}`);
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

    const scaleX = canvas.width / (videoRef.current?.clientWidth || 1);
    const scaleY = canvas.height / (videoRef.current?.clientHeight || 1);
    const cropX = frameBounds.x * scaleX;
    const cropY = frameBounds.y * scaleY;
    const cropWidth = frameBounds.width * scaleX;
    const cropHeight = frameBounds.height * scaleY;

    setIsScanning(true);
    setMessage('🔍 กำลังสแกน...');
    setLastScanResult(null);
    playSound(scanSoundRef);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext('2d');
    if (croppedContext) {
      croppedContext.drawImage(
        canvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );
    }

    croppedCanvas.toBlob(async (blob) => {
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

      let scannedAddress = null;
      const addressWithSlash = cleanText.match(/\b(\d{1,4}\/\d{1,2})\b/);
      if (addressWithSlash) {
        scannedAddress = addressWithSlash[1];
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
        `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
      );
      const allParcels = await response.json();
      let matchedParcel = findMatchingParcel(allParcels, scannedAddress);

      if (!matchedParcel) {
        const allSubDistrictResponse = await fetch(
          `/api/parcels?sub_district=${selectedSubDistrict}`
        );
        const allSubDistrictParcels = await allSubDistrictResponse.json();
        matchedParcel = findMatchingParcel(allSubDistrictParcels, scannedAddress, true);
      }

      if (matchedParcel) {
        const isDuplicate = matchedParcel.on_truck === true;

        if (matchedParcel.foundInDifferentVillage) {
          const warningMsg = `⚠️ ที่อยู่นี้อยู่ในหมู่ ${matchedParcel.foundVillage}, ${matchedParcel.foundSubDistrict}`;
          setMessage(warningMsg);
          speak(`ที่อยู่นี้อยู่ในหมู่ ${matchedParcel.foundVillage}`);
          playSound(errorSoundRef);
        }

        if (isDuplicate) {
          const scannedList = parcels.filter((p) => p.on_truck === true);
          const duplicateIndex = scannedList.findIndex(p => p.id === matchedParcel.id) + 1;
          scanResult.match = true;
          scanResult.message = `พัสดุนี้สแกนแล้ว - ลำดับที่ ${duplicateIndex}`;
          scanResult.parcel = matchedParcel;
          if (!matchedParcel.foundInDifferentVillage) {
            setMessage(`⚠️ ${scanResult.message}`);
          }
          playSound(duplicateSoundRef);
          speak(`พัสดุนี้สแกนแล้ว ลำดับที่ ${duplicateIndex}`);

          try {
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
              const refreshResponse = await fetch(
                `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
              );
              const updatedParcels = await refreshResponse.json();
              const sortedParcels = [...updatedParcels].sort((a: Parcel, b: Parcel) =>
                (a.display_order || 0) - (b.display_order || 0)
              );
              setParcels(sortedParcels);
            }
          } catch (error) {
            console.error('Failed to update parcel_count:', error);
          }
        } else {
          if (!matchedParcel.foundInDifferentVillage) {
            scanResult.match = true;
            scanResult.message = `พบพัสดุ: ${matchedParcel.address} ✓`;
            scanResult.parcel = matchedParcel;
            setMessage(`✅ ${scanResult.message}`);
          }

          try {
            const updateResponse = await fetch('/api/update-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parcel_id: matchedParcel.id,
                on_truck: true,
                isDuplicate: false
              }),
            });

            if (updateResponse.ok) {
              if (!matchedParcel.foundInDifferentVillage) {
                const refreshResponse = await fetch(
                  `/api/parcels?sub_district=${selectedSubDistrict}&village_full_name=${encodeURIComponent(selectedVillage)}`
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
              }
            } else {
              console.error('Failed to update on_truck');
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
        const notFoundMsg = `ไม่พบพัสดุ "${scannedAddress}" ในระบบ`;
        scanResult.message = notFoundMsg;
        setMessage(`❌ ${notFoundMsg}`);
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

  // ✅ Memoize filtered lists
  const scannedParcelsList = useMemo(
    () => parcels.filter((p) => p.on_truck === true),
    [parcels]
  );

  const unscannedParcelsList = useMemo(
    () => parcels.filter((p) => p.on_truck !== true),
    [parcels]
  );

  // ✅ ฟังก์ชันคำนวณเวลาที่ผ่านไป
  const elapsedTime = useMemo(() => {
    if (!startTime) return '00:00';
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [startTime]);

  // ✅ ฟังก์ชันคำนวณ % ความสำเร็จ
  const successPercentage = useMemo(() => {
    if (parcels.length === 0) return 0;
    return Math.round((scannedParcelsList.length / parcels.length) * 100);
  }, [parcels, scannedParcelsList]);

  // ✅ ฟังก์ชันกรองรายการพัสดุตามคำค้นหา
  const filteredScannedParcels = useMemo(() => {
    if (!searchQuery.trim()) return scannedParcelsList;
    return scannedParcelsList.filter(parcel =>
      parcel.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [scannedParcelsList, searchQuery]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <Link href="/" style={{ fontSize: '1.5rem', textDecoration: 'none' }}>←</Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
          📦 สแกนพัสดุ
        </h1>
      </div>

      {/* Info Box */}
      <div style={{
        padding: '1rem',
        background: 'var(--surface-elevated)',
        border: '1px solid var(--divider)',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
      }}>
        เคล็ดลับ: วางป้ายพัสดุให้ชัดในกรอบแดง ให้แสงสว่างเพียงพอ และถือกล้องให้นิ่ง
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
            ตำบล
          </label>
          <select
            value={selectedSubDistrict}
            onChange={(e) => {
              setSelectedSubDistrict(e.target.value);
              setSelectedVillage('');
              setParcels([]);
            }}
            className="input-field"
            style={{ fontSize: '1rem', padding: '0.875rem', height: 'auto', minHeight: '48px', width: '100%' }}
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
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
            หมู่
          </label>
          <select
            value={selectedVillage}
            onChange={(e) => handleVillageChange(e.target.value)}
            disabled={!selectedSubDistrict}
            className="input-field"
            style={{ fontSize: '1rem', padding: '0.875rem', height: 'auto', minHeight: '48px', width: '100%' }}
          >
            <option value="">เลือกหมู่</option>
            {selectedSubDistrict &&
              locations[selectedSubDistrict]?.map((villageCode: string) => {
                const villageName = villageNames[villageCode] || villageCode;
                return (
                  <option key={villageCode} value={villageName}>
                    หมู่ {villageName}
                  </option>
                );
              })}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
            รหัสนำส่ง
          </label>
          <input
            type="text"
            value={routeCode}
            onChange={(e) => setRouteCode(e.target.value.toUpperCase())}
            placeholder="002A"
            className="input-field"
            style={{ fontSize: '1rem', padding: '0.875rem', height: 'auto', minHeight: '48px', width: '100%' }}
          />
        </div>
      </div>

      {/* Manual Entry Section */}
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
        {showManualEntry ? 'ซ่อนการกรอกที่อยู่' : 'กรอกที่อยู่เอง'}
      </button>

      {showManualEntry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input
            type="text"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            placeholder="ป้อนที่อยู่ เช่น 219/5"
            className="input-field"
            style={{ fontSize: '1rem', padding: '0.875rem', width: '100%', minHeight: '48px' }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleManualEntry();
              }
            }}
          />
          <button
            onClick={handleManualEntry}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              minHeight: '48px',
              width: '100%'
            }}
          >
            ค้นหา
          </button>
        </div>
      )}

      {/* Camera View */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 3',
        background: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        {!cameraActive && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            textAlign: 'center',
            fontSize: '0.875rem',
          }}>
            กดปุ่ม "เปิดกล้อง" เพื่อเริ่มสแกนพัสดุ
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}
        />

        {cameraActive && (
          <div
            ref={frameRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              height: '60%',
              border: '3px solid red',
              borderRadius: '8px',
              pointerEvents: 'none',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-30px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 0, 0, 0.8)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}>
              📦 วางป้ายพัสดุในกรอบ
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Camera Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {!cameraActive ? (
          <button
            onClick={startCamera}
            style={{
              flex: 1,
              padding: '0.875rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              minHeight: '48px'
            }}
          >
            เปิดกล้อง
          </button>
        ) : (
          <>
            <button
              onClick={captureAndScan}
              disabled={isScanning}
              style={{
                flex: 1,
                padding: '0.875rem',
                background: isScanning ? 'var(--divider)' : 'var(--success)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: isScanning ? 'not-allowed' : 'pointer',
                minHeight: '48px'
              }}
            >
              {isScanning ? 'กำลังสแกน...' : 'สแกน'}
            </button>
            <button
              onClick={stopCamera}
              style={{
                padding: '0.875rem 1.5rem',
                background: 'var(--error)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                minHeight: '48px'
              }}
            >
              ปิด
            </button>
          </>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '1rem',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--divider)',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--text-primary)',
        }}>
          {message}
        </div>
      )}

      {/* Scan Result Details */}
      {lastScanResult && (
        <div style={{
          padding: '1rem',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--divider)',
          borderRadius: '8px',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            ข้อมูลที่ค้นหา
          </h3>
          {lastScanResult.scannedText && (
            <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <strong>ข้อความทั้งหมด:</strong>
              <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                {lastScanResult.scannedText}
              </div>
            </div>
          )}
          {lastScanResult.scannedRouteCode && (
            <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <strong>รหัส:</strong> {lastScanResult.scannedRouteCode}
            </div>
          )}
          {lastScanResult.scannedAddress && (
            <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <strong>ที่อยู่:</strong> {lastScanResult.scannedAddress}
            </div>
          )}
        </div>
      )}

      {/* Stats with Timer and Success Percentage */}
      {parcels.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            padding: '1rem',
            background: 'var(--success-bg)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              สแกนแล้ว
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
              {scannedParcelsList.length}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            background: 'var(--warning-bg)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              รอสแกน
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>
              {unscannedParcelsList.length}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            background: 'var(--primary-bg)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              ความสำเร็จ
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              {successPercentage}%
            </div>
          </div>
        </div>
      )}

      {/* Time and Clear All Buttons */}
      {parcels.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            padding: '1rem',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--divider)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              ⏱️ เวลาที่ผ่านไป
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {elapsedTime}
            </div>
          </div>
          <button
            onClick={handleClearAll}
            style={{
              padding: '1rem',
              background: 'var(--error)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            🔄 เคลียร์ทั้งหมด
          </button>
        </div>
      )}

      {/* Search Box for Scanned Parcels */}
      {scannedParcelsList.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาพัสดุ..."
            className="input-field"
            style={{ 
              fontSize: '1rem', 
              padding: '0.875rem', 
              width: '100%', 
              minHeight: '48px',
              borderRadius: '8px',
              border: '1px solid var(--divider)'
            }}
          />
        </div>
      )}

      {/* Scanned Parcels */}
      {scannedParcelsList.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            สแกนแล้ว ({filteredScannedParcels.length}/{scannedParcelsList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredScannedParcels.map((parcel, index) => (
              <div
                key={parcel.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--success)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--success)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                  }}>
                    {scannedParcelsList.findIndex(p => p.id === parcel.id) + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: '0.875rem' }}>
                    {parcel.address}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelScan(parcel.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--error)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unscanned Parcels */}
      {unscannedParcelsList.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            รอสแกน ({unscannedParcelsList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {unscannedParcelsList.map((parcel) => (
              <div
                key={parcel.id}
                style={{
                  padding: '0.75rem',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--divider)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}
              >
                {parcel.address}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
