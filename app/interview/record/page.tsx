'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { APP_CONFIG } from '@/lib/config';
import type { Session, Question } from '@/lib/types';
import { Mic, Square, ArrowLeft, RotateCcw, ArrowRight, Loader2, AlertCircle, Clock } from 'lucide-react';

const LOADING_STEPS = [
  'Transcribing your answer...',
  'Analyzing structure...',
  'Generating your report...',
];

export default function RecordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <RecordPageContent />
    </Suspense>
  );
}

function RecordPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const sessionId = params.get('session');

  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.push('/interview/setup');
      return;
    }
    async function load() {
      const { data: sess, error: e1 } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId!)
        .maybeSingle();
      if (e1 || !sess) {
        toast({ title: 'Session not found', variant: 'destructive' });
        router.push('/interview/setup');
        return;
      }
      setSession(sess as Session);
      const { data: q } = await supabase
        .from('questions')
        .select('id, role, question_text, category')
        .eq('id', sess.question_id)
        .maybeSingle();
      if (q) setQuestion(q as Question);
      setLoading(false);
    }
    load();
  }, [sessionId, router, toast]);

  const startTimer = useCallback(() => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s >= APP_CONFIG.maxRecordingSeconds) {
          stopRecording();
          return s;
        }
        return s + 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  async function startRecording() {
    setError(null);
    setRecordedBlob(null);
    setRecordedUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
      mr.start();
      setRecording(true);
      startTimer();
    } catch (err) {
      setError('Could not access microphone. Please allow microphone permission and try again.');
      toast({ title: 'Microphone access denied', variant: 'destructive' });
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    stopTimer();
  }

  function resetRecording() {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setSeconds(0);
  }

  async function submitForFeedback() {
    if (!recordedBlob || !sessionId) return;
    setSubmitting(true);
    setError(null);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 4000);

    try {
      // Upload audio
      const formData = new FormData();
      const ext = recordedBlob.type.includes('webm') ? 'webm' : 'audio';
      formData.append('file', recordedBlob, `recording.${ext}`);
      formData.append('sessionId', sessionId);

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const e = await uploadRes.json().catch(() => ({}));
        throw new Error(e.error || 'Upload failed');
      }
      const { audioUrl } = await uploadRes.json();

      setLoadingStep(1);

      // Transcribe
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl, sessionId }),
      });
      if (!transcribeRes.ok) {
        const e = await transcribeRes.json().catch(() => ({}));
        throw new Error(e.error || 'Transcription failed');
      }
      const { transcript } = await transcribeRes.json();

      if (!transcript || transcript.trim().length < 10) {
        throw new Error('No speech detected in recording. Please try again and speak clearly.');
      }

      setLoadingStep(2);

      // Score
      const scoreRes = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          role: session?.role,
          question: question?.question_text,
          sessionId,
        }),
      });
      if (!scoreRes.ok) {
        const e = await scoreRes.json().catch(() => ({}));
        throw new Error(e.error || 'Scoring failed');
      }

      clearInterval(stepInterval);
      router.push(`/interview/report?session=${sessionId}`);
    } catch (err) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const remaining = APP_CONFIG.maxRecordingSeconds - seconds;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/20 px-4">
        <div className="text-center max-w-md w-full">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-secondary" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">{LOADING_STEPS[loadingStep]}</h2>
          <p className="text-sm text-muted-foreground">This usually takes 30-60 seconds. Please don't close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <nav className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push('/interview/setup')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <span className="text-sm text-muted-foreground">Recording Session</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">1</div>
            Setup
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2 text-primary font-medium">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">2</div>
            Record
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">3</div>
            Report
          </div>
        </div>

        {/* Question */}
        {question && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="capitalize">{question.category}</Badge>
                <Badge variant="outline" className="capitalize">{session?.role.replace('_', ' ')}</Badge>
              </div>
              <CardTitle className="text-xl leading-relaxed">{question.question_text}</CardTitle>
            </CardHeader>
          </Card>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setError(null)}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Recording interface */}
        {!recordedUrl && !recording && (
          <Card className="text-center py-12">
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-8">Tap the button below to start recording your answer. Speak clearly as if you're in the real interview.</p>
              <button
                onClick={startRecording}
                className="relative w-24 h-24 rounded-full bg-primary flex items-center justify-center mx-auto hover:scale-105 transition-transform shadow-lg"
                aria-label="Start recording"
              >
                <Mic className="h-10 w-10 text-white" />
              </button>
              <p className="mt-4 text-sm font-medium">Tap to start recording</p>
              <p className="mt-1 text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Max {Math.floor(APP_CONFIG.maxRecordingSeconds / 60)} minutes
              </p>
            </CardContent>
          </Card>
        )}

        {recording && (
          <Card className="text-center py-12">
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-red-600 mb-2 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> Recording
              </div>
              <div className="text-5xl font-bold tabular-nums mb-2">{formatTime(seconds)}</div>
              <div className="text-sm text-muted-foreground mb-8">{remaining}s remaining</div>
              <button
                onClick={stopRecording}
                className="relative w-24 h-24 rounded-full bg-red-600 flex items-center justify-center mx-auto animate-pulse-ring shadow-lg"
                aria-label="Stop recording"
              >
                <Square className="h-9 w-9 text-white" fill="white" />
              </button>
              <p className="mt-4 text-sm font-medium">Tap to stop recording</p>
            </CardContent>
          </Card>
        )}

        {/* Playback */}
        {recordedUrl && !recording && (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" /> Your Recording
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> Duration: {formatTime(seconds)}
              </div>
              <audio ref={audioRef} src={recordedUrl} controls className="w-full" />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="gap-2 flex-1" onClick={resetRecording}>
                  <RotateCcw className="h-4 w-4" /> Re-record
                </Button>
                <Button className="gap-2 flex-1" onClick={submitForFeedback}>
                  Submit for Feedback <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
