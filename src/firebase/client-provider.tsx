'use client';

import {
  initializeFirebase,
} from '@/firebase';
import { 
    FirebaseContext,
    type FirebaseContextValue,
} from '@/firebase/provider';
import { useState, useEffect } from 'react';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebase, setFirebase] = useState<FirebaseContextValue | null>(null);

  useEffect(() => {
    const apps = initializeFirebase();
    setFirebase(apps);
  }, []);

  if (!firebase) {
    // You can show a loading skeleton here
    return null;
  }

  return <FirebaseContext.Provider value={firebase}>{children}</FirebaseContext.Provider>;
}