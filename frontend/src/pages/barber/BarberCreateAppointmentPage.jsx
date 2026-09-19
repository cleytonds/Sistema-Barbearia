import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/operational/index.jsx';
import { Alert, Button, Input, Skeleton, Textarea } from '../../components/ui/index.jsx';
import { useDisponibilidade } from '../../hooks/useDisponibilidade.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function BarberCreateAppointmentPage() {
  useDocumentTitle('Criar agendamento');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    clienteId: '',
    servicoId: '',
    data: today(),
    horaInicio: '',
    observacao: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const profile = useRemoteData(() => operacionalService.myProfile(), []);
  const services = useRemoteData(() => operacionalService.myServices(), []);
  const availability = useDisponibilidade({
    barbeiroId: profile.data?.data?.id,
    servicoId: form.servicoId,
    data: form.data,
  });
  async function findClients() {
    if (search.trim().length < 2) return;
    try {
      setClients((await operacionalService.clients({ search, page: 1, limit: 20 })).data);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? 'Não foi possível buscar clientes.');
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await operacionalService.createAppointment(
        {
          ...form,
          clienteId: Number(form.clienteId),
          servicoId: Number(form.servicoId),
          observacao: form.observacao.trim() || null,
        },
        crypto.randomUUID(),
      );
      navigate(`/barbeiro/agendamentos/${result.data.id}`, { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ?? 'Não foi possível criar o agendamento.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (profile.loading || services.loading) return <Skeleton />;
  if (profile.error || services.error)
    return <Alert type="error">Não foi possível carregar o formulário.</Alert>;
  return (
    <>
      <PageHeader title="Criar agendamento" />
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
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
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
            onChange={(e) => setForm({ ...form, servicoId: e.target.value, horaInicio: '' })}
          >
            <option value="">Selecione</option>
            {(services.data?.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
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
            {(availability.disponibilidade?.horarios ?? []).map((slot) => (
              <option key={slot.inicioLocal} value={slot.inicioLocal}>
                {slot.inicioLocal}
              </option>
            ))}
          </select>
        </label>
        <Textarea
          label="Observação"
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
        />
        {error && <Alert type="error">{error}</Alert>}
        <Button type="submit" loading={busy}>
          Criar agendamento
        </Button>
      </form>
    </>
  );
}
