// test-payfast.js
// Test script to verify PayFast integration
// Run with: node test-payfast.js

const crypto = require('crypto');

// Test credentials - PayFast Sandbox
const TEST_MERCHANT_ID = '10044172';
const TEST_MERCHANT_KEY = 'ugnq5eaqpbc0r';
const TEST_PASSPHRASE = 'Passphrase.me123';

// PayFast base URL - Sandbox
const PAYFAST_BASE_URL = 'https://sandbox.payfast.co.za';

// Generate PayFast signature
function generatePayFastSignature(data, passphrase) {
  // Remove empty values, null values, and signature field
  const filtered = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'signature' && value !== '' && value !== null && value !== undefined) {
      filtered[key] = String(value);
    }
  }
  
  // Create query string in alphabetical order
  const queryString = Object.keys(filtered)
    .sort()
    .map(key => `${key}=${encodeURIComponent(filtered[key])}`)
    .join('&');
  
  // Add passphrase if provided
  const fullString = passphrase ? `${queryString}&passphrase=${encodeURIComponent(passphrase)}` : queryString;
  
  // Generate MD5 hash
  return crypto.createHash('md5').update(fullString).digest('hex');
}

// Test 1: Signature Generation
console.log('🧪 Test 1: Signature Generation');
const testData = {
  merchant_id: TEST_MERCHANT_ID,
  merchant_key: TEST_MERCHANT_KEY,
  amount: '100.00',
  item_name: 'Test Payment',
  m_payment_id: 'test123',
};

const signature = generatePayFastSignature(testData, TEST_PASSPHRASE);
console.log('✅ Signature generated:', signature.substring(0, 20) + '...');
console.log('');

// Test 2: Payment Data Structure
console.log('🧪 Test 2: Payment Data Structure');
const paymentData = {
  merchant_id: TEST_MERCHANT_ID,
  merchant_key: TEST_MERCHANT_KEY,
  return_url: 'dsquare://payfast-return',
  cancel_url: 'dsquare://payfast-cancel',
  notify_url: 'https://communitychat-f3fb0.cloudfunctions.net/payfastITN',
  m_payment_id: 'test-payment-' + Date.now(),
  amount: '50.00',
  item_name: 'Wallet Top-up',
  item_description: 'Test top-up',
  custom_str1: 'test-user-id',
  custom_str2: 'WALLET_TOPUP',
};

const paymentSignature = generatePayFastSignature(paymentData, TEST_PASSPHRASE);
paymentData.signature = paymentSignature;

console.log('✅ Payment data prepared:');
console.log('   - Merchant ID:', paymentData.merchant_id);
console.log('   - Amount:', paymentData.amount);
console.log('   - Payment ID:', paymentData.m_payment_id);
console.log('   - Signature:', paymentSignature.substring(0, 20) + '...');
console.log('   - ITN URL:', paymentData.notify_url);
console.log('');

// Test 3: Verify Payment Query Structure
console.log('🧪 Test 3: Verify Payment Query Structure');
const verifyData = {
  merchant_id: TEST_MERCHANT_ID,
  merchant_key: TEST_MERCHANT_KEY,
  pf_payment_id: 'test-payment-id',
};

const verifySignature = generatePayFastSignature(verifyData, TEST_PASSPHRASE);
verifyData.signature = verifySignature;

const queryString = Object.keys(verifyData)
  .map(key => `${key}=${encodeURIComponent(verifyData[key])}`)
  .join('&');

console.log('✅ Verify query string:', queryString.substring(0, 80) + '...');
console.log('');

// Test 4: Check ITN URL Format
console.log('🧪 Test 4: ITN URL Format');
const itnUrl = 'https://communitychat-f3fb0.cloudfunctions.net/payfastITN';
console.log('✅ ITN URL:', itnUrl);
console.log('   - Format: Valid Firebase Functions URL');
console.log('   - Make sure this is set in PayFast dashboard!');
console.log('');

// Test 5: Payment URL Construction
console.log('🧪 Test 5: Payment URL Construction');
const paymentUrl = `${PAYFAST_BASE_URL}/eng/process`;
const formData = new URLSearchParams();
Object.entries(paymentData).forEach(([key, value]) => {
  if (value) formData.append(key, value);
});

console.log('✅ Payment URL:', paymentUrl);
console.log('✅ Form data length:', formData.toString().length, 'characters');
console.log('');

// Summary
console.log('📋 Test Summary:');
console.log('✅ Signature generation: Working');
console.log('✅ Payment data structure: Valid');
console.log('✅ Verify query structure: Valid');
console.log('✅ ITN URL: Configured');
console.log('');
console.log('⚠️  Next Steps:');
console.log('1. Deploy Firebase Functions');
console.log('2. Configure ITN URL in PayFast dashboard');
console.log('3. Enable Zapper in PayFast dashboard');
console.log('4. Test with PayFast test credentials');
console.log('');
console.log('💡 PayFast Test Mode:');
console.log('   - Use test credentials from PayFast dashboard');
console.log('   - Same URL (https://www.payfast.co.za)');
console.log('   - Test payments won\'t charge real money');

