'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { getAuth, signInAnonymously } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []);

  useEffect(() => {
    const auth = getAuth(firebaseServices.firebaseApp);
    // Sign in anonymously when the provider mounts if there's no current user.
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed:", error);
        });
      }
    });

    return () => unsubscribe();
  }, [firebaseServices.firebaseApp]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
