// utils/payfastFlow.ts
//
// PayFast top-up via system browser / custom tabs + deep link return.
// Supports: Cards, Instant EFT, Zapper, SnapScan (via PayFast)
// Requires:
//   expo install expo-web-browser expo-linking
//   A custom scheme in app.json (e.g. "dsquare") and Android intent filter
//   Functions deployed: createPayFastPayment, verifyPayFastPayment, payfastITN

import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { app, auth } from '../firebaseConfig';
import { getFunctions, httpsCallable } from 'firebase/functions';

WebBrowser.maybeCompleteAuthSession();

// Use same pattern as PayPal flow
const functions = getFunctions(app, 'us-central1');

// Route inside your app that PayFast will redirect to after payment.
export const PAYFAST_RETURN_PATH = 'payfast-return';

export function buildReturnUrl() {
  // If app.json contains: "scheme": "dsquare"
  // This becomes: dsquare://payfast-return
  // On web it becomes: http(s)://host/payfast-return
  return Linking.createURL(PAYFAST_RETURN_PATH);
}

type CreatePaymentServerResponse = {
  paymentId: string;
  paymentUrl: string;
  paymentData: Record<string, string>;
};

type VerifyPaymentServerResponse = {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  credited?: number;
  currency?: string;
  paymentMethod?: string;
  message?: string;
};

export type PayFastTopUpOutcome =
  | { ok: true; paymentId: string; credited?: number; currency?: string; paymentMethod?: string }
  | { ok: false; reason: 'cancel' | 'dismiss' | 'error'; error?: any };

async function ensureSignedIn() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  // Force fresh token so callable sees request.auth
  await user.getIdToken(true);
}

function extractPaymentIdFromUrl(redirectUrl: string, fallback?: string): string {
  try {
    const parsed = Linking.parse(redirectUrl);
    const qp = (parsed as any)?.queryParams || {};
    // PayFast returns m_payment_id in query params
    const paymentId = qp.m_payment_id || qp.payment_id || fallback || '';
    return paymentId;
  } catch {
    return fallback || '';
  }
}

/** Main flow */
export async function topUpWithPayFast(
  amount: number,
  email?: string
): Promise<PayFastTopUpOutcome> {
  try {
    await ensureSignedIn();

    const returnUrl = buildReturnUrl();
    const cancelUrl = `${returnUrl}?cancel=true`;

    // 1) Create payment - use exact same pattern as PayPal flow
    const createPayment = httpsCallable(functions, 'createPayFastPayment');
    const createRes = await createPayment({
      amount: Number(amount).toFixed(2),
      itemName: 'Wallet Top-up',
      itemDescription: 'Top up your wallet balance',
      returnUrl,
      cancelUrl,
      email: email || auth.currentUser?.email || '',
    });
    
    const data = (createRes.data || {}) as CreatePaymentServerResponse;

    if (!data.paymentUrl || !data.paymentData) {
      throw new Error('Invalid PayFast response');
    }

    // 2) Build PayFast payment URL with form data
    const formData = new URLSearchParams();
    Object.entries(data.paymentData).forEach(([key, value]) => {
      if (value) {
        formData.append(key, value);
      }
    });
    
    const paymentUrl = `${data.paymentUrl}?${formData.toString()}`;

    console.log('PayFast payment URL created:', paymentUrl.substring(0, 100) + '...');

    // Nice-to-have: warm up custom tabs on Android
    if (Platform.OS === 'android') {
      try { await WebBrowser.warmUpAsync(); } catch {}
    }

    // 3) Open PayFast payment page in system browser / custom tab
    const result = await WebBrowser.openAuthSessionAsync(paymentUrl, returnUrl);
    console.log('openAuthSession result:', result);

    // 'cancel' | 'dismiss' (user closed) | 'success' (redirect matched returnUrl)
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, reason: result.type };
    }
    if (result.type !== 'success') {
      return { ok: false, reason: 'error', error: new Error(`Auth session: ${result.type}`) };
    }

    // 4) Extract paymentId from deep link (fallback to original response)
    const paymentId = extractPaymentIdFromUrl(result.url, data.paymentId);
    console.log('parsed paymentId:', paymentId, 'redirectUrl:', result.url);
    
    if (!paymentId) {
      throw new Error('Missing paymentId from redirect');
    }

    // 5) Verify the payment (ITN webhook will handle it, but verify for immediate feedback)
    const verify = httpsCallable(functions, 'verifyPayFastPayment');
    
    const invokeVerify = async () => {
      return await verify({ paymentId });
    };
    
    let verifyRes;
    try {
      verifyRes = await invokeVerify();
    } catch (e: any) {
      // Retry once if auth error
      if (e?.code === 'unauthenticated' || e?.message?.includes('Unauthorized')) {
        await auth.currentUser?.getIdToken(true);
        verifyRes = await invokeVerify();
      } else {
        throw e;
      }
    }
    
    const verifyData = (verifyRes.data || {}) as VerifyPaymentServerResponse;
    console.log('verify response:', verifyData);

    if (verifyData.status === 'SUCCESS') {
      return {
        ok: true,
        paymentId,
        credited: typeof verifyData.credited === 'number' ? verifyData.credited : undefined,
        currency: verifyData.currency,
        paymentMethod: verifyData.paymentMethod,
      };
    }

    // If status is PENDING, webhook will handle it
    // Return success but note it's pending
    return {
      ok: true,
      paymentId,
      // credited will be updated when webhook processes
    };
  } catch (error) {
    console.log('topUpWithPayFast error:', error);
    return { ok: false, reason: 'error', error };
  } finally {
    if (Platform.OS === 'android') {
      try { await WebBrowser.coolDownAsync(); } catch {}
    }
  }
}

/** For debugging if you already have a payment URL */
export async function openPaymentUrlDirect(paymentUrl: string) {
  const returnUrl = buildReturnUrl();
  return WebBrowser.openAuthSessionAsync(paymentUrl, returnUrl);
}

/** Optional: external deep-link listener (usually not needed with openAuthSessionAsync) */
export function subscribePayFastReturn(handler: (url: string) => void) {
  const sub = Linking.addEventListener('url', (ev) => handler(ev.url));
  return () => sub.remove();
}

