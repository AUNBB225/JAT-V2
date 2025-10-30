import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Create form data for OCR Space API
    const ocrFormData = new FormData();
    ocrFormData.append('file', image);
    ocrFormData.append('apikey', process.env.OCR_SPACE_API_KEY || 'K87899142388957'); // Free API key
    ocrFormData.append('language', 'eng');
    ocrFormData.append('isOverlayRequired', 'false');
    ocrFormData.append('detectOrientation', 'true');
    ocrFormData.append('scale', 'true');
    ocrFormData.append('OCREngine', '2');

    console.log('Sending to OCR Space API...');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: ocrFormData,
    });

    if (!response.ok) {
      console.error('OCR API HTTP error:', response.status);
      return NextResponse.json(
        { error: `OCR API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log('OCR API Response:', JSON.stringify(data, null, 2));

    if (data.IsErroredOnProcessing) {
      console.error('OCR Processing Error:', data.ErrorMessage);
      return NextResponse.json(
        { error: data.ErrorMessage?.[0] || 'OCR failed' },
        { status: 500 }
      );
    }

    const text = data.ParsedResults?.[0]?.ParsedText || '';
    console.log('Extracted text length:', text.length);

    return NextResponse.json({ text });
  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Failed to process image: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
