const TOKEN_KEY = 'barbearia.accessToken';

function storage() {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export const authStorage = {
  clearLegacyToken() {
    storage()?.removeItem(TOKEN_KEY);
  },
};

// Limpeza de migração: nenhum token novo é persistido pelo frontend.
authStorage.clearLegacyToken();
