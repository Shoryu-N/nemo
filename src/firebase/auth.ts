import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth,
} from 'firebase/auth'
import { getFirebaseApp } from './app'

type FirebaseAuthEnv = {
  VITE_USE_FIREBASE_AUTH_EMULATOR?: string
  VITE_FIREBASE_AUTH_EMULATOR_URL?: string
}

declare global {
  var __nemoAuthEmulatorConnected: boolean | undefined
}

const env = import.meta.env as FirebaseAuthEnv
const defaultAuthEmulatorUrl = 'http://127.0.0.1:9099'

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp())

  if (
    env.VITE_USE_FIREBASE_AUTH_EMULATOR === 'true' &&
    !globalThis.__nemoAuthEmulatorConnected
  ) {
    connectAuthEmulator(
      auth,
      env.VITE_FIREBASE_AUTH_EMULATOR_URL || defaultAuthEmulatorUrl,
      { disableWarnings: true },
    )
    globalThis.__nemoAuthEmulatorConnected = true
  }

  return auth
}

export async function signInWithAnonymousAuth() {
  const auth = getFirebaseAuth()

  if (auth.currentUser) {
    return auth.currentUser
  }

  const credential = await signInAnonymously(auth)
  return credential.user
}
