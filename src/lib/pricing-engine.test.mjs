import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularCostoArepa,
  calcularMargenNeto,
  auditarMargenConVariacion,
  PRECIOS_BASE_VALENCIA
} from './pricing-engine.js';

test('RED: Debe calcular el costo unitario base con escandallo estricto de 70g', () => {
  const paramsPelua = {
    tipoProteina: 'carne',
    gramosProteina: 70,
    gramosQueso: 40,
    costoKiloCarne: PRECIOS_BASE_VALENCIA.costoKiloCarne, // 6.48 €
    costoKiloQueso: PRECIOS_BASE_VALENCIA.costoKiloQueso, // 6.94 €
    costoMasa: 0.12,
    costoEmpaque: 0.28,
    costoOperativo: 0.15
  };

  const resultado = calcularCostoArepa(paramsPelua);
  // Carne cocida rinde 630g por kg -> 70g = 6.48 / 9 = 0.72 €
  // Queso 40g = (6.94 / 1000) * 40 = 0.2776 ~ 0.28 €
  // Base: 0.72 + 0.28 + 0.12 + 0.28 + 0.15 = 1.55 €
  assert.ok(resultado.costoTotal >= 1.50 && resultado.costoTotal <= 1.65, `Costo fuera de rango: ${resultado.costoTotal}`);
  assert.equal(resultado.gramosProteina, 70);
});

test('RED: Debe auditar margen neto seguro (>50%) ante variaciones de mercado (+15% en Valencia)', () => {
  const pvpVenta = 5.00; // 5 €
  const auditoria = auditarMargenConVariacion({
    tipoProteina: 'carne',
    pvp: pvpVenta,
    variacionPorcentaje: 15 // Simulación de inflación o variación local en Valencia +15%
  });

  // Con 15% de incremento de costos, el margen neto debe mantenerse seguro por encima del 50%
  assert.ok(auditoria.margenNetoEstimado > 0.50, `El margen cayó por debajo del 50%: ${auditoria.margenNetoEstimado * 100}%`);
  assert.equal(auditoria.esRentable, true);
});

test('RED: Si la variación en Valencia sube al límite crítico (+35%), debe alertar umbral', () => {
  const auditoriaCritica = auditarMargenConVariacion({
    tipoProteina: 'carne',
    pvp: 5.00,
    variacionPorcentaje: 40 // +40% costo insumos
  });

  // Con +40% de costo, el margen neto cae por debajo del 50%
  assert.ok(auditoriaCritica.margenNetoEstimado < 0.50);
  assert.equal(auditoriaCritica.alertaMargen, true);
});
