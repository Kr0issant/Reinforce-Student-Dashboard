"use client";

import { getRedirectResult, onIdTokenChanged ,onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

export type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  configured: boolean;
  /** True when Firebase never answered and we gave up waiting. */
  degraded: boolean;
};

/**
 * How long to wait for Firebase to report auth state before giving up and
 * rendering the signed-out view. Without this the page can sit on a blank
 * loading card indefinitely when Firebase is unreachable — which, on campus
 * wifi, is not a hypothetical.
 */
const AUTH_TIMEOUT_MS = 6000;

/**
 * Subscribes to Firebase auth state and keeps a fresh ID token.
 *
 * `loading` starts true and goes false as soon as Firebase reports a session,
 * reports no session, errors, or fails to answer within AUTH_TIMEOUT_MS.
 * Rendering a signed-out state before that resolves is what makes the sign-in
 * page flash for already-authenticated members on every navigation; never
 * resolving at all is worse.
 */
export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: isFirebaseConfigured,
    configured: isFirebaseConfigured,
    degraded: false,
  });

  const settled = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    let unsubscribe: (() => void) | undefined;

    const watchdog = setTimeout(() => {
      if (settled.current) return;
      settled.current = true;
      setState({ user: null, token: null, loading: false, configured: true, degraded: true });
    }, AUTH_TIMEOUT_MS);

    const settle = (next: Partial<AuthState>) => {
      settled.current = true;
      clearTimeout(watchdog);
      setState((prev) => ({ ...prev, loading: false, degraded: false, ...next }));
    };

    try {
      const auth = getFirebaseAuth();

      // Check for incoming redirect result first (for redirect login on Firefox, Zen, Opera, Safari, Mobile)
      getRedirectResult(auth)
        .then(async (credential) => {
          if (credential?.user) {
            try {
              const token = await credential.user.getIdToken();
              settle({ user: credential.user, token });
            } catch {
              settle({ user: credential.user, token: null, degraded: true });
            }
          }
        })
        .catch((err) => {
          console.warn("[useAuth] Redirect check error:", err);
        }).finally(()=>{

          
          
          unsubscribe = onAuthStateChanged(
            auth,
            async (user) => {
          if (!user) {
            // Only settle null if no user is found
            settle({ user: null, token: null });
            return;
          }
          try {
            const token = await user.getIdToken();
            settle({ user, token });
          } catch {
            // Signed in but the token could not be minted — treat as signed out
            // rather than leaving the caller with a user and no credential.
            settle({ user: null, token: null, degraded: true });
          }
        },
        () => settle({ user: null, token: null, degraded: true }),
      );
    });
    } catch {
      settle({ user: null, token: null, degraded: true });
    }

    return () => {
      clearTimeout(watchdog);
      unsubscribe?.();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!isFirebaseConfigured) return;
    await fbSignOut(getFirebaseAuth());
  }, []);

  return { ...state, signOut };
}
