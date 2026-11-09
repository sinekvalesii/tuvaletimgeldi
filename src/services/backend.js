// Firebase ayarı varsa gerçek arka ucu, yoksa demo arka ucu kullanır.
import { FIREBASE } from '../config.js';
import { createDemoBackend } from './demo-backend.js';

export async function createBackend() {
  if (FIREBASE.apiKey && FIREBASE.projectId) {
    const { createFirebaseBackend } = await import('./firebase-backend.js');
    return createFirebaseBackend(FIREBASE);
  }
  return createDemoBackend();
}

// Firebase / demo hata kodlarını çeviri anahtarına dönüştürür
export function authErrorKey(err) {
  const code = err?.code || err?.message || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(code)) return 'authErr_invalid';
  if (/email-already-in-use/.test(code)) return 'authErr_exists';
  if (/weak-password/.test(code)) return 'authErr_weak';
  if (/invalid-email/.test(code)) return 'authErr_email';
  if (/network/.test(code)) return 'authErr_network';
  return 'authErr_generic';
}
