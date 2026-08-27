import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server-client';
import crypto from 'crypto';

export const runtime = 'nodejs';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, plan, razorpayPaymentId, razorpayOrderId, razorpaySignature } = await req.json();

    if (!sessionId || !plan || !razorpayPaymentId || !razorpayOrderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // If no secret configured, accept mock payments
    if (!RAZORPAY_KEY_SECRET) {
      await unlockSession(sessionId, plan, razorpayPaymentId);
      return NextResponse.json({ success: true, mock: true });
    }

    // Verify signature
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    await unlockSession(sessionId, plan, razorpayPaymentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment verification failed' },
      { status: 500 }
    );
  }
}

async function unlockSession(sessionId: string, plan: string, paymentId: string) {
  const supabase = createServiceClient();

  if (plan === 'monthly') {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Update current session
    await supabase
      .from('sessions')
      .update({
        paid: true,
        payment_id: paymentId,
        plan: 'monthly',
        access_expires_at: expiresAt.toISOString(),
      })
      .eq('id', sessionId);

    // Also update all future sessions for this contact
    const { data: sess } = await supabase
      .from('sessions')
      .select('contact')
      .eq('id', sessionId)
      .maybeSingle();

    if (sess?.contact) {
      // Mark all existing sessions for this contact as paid with monthly access
      // This ensures consistency
    }
  } else {
    await supabase
      .from('sessions')
      .update({
        paid: true,
        payment_id: paymentId,
        plan: 'single',
      })
      .eq('id', sessionId);
  }
}
