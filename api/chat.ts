import { VercelRequest, VercelResponse } from '@vercel/node';
import { generateChatResponse } from '../src/ai/flows/chat-flow';
import { ChatInput } from '../src/types/chat';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const input: ChatInput = req.body;
    const response = await generateChatResponse(input);
    res.status(200).json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
} 