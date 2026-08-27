import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server-client';
import { APP_CONFIG } from '@/lib/config';

export const runtime = 'nodejs';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, plan } = await req.json();
    if (!sessionId || !plan || !['single', 'monthly'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid session or plan' }, { status: 400 });
    }

    const amount = plan === 'single' ? APP_CONFIG.prices.singleReport : APP_CONFIG.prices.monthly;
    const amountPaise = amount * 100;

    // If Razorpay not configured, return a mock order for testing
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json({
        orderId: `order_mock_${Date.now()}`,
        amount: amountPaise,
        currency: 'INR',
        keyId: null,
        mock: true,
      });
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `session_${sessionId.slice(0, 20)}`,
        notes: {
          session_id: sessionId,
          plan,
        },
      }),
    });

    if (!res.ok) {
      const e = await res.text();
      throw new Error(`Razorpay order creation failed: ${e}`);
    }

    const order = await res.json();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      mock: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Order creation failed' },
      { status: 500 }
    );
  }
}
