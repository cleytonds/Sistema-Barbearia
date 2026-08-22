import { useState } from 'react';
import { PageHeader } from '../../components/operational/index.jsx';
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Pagination,
  Skeleton,
} from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';
import { createInitialBlockPeriod } from '../../utils/blockDateTime.js';

const initialForm = () => ({ ...createInitialBlockPeriod(), motivo: '' });

export default function BarberBlocksPage() {
  useDocumentTitle('Meus bloqueios');
  const [page, setPage] = useState(1),
    [form, setForm] = useState(initialForm),
    [message, setMessage] = useState('');
  const state = useRemoteData(
    () => operacionalService.myBlocksFiltered({ page, limit: 20 }),
    [page],
  );
  async function submit(e) {
    e.preventDefault();
    setMessage('');
    try {
      await operacionalService.createMyBlock(form);
      setForm(initialForm());
      setMessage('Bloqueio criado.');
      await state.reload();
    } catch (error) {
      setMessage(error.response?.data?.error?.message ?? 'Não foi possível criar o bloqueio.');
    }
  }
  async function remove(id) {
    if (!window.confirm('Remover este bloqueio?')) return;
    await operacionalService.removeMyBlock(id);
    state.reload();
  }
  return (
    <>
      <PageHeader
        title="Meus bloqueios"
        description="Bloqueios não cancelam agendamentos existentes."
      />
      <form className="card form" onSubmit={submit}>
        <h2>Novo bloqueio</h2>
        <Input
          label="Início"
          type="datetime-local"
          required
          value={form.inicioLocal}
          onChange={(e) => setForm({ ...form, inicioLocal: e.target.value })}
        />
        <Input
          label="Fim"
          type="datetime-local"
          required
          value={form.fimLocal}
          onChange={(e) => setForm({ ...form, fimLocal: e.target.value })}
        />
        <Input
          label="Motivo"
          required
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
        />
        <Button type="submit">Criar bloqueio</Button>
        {message && <Alert>{message}</Alert>}
      </form>
      {state.loading ? (
        <Skeleton />
      ) : (state.data?.data ?? []).length === 0 ? (
        <EmptyState title="Nenhum bloqueio" />
      ) : (
        <div className="operational-grid">
          {state.data.data.map((item) => (
            <article className="card" key={item.id}>
              <p>
                {new Date(item.inicio_em).toLocaleString()} –{' '}
                {new Date(item.fim_em).toLocaleString()}
              </p>
              <p>{item.motivo}</p>
              <Button variant="secondary" onClick={() => remove(item.id)}>
                Remover
              </Button>
            </article>
          ))}
        </div>
      )}
      <Pagination
        page={state.data?.pagination?.page ?? 1}
        totalPages={state.data?.pagination?.totalPages ?? 1}
        onChange={setPage}
      />
    </>
  );
}
