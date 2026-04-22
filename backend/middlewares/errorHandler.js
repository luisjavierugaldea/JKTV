/**
 * middlewares/errorHandler.js
 * Manejador global de errores de Express.
 * Captura todos los errores pasados con next(err) y devuelve
 * una respuesta JSON estructurada y consistente.
 */

import { config } from '../config/env.js';

/**
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode ?? err.status ?? 500;
  const message = err.message ?? 'Error interno del servidor';

  // Log completo solo en desarrollo
  if (config.isDev) {
    console.error(`\n❌ [ERROR] ${req.method} ${req.originalUrl}`);
    console.error(err.stack ?? err);
  } else {
    console.error(`[ERROR] ${statusCode} — ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      // Solo exponer stack trace en dev
      ...(config.isDev && { stack: err.stack }),
    },
  });
}

/**
 * Clase de error personalizada para lanzar errores HTTP con código de estado.
 * @example throw new AppError('No encontrado', 404)
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
