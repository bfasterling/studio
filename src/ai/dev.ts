'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/limit-responses-to-document-content.ts';
