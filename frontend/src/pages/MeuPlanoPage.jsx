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

export default function MeuPlanoPage() {
  useDocumentTitle('Meu plano');
  const { notify } = useToast();
  const plan = useRemoteData(() => planoService.myPlan(), []);
  const usos = useRemoteData(() => planoService.myUsages(), []);
  const [confirming, setConfirming] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelError, setCancelError] = useState('');
  const cancelar = useCancelarPlano();

  const data = plan.data?.data;
  const usageRows = usos.data ?? [];
  const usages = Array.isArray(usageRows) ? usageRows : (usageRows.data ?? []);

  async function confirmCancel() {
    try {
      await cancelar.cancelar(motivo.trim());
      notify('Plano cancelado.', 'success');
      setConfirming(false);
      setMotivo('');
      plan.reload();
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
              <h2>{data.plano_nome_snapshot}</h2>
              <Badge tone={subscriptionStatus(data.status).tone}>
                {subscriptionStatus(data.status).label}
              </Badge>
            </div>
            <p className="muted">
              Vigência: {formatDate(data.inicio_em)} – {formatDate(data.fim_em)}
            </p>
            <p className="muted">Valor: {formatMoney(data.valor_contratado)}</p>
            <div className="cluster">
              <PlanUsage label="Utilizada" value={usageCountLabel(usages)} />
              <PlanUsage
                label="Saldo restante"
                value={remainingUsage(data) ? String(remainingUsage(data)) : 'Ilimitado'}
              />
            </div>
            {data.motivo_status && (
              <Alert type="warning">
                {data.status === 'suspensa' ? 'Plano suspenso. ' : ''}
                {data.motivo_status}
              </Alert>
            )}
            {data.status !== 'cancelada' && data.status !== 'vencida' && (
              <div className="cluster">
                <Button variant="danger" onClick={() => setConfirming(true)}>
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
                      <span>{formatDate(uso.data_utilizacao)}</span>
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
          onClose={() => setConfirming(false)}
          onConfirm={confirmCancel}
        />
      )}
      {cancelError && <Alert type="error">{cancelError}</Alert>}
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

function CancelPlanDialog({ open, motivo, setMotivo, loading, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} title="Cancelar plano">
      <div className="stack">
        <p className="muted">O cancelamento é permanente e exige um motivo.</p>
        <div className="form">
          <Input
            label="Motivo do cancelamento"
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="cluster">
            <Button
              variant="danger"
              loading={loading}
              disabled={!motivo.trim()}
              onClick={onConfirm}
            >
              Confirmar cancelamento
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
