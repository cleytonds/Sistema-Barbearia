import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Skeleton, Textarea } from '../ui/index.jsx';
import { useDisponibilidade } from '../../hooks/useDisponibilidade.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { adminService } from '../../services/adminService.js';
import { barbeiroService } from '../../services/barbeiroService.js';
import { operacionalService } from '../../services/operacionalService.js';
import { servicoService } from '../../services/servicoService.js';

const today = () => new Date().toISOString().slice(0, 10);
const errorMessage = (error) =>
  error.response?.data?.error?.message ?? error.message ?? 'Não foi possível criar o agendamento.';

export function GuestAppointmentForm({ role }) {
  const isAdmin = role === 'admin';
  const navigate = useNavigate();
  const [form, setForm] = useState({
    clienteNome: '',
    clienteTelefone: '',
    servicoId: '',
    barbeiroId: '',
    data: today(),
    horaInicio: '',
    observacao: '',
  });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const services = useRemoteData(
    () => (isAdmin ? servicoService.listPublic({ limit: 100 }) : operacionalService.myServices()),
    [isAdmin],
  );
  const barbers = useRemoteData(
    () =>
      isAdmin
        ? barbeiroService.listPublic({ servicoId: form.servicoId || undefined, limit: 100 })
        : Promise.resolve({ data: [] }),
    [form.servicoId],
  );
  const profile = useRemoteData(
    () => (isAdmin ? Promise.resolve({ data: null }) : operacionalService.myProfile()),
    [isAdmin],
  );
  const barbeiroId = isAdmin ? form.barbeiroId : profile.data?.data?.id;
  const availability = useDisponibilidade({
    barbeiroId,
    servicoId: form.servicoId,
    data: form.data,
  });
  const serviceRows = services.data?.data ?? [];

  function update(values) {
    setForm((current) => ({ ...current, ...values }));
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSubmitError('');
    const data = {
      clienteNome: form.clienteNome.trim(),
      clienteTelefone: form.clienteTelefone.trim() || null,
      servicoId: Number(form.servicoId),
      data: form.data,
      horaInicio: form.horaInicio,
      observacao: form.observacao.trim() || null,
      ...(isAdmin ? { barbeiroId: Number(form.barbeiroId) } : {}),
    };
    try {
      const result = isAdmin
        ? await adminService.createGuestAppointment(data, crypto.randomUUID())
        : await operacionalService.createGuestAppointment(data, crypto.randomUUID());
      navigate(`/${isAdmin ? 'admin' : 'barbeiro'}/agendamentos/${result.data.id}`, {
        replace: true,
      });
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (services.loading || (!isAdmin && profile.loading)) return <Skeleton />;
  if (services.error || (!isAdmin && profile.error))
    return <Alert type="error">Não foi possível carregar o formulário.</Alert>;

  return (
    <form className="card form" onSubmit={submit}>
      <Input
        label="Nome"
        required
        value={form.clienteNome}
        onChange={(e) => update({ clienteNome: e.target.value })}
      />
      <Input
        label="Telefone/WhatsApp"
        value={form.clienteTelefone}
        onChange={(e) => update({ clienteTelefone: e.target.value })}
      />
      <label className="field">
        <span>Serviço</span>
        <select
          className="field__control"
          required
          value={form.servicoId}
          onChange={(e) => update({ servicoId: e.target.value, barbeiroId: '', horaInicio: '' })}
        >
          <option value="">Selecione</option>
          {serviceRows.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>
      {isAdmin && (
        <label className="field">
          <span>Profissional</span>
          <select
            className="field__control"
            required
            value={form.barbeiroId}
            onChange={(e) => update({ barbeiroId: e.target.value, horaInicio: '' })}
          >
            <option value="">Selecione</option>
            {(barbers.data?.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <Input
        label="Data"
        type="date"
        required
        value={form.data}
        onChange={(e) => update({ data: e.target.value, horaInicio: '' })}
      />
      <label className="field">
        <span>Horário</span>
        <select
          className="field__control"
          required
          value={form.horaInicio}
          onChange={(e) => update({ horaInicio: e.target.value })}
        >
          <option value="">Selecione</option>
          {(availability.disponibilidade?.horarios ?? []).map((slot) => (
            <option key={slot.inicioLocal} value={slot.inicioLocal}>
              {slot.inicioLocal}
            </option>
          ))}
        </select>
      </label>
      {availability.error && <Alert type="error">{availability.error.message}</Alert>}
      <Textarea
        label="Observação"
        value={form.observacao}
        onChange={(e) => update({ observacao: e.target.value })}
      />
      {submitError && <Alert type="error">{submitError}</Alert>}
      <Button type="submit" loading={busy}>
        Criar agendamento
      </Button>
    </form>
  );
}
