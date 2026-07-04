// ============================================================
// Cálculo RC-IVA dependiente (asalariado)
// Las tasas/SMN llegan como parámetros (desde la BD), NO en duro.
// ============================================================

/**
 * @param {object} p
 * @param {number} p.salarioBruto    Salario bruto del mes (Bs)
 * @param {number} p.montoFacturas   Suma de facturas presentadas (Bs)
 * @param {number} p.smn             Salario Mínimo Nacional (Bs)
 * @param {number} p.tasa            Tasa RC-IVA (0.13)
 * @param {number} p.tasaAfp         Cotización AFP (0.1271)
 * @param {number} [p.saldoReportado] Saldo a favor del mes anterior (Bs)
 */
export function calcularRciva({
  salarioBruto,
  montoFacturas,
  smn,
  tasa,
  tasaAfp,
  saldoReportado = 0,
}) {
  const dosSmn = smn * 2;
  const salarioNeto = salarioBruto * (1 - tasaAfp);
  const baseImponible = Math.max(0, salarioNeto - dosSmn);

  const impuesto = baseImponible * tasa;
  const creditoFijo = dosSmn * tasa;
  const creditoFacturas = montoFacturas * tasa;

  const totalCreditos = creditoFijo + creditoFacturas + saldoReportado;
  const saldo = impuesto - totalCreditos;

  // Facturas aún necesarias para anular el impuesto
  const faltanteCredito = Math.max(0, impuesto - creditoFijo - saldoReportado);
  const facturasNecesarias = faltanteCredito / tasa;
  const facturasFaltantes = Math.max(0, facturasNecesarias - montoFacturas);

  return {
    salarioNeto: round(salarioNeto),
    baseImponible: round(baseImponible),
    impuesto: round(impuesto),
    creditoFijo: round(creditoFijo),
    creditoFacturas: round(creditoFacturas),
    totalCreditos: round(totalCreditos),
    aPagar: round(Math.max(0, saldo)),
    saldoAfavor: round(Math.max(0, -saldo)),
    facturasFaltantes: round(facturasFaltantes),
    objetivoCumplido: saldo <= 0,
  };
}

const round = (n) => Math.round(n * 100) / 100;
