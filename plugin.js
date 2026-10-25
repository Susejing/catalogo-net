// plugin.js - CATALOG//NET (Versión con Carga por Partes)

const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";
// Lista de todos los archivos en los que dividiste el JSON
const ARCHIVOS = [
  "catalogo_completo_1.json",
  "catalogo_completo_2.json",
  "catalogo_completo_3.json",
  "catalogo_completo_4.json" 
  // Añade aquí todos los que se hayan creado
];

let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  // Descargamos todos los archivos en paralelo
  const promesas = ARCHIVOS.map(archivo => kino.fetch(BASE_URL + archivo));
  const respuestas = await Promise.all(promesas);
  
  // Juntamos todos los arrays en uno solo
  let catalogoCompleto = [];
  for (const res of respuestas) {
    if (res.ok) {
      const parte = await res.json();
      catalogoCompleto = catalogoCompleto.concat(parte);
    }
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

// --- Función de Inicio (8 Secciones) ---
export async function home() {
  try {
    const catalog = await getCatalog();
    if (!catalog || catalog.length === 0) return [];

    const rows = [];
    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');

    if (movies.length > 0) {
      rows.push({ id: "movies-new", title: "Películas Recientes", items: movies.slice(0, 30).map(formatItem) });
    }
    if (series.length > 0) {
      rows.push({ id: "series-new", title: "Series Recientes", items: series.slice(0, 30).map(formatItem) });
    }

    const animes = movies.filter(i => {
      const g = getSafeGenres(i.genres).toLowerCase();
      return g.includes('animación') || g.includes('anime') || g.includes('animacion');
    });
    if (animes.length > 0) {
      rows.push({ id: "animes-movies", title: "Anime y Animación", items: animes.slice(0, 30).map(formatItem) });
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
    kino.log("Error cargando catálogo:", error.message);
    return [{ id: "error-row", title: "Error al cargar: " + error.message, items: [] }];
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
