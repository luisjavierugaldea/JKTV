/**
 * middlewares/requestLogger.js
 * Logger de peticiones HTTP usando Morgan.
 * En desarrollo muestra detalles completos.
 * En producción usa formato "combined" estándar.
 */

import morgan from 'morgan';
import { config } from '../config/env.js';

const format = config.isDev
  ? ':method :url :status :response-time ms — :res[content-length] bytes'
  : 'combined';

export const requestLogger = morgan(format);
