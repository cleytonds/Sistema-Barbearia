import * as dashboards from '../services/dashboardService.js';
export const barber = async (req, res) =>
  res.json({ data: await dashboards.barberDashboard(req.auth.usuario.id, req.query.data) });
export const admin = async (req, res) =>
  res.json({ data: await dashboards.adminDashboard(req.query.data) });
