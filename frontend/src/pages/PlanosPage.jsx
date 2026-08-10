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
    <div className="plan-card__info-item">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LinkedItems({ items, emptyMessage }) {
  if (!Array.isArray(items) || items.length === 0) return <p className="muted">{emptyMessage}</p>;

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.nome}</li>
      ))}
    </ul>
  );
}

function normalizeCivilDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;

  const trimmed = value.trim();
  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
  const isoDate = /^\d{4}-\d{2}-\d{2}T/.test(trimmed) ? new Date(trimmed) : null;
  const normalizedDate =
    dateOnly ??
    (isoDate && !Number.isNaN(isoDate.getTime()) ? isoDate.toISOString().slice(0, 10) : null);
  if (!normalizedDate) return null;

  const parsed = new Date(`${normalizedDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalizedDate) {
    return null;
  }

  return normalizedDate;
}

function safeDate(value) {
  const normalizedDate = normalizeCivilDate(value);
  if (!normalizedDate) return 'Data não informada';

  try {
    return formatDate(normalizedDate);
  } catch {
    return 'Data não informada';
  }
}

export default function PlanosPage() {
  useDocumentTitle('Planos');
  const navigate = useNavigate();
  const { notify } = useToast();
  const state = useRemoteData(() => planoService.listPublic({ sort: 'preco', order: 'asc' }), []);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const assinar = useAssinarPlano();
  const rows = state.data ?? [];
  const plans = Array.isArray(rows) ? rows : (rows.data ?? []);

  async function openPlan(plan) {
    setSelected(plan);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await planoService.getPublic(plan.id);
      if (!result.data) throw new Error('Detalhes do plano indisponíveis.');
      setSelected(result.data);
    } catch (error) {
      setDetailError(error);
    } finally {
      setDetailLoading(false);
    }
  }

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
            <Card key={plan.id} className="plan-card">
              <div className="cluster plan-card__header">
                <h2>{plan.nome}</h2>
                <Badge tone="success">Disponível</Badge>
              </div>
              <p className="plan-card__price">{formatMoney(plan.preco)}</p>
              <div className="plan-card__divider" />
              <div className="plan-card__info">
                <div className="plan-card__info-item plan-card__info-item--wide">
                  <span className="muted">Vigência</span>
                  <strong>
                    {safeDate(plan.adesaoInicio)} – {safeDate(plan.adesaoFim)}
                  </strong>
                </div>
                <PlanLimit
                  label="Utilizações por semana"
                  value={plan.possuiLimiteSemanal ? plan.limiteSemanal : 'Ilimitado'}
                />
                <PlanLimit
                  label="Utilizações no total"
                  value={plan.possuiLimiteTotal ? plan.limiteTotal : 'Ilimitado'}
                />
              </div>
              <div className="plan-card__divider" />
              <div className="plan-card__actions">
                <Button variant="primary" onClick={() => openPlan(plan)}>
                  Assinar
                </Button>
                <Button variant="secondary" onClick={() => openPlan(plan)}>
                  Ver detalhes do plano
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setDetailError(null);
        }}
        title={selected ? selected.nome : 'Plano'}
      >
        {detailLoading ? (
          <Skeleton />
        ) : detailError ? (
          <Alert type="error">
            Não foi possível carregar os detalhes do plano.{' '}
            <button onClick={() => openPlan(selected)}>Tentar novamente</button>
          </Alert>
        ) : selected ? (
          <div className="plan-detail">
            <p className="plan-card__price">{formatMoney(selected.preco)}</p>
            <section className="plan-detail__section">
              <h3>Período do plano</h3>
              <p className="plan-detail__period">
                {safeDate(selected.utilizacaoInicio)} – {safeDate(selected.utilizacaoFim)}
              </p>
            </section>
            <section className="plan-detail__section">
              <h3>Utilizações por semana</h3>
              <div className="plan-detail__values">
                <strong>
                  {selected.possuiLimiteSemanal ? selected.limiteSemanal : 'Ilimitado'}
                </strong>
              </div>
            </section>
            <section className="plan-detail__section">
              <h3>Serviços incluídos</h3>
              <LinkedItems items={selected.servicos} emptyMessage="Nenhum serviço informado." />
            </section>
            <section className="plan-detail__section">
              <h3>Profissionais</h3>
              <LinkedItems
                items={selected.barbeiros}
                emptyMessage="Nenhum profissional informado."
              />
            </section>
            {assinar.error && <Alert type="error">{apiError(assinar.error).message}</Alert>}
            <div className="plan-detail__actions">
              <Button loading={assinar.loading} onClick={confirmSign}>
                Confirmar assinatura
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </Container>
  );
}
