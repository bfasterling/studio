'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { FirebaseClientProvider } from './client-provider';

// Define the shape of the context data
export interface FirebaseContextValue {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Create the context
const FirebaseContext = createContext<FirebaseContextValue | undefined>(
  undefined
);

// Define the props for the provider component
export interface FirebaseProviderProps extends FirebaseContextValue {
  children: React.ReactNode;
}

// Create the provider component
export function FirebaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>{children}</FirebaseClientProvider>
  );
}

// Create a hook to use the Firebase context
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = () => useFirebase().app;
export const useFirestore = () => useFirebase().firestore;
export const useAuth = () => useFirebase().auth;

export { FirebaseContext };