import { PageHeader, DataTable } from '../../components/operational/index.jsx';
import { Alert, Skeleton } from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';
const days = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
export default function BarberSchedulePage() {
  useDocumentTitle('Minha jornada');
  const own = useRemoteData(() => operacionalService.myHours(), []),
    global = useRemoteData(() => operacionalService.publicHours(), []);
  const rows = (own.data?.data ?? []).map((row) => ({
    ...row,
    id: row.dia_semana,
    dia: days[row.dia_semana],
    horario: row.ativo ? `${row.hora_inicio}–${row.hora_fim}` : 'Fechado',
    intervalo: row.intervalo_inicio
      ? `${row.intervalo_inicio}–${row.intervalo_fim}`
      : 'Sem intervalo',
    global: (global.data?.data ?? [])[row.dia_semana]?.ativo ? 'Aberto' : 'Fechado',
  }));
  return (
    <>
      <PageHeader
        title="Minha jornada"
        description="Alterações de jornada são feitas pela administração."
      />
      {own.loading || global.loading ? (
        <Skeleton />
      ) : own.error || global.error ? (
        <Alert type="error">Não foi possível carregar a jornada.</Alert>
      ) : (
        <DataTable
          caption="Jornada semanal"
          rows={rows}
          columns={[
            { key: 'dia', label: 'Dia' },
            { key: 'horario', label: 'Jornada' },
            { key: 'intervalo', label: 'Intervalo' },
            { key: 'global', label: 'Barbearia' },
          ]}
        />
      )}
    </>
  );
}
