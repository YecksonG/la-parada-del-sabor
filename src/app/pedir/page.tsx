import { createClient } from "@/lib/supabase/server";
import MenuClienteView from "./client";
import { Metadata } from "next";
import { obtenerTasasDelDia } from "@/lib/tasas-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Menú Digital & Pedidos Online | La Parada del Sabor",
  description: "Arepas tradicionales y especiales hechas al momento con ingredientes frescos en San Diego, Carabobo.",
};

export default async function PedirPage() {
  const supabase = await createClient();

  const [catRes, prodRes, extRes, tasaRes, zonasRes, tasasLive] = await Promise.all([
    supabase.from("categorias").select("*").order("orden", { ascending: true }),
    supabase.from("productos").select("*").order("nombre", { ascending: true }),
    supabase.from("extras_modificadores").select("*").eq("activo", true).order("nombre", { ascending: true }),
    supabase.from("tasas_cambio").select("eur_bs, bcv_usd_bs, tasa_usd_bs").order("fecha", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("zonas_delivery").select("*").eq("activo", true).order("orden", { ascending: true }),
    obtenerTasasDelDia().catch(() => null),
  ]);

  // Tasa oficial en Euros (€): priorizamos bcv.today EUR o eur_bs de base de datos
  const tasaBcv = Number(tasasLive?.eur || tasaRes.data?.eur_bs || tasaRes.data?.tasa_usd_bs || tasaRes.data?.bcv_usd_bs) || 0;

  // Categorías oficiales para San Diego / Valencia
  const catTradicionales = {
    id: "cat-tradicionales",
    nombre: "Tradicionales (€5)",
    icono: "⭐",
    orden: 1,
    activo: true,
    creado_el: new Date().toISOString(),
  };
  const catEspeciales = {
    id: "cat-especiales",
    nombre: "Nuestras Especiales (€6)",
    icono: "🔥",
    orden: 2,
    activo: true,
    creado_el: new Date().toISOString(),
  };
  const catSemana = {
    id: "cat-semana",
    nombre: "Especial de la Semana",
    icono: "👑",
    orden: 3,
    activo: true,
    creado_el: new Date().toISOString(),
  };
  const catBebidas = {
    id: "cat-bebidas",
    nombre: "Bebidas Bien Frías",
    icono: "🥤",
    orden: 4,
    activo: true,
    creado_el: new Date().toISOString(),
  };

  const categorias = [catTradicionales, catEspeciales, catSemana, catBebidas];

  // Mapeo seguro con productos existentes en Supabase para preservar UUIDs de comanda
  const rawProds = prodRes.data || [];
  const findId = (kw: string) => rawProds.find((p) => p.nombre.toLowerCase().includes(kw.toLowerCase()))?.id;

  const productos = [
    // --- TRADICIONALES (5.00 €) ---
    {
      id: findId("pelúa") || "prod-pelua",
      nombre: "Arepa Pelúa",
      descripcion: "Carne esmechada jugosa y sazonada en su punto, abrazada por abundante queso amarillo y el toque perfecto de mantequilla.",
      precio_usd: 5.0,
      categoria_id: "cat-tradicionales",
      icono: "🧀",
      activo: true,
      creado_el: new Date().toISOString(),
    },
    {
      id: findId("catira") || "prod-catira",
      nombre: "Arepa Catira",
      descripcion: "Pollo esmechado tierno y lleno de sabor, combinado con queso amarillo y mantequilla para el bocado ideal.",
      precio_usd: 5.0,
      categoria_id: "cat-tradicionales",
      icono: "🍗",
      activo: true,
      creado_el: new Date().toISOString(),
    },
    {
      id: findId("reina") || findId("chorizo") || "prod-reina-pepiada",
      nombre: "Reina Pepiada",
      descripcion: "Nuestra estrella. Pollo suave deshilachado en una crema artesanal ultra fresca de aguacate y especias. ¡Purita cremosidad!",
      precio_usd: 5.0,
      categoria_id: "cat-tradicionales",
      icono: "🥑",
      activo: true,
      creado_el: new Date().toISOString(),
    },
    {
      id: findId("jamón") || "prod-sencilla",
      nombre: "Arepa Sencilla",
      descripcion: "La combinación clásica que nunca falla: lonjas selectas de jamón de pavo, queso amarillo y mantequilla calientita.",
      precio_usd: 5.0,
      categoria_id: "cat-tradicionales",
      icono: "🥓",
      activo: true,
      creado_el: new Date().toISOString(),
    },

    // --- NUESTRAS ESPECIALES (6.00 €) ---
    {
      id: findId("especial de carne") || "prod-esp-carne",
      nombre: "La Especial de la Casa (Carne)",
      descripcion: "Carne jugosa esmechada coronada con vegetales frescos y crujientes (lechuga, tomate, cebolla morada), lonjas de jamón de pavo, queso amarillo y explosión de salsas.",
      precio_usd: 6.0,
      categoria_id: "cat-especiales",
      icono: "👑",
      activo: true,
      creado_el: new Date().toISOString(),
    },
    {
      id: findId("especial de pollo") || "prod-esp-pollo",
      nombre: "La Especial de la Casa (Pollo)",
      descripcion: "Pollo esmechado tierno coronado con vegetales frescos y crujientes (lechuga, tomate, cebolla morada), lonjas de jamón de pavo, queso amarillo y explosión de salsas.",
      precio_usd: 6.0,
      categoria_id: "cat-especiales",
      icono: "👑",
      activo: true,
      creado_el: new Date().toISOString(),
    },

    // --- ESPECIAL DE LA SEMANA (6.00 €) ---
    {
      id: "prod-semana",
      nombre: "Especial de la Semana",
      descripcion: "Relleno especial rotativo de temporada. Escríbenos por WhatsApp para conocer el sabor exclusivo de esta semana.",
      precio_usd: 6.0,
      categoria_id: "cat-semana",
      icono: "✨",
      activo: true,
      creado_el: new Date().toISOString(),
    },

    // --- BEBIDAS BIEN FRÍAS ---
    {
      id: findId("vaso") || "prod-mora",
      nombre: "Jugo Natural de Mora",
      descripcion: "Frescura pura (¡fruta natural seleccionada!). El acompañante perfecto para tu cena.",
      precio_usd: 2.5,
      categoria_id: "cat-bebidas",
      icono: "🍇",
      activo: true,
      creado_el: new Date().toISOString(),
    },
    {
      id: findId("pepsi 1 litro") || "prod-refresco-1l",
      nombre: "Refresco 1 Litro",
      descripcion: "Refresco bien frío en presentación de 1 Litro para acompañar.",
      precio_usd: 1.5,
      categoria_id: "cat-bebidas",
      icono: "🥤",
      activo: true,
      creado_el: new Date().toISOString(),
    },
    {
      id: findId("pepsi 1.5") || "prod-refresco-15l",
      nombre: "Refresco 1.5 Litros",
      descripcion: "Para compartir en familia bien frío.",
      precio_usd: 2.5,
      categoria_id: "cat-bebidas",
      icono: "🥤",
      activo: true,
      creado_el: new Date().toISOString(),
    },
  ];

  const extras = extRes.data || [];

  // Zonas de Delivery de San Diego / Valencia (Base en Pie de Monte Chale, La Cumaca)
  const zonasDelivery = [
    {
      id: "zona-sandiego",
      nombre: "San Diego (La Cumaca / Pie de Monte)",
      descripcion: "Toda la zona de San Diego, La Cumaca, El Remanso, Valle Verde",
      precio_usd: 0.0,
      tiempo_estimado_min: 25,
      orden: 1,
      activo: true,
    },
    {
      id: "zona-sandiego-sur",
      nombre: "San Diego Sur (Los Jarales / El Morro / Metro Plaza)",
      descripcion: "Los Jarales, El Morro, Metro Plaza",
      precio_usd: 1.5,
      tiempo_estimado_min: 30,
      orden: 2,
      activo: true,
    },
    {
      id: "zona-valencia-norte",
      nombre: "Valencia Norte (Trigaleña, Mañongo, Prebo, El Viñedo)",
      descripcion: "Trigal, Las Chimeneas, La Viña, El Viñedo, Mañongo",
      precio_usd: 3.0,
      tiempo_estimado_min: 45,
      orden: 3,
      activo: true,
    },
    {
      id: "zona-naguanagua",
      nombre: "Naguanagua (La Granja / Tazajal / Casco)",
      descripcion: "La Granja, Tazajal, Casco Central de Naguanagua",
      precio_usd: 3.5,
      tiempo_estimado_min: 50,
      orden: 4,
      activo: true,
    },
  ];

  return (
    <MenuClienteView
      categorias={categorias as any}
      productos={productos as any}
      extras={extras}
      zonasDelivery={zonasDelivery as any}
      tasaBcv={tasaBcv}
    />
  );
}
