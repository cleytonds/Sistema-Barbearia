import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestContext } from './middlewares/requestContext.js';
import { router } from './routes/index.js';

export function configureTrustProxy(application, trustProxy = env.trustProxy) {
  application.set('trust proxy', trustProxy);
}

export const app = express();

configureTrustProxy(app);
app.disable('x-powered-by');
app.use(requestContext);
app.use(helmet());
app.use(cors({ origin: env.frontendOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api', router);
app.use(notFound);
app.use(errorHandler);
