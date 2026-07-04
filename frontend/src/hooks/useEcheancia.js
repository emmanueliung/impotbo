/**
 * useEcheancia — Calcule les jours restants avant l'échéance RC-IVA bolivienne
 *
 * En Bolivie, le vencimiento RC-IVA dépend du dernier chiffre du NIT :
 *   0-1 → día 13  |  2-3 → día 14  |  4-5 → día 15
 *   6-7 → día 16  |  8-9 → día 17
 * du mois SUIVANT à la période déclarée.
 * Si l'utilisateur n'a pas de NIT, on utilise le día 15 par défaut.
 */
export function calcularVencimiento(nit, anio, mes) {
  const ultimo = nit ? parseInt(String(nit).slice(-1), 10) : 5;
  const dia =
    ultimo <= 1 ? 13 :
    ultimo <= 3 ? 14 :
    ultimo <= 5 ? 15 :
    ultimo <= 7 ? 16 : 17;

  // Mois suivant
  const mesSig  = mes === 12 ? 1  : mes + 1;
  const anioSig = mes === 12 ? anio + 1 : anio;

  return new Date(anioSig, mesSig - 1, dia); // month 0-indexed
}

/**
 * @param {string|null} nit
 * @returns {{
 *   diasRestantes: number,
 *   vencimiento: Date,
 *   nivel: 'ok' | 'alerta' | 'urgente' | 'vencido',
 *   texto: string,
 * }}
 */
export function useEcheancia(nit) {
  const hoy  = new Date();
  const anio = hoy.getFullYear();
  const mes  = hoy.getMonth() + 1;

  const vencimiento    = calcularVencimiento(nit, anio, mes);
  const msRestantes    = vencimiento.getTime() - hoy.getTime();
  const diasRestantes  = Math.ceil(msRestantes / (1000 * 60 * 60 * 24));

  let nivel, texto;

  if (diasRestantes < 0) {
    nivel = 'vencido';
    texto = `Plazo vencido hace ${Math.abs(diasRestantes)} día(s)`;
  } else if (diasRestantes === 0) {
    nivel = 'urgente';
    texto = 'Vence HOY';
  } else if (diasRestantes <= 3) {
    nivel = 'urgente';
    texto = `Vence en ${diasRestantes} día(s)`;
  } else if (diasRestantes <= 7) {
    nivel = 'alerta';
    texto = `Vence en ${diasRestantes} días`;
  } else {
    nivel = 'ok';
    texto = `Vence el ${vencimiento.toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}`;
  }

  return { diasRestantes, vencimiento, nivel, texto };
}
