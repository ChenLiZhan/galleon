import {
  messagingApi,
  middleware,
  SignatureValidationFailed,
  JSONParseError,
  WebhookEvent,
  TextMessage,
} from '@line/bot-sdk';
import express, { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

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

async function handleEvent(event: WebhookEvent): Promise<unknown> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const echo: TextMessage = { type: 'text', text: event.message.text };

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [echo],
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
