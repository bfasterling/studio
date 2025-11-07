import { config } from 'dotenv';
config();

import '@/ai/flows/limit-responses-to-document-content.ts';
import '@/ai/flows/analyze-documents-based-on-instructions.ts';
import '@/ai/flows/answer-questions-based-on-analyzed-documents.ts';