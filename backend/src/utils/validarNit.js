// Validación básica de NIT boliviano.
// El NIT en Bolivia es numérico (longitud variable, típicamente 7-12 dígitos).
// NOTA: no existe un algoritmo de dígito verificador público y estable;
// aquí validamos formato. Reforzar si se confirma una regla oficial.

export function validarNit(nit) {
  if (!nit) return false;
  const limpio = String(nit).trim();
  return /^[0-9]{5,15}$/.test(limpio);
}
