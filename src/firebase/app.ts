import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'

type FirebaseEnv = {
  VITE_FIREBASE_API_KEY?: string
  VITE_FIREBASE_AUTH_DOMAIN?: string
  VITE_FIREBASE_PROJECT_ID?: string
  VITE_FIREBASE_APP_ID?: string
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  VITE_FIREBASE_STORAGE_BUCKET?: string
}

const env = import.meta.env as FirebaseEnv

function requireEnv(name: keyof FirebaseEnv) {
  const value = env[name]

  if (!value) {
    throw new Error(`Missing Firebase environment variable: ${name}`)
  }

  return value
}

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp()
  }

  return initializeApp({
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
    appId: requireEnv('VITE_FIREBASE_APP_ID'),
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  })
}
