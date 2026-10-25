const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";

// Lista de los archivos ligeros que generaste con el script
const ARCHIVOS = [
  "ligero.001.json",
  "ligero.002.json",
  "ligero.003.json",
  "ligero.004.json",
  "ligero.005.json" // Si el script creó más o menos, ajusta esta lista
];

let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  let catalogoCompleto = [];
  
  // Cargamos archivo por archivo para no saturar la memoria de Kino
  for (const archivo of ARCHIVOS) {
    try {
      const res = await kino.fetch(BASE_URL + archivo);
      if (res.ok) {
        const parte = await res.json();
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
  // Usamos el ID de TMDB para que el addon de Nuvio lo reconozca
  const realId = item.id ? item.id.toString() : item.row.toString(); 
  return {
    id: realId,
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: item.kind || "movie",
    ref: `${item.kind || "movie"}:${realId}`
  };
}

export async function home() {
  try {
    const catalog = await getCatalog();
    const rows = [];
    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');

    // Fila de estado para confirmar que cargó
    rows.push({
      id: "status",
      title: `✅ Catálogo cargado (${catalog.length} títulos)`,
      items: movies.slice(0, 20).map(formatItem)
    });

    // Fila de Películas
    if (movies.length > 0) {
      rows.push({ 
        id: "movies", 
        title: "Películas Recientes", 
        items: movies.slice(20, 60).map(formatItem) 
      });
    }
    
    // Fila de Series
    if (series.length > 0) {
      rows.push({ 
        id: "series", 
        title: "Series Recientes", 
        items: series.slice(0, 40).map(formatItem) 
      });
    }

    return rows;
  } catch (error) {
    return [{
      id: "error",
      title: "❌ Error al cargar: " + error.message,
      items: []
    }];
  }
}

export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

export async function browse() { return { items: [], next: null }; }

// Función obligatoria para que Kino busque el video en el addon de Nuvio
export async function resolve(ref) {
  throw new Error("La reproducción se gestiona con el addon de Nuvio.");
}
