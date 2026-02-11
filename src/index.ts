import {
  messagingApi,
  middleware,
  SignatureValidationFailed,
  JSONParseError,
  WebhookEvent,
} from '@line/bot-sdk';
import express, { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { parseCommand, executeCommand } from './commands.js';
import { parseNaturalLanguage } from './llm.js';
import type { Command } from './types.js';

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const app = express();

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.post('/callback', middleware({ channelSecret: config.channelSecret }), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

function extractCommandText(event: WebhookEvent): string | null {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const { text, mention } = event.message;

  if (!mention?.mentionees?.length) return null;

  const firstMention = mention.mentionees[0];
  const mentionText = text.slice(0, firstMention.index + firstMention.length);
  const commandText = text.slice(mentionText.length).trim();

  return commandText || null;
}

async function handleEvent(event: WebhookEvent): Promise<unknown> {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const commandText = extractCommandText(event);
  if (!commandText) return null;

  const parsed = parseCommand(commandText);

  let command: Command | null = null;

  if (typeof parsed === 'string') {
    console.log('[NLU] Trying LLM fallback for:', commandText);
    command = await parseNaturalLanguage(commandText);
  } else {
    command = parsed;
  }

  let replyText: string;
  if (!command) {
    replyText = '抱歉，無法理解指令。請輸入 help 查看指令格式。';
  } else {
    try {
      replyText = await executeCommand(command);
    } catch (err) {
      console.error('Command execution error:', err);
      replyText = '系統錯誤，請稍後再試';
    }
  }

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: replyText }],
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SignatureValidationFailed) {
    res.status(401).send(err.signature);
    return;
  }
  if (err instanceof JSONParseError) {
    res.status(400).send(err.raw);
    return;
  }
  console.error(err);
  res.status(500).end();
});

app.listen(config.port, () => {
  console.log(`LINE Bot is running on port ${config.port}`);
});
