import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Stepper,
  Textarea,
} from '../components/ui/index.jsx';
import { SchedulingProvider, useScheduling } from '../contexts/SchedulingContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useCriarAgendamento } from '../hooks/useCriarAgendamento.js';
import { useDisponibilidade } from '../hooks/useDisponibilidade.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { barbeiroService } from '../services/barbeiroService.js';
import { operacionalService } from '../services/operacionalService.js';
import { servicoService } from '../services/servicoService.js';
import { addCivilDays, civilDate, formatDate, formatMoney } from '../utils/dateTime.js';

const steps = ['Serviço', 'Profissional', 'Data', 'Horário', 'Resumo'];
function SelectCard({ name, checked, onChange, title, children }) {
  return (
    <Card as="label" className="select-card">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <h3>{title}</h3>
      {children}
    </Card>
  );
}
function ScheduleContent() {
  useDocumentTitle('Agendar');
  const scheduling = useScheduling();
  const { isAuthenticated, usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [services, setServices] = useState([]),
    [barbers, setBarbers] = useState([]),
    [configuration, setConfiguration] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null);
  const { criar, loading: creating, error: createError } = useCriarAgendamento();
  useEffect(() => {
    let active = true;
    Promise.all([servicoService.listPublic({ limit: 100 }), operacionalService.publicConfig()])
      .then(([serviceResult, configResult]) => {
        if (active) {
          setServices(serviceResult.data);
          setConfiguration(configResult.data);
        }
      })
      .catch(setError)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!scheduling.servicoId) {
      setBarbers([]);
      return;
    }
    const controller = new AbortController();
    barbeiroService
      .listPublic({ servicoId: scheduling.servicoId, limit: 100 })
      .then((result) => setBarbers(result.data))
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError);
      });
    return () => controller.abort();
  }, [scheduling.servicoId]);
  const dateLimits = useMemo(
    () =>
      configuration
        ? {
            min: civilDate(configuration.agora, configuration.fusoHorario),
            max: addCivilDays(
              civilDate(configuration.agora, configuration.fusoHorario),
              configuration.antecedenciaMaximaDias,
            ),
          }
        : null,
    [configuration],
  );
  const {
    disponibilidade,
    loading: availabilityLoading,
    error: availabilityError,
    reload,
  } = useDisponibilidade({
    barbeiroId: scheduling.barbeiroId,
    servicoId: scheduling.servicoId,
    data: scheduling.data,
  });
  useEffect(() => {
    if (
      scheduling.horaInicio &&
      disponibilidade &&
      !disponibilidade.horarios.some((slot) => slot.inicioLocal === scheduling.horaInicio)
    )
      scheduling.limparHorario();
  }, [disponibilidade, scheduling]);
  const service = services.find((item) => String(item.id) === scheduling.servicoId);
  const barber = barbers.find((item) => String(item.id) === scheduling.barbeiroId);
  const slot = disponibilidade?.horarios?.find(
    (item) => item.inicioLocal === scheduling.horaInicio,
  );
  useEffect(() => {
    if (!loading && scheduling.servicoId && !service) scheduling.abandonar();
  }, [loading, scheduling.servicoId, service, scheduling]);
  useEffect(() => {
    if (scheduling.barbeiroId && barbers.length && !barber) {
      scheduling.selecionarServico(scheduling.servicoId);
    }
  }, [barbers, barber, scheduling]);
  async function confirm() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
    if (usuario?.perfil !== 'cliente')
      return setError({ message: 'Somente clientes podem criar agendamentos.' });
    try {
      const result = await criar({
        barbeiroId: scheduling.barbeiroId,
        servicoId: scheduling.servicoId,
        data: scheduling.data,
        horaInicio: scheduling.horaInicio,
        observacoes: scheduling.observacoes || undefined,
      });
      scheduling.concluir();
      notify(
        result.replayed ? 'Agendamento recuperado com segurança.' : 'Agendamento criado.',
        'success',
      );
      navigate(`/agendamento/sucesso/${result.data.id}`, { replace: true });
    } catch (requestError) {
      if (requestError.code === 'AVAILABILITY_CHANGED') {
        scheduling.limparHorario();
        scheduling.irPara(3);
        reload();
      }
    }
  }
  if (loading)
    return (
      <Container className="page">
        <Skeleton />
        <Skeleton />
      </Container>
    );
  return (
    <Container as="section" className="page stack schedule-page">
      <div>
        <p className="eyebrow">Agendamento</p>
        <h1>Escolha seu horário</h1>
      </div>
      <Stepper steps={steps} current={scheduling.etapa} />
      {error && (
        <Alert type="error">{error.message ?? 'Não foi possível carregar os dados.'}</Alert>
      )}
      {scheduling.etapa === 0 && (
        <div className="stack">
          <h2>Escolha o serviço</h2>
          {services.length ? (
            <div className="grid">
              {services.map((item) => (
                <SelectCard
                  name="servico"
                  key={item.id}
                  checked={String(item.id) === scheduling.servicoId}
                  onChange={() => scheduling.selecionarServico(item.id)}
                  title={item.nome}
                >
                  <p>{item.descricao}</p>
                  <p>
                    {formatMoney(item.preco)} · {item.duracao_minutos} min
                  </p>
                </SelectCard>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum serviço disponível" />
          )}
          <Button disabled={!scheduling.servicoId} onClick={scheduling.avancar}>
            Continuar
          </Button>
        </div>
      )}
      {scheduling.etapa === 1 && (
        <div className="stack">
          <h2>Escolha o profissional</h2>
          {barbers.length ? (
            <div className="grid">
              {barbers.map((item) => (
                <SelectCard
                  name="barbeiro"
                  key={item.id}
                  checked={String(item.id) === scheduling.barbeiroId}
                  onChange={() => scheduling.selecionarBarbeiro(item.id)}
                  title={item.nome}
                >
                  <p>{item.especialidades}</p>
                  <p className="muted">{item.descricao}</p>
                </SelectCard>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum profissional disponível para este serviço">
              <p>Escolha outro serviço ou tente novamente mais tarde.</p>
              <Button variant="secondary" onClick={scheduling.voltar}>
                Escolher outro serviço
              </Button>
            </EmptyState>
          )}
          <div className="cluster">
            <Button variant="secondary" onClick={scheduling.voltar}>
              Voltar
            </Button>
            <Button disabled={!scheduling.barbeiroId} onClick={scheduling.avancar}>
              Continuar
            </Button>
          </div>
        </div>
      )}
      {scheduling.etapa === 2 && (
        <div className="form">
          <h2>Escolha a data</h2>
          {dateLimits ? (
            <Input
              label="Data"
              type="date"
              min={dateLimits.min}
              max={dateLimits.max}
              value={scheduling.data ?? ''}
              onChange={(event) => scheduling.selecionarData(event.target.value)}
            />
          ) : (
            <Alert type="error">
              Limites de data indisponíveis. A confirmação continuará protegida pelo servidor.
            </Alert>
          )}
          <div className="cluster">
            <Button variant="secondary" onClick={scheduling.voltar}>
              Voltar
            </Button>
            <Button disabled={!scheduling.data} onClick={scheduling.avancar}>
              Continuar
            </Button>
          </div>
        </div>
      )}
      {scheduling.etapa === 3 && (
        <div className="stack">
          <h2>Escolha o horário</h2>
          {availabilityLoading ? (
            <Skeleton />
          ) : availabilityError ? (
            <Alert type="error">
              Não foi possível consultar horários.{' '}
              <button onClick={reload}>Tentar novamente</button>
            </Alert>
          ) : disponibilidade?.horarios?.length ? (
            <div className="time-grid">
              {disponibilidade.horarios.map((item) => (
                <SelectCard
                  name="horario"
                  key={item.inicioLocal}
                  checked={item.inicioLocal === scheduling.horaInicio}
                  onChange={() => scheduling.selecionarHorario(item.inicioLocal)}
                  title={item.inicioLocal}
                >
                  <span>até {item.fimLocal}</span>
                </SelectCard>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum horário disponível">
              <p>Tente outra data.</p>
            </EmptyState>
          )}
          <Alert>O horário será confirmado somente ao concluir o agendamento.</Alert>
          <div className="cluster">
            <Button variant="secondary" onClick={scheduling.voltar}>
              Voltar
            </Button>
            <Button disabled={!scheduling.horaInicio} onClick={scheduling.avancar}>
              Continuar
            </Button>
          </div>
        </div>
      )}
      {scheduling.etapa === 4 && (
        <div className="stack">
          <h2>Revise seu agendamento</h2>
          <Card>
            <p>
              <strong>Serviço:</strong> {service?.nome}
            </p>
            <p>
              <strong>Profissional:</strong> {barber?.nome ?? disponibilidade?.barbeiro?.nome}
            </p>
            <p>
              <strong>Data:</strong> {scheduling.data && formatDate(scheduling.data)}
            </p>
            <p>
              <strong>Horário:</strong> {scheduling.horaInicio}
              {slot?.fimLocal && `–${slot.fimLocal}`}
            </p>
            <p>
              <strong>Preço informativo:</strong> {service && formatMoney(service.preco)}
            </p>
          </Card>
          <Textarea
            label="Observações (opcional)"
            maxLength="1000"
            value={scheduling.observacoes}
            onChange={(event) => scheduling.atualizarObservacoes(event.target.value)}
          />
          {createError && (
            <Alert type="error">
              {createError.code === 'AVAILABILITY_CHANGED'
                ? 'Este horário deixou de estar disponível. Escolha outro.'
                : createError.message}
            </Alert>
          )}
          <div className="cluster">
            <Button variant="secondary" onClick={scheduling.voltar}>
              Voltar
            </Button>
            <Button loading={creating} onClick={confirm}>
              Confirmar agendamento
            </Button>
            <Button variant="secondary" onClick={scheduling.abandonar}>
              Abandonar
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
export default function SchedulePage() {
  return (
    <SchedulingProvider>
      <ScheduleContent />
    </SchedulingProvider>
  );
}
