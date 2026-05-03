
'use server';

/**
 * @fileOverview An AI agent for diagnosing Mezuzah scroll conditions.
 *
 * - diagnoseMezuzah - A function that handles the Mezuzah diagnosis process.
 * - DiagnoseMezuzahInput - The input type for the diagnoseMezuzah function.
 * - DiagnoseMezuzahOutput - The return type for the diagnoseMezuzah function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DiagnoseMezuzahInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo of a Mezuzah scroll, as a data URI that must include a MIME type and use Base64 encoding. Expected format: data:<mimetype>;base64,<encoded_data>.'
    ),
});
export type DiagnoseMezuzahInput = z.infer<typeof DiagnoseMezuzahInputSchema>;

const DiagnoseMezuzahOutputSchema = z.object({
  diagnosis: z
    .string()
    .describe(
      'The diagnosis of the Mezuzah scroll, detailing its condition and any potential issues with the script that may affect its kosher status.'
    ),
});
export type DiagnoseMezuzahOutput = z.infer<typeof DiagnoseMezuzahOutputSchema>;

export async function diagnoseMezuzah(input: DiagnoseMezuzahInput): Promise<DiagnoseMezuzahOutput> {
  return diagnoseMezuzahFlow(input);
}

const mezuzahDiagnosisPrompt = ai.definePrompt({
  name: 'mezuzahDiagnosisPrompt',
  input: {schema: DiagnoseMezuzahInputSchema},
  output: {schema: DiagnoseMezuzahOutputSchema},
  prompt: `You are an expert sofer (scribe) specializing in diagnosing Mezuzah scroll issues.

You will analyze the provided image of the Mezuzah scroll to assess its condition and identify any potential problems with the script that may affect its kosher status. Provide a detailed diagnosis.

CRITICAL: You must provide the diagnosis in HEBREW ONLY (עברית בלבד). Do not use any other languages in your response.

Image: {{media url=photoDataUri}}`,
});

const diagnoseMezuzahFlow = ai.defineFlow(
  {
    name: 'diagnoseMezuzahFlow',
    inputSchema: DiagnoseMezuzahInputSchema,
    outputSchema: DiagnoseMezuzahOutputSchema,
  },
  async input => {
    const {output} = await mezuzahDiagnosisPrompt(input);
    return output!;
  }
);
