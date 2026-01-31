// services/logger.ts
// Na Vercel system plików jest tylko do odczytu, więc używamy tylko Console transport
const { createLogger, format, transports } = require('winston');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

const loggerTransports = [
  new transports.Console(),
];

// Lokalne środowisko - dodaj logi plikowe
if (!isVercel) {
  try {
    loggerTransports.push(new transports.File({ filename: 'logs/error.log', level: 'error' }));
    loggerTransports.push(new transports.File({ filename: 'logs/combined.log' }));
  } catch {}
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: loggerTransports,
});

module.exports = logger;
