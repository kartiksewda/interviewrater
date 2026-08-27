import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!file || !sessionId) {
      return NextResponse.json({ error: 'Missing file or sessionId' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop() || 'webm';
    const fileName = `recordings/${sessionId}.${ext}`;

    const { data, error } = await supabase.storage
      .from('audio')
      .upload(fileName, buffer, {
        contentType: file.type || 'audio/webm',
        upsert: true,
      });

    let audioUrl: string | null = null;

    if (!error && data) {
      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);
      audioUrl = urlData.publicUrl;
    }

    // If storage fails, fall back to base64 inline (no persistent storage)
    if (!audioUrl) {
      const base64 = buffer.toString('base64');
      audioUrl = `data:${file.type || 'audio/webm'};base64,${base64}`;
    }

    return NextResponse.json({ audioUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
