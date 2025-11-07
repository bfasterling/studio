'use client';

import {
  initializeFirebase,
  FirebaseProvider,
  type FirebaseProviderProps,
} from '@/firebase/provider';
import { useState, useEffect } from 'react';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebase, setFirebase] = useState<FirebaseProviderProps | null>(null);

  useEffect(() => {
    const apps = initializeFirebase();
    setFirebase(apps);
  }, []);

  if (!firebase) {
    // You can show a loading skeleton here
    return null;
  }

  return <FirebaseProvider {...firebase}>{children}</FirebaseProvider>;
}
