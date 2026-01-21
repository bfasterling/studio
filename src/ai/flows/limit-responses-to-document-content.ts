'use server';

/**
 * @fileOverview Limits the AI chat agent to respond only to questions related to the content of the uploaded documents using a search tool.
 *
 * - limitResponsesToDocumentContent - A function that orchestrates document search and answer generation.
 * - LimitResponsesToDocumentContentInput - The input type for the function.
 * - LimitResponsesToDocumentContentOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

type Document = {
  id: string;
  content: string;
  fileName: string;
  analysisInstructions: string;
  [key: string]: any;
};


const LimitResponsesToDocumentContentInputSchema = z.object({
  question: z.string().describe('The user question.'),
  documents: z.array(z.any()).describe('The full list of documents available to search.'),
  history: z.array(MessageSchema).describe('The conversation history.'),
});
export type LimitResponsesToDocumentContentInput = z.infer<
  typeof LimitResponsesToDocumentContentInputSchema
>;

const LimitResponsesToDocumentContentOutputSchema = z.object({
  answer: z.string().describe('The AI chat agent answer.'),
});
export type LimitResponsesToDocumentContentOutput = z.infer<
  typeof LimitResponsesToDocumentContentOutputSchema
>;

export async function limitResponsesToDocumentContent(
  input: LimitResponsesToDocumentContentInput
): Promise<LimitResponsesToDocumentContentOutput> {
  return limitResponsesToDocumentContentFlow(input);
}

const limitResponsesToDocumentContentFlow = ai.defineFlow(
  {
    name: 'limitResponsesToDocumentContentFlow',
    inputSchema: LimitResponsesToDocumentContentInputSchema,
    outputSchema: LimitResponsesToDocumentContentOutputSchema,
  },
  async (input) => {
    const documents: Document[] = input.documents;
    
    // Define the search tool within the flow to capture the 'documents' in its scope.
    const searchDocumentsTool = ai.defineTool(
      {
        name: 'searchDocuments',
        description: 'Searches through the content of uploaded documents to find information relevant to a user query.',
        inputSchema: z.object({
          query: z.string().describe('A specific, targeted query to search for within the documents. This should be more like a search engine query than a full question.'),
        }),
        outputSchema: z.string().describe('A string containing the concatenated content of the most relevant document chunks found. Returns an empty string if no relevant content is found.'),
      },
      async ({ query }) => {
        // Simple keyword-based search implementation.
        const searchWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        
        const rankedDocs = documents
          .map(doc => {
            const content = doc.content.toLowerCase();
            let score = 0;
            for (const word of searchWords) {
              // A simple scoring mechanism: count occurrences.
              score += (content.match(new RegExp(word, 'g')) || []).length;
            }
            // Boost score if file name is relevant
            if (doc.fileName.toLowerCase().includes(query.toLowerCase())) {
                score += 5;
            }

            return { ...doc, score };
          })
          .filter(doc => doc.score > 0)
          .sort((a, b) => b.score - a.score);

        const topDocs = rankedDocs.slice(0, 3); // Take top 3 most relevant documents

        if (topDocs.length === 0) {
          return "No relevant information found in the documents for the given query.";
        }
        
        return topDocs.map(doc => `Content from document "${doc.fileName}":\n${doc.content}`).join('\n\n---\n\n');
      }
    );

    const llmResponse = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      tools: [searchDocumentsTool],
      history: input.history.map(m => ({role: m.role, content: [{text: m.content}]})),
      prompt: input.question,
      system: `Eres un agente de chat de IA experto en análisis de documentos. Tu objetivo es responder preguntas basándote únicamente en la información que puedes encontrar en los documentos proporcionados, utilizando la herramienta 'searchDocuments'.

**Instrucciones clave:**
1.  **Usa la herramienta 'searchDocuments'**: Antes de responder, SIEMPRE debes usar la herramienta 'searchDocuments' para encontrar el contenido relevante. Puedes usarla varias veces si es necesario para recopilar toda la información. Formula consultas de búsqueda específicas y concisas.
2.  **Basa tus respuestas en los resultados**: Fundamenta tu respuesta EXCLUSIVAMENTE en el texto que te devuelve la herramienta. No inventes información ni utilices conocimiento previo.
3.  **Infiere y conecta ideas**: A partir del contenido obtenido con la herramienta, conecta ideas y razona para dar una respuesta completa, aunque no esté escrita de forma literal. Si se pregunta "a qué hora se recomienda tomar leche" y el documento dice "tomar leche por la noche es bueno", infiere que la noche es un momento recomendado.
4.  **Resume, no cites textualmente**: Elabora un resumen coherente y con tus propias palabras sobre la información encontrada. No copies y pegues. Si la respuesta es larga, esfuérzate por sintetizarla.
5.  **Usa formato HTML para presentar**: Para mejorar la presentación de tus respuestas, utiliza etiquetas HTML.
    -   Para listas, usa viñetas con las etiquetas <ul> y <li>.
    -   Para datos tabulares, usa tablas con etiquetas <table>, <thead>, <tbody>, <tr>, <th> y <td>. Asegúrate de que la tabla y todas sus celdas tengan bordes delgados para una mejor legibilidad, usando un estilo como '<table style="border: 1px solid #cccccc; border-collapse: collapse; width: 100%; font-size: 0.9em;">' y '<th style="border: 1px solid #cccccc; padding: 5px;">'.
    -   Para resaltar texto importante, utiliza la etiqueta <strong>.
6.  **Si no encuentras información**: Si después de usar la herramienta 'searchDocuments' no encuentras información relevante para responder la pregunta, indica amablemente que no puedes responder basándote en los documentos proporcionados.`,
    });

    return { answer: llmResponse.text };
  }
);
