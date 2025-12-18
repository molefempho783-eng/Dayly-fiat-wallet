// functions/src/index.ts

import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

import corsLib from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';

import { onDocumentUpdated, onDocumentCreated  } from 'firebase-functions/v2/firestore';


// ---------- App currency ----------
const APP_DEFAULT_CCY = 'ZAR';
const getBaseCurrency = (): string =>
  (process.env.APP_BASE_CURRENCY || APP_DEFAULT_CCY).toUpperCase();

// ---------- PayFast Configuration ----------
// Note: PAYFAST_ENV is a secret, so we'll read it at runtime in functions
// For now, default to sandbox
const getPayFastBaseUrl = (): string => {
  const env = (process.env.PAYFAST_ENV || 'sandbox').toLowerCase();
  return env === 'live' ? 'https://www.payfast.co.za' : 'https://sandbox.payfast.co.za';
};

// ---------- Admin init ----------
if (getApps().length === 0) initializeApp();
const db = getFirestore();
const messaging = getMessaging();
const authAdmin = getAuth();

// ---------- Helpers ----------
const cors = corsLib({ origin: true });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new HttpsError('failed-precondition', `Missing secret: ${name}`);
  return v;
}
function uidOrThrow(req: { auth?: { uid?: string } }): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');
  return uid;
}

function previewFromMessage(msg: any): string {
  if (typeof msg?.text === 'string' && msg.text.trim()) return msg.text.trim().slice(0, 140);
  if (msg?.mediaType === 'image') return 'Image 📸';
  if (msg?.mediaType === 'video') return 'Video 🎥';
  if (msg?.mediaType === 'file')  return `File 📄${msg?.fileName ? `: ${String(msg.fileName)}` : ''}`;
  return 'New message';
}

//-------------push notification ---------------

/**
 * Send FCM push notification to one or more tokens
 */
async function sendFCMPush(
  to: string[] | string,
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  const tokens = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (tokens.length === 0) return;

  // FCM supports up to 500 tokens per batch
  const batchSize = 500;
  
  for (let i = 0; i < tokens.length; i += batchSize) {
    const chunk = tokens.slice(i, i + batchSize);
    
    try {
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {} as Record<string, string>),
        },
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
        tokens: chunk,
      };

      const response = await messaging.sendEachForMulticast(message);
      
      // Log results
      logger.info(`FCM sent to ${response.successCount}/${chunk.length} tokens`);
      
      // Handle failures
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.warn(`FCM send failed for token ${chunk[idx].substring(0, 20)}...:`, resp.error);
            // Optional: Remove invalid tokens
            // if (resp.error?.code === 'messaging/invalid-registration-token' || 
            //     resp.error?.code === 'messaging/registration-token-not-registered') {
            //   await removeBadTokenFromAllUsers(chunk[idx]);
            // }
          }
        });
      }
    } catch (error: any) {
      logger.error('FCM send error:', error);
    }
  }
}


// ---------- FX Conversion with robust fallback ----------
async function fxConvert(amount: number, from: string, to: string): Promise<number> {
  if (from.toUpperCase() === to.toUpperCase()) return Number(amount);

  const _from = from.toUpperCase();
  const _to = to.toUpperCase();
  const aStr = String(amount);
  const fxKey = (process.env.FX_API_KEY || '').trim();

  const getJson = async (url: string, headers: Record<string,string> = {}) => {
    const res = await fetch(url, { headers });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { ok: res.ok, json, text };
    } catch {
      return { ok: res.ok, json: null as any, text };
    }
  };

  // 1) Preferred: exchangerate-api.com (requires a valid FX_API_KEY)
  if (fxKey) {
    try {
      const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(fxKey)}/pair/${_from}/${_to}/${encodeURIComponent(aStr)}`;
      const { ok, json, text } = await getJson(url);
      if (ok) {
        const result = json?.conversion_result ?? json?.result ?? null;
        if (typeof result === 'number') return result;
        // explicit API error? fall through to frankfurter
        logger.warn('FX v6 payload not numeric, falling back', text.slice(0, 300));
      } else {
        // known error types: invalid-key, inactive-account, function_access_restricted
        logger.warn('FX v6 HTTP error, falling back', text.slice(0, 300));
      }
    } catch (e:any) {
      logger.warn('FX v6 threw, falling back', e?.message || e);
    }
  }

  // 2) Frankfurter (ECB) – no key required
  try {
    const url = `https://api.frankfurter.app/latest?amount=${encodeURIComponent(aStr)}&from=${_from}&to=${_to}`;
    const { ok, json, text } = await getJson(url);
    if (!ok) throw new Error(`HTTP ${text.slice(0,200)}`);
    const val = json?.rates?.[_to];
    if (typeof val === 'number') return val;
    throw new Error(`Bad payload ${text.slice(0,200)}`);
  } catch (e:any) {
    logger.warn('FX frankfurter failed, falling back to exchangerate.host', e?.message || e);
  }

  // 3) Last resort: exchangerate.host (may require key on some deployments)
  {
    const url = `https://api.exchangerate.host/convert?from=${_from}&to=${_to}&amount=${encodeURIComponent(aStr)}`;
    const { ok, json, text } = await getJson(url);
    if (!ok) throw new HttpsError('internal', `FX HTTP error: ${text.slice(0,200)}`);
    const success = json?.success ?? true;
    const result = json?.result ?? json?.conversion_result ?? null;
    if (!success || typeof result !== 'number') {
      throw new HttpsError('internal', `FX (exchangerate.host) bad payload: ${text.slice(0,300)}`);
    }
    return result;
  }
}

function walletDoc(uid: string) { return db.collection('wallets').doc(uid); }
function txCollection(uid: string) { return walletDoc(uid).collection('transactions'); }

// ---------- Types ----------
type P2PTransferPayload  = { toUid: string; amount: number; note?: string };
type TransactionsPayload = { limit?: number; cursor?: string };
type ConvertPayload      = { amount: number; from: string; to?: string };

// ---------- 1) Currency conversion utility ----------
export const convertCurrency = onCall(
  { secrets: ['FX_API_KEY'] },
  async (request) => {
    const { amount, from, to: _to } = request.data as ConvertPayload;
    const to = (_to || getBaseCurrency()).toUpperCase();
    if (amount == null || isNaN(Number(amount))) throw new HttpsError('invalid-argument', 'Invalid amount');
    if (!from) throw new HttpsError('invalid-argument', 'from currency required');

    const result = await fxConvert(Number(amount), String(from).toUpperCase(), to);
    return { amount: Number(result.toFixed(2)), currency: to };
  }
);

// ---------- PayFast Helpers ----------
import * as crypto from 'crypto';

// PayFast: clean and encode helpers
const cleanPf = (v: any) => (v == null ? '' : String(v).trim());
const encodePf = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');

type PayFastSignatureOpts = { includeEmpty?: boolean; excludeKeys?: string[] };

function buildPayFastQueryString(
  data: Record<string, string>,
  opts: PayFastSignatureOpts = {}
): { queryString: string; sortedKeys: string[] } {
  const includeEmpty = opts.includeEmpty === true;
  const exclude = new Set<string>(opts.excludeKeys ?? ['signature']);
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(data)) {
    if (exclude.has(key)) continue;
    if (value === null || value === undefined) continue;
    const cleaned = cleanPf(value);
    if (!includeEmpty && cleaned === '') continue;
    filtered[key] = cleaned;
  }

  const sortedKeys = Object.keys(filtered).sort();
  const queryString = sortedKeys
    .map((key) => `${key}=${encodePf(filtered[key])}`)
    .join('&');

  return { queryString, sortedKeys };
}

function generatePayFastSignature(
  data: Record<string, string>,
  passphrase: string,
  opts: PayFastSignatureOpts = {}
): string {
  // 1) clean + remove excluded keys
  // 2) sort alphabetically
  // 3) encode with %20→+ for spaces
  // 4) append raw passphrase (not URL-encoded) if present
  const { queryString } = buildPayFastQueryString(data, opts);
  const pf = cleanPf(passphrase);
  const fullString = pf ? `${queryString}&passphrase=${pf}` : queryString;
  return crypto.createHash('md5').update(fullString).digest('hex');
}

// ---------- PayFast Types ----------
type CreatePayFastPaymentPayload = {
  amount: string;
  itemName?: string;
  itemDescription?: string;
  returnUrl?: string;
  cancelUrl?: string;
  email?: string;
  cellNumber?: string;
};

type VerifyPayFastPaymentPayload = {
  paymentId: string;
};

// ---------- PayFast 1) Create Payment ----------
export const createPayFastPayment = onCall(
  { secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE', 'PAYFAST_ENV', 'PAYFAST_ITN_URL'] },
  async (request) => {
    try {
    // PayFast payment creation
    const uid = uidOrThrow(request);
    const data = request.data as CreatePayFastPaymentPayload;
    
    const amountStr = data.amount;
    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
      throw new HttpsError('invalid-argument', 'amount must be a positive number');
    }
    
    const merchantId = cleanPf(process.env.PAYFAST_MERCHANT_ID);
    const merchantKey = cleanPf(process.env.PAYFAST_MERCHANT_KEY);
    const passphrase = cleanPf(process.env.PAYFAST_PASSPHRASE || '');
    
    if (!merchantId || !merchantKey) {
        logger.error('PayFast credentials missing', { hasMerchantId: !!merchantId, hasMerchantKey: !!merchantKey });
        throw new HttpsError('failed-precondition', 'PayFast credentials not configured. Please contact support.');
    }
    
    // Generate unique payment reference
    const paymentId = db.collection('_ids').doc().id;
    
    // Get ITN URL (webhook endpoint)
    const itnUrl = cleanPf(process.env.PAYFAST_ITN_URL || '');
    if (!itnUrl) {
      logger.warn('PayFast ITN URL not configured - webhooks will not work');
    }
    
    // PayFast payment data - only include non-empty fields
    const paymentData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      notify_url: itnUrl,
      m_payment_id: paymentId,
      amount: Number(amountStr).toFixed(2),
      item_name: data.itemName || 'Wallet Top-up',
      item_description: data.itemDescription || `Wallet top-up for user ${uid}`,
      custom_str1: uid, // Store user ID
      custom_str2: 'WALLET_TOPUP',
    };
    
    // Only add optional fields if they have values
    if (data.email && data.email.trim()) {
      paymentData.email_address = data.email.trim();
    }
    if (data.cellNumber && data.cellNumber.trim()) {
      paymentData.cell_number = data.cellNumber.trim();
    }
    
    // Only add return_url and cancel_url if provided and valid HTTP/HTTPS URLs
    if (data.returnUrl && (data.returnUrl.startsWith('http://') || data.returnUrl.startsWith('https://'))) {
      paymentData.return_url = data.returnUrl;
    }
    if (data.cancelUrl && (data.cancelUrl.startsWith('http://') || data.cancelUrl.startsWith('https://'))) {
      paymentData.cancel_url = data.cancelUrl;
    }
    
    // Generate signature BEFORE adding signature field to paymentData
    // PayFast validates signature by: filtering empty values, sorting, encoding, adding passphrase, MD5
    const signingData = { ...paymentData };
    const signature = generatePayFastSignature(signingData, passphrase, { includeEmpty: false });
    
    // Add signature after signing
    paymentData.signature = signature;
    
    // Detailed debug logging for signature troubleshooting
    try {
      // Recreate the signing process for logging (exclude merchant_key/signature)
      const { queryString, sortedKeys } = buildPayFastQueryString(signingData);
      const pf = cleanPf(passphrase);
      const fullString = pf ? `${queryString}&passphrase=${pf}` : queryString;
      
      logger.info('PayFast Signature Debug:', {
        merchant_id: paymentData.merchant_id,
        amount: paymentData.amount,
        m_payment_id: paymentData.m_payment_id,
        fields_in_signature: sortedKeys,
        query_string_length: queryString.length,
        full_string_length: fullString.length,
        signature: signature,
        passphrase_length: passphrase?.length || 0,
        has_passphrase: !!passphrase,
        signing_string: fullString,
      });
    } catch (e: any) {
      logger.error('PayFast Debug Error:', e);
    }

    
    // Store pending payment in Firestore
    await db.collection('pending_payments').doc(paymentId).set({
      uid,
      amount: Number(amountStr),
      currency: 'ZAR',
      status: 'PENDING',
      provider: 'PAYFAST',
      createdAt: Timestamp.now(),
      paymentData: { ...paymentData }, // Store for reference
    });
    
    return {
      paymentId,
      paymentUrl: `${getPayFastBaseUrl()}/eng/process`,
      paymentData, // For form submission
    };
    } catch (error: any) {
      // Log the full error for debugging
      logger.error('createPayFastPayment error:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        data: request.data,
      });
      
      // If it's already an HttpsError, re-throw it
      if (error instanceof HttpsError) {
        throw error;
      }
      
      // Otherwise, wrap it with more context
      throw new HttpsError(
        'internal',
        `Failed to create payment: ${error?.message || 'Unknown error'}. Please try again or contact support.`
      );
    }
  }
);

// ---------- PayFast 2) Verify Payment ----------
export const verifyPayFastPayment = onCall(
  { secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE', 'PAYFAST_ENV'] },
  async (request) => {
    const uid = uidOrThrow(request);
    const { paymentId } = request.data as VerifyPayFastPaymentPayload;
    
    if (!paymentId) throw new HttpsError('invalid-argument', 'paymentId required');
    
    const merchantId = cleanPf(process.env.PAYFAST_MERCHANT_ID);
    const merchantKey = cleanPf(process.env.PAYFAST_MERCHANT_KEY);
    const passphrase = cleanPf(process.env.PAYFAST_PASSPHRASE || '');
    
    if (!merchantId || !merchantKey) {
      throw new HttpsError('failed-precondition', 'PayFast credentials not configured');
    }
    
    // First, get the pending payment to check status and get pf_payment_id if available
    const pendingRef = db.collection('pending_payments').doc(paymentId);
    const pendingSnap = await pendingRef.get();
    
    if (!pendingSnap.exists) {
      throw new HttpsError('not-found', 'Payment not found');
    }
    
    const pending = pendingSnap.data();
    
    // If already completed, return success immediately
    if (pending?.status === 'COMPLETED') {
      return {
        status: 'SUCCESS',
        credited: pending.amount || 0,
        currency: pending.currency || getBaseCurrency(),
        paymentMethod: pending.paymentMethod || 'UNKNOWN',
      };
    }
    
    // Try to get pf_payment_id from pending payment (set by ITN webhook)
    let pfPaymentId = pending?.pfPaymentId || pending?.payfastData?.pf_payment_id;
    
    // If we don't have pf_payment_id yet, we can't query PayFast directly
    // In this case, we'll just return PENDING and let the ITN webhook handle it
    if (!pfPaymentId) {
      logger.info('PayFast verify: No pf_payment_id yet, waiting for ITN', { paymentId });
      return { status: 'PENDING', message: 'Payment processing, please wait a moment' };
    }
    
    // Query PayFast to verify payment using pf_payment_id
    const queryData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      pf_payment_id: String(pfPaymentId),
    };
    
    const signature = generatePayFastSignature(queryData, passphrase, { includeEmpty: true });
    queryData.signature = signature;
    
    const { queryString } = buildPayFastQueryString(queryData);
    
    try {
      const baseUrl = getPayFastBaseUrl();
      const res = await fetch(`${baseUrl}/eng/query/validate?${queryString}`);
      const result = await res.text();
      
      if (result === 'VALID') {
        // Get payment details
        const detailsRes = await fetch(`${baseUrl}/eng/query/get?${queryString}`);
        const detailsText = await detailsRes.text();
        
        // Parse details (PayFast returns key=value pairs)
        const details: Record<string, string> = {};
        detailsText.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            details[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
        
        // Check if payment is complete
        if (details.payment_status === 'COMPLETE') {
          const amount = Number(details.amount_gross || 0);
          const base = getBaseCurrency();
          
          // Credit wallet if not already credited (idempotency)
          if (pendingSnap.get('status') !== 'COMPLETED') {
            const now = Timestamp.now();
            
            await db.runTransaction(async (t) => {
              const wRef = walletDoc(uid);
              const wSnap = await t.get(wRef);
              const prevBalance = wSnap.exists ? Number(wSnap.get('balance') || 0) : 0;
              
              t.set(
                wRef,
                {
                  uid,
                  balance: prevBalance + amount,
                  currency: base,
                  updatedAt: now,
                  createdAt: wSnap.exists ? (wSnap.get('createdAt') || now) : now,
                },
                { merge: true }
              );
              
              const txRef = txCollection(uid).doc(paymentId);
              t.set(txRef, {
                type: 'TOP_UP',
                provider: 'PAYFAST',
                paymentMethod: details.payment_method || 'UNKNOWN',
                amount: amount,
                currency: base,
                status: 'SUCCESS',
                payfastData: {
                  pf_payment_id: details.pf_payment_id || null,
                  payment_status: details.payment_status || null,
                  payment_method: details.payment_method || 'UNKNOWN',
                },
                createdAt: now,
              });
              
              t.update(pendingRef, { status: 'COMPLETED', completedAt: now });
            });
          }
          
          return {
            status: 'SUCCESS',
            credited: amount,
            currency: base,
            paymentMethod: details.payment_method,
          };
        }
      }
      
      return { status: 'PENDING', message: 'Payment not yet complete' };
    } catch (error: any) {
      logger.error('PayFast verification error', error);
      throw new HttpsError('internal', `PayFast verification failed: ${error?.message || 'Unknown error'}`);
    }
  }
);

// ---------- 4) P2P transfer ----------
export const transferFunds = onCall({}, async (request) => {
  const fromUid = uidOrThrow(request);
  const { toUid, amount, note } = request.data as P2PTransferPayload;

  if (!toUid || typeof toUid !== 'string') throw new HttpsError('invalid-argument', 'toUid required');
  if (toUid === fromUid) throw new HttpsError('invalid-argument', 'Cannot send to yourself');
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new HttpsError('invalid-argument', 'amount must be > 0');
  }

  const amt  = Number(amount);
  const now  = Timestamp.now();
  const base = getBaseCurrency();

  await db.runTransaction(async (t) => {
    const fromRef = walletDoc(fromUid);
    const toRef   = walletDoc(toUid);
    const [fromSnap, toSnap] = await Promise.all([t.get(fromRef), t.get(toRef)]);

    const fromBal = fromSnap.exists ? Number(fromSnap.get('balance') || 0) : 0;
    if (fromBal < amt) throw new HttpsError('failed-precondition', 'Insufficient balance');

    t.set(fromRef, {
      uid: fromUid,
      balance: fromBal - amt,
      currency: base,
      updatedAt: now,
      createdAt: fromSnap.exists ? (fromSnap.get('createdAt') || now) : now,
    }, { merge: true });

    const toBal = toSnap.exists ? Number(toSnap.get('balance') || 0) : 0;
    t.set(toRef, {
      uid: toUid,
      balance: toBal + amt,
      currency: base,
      updatedAt: now,
      createdAt: toSnap.exists ? (toSnap.get('createdAt') || now) : now,
    }, { merge: true });

    const debitId  = db.collection('_ids').doc().id;
    const creditId = db.collection('_ids').doc().id;

    t.set(txCollection(fromUid).doc(debitId), {
      type: 'TRANSFER_OUT',
      counterparty: toUid,
      amount: amt,
      currency: base,
      note: note || null,
      createdAt: now,
      status: 'SUCCESS',
    });

    t.set(txCollection(toUid).doc(creditId), {
      type: 'TRANSFER_IN',
      counterparty: fromUid,
      amount: amt,
      currency: base,
      note: note || null,
      createdAt: now,
      status: 'SUCCESS',
    });
  });

  return { status: 'SUCCESS' };
});

// ---------- 5) Transactions ----------
export const getTransactions = onCall({}, async (request) => {
  const uid = uidOrThrow(request);
  const data = request.data as TransactionsPayload;
  const limit = Math.max(1, Math.min(50, Number(data.limit ?? 20)));

  let q = txCollection(uid).orderBy('createdAt', 'desc').limit(limit);
  if (data.cursor) {
    const cursorSnap = await txCollection(uid).doc(data.cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snaps = await q.get();
  const rawItems = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Fetch user names for counterparties
  const counterpartyUids = new Set<string>();
  rawItems.forEach((item: any) => {
    if (item.counterparty && typeof item.counterparty === 'string') {
      counterpartyUids.add(item.counterparty);
    }
  });

  // Batch fetch user data
  const userDataMap = new Map<string, { username: string; profilePic?: string }>();
  if (counterpartyUids.size > 0) {
    const userSnaps = await Promise.all(
      Array.from(counterpartyUids).map((uId) => db.collection('users').doc(uId).get())
    );
    userSnaps.forEach((snap) => {
      if (snap.exists) {
        const data = snap.data() as any;
        userDataMap.set(snap.id, {
          username: data.username || data.displayName || 'Unknown User',
          profilePic: data.profilePic || null,
        });
      }
    });
  }

  // Enrich transactions with user data
  const items = rawItems.map((item: any) => {
    const enriched: any = { ...item };
    if (item.counterparty && userDataMap.has(item.counterparty)) {
      const userData = userDataMap.get(item.counterparty)!;
      enriched.counterpartyName = userData.username;
      enriched.counterpartyProfilePic = userData.profilePic;
    }
    return enriched;
  });

  const nextCursor = snaps.size === limit ? snaps.docs[snaps.docs.length - 1].id : null;
  return { items, nextCursor };
});

// ---------- 6) Wallet balance ----------
export const getWalletBalance = onCall({}, async (request) => {
  const uid = uidOrThrow(request);
  const snap = await walletDoc(uid).get();
  if (!snap.exists) return { balance: 0, currency: getBaseCurrency() };
  const balance = Number(snap.get('balance') || 0);
  const currency = String(snap.get('currency') || getBaseCurrency()).toUpperCase();
  return { balance, currency };
});

// ---------- 7) Admin adjust ----------
export const adminAdjustBalance = onCall({}, async (request) => {
  const caller = uidOrThrow(request);
  const token = await getAuth().getUser(caller);
  const isAdmin = !!(token.customClaims && (token.customClaims as any).admin === true);
  if (!isAdmin) throw new HttpsError('permission-denied', 'Admin only');

  const { uid, delta, reason } = request.data as { uid: string; delta: number; reason?: string };
  if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid required');
  if (delta == null || isNaN(Number(delta))) throw new HttpsError('invalid-argument', 'delta must be a number');

  const now  = Timestamp.now();
  const base = getBaseCurrency();

  await db.runTransaction(async (t) => {
    const wRef = walletDoc(uid);
    const wSnap = await t.get(wRef);
    const bal = wSnap.exists ? Number(wSnap.get('balance') || 0) : 0;

    t.set(wRef, {
      uid,
      balance: bal + Number(delta),
      currency: base,
      updatedAt: now,
      createdAt: wSnap.exists ? (wSnap.get('createdAt') || now) : now,
    }, { merge: true });

    const txId = db.collection('_ids').doc().id;
    t.set(txCollection(uid).doc(txId), {
      type: 'ADMIN_ADJUST',
      amount: Number(delta),
      currency: base,
      reason: reason || null,
      createdAt: now,
      status: 'SUCCESS',
      adminUid: caller,
    });
  });

  return { status: 'SUCCESS' };
});

// ---------- 8) Express webhook ----------
const app = express();
app.use((req, res, next) => cors(req, res, next));

// Express app for future webhooks/endpoints if needed
// Currently only PayFast ITN is used (see payfastITN below)

// ---------- PayFast ITN Webhook Handler ----------
export const payfastITN = onRequest(
  { secrets: ['PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE'] },
  async (req, res) => {
    logger.info('PayFast ITN: Request received', {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      },
      hasBody: !!req.body,
      bodyType: typeof req.body,
    });
    
    if (req.method !== 'POST') {
      logger.warn('PayFast ITN: Invalid method', { method: req.method });
      res.status(405).send('Method not allowed');
      return;
    }
    
    // PayFast sends data as form-encoded
    const data: Record<string, string> = {};
    let rawBodyString = '';
    
    try {

      // Try to get raw body for signature verification
      if ((req as any).rawBody) {
        rawBodyString = (req as any).rawBody.toString();
      } else if (typeof req.body === 'string') {
        rawBodyString = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        rawBodyString = req.body.toString();
      }

      // Parse form-encoded data
      if (rawBodyString) {
        const parsed = new URLSearchParams(rawBodyString);
        parsed.forEach((value, key) => {
          data[key] = decodeURIComponent(value);
        });
      } else if (req.body && typeof req.body === 'object') {
        // Fallback: if already parsed
        Object.assign(data, req.body);
        // Reconstruct raw string for signature (approximate)
        rawBodyString = Object.entries(data)
          .filter(([k]) => k !== 'signature')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join('&');
      }

      const merchantKey = cleanPf(process.env.PAYFAST_MERCHANT_KEY);
      const passphrase = cleanPf(process.env.PAYFAST_PASSPHRASE || '');
      
      if (!merchantKey) {
        logger.error('PayFast ITN: Merchant key not configured');
        res.status(500).send('Configuration error');
        return;
      }

      logger.info('PayFast ITN: received', {
        keys: Object.keys(data),
        payment_status: data.payment_status,
        m_payment_id: data.m_payment_id,
        pf_payment_id: data.pf_payment_id,
        hasRawBody: !!rawBodyString,
        amount_gross: data.amount_gross,
        custom_str1: data.custom_str1,
      });

      // Verify signature
      const receivedSignature = data.signature;
      if (!receivedSignature) {
        logger.error('PayFast ITN: Missing signature');
        res.status(400).send('Missing signature');
        return;
      }

      // Reconstruct signing string from parsed data (PayFast signature rules)
      let signingString = '';
      if (rawBodyString) {
        // Use raw body if available (most accurate)
        signingString = rawBodyString
          .replace(/(^|&)signature=[^&]*/i, '')
          .replace(/^&/, '')
          .replace(/&$/, '');
      } else {
        // Fallback: reconstruct from parsed data (sorted alphabetically, excluding signature)
        const signingData: Record<string, string> = { ...data };
        delete signingData.signature;
        
        const sortedKeys = Object.keys(signingData).sort();
        signingString = sortedKeys
          .map((key) => `${key}=${encodeURIComponent(signingData[key]).replace(/%20/g, '+')}`)
          .join('&');
      }

      const finalString = passphrase
        ? `${signingString}&passphrase=${passphrase}`
        : signingString;

      const calculatedSignature = crypto
        .createHash('md5')
        .update(finalString)
        .digest('hex');

      if (receivedSignature !== calculatedSignature) {
        logger.error('PayFast ITN signature mismatch', {
          received: receivedSignature,
          calculated: calculatedSignature,
          signingString: finalString.substring(0, 200),
          fullSigningString: finalString,
        });
        res.status(400).send('Invalid signature');
        return;
      }

      logger.info('PayFast ITN: Signature verified successfully', {
        m_payment_id: data.m_payment_id,
        pf_payment_id: data.pf_payment_id,
      });


      // Verify payment status
      if (data.payment_status !== 'COMPLETE') {
        logger.info('PayFast ITN: Payment not complete', { 
          status: data.payment_status,
          paymentId: data.m_payment_id 
        });
        res.status(200).send('OK'); // Acknowledge but don't process
        return;
      }
      
      const paymentId = data.m_payment_id;
      const uid = data.custom_str1; // User ID we stored
      const amount = Number(data.amount_gross);
      const pfPaymentId = data.pf_payment_id;
      
      logger.info('PayFast ITN: Extracted payment data', {
        paymentId,
        uid,
        amount,
        pfPaymentId,
        amount_gross_raw: data.amount_gross,
      });
      
      if (!paymentId || !uid || !amount || isNaN(amount)) {
        logger.error('PayFast ITN: Missing required fields', { 
          paymentId, 
          uid, 
          amount,
          amount_gross_raw: data.amount_gross,
          hasPaymentId: !!paymentId,
          hasUid: !!uid,
          isAmountValid: !isNaN(amount),
        });
        res.status(400).send('Missing required fields');
        return;
      }
      
      // Check if already processed (idempotency)
      const pendingRef = db.collection('pending_payments').doc(paymentId);
      const pendingSnap = await pendingRef.get();
      
      if (!pendingSnap.exists) {
        logger.warn('PayFast ITN: Payment ID not found in pending payments', { 
          paymentId,
          collection: 'pending_payments',
        });
        // Still return OK to prevent PayFast retries
        res.status(200).send('OK');
        return;
      }
      
      const pending = pendingSnap.data();
      logger.info('PayFast ITN: Found pending payment', {
        paymentId,
        currentStatus: pending?.status,
        pendingAmount: pending?.amount,
        pendingUid: pending?.uid,
      });
      
      if (pending?.status === 'COMPLETED') {
        logger.info('PayFast ITN: Payment already processed', { 
          paymentId,
          completedAt: pending?.completedAt,
        });
        res.status(200).send('OK');
        return;
      }
      
      // Credit wallet atomically
      const now = Timestamp.now();
      const base = getBaseCurrency();
      
      logger.info('PayFast ITN: Starting transaction', { 
        paymentId, 
        uid, 
        amount, 
        base,
        prevStatus: pending?.status,
      });
      
      try {
        await db.runTransaction(async (t) => {
        const wRef = walletDoc(uid);
        const wSnap = await t.get(wRef);
        const prevBalance = wSnap.exists ? Number(wSnap.get('balance') || 0) : 0;
        const newBalance = prevBalance + amount;
        
        logger.info('PayFast ITN: Wallet balance update', {
          uid,
          prevBalance,
          amount,
          newBalance,
          walletExists: wSnap.exists,
        });
        
        t.set(
          wRef,
          {
            uid,
            balance: newBalance,
            currency: base,
            updatedAt: now,
            createdAt: wSnap.exists ? (wSnap.get('createdAt') || now) : now,
          },
          { merge: true }
        );
        
        const txRef = txCollection(uid).doc(paymentId);
        const paymentMethod = data.payment_method || 'UNKNOWN';
        t.set(txRef, {
          type: 'TOP_UP',
          provider: 'PAYFAST',
          paymentMethod: paymentMethod,
          amount: amount,
          currency: base,
          status: 'SUCCESS',
          payfastData: {
            pf_payment_id: pfPaymentId || null,
            payment_status: data.payment_status || null,
            payment_method: paymentMethod,
          },
          createdAt: now,
        });
        
        logger.info('PayFast ITN: Transaction record created', {
          paymentId,
          txPath: `wallets/${uid}/transactions/${paymentId}`,
        });
        
        // Mark pending payment as completed
        t.update(pendingRef, { 
          status: 'COMPLETED', 
          completedAt: now,
          pfPaymentId: pfPaymentId || null,
          paymentMethod: paymentMethod,
        });
        
        logger.info('PayFast ITN: Pending payment marked as COMPLETED', {
          paymentId,
        });
      });
      
      logger.info('PayFast ITN: Transaction completed successfully', {
        paymentId,
        uid,
        amount,
      });
      } catch (txError: any) {
        logger.error('PayFast ITN: Transaction failed', {
          message: txError?.message,
          code: txError?.code,
          stack: txError?.stack,
          paymentId,
          uid,
        });
        throw txError; // Re-throw to be caught by outer catch
      }
      
      // Verify the wallet was actually updated
      const verifyWalletRef = walletDoc(uid);
      const verifyWalletSnap = await verifyWalletRef.get();
      const finalBalance = verifyWalletSnap.exists ? Number(verifyWalletSnap.get('balance') || 0) : 0;
      
      logger.info('PayFast ITN: Wallet credited successfully', { 
        uid, 
        amount, 
        paymentId,
        paymentMethod: data.payment_method || 'UNKNOWN',
        finalBalance,
        walletPath: `wallets/${uid}`,
        walletExists: verifyWalletSnap.exists,
      });
      
      res.status(200).send('OK');
    } catch (error: any) {
      logger.error('PayFast ITN error', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        errorName: error?.name,
        paymentId: data?.m_payment_id,
        uid: data?.custom_str1,
      });
      // Return 200 to acknowledge receipt and prevent PayFast retries
      // The error is logged for investigation
      res.status(200).send('OK');
    }
    
  }
);

// ---------- 9) Complete ride and pay driver (atomic) ----------
export const payDriverOnComplete = onCall({}, async (request) => {
  const riderUid = uidOrThrow(request);
  const { rideId } = request.data as { rideId: string };
  if (!rideId || typeof rideId !== "string") {
    throw new HttpsError("invalid-argument", "rideId required");
  }

  const rideRef = db.collection("rides").doc(rideId);

  // Optional env fee, default 20%
  const feeRateEnv = Number(process.env.APP_PLATFORM_FEE_RATE || "0.20");
  const feeRate = Number.isFinite(feeRateEnv) ? Math.max(0, Math.min(0.95, feeRateEnv)) : 0.20;

  await db.runTransaction(async (t) => {
    const now = Timestamp.now();

    const rideSnap = await t.get(rideRef);
    if (!rideSnap.exists) throw new HttpsError("not-found", "Ride not found.");
    const ride = rideSnap.data() as any;

    // Idempotency: if already paid/completed, return early
    if (ride?.payment?.status === "authorized" || ride?.status === "completed") {
      // also ensure driver is freed
      if (ride?.driver?.id) {
        t.set(db.collection("drivers_live").doc(ride.driver.id), { occupied: false, updatedAt: now }, { merge: true });
      }
      return;
    }

    // Authorization & state checks
    if (ride.userId !== riderUid) throw new HttpsError("permission-denied", "Not your ride.");
    if (ride.status !== "on_trip") {
      throw new HttpsError("failed-precondition", `Ride must be on_trip to complete (current: ${ride.status}).`);
    }

    const driverId = ride?.driver?.id;
    if (!driverId) throw new HttpsError("failed-precondition", "No assigned driver.");

    const amount = Number(ride.estimatedFareZAR || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError("failed-precondition", "Invalid fare amount.");
    }

    // Wallets
    const riderWalletRef  = walletDoc(riderUid);
    const driverWalletRef = walletDoc(driverId);

    const [riderW, driverW] = await Promise.all([t.get(riderWalletRef), t.get(driverWalletRef)]);
    const base = getBaseCurrency();

    const riderBal = riderW.exists ? Number(riderW.get("balance") || 0) : 0;
    if (riderBal < amount) throw new HttpsError("failed-precondition", "Insufficient rider balance.");

    const driverBal = driverW.exists ? Number(driverW.get("balance") || 0) : 0;

    // Split & round to whole cents (or rands if you store whole units)
    const platformFee = Math.round(amount * feeRate);
    const payout = amount - platformFee;

    // Debit rider, credit driver
    t.set(
      riderWalletRef,
      {
        uid: riderUid,
        balance: riderBal - amount,
        currency: base,
        updatedAt: now,
        createdAt: riderW.exists ? (riderW.get("createdAt") || now) : now,
      },
      { merge: true }
    );

    t.set(
      driverWalletRef,
      {
        uid: driverId,
        balance: driverBal + payout,
        currency: base,
        updatedAt: now,
        createdAt: driverW.exists ? (driverW.get("createdAt") || now) : now,
      },
      { merge: true }
    );

    // Transactions (two-sided ledger)
    const debitId  = db.collection("_ids").doc().id;
    const creditId = db.collection("_ids").doc().id;

    t.set(txCollection(riderUid).doc(debitId), {
      type: "RIDE_PAYMENT",
      rideId,
      counterparty: driverId,
      amount: amount,
      currency: base,
      platformFee,
      payoutToDriver: payout,
      createdAt: now,
      status: "SUCCESS",
    });

    t.set(txCollection(driverId).doc(creditId), {
      type: "RIDE_EARN",
      rideId,
      counterparty: riderUid,
      amount: payout,
      currency: base,
      platformFee, // for reporting
      createdAt: now,
      status: "SUCCESS",
    });

    // Mark ride completed & paid
    t.update(rideRef, {
      status: "completed",
      payment: { status: "authorized", lastError: null },
      updatedAt: now,
    });

    // Free the driver for new jobs
    t.set(db.collection("drivers_live").doc(driverId), { occupied: false, updatedAt: now }, { merge: true });
  });

  return { ok: true };
});

// ---------- 10) Complete order and pay  (atomic) ----------

export const payAndPlaceOrder = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

  const { businessId, items, address, total } = req.data || {};
  if (!businessId || !Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Missing order fields.");
  }

  const orderRef    = db.collection("orders").doc();
  const buyerRef    = db.doc(`wallets/${uid}`);
  const businessRef = db.doc(`businesses/${businessId}`);

  // 👇 hoist for use after transaction (push notification)
  let ownerId: string = "";

  await db.runTransaction(async (tx) => {
    // Load business and read ownerId server-side
    const bizSnap = await tx.get(businessRef);
    if (!bizSnap.exists) throw new HttpsError("not-found", "Business not found.");

    ownerId = String(bizSnap.get("ownerId") || "");
    if (!ownerId) throw new HttpsError("failed-precondition", "Business owner not set.");

    const sellerRef = db.doc(`wallets/${ownerId}`);

    // Check buyer balance
    const buyerSnap = await tx.get(buyerRef);
    const buyerBal  = buyerSnap.exists ? Number(buyerSnap.get("balance") || 0) : 0;
    const amount    = Number(total);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError("invalid-argument", "Invalid total.");
    }
    if (!Number.isFinite(buyerBal)) {
      throw new HttpsError("failed-precondition", "Bad wallet state.");
    }
    if (buyerBal < amount) {
      throw new HttpsError("failed-precondition", "Insufficient funds.");
    }

    const now = FieldValue.serverTimestamp();

    // Atomic debit/credit with timestamps
    tx.set(buyerRef,  { uid, balance: FieldValue.increment(-amount), updatedAt: now }, { merge: true });
    tx.set(sellerRef, { uid: ownerId, balance: FieldValue.increment(+amount), updatedAt: now }, { merge: true });

    // Create paid order
    tx.set(orderRef, {
      businessId,
      ownerId,
      userId: uid,
      items,
      subtotal: amount,
      total: amount,
      deliveryAddress: address || null,
      status: "paid",
      createdAt: now,
      updatedAt: now,
    });

    // (Optional) validate/decrement stock here in the same tx
  });

  // Push to business owner after funds moved & order created
  try {
    if (ownerId) {
      const ownerSnap = await db.collection('users').doc(ownerId).get();
      // Prefer FCM tokens, fallback to Expo tokens for migration
      const fcmTokens: string[] = (ownerSnap.get('fcmTokens') || []).filter(
        (t: any) => typeof t === 'string' && t.length > 0
      );
      const expoTokens: string[] = (ownerSnap.get('expoPushTokens') || []).filter(
        (t: any) => typeof t === 'string' && t.startsWith('ExponentPushToken')
      );
      const valid = fcmTokens.length > 0 ? fcmTokens : expoTokens;
      if (valid.length) {
        await sendFCMPush(valid, 'New order', `R${Number(total).toFixed(2)} from a customer`, {
          businessId,
          orderId: orderRef.id,
        });
      }
    }
  } catch (e) {
    logger.warn('Push to owner failed', e);
  }

  return { orderId: orderRef.id, status: "paid" };
});

//----------(10) Status change → notify buyer --------------
export const notifyBuyerOrderStatus = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before: any = event.data?.before?.data();
  const after:  any = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;

  const userId = after.userId;
  if (!userId) return;

  const user = await db.collection('users').doc(userId).get();
  // Prefer FCM tokens, fallback to Expo tokens for migration
  const fcmTokens: string[] = (user.get('fcmTokens') || []).filter(
    (t: any) => typeof t === 'string' && t.length > 0
  );
  const expoTokens: string[] = (user.get('expoPushTokens') || []).filter(
    (t: any) => typeof t === 'string' && t.startsWith('ExponentPushToken')
  );
  const tokens = fcmTokens.length > 0 ? fcmTokens : expoTokens;
  if (tokens.length) {
    await sendFCMPush(tokens, 'Order update', `Your order is now ${String(after.status)}`, {
      orderId: event.params.orderId,
      status: after.status,
    });
  }
});

// ---------- [MODIFIED] Notify on new DM message & maintain chat meta ----------
export const notifyOnNewDM = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  const chatId = event.params.chatId;
  const msg = event.data?.data();
  if (!msg) return;

  const senderId = String(msg.senderId || '');
  if (!senderId) return;

  try {
    const chatRef = db.collection('chats').doc(chatId);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) return;

    const chat = chatSnap.data() || {};

    // Figure out the two participants and the recipient
    let participants: string[] = [];
    if (Array.isArray(chat.participants)) {
      participants = chat.participants.filter((x: any) => typeof x === 'string');
    } else if (chat.participants && typeof chat.participants === 'object') {
      participants = Object.keys(chat.participants).filter((k) => chat.participants[k] === true);
    }

    // This trigger is for 1-on-1 direct messages only
    if (participants.length !== 2) return;

    const recipientId = participants.find((p) => p !== senderId);
    if (!recipientId) return;

    // Update chat meta: last message + unread flags
    const lastMessageText = previewFromMessage(msg);
    await chatRef.set(
      {
        lastMessageText,
        lastMessageSenderId: senderId,
        lastMessageTimestamp: FieldValue.serverTimestamp(),
        unreadFor: {
          [recipientId]: true,
          [senderId]: false,
        },
      },
      { merge: true }
    );

    // Fetch sender's name for the title and recipient's tokens for sending
    const senderSnap = await db.collection('users').doc(senderId).get();
    const recipientSnap = await db.collection('users').doc(recipientId).get();

    // Get FCM tokens (prefer fcmTokens, fallback to expoPushTokens for migration)
    const fcmTokens: string[] = (recipientSnap.get('fcmTokens') || []).filter(
      (t: any) => typeof t === 'string' && t.length > 0
    );
    const expoTokens: string[] = (recipientSnap.get('expoPushTokens') || []).filter(
      (t: any) => typeof t === 'string' && t.startsWith('ExponentPushToken')
    );
    const tokens = fcmTokens.length > 0 ? fcmTokens : expoTokens;

    if (!tokens.length) return;

    // Use sender's name for the notification title
    const title = senderSnap.get('username') ? String(senderSnap.get('username')) : 'New message';
    const body  = lastMessageText;

    // Include navigation hints in data payload for your app
    // When the recipient taps, they need to open a chat with the SENDER.
    // So the navigation `recipientId` param should be the sender's ID.
    await sendFCMPush(tokens, title, body, {
      type: 'dm',
      chatId,
      recipientId: senderId,
    });
  } catch (e) {
    logger.warn('notifyOnNewDM failed', e);
  }
});

// ---------- [NEW] Notify on new group chat message ----------
export const notifyOnNewGroupMessage = onDocumentCreated(
  'communities/{communityId}/groupChats/{chatId}/messages/{messageId}',
  async (event) => {
    const communityId = event.params.communityId;
    const chatId = event.params.chatId;
    const msg = event.data?.data();
    if (!msg) return;

    const senderId = String(msg.senderId || '');
    if (!senderId) return;

    try {
      // Get group chat document to find members
      const groupRef = db
        .collection('communities')
        .doc(communityId)
        .collection('groupChats')
        .doc(chatId);
      const groupSnap = await groupRef.get();
      if (!groupSnap.exists) return;

      const groupData = groupSnap.data() || {};
      const members: string[] = Array.isArray(groupData.members)
        ? groupData.members
        : [];

      // Don't notify the sender
      const recipients = members.filter((m) => m !== senderId);
      if (recipients.length === 0) return;

      // Get sender's name for notification
      const senderSnap = await db.collection('users').doc(senderId).get();
      const senderName = senderSnap.get('username') || 'Someone';
      const groupName = groupData.name || groupData.title || 'Group';

      // Get message preview
      const messagePreview = previewFromMessage(msg);

      // Collect all push tokens from recipients
      const allTokens: string[] = [];
      for (const recipientId of recipients) {
        try {
          const userSnap = await db.collection('users').doc(recipientId).get();
          if (userSnap.exists) {
            // Prefer FCM tokens, fallback to Expo tokens for migration
            const fcmTokens: string[] = (userSnap.get('fcmTokens') || []).filter(
              (t: any) => typeof t === 'string' && t.length > 0
            );
            const expoTokens: string[] = (userSnap.get('expoPushTokens') || []).filter(
              (t: any) => typeof t === 'string' && t.startsWith('ExponentPushToken')
            );
            const tokens = fcmTokens.length > 0 ? fcmTokens : expoTokens;
            allTokens.push(...tokens);
          }
        } catch (e) {
          logger.warn(`Failed to get tokens for user ${recipientId}`, e);
        }
      }

      if (allTokens.length === 0) return;

      // Send notification to all group members (except sender)
      await sendFCMPush(
        allTokens,
        `${senderName} in ${groupName}`,
        messagePreview,
        {
          type: 'group',
          communityId,
          chatId,
          groupId: chatId,
          groupName,
        }
      );
    } catch (e) {
      logger.warn('notifyOnNewGroupMessage failed', e);
    }
  }
);

 // -----------------------------------------------------
  // Group wallet functions
  // -----------------------------------------------------
  


// ---------- Group Wallet Deposit ----------
export const depositToGroupWallet = onCall(
  {},
  async (request) => {
    const uid = uidOrThrow(request);
    const { groupId, amount, method } = request.data as {
      groupId: string;
      amount: number;
      method: "wallet";
    };

    // ✅ Validate inputs
    if (!groupId || typeof groupId !== "string") {
      throw new HttpsError("invalid-argument", "Missing groupId");
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new HttpsError("invalid-argument", "Invalid deposit amount");
    }
    if (method !== "wallet") {
      throw new HttpsError("invalid-argument", "Only wallet method is supported");
    }

    const baseCurrency = getBaseCurrency(); // Typically ZAR
    const numericAmount = Number(amount);
    const now = Timestamp.now();
    const groupWalletRef = db.collection("groupWallets").doc(groupId);
    const userRef = db.collection("users").doc(uid);

    // ✅ Wallet Deposit (transfer from user's wallet to group wallet)
    if (method === "wallet") {
      await db.runTransaction(async (t) => {
        const userWalletRef = walletDoc(uid);
        const [userWalletSnap, groupWalletSnap, userSnap] = await Promise.all([
          t.get(userWalletRef),
          t.get(groupWalletRef),
          t.get(userRef),
        ]);

        const userData = userSnap.exists ? userSnap.data() : {};
        const username =
          userData?.username || userData?.displayName || "Unknown User";

        if (!userWalletSnap.exists) {
          throw new HttpsError("failed-precondition", "User wallet not found");
        }

        const userBalance = Number(userWalletSnap.get("balance") || 0);
        if (userBalance < numericAmount) {
          throw new HttpsError("failed-precondition", "Insufficient balance");
        }

        const groupBalance = groupWalletSnap.exists
          ? Number(groupWalletSnap.get("balance") || 0)
          : 0;

        // 🔁 Update both wallets
        t.set(
          userWalletRef,
          {
            uid,
            balance: userBalance - numericAmount,
            updatedAt: now,
            currency: baseCurrency,
          },
          { merge: true }
        );

        t.set(
          groupWalletRef,
          {
            balance: groupBalance + numericAmount,
            updatedAt: now,
            createdBy: groupWalletSnap.get("createdBy") || uid,
            createdAt: groupWalletSnap.get("createdAt") || now,
            currency: baseCurrency,
          },
          { merge: true }
        );

        // 🧾 Log group transaction
        const txRef = groupWalletRef.collection("transactions").doc();
        t.set(txRef, {
          userId: uid,
          username,
          type: "DEPOSIT",
          amount: numericAmount,
          method: "wallet",
          createdAt: now,
          currency: baseCurrency,
          status: "SUCCESS",
        });
      });

      return { ok: true, method: "wallet" };
    }

    throw new HttpsError("invalid-argument", "Unsupported method");
  }
);

// ---------- Password Reset Function ----------
/**
 * Generates a strong password and sends it to the user's email
 * This function does NOT require authentication (user forgot password)
 */
export const resetPassword = onCall(
  {
    region: 'us-central1',
    cors: true,
    secrets: ['EMAIL_USER', 'EMAIL_PASSWORD'],
  },
  async (request) => {
    const { email } = request.data;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Valid email address is required');
    }

    try {
      const emailLower = email.trim().toLowerCase();
      
      // Find user by email
      let user;
      try {
        user = await authAdmin.getUserByEmail(emailLower);
      } catch (error: any) {
        // If user not found, don't reveal that to prevent email enumeration
        logger.warn(`Password reset requested for non-existent email: ${emailLower}`);
        // Return success anyway for security (don't reveal if email exists)
        return { success: true, message: 'If an account exists with this email, a new password has been sent.' };
      }

      // Generate a strong password (16 characters: uppercase, lowercase, numbers, special chars)
      const generateStrongPassword = (): string => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!@#$%^&*';
        const allChars = uppercase + lowercase + numbers + special;
        
        let password = '';
        // Ensure at least one of each type
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];
        
        // Fill the rest randomly
        for (let i = password.length; i < 16; i++) {
          password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
      };

      const newPassword = generateStrongPassword();

      // Update user's password in Firebase Auth
      await authAdmin.updateUser(user.uid, {
        password: newPassword,
      });

      logger.info(`Password reset for user: ${user.uid} (${emailLower})`);

      // Store password in Firestore temporarily (expires in 1 hour) for backup
      try {
        const passwordDocRef = db.collection('password_resets').doc();
        await passwordDocRef.set({
          email: emailLower,
          password: newPassword,
          uid: user.uid,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000), // 1 hour
        });
      } catch (storeError: any) {
        logger.warn('Failed to store password in Firestore:', storeError);
        // Continue anyway - password is already updated in Auth
      }

      // Try to send email, but always return password in response as primary method
      let emailSent = false;
      try {
        const emailUser = requireEnv('EMAIL_USER');
        const emailPass = requireEnv('EMAIL_PASSWORD');
        
        const emailTransporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });

        const mailOptions = {
          from: `"Topup" <${emailUser}>`,
          to: emailLower,
          subject: 'Topup - Your New Password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #9C3FE4;">Password Reset Request</h2>
              <p>Hello,</p>
              <p>A new password has been generated for your Topup account.</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #333; letter-spacing: 3px; font-family: monospace;">${newPassword}</p>
              </div>
              <p><strong>Please log in with this new password and change it to something memorable after logging in.</strong></p>
              <p>If you did not request this password reset, please contact support immediately.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">This is an automated message from Topup. Please do not reply to this email.</p>
            </div>
          `,
          text: `Password Reset Request

Hello,

A new password has been generated for your Topup account.

Your new password is: ${newPassword}

Please log in with this new password and change it to something memorable after logging in.

If you did not request this password reset, please contact support immediately.

---
This is an automated message from Topup. Please do not reply to this email.`,
        };

        await emailTransporter.sendMail(mailOptions);
        emailSent = true;
        logger.info(`Password reset email sent successfully to: ${emailLower}`);
      } catch (emailError: any) {
        logger.error('Email sending failed:', {
          error: emailError.message,
          code: emailError.code,
        });
        emailSent = false;
      }
      
      // Always return password in response - this is the primary method
      // Email is just a bonus if it works
      return {
        success: true,
        message: emailSent 
          ? 'A new password has been sent to your email address and is shown below.'
          : 'Your new password has been generated. Please save it immediately.',
        password: newPassword, // Always include password in response
        emailSent: emailSent,
      };
    } catch (error: any) {
      logger.error('Password reset error:', error);
      
      // Don't reveal internal errors to client
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        'internal',
        'An error occurred while resetting your password. Please try again later.'
      );
    }
  }
);
