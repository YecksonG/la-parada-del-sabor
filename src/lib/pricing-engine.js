/**
 * pricing-engine.js
 * Motor de costeo dinámico, escandallo y validación de márgenes para La Parada del Sabor.
 * Sede: San Diego, Valencia, Carabobo.
 */

export const PRECIOS_BASE_VALENCIA = {
  costoKiloCarne: 6.48,   // ~7.00 USD/kg
  costoKiloPollo: 4.17,   // ~4.50 USD/kg
  costoKiloQueso: 6.94,   // ~7.50 USD/kg
  costoMasa: 0.12,        // Harina + agua + sal por arepa
  costoEmpaque: 0.28,     // Caja kraft + papel antigrasa + precinto
  costoOperativo: 0.15,   // Gas + electricidad + aceite
  margenNetoObjetivo: 0.50 // Contrato mínimo: 50%
};

// Factores de merma de cocción y desmeche
export const MERMAS = {
  carne: 0.37, // Rinde ~630g cocidos por 1kg crudo
  pollo: 0.30  // Rinde ~700g cocidos por 1kg crudo
};

/**
 * Calcula el costo unitario de producción (COGS) de una arepa según gramajes y precios de insumos.
 */
export function calcularCostoArepa(params) {
  const {
    tipoProteina = 'carne',
    gramosProteina = 70,
    gramosQueso = 40,
    costoKiloCarne = PRECIOS_BASE_VALENCIA.costoKiloCarne,
    costoKiloPollo = PRECIOS_BASE_VALENCIA.costoKiloPollo,
    costoKiloQueso = PRECIOS_BASE_VALENCIA.costoKiloQueso,
    costoMasa = PRECIOS_BASE_VALENCIA.costoMasa,
    costoEmpaque = PRECIOS_BASE_VALENCIA.costoEmpaque,
    costoOperativo = PRECIOS_BASE_VALENCIA.costoOperativo
  } = params;

  let costoProteina = 0;
  if (tipoProteina === 'carne') {
    const rendimientoCocidoKg = 1000 * (1 - MERMAS.carne); // 630g
    costoProteina = (costoKiloCarne / rendimientoCocidoKg) * gramosProteina;
  } else if (tipoProteina === 'pollo') {
    const rendimientoCocidoKg = 1000 * (1 - MERMAS.pollo); // 700g
    costoProteina = (costoKiloPollo / rendimientoCocidoKg) * gramosProteina;
  }

  const costoQueso = (costoKiloQueso / 1000) * gramosQueso;
  const costoTotal = Number((costoProteina + costoQueso + costoMasa + costoEmpaque + costoOperativo).toFixed(2));

  return {
    tipoProteina,
    gramosProteina,
    costoProteina: Number(costoProteina.toFixed(2)),
    costoQueso: Number(costoQueso.toFixed(2)),
    costoTotal
  };
}

/**
 * Calcula el margen bruto y margen neto estimado.
 */
export function calcularMargenNeto(pvp, cogs, deduccionOperativaPct = 0.10) {
  const margenBrutoVal = pvp - cogs;
  const margenBrutoPct = margenBrutoVal / pvp;
  const margenNetoEstimado = margenBrutoPct - deduccionOperativaPct;

  return {
    pvp,
    cogs,
    margenBrutoVal: Number(margenBrutoVal.toFixed(2)),
    margenBrutoPct: Number(margenBrutoPct.toFixed(4)),
    margenNetoEstimado: Number(margenNetoEstimado.toFixed(4)),
    esRentable: margenNetoEstimado >= PRECIOS_BASE_VALENCIA.margenNetoObjetivo
  };
}

/**
 * Audita el margen aplicando un porcentaje de variación sobre los precios base de Valencia.
 * Permite simular inflación o fluctuaciones locales del mercado.
 */
export function auditarMargenConVariacion({ tipoProteina = 'carne', pvp = 5.00, variacionPorcentaje = 0 }) {
  const factorVariacion = 1 + (variacionPorcentaje / 100);

  const costoArepa = calcularCostoArepa({
    tipoProteina,
    gramosProteina: 70,
    costoKiloCarne: PRECIOS_BASE_VALENCIA.costoKiloCarne * factorVariacion,
    costoKiloPollo: PRECIOS_BASE_VALENCIA.costoKiloPollo * factorVariacion,
    costoKiloQueso: PRECIOS_BASE_VALENCIA.costoKiloQueso * factorVariacion,
    costoMasa: PRECIOS_BASE_VALENCIA.costoMasa * factorVariacion,
    costoEmpaque: PRECIOS_BASE_VALENCIA.costoEmpaque * factorVariacion,
    costoOperativo: PRECIOS_BASE_VALENCIA.costoOperativo * factorVariacion
  });

  const margen = calcularMargenNeto(pvp, costoArepa.costoTotal);

  return {
    tipoProteina,
    pvp,
    variacionPorcentaje,
    cogsAjustado: costoArepa.costoTotal,
    margenBrutoPct: margen.margenBrutoPct,
    margenNetoEstimado: margen.margenNetoEstimado,
    esRentable: margen.esRentable,
    alertaMargen: margen.margenNetoEstimado < PRECIOS_BASE_VALENCIA.margenNetoObjetivo
  };
}
