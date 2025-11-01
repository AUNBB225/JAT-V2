import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Parcel {
  id: string;
  sub_district: string;
  village: string;
  address: string;
  parcel_count: number;
  on_truck: boolean;
  latitude: string | null;
  longitude: string | null;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}
