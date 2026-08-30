import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { getFirebaseAuth, signInWithAnonymousAuth } from '../firebase/auth'

type AnonymousAuthState = {
  user: User | null
  isLoading: boolean
  error: string | null
}

export function useAnonymousAuth(): AnonymousAuthState {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let unsubscribe = () => {}

    try {
      const auth = getFirebaseAuth()

      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        if (!isMounted) {
          return
        }

        setUser(nextUser)
        setIsLoading(false)
      })

      if (!auth.currentUser) {
        void signInWithAnonymousAuth().catch((unknownError: unknown) => {
          if (!isMounted) {
            return
          }

          const message =
            unknownError instanceof Error
              ? unknownError.message
              : 'Anonymous authentication failed.'

          setError(message)
          setIsLoading(false)
        })
      }
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : 'Firebase authentication could not be initialized.'

      queueMicrotask(() => {
        if (!isMounted) {
          return
        }

        setError(message)
        setIsLoading(false)
      })
    }

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return { user, isLoading, error }
}
