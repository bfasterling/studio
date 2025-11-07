'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  query,
  collection,
  where,
  getDocs,
  type Query,
  type DocumentData,
} from 'firebase/firestore';

export const useCollection = (q: Query | null) => {
  const [data, setData] = useState<DocumentData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
        setIsLoading(false);
        return;
    };

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const documents = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setData(documents);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching collection: ", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q]);

  return { data, isLoading, error };
};
