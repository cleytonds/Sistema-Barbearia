const KEY = 'elite081.schedulingDraft';
const VERSION = 1;
const TTL_MS = 30 * 60 * 1000;
const allowed = ['servicoId', 'barbeiroId', 'data', 'horaInicio', 'observacoes'];
const isId = (value) => value == null || (typeof value === 'string' && /^\d+$/.test(value));
const validData = (data) =>
  data &&
  Object.keys(data).every((key) => allowed.includes(key)) &&
  isId(data.servicoId) &&
  isId(data.barbeiroId) &&
  (data.data == null || /^\d{4}-\d{2}-\d{2}$/.test(data.data)) &&
  (data.horaInicio == null || /^\d{2}:\d{2}$/.test(data.horaInicio)) &&
  (data.observacoes == null || typeof data.observacoes === 'string');

function storage() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}
export const schedulingStorage = {
  save(data, now = Date.now()) {
    if (!validData(data)) return false;
    storage()?.setItem(KEY, JSON.stringify({ version: VERSION, expiresAt: now + TTL_MS, data }));
    return true;
  },
  read(now = Date.now()) {
    try {
      const raw = storage()?.getItem(KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (draft.version !== VERSION || draft.expiresAt <= now || !validData(draft.data)) {
        this.clear();
        return null;
      }
      return draft.data;
    } catch {
      this.clear();
      return null;
    }
  },
  clear() {
    storage()?.removeItem(KEY);
  },
};
export { KEY as SCHEDULING_STORAGE_KEY, TTL_MS as SCHEDULING_DRAFT_TTL_MS };
