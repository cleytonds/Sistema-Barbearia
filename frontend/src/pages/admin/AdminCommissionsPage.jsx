import { useMemo, useState } from 'react';
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
} from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { barbeiroService } from '../../services/barbeiroService.js';
import { adminService } from '../../services/adminService.js';
import { comissaoService } from '../../services/comissaoService.js';
import { apiError } from '../../utils/apiError.js';

const initialFilters = { barbeiroId: '', inicio: '', fim: '', tipo: '', status: '', page: 1 };
const decimalPattern = /^\d+(?:[.,]\d{1,2})?$/;
const decimal = (value) =>
  String(value ?? '')
    .trim()
    .replace(',', '.');
const money = (value) =>
  value == null || value === ''
    ? 'Não informado'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
const dateTime = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date)
    : 'Não informado';
};
const cents = (value) => {
  const [whole, fraction = ''] = String(value ?? '0').split('.');
  return BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
};
const moneyFromCents = (value) => money(`${value / 100n}.${String(value % 100n).padStart(2, '0')}`);

export default function AdminCommissionsPage() {
  useDocumentTitle('Comissões');
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [paying, setPaying] = useState(false);
  const [config, setConfig] = useState({
    barbeiroId: '',
    percentualAvulso: '',
    percentualPlano: '',
  });
  const [configError, setConfigError] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const query = {
    page: filters.page,
    limit: 20,
    ...(filters.barbeiroId && { barbeiroId: filters.barbeiroId }),
    ...(filters.inicio && { inicio: filters.inicio }),
    ...(filters.fim && { fim: filters.fim }),
    ...(filters.tipo && { tipo: filters.tipo }),
    ...(filters.status && { status: filters.status }),
  };
  const state = useRemoteData(
    () => comissaoService.list(query),
    [filters.page, filters.barbeiroId, filters.inicio, filters.fim, filters.tipo, filters.status],
  );
  const summary = useRemoteData(
    () =>
      comissaoService.listAll({
        ...(filters.barbeiroId && { barbeiroId: filters.barbeiroId }),
        ...(filters.inicio && { inicio: filters.inicio }),
        ...(filters.fim && { fim: filters.fim }),
      }),
    [filters.barbeiroId, filters.inicio, filters.fim],
  );
  const barbers = useRemoteData(() => barbeiroService.listAdmin({ page: 1, limit: 100 }), []);
  const rows = state.data?.data ?? [];
  const totals = useMemo(() => {
    const result = { pendente: 0n, paga: 0n, avulso: 0, plano: 0 };
    for (const item of summary.data ?? []) {
      if (item.status === 'pendente') result.pendente += cents(item.valorComissao);
      if (item.status === 'paga') result.paga += cents(item.valorComissao);
      if (item.tipoCobranca === 'avulso') result.avulso += 1;
      if (item.tipoCobranca === 'plano') result.plano += 1;
    }
    return result;
  }, [summary.data]);

  const changeFilter = (field, value) =>
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));

  async function selectBarber(barbeiroId) {
    setConfigError('');
    setFeedback('');
    setConfig({ barbeiroId, percentualAvulso: '', percentualPlano: '' });
    if (!barbeiroId) return;
    setLoadingConfig(true);
    try {
      const response = await adminService.barber(barbeiroId);
      const barber = response?.data;
      setConfig({
        barbeiroId,
        percentualAvulso: barber?.percentualComissaoAvulsa ?? '',
        percentualPlano: barber?.percentualComissaoPlano ?? '',
      });
    } catch (error) {
      setConfigError(apiError(error).message);
    } finally {
      setLoadingConfig(false);
    }
  }

  async function saveConfiguration(event) {
    event.preventDefault();
    setConfigError('');
    setFeedback('');
    const avulso = decimal(config.percentualAvulso);
    const plano = decimal(config.percentualPlano);
    if (!config.barbeiroId) return setConfigError('Selecione um profissional.');
    if (
      !decimalPattern.test(config.percentualAvulso) ||
      !decimalPattern.test(config.percentualPlano) ||
      Number(avulso) > 100 ||
      Number(plano) > 100
    )
      return setConfigError('Os percentuais devem estar entre 0 e 100.');
    setSavingConfig(true);
    try {
      await comissaoService.configureBarber(config.barbeiroId, {
        percentualAvulso: avulso,
        percentualPlano: plano,
      });
      setFeedback('Percentuais de comissão salvos.');
    } catch (error) {
      setConfigError(apiError(error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function confirmPayment() {
    if (!selected || paying) return;
    setPaying(true);
    setActionError('');
    try {
      await comissaoService.markPaid(selected.id);
      setSelected(null);
      setFeedback('Comissão marcada como paga.');
      await Promise.all([state.reload(), summary.reload()]);
    } catch (error) {
      setActionError(apiError(error).message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Comissões"
        description="Controle financeiro dos atendimentos concluídos."
      />
      {feedback && <Alert>{feedback}</Alert>}
      <section className="dashboard-grid" aria-label="Resumo de comissões">
        <DashboardCard label="Pendentes" value={moneyFromCents(totals.pendente)} />
        <DashboardCard label="Pagas" value={moneyFromCents(totals.paga)} />
        <DashboardCard label="Atendimentos" value={(summary.data ?? []).length} />
        <DashboardCard label="Avulso / Plano" value={`${totals.avulso} / ${totals.plano}`} />
      </section>

      <section className="card commissions-section">
        <h2>Configuração por profissional</h2>
        <p>Percentuais ainda não configurados permanecem vazios.</p>
        <form className="commission-config-grid" onSubmit={saveConfiguration}>
          <label className="field">
            <span className="field__label">Profissional</span>
            <select
              className="field__control"
              value={config.barbeiroId}
              onChange={(event) => selectBarber(event.target.value)}
            >
              <option value="">Selecione</option>
              {(barbers.data?.data ?? []).map((barber) => (
                <option value={barber.id} key={barber.id}>
                  {barber.nome}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Comissão avulsa (%)"
            inputMode="decimal"
            value={config.percentualAvulso}
            onChange={(event) => setConfig({ ...config, percentualAvulso: event.target.value })}
          />
          <Input
            label="Comissão de plano (%)"
            inputMode="decimal"
            value={config.percentualPlano}
            onChange={(event) => setConfig({ ...config, percentualPlano: event.target.value })}
          />
          <Button type="submit" loading={savingConfig || loadingConfig}>
            Salvar percentuais
          </Button>
        </form>
        {configError && <Alert type="error">{configError}</Alert>}
      </section>

      <section className="card commissions-section">
        <h2>Filtros</h2>
        <div className="commission-filters">
          <label className="field">
            <span className="field__label">Profissional</span>
            <select
              className="field__control"
              value={filters.barbeiroId}
              onChange={(event) => changeFilter('barbeiroId', event.target.value)}
            >
              <option value="">Todos</option>
              {(barbers.data?.data ?? []).map((barber) => (
                <option value={barber.id} key={barber.id}>
                  {barber.nome}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Período inicial"
            type="date"
            value={filters.inicio}
            onChange={(event) => changeFilter('inicio', event.target.value)}
          />
          <Input
            label="Período final"
            type="date"
            value={filters.fim}
            onChange={(event) => changeFilter('fim', event.target.value)}
          />
          <label className="field">
            <span className="field__label">Tipo</span>
            <select
              className="field__control"
              value={filters.tipo}
              onChange={(event) => changeFilter('tipo', event.target.value)}
            >
              <option value="">Todos</option>
              <option value="avulso">Avulso</option>
              <option value="plano">Plano</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select
              className="field__control"
              value={filters.status}
              onChange={(event) => changeFilter('status', event.target.value)}
            >
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="paga">Paga</option>
            </select>
          </label>
        </div>
      </section>

      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Alert type="error">{state.error.message}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma comissão encontrada">
          <p>Ajuste os filtros ou aguarde a conclusão de atendimentos.</p>
        </EmptyState>
      ) : (
        <DataTable
          caption="Comissões"
          rows={rows}
          columns={[
            { key: 'criadoEm', label: 'Data', render: (item) => dateTime(item.criadoEm) },
            {
              key: 'barbeiro',
              label: 'Barbeiro',
              render: (item) => item.barbeiro?.nome ?? 'Não informado',
            },
            {
              key: 'servico',
              label: 'Serviço',
              render: (item) => item.servico?.nome ?? 'Não informado',
            },
            {
              key: 'tipoCobranca',
              label: 'Tipo',
              render: (item) => (item.tipoCobranca === 'plano' ? 'Plano' : 'Avulso'),
            },
            {
              key: 'valorBaseSnapshot',
              label: 'Valor-base',
              render: (item) => money(item.valorBaseSnapshot),
            },
            {
              key: 'percentualSnapshot',
              label: 'Percentual',
              render: (item) => `${item.percentualSnapshot ?? '0'}%`,
            },
            {
              key: 'valorComissao',
              label: 'Comissão',
              render: (item) => money(item.valorComissao),
            },
            {
              key: 'status',
              label: 'Status',
              render: (item) => (
                <Badge tone={item.status === 'paga' ? 'success' : 'warning'}>
                  {item.status === 'paga' ? 'Paga' : 'Pendente'}
                </Badge>
              ),
            },
          ]}
          renderActions={(item) =>
            item.status === 'pendente' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(item);
                  setActionError('');
                }}
              >
                Marcar como paga
              </Button>
            ) : null
          }
        />
      )}
      <Pagination
        page={state.data?.pagination?.page ?? 1}
        totalPages={state.data?.pagination?.totalPages ?? 1}
        onChange={(page) => setFilters((current) => ({ ...current, page }))}
      />
      <Dialog
        open={Boolean(selected)}
        onClose={() => !paying && setSelected(null)}
        title="Confirmar pagamento"
      >
        <div className="stack">
          <p>Confirmar pagamento desta comissão?</p>
          {actionError && <Alert type="error">{actionError}</Alert>}
          <div className="cluster">
            <Button loading={paying} onClick={confirmPayment}>
              Confirmar
            </Button>
            <Button variant="secondary" disabled={paying} onClick={() => setSelected(null)}>
              Voltar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
