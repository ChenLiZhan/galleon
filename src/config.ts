import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  channelSecret: requireEnv('CHANNEL_SECRET'),
  channelAccessToken: requireEnv('CHANNEL_ACCESS_TOKEN'),
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
};
