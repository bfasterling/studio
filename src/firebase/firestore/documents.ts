'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

interface DocumentData {
  fileName: string;
  content: string;
  analysisInstructions: string;
}

export function saveDocument(
  firestore: Firestore,
  data: DocumentData,
  onSuccess: () => void,
  onError: (error: Error) => void
) {
  addDoc(collection(firestore, 'documents'), {
    ...data,
    createdAt: serverTimestamp(),
  })
    .then(() => {
      onSuccess();
    })
    .catch((error) => {
      // This will catch permission errors and other issues.
      onError(error);
    });
}
