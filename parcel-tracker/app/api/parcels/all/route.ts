import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('parcels')
    .select('*')
    .order('on_truck', { ascending: false })
    .order('display_order', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('GET All Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
