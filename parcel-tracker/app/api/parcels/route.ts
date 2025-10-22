import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subDistrict = searchParams.get('sub_district');
  const village = searchParams.get('village');

  let query = supabase.from('parcels').select('*');

  if (subDistrict) {
    query = query.eq('sub_district', subDistrict);
  }
  if (village) {
    query = query.eq('village', village);
  }

  // เรียงลำดับ: on_truck = true ก่อน (descending), แล้วตาม display_order (ascending)
  const { data, error } = await query
    .order('on_truck', { ascending: false })
    .order('display_order', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('POST Body:', body);
    
    // ตรวจสอบว่ามีข้อมูลซ้ำหรือไม่
    const { data: existing } = await supabase
      .from('parcels')
      .select('id')
      .eq('sub_district', body.sub_district)
      .eq('village', body.village)
      .eq('address', body.address)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'ที่อยู่นี้มีอยู่ในระบบแล้ว' }, 
        { status: 409 }
      );
    }

    // หา display_order สูงสุด
    const { data: maxOrder } = await supabase
      .from('parcels')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    // เพิ่มข้อมูลใหม่
    const { data, error } = await supabase
      .from('parcels')
      .insert([
        {
          sub_district: body.sub_district,
          village: body.village,
          address: body.address,
          parcel_count: body.parcel_count || 0,
          on_truck: body.on_truck || false,
          latitude: body.latitude || null,
          longitude: body.longitude || null,
          display_order: nextOrder,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('POST Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST Exception:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
