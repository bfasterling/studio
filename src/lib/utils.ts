import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Splits a long string of text into smaller chunks of a specified size.
 * Tries to avoid splitting words in the middle.
 * @param text The text to split.
 * @param chunkSize The approximate maximum size of each chunk.
 * @returns An array of text chunks.
 */
export function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let chunkEnd = i + chunkSize;
    if (chunkEnd < text.length) {
      // To avoid splitting words, find the last space before the hard limit
      const lastSpace = text.lastIndexOf(' ', chunkEnd);
      // If a space is found after the start of the chunk, use it as the end
      if (lastSpace > i) {
        chunkEnd = lastSpace;
      }
    }
    chunks.push(text.substring(i, chunkEnd));
    i = chunkEnd;
  }
  return chunks;
}
