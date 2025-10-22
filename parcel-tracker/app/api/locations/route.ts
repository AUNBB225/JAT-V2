import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('parcels')
    .select('sub_district, village')
    .order('sub_district')
    .order('village');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // จัดกลุ่มตามตำบล
  const locations: Record<string, string[]> = {};
  
  data.forEach((item) => {
    if (!locations[item.sub_district]) {
      locations[item.sub_district] = [];
    }
    if (!locations[item.sub_district].includes(item.village)) {
      locations[item.sub_district].push(item.village);
    }
  });

  // เรียงลำดับหมู่
  Object.keys(locations).forEach(sub => {
    locations[sub].sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
  });

  return NextResponse.json(locations);
}
