import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface ParcelRecord {
  village: string;
}

export async function GET() {
  try {
    // ✅ แก้ไข: ดึง village field ทั้งหมด แล้ว filter ที่ code
    const { data, error } = await supabase
      .from('parcels')
      .select('village', { count: 'exact' });

    if (error) {
      throw error;
    }

    // ✅ แก้ไข: Type hint สำหรับ data
    const typedData = (data || []) as ParcelRecord[];

    // ✅ ดึก distinct villages ด้วย Set (เร็วกว่า .distinct())
    const uniqueVillages = new Set<string>();
    typedData.forEach(({ village }: ParcelRecord) => {
      if (village) {
        uniqueVillages.add(village);
      }
    });

    // ✅ สร้าง map: code → full name
    // เช่น: { "3": "3 หมู่บ้านสรานนท์", "5": "5 บ้านไม้" }
    const villageMap: Record<string, string> = {};
    uniqueVillages.forEach((village: string) => {
      const code = village.split(' ')[0]; // ดึก "3" จาก "3 หมู่บ้านสรานนท์"
      villageMap[code] = village; // เก็บชื่อเต็ม (หลัง code)
    });

    console.log(`Mapped ${uniqueVillages.size} unique villages:`, villageMap);
    return NextResponse.json(villageMap);
  } catch (err) {
    console.error('GET Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
