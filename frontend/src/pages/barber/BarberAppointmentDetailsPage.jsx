import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/operational/index.jsx';
import { Alert, Badge, Button, Dialog, Skeleton } from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';
const actions = {
  pendente: [
    ['confirmado', 'Confirmar'],
    ['ausente', 'Marcar ausência'],
  ],
  confirmado: [
    ['em_atendimento', 'Iniciar atendimento'],
    ['ausente', 'Marcar ausência'],
  ],
  em_atendimento: [['concluido', 'Concluir']],
};
export default function BarberAppointmentDetailsPage() {
  useDocumentTitle('Detalhe do atendimento');
  const { id } = useParams();
  const state = useRemoteData(() => operacionalService.barberAppointment(id), [id]);
  const [next, setNext] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const item = state.data?.data;
  async function update() {
    setBusy(true);
    setError(null);
    try {
      await operacionalService.updateAppointmentStatus(id, next);
      setNext(null);
      await state.reload();
    } catch (e) {
      setError(e.response?.data?.error?.message ?? 'Não foi possível alterar o status.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title={`Atendimento #${id}`} />
      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Alert type="error">{state.error.message}</Alert>
      ) : (
        <article className="card stack">
          <div className="cluster">
            <Badge>{item.status}</Badge>
            {item.arquivado && <Badge>Arquivado</Badge>}
          </div>
          <h2>{item.cliente.nome}</h2>
          <dl>
            <dt>Serviço</dt>
            <dd>{item.servico.nome}</dd>
            <dt>Data</dt>
            <dd>{item.data}</dd>
            <dt>Horário</dt>
            <dd>
              {item.horaInicio}–{item.horaFim}
            </dd>
            {item.observacoes && (
              <>
                <dt>Observação</dt>
                <dd>{item.observacoes}</dd>
              </>
            )}
          </dl>
          <div className="cluster">
            {(actions[item.status] ?? []).map(([status, label]) => (
              <Button key={status} onClick={() => setNext(status)}>
                {label}
              </Button>
            ))}
          </div>
        </article>
      )}
      <Dialog open={Boolean(next)} onClose={() => setNext(null)} title="Confirmar alteração">
        <p>O backend validará o horário e a transição antes de concluir.</p>
        {error && <Alert type="error">{error}</Alert>}
        <Button loading={busy} onClick={update}>
          Confirmar
        </Button>
      </Dialog>
    </>
  );
}
