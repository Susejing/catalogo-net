// plugin.js - CATALOG//NET (Versión Optimizada)

const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";

const ARCHIVOS = [
  "catalogo_completo.001.json",
  "catalogo_completo.002.json",
  "catalogo_completo.003.json",
  "catalogo_completo.004.json" 
];

let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  let catalogoCompleto = [];
  
  // Cargamos uno por uno para no saturar la memoria de Kino
  for (const archivo of ARCHIVOS) {
    try {
      const res = await kino.fetch(BASE_URL + archivo);
      if (res.ok) {
        const parte = await res.json();
        // Solo agregamos la parte si es un array válido
        if (Array.isArray(parte)) {
            catalogoCompleto = catalogoCompleto.concat(parte);
        }
      }
    } catch (e) {
      kino.log("Error cargando " + archivo + ": " + e.message);
    }
  }
  
  memoryCache = catalogoCompleto;
  return memoryCache;
}

function formatItem(item) {
  const realId = item.row ? item.row.toString() : item.id.toString(); 
  return {
    id: realId,
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: item.kind || "movie",
    ref: `${item.kind || "movie"}:${realId}`
  };
}

export async function home() {
  const catalog = await getCatalog();
  const rows = [];

  // Mostramos el conteo real
  rows.push({
    id: "status",
    title: `✅ Catálogo cargado (${catalog.length} títulos)`,
    items: catalog.slice(0, 15).map(formatItem)
  });

  const movies = catalog.filter(i => i.kind === 'movie');
  if (movies.length > 0) {
    rows.push({ id: "movies", title: "Películas Recientes", items: movies.slice(15, 45).map(formatItem) });
  }

  return rows;
}

export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

export async function browse() { return { items: [], next: null }; }

export async function resolve(ref) {
  const id = ref.split(':')[1]; 
  const catalog = await getCatalog();
  const item = catalog.find(i => (i.row && i.row.toString() === id) || (i.id && i.id.toString() === id));
  
  if (!item) throw new Error("No se encontró la película.");

  // DIAGNÓSTICO EXTREMO: Buscamos cualquier propiedad que parezca un enlace
  let videoUrl = null;
  
  // 1. Buscamos en el formato que esperábamos (files)
  if (item.files && item.files.length > 0) {
     const validFile = item.files.find(f => f.plain || f.url);
     if (validFile) videoUrl = validFile.plain || validFile.url;
  } 
  // 2. Si no está, buscamos en otras propiedades comunes
  else if (item.url) videoUrl = item.url;
  else if (item.link) videoUrl = item.link;
  else if (item.stream) videoUrl = item.stream;

  if (!videoUrl) {
    // Si no encuentra nada, le decimos al usuario qué propiedades SÍ tiene este título
    const props = Object.keys(item).join(", ");
    throw new Error(`Este título no tiene video. Propiedades: ${props}`);
  }

  return { url: videoUrl };
}
