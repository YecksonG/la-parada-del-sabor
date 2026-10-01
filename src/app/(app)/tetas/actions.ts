"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guard";
import { calcularTotalTetasUsd } from "@/lib/tetas-precios";
import { generarTagPagoMixto, PagoFraccionItem, METODOS_FRACCION_INFO } from "@/lib/pago-mixto";
import { TetasCategoria } from "@/types/database";

export type ItemVentaTeta = {
  sabor_id: string;
  cantidad: number;
};

export type RegistrarVentaMultiTetasPayload = {
  items: ItemVentaTeta[];
  metodo_pago: string;
  tasa_bcv: number;
  notas?: string;
  desglose_mixto?: PagoFraccionItem[];
  cliente_id?: string | null;
  cliente_credito?: string;
};

export async function registrarVentaMultiTetasAction(payload: RegistrarVentaMultiTetasPayload) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return { ok: false, error: auth.error };

    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      return { ok: false, error: "Debes seleccionar al menos un sabor de teta para la venta." };
    }

    // Filtrar items con cantidad válida e integridad numérica
    const itemsValidos = payload.items.filter(
      (it) => it && typeof it.sabor_id === "string" && Number.isInteger(it.cantidad) && it.cantidad > 0
    );
    if (itemsValidos.length === 0) {
      return { ok: false, error: "Las cantidades a despachar deben ser números enteros mayores a 0." };
    }

    const supabase = await createClient();

    // Obtener sabores seleccionados de la base de datos
    const saborIds = itemsValidos.map((it) => it.sabor_id);
    const { data: sabores, error: saboresErr } = await supabase
      .from("tetas_inventario")
      .select("*")
      .in("id", saborIds);

    if (saboresErr || !sabores) {
      return { ok: false, error: "Error al consultar inventario de sabores en la base de datos." };
    }

    const saboresMap = new Map(sabores.map((s) => [s.id, s]));

    // Validar stock para cada sabor
    for (const it of itemsValidos) {
      const s = saboresMap.get(it.sabor_id);
      if (!s) {
        return { ok: false, error: "Uno de los sabores seleccionados no existe en el catálogo." };
      }
      const stockActual = Number(s.stock_unidades) || 0;
      if (stockActual < it.cantidad) {
        return {
          ok: false,
          error: `Stock insuficiente para "${s.sabor}". Quedan ${stockActual} unidades en freezer y solicitaste ${it.cantidad}.`,
        };
      }
    }

    const tasaBcv = Number(payload.tasa_bcv) > 0 ? Number(payload.tasa_bcv) : 60.0;
    const totalUnidades = itemsValidos.reduce((acc, it) => acc + it.cantidad, 0);

    // REGLA OFICIAL DE PRECIOS: 1x0.80$ y 2x1.50$ aplicada al total acumulado de la orden
    const totalUsdOrden = calcularTotalTetasUsd(totalUnidades, 0.80);
    const totalBsOrden = Number((totalUsdOrden * tasaBcv).toFixed(2));

    // Validar y sanitizar desglose mixto si aplica
    let desgloseSanitizado: PagoFraccionItem[] | undefined;
    if (payload.metodo_pago === "pago_mixto" && Array.isArray(payload.desglose_mixto) && payload.desglose_mixto.length > 0) {
      desgloseSanitizado = payload.desglose_mixto
        .filter((f) => f && f.metodo in METODOS_FRACCION_INFO && f.monto_usd > 0)
        .map((f) => ({
          metodo: f.metodo,
          monto_usd: Number(f.monto_usd.toFixed(2)),
          monto_bs: Number((f.monto_usd * tasaBcv).toFixed(2)),
        }));
    }

    // Preparar notas
    const partesNotas: string[] = [];
    const nombresResumen = itemsValidos
      .map((it) => `${it.cantidad}x ${saboresMap.get(it.sabor_id)?.sabor}`)
      .join(", ");

    partesNotas.push(`[Pack Multi-Sabor (${totalUnidades} tetas): ${nombresResumen}]`);

    if (payload.metodo_pago === "pago_mixto" && desgloseSanitizado && desgloseSanitizado.length > 0) {
      partesNotas.push(generarTagPagoMixto(desgloseSanitizado, tasaBcv));
    } else if (payload.metodo_pago === "credito") {
      partesNotas.push(`[CRÉDITO PENDIENTE: ${payload.cliente_credito?.trim() || "Cliente directo"}]`);
    }
    if (payload.notas?.trim()) {
      partesNotas.push(payload.notas.trim());
    }
    const notasFinales = partesNotas.join(" • ");

    // SEGURIDAD: Derivar registrado_por de la sesión autenticada real
    const operadorSeguro = auth.user.email?.split("@")[0] || "admin";

    // Preparar inserciones proporcionales para tetas_ventas
    let acumuladoUsd = 0;
    let acumuladoBs = 0;
    const registrosParaInsertar = itemsValidos.map((it, idx) => {
      const s = saboresMap.get(it.sabor_id)!;
      const esUltimo = idx === itemsValidos.length - 1;

      let subtotalUsdItem = Number(((it.cantidad / totalUnidades) * totalUsdOrden).toFixed(2));
      let subtotalBsItem = Number(((it.cantidad / totalUnidades) * totalBsOrden).toFixed(2));

      if (esUltimo) {
        subtotalUsdItem = Number((totalUsdOrden - acumuladoUsd).toFixed(2));
        subtotalBsItem = Number((totalBsOrden - acumuladoBs).toFixed(2));
      } else {
        acumuladoUsd += subtotalUsdItem;
        acumuladoBs += subtotalBsItem;
      }

      return {
        sabor_id: s.id,
        sabor_nombre: s.sabor,
        cantidad: it.cantidad,
        precio_unitario_usd: Number((subtotalUsdItem / it.cantidad).toFixed(2)),
        costo_unitario_usd: Number(s.costo_compra_unitario_usd) || 0.40,
        total_usd: subtotalUsdItem,
        total_bs: subtotalBsItem,
        tasa_bcv: tasaBcv,
        metodo_pago: payload.metodo_pago || "efectivo_usd",
        cliente_id: payload.cliente_id || null,
        registrado_por: operadorSeguro,
        notas: notasFinales,
      };
    });

    const { error: insertErr } = await supabase.from("tetas_ventas").insert(registrosParaInsertar);

    if (insertErr) {
      console.error("Error al registrar venta multi-sabor en tetas_ventas:", insertErr);
      return { ok: false, error: insertErr.message || "No se pudo registrar la venta en la base de datos." };
    }

    // Revalidar todas las vistas relacionadas
    revalidatePath("/tetas");
    revalidatePath("/");
    revalidatePath("/ventas");
    revalidatePath("/caja");
    revalidatePath("/dashboard");
    return { ok: true, totalUsd: totalUsdOrden, totalBs: totalBsOrden, totalUnidades };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error inesperado al procesar venta de tetas.";
    console.error("Excepción en registrarVentaMultiTetasAction:", err);
    return { ok: false, error: errorMsg };
  }
}

export type AbastecerStockTetasPayload = {
  sabor_id: string;
  cantidad: number;
  costo_compra_unitario_usd?: number;
  precio_venta_unitario_usd?: number;
  registrar_gasto?: boolean;
};

export async function abastecerStockTetasAction(payload: AbastecerStockTetasPayload) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return { ok: false, error: auth.error };

    if (!payload.sabor_id || !payload.cantidad || payload.cantidad <= 0) {
      return { ok: false, error: "Datos de abastecimiento incompletos o inválidos." };
    }

    const supabase = await createClient();

    // Consultar sabor actual
    const { data: sabor, error: saborErr } = await supabase
      .from("tetas_inventario")
      .select("*")
      .eq("id", payload.sabor_id)
      .single();

    if (saborErr || !sabor) {
      return { ok: false, error: "Sabor no encontrado para abastecimiento." };
    }

    const nuevoCosto = payload.costo_compra_unitario_usd !== undefined
      ? Number(payload.costo_compra_unitario_usd)
      : sabor.costo_compra_unitario_usd;
    const nuevoPrecio = payload.precio_venta_unitario_usd !== undefined
      ? Number(payload.precio_venta_unitario_usd)
      : sabor.precio_venta_unitario_usd;

    // Intentar actualización atómica vía RPC si está disponible
    const { data: rpcStock, error: rpcErr } = await supabase.rpc("fn_abastecer_stock_teta", {
      p_sabor_id: payload.sabor_id,
      p_cantidad: payload.cantidad,
    });

    let nuevoStock = rpcStock;
    if (rpcErr || rpcStock === null || rpcStock === undefined) {
      // Fallback seguro si la función RPC aún no se ha ejecutado en Supabase
      nuevoStock = (Number(sabor.stock_unidades) || 0) + Number(payload.cantidad);
      const { error: updateErr } = await supabase
        .from("tetas_inventario")
        .update({
          stock_unidades: nuevoStock,
          costo_compra_unitario_usd: nuevoCosto,
          precio_venta_unitario_usd: nuevoPrecio,
          actualizado_el: new Date().toISOString(),
        })
        .eq("id", payload.sabor_id);

      if (updateErr) {
        return { ok: false, error: "Error al actualizar stock de freezer en base de datos." };
      }
    } else {
      // Si la RPC sumó el stock, actualizar costos si cambiaron
      if (nuevoCosto !== sabor.costo_compra_unitario_usd || nuevoPrecio !== sabor.precio_venta_unitario_usd) {
        await supabase
          .from("tetas_inventario")
          .update({
            costo_compra_unitario_usd: nuevoCosto,
            precio_venta_unitario_usd: nuevoPrecio,
            actualizado_el: new Date().toISOString(),
          })
          .eq("id", payload.sabor_id);
      }
    }

    // Registrar costo de producción en gastos del negocio con categoría válida ("otros")
    if (payload.registrar_gasto) {
      // Obtener tasa BCV activa para calcular monto_bs real
      const { data: tasaData } = await supabase
        .from("tasas_cambio")
        .select("tasa_usd_bs, bcv_usd_bs")
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();

      const tasaBcvActiva = Number(tasaData?.tasa_usd_bs || tasaData?.bcv_usd_bs) || 60.0;
      const totalGastoUsd = Number((nuevoCosto * payload.cantidad).toFixed(2));
      const totalGastoBs = Number((totalGastoUsd * tasaBcvActiva).toFixed(2));

      const { error: insertGastoErr } = await supabase.from("gastos").insert({
        categoria: "otros",
        descripcion: `Producción de ${payload.cantidad} tetas sabor "${sabor.sabor}"`,
        monto_usd: totalGastoUsd,
        monto_bs: totalGastoBs,
        tasa_bcv: tasaBcvActiva,
        cuenta_origen: "caja_chica",
        estado: "pagado",
        notas: "[Producción Tetas Cream] Materia prima / leche / rellenos artesanales",
        creado_por: auth.user.email?.split("@")[0] || "admin",
      });

      if (insertGastoErr) {
        console.error("Error al registrar egreso en gastos:", insertGastoErr);
        return {
          ok: false,
          error: `Stock abastecido (+${payload.cantidad}), pero falló el registro contable del gasto: ${insertGastoErr.message}`,
        };
      }
    }

    revalidatePath("/tetas");
    revalidatePath("/");
    revalidatePath("/gastos");
    revalidatePath("/dashboard");
    revalidatePath("/caja");
    return { ok: true, nuevoStock };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error al abastecer freezer.";
    console.error("Excepción en abastecerStockTetasAction:", err);
    return { ok: false, error: errorMsg };
  }
}

export async function crearSaborTetaAction(
  sabor: string,
  categoria: TetasCategoria,
  costoUnitarioUsd: number,
  precioVentaUsd: number,
  stockInicial: number
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return { ok: false, error: auth.error };

    if (!sabor.trim()) {
      return { ok: false, error: "El nombre del sabor no puede estar vacío." };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tetas_inventario")
      .insert({
        sabor: sabor.trim(),
        categoria,
        costo_compra_unitario_usd: Math.max(0, costoUnitarioUsd),
        precio_venta_unitario_usd: Math.max(0.1, precioVentaUsd),
        stock_unidades: Math.max(0, stockInicial),
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Ya existe un sabor registrado con ese nombre exacto." };
      }
      return { ok: false, error: "Error al registrar el nuevo sabor en la base de datos." };
    }

    revalidatePath("/tetas");
    revalidatePath("/");
    return { ok: true, data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error al crear nuevo sabor.";
    console.error("Excepción en crearSaborTetaAction:", err);
    return { ok: false, error: errorMsg };
  }
}
