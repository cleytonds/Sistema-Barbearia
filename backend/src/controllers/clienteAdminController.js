import * as clients from '../services/clienteAdminService.js';
export const list = async (req, res) => res.json(await clients.list(req.query));
export const history = async (req, res) =>
  res.json({ data: await clients.history(req.params.id, req.query) });
