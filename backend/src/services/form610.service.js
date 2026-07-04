// ============================================================
// Form. 610 — Cálculo IVA bimensual para independientes
// El Form. 610 agrupa 2 meses (bimestre).
// ============================================================

/**
 * Calcula IVA + IT bimensual para independiente/consultor.
 *
 * @param {object} p
 * @param {number} p.totalVentas     Ingresos facturados en el bimestre (Bs)
 * @param {number} p.totalCompras    Crédito fiscal de facturas de compra (Bs)
 * @param {number} p.tasaIva         Tasa IVA (default 0.13)
 * @param {number} p.tasaIt          Tasa IT (default 0.03)
 * @param {number} [p.saldoIvaAnterior] Saldo IVA a favor del bimestre anterior
 * @returns {object}
 */
export function calcularForm610({
  totalVentas,
  totalCompras,
  tasaIva = 0.13,
  tasaIt  = 0.03,
  saldoIvaAnterior = 0,
}) {
  // Débito fiscal IVA (ventas)
  const debitoFiscal = round(totalVentas * tasaIva);

  // Crédito fiscal IVA (compras)
  const creditoFiscal = round(totalCompras * tasaIva);

  // IVA neto a pagar
  const ivaBruto  = debitoFiscal - creditoFiscal - saldoIvaAnterior;
  const ivaPagar  = round(Math.max(0, ivaBruto));
  const saldoIvaAfavor = round(Math.max(0, -ivaBruto));

  // IT — Impuesto a las Transacciones (sobre ingresos brutos)
  const itPagar = round(totalVentas * tasaIt);

  // Total a pagar
  const totalPagar = round(ivaPagar + itPagar);

  return {
    totalVentas:       round(totalVentas),
    totalCompras:      round(totalCompras),
    debitoFiscal,
    creditoFiscal,
    saldoIvaAnterior:  round(saldoIvaAnterior),
    ivaPagar,
    saldoIvaAfavor,
    itPagar,
    totalPagar,
    objetivoCumplido: ivaPagar === 0 && saldoIvaAfavor > 0,
  };
}

/**
 * Calcula el régimen especial Siete-RG (tasa única 5%).
 *
 * @param {object} p
 * @param {number} p.ingresos        Ingresos brutos del bimestre (Bs)
 * @param {number} p.tasaRegimenEspecial  Tasa (default 0.05)
 */
export function calcularRegimenEspecial({
  ingresos,
  tasaRegimenEspecial = 0.05,
}) {
  const impuesto = round(ingresos * tasaRegimenEspecial);
  return {
    ingresos:  round(ingresos),
    impuesto,
    totalPagar: impuesto,
  };
}

const round = (n) => Math.round(n * 100) / 100;
