import { Link } from 'react-router-dom';
import React from 'react';
import { PageHeader } from '../../components/operational/index.jsx';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Pagination,
  Skeleton,
} from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';
const today = new Date().toISOString().slice(0, 10);
export default function BarberAgendaPage() {
  useDocumentTitle('Minha agenda');
  const [data, setData] = React.useState(today),
    [status, setStatus] = React.useState(''),
    [archived, setArchived] = React.useState(false),
    [archiveError, setArchiveError] = React.useState(''),
    [archivingId, setArchivingId] = React.useState(null),
    [page, setPage] = React.useState(1);
  const state = useRemoteData(
    () =>
      operacionalService.barberAppointments({
        data,
        status: status || undefined,
        arquivados: archived,
        page,
        limit: 20,
      }),
    [data, status, archived, page],
  );
  const rows = state.data?.data ?? [],
    pagination = state.data?.pagination;
  async function archive(id) {
    setArchivingId(id);
    setArchiveError('');
    try {
      await operacionalService.archiveAppointment(id);
      await state.reload();
    } catch (error) {
      setArchiveError(
        error.response?.data?.error?.message ?? 'Não foi possível arquivar o agendamento.',
      );
    } finally {
      setArchivingId(null);
    }
  }
  return (
    <>
      <PageHeader title="Minha agenda" description="Atendimentos organizados por horário." />
      <section className="card filter-panel">
        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(e) => {
            setData(e.target.value);
            setPage(1);
          }}
        />
        <label className="field">
          <span className="field__label">Status</span>
          <select
            className="field__control"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {['pendente', 'confirmado', 'em_atendimento', 'concluido', 'ausente', 'cancelado'].map(
              (item) => (
                <option key={item}>{item}</option>
              ),
            )}
          </select>
        </label>
        <label className="cluster">
          <input
            type="checkbox"
            checked={archived}
            onChange={(event) => {
              setArchived(event.target.checked);
              setPage(1);
            }}
          />
          Ver arquivados
        </label>
      </section>
      {archiveError && <Alert type="error">{archiveError}</Alert>}
      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Alert type="error">{state.error.message}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title="Agenda vazia">
          <p>Nenhum atendimento para os filtros selecionados.</p>
        </EmptyState>
      ) : (
        <div className="operational-grid">
          {rows.map((item) => (
            <article className="card" key={item.id}>
              <div className="cluster">
                <strong>
                  {item.horaInicio}–{item.horaFim}
                </strong>
                <Badge>{item.status}</Badge>
              </div>
              <h2>{item.cliente.nome}</h2>
              <p>{item.servico.nome}</p>
              <div className="cluster">
                <Link to={`/barbeiro/agendamentos/${item.id}`}>Ver detalhes</Link>
                {!archived && ['concluido', 'cancelado', 'ausente'].includes(item.status) && (
                  <Button
                    variant="secondary"
                    loading={archivingId === item.id}
                    onClick={() => archive(item.id)}
                  >
                    Arquivar
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination
        page={pagination?.page ?? 1}
        totalPages={pagination?.totalPages ?? 1}
        onChange={setPage}
      />
    </>
  );
}
