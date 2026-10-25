// plugin.js - CATALOG//NET (Offline Edition)

// URL de tu archivo JSON subido a GitHub. 
// ¡Asegúrate de que el nombre de tu rama sea "main" o "master"!
const DATA_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/catalogo_completo.json";

// Variables para guardar en caché y no descargar el JSON cada vez
let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  const res = await kino.fetch(DATA_URL);
  if (!res.ok) throw new Error("No se pudo cargar el catálogo desde GitHub");
  
  memoryCache = await res.json();
  return memoryCache;
}

// Función auxiliar para formatear los ítems como le gustan a Kino
function formatItem(item) {
  return {
    id: item.id.toString(),
    title: item.name,
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: item.kind || "movie",
    ref: `${item.kind || "movie"}:${item.id}`
  };
}

// --- Función de Inicio (8 Secciones) ---
export async function home() {
  const catalog = await getCatalog();
  const rows = [];

  // Filtramos el catálogo por tipo
  const movies = catalog.filter(i => i.kind === 'movie');
  const series = catalog.filter(i => i.kind === 'series');

  // 1-2: Secciones de Animes
  const animesSub = series.filter(i => i.lang === 'ja' || i.genres?.includes('anime'));
  const animesLat = series.filter(i => i.lang === 'es' || i.genres?.includes('anime'));

  // 3-4: Películas
  const moviesSub = movies.filter(i => i.lang === 'ja' || i.genres?.includes('anime'));
  const moviesLat = movies.filter(i => i.lang === 'es' || i.genres?.includes('anime'));

  // Armamos las filas
  if (animesSub.length > 0) rows.push({ title: "Animes Subtitulados", items: animesSub.slice(0, 20).map(formatItem) });
  if (animesLat.length > 0) rows.push({ title: "Animes Latino", items: animesLat.slice(0, 20).map(formatItem) });
  if (moviesSub.length > 0) rows.push({ title: "Películas Subtituladas", items: moviesSub.slice(0, 20).map(formatItem) });
  if (moviesLat.length > 0) rows.push({ title: "Películas Latino", items: moviesLat.slice(0, 20).map(formatItem) });

  // 5-6: Recientes
  rows.push({ title: "Series Recientes", items: series.reverse().slice(0, 20).map(formatItem) });
  rows.push({ title: "Películas Recientes", items: movies.reverse().slice(0, 20).map(formatItem) });

  // 7: Destacadas
  const randomMovies = [...movies].sort(() => 0.5 - Math.random());
  rows.push({ title: "Descubre algo nuevo", items: randomMovies.slice(0, 20).map(formatItem) });

  // 8: Fila de Géneros
  const genres = ["Acción", "Comedia", "Drama", "Fantasía", "Terror", "Romance", "Ciencia Ficción", "Suspenso"];
  rows.push({
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
  const [kind, id] = ref.split(':');
  const catalog = await getCatalog();
  
  const item = catalog.find(i => i.id.toString() === id);
  
  if (!item || !item.files || item.files.length === 0) {
    throw new Error("No se encontraron enlaces de video para este título.");
  }

  // Buscamos el primer enlace directo válido
  const validFile = item.files.find(f => f.plain);
  
  if (!validFile) {
    throw new Error("El enlace no está disponible o está cifrado.");
  }

  return { url: validFile.plain };
}
