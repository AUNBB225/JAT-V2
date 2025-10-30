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
    ocrFormData.append('apikey', process.env.OCR_SPACE_API_KEY || 'K83663896888957'); // Free API key
    ocrFormData.append('language', 'eng');
    ocrFormData.append('isOverlayRequired', 'false');
    ocrFormData.append('detectOrientation', 'true');
    ocrFormData.append('scale', 'true');
    ocrFormData.append('OCREngine', '2');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: ocrFormData,
    });

    const data = await response.json();

    if (data.IsErroredOnProcessing) {
      return NextResponse.json(
        { error: data.ErrorMessage?.[0] || 'OCR failed' },
        { status: 500 }
      );
    }

    const text = data.ParsedResults?.[0]?.ParsedText || '';

    return NextResponse.json({ text });
  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    );
  }
}
