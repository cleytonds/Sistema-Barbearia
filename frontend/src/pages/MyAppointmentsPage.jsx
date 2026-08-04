import { useState } from 'react';
import { Container } from '../components/layout/index.jsx';
import { AppointmentCard } from '../components/appointments/index.jsx';
import {
  CancelAppointmentDialog,
  RescheduleAppointmentDialog,
} from '../components/appointments/AppointmentDialogs.jsx';
import { Alert, Button, EmptyState, Pagination, Skeleton } from '../components/ui/index.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useMeusAgendamentos } from '../hooks/useMeusAgendamentos.js';
import { usePagination } from '../hooks/usePagination.js';
import { useToast } from '../contexts/ToastContext.jsx';
export default function MyAppointmentsPage() {
  useDocumentTitle('Meus agendamentos');
  const { notify } = useToast();
  const pagination = usePagination(10);
  const [period, setPeriod] = useState('inicio'),
    [status, setStatus] = useState(''),
    [selected, setSelected] = useState(null),
    [mode, setMode] = useState(null);
  const query = useMeusAgendamentos({
    ...pagination.params,
    periodo: period,
    ...(status && { status }),
    sort: 'inicio',
    order: period === 'inicio' ? 'asc' : 'desc',
  });
  const close = () => {
    setSelected(null);
    setMode(null);
  };
  const success = () => {
    notify(mode === 'cancel' ? 'Agendamento cancelado.' : 'Agendamento reagendado.', 'success');
    query.reload();
  };
  return (
    <Container as="section" className="page stack">
      <h1>Meus agendamentos</h1>
      <div className="cluster" role="tablist" aria-label="Período">
        <Button
          variant={period === 'inicio' ? 'primary' : 'secondary'}
          onClick={() => {
            setPeriod('inicio');
            pagination.setPage(1);
          }}
        >
          Próximos
        </Button>
        <Button
          variant={period === 'historico' ? 'primary' : 'secondary'}
          onClick={() => {
            setPeriod('historico');
            pagination.setPage(1);
          }}
        >
          Histórico
        </Button>
        <label>
          Status{' '}
          <select
            className="field__control"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              pagination.setPage(1);
            }}
          >
            <option value="">Todos</option>
            {['pendente', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'ausente'].map(
              (item) => (
                <option key={item} value={item}>
                  {item.replace('_', ' ')}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      {query.loading ? (
        <>
          <Skeleton />
          <Skeleton />
        </>
      ) : query.error ? (
        <Alert type="error">
          Não foi possível carregar. <button onClick={query.reload}>Tentar novamente</button>
        </Alert>
      ) : query.data?.data?.length ? (
        <div className="stack">
          {query.data.data.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={(item) => {
                setSelected(item);
                setMode('cancel');
              }}
              onReschedule={(item) => {
                setSelected(item);
                setMode('reschedule');
              }}
            />
          ))}
          <Pagination
            page={query.data.pagination.page}
            totalPages={query.data.pagination.totalPages}
            onChange={pagination.setPage}
          />
        </div>
      ) : (
        <EmptyState
          title={
            period === 'inicio' ? 'Nenhum próximo agendamento' : 'Nenhum agendamento no histórico'
          }
        />
      )}
      {selected && (
        <>
          <CancelAppointmentDialog
            appointment={selected}
            open={mode === 'cancel'}
            onClose={close}
            onSuccess={success}
          />
          <RescheduleAppointmentDialog
            appointment={selected}
            open={mode === 'reschedule'}
            onClose={close}
            onSuccess={success}
          />
        </>
      )}
    </Container>
  );
}
