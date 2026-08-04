import { DateTime } from 'luxon';

const asId = (value) => (value == null ? null : String(value));
const money = (value) => Number(value).toFixed(2);

export function serializeAppointment(row, timeZone = 'UTC') {
  const start = DateTime.fromJSDate(new Date(row.inicio_em), { zone: 'utc' }).setZone(timeZone);
  const end = DateTime.fromJSDate(new Date(row.fim_em), { zone: 'utc' }).setZone(timeZone);
  return {
    id: asId(row.id),
    barbeiro: { id: asId(row.barbeiro_id), nome: row.barbeiro_nome },
    servico: { id: asId(row.servico_id), nome: row.servico_nome },
    data: start.toFormat('yyyy-MM-dd'),
    horaInicio: start.toFormat('HH:mm'),
    horaFim: end.toFormat('HH:mm'),
    preco: money(row.preco),
    status: row.status,
    observacoes: row.observacoes_cliente ?? undefined,
  };
}
