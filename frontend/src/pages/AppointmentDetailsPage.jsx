import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { AppointmentStatusBadge } from '../components/appointments/index.jsx';
import {
  CancelAppointmentDialog,
  RescheduleAppointmentDialog,
} from '../components/appointments/AppointmentDialogs.jsx';
import { WhatsAppShareButton } from '../components/appointments/WhatsAppShareButton.jsx';
import { Alert, Button, Card, Skeleton } from '../components/ui/index.jsx';
import { useAppointmentDetails } from '../hooks/useAppointmentDetails.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { formatDate, formatMoney } from '../utils/dateTime.js';
import { hasWhatsAppShareData } from '../utils/whatsappShare.js';
import { useToast } from '../contexts/ToastContext.jsx';
export default function AppointmentDetailsPage() {
  useDocumentTitle('Detalhe do agendamento');
  const { id } = useParams();
  const { data, loading, error, setData } = useAppointmentDetails(id);
  const [mode, setMode] = useState(null);
  const { notify } = useToast();
  const update = (item) => {
    setData(item);
    notify(mode === 'cancel' ? 'Agendamento cancelado.' : 'Agendamento reagendado.', 'success');
    setMode(null);
  };
  return (
    <Container as="section" className="page stack">
      <h1>Detalhe do agendamento</h1>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <Alert type="error">Não foi possível carregar este agendamento.</Alert>
      ) : (
        <>
          <Card>
            <AppointmentStatusBadge status={data.status} />
            <h2>{data.servico.nome}</h2>
            <p>
              <strong>Profissional:</strong> {data.barbeiro.nome}
            </p>
            <p>
              <strong>Data:</strong> {formatDate(data.data)}
            </p>
            <p>
              <strong>Horário:</strong> {data.horaInicio}–{data.horaFim}
            </p>
            <p>
              <strong>Preço:</strong> {formatMoney(data.preco)}
            </p>
            {data.observacoes && (
              <p>
                <strong>Observações:</strong> {data.observacoes}
              </p>
            )}
            {hasWhatsAppShareData(data) && <WhatsAppShareButton agendamento={data} />}
            <div className="cluster">
              {data.podeCancelar && (
                <Button variant="danger" onClick={() => setMode('cancel')}>
                  Cancelar
                </Button>
              )}
              {data.podeReagendar && (
                <Button variant="secondary" onClick={() => setMode('reschedule')}>
                  Reagendar
                </Button>
              )}
            </div>
          </Card>
          <CancelAppointmentDialog
            appointment={data}
            open={mode === 'cancel'}
            onClose={() => setMode(null)}
            onSuccess={update}
          />
          <RescheduleAppointmentDialog
            appointment={data}
            open={mode === 'reschedule'}
            onClose={() => setMode(null)}
            onSuccess={update}
          />
        </>
      )}
    </Container>
  );
}
