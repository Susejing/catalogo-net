// plugin.js - CATALOG//NET (Offline Edition Completa)

const DATA_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/catalogo_completo.json";

let memoryCache = null;

// Descarga el catálogo y lo guarda en caché
async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  const res = await kino.fetch(DATA_URL);
  if (!res.ok) throw new Error("No se pudo cargar el catálogo desde GitHub");
  
  memoryCache = await res.json();
  return memoryCache;
}

// Formatea cada título para que Kino lo entienda
function formatItem(item) {
  return {
    id: item.id ? item.id.toString() : Math.random().toString(),
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: item.kind || "movie",
    ref: `${item.kind || "movie"}:${item.id}`
  };
}

// --- Función de Inicio (8 Secciones) ---
export async function home() {
  try {
    const catalog = await getCatalog();
    
    // Si el JSON está vacío, devolvemos una fila vacía
    if (!catalog || catalog.length === 0) return [];

    const rows = [];
    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');

    // 1. Series Recientes
    if (series.length > 0) {
      rows.push({ 
        id: "series-recientes", 
        title: "Series Recientes", 
        items: series.reverse().slice(0, 20).map(formatItem) 
      });
    }

    // 2. Películas Recientes
    if (movies.length > 0) {
      rows.push({ 
        id: "peliculas-recientes", 
        title: "Películas Recientes", 
        items: movies.reverse().slice(0, 20).map(formatItem) 
      });
    }

    // 3. Animes Subtitulados / Latino (Buscando en géneros)
    const animes = series.filter(i => i.genres?.includes('anime') || i.genres?.includes('animación'));
    if (animes.length > 0) {
      rows.push({ 
        id: "animes", 
        title: "Animes", 
        items: animes.slice(0, 20).map(formatItem) 
      });
    }

    // 4. Películas de Animación
    const animMovies = movies.filter(i => i.genres?.includes('animación') || i.genres?.includes('anime'));
    if (animMovies.length > 0) {
      rows.push({ 
        id: "peliculas-animadas", 
        title: "Películas Animadas", 
        items: animMovies.slice(0, 20).map(formatItem) 
      });
    }

    // 5. Destacadas (Aleatorias)
    const randomMovies = [...movies].sort(() => 0.5 - Math.random());
    rows.push({ 
      id: "destacadas", 
      title: "Descubre algo nuevo", 
      items: randomMovies.slice(0, 20).map(formatItem) 
    });

    // 6. Fila de Géneros
    const genres = ["Acción", "Comedia", "Drama", "Fantasía", "Terror", "Romance", "Ciencia Ficción", "Suspenso"];
    rows.push({
      id: "explorar-generos",
      title: "Explorar por Género",
      items: genres.map(g => ({
        id: `genre:${g}`,
        title: g,
        kind: "series",
        ref: `genre:${g}`,
        poster: ""
      }))
    });

    return rows;

  } catch (error) {
    kino.log("Error cargando el catálogo:", error);
    throw new Error("No se pudo cargar el catálogo. Intenta de nuevo.");
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
  
  const results = catalog.filter(item => 
    item.genres && item.genres.some(g => g.toLowerCase().includes(genre))
  );

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
  
  const item = catalog.find(i => i.id.toString() === id);
  
  if (!item || !item.files || item.files.length === 0) {
    throw new Error("No se encontraron enlaces de video para este título.");
  }

  // Buscamos el enlace válido de Yandex
  const validFile = item.files.find(f => f.plain);
  
  if (!validFile) {
    throw new Error("El enlace no está disponible o está cifrado.");
  }

  return { url: validFile.plain };
}
