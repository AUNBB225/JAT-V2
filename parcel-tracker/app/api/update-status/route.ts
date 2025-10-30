import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parcel_id, on_truck, isDuplicate } = body;

    if (!parcel_id || on_truck === undefined) {
      return NextResponse.json(
        { error: 'Missing parcel_id or on_truck' },
        { status: 400 }
      );
    }

    const updateData: any = {
      on_truck: on_truck,
      updated_at: new Date().toISOString()
    };

    // ถ้าเป็นการสแกนซ้ำ เพิ่มค่า parcel_count
    if (isDuplicate) {
      // Get current count first
      const { data: currentData, error: fetchError } = await supabase
        .from('parcels')
        .select('parcel_count')
        .eq('id', parcel_id)
        .single();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        return NextResponse.json(
          { error: 'Failed to fetch parcel_count' },
          { status: 500 }
        );
      }

      const currentCount = currentData?.parcel_count || 0;
      updateData.parcel_count = currentCount + 1;
    } else {
      // ครั้งแรก ตั้งเป็น 1
      updateData.parcel_count = 1;
    }

    const { data, error } = await supabase
      .from('parcels')
      .update(updateData)
      .eq('id', parcel_id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update parcel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
