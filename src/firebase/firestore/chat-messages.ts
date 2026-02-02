'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface ConversationData {
  userId: string;
  questionText: string;
  answerText: string;
}

export function saveConversation(
  firestore: Firestore,
  data: ConversationData,
) {
  const collectionRef = collection(firestore, 'conversations');
  
  // Non-blocking write
  return addDoc(collectionRef, {
    ...data,
    timestamp: serverTimestamp(),
  })
    .catch((error) => {
      const contextualError = new FirestorePermissionError({
        operation: 'create',
        path: collectionRef.path,
        requestResourceData: data,
      });
      // Emit the global error for debugging.
      errorEmitter.emit('permission-error', contextualError);
      console.error("Error saving conversation:", contextualError);
    });
}
