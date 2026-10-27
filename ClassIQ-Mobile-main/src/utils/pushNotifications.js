import axios from 'axios';
import { BASE_URL } from '../api/auth';
import { authStore } from '../store/authStore';

const SW_PATH = '/service-worker.js';

function urlBase64ToUint8Array(base64String) {
  const cleaned = (base64String || '').trim().replace(/\s/g, '');
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function decodeApplicationServerKey(base64String) {
  const key = urlBase64ToUint8Array(base64String);
  if (key.length !== 65 || key[0] !== 0x04) {
    throw new Error(
      'Invalid VAPID public key on server. In Render, delete VAPID env vars and redeploy, OR regenerate keys in Admin → Send SMS and paste only the key values.'
    );
  }
  return key;
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** iOS Safari only allows push in an installed Home Screen app */
export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function isSafari() {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function isPushSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  // iPhone/iPad: push only works from Home Screen app, not Safari browser tab
  if (isIOS() && !isStandalonePWA()) return false;
  return true;
}

export function getPushUnsupportedReason() {
  if (typeof window === 'undefined') return 'Not in a browser.';
  if (!window.isSecureContext) {
    return 'Open ClassIQ over HTTPS (your Netlify URL).';
  }
  if (isIOS() && !isStandalonePWA()) {
    return 'On iPhone you must install ClassIQ to your Home Screen first. Open Safari → Share (□↑) → Add to Home Screen → open ClassIQ from the icon (not Safari).';
  }
  if (!('serviceWorker' in navigator)) {
    return 'Use Safari 16.4+ on iPhone or Chrome on Android.';
  }
  if (!('PushManager' in window)) {
    return 'Push is not supported in this browser version.';
  }
  if (!('Notification' in window)) {
    return 'Notifications are blocked. Check iPhone Settings → Notifications.';
  }
  return null;
}

async function verifyServiceWorkerFile() {
  try {
    const res = await fetch(SW_PATH, { cache: 'no-store' });
    const text = await res.text();
    if (!res.ok || !text.includes('addEventListener')) {
      throw new Error('Service worker file not found on server.');
    }
  } catch (e) {
    throw new Error(
      'Service worker missing on Netlify. Redeploy using: npm run build:web'
    );
  }
}

/** Register SW and wait until active (required before push on Safari) */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  await verifyServiceWorkerFile();

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: '/', updateViaCache: 'none' });
  } catch (e) {
    console.warn('SW registration failed:', e.message);
    throw new Error(`Could not register service worker: ${e.message}`);
  }

  // Safari on iOS can take longer to activate
  const waitMs = isIOS() ? 8000 : 15000;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Service worker activation timed out')), waitMs)
      ),
    ]);

    // Extra wait for Safari — controller may lag behind .ready
    if (isIOS() && !navigator.serviceWorker.controller) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    return reg;
  } catch (e) {
    console.warn('SW ready failed:', e.message);
    throw new Error(
      isIOS()
        ? 'Service worker not ready. Close ClassIQ completely, reopen from Home Screen, wait 5 seconds, then try again.'
        : 'Service worker not ready. Refresh the page and try again.'
    );
  }
}

export async function getPushPermissionStatus() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function subscribeToPush() {
  const reason = getPushUnsupportedReason();
  if (reason) throw new Error(reason);

  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device.');
  }

  let reg = await registerServiceWorker();
  if (!reg?.pushManager) {
    await new Promise((r) => setTimeout(r, 2000));
    reg = await navigator.serviceWorker.ready;
  }
  if (!reg?.pushManager) {
    throw new Error(
      isIOS()
        ? 'Service worker not active. Reopen ClassIQ from your Home Screen icon, wait a few seconds, then try again.'
        : 'Service worker is not ready. Refresh and try again.'
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied. Check iPhone Settings → Notifications → ClassIQ.');
  }

  const { data } = await axios.get(`${BASE_URL}/push/vapid_key.php`);
  const publicKey = (data.publicKey || data?.data?.publicKey || '').trim();
  if (!publicKey) throw new Error('Push service not configured on server (VAPID keys missing).');

  // Always refresh subscription so it matches the server's current VAPID key
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(publicKey),
  });

  const token = await authStore.getToken();
  if (!token) throw new Error('Please log in again to enable notifications.');

  try {
    const { data } = await axios.post(
      `${BASE_URL}/push/subscribe.php`,
      { subscription: sub.toJSON() },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (data?.success === false) {
      throw new Error(data.message || 'Could not save subscription on server.');
    }
    localStorage.setItem('classiq_push_enabled', '1');
    localStorage.setItem('classiq_vapid_public', publicKey);
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || 'Could not sync with server.';
    throw new Error(msg);
  }

  return sub;
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager?.getSubscription();

  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    try {
      await axios.post(`${BASE_URL}/push/unsubscribe.php`, { endpoint });
    } catch (e) { /* best effort */ }
  }

  localStorage.removeItem('classiq_push_enabled');
  localStorage.removeItem('classiq_vapid_public');
}

export async function isPushEnabled() {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  return localStorage.getItem('classiq_push_enabled') === '1';
}

export async function initPushOnLogin() {
  if (!isPushSupported()) return;
  if (localStorage.getItem('classiq_push_enabled') !== '1') return;

  try {
    const { data } = await axios.get(`${BASE_URL}/push/vapid_key.php`);
    const serverKey = (data.publicKey || data?.data?.publicKey || '').trim();
    const cachedKey = localStorage.getItem('classiq_vapid_public') || '';

    if (serverKey && cachedKey && serverKey !== cachedKey) {
      console.warn('VAPID key changed on server — refreshing push subscription.');
    }

    await subscribeToPush();
  } catch (e) {
    console.warn('Push re-subscribe failed:', e.message);
  }
}

/** iOS often hides banners when the PWA is open — mirror push in the page context. */
export function setupPushForegroundHandler() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'classiq-push') return;
    const title = event.data.title || 'ClassIQ';
    const body = event.data.body || '';

    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    if (!window.Notification || Notification.permission !== 'granted') return;

    try {
      new window.Notification(title, {
        body,
        icon: '/apple-touch-icon.png',
        tag: 'classiq-foreground',
      });
    } catch (e) {
      // Duplicate tag or unsupported — safe to ignore
    }
  });
}
