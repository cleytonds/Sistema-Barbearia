import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../components/layout/index.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { RoleRoute } from './RoleRoute.jsx';
import { GuestRoute } from './GuestRoute.jsx';
import { OperationalLayout } from '../components/operational/index.jsx';
const HomePage = lazy(() => import('../pages/HomePage.jsx'));
const LoginPage = lazy(() => import('../pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage.jsx'));
const SchedulePage = lazy(() => import('../pages/SchedulePage.jsx'));
const ScheduleSuccessPage = lazy(() => import('../pages/ScheduleSuccessPage.jsx'));
const MyAppointmentsPage = lazy(() => import('../pages/MyAppointmentsPage.jsx'));
const AppointmentDetailsPage = lazy(() => import('../pages/AppointmentDetailsPage.jsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));
const AccessDeniedPage = lazy(() => import('../pages/AccessDeniedPage.jsx'));
const AreaSelectionPage = lazy(() => import('../pages/AreaSelectionPage.jsx'));
const BarberDashboardPage = lazy(() => import('../pages/barber/BarberDashboardPage.jsx'));
const BarberAgendaPage = lazy(() => import('../pages/barber/BarberAgendaPage.jsx'));
const BarberAppointmentDetailsPage = lazy(
  () => import('../pages/barber/BarberAppointmentDetailsPage.jsx'),
);
const BarberSchedulePage = lazy(() => import('../pages/barber/BarberSchedulePage.jsx'));
const BarberBlocksPage = lazy(() => import('../pages/barber/BarberBlocksPage.jsx'));
const BarberProfilePage = lazy(() => import('../pages/barber/BarberProfilePage.jsx'));
const adminPage = (name) =>
  lazy(() => import('../pages/admin/AdminPages.jsx').then((module) => ({ default: module[name] })));
const AdminDashboardPage = adminPage('AdminDashboardPage'),
  AdminAppointmentsPage = adminPage('AdminAppointmentsPage'),
  AdminCreateAppointmentPage = adminPage('AdminCreateAppointmentPage'),
  AdminAppointmentDetailsPage = adminPage('AdminAppointmentDetailsPage'),
  AdminClientHistoryPage = adminPage('AdminClientHistoryPage'),
  AdminServicesPage = adminPage('AdminServicesPage'),
  AdminBarbersPage = adminPage('AdminBarbersPage'),
  AdminBarberDetailsPage = adminPage('AdminBarberDetailsPage'),
  AdminBusinessHoursPage = adminPage('AdminBusinessHoursPage'),
  AdminSchedulesPage = adminPage('AdminSchedulesPage'),
  AdminBlocksPage = adminPage('AdminBlocksPage'),
  AdminSettingsPage = adminPage('AdminSettingsPage'),
  AdminPlansPage = adminPage('AdminPlansPage'),
  AdminSubscriptionsPage = adminPage('AdminSubscriptionsPage');
const AdminCommissionsPage = lazy(() => import('../pages/admin/AdminCommissionsPage.jsx'));
const PlanosPage = lazy(() => import('../pages/PlanosPage.jsx'));
const MeuPlanoPage = lazy(() => import('../pages/MeuPlanoPage.jsx'));
const barberLinks = [
  { to: '/barbeiro', label: 'Visão geral' },
  { to: '/barbeiro/agenda', label: 'Minha agenda' },
  { to: '/barbeiro/jornada', label: 'Minha jornada' },
  { to: '/barbeiro/bloqueios', label: 'Meus bloqueios' },
  { to: '/barbeiro/perfil', label: 'Meu perfil' },
];
const adminLinks = [
  { to: '/admin', label: 'Visão geral' },
  { to: '/admin/agendamentos', label: 'Agendamentos' },
  { to: '/admin/servicos', label: 'Serviços' },
  { to: '/admin/barbeiros', label: 'Profissionais' },
  { to: '/admin/funcionamento', label: 'Funcionamento' },
  { to: '/admin/jornadas', label: 'Jornadas' },
  { to: '/admin/bloqueios', label: 'Bloqueios' },
  { to: '/admin/planos', label: 'Planos' },
  { to: '/admin/assinaturas', label: 'Assinaturas' },
  { to: '/admin/comissoes', label: 'Comissões' },
  { to: '/admin/configuracoes', label: 'Configurações' },
];
export function AppRoutes() {
  return (
    <Suspense fallback={<main aria-busy="true">Carregando página…</main>}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/planos" element={<PlanosPage />} />
          <Route path="/agendar" element={<SchedulePage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/selecionar-area" element={<AreaSelectionPage />} />
            <Route element={<RoleRoute roles={['cliente']} />}>
              <Route path="/agendamento/sucesso/:id" element={<ScheduleSuccessPage />} />
              <Route path="/meus-agendamentos" element={<MyAppointmentsPage />} />
              <Route path="/meu-plano" element={<MeuPlanoPage />} />
              <Route path="/agendamentos/:id" element={<AppointmentDetailsPage />} />
            </Route>
          </Route>
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="/acesso-negado" element={<AccessDeniedPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute roles={['barbeiro']} />}>
            <Route
              element={
                <OperationalLayout
                  area="Área do barbeiro"
                  homePath="/barbeiro"
                  links={barberLinks}
                />
              }
            >
              <Route path="/barbeiro" element={<BarberDashboardPage />} />
              <Route path="/barbeiro/agenda" element={<BarberAgendaPage />} />
              <Route path="/barbeiro/agendamentos/:id" element={<BarberAppointmentDetailsPage />} />
              <Route path="/barbeiro/jornada" element={<BarberSchedulePage />} />
              <Route path="/barbeiro/bloqueios" element={<BarberBlocksPage />} />
              <Route path="/barbeiro/perfil" element={<BarberProfilePage />} />
            </Route>
          </Route>
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route
              element={
                <OperationalLayout area="Administração" homePath="/admin" links={adminLinks} />
              }
            >
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/agendamentos" element={<AdminAppointmentsPage />} />
              <Route path="/admin/agendamentos/novo" element={<AdminCreateAppointmentPage />} />
              <Route path="/admin/agendamentos/:id" element={<AdminAppointmentDetailsPage />} />
              <Route path="/admin/clientes/:id" element={<AdminClientHistoryPage />} />
              <Route path="/admin/servicos" element={<AdminServicesPage />} />
              <Route path="/admin/barbeiros" element={<AdminBarbersPage />} />
              <Route path="/admin/barbeiros/:id" element={<AdminBarberDetailsPage />} />
              <Route path="/admin/funcionamento" element={<AdminBusinessHoursPage />} />
              <Route path="/admin/jornadas" element={<AdminSchedulesPage />} />
              <Route path="/admin/bloqueios" element={<AdminBlocksPage />} />
              <Route path="/admin/configuracoes" element={<AdminSettingsPage />} />
              <Route path="/admin/planos" element={<AdminPlansPage />} />
              <Route path="/admin/assinaturas" element={<AdminSubscriptionsPage />} />
              <Route path="/admin/comissoes" element={<AdminCommissionsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
