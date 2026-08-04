import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DashboardCard, DataTable, PageHeader } from '../../components/operational/index.jsx';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Input,
  Pagination,
  Skeleton,
  Textarea,
} from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { adminService } from '../../services/adminService.js';
import { servicoService } from '../../services/servicoService.js';
import { barbeiroService } from '../../services/barbeiroService.js';
import { operacionalService } from '../../services/operacionalService.js';
import { getDisponibilidade } from '../../services/disponibilidadeService.js';
const today = () => new Date().toISOString().slice(0, 10);
const msg = (error) =>
  error.response?.data?.error?.message ?? 'Não foi possível concluir a operação.';
export function AdminDashboardPage() {
  useDocumentTitle('Painel administrativo');
  const state = useRemoteData(() => adminService.dashboard(today()), []),
    data = state.data?.data;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Operação diária da barbearia."
        actions={
          <Link className="button button--primary" to="/admin/agendamentos/novo">
            Novo agendamento
          </Link>
        }
      />
      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Alert type="error">{state.error.message}</Alert>
      ) : (
        <>
          <section className="dashboard-grid">
            {Object.entries(data.totais).map(([key, value]) => (
              <DashboardCard key={key} label={key} value={value} />
            ))}
          </section>
          <section>
            <h2>Por profissional</h2>
            <div className="operational-grid">
              {data.porBarbeiro.map((item) => (
                <article className="card" key={item.barbeiro.id}>
                  <h3>{item.barbeiro.nome}</h3>
                  <p>{item.total} atendimento(s)</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
export function AdminAppointmentsPage() {
  useDocumentTitle('Agendamentos administrativos');
  const [filters, setFilters] = useState({
    dataInicial: today(),
    dataFinal: today(),
    status: '',
    page: 1,
  });
  const state = useRemoteData(
    () => adminService.appointments({ ...filters, status: filters.status || undefined, limit: 20 }),
    [filters],
  );
  const rows = state.data?.data ?? [];
  return (
    <>
      <PageHeader
        title="Agendamentos"
        actions={
          <Link className="button button--primary" to="/admin/agendamentos/novo">
            Criar
          </Link>
        }
      />
      <section className="card filter-panel">
        <Input
          label="Data inicial"
          type="date"
          value={filters.dataInicial}
          onChange={(e) => setFilters({ ...filters, dataInicial: e.target.value, page: 1 })}
        />
        <Input
          label="Data final"
          type="date"
          value={filters.dataFinal}
          onChange={(e) => setFilters({ ...filters, dataFinal: e.target.value, page: 1 })}
        />
        <label className="field">
          <span>Status</span>
          <select
            className="field__control"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            {['pendente', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'ausente'].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
      </section>
      {state.loading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum agendamento" />
      ) : (
        <DataTable
          caption="Agendamentos"
          rows={rows}
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'cliente', label: 'Cliente', render: (r) => r.cliente.nome },
            { key: 'barbeiro', label: 'Profissional', render: (r) => r.barbeiro.nome },
            { key: 'servico', label: 'Serviço', render: (r) => r.servico.nome },
            { key: 'horaInicio', label: 'Início' },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
          renderActions={(r) => <Link to={`/admin/agendamentos/${r.id}`}>Detalhe</Link>}
        />
      )}
      <Pagination
        page={state.data?.pagination?.page ?? 1}
        totalPages={state.data?.pagination?.totalPages ?? 1}
        onChange={(page) => setFilters({ ...filters, page })}
      />
    </>
  );
}
export function AdminAppointmentDetailsPage() {
  useDocumentTitle('Detalhe administrativo');
  const { id } = useParams(),
    state = useRemoteData(() => adminService.appointment(id), [id]);
  const [dialog, setDialog] = useState(null),
    [value, setValue] = useState(''),
    [error, setError] = useState('');
  const item = state.data?.data;
  async function act() {
    try {
      if (dialog === 'cancel') await adminService.cancelAppointment(id, value);
      else if (dialog === 'reschedule') {
        const [data, horaInicio] = value.split('T');
        await adminService.rescheduleAppointment(id, { data, horaInicio });
      } else await adminService.appointmentStatus(id, dialog);
      setDialog(null);
      setValue('');
      state.reload();
    } catch (e) {
      setError(msg(e));
    }
  }
  return (
    <>
      <PageHeader title={`Agendamento #${id}`} />
      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Alert type="error">{state.error.message}</Alert>
      ) : (
        <article className="card stack">
          <Badge>{item.status}</Badge>
          <h2>{item.cliente.nome}</h2>
          <p>
            {item.barbeiro.nome} · {item.servico.nome}
          </p>
          <p>
            {item.data}, {item.horaInicio}–{item.horaFim}
          </p>
          {item.observacoesInternas && <p>Observação interna: {item.observacoesInternas}</p>}
          <div className="cluster">
            {['confirmado', 'em_atendimento', 'concluido', 'ausente'].map((s) => (
              <Button variant="secondary" key={s} onClick={() => setDialog(s)}>
                {s}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setDialog('reschedule')}>
              Reagendar
            </Button>
            <Button variant="danger" onClick={() => setDialog('cancel')}>
              Cancelar
            </Button>
          </div>
          <h3>Histórico</h3>
          <ol>
            {(item.historico ?? []).map((h) => (
              <li key={h.id}>
                {h.tipo_evento ?? h.tipo} — {h.criado_em}
              </li>
            ))}
          </ol>
        </article>
      )}
      <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} title="Confirmar operação">
        {dialog === 'cancel' && (
          <Input label="Motivo" value={value} onChange={(e) => setValue(e.target.value)} />
        )}{' '}
        {dialog === 'reschedule' && (
          <Input
            label="Nova data e hora"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}{' '}
        {error && <Alert type="error">{error}</Alert>}
        <Button onClick={act}>Confirmar</Button>
      </Dialog>
    </>
  );
}

export function AdminCreateAppointmentPage() {
  useDocumentTitle('Novo agendamento');
  const navigate = useNavigate();
  const [search, setSearch] = useState(''),
    [clients, setClients] = useState([]),
    [form, setForm] = useState({
      clienteId: '',
      servicoId: '',
      barbeiroId: '',
      data: today(),
      horaInicio: '',
      observacoesInternas: '',
    }),
    [slots, setSlots] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const services = useRemoteData(() => servicoService.listPublic({ limit: 100 }), []),
    barbers = useRemoteData(
      () => barbeiroService.listPublic({ servicoId: form.servicoId || undefined, limit: 100 }),
      [form.servicoId],
    );
  async function findClients() {
    if (search.trim().length < 2) return;
    try {
      setClients((await adminService.clients({ search, page: 1, limit: 20 })).data);
    } catch (e) {
      setError(msg(e));
    }
  }
  useEffect(() => {
    if (!form.barbeiroId || !form.servicoId || !form.data) return undefined;
    const controller = new AbortController();
    getDisponibilidade({
      barbeiroId: form.barbeiroId,
      servicoId: form.servicoId,
      data: form.data,
      signal: controller.signal,
    })
      .then((response) => setSlots(response.data?.horarios ?? []))
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.message ?? msg(requestError));
      });
    return () => controller.abort();
  }, [form.barbeiroId, form.servicoId, form.data]);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await adminService.createAppointment(
        {
          ...form,
          clienteId: Number(form.clienteId),
          barbeiroId: Number(form.barbeiroId),
          servicoId: Number(form.servicoId),
        },
        crypto.randomUUID(),
      );
      navigate(`/admin/agendamentos/${result.data.id}`, { replace: true });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Novo agendamento" />
      <form className="card form" onSubmit={submit}>
        <div className="cluster">
          <Input
            label="Buscar cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={findClients}>
            Buscar
          </Button>
        </div>
        <label className="field">
          <span>Cliente</span>
          <select
            className="field__control"
            required
            value={form.clienteId}
            onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
          >
            <option value="">Selecione</option>
            {clients.map((x) => (
              <option value={x.id} key={x.id}>
                {x.nome} — {x.email}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Serviço</span>
          <select
            className="field__control"
            required
            value={form.servicoId}
            onChange={(e) =>
              setForm({ ...form, servicoId: e.target.value, barbeiroId: '', horaInicio: '' })
            }
          >
            <option value="">Selecione</option>
            {(services.data?.data ?? []).map((x) => (
              <option value={x.id} key={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Profissional</span>
          <select
            className="field__control"
            required
            value={form.barbeiroId}
            onChange={(e) => setForm({ ...form, barbeiroId: e.target.value, horaInicio: '' })}
          >
            <option value="">Selecione</option>
            {(barbers.data?.data ?? []).map((x) => (
              <option value={x.id} key={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Data"
          type="date"
          required
          value={form.data}
          onChange={(e) => setForm({ ...form, data: e.target.value, horaInicio: '' })}
        />
        <label className="field">
          <span>Horário</span>
          <select
            className="field__control"
            required
            value={form.horaInicio}
            onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
          >
            <option value="">Selecione</option>
            {slots.map((slot) => (
              <option key={slot.inicioLocal} value={slot.inicioLocal}>
                {slot.inicioLocal}
              </option>
            ))}
          </select>
        </label>
        <Textarea
          label="Observação interna"
          value={form.observacoesInternas}
          onChange={(e) => setForm({ ...form, observacoesInternas: e.target.value })}
        />
        {error && <Alert type="error">{error}</Alert>}
        <Button type="submit" loading={busy}>
          Criar agendamento
        </Button>
      </form>
    </>
  );
}

export function AdminClientHistoryPage() {
  useDocumentTitle('Histórico do cliente');
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const state = useRemoteData(
    () => adminService.clientHistory(id, { page, limit: 20, sort: 'inicio', order: 'desc' }),
    [id, page],
  );
  const data = state.data?.data;
  return (
    <>
      <PageHeader title="Histórico do cliente" />
      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Alert type="error">{state.error.message}</Alert>
      ) : (
        <>
          <section className="card">
            <h2>{data.cliente.nome}</h2>
            <p>
              {data.cliente.email} · {data.cliente.telefone}
            </p>
            <div className="dashboard-grid">
              {Object.entries(data.resumo).map(([k, v]) => (
                <DashboardCard key={k} label={k} value={v} />
              ))}
            </div>
            <p>Serviços: {data.servicos.map((x) => x.nome).join(', ') || 'Nenhum'}</p>
            <p>Profissionais: {data.profissionais.map((x) => x.nome).join(', ') || 'Nenhum'}</p>
          </section>
          <div className="operational-grid">
            {data.agendamentos.data.map((x) => (
              <article className="card" key={x.id}>
                <Badge>{x.status}</Badge>
                <h3>{x.servico.nome}</h3>
                <p>
                  {x.data} · {x.barbeiro.nome}
                </p>
              </article>
            ))}
          </div>
          <Pagination
            page={data.agendamentos.pagination.page}
            totalPages={data.agendamentos.pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}

export function AdminServicesPage() {
  useDocumentTitle('Serviços');
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState({ nome: '', descricao: '', preco: '', duracao_minutos: 30 }),
    [error, setError] = useState('');
  const state = useRemoteData(
    () => servicoService.listAdmin({ search, page, limit: 20, ativo: 'all' }),
    [search, page],
  );
  function edit(item) {
    setEditing(item);
    setForm({
      nome: item.nome,
      descricao: item.descricao ?? '',
      preco: item.preco,
      duracao_minutos: item.duracao_minutos,
    });
  }
  async function save(e) {
    e.preventDefault();
    try {
      if (editing) await servicoService.update(editing.id, form);
      else await servicoService.create(form);
      setEditing(null);
      setForm({ nome: '', descricao: '', preco: '', duracao_minutos: 30 });
      state.reload();
    } catch (e) {
      setError(msg(e));
    }
  }
  async function toggle(item) {
    if (!window.confirm(`${item.ativo ? 'Desativar' : 'Ativar'} este serviço?`)) return;
    await servicoService.setStatus(item.id, !item.ativo);
    state.reload();
  }
  return (
    <>
      <PageHeader
        title="Serviços"
        actions={<Button onClick={() => setEditing({})}>Novo serviço</Button>}
      />
      <Input
        label="Pesquisar"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {state.loading ? (
        <Skeleton />
      ) : (
        <DataTable
          caption="Serviços"
          rows={state.data?.data ?? []}
          columns={[
            { key: 'nome', label: 'Nome' },
            { key: 'preco', label: 'Preço' },
            { key: 'duracao_minutos', label: 'Duração' },
            { key: 'ativo', label: 'Estado', render: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
          ]}
          renderActions={(r) => (
            <div className="cluster">
              <Button variant="secondary" onClick={() => edit(r)}>
                Editar
              </Button>
              <Button variant="secondary" onClick={() => toggle(r)}>
                {r.ativo ? 'Desativar' : 'Ativar'}
              </Button>
            </div>
          )}
        />
      )}
      <Pagination
        page={state.data?.pagination?.page ?? 1}
        totalPages={state.data?.pagination?.totalPages ?? 1}
        onChange={setPage}
      />
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar serviço' : 'Novo serviço'}
      >
        <form className="form" onSubmit={save}>
          <Input
            label="Nome"
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          <Textarea
            label="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
          <Input
            label="Preço"
            required
            inputMode="decimal"
            value={form.preco}
            onChange={(e) => setForm({ ...form, preco: e.target.value })}
          />
          <Input
            label="Duração em minutos"
            type="number"
            min="1"
            required
            value={form.duracao_minutos}
            onChange={(e) => setForm({ ...form, duracao_minutos: Number(e.target.value) })}
          />
          {error && <Alert type="error">{error}</Alert>}
          <Button type="submit">Salvar</Button>
        </form>
      </Dialog>
    </>
  );
}

export function AdminBarbersPage() {
  useDocumentTitle('Profissionais');
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const state = useRemoteData(
    () => barbeiroService.listAdmin({ search, page, limit: 20, ativo: 'all' }),
    [search, page],
  );
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: '',
    confirmacaoSenha: '',
    descricao: '',
    especialidades: '',
    foto_url: '',
  });
  const [message, setMessage] = useState('');
  async function create(event) {
    event.preventDefault();
    try {
      await barbeiroService.create({ ...form, foto_url: form.foto_url || null });
      setCreating(false);
      setMessage('Profissional criado.');
      state.reload();
    } catch (error) {
      setMessage(msg(error));
    }
  }
  return (
    <>
      <PageHeader
        title="Profissionais"
        actions={<Button onClick={() => setCreating(true)}>Novo profissional</Button>}
      />
      <Input
        label="Pesquisar profissional"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {state.loading ? (
        <Skeleton />
      ) : (
        <DataTable
          caption="Profissionais"
          rows={state.data?.data ?? []}
          columns={[
            { key: 'nome', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'telefone', label: 'Telefone' },
            { key: 'ativo', label: 'Estado', render: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
          ]}
          renderActions={(r) => <Link to={`/admin/barbeiros/${r.id}`}>Gerenciar</Link>}
        />
      )}
      <Pagination
        page={state.data?.pagination?.page ?? 1}
        totalPages={state.data?.pagination?.totalPages ?? 1}
        onChange={setPage}
      />
      {message && <Alert>{message}</Alert>}
      <Dialog open={creating} onClose={() => setCreating(false)} title="Novo profissional">
        <form className="form" onSubmit={create}>
          <Input
            label="Nome"
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          <Input
            label="E-mail"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Telefone"
            required
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          <Input
            label="Senha temporária"
            type="password"
            required
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
          />
          <Input
            label="Confirmar senha"
            type="password"
            required
            value={form.confirmacaoSenha}
            onChange={(e) => setForm({ ...form, confirmacaoSenha: e.target.value })}
          />
          <Textarea
            label="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
          <Input
            label="Especialidades"
            value={form.especialidades}
            onChange={(e) => setForm({ ...form, especialidades: e.target.value })}
          />
          <Input
            label="URL da foto"
            type="url"
            value={form.foto_url}
            onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
          />
          <Button type="submit">Criar profissional</Button>
        </form>
      </Dialog>
    </>
  );
}
export function AdminBarberDetailsPage() {
  useDocumentTitle('Gerenciar profissional');
  const { id } = useParams();
  const profile = useRemoteData(() => adminService.barber(id), [id]),
    linked = useRemoteData(() => adminService.barberServices(id), [id]),
    all = useRemoteData(() => servicoService.listPublic({ limit: 100 }), []);
  const [selected, setSelected] = useState([]),
    [message, setMessage] = useState(''),
    [form, setForm] = useState(null);
  useEffect(() => setSelected((linked.data?.data ?? []).map((x) => String(x.id))), [linked.data]);
  useEffect(() => {
    if (profile.data?.data) {
      const value = profile.data.data;
      setForm({
        nome: value.nome,
        email: value.email,
        telefone: value.telefone,
        descricao: value.descricao ?? '',
        especialidades: value.especialidades ?? '',
        foto_url: value.foto_url ?? '',
      });
    }
  }, [profile.data]);
  async function sync() {
    try {
      await barbeiroService.syncServices(id, selected.map(Number));
      setMessage('Vínculos atualizados.');
      linked.reload();
    } catch (e) {
      setMessage(msg(e));
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    try {
      await barbeiroService.update(id, { ...form, foto_url: form.foto_url || null });
      setMessage('Dados profissionais atualizados.');
      profile.reload();
    } catch (error) {
      setMessage(msg(error));
    }
  }
  const item = profile.data?.data;
  return (
    <>
      <PageHeader title="Profissional" />
      {profile.loading ? (
        <Skeleton />
      ) : profile.error ? (
        <Alert type="error">{profile.error.message}</Alert>
      ) : (
        <>
          <section className="card">
            <h2>{item.nome}</h2>
            <p>
              {item.email} · {item.telefone}
            </p>
            <p>{item.descricao || 'Sem descrição'}</p>
            <Button
              variant="secondary"
              onClick={async () => {
                await adminService.setBarberStatus(id, !item.ativo);
                profile.reload();
              }}
            >
              {item.ativo ? 'Desativar' : 'Ativar'}
            </Button>
          </section>
          {form && (
            <form className="card form" onSubmit={saveProfile}>
              <h2>Dados cadastrais</h2>
              <Input
                label="Nome"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
              <Input
                label="E-mail"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Telefone"
                required
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
              <Textarea
                label="Descrição"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
              <Input
                label="Especialidades"
                value={form.especialidades}
                onChange={(e) => setForm({ ...form, especialidades: e.target.value })}
              />
              <Input
                label="URL da foto"
                type="url"
                value={form.foto_url}
                onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
              />
              <Button type="submit">Salvar profissional</Button>
            </form>
          )}
          <section className="card">
            <h2>Serviços</h2>
            {(all.data?.data ?? []).map((s) => (
              <label key={s.id} className="cluster">
                <input
                  type="checkbox"
                  checked={selected.includes(String(s.id))}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, String(s.id)]
                        : selected.filter((x) => x !== String(s.id)),
                    )
                  }
                />
                {s.nome}
              </label>
            ))}
            <Button onClick={sync}>Salvar vínculos</Button>
            {message && <Alert>{message}</Alert>}
          </section>
          <Link to={`/admin/jornadas?barbeiroId=${id}`}>Editar jornada</Link>
        </>
      )}
    </>
  );
}

function WeekEditor({ days, onChange }) {
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return (
    <div className="weekly-editor">
      {days.map((day, index) => (
        <fieldset className="card" key={day.diaSemana}>
          <legend>{names[day.diaSemana]}</legend>
          <label>
            <input
              type="checkbox"
              checked={Boolean(day.ativo)}
              onChange={(e) => onChange(index, { ...day, ativo: e.target.checked })}
            />{' '}
            Ativo
          </label>
          <Input
            label="Início"
            type="time"
            value={day.horaInicio}
            onChange={(e) => onChange(index, { ...day, horaInicio: e.target.value })}
          />
          <Input
            label="Fim"
            type="time"
            value={day.horaFim}
            onChange={(e) => onChange(index, { ...day, horaFim: e.target.value })}
          />
          <Input
            label="Intervalo inicial"
            type="time"
            value={day.intervaloInicio ?? ''}
            onChange={(e) => onChange(index, { ...day, intervaloInicio: e.target.value || null })}
          />
          <Input
            label="Intervalo final"
            type="time"
            value={day.intervaloFim ?? ''}
            onChange={(e) => onChange(index, { ...day, intervaloFim: e.target.value || null })}
          />
        </fieldset>
      ))}
    </div>
  );
}
const normalizeDays = (rows) =>
  (rows ?? []).map((d) => ({
    diaSemana: d.diaSemana ?? d.dia_semana,
    horaInicio: String(d.horaInicio ?? d.hora_inicio).slice(0, 5),
    horaFim: String(d.horaFim ?? d.hora_fim).slice(0, 5),
    intervaloInicio:
      (d.intervaloInicio ?? d.intervalo_inicio)
        ? String(d.intervaloInicio ?? d.intervalo_inicio).slice(0, 5)
        : null,
    intervaloFim:
      (d.intervaloFim ?? d.intervalo_fim)
        ? String(d.intervaloFim ?? d.intervalo_fim).slice(0, 5)
        : null,
    ativo: Boolean(d.ativo),
  }));
export function AdminBusinessHoursPage() {
  useDocumentTitle('Funcionamento');
  const state = useRemoteData(() => adminService.businessHours(), []),
    [days, setDays] = useState([]),
    [message, setMessage] = useState('');
  useEffect(() => setDays(normalizeDays(state.data?.data)), [state.data]);
  async function save() {
    if (!window.confirm('Alterar o funcionamento pode afetar a disponibilidade futura. Continuar?'))
      return;
    try {
      await operacionalService.updateBusinessHours(days);
      setMessage('Funcionamento atualizado.');
      state.reload();
    } catch (e) {
      setMessage(msg(e));
    }
  }
  return (
    <>
      <PageHeader title="Funcionamento" description="Semana operacional completa." />
      {state.loading ? (
        <Skeleton />
      ) : (
        <WeekEditor
          days={days}
          onChange={(i, d) => setDays(days.map((x, n) => (n === i ? d : x)))}
        />
      )}
      <Button onClick={save}>Salvar semana</Button>
      {message && <Alert>{message}</Alert>}
    </>
  );
}
export function AdminSchedulesPage() {
  useDocumentTitle('Jornadas');
  const barbers = useRemoteData(() => barbeiroService.listAdmin({ limit: 100, ativo: 'all' }), []);
  const [id, setId] = useState(''),
    [days, setDays] = useState([]),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (id) adminService.barberHours(id).then((r) => setDays(normalizeDays(r.data)));
  }, [id]);
  async function save() {
    try {
      await adminService.updateBarberHours(id, days);
      setMessage('Jornada atualizada.');
    } catch (e) {
      setMessage(msg(e));
    }
  }
  return (
    <>
      <PageHeader title="Jornadas" />
      <label className="field">
        <span>Profissional</span>
        <select className="field__control" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Selecione</option>
          {(barbers.data?.data ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </label>
      {id && (
        <>
          <WeekEditor
            days={days}
            onChange={(i, d) => setDays(days.map((x, n) => (n === i ? d : x)))}
          />
          <Button onClick={save}>Salvar jornada</Button>
        </>
      )}
      {message && <Alert>{message}</Alert>}
    </>
  );
}

export function AdminBlocksPage() {
  useDocumentTitle('Bloqueios');
  const [page, setPage] = useState(1),
    [form, setForm] = useState({ barbeiroId: '', inicioLocal: '', fimLocal: '', motivo: '' }),
    [message, setMessage] = useState('');
  const state = useRemoteData(() => adminService.blocks({ page, limit: 20 }), [page]),
    barbers = useRemoteData(() => barbeiroService.listAdmin({ limit: 100, ativo: 'true' }), []);
  async function create(e) {
    e.preventDefault();
    try {
      await adminService.createBlock({
        ...form,
        barbeiroId: form.barbeiroId ? Number(form.barbeiroId) : null,
      });
      setMessage('Bloqueio criado.');
      state.reload();
    } catch (e) {
      setMessage(msg(e));
    }
  }
  async function remove(id) {
    if (!window.confirm('Remover este bloqueio?')) return;
    await adminService.removeBlock(id);
    state.reload();
  }
  return (
    <>
      <PageHeader
        title="Bloqueios"
        description="Um bloqueio não cancela agendamentos existentes."
      />
      <form className="card form" onSubmit={create}>
        <label className="field">
          <span>Profissional</span>
          <select
            className="field__control"
            value={form.barbeiroId}
            onChange={(e) => setForm({ ...form, barbeiroId: e.target.value })}
          >
            <option value="">Global</option>
            {(barbers.data?.data ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
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
      ) : (
        <div className="operational-grid">
          {(state.data?.data ?? []).map((x) => (
            <article className="card" key={x.id}>
              <strong>{x.barbeiro_id ? 'Profissional' : 'Global'}</strong>
              <p>
                {new Date(x.inicio_em).toLocaleString()}–{new Date(x.fim_em).toLocaleString()}
              </p>
              <p>{x.motivo}</p>
              <Button variant="secondary" onClick={() => remove(x.id)}>
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
export function AdminSettingsPage() {
  useDocumentTitle('Configurações');
  const state = useRemoteData(() => operacionalService.adminConfig(), []),
    [form, setForm] = useState(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (state.data?.data) setForm(state.data.data);
  }, [state.data]);
  async function save(e) {
    e.preventDefault();
    if (!window.confirm('Confirmar alterações nas regras operacionais?')) return;
    try {
      await operacionalService.updateConfig({
        nome_barbearia: form.nome_barbearia,
        telefone: form.telefone || null,
        endereco: form.endereco || null,
        fuso_horario: form.fuso_horario,
        tempo_minimo_cancelamento_horas: Number(form.tempo_minimo_cancelamento_horas),
        antecedencia_maxima_dias: Number(form.antecedencia_maxima_dias),
        intervalo_entre_atendimentos_minutos: Number(form.intervalo_entre_atendimentos_minutos),
      });
      setMessage('Configurações atualizadas.');
      state.reload();
    } catch (e) {
      setMessage(msg(e));
    }
  }
  return (
    <>
      <PageHeader
        title="Configurações"
        description="O intervalo técnico afeta a disponibilidade futura."
      />
      {state.loading || !form ? (
        <Skeleton />
      ) : (
        <form className="card form" onSubmit={save}>
          <Input
            label="Nome"
            value={form.nome_barbearia}
            onChange={(e) => setForm({ ...form, nome_barbearia: e.target.value })}
          />
          <Input
            label="Telefone"
            value={form.telefone ?? ''}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          <Input
            label="Endereço"
            value={form.endereco ?? ''}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
          />
          <Input
            label="Fuso horário"
            value={form.fuso_horario}
            onChange={(e) => setForm({ ...form, fuso_horario: e.target.value })}
          />
          <Input
            label="Cancelamento mínimo (horas)"
            type="number"
            min="0"
            value={form.tempo_minimo_cancelamento_horas}
            onChange={(e) => setForm({ ...form, tempo_minimo_cancelamento_horas: e.target.value })}
          />
          <Input
            label="Antecedência máxima (dias)"
            type="number"
            min="1"
            value={form.antecedencia_maxima_dias}
            onChange={(e) => setForm({ ...form, antecedencia_maxima_dias: e.target.value })}
          />
          <Input
            label="Intervalo técnico (minutos)"
            type="number"
            min="0"
            value={form.intervalo_entre_atendimentos_minutos}
            onChange={(e) =>
              setForm({ ...form, intervalo_entre_atendimentos_minutos: e.target.value })
            }
          />
          {message && <Alert>{message}</Alert>}
          <Button type="submit">Salvar configurações</Button>
        </form>
      )}
    </>
  );
}
