import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    // Update display_order สำหรับแต่ละ item
    const updates = items.map(item => 
      supabase
        .from('parcels')
        .update({ display_order: item.display_order })
        .eq('id', item.id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true, updated: items.length });
  } catch (err) {
    console.error('Reorder Exception:', err);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }
}
