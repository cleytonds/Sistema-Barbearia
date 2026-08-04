const TOKEN_KEY = 'barbearia.accessToken';

function storage() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export const authStorage = {
  getToken() {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  },
  setToken(token) {
    if (!token) return this.clear();
    storage()?.setItem(TOKEN_KEY, token);
  },
  clear() {
    storage()?.removeItem(TOKEN_KEY);
  }
};

