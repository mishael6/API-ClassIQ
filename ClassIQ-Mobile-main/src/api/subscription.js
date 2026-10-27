import axios from 'axios';
import { BASE_URL } from './auth';

const PAYLOQA_KEY = 'pk_live_of502pjkel';
const PAYLOQA_PLATFORM = 'plat_xpzju714wom';
const PAYLOQA_BASE = 'https://payments.payloqa.com/api/v1/payments';

// Create payment directly from app
export const initiateSubscription = async (student_id, phone, network) => {
  // Normalize phone to E.164
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '233' + normalized.slice(1);
  }

  const order_id = `SIX-${student_id}-${Date.now()}`;

  const res = await axios.post(`${PAYLOQA_BASE}/create`, {
    amount: 30.00,
    currency: 'GHS',
    payment_method: 'mobile_money',
    phone_number: normalized,
    network: network.toLowerCase(),
    offline: true,
    payment_flow: 'direct',
    webhook_url: `${BASE_URL}/ai/payment_callback.php`,
    metadata: {
      order_reference: order_id,
      student_id: student_id,
      type: 'six_subscription',
    },
  }, {
    headers: {
      'X-API-Key': PAYLOQA_KEY,
      'X-Platform-Id': PAYLOQA_PLATFORM,
      'Content-Type': 'application/json',
    },
  });

  const payment_id = res.data?.data?.payment_id;
  if (!payment_id) throw new Error('Payment ID not returned.');

  // Save pending subscription in our DB
  await axios.post(`${BASE_URL}/ai/save_pending.php`, {
    student_id,
    payment_id,
    amount: 30.00,
  });

  return { payment_id, message: res.data?.data?.message };
};

// Check payment status directly from Payloqa
export const checkPaymentStatus = async (payment_id, student_id) => {
  // First check our DB
  const dbRes = await axios.get(`${BASE_URL}/ai/check_payment.php`, {
    params: { payment_id, student_id },
  });

  if (dbRes.data?.status === 'completed') return dbRes.data;

  // Then check Payloqa directly
  const res = await axios.get(`${PAYLOQA_BASE}/${payment_id}`, {
    headers: {
      'X-API-Key': PAYLOQA_KEY,
      'X-Platform-Id': PAYLOQA_PLATFORM,
    },
  });

  return {
    status: res.data?.data?.status,
    message: res.data?.data?.message,
  };
};