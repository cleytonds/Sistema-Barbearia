import { api } from '../api/client.js';

export const authService = {
  async register(data) {
    return (await api.post('/auth/cadastro', data)).data;
  },
  async login(email, senha) {
    return (await api.post('/auth/login', { email, senha })).data;
  },
  async me() {
    return (await api.get('/auth/me')).data;
  },
  async logout() {
    await api.post('/auth/logout');
  },
  async forgotPassword(email) {
    return (await api.post('/auth/esqueci-senha', { email })).data;
  },
  async resetPassword(data) {
    return (await api.post('/auth/redefinir-senha', data)).data;
  },
  async changePassword(data) {
    return (await api.put('/auth/alterar-senha', data)).data;
  }
};

