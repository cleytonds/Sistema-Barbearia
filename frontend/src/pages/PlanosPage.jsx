import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Skeleton,
} from '../components/ui/index.jsx';
import { useAssinarPlano } from '../hooks/useAssinarPlano.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useRemoteData } from '../hooks/useRemoteData.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { planoService } from '../services/planoService.js';
import { formatDate, formatMoney } from '../utils/dateTime.js';
import { apiError } from '../utils/apiError.js';

function PlanLimit({ label, value }) {
  return (
    <span className="muted">
      {label}: <strong>{value}</strong>
    </span>
  );
}

export default function PlanosPage() {
  useDocumentTitle('Planos');
  const navigate = useNavigate();
  const { notify } = useToast();
  const state = useRemoteData(() => planoService.listPublic({ sort: 'preco', order: 'asc' }), []);
  const [selected, setSelected] = useState(null);
  const assinar = useAssinarPlano();
  const rows = state.data ?? [];
  const plans = Array.isArray(rows) ? rows : (rows.data ?? []);

  async function confirmSign() {
    try {
      const result = await assinar.assinar(selected.id, {});
      notify(
        result?.data?.status === 'aguardando_pagamento'
          ? 'Assinatura solicitada com sucesso.'
          : 'Plano assinado.',
        'success',
      );
      setSelected(null);
      navigate('/meu-plano', { replace: true });
    } catch {
      // Tratamento de erro permanece no dialog; sem navegação.
    }
  }

  return (
    <Container as="section" className="page stack">
      <h1>Planos</h1>
      <p className="muted">
        Escolha um plano mensal e aproveite os benefícios exclusivos da Elite Barbearia 081.
      </p>
      {state.loading ? (
        <>
          <Skeleton />
          <Skeleton />
        </>
      ) : state.error ? (
        <Alert type="error">
          Não foi possível carregar os planos.{' '}
          <button onClick={state.reload}>Tentar novamente</button>
        </Alert>
      ) : plans.length === 0 ? (
        <EmptyState title="Nenhum plano disponível no momento">
          <p>Os planos serão liberados em breve.</p>
        </EmptyState>
      ) : (
        <div className="grid">
          {plans.map((plan) => (
            <Card key={plan.id} className="stack plan-card">
              <div className="cluster">
                <h2>{plan.nome}</h2>
                <Badge tone="success">Disponível</Badge>
              </div>
              <p className="plan-card__price">{formatMoney(plan.preco)}</p>
              <p className="muted">
                Vigência: {formatDate(plan.adesao_inicio)} – {formatDate(plan.adesao_fim)}
              </p>
              <div className="stack">
                <PlanLimit
                  label="Utilizações por semana"
                  value={plan.possui_limite_semanal ? plan.limite_semanal : 'Ilimitado'}
                />
                <PlanLimit
                  label="Utilizações no total"
                  value={plan.possui_limite_total ? plan.limite_total : 'Ilimitado'}
                />
              </div>
              <div>
                <h3>Serviços incluídos</h3>
                <p className="muted">
                  {(plan.servicos ?? []).map((s) => s.nome).join(', ') || '—'}
                </p>
              </div>
              <div>
                <h3>Profissionais</h3>
                <p className="muted">
                  {(plan.barbeiros ?? []).map((b) => b.nome).join(', ') || '—'}
                </p>
              </div>
              {plan.descricao && <p>{plan.descricao}</p>}
              <Button variant="primary" onClick={() => setSelected(plan)}>
                Assinar
              </Button>
              <Button variant="secondary" onClick={() => setSelected(plan)}>
                Ver detalhes
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? selected.nome : 'Plano'}
      >
        {selected && (
          <div className="stack">
            <p className="plan-card__price">{formatMoney(selected.preco)}</p>
            <p className="muted">
              Adesão: {formatDate(selected.adesao_inicio)} – {formatDate(selected.adesao_fim)}
            </p>
            <p className="muted">
              Utilização: {formatDate(selected.utilizacao_inicio)} –{' '}
              {formatDate(selected.utilizacao_fim)}
            </p>
            <p>
              <strong>Limites:</strong>{' '}
              {selected.possui_limite_semanal
                ? `${selected.limite_semanal} por semana`
                : 'Semanal ilimitado'}
              {' · '}
              {selected.possui_limite_total
                ? `${selected.limite_total} no total`
                : 'Total ilimitado'}
            </p>
            <div>
              <h3>Serviços incluídos</h3>
              <ul>
                {(selected.servicos ?? []).map((s) => (
                  <li key={s.id}>{s.nome}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Profissionais</h3>
              <ul>
                {(selected.barbeiros ?? []).map((b) => (
                  <li key={b.id}>{b.nome}</li>
                ))}
              </ul>
            </div>
            {selected.descricao && <p>{selected.descricao}</p>}
            {assinar.error && <Alert type="error">{apiError(assinar.error).message}</Alert>}
            <Button loading={assinar.loading} onClick={confirmSign}>
              Confirmar assinatura
            </Button>
          </div>
        )}
      </Dialog>
    </Container>
  );
}
