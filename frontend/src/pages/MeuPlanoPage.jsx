import { useState } from 'react';
import { Container } from '../components/layout/index.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Skeleton,
} from '../components/ui/index.jsx';
import { useCancelarPlano } from '../hooks/useCancelarPlano.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useRemoteData } from '../hooks/useRemoteData.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { planoService } from '../services/planoService.js';
import { formatDate, formatMoney } from '../utils/dateTime.js';
import { apiError } from '../utils/apiError.js';
import { remainingUsage, subscriptionStatus, usageStatus } from '../utils/planStatus.js';

function safeDate(value) {
  const date = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Data não informada';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return 'Data não informada';
  }
  return formatDate(date);
}

export default function MeuPlanoPage() {
  useDocumentTitle('Meu plano');
  const { notify } = useToast();
  const plan = useRemoteData(() => planoService.myPlan(), []);
  const usos = useRemoteData(() => planoService.myUsages(), []);
  const [confirming, setConfirming] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelledPlan, setCancelledPlan] = useState(null);
  const cancelar = useCancelarPlano();

  const data = cancelledPlan ?? plan.data?.data;
  const usageRows = usos.data ?? [];
  const usages = Array.isArray(usageRows) ? usageRows : (usageRows.data ?? []);
  const remaining = data
    ? remainingUsage({
        possuiLimiteTotal: data.possuiLimiteTotalSnapshot,
        limiteTotal: data.limiteTotalSnapshot,
        usos: usages,
      })
    : null;

  async function confirmCancel() {
    try {
      const result = await cancelar.cancelar(motivo.trim());
      notify('Plano cancelado.', 'success');
      setCancelledPlan(result.data);
      setConfirming(false);
      setMotivo('');
      usos.reload();
    } catch (error) {
      setCancelError(apiError(error).message);
    }
  }

  return (
    <Container as="section" className="page stack">
      <h1>Meu plano</h1>
      {plan.loading ? (
        <Skeleton />
      ) : plan.error ? (
        <Alert type="error">
          Não foi possível carregar seu plano.{' '}
          <button onClick={plan.reload}>Tentar novamente</button>
        </Alert>
      ) : data ? (
        <>
          <Card className="stack">
            <div className="cluster">
              <h2>{data.planoNomeSnapshot || 'Plano mensal'}</h2>
              <Badge tone={subscriptionStatus(data.status).tone}>
                {subscriptionStatus(data.status).label}
              </Badge>
            </div>
            <p className="muted">
              Vigência: {safeDate(data.inicioEm)} – {safeDate(data.fimEm)}
            </p>
            <p className="muted">
              Valor:{' '}
              {data.valorContratado != null ? formatMoney(data.valorContratado) : 'Não informado'}
            </p>
            <div className="cluster">
              <PlanUsage label="Utilizada" value={usageCountLabel(usages)} />
              <PlanUsage
                label="Saldo restante"
                value={remaining !== null ? String(remaining) : 'Ilimitado'}
              />
            </div>
            {data.motivoStatus && (
              <Alert type="warning">
                {data.status === 'suspensa' ? 'Plano suspenso. ' : ''}
                {data.motivoStatus}
              </Alert>
            )}
            {data.status !== 'cancelada' && data.status !== 'vencida' && (
              <div className="cluster">
                <Button
                  variant="danger"
                  onClick={() => {
                    setCancelError('');
                    setConfirming(true);
                  }}
                >
                  Cancelar plano
                </Button>
              </div>
            )}
          </Card>

          <section className="stack">
            <h2>Histórico de utilizações</h2>
            {usos.loading ? (
              <Skeleton />
            ) : usos.error ? (
              <Alert type="error">
                Não foi possível carregar as utilizações.{' '}
                <button onClick={usos.reload}>Tentar novamente</button>
              </Alert>
            ) : usages.length === 0 ? (
              <EmptyState title="Nenhuma utilização registrada">
                <p>Suas utilizações do plano aparecerão aqui.</p>
              </EmptyState>
            ) : (
              <div className="stack">
                {usages.map((uso) => (
                  <Card key={uso.id} className="stack">
                    <div className="cluster">
                      <Badge tone={usageStatus(uso.status).tone}>
                        {usageStatus(uso.status).label}
                      </Badge>
                      <span>{safeDate(uso.data_utilizacao)}</span>
                    </div>
                    <p className="muted">Agendamento #${uso.agendamento_id}</p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <EmptyState title="Você não possui um plano ativo">
          <p>Conheça os planos disponíveis e assine o que melhor atende você.</p>
        </EmptyState>
      )}

      {confirming && (
        <CancelPlanDialog
          open={confirming}
          motivo={motivo}
          setMotivo={setMotivo}
          loading={cancelar.loading}
          error={cancelError}
          onClose={() => setConfirming(false)}
          onConfirm={confirmCancel}
        />
      )}
    </Container>
  );
}

function PlanUsage({ label, value }) {
  return (
    <span className="muted">
      {label}: <strong>{value}</strong>
    </span>
  );
}

function usageCountLabel(usages) {
  const counted = (usages ?? []).filter(
    (item) => item.status === 'reservado' || item.status === 'consumido',
  ).length;
  return String(counted);
}

function CancelPlanDialog({ open, motivo, setMotivo, loading, error, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} title="Cancelar plano">
      <div className="stack">
        <p className="muted">O cancelamento é permanente e exige um motivo.</p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
        >
          <Input
            label="Motivo do cancelamento"
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {error && <Alert type="error">{error}</Alert>}
          <div className="cluster">
            <Button variant="danger" loading={loading} disabled={!motivo.trim()} type="submit">
              Confirmar cancelamento
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Voltar
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
