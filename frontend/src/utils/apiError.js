const DEFAULT_MESSAGE = 'Não foi possível concluir a operação.';

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim();
}

function errorDetails(data) {
  const nested = data?.error && typeof data.error === 'object' ? data.error : null;
  const candidates = [nested?.details, nested?.errors, data?.details, data?.errors];
  return candidates.find(Array.isArray) ?? [];
}

function fieldErrors(details) {
  return details.reduce((result, detail) => {
    if (!detail || typeof detail !== 'object') return result;
    const field = firstText(detail.campo, detail.field, detail.path, detail.param);
    const message = firstText(detail.mensagem, detail.message, detail.msg, detail.erro);
    if (field && message && !result[field]) result[field] = message;
    return result;
  }, {});
}

export function apiError(error, fallback = DEFAULT_MESSAGE) {
  const data = error?.response?.data;
  const nested = data?.error && typeof data.error === 'object' ? data.error : null;
  const details = errorDetails(data);
  const firstListedError = Array.isArray(data?.errors)
    ? data.errors.find((item) => typeof item === 'string')
    : null;
  const message = firstText(
    nested?.message,
    typeof data?.error === 'string' ? data.error : null,
    data?.message,
    typeof data?.erro === 'string' ? data.erro : data?.erro?.message,
    firstListedError,
    fallback,
  );
  return {
    code: nested?.code ?? data?.code ?? 'REQUEST_ERROR',
    message,
    details,
    fieldErrors: fieldErrors(details),
  };
}
