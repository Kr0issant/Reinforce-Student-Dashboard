"use client";

import { getRedirectResult, onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
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

    let isCancelled = false;

    const watchdog = setTimeout(() => {
      if (settled.current) return;
      settled.current = true;
      setState({ user: null, token: null, loading: false, configured: true, degraded: true });
    }, AUTH_TIMEOUT_MS);

    const settle = (next: Partial<AuthState>) => {
      settled.current = true;
      clearTimeout(watchdog);
      if (!isCancelled) {
        setState((prev) => ({ ...prev, loading: false, degraded: false, ...next }));
      }
    };

    const initAuth = async () => {
      try {
        const auth = getFirebaseAuth();

        // 1. Process redirect result if returning from a full-page OAuth redirect
        try {
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult?.user) {
            const token = await redirectResult.user.getIdToken();
            settle({ user: redirectResult.user, token });
          }
        } catch (err) {
          console.warn("[useAuth] Redirect check:", err);
        }

        // 2. Subscribe to persistent auth state changes
        unsubscribe = onAuthStateChanged(
          auth,
          async (user) => {
            if (!user) {
              settle({ user: null, token: null });
              return;
            }
            try {
              const token = await user.getIdToken();
              settle({ user, token });
            } catch {
              settle({ user: null, token: null, degraded: true });
            }
          },
          () => settle({ user: null, token: null, degraded: true }),
        );
      } catch {
        settle({ user: null, token: null, degraded: true });
      }
    };

    initAuth();

    return () => {
      isCancelled = true;
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
