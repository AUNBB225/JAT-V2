import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting reset parcels...');

    // Get all parcel IDs first
    const { data: parcels, error: fetchError } = await supabase
      .from('parcels')
      .select('id');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${parcels?.length || 0} parcels to reset`);

    if (!parcels || parcels.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No parcels to reset' 
      });
    }

    // Update each parcel
    const parcelIds = parcels.map(p => p.id);
    
    const { error: updateError } = await supabase
      .from('parcels')
      .update({ 
        on_truck: false,
        parcel_count: 0
      })
      .in('id', parcelIds);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('Reset completed successfully');

    return NextResponse.json({ 
      success: true, 
      message: `Reset ${parcelIds.length} parcels successfully`,
      count: parcelIds.length
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
