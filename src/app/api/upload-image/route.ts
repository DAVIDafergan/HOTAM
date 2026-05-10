import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToS3 } from '@/lib/s3-upload';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImageToS3(buffer, file.name, file.type);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('S3 upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
