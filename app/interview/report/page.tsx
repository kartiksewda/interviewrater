'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { APP_CONFIG } from '@/lib/config';
import type { Session, InterviewReport } from '@/lib/types';
import { formatINR, getScoreColor, getScoreBg } from '@/lib/format';
import {
  Mic, ArrowLeft, ArrowRight, Lock, Loader2, CheckCircle2, Download,
  RotateCcw, Sparkles, TrendingUp, MessageSquareQuote, Target,
  Volume2, Shield, Star, AlertTriangle, FileText
} from 'lucide-react';

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ReportPageContent />
    </Suspense>
  );
}

function ReportPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const sessionId = params.get('session');

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.push('/interview/setup');
      return;
    }
    loadData();
  }, [sessionId]);

  async function loadData() {
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId!)
      .maybeSingle();

    if (!sess) {
      toast({ title: 'Session not found', variant: 'destructive' });
      router.push('/interview/setup');
      return;
    }

    setSession(sess as Session);

    // Check if already paid or has active monthly access
    const hasMonthlyAccess =
      sess.access_expires_at && new Date(sess.access_expires_at) > new Date();
    if (sess.paid || hasMonthlyAccess) {
      setUnlocked(true);
    }

    // Also check localStorage for monthly access from another session
    const localExpiry = localStorage.getItem('iq_access_expires_at');
    if (localExpiry && new Date(localExpiry) > new Date() && !hasMonthlyAccess) {
      setUnlocked(true);
    }

    // Load report
    const { data: reportData } = await supabase
      .from('reports')
      .select('report_json')
      .eq('session_id', sessionId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportData?.report_json) {
      setReport(reportData.report_json as InterviewReport);
    }

    setLoading(false);
  }

  async function handlePayment(plan: 'single' | 'monthly') {
    if (!sessionId) return;
    setPaying(true);

    try {
      // Create order
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, plan }),
      });
      if (!orderRes.ok) throw new Error('Could not create payment order');
      const order = await orderRes.json();

      // If mock mode (no Razorpay configured), verify directly
      if (order.mock) {
        const verifyRes = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            plan,
            razorpayPaymentId: `pay_mock_${Date.now()}`,
            razorpayOrderId: order.orderId,
            razorpaySignature: 'mock',
          }),
        });
        if (!verifyRes.ok) throw new Error('Payment verification failed');
        
        if (plan === 'monthly') {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          localStorage.setItem('iq_access_expires_at', expires.toISOString());
        }
        
        setUnlocked(true);
        toast({ title: 'Payment successful! Report unlocked.' });
        setPaying(false);
        return;
      }

      // Load Razorpay checkout script
      await loadRazorpayScript();

      // Open Razorpay checkout
      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: APP_CONFIG.name,
        description: plan === 'single' ? 'Unlock single report' : 'Unlimited reports for 30 days',
        order_id: order.orderId,
        handler: async function (response: any) {
          // Verify payment server-side
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              plan,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          if (!verifyRes.ok) {
            toast({ title: 'Payment verification failed', variant: 'destructive' });
            setPaying(false);
            return;
          }

          if (plan === 'monthly') {
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            localStorage.setItem('iq_access_expires_at', expires.toISOString());
          }

          setUnlocked(true);
          toast({ title: 'Payment successful! Report unlocked.' });
          setPaying(false);
        },
        prefill: {
          name: session?.name || '',
        },
        theme: { color: '#1d4ed8' },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      toast({
        title: 'Payment failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
      setPaying(false);
    }
  }

  function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load payment gateway'));
      document.body.appendChild(script);
    });
  }

  function handlePrint() {
    window.print();
  }

  function tryAnother() {
    router.push('/interview/setup');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/20 px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Report not found</h2>
            <p className="text-muted-foreground mb-6">We couldn't find your report. This may happen if the analysis didn't complete.</p>
            <Button onClick={tryAnother} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scoreColor = getScoreColor(report.overall_score);
  const scoreBg = getScoreBg(report.overall_score);

  return (
    <div className="min-h-screen bg-secondary/20">
      <nav className="border-b bg-white no-print">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">{APP_CONFIG.name}</span>
          </Link>
          {unlocked && (
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm no-print">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">1</div>
            Setup
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">2</div>
            Record
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2 text-primary font-medium">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">3</div>
            Report
          </div>
        </div>

        {/* Header */}
        <div className="mb-6">
          <Badge variant="secondary" className="capitalize mb-2">{session?.role.replace('_', ' ')}</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Interview Report</h1>
        </div>

        {/* Free teaser: Overall score */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">Overall Score</p>
              <div className={`text-7xl font-bold ${scoreColor}`}>{report.overall_score}</div>
              <div className="text-lg text-muted-foreground mt-1">out of 100</div>
              <div className="mt-4 max-w-xs mx-auto">
                <Progress value={report.overall_score} className="h-2" />
              </div>
            </div>

            {/* Headline insight - FREE */}
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold mb-1">Key Insight</p>
                  <p className="text-sm text-foreground">{report.headline_insight}</p>
                </div>
              </div>
            </div>

            {/* STAR verdict - FREE */}
            <div className="mt-4 flex items-center gap-3 p-4 rounded-lg bg-secondary">
              <Star className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">STAR Structure</p>
                <p className="text-sm text-muted-foreground">
                  Verdict: <span className="font-semibold text-foreground">{report.structure.verdict}</span>
                </p>
              </div>
              <Badge variant={report.structure.verdict === 'Present' ? 'default' : report.structure.verdict === 'Weak' ? 'secondary' : 'destructive'}>
                {report.structure.score}/10
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Paywall (if not unlocked) */}
        {!unlocked && (
          <Card className="mb-6 border-primary/30 no-print">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Unlock Your Full Report</CardTitle>
              <CardDescription>Get detailed scores, quoted examples from your answer, and a rewritten model answer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Single report */}
                <button
                  onClick={() => handlePayment('single')}
                  disabled={paying}
                  className="text-left p-5 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Single Report</span>
                    <span className="text-2xl font-bold text-primary">{formatINR(APP_CONFIG.prices.singleReport)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Unlock this report permanently</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> All 5 detailed scores</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Quoted examples from your answer</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Rewritten model answer</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Download as PDF</li>
                  </ul>
                </button>

                {/* Monthly */}
                <button
                  onClick={() => handlePayment('monthly')}
                  disabled={paying}
                  className="text-left p-5 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-50 relative"
                >
                  <Badge className="absolute -top-2.5 right-3" >Best Value</Badge>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Monthly Plan</span>
                    <span className="text-2xl font-bold text-primary">{formatINR(APP_CONFIG.prices.monthly)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Unlimited reports for 30 days</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Everything in single report</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Unlimited practice attempts</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> All roles included</li>
                    <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> No per-report payment</li>
                  </ul>
                </button>
              </div>

              {paying && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing payment...
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Secure payment</span>
                <span className="flex items-center gap-1"><Volume2 className="h-3 w-3" /> UPI / Cards / Net banking</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Locked preview sections */}
        {!unlocked && (
          <div className="space-y-4 no-print">
            {[
              { icon: Target, title: 'Specificity Breakdown', desc: 'See your specificity score and the vaguest quote from your answer' },
              { icon: Volume2, title: 'Filler Word Analysis', desc: 'Total count, frequency per 100 words, and most common fillers' },
              { icon: MessageSquareQuote, title: 'Confidence Language', desc: 'Hedging vs confident language examples from your transcript' },
              { icon: TrendingUp, title: 'Role-Relevant Correctness', desc: 'How your answer holds up for your specific target role' },
              { icon: FileText, title: 'Rewritten Model Answer', desc: 'A STAR-format rewrite using your own real examples' },
            ].map((item) => (
              <Card key={item.title} className="opacity-60">
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Full unlocked report */}
        {unlocked && report && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Structure */}
            <ReportSection
              icon={Star}
              title="Structure (STAR Method)"
              score={report.structure.score}
              badge={report.structure.verdict}
            >
              <p className="text-sm text-foreground leading-relaxed">{report.structure.explanation}</p>
            </ReportSection>

            {/* Specificity */}
            <ReportSection
              icon={Target}
              title="Specificity"
              score={report.specificity.score}
            >
              <p className="text-sm text-foreground leading-relaxed mb-3">{report.specificity.explanation}</p>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-medium text-amber-700 mb-1">Vague quote from your answer:</p>
                <p className="text-sm italic text-amber-900">&ldquo;{report.specificity.vague_quote_example}&rdquo;</p>
              </div>
            </ReportSection>

            {/* Filler words */}
            <ReportSection
              icon={Volume2}
              title="Filler Word Frequency"
              score={report.filler_words.score}
            >
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <div className="text-2xl font-bold">{report.filler_words.count}</div>
                  <div className="text-xs text-muted-foreground">Total fillers</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <div className="text-2xl font-bold">{report.filler_words.per_100_words}</div>
                  <div className="text-xs text-muted-foreground">Per 100 words</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary">
                  <div className="text-2xl font-bold">{report.filler_words.most_common.length}</div>
                  <div className="text-xs text-muted-foreground">Common fillers</div>
                </div>
              </div>
              {report.filler_words.most_common.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {report.filler_words.most_common.map((word, i) => (
                    <Badge key={i} variant="secondary">&ldquo;{word}&rdquo;</Badge>
                  ))}
                </div>
              )}
            </ReportSection>

            {/* Confidence language */}
            <ReportSection
              icon={MessageSquareQuote}
              title="Confidence vs Hedging"
              score={report.confidence_language.score}
            >
              <div className="space-y-3">
                {report.confidence_language.hedging_example && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs font-medium text-red-700 mb-1">Hedging language:</p>
                    <p className="text-sm italic text-red-900">&ldquo;{report.confidence_language.hedging_example}&rdquo;</p>
                  </div>
                )}
                {report.confidence_language.confident_example && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-medium text-emerald-700 mb-1">Confident language:</p>
                    <p className="text-sm italic text-emerald-900">&ldquo;{report.confidence_language.confident_example}&rdquo;</p>
                  </div>
                )}
                {!report.confidence_language.hedging_example && !report.confidence_language.confident_example && (
                  <p className="text-sm text-muted-foreground">No strong hedging or confident language detected.</p>
                )}
              </div>
            </ReportSection>

            {/* Role correctness */}
            <ReportSection
              icon={TrendingUp}
              title="Role-Relevant Correctness"
              score={report.role_correctness.score}
              badge={session?.role.replace('_', ' ')}
            >
              <p className="text-sm text-foreground leading-relaxed">{report.role_correctness.explanation}</p>
            </ReportSection>

            {/* Rewritten answer */}
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-lg">Rewritten Model Answer</CardTitle>
                </div>
                <CardDescription>A stronger STAR-format version using your own real examples</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm leading-relaxed text-foreground">{report.rewritten_answer}</p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 no-print">
              <Button onClick={tryAnother} className="gap-2 flex-1">
                <RotateCcw className="h-4 w-4" /> Try Another Question
              </Button>
              <Button variant="outline" onClick={handlePrint} className="gap-2 flex-1">
                <Download className="h-4 w-4" /> Download as PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportSection({
  icon: Icon,
  title,
  score,
  badge,
  children,
}: {
  icon: any;
  title: string;
  score: number;
  badge?: string;
  children: React.ReactNode;
}) {
  const color = getScoreColor(score * 10);
  const bg = getScoreBg(score * 10);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">{title}</CardTitle>
            {badge && <Badge variant="secondary" className="capitalize">{badge}</Badge>}
          </div>
          <div className="text-right">
            <span className={`text-lg font-bold ${color}`}>{score}</span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
        </div>
        <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full ${bg} rounded-full transition-all`} style={{ width: `${score * 10}%` }} />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
