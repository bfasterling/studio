'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface DocumentData {
  fileName: string;
  content: string;
  analysisInstructions: string;
  userId: string;
}

export function saveDocument(
  firestore: Firestore,
  userId: string,
  data: DocumentData,
  onSuccess: () => void,
  onError: (error: Error) => void
) {
  const collectionRef = collection(firestore, `users/${userId}/documents`);
  
  addDoc(collectionRef, {
    ...data,
    createdAt: serverTimestamp(),
  })
    .then(() => {
      onSuccess();
    })
    .catch((error) => {
      const contextualError = new FirestorePermissionError({
        operation: 'create',
        path: collectionRef.path,
        requestResourceData: data,
      });
      onError(contextualError);
      errorEmitter.emit('permission-error', contextualError);
    });
}

export function deleteDocument(
  firestore: Firestore,
  userId: string,
  documentId: string,
  onSuccess: () => void,
  onError: (error: Error) => void
) {
  const docRef = doc(firestore, `users/${userId}/documents`, documentId);

  deleteDoc(docRef)
    .then(() => {
      onSuccess();
    })
    .catch((error) => {
      const contextualError = new FirestorePermissionError({
        operation: 'delete',
        path: docRef.path,
      });
      onError(contextualError);
      errorEmitter.emit('permission-error', contextualError);
    });
}