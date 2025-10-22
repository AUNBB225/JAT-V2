import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('parcels')
      .update({
        sub_district: body.sub_district,
        village: body.village,
        address: body.address,
        parcel_count: body.parcel_count,
        on_truck: body.on_truck,
        latitude: body.latitude,
        longitude: body.longitude,
      })
      .eq('sub_district', body.sub_district)
      .eq('village', body.village)
      .eq('address', body.address)
      .select()
      .single();

    if (error) {
      console.error('PUT Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT Exception:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    const { error } = await supabase
      .from('parcels')
      .delete()
      .eq('sub_district', body.sub_district)
      .eq('village', body.village)
      .eq('address', body.address);

    if (error) {
      console.error('DELETE Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE Exception:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
