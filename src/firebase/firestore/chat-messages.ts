'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface ChatMessageData {
  userId: string;
  messageText: string;
  isUserMessage: boolean;
}

export function saveChatMessage(
  firestore: Firestore,
  data: ChatMessageData,
) {
  const collectionRef = collection(firestore, 'chat_messages');
  
  // Non-blocking write
  addDoc(collectionRef, {
    ...data,
    timestamp: serverTimestamp(),
  })
    .catch((error) => {
      const contextualError = new FirestorePermissionError({
        operation: 'create',
        path: collectionRef.path,
        requestResourceData: data,
      });
      // We don't need onSuccess/onError callbacks here as the UI will update reactively.
      // But we should still emit the global error for debugging.
      errorEmitter.emit('permission-error', contextualError);
      console.error("Error saving chat message:", contextualError);
    });
}
