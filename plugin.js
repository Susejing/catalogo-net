const DATA_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/catalogo_completo.json";

let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  // Forzamos a Kino a descargar los datos
  const res = await kino.fetch(DATA_URL);
  if (!res.ok) throw new Error("Error HTTP al descargar: " + res.status);
  
  const data = await res.json();
  
  // Verificamos si el JSON es un array o si viene envuelto en un objeto
  if (Array.isArray(data)) {
    memoryCache = data;
  } else if (data && data.items) {
    memoryCache = data.items; // Por si el extractor lo guardó como { "items": [...] }
  } else {
    throw new Error("El archivo descargado no es una lista válida.");
  }
  
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
  const rows = [];

  // 1. FILA DE PRUEBA (Si ves esto, la app sí está cargando el plugin)
  rows.push({
    id: "prueba-visual",
    title: "Diagnóstico Visual",
    items: [{
      id: "test-1",
      title: "✅ Si ves esto, el plugin SÍ responde",
      poster: "https://image.tmdb.org/t/p/w500/9EpOhoSZApJEojx3L3hwr3V3CWd.jpg",
      kind: "movie",
      ref: "movie:test-1"
    }]
  });

  try {
    // 2. INTENTO DE CARGAR TU CATÁLOGO
    const catalog = await getCatalog();
    
    if (!catalog || catalog.length === 0) {
      throw new Error("El catálogo se descargó pero está VACÍO (0 títulos).");
    }

    // Filtramos películas
    const movies = catalog.filter(i => i.kind === 'movie');
    
    if (movies.length === 0) {
      throw new Error("Se descargaron " + catalog.length + " títulos, pero NINGUNO tiene kind='movie'.");
    }

    // Si todo sale bien, mostramos las películas
    rows.push({ 
      id: "movies-new", 
      title: "Películas Recientes (Éxito)", 
      items: movies.slice(0, 20).map(formatItem) 
    });

  } catch (error) {
    // 3. SI HAY UN ERROR, LO MOSTRAMOS EN PANTALLA
    rows.push({
      id: "error-fila",
      title: "❌ ERROR DETECTADO ❌",
      items: [{
        id: "error-id",
        title: error.message, // Aquí saldrá la razón exacta
        poster: "",
        kind: "movie",
        ref: "movie:error"
      }]
    });
  }

  return rows;
}

// Funciones básicas para que Kino no marque error
export async function search(query) { return []; }
export async function browse() { return { items: [], next: null }; }
export async function resolve() { throw new Error("No video"); }
