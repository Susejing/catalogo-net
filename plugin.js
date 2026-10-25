// plugin.js - CATALOG//NET (Versión Final Definitiva)

const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";

// ⚠️ AQUÍ ESTÁN LOS NOMBRES EXACTOS DE TUS ARCHIVOS:
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
  let errores = [];

  for (const archivo of ARCHIVOS) {
    try {
      const url = BASE_URL + archivo;
      const res = await kino.fetch(url);
      
      if (res.ok) {
        const parte = await res.json();
        catalogoCompleto = catalogoCompleto.concat(parte);
      } else {
        errores.push(`${archivo} (Error HTTP: ${res.status})`);
      }
    } catch (e) {
      errores.push(`${archivo} (No se pudo descargar)`);
    }
  }
  
  if (catalogoCompleto.length === 0) {
    throw new Error("No se pudo cargar ningún archivo. Revisa: " + errores.join(", "));
  }
  
  memoryCache = catalogoCompleto;
  return memoryCache;
}

// Función segura para leer los géneros (ya sean textos o arrays)
function getSafeGenres(genresData) {
  if (!genresData) return "";
  if (Array.isArray(genresData)) return genresData.join(" ");
  if (typeof genresData === 'string') {
    return genresData.replace(/[\[\]"]/g, ''); 
  }
  return "";
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

// --- Función de Inicio (Catálogo) ---
export async function home() {
  try {
    const catalog = await getCatalog();
    
    const rows = [];
    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');

    // Fila de estado (Para confirmar que cargó)
    rows.push({
      id: "status",
      title: `✅ Catálogo cargado (${catalog.length} títulos)`,
      items: movies.slice(0, 15).map(formatItem) 
    });

    if (movies.length > 0) {
      rows.push({ id: "movies", title: "Películas Recientes", items: movies.slice(15, 45).map(formatItem) });
    }

    if (series.length > 0) {
      rows.push({ id: "series", title: "Series Recientes", items: series.slice(0, 30).map(formatItem) });
    }

    const genres = ["acción", "comedia", "drama", "terror", "romance", "ciencia ficción", "suspenso", "aventura"];
    rows.push({
      id: "genres",
      title: "Explorar por Género",
      items: genres.map(g => ({
        id: `genre:${g}`,
        title: g.toUpperCase(),
        kind: "movie",
        ref: `genre:${g}`,
        poster: ""
      }))
    });

    return rows;

  } catch (error) {
    kino.log("ERROR EN HOME:", error.message);
    return [{
      id: "error",
      title: "❌ Error: " + error.message,
      items: [{ id: "err", title: "Revisa tu conexión", poster: "", kind: "movie", ref: "movie:err" }]
    }];
  }
}

// --- Función de Búsqueda ---
export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  const results = catalog.filter(item => item.name && item.name.toLowerCase().includes(q));
  return results.slice(0, 50).map(formatItem);
}

// --- Función de Navegación por Género ---
export async function browse(ref, cursor) {
  if (!ref.startsWith('genre:')) return { items: [], next: null };
  const genre = ref.split(':')[1].toLowerCase();
  const catalog = await getCatalog();
  const results = catalog.filter(item => getSafeGenres(item.genres).toLowerCase().includes(genre));
  return { items: results.slice(0, 50).map(formatItem), next: null };
}

// --- Función de Resolución (Reproducción) ---
export async function resolve(ref) {
  const parts = ref.split(':');
  const id = parts[1]; 
  const catalog = await getCatalog();
  const item = catalog.find(i => (i.row && i.row.toString() === id) || (i.id && i.id.toString() === id));
  
  if (!item) throw new Error("No se encontró la película en el catálogo.");
  if (!item.files || item.files.length === 0) throw new Error("No hay enlaces de video disponibles.");
  
  const validFile = item.files.find(f => f.plain);
  if (!validFile) throw new Error("El enlace está cifrado o no disponible.");
  
  return { url: validFile.plain };
}
