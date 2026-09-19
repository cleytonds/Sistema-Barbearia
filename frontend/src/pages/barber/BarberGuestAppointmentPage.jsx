import { GuestAppointmentForm } from '../../components/appointments/GuestAppointmentForm.jsx';
import { PageHeader } from '../../components/operational/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function BarberGuestAppointmentPage() {
  useDocumentTitle('Agendamento sem cadastro');
  return (
    <>
      <PageHeader title="Agendamento sem cadastro" />
      <GuestAppointmentForm role="barbeiro" />
    </>
  );
}
