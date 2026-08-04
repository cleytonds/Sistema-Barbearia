/**
 * Verifica sobreposição usando intervalos semiabertos [início, fim).
 *
 * A borda final é exclusiva: 09:00–09:40 e 09:40–10:20 apenas se encostam e,
 * portanto, não conflitam. Essa convenção permite atendimentos consecutivos.
 */
export function overlaps(first, second) {
  return first.start < second.end && first.end > second.start;
}

export function overlapsAny(period, periods) {
  return periods.some((candidate) => overlaps(period, candidate));
}
