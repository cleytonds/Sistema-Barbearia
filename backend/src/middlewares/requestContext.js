import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER, REQUEST_ID_MAX_LENGTH } from '../config/httpConfig.js';

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function isValidRequestId(value) {
  return (
    typeof value === 'string' &&
    value.length <= REQUEST_ID_MAX_LENGTH &&
    requestIdPattern.test(value)
  );
}

/** Preserva apenas IDs controlados; entradas ausentes ou inválidas recebem UUID seguro. */
export function requestContext(request, response, next) {
  const received = request.get(REQUEST_ID_HEADER);
  request.requestId = isValidRequestId(received) ? received : randomUUID();
  response.set(REQUEST_ID_HEADER, request.requestId);
  next();
}
