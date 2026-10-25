// plugin.js - CATALOG//NET (Versión Final Definitiva)

const DATA_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/catalogo_completo.json";

let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  const res = await kino.fetch(DATA_URL);
  if (!res.ok) throw new Error("Error al descargar de GitHub: " + res.status);
  
  memoryCache = await res.json();
  return memoryCache;
}

// Función segura para leer los géneros (ya sean textos o arrays)
function getSafeGenres(genresData) {
  if (!genresData) return "";
  if (Array.isArray(genresData)) return genresData.join(" ");
  if (typeof genresData === 'string') {
    // Limpiamos los corchetes si vienen como "[3,7,14]"
    return genresData.replace(/[\[\]"]/g, ''); 
  }
  return "";
}

function formatItem(item) {
  // Usamos 'row' para el ID porque es el que usa el servidor de videos.
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
    if (!catalog || catalog.length === 0) return [];

    const rows = [];

    // Separamos películas y series
    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');

    // 1. Películas Recientes (Las primeras 30 del JSON)
    if (movies.length > 0) {
      rows.push({ 
        id: "movies-new", 
        title: "Películas Recientes", 
        items: movies.slice(0, 30).map(formatItem) 
      });
    }

    // 2. Series Recientes (Las primeras 30 del JSON)
    if (series.length > 0) {
      rows.push({ 
        id: "series-new", 
        title: "Series Recientes", 
        items: series.slice(0, 30).map(formatItem) 
      });
    }

    // 3. Películas Animadas / Anime
    const animes = movies.filter(i => {
      const g = getSafeGenres(i.genres).toLowerCase();
      return g.includes('animación') || g.includes('anime') || g.includes('animacion');
    });
    if (animes.length > 0) {
      rows.push({ 
        id: "animes-movies", 
        title: "Anime y Animación", 
        items: animes.slice(0, 30).map(formatItem) 
      });
    }

    // 4. Fila de Géneros (Búsqueda)
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
    // Si falla, mostramos una fila con el error para que no salga vacío
    return [{
      id: "error-row",
      title: "Error al cargar. Revisa tu conexión",
      items: []
    }];
  }
}

// --- Función de Búsqueda ---
export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  
  const results = catalog.filter(item => 
    item.name && item.name.toLowerCase().includes(q)
  );

  return results.slice(0, 50).map(formatItem);
}

// --- Función de Navegación por Género ---
export async function browse(ref, cursor) {
  if (!ref.startsWith('genre:')) return { items: [], next: null };
  
  const genre = ref.split(':')[1].toLowerCase();
  const catalog = await getCatalog();
  
  // Usamos la función segura para no crashear
  const results = catalog.filter(item => {
    const itemGenres = getSafeGenres(item.genres).toLowerCase();
    return itemGenres.includes(genre);
  });

  return {
    items: results.slice(0, 50).map(formatItem),
    next: null
  };
}

// --- Función de Resolución (Reproducción) ---
export async function resolve(ref) {
  const parts = ref.split(':');
  const id = parts[1]; 
  
  const catalog = await getCatalog();
  // Buscamos usando el campo "row"
  const item = catalog.find(i => (i.row && i.row.toString() === id) || (i.id && i.id.toString() === id));
  
  if (!item) {
    throw new Error("No se encontró la película en el catálogo.");
  }

  // Buscamos el enlace del video
  if (!item.files || item.files.length === 0) {
    throw new Error("No hay enlaces de video disponibles para este título.");
  }

  const validFile = item.files.find(f => f.plain);
  
  if (!validFile) {
    throw new Error("El enlace está cifrado o no disponible.");
  }

  return { url: validFile.plain };
}
