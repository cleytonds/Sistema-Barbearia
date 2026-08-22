import { Link, useParams } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { BrandMark } from '../components/brand/BrandMark.jsx';
import { Alert, Card, Skeleton } from '../components/ui/index.jsx';
import { AppointmentStatusBadge } from '../components/appointments/index.jsx';
import { WhatsAppShareButton } from '../components/appointments/WhatsAppShareButton.jsx';
import { useAppointmentDetails } from '../hooks/useAppointmentDetails.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { formatDate, formatMoney } from '../utils/dateTime.js';
import { hasWhatsAppShareData } from '../utils/whatsappShare.js';
export default function ScheduleSuccessPage() {
  useDocumentTitle('Agendamento confirmado');
  const { id } = useParams();
  const { data, loading, error } = useAppointmentDetails(id);
  return (
    <Container as="section" className="page stack schedule-success">
      <div>
        <BrandMark linked={false} variant="success" />
        <p className="eyebrow">Agendamento recebido</p>
        <h1>Seu horário foi registrado.</h1>
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <Alert type="error">Não foi possível carregar o agendamento.</Alert>
      ) : (
        <Card className="stack">
          <AppointmentStatusBadge status={data.status} />
          {hasWhatsAppShareData(data) && (
            <div className="schedule-success__share stack">
              <p>Compartilhe os dados do seu horário pelo WhatsApp.</p>
              <WhatsAppShareButton agendamento={data} />
            </div>
          )}
          <h2>{data.servico.nome}</h2>
          <p>ID: {data.id}</p>
          <p>{data.barbeiro.nome}</p>
          <p>
            {formatDate(data.data)} · {data.horaInicio}–{data.horaFim}
          </p>
          <p>{formatMoney(data.preco)}</p>
        </Card>
      )}
      <div className="cluster">
        <Link className="button button--primary" to="/meus-agendamentos">
          Meus agendamentos
        </Link>
        <Link className="button button--secondary" to="/">
          Voltar ao início
        </Link>
      </div>
    </Container>
  );
}
