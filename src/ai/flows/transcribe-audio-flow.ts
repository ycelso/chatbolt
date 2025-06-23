
'use server';
/**
 * @fileOverview A Genkit flow for transcribing audio to text.
 *
 * - transcribeAudio - A function that handles the audio transcription.
 */

import {ai} from '@/ai/genkit';
import { 
  TranscribeAudioInputSchema, 
  TranscribeAudioOutputSchema, 
  type TranscribeAudioInput, 
  type TranscribeAudioOutput 
} from '@/types/chat';

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}

const transcribePrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscribeAudioInputSchema},
  output: {schema: TranscribeAudioOutputSchema},
  prompt: `Transcribe the following audio accurately. Respond only with the transcribed text. Audio: {{media url=audioDataUri}}`,
});

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async (input: TranscribeAudioInput) => {
    const {output} = await transcribePrompt(input);
    if (!output) {
      throw new Error('Transcription failed, received no output from the model.');
    }
    return output;
  }
);
