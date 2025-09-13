import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

const isProd = process.env.NODE_ENV === 'production';
let destination: pino.DestinationStream | undefined;

if (isProd) {
  const logsDir = path.join(process.cwd(), 'server', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  destination = pino.destination(path.join(logsDir, 'parenthub.log'));
}

export const log = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          },
  },
  destination
);
