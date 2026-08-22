import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../ui/index.jsx';
import { appointmentStatus } from '../../utils/appointmentStatus.js';
import { formatDate, formatMoney } from '../../utils/dateTime.js';

export function AppointmentStatusBadge({ status }) {
  const item = appointmentStatus[status] ?? { label: status, tone: 'info' };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}
export function AppointmentCard({ appointment, onCancel, onReschedule, onHide }) {
  return (
    <Card>
      <div className="cluster">
        <AppointmentStatusBadge status={appointment.status} />
        <span>{formatDate(appointment.data)}</span>
      </div>
      <h2>{appointment.servico.nome}</h2>
      <p>
        {appointment.barbeiro.nome} · {appointment.horaInicio}–{appointment.horaFim}
      </p>
      <p>{formatMoney(appointment.preco)}</p>
      <div className="cluster">
        <Link className="button button--secondary" to={`/agendamentos/${appointment.id}`}>
          Ver detalhes
        </Link>
        {appointment.podeCancelar && (
          <Button variant="danger" onClick={() => onCancel?.(appointment)}>
            Cancelar
          </Button>
        )}
        {appointment.podeReagendar && (
          <Button variant="secondary" onClick={() => onReschedule?.(appointment)}>
            Reagendar
          </Button>
        )}
        {onHide && (
          <Button variant="secondary" onClick={() => onHide(appointment)}>
            Ocultar do meu histórico
          </Button>
        )}
      </div>
    </Card>
  );
}
