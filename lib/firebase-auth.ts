import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
  type Auth,
} from "firebase/auth"
import firebaseConfig from "@/firebase-applet-config.json"

export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
export const GOOGLE_DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly"

const TOKEN_STORAGE_KEY = "anki_studio_google_token"
const USER_STORAGE_KEY = "anki_studio_google_user"

export type CachedGoogleUser = {
  name: string | null
  email: string
  image?: string | null
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let provider: GoogleAuthProvider | null = null

function getFirebaseInstance() {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    auth = getAuth(app)
    provider = new GoogleAuthProvider()
    provider.addScope(GOOGLE_SHEETS_SCOPE)
    provider.addScope(GOOGLE_DRIVE_SCOPE)
    provider.addScope(GOOGLE_DRIVE_READONLY_SCOPE)
    provider.setCustomParameters({ prompt: "consent" })
  }
  return { app, auth: auth!, provider: provider! }
}

let cachedAccessToken: string | null = null
let currentUser: User | null = null
const subscribers = new Set<() => void>()

function notifySubscribers() {
  subscribers.forEach((callback) => {
    try {
      callback()
    } catch (e) {
      console.error("Auth subscriber error:", e)
    }
  })
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId)
}

export function getCachedAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY)
      if (stored) {
        cachedAccessToken = stored
        return stored
      }
    } catch {
      // ignore
    }
  }
  return null
}

export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token
  if (typeof window !== "undefined") {
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
      } else {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }
  notifySubscribers()
}

export function getCachedGoogleUser(): CachedGoogleUser | null {
  if (currentUser?.email) {
    return {
      name: currentUser.displayName ?? null,
      email: currentUser.email,
      image: currentUser.photoURL ?? null,
    }
  }
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(USER_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as CachedGoogleUser
        if (parsed && typeof parsed.email === "string") {
          return parsed
        }
      }
    } catch {
      // ignore
    }
  }
  try {
    const { auth: currentAuth } = getFirebaseInstance()
    const current = currentAuth?.currentUser
    if (current?.email) {
      currentUser = current
      return {
        name: current.displayName ?? null,
        email: current.email,
        image: current.photoURL ?? null,
      }
    }
  } catch {
    // ignore
  }
  return null
}

export function setCachedGoogleUser(user: CachedGoogleUser | null) {
  if (typeof window !== "undefined") {
    try {
      if (user) {
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
      } else {
        sessionStorage.removeItem(USER_STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }
}

export function getCurrentFirebaseUser(): User | null {
  if (currentUser) return currentUser
  try {
    const { auth: currentAuth } = getFirebaseInstance()
    if (currentAuth?.currentUser) {
      currentUser = currentAuth.currentUser
      return currentUser
    }
  } catch {
    // ignore
  }
  return null
}

export function subscribeAuth(callback: () => void): () => void {
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}

let isSigningIn = false
let authListenerInitialized = false

export function initFirebaseAuth(
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) {
  if (typeof window === "undefined") return () => {}
  const { auth: currentAuth } = getFirebaseInstance()

  if (!authListenerInitialized) {
    authListenerInitialized = true
    onAuthStateChanged(currentAuth, (user) => {
      currentUser = user
      if (user && user.email) {
        setCachedGoogleUser({
          name: user.displayName ?? null,
          email: user.email,
          image: user.photoURL ?? null,
        })
        const token = getCachedAccessToken()
        if (token) {
          onSuccess?.(user, token)
        } else if (!isSigningIn) {
          onFailure?.()
        }
      } else if (!isSigningIn) {
        currentUser = null
        setCachedAccessToken(null)
        setCachedGoogleUser(null)
        onFailure?.()
      }
      notifySubscribers()
    })
  }

  return () => {}
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string }> {
  const { auth: currentAuth, provider: currentProvider } = getFirebaseInstance()
  isSigningIn = true
  try {
    const result = await signInWithPopup(currentAuth, currentProvider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) {
      throw new Error("未能从 Google 登录获取访问令牌")
    }
    currentUser = result.user
    setCachedGoogleUser({
      name: result.user.displayName ?? null,
      email: result.user.email ?? "",
      image: result.user.photoURL ?? null,
    })
    setCachedAccessToken(credential.accessToken)
    notifySubscribers()
    return { user: result.user, accessToken: credential.accessToken }
  } catch (error) {
    console.error("Google sign-in error:", error)
    throw error
  } finally {
    isSigningIn = false
  }
}

export async function googleSignOut(): Promise<void> {
  const { auth: currentAuth } = getFirebaseInstance()
  try {
    await firebaseSignOut(currentAuth)
  } catch (error) {
    console.error("Sign out error:", error)
  } finally {
    currentUser = null
    setCachedAccessToken(null)
    setCachedGoogleUser(null)
    notifySubscribers()
  }
}
