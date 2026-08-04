import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../components/layout/index.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { RoleRoute } from './RoleRoute.jsx';
import { GuestRoute } from './GuestRoute.jsx';
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
export function AppRoutes() {
  return (
    <Suspense fallback={<main aria-busy="true">Carregando página…</main>}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/agendar" element={<SchedulePage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute roles={['cliente']} />}>
              <Route path="/agendamento/sucesso/:id" element={<ScheduleSuccessPage />} />
              <Route path="/meus-agendamentos" element={<MyAppointmentsPage />} />
              <Route path="/agendamentos/:id" element={<AppointmentDetailsPage />} />
            </Route>
          </Route>
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
