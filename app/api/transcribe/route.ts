import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { audioUrl, sessionId } = await req.json();
    if (!audioUrl || !sessionId) {
      return NextResponse.json({ error: 'Missing audioUrl or sessionId' }, { status: 400 });
    }

    if (!ASSEMBLYAI_API_KEY) {
      // Fallback: create a placeholder transcript if no API key configured
      const placeholder = '[No transcription API configured. Please add ASSEMBLYAI_API_KEY environment variable. This is a placeholder transcript for testing purposes.]';
      await saveTranscript(sessionId, placeholder, audioUrl);
      return NextResponse.json({ transcript: placeholder });
    }

    // If audioUrl is a data URI, upload to AssemblyAI first
    let uploadUrl = audioUrl;
    if (audioUrl.startsWith('data:')) {
      const base64Data = audioUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          Authorization: ASSEMBLYAI_API_KEY,
        },
        body: buffer,
      });
      if (!uploadRes.ok) {
        const e = await uploadRes.text();
        throw new Error(`AssemblyAI upload failed: ${e}`);
      }
      const uploadData = await uploadRes.json();
      uploadUrl = uploadData.upload_url;
    }

    // Submit transcription request with disfluencies enabled
    const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        disfluencies: true,
        speech_model: 'best',
      }),
    });

    if (!submitRes.ok) {
      const e = await submitRes.text();
      throw new Error(`AssemblyAI submit failed: ${e}`);
    }

    const submitData = await submitRes.json();
    const transcriptId = submitData.id;

    // Poll for completion
    let transcriptText = '';
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { Authorization: ASSEMBLYAI_API_KEY },
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      if (pollData.status === 'completed') {
        transcriptText = pollData.text || '';
        break;
      }
      if (pollData.status === 'error') {
        throw new Error(`Transcription failed: ${pollData.error}`);
      }
    }

    if (!transcriptText) {
      throw new Error('Transcription timed out. Please try again.');
    }

    await saveTranscript(sessionId, transcriptText, audioUrl);
    return NextResponse.json({ transcript: transcriptText });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}

async function saveTranscript(sessionId: string, text: string, audioUrl: string) {
  try {
    const supabase = createServiceClient();
    await supabase.from('transcripts').insert({
      session_id: sessionId,
      raw_text: text,
      audio_url: audioUrl.startsWith('data:') ? null : audioUrl,
    });
  } catch {
    // Non-fatal — report can still be generated
  }
}
