
'use server';
/**
 * @fileOverview A Genkit flow for handling chat conversations.
 *
 * - generateChatResponse - A function that generates a response to a user's message.
 */

import {ai} from '@/ai/genkit';
import { ChatInputSchema, ChatOutputSchema, type ChatInput, type ChatOutput } from '@/types/chat';

export async function generateChatResponse(input: ChatInput): Promise<ChatOutput> {
  return chatFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'chatPrompt',
  input: {schema: ChatInputSchema},
  output: {schema: ChatOutputSchema},
  prompt: `Eres un asistente de IA llamado EchoFlow. Eres amigable, servicial y estás aquí para ayudar.
      Responde al siguiente mensaje del usuario.
      {{#if imageDataUri}}
      También, considera la siguiente imagen que el usuario ha proporcionado.
      Imagen: {{media url=imageDataUri}}
      {{/if}}
      Mensaje del usuario: {{{message}}}`,
});

const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    const {output} = await chatPrompt(input);
    if (!output) {
      throw new Error('Response generation failed, received no output from the model.');
    }
    return output;
  }
);
