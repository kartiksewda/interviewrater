'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { APP_CONFIG } from '@/lib/config';
import { formatINR } from '@/lib/format';
import { Mic, ArrowLeft, Lock, Loader2, CheckCircle2, Shield, Volume2 } from 'lucide-react';

export default function PaywallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <PaywallPageContent />
    </Suspense>
  );
}

function PaywallPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const role = params.get('role');
  const [paying, setPaying] = useState(false);
  const [contact, setContact] = useState('');

  useEffect(() => {
    const savedContact = localStorage.getItem('iq_contact');
    if (savedContact) setContact(savedContact);
  }, []);

  async function handlePayment(plan: 'single' | 'monthly') {
    setPaying(true);
    try {
      // For monthly, we need to create a session first, then pay
      // For single, same — but we need to go through setup to get a question
      // Actually, this page is reached when trying to start a 2nd+ attempt
      // We should redirect to setup after payment

      // Create order
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'paywall_' + Date.now(),
          plan,
        }),
      });

      if (!orderRes.ok) throw new Error('Could not create payment order');
      const order = await orderRes.json();

      if (order.mock) {
        if (plan === 'monthly') {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          localStorage.setItem('iq_access_expires_at', expires.toISOString());
        }
        toast({ title: 'Payment successful! You can now start your interview.' });
        router.push('/interview/setup');
        return;
      }

      // Load Razorpay
      await loadRazorpayScript();

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: APP_CONFIG.name,
        description: plan === 'single' ? 'Unlock single report' : 'Unlimited reports for 30 days',
        order_id: order.orderId,
        handler: async function (response: any) {
          if (plan === 'monthly') {
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            localStorage.setItem('iq_access_expires_at', expires.toISOString());

            // Update all sessions for this contact
            if (contact) {
              await supabase
                .from('sessions')
                .update({
                  paid: true,
                  plan: 'monthly',
                  access_expires_at: expires.toISOString(),
                })
                .eq('contact', contact);
            }
          } else {
            // Single report - store payment and redirect to setup
            localStorage.setItem('iq_single_payment', JSON.stringify({
              paymentId: response.razorpay_payment_id,
              used: false,
            }));
          }

          toast({ title: 'Payment successful! You can now start your interview.' });
          router.push('/interview/setup');
          setPaying(false);
        },
        theme: { color: '#1d4ed8' },
        modal: {
          ondismiss: () => setPaying(false),
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

  return (
    <div className="min-h-screen bg-secondary/20">
      <nav className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">{APP_CONFIG.name}</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => router.push('/interview/setup')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <Card className="border-primary/30">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Unlock More Practice</CardTitle>
            <CardDescription>Your first attempt is free. Choose a plan below to continue practicing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={() => handlePayment('single')}
                disabled={paying}
                className="text-left p-5 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Single Report</span>
                  <span className="text-2xl font-bold text-primary">{formatINR(APP_CONFIG.prices.singleReport)}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">One interview attempt + full report</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Full detailed report</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Rewritten model answer</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Download as PDF</li>
                </ul>
              </button>

              <button
                onClick={() => handlePayment('monthly')}
                disabled={paying}
                className="text-left p-5 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-50 relative"
              >
                <Badge className="absolute -top-2.5 right-3">Best Value</Badge>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Monthly Plan</span>
                  <span className="text-2xl font-bold text-primary">{formatINR(APP_CONFIG.prices.monthly)}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Unlimited attempts for 30 days</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Unlimited reports</li>
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
      </div>
    </div>
  );
}
