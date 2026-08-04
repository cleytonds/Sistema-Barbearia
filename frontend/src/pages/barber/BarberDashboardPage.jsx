import { Link } from 'react-router-dom';
import { DashboardCard, PageHeader } from '../../components/operational/index.jsx';
import { Alert, Skeleton } from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';
const today = () => new Date().toISOString().slice(0, 10);
export default function BarberDashboardPage() {
  useDocumentTitle('Visão geral do barbeiro');
  const state = useRemoteData(() => operacionalService.barberDashboard(today()), []);
  const data = state.data?.data;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Resumo operacional de hoje."
        actions={
          <Link className="button button--primary" to="/barbeiro/agenda">
            Abrir agenda
          </Link>
        }
      />
      {state.loading ? (
        <Skeleton />
      ) : state.error ? (
        <Alert type="error">{state.error.message}</Alert>
      ) : (
        <>
          <section className="dashboard-grid" aria-label="Indicadores de hoje">
            {[
              ['Agendamentos', data.total],
              ['Pendentes', data.pendentes],
              ['Confirmados', data.confirmados],
              ['Em atendimento', data.emAtendimento],
              ['Concluídos', data.concluidos],
              ['Ausentes', data.ausentes],
            ].map(([label, value]) => (
              <DashboardCard key={label} label={label} value={value ?? 0} />
            ))}
          </section>
          <section className="card">
            <h2>Próximo atendimento</h2>
            {data.proximoAtendimento ? (
              <p>
                <strong>{data.proximoAtendimento.horaInicio}</strong> —{' '}
                {data.proximoAtendimento.servico.nome}
              </p>
            ) : (
              <p>Nenhum próximo atendimento hoje.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
