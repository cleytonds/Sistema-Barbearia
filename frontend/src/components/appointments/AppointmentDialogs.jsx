import { useState } from 'react';
import { Alert, Button, Dialog, Input, Textarea } from '../ui/index.jsx';
import { useCancelarAgendamento } from '../../hooks/useCancelarAgendamento.js';
import { useDisponibilidade } from '../../hooks/useDisponibilidade.js';
import { useReagendarAgendamento } from '../../hooks/useReagendarAgendamento.js';

export function CancelAppointmentDialog({ appointment, open, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const { cancelar, loading, error } = useCancelarAgendamento();
  async function confirm() {
    try {
      const result = await cancelar(appointment.id, reason || undefined);
      onSuccess(result.data);
      onClose();
    } catch {
      /* feedback remains in dialog */
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Cancelar agendamento">
      <div className="stack">
        <p>Essa ação altera o status do agendamento e não remove seu histórico.</p>
        <Textarea
          label="Motivo (opcional)"
          maxLength="500"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {error && <Alert type="error">{error.message}</Alert>}
        <div className="cluster">
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" loading={loading} onClick={confirm}>
            Confirmar cancelamento
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
export function RescheduleAppointmentDialog({ appointment, open, onClose, onSuccess }) {
  const [date, setDate] = useState(''),
    [time, setTime] = useState('');
  const { reagendar, loading, error } = useReagendarAgendamento();
  const availability = useDisponibilidade({
    barbeiroId: appointment.barbeiro.id,
    servicoId: appointment.servico.id,
    data: date,
  });
  async function confirm() {
    try {
      const result = await reagendar(appointment.id, { data: date, horaInicio: time });
      onSuccess(result.data);
      onClose();
    } catch (requestError) {
      if (requestError.code === 'AVAILABILITY_CHANGED') {
        setTime('');
        availability.reload();
      }
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Reagendar">
      <div className="stack">
        <p>
          Serviço: {appointment.servico.nome}
          <br />
          Profissional: {appointment.barbeiro.nome}
        </p>
        <Input
          label="Nova data"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setTime('');
          }}
        />
        {availability.loading && <p>Consultando horários…</p>}
        {availability.error && <Alert type="error">Não foi possível consultar a agenda.</Alert>}
        <div className="time-grid">
          {availability.disponibilidade?.horarios
            ?.filter(
              (slot) => !(date === appointment.data && slot.inicioLocal === appointment.horaInicio),
            )
            .map((slot) => (
              <label className="card select-card" key={slot.inicioLocal}>
                <input
                  type="radio"
                  name="novo-horario"
                  checked={time === slot.inicioLocal}
                  onChange={() => setTime(slot.inicioLocal)}
                />
                {slot.inicioLocal}–{slot.fimLocal}
              </label>
            ))}
        </div>
        {error && <Alert type="error">{error.message}</Alert>}
        <div className="cluster">
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button loading={loading} disabled={!date || !time} onClick={confirm}>
            Confirmar reagendamento
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
