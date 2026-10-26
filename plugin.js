const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";
const ADDON_BASE_URL = "https://victory-incl-elephant-diesel.trycloudflare.com";
const YANDEX_API = "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=";

const ARCHIVOS = ["ligero.001.json", "ligero.002.json", "ligero.003.json", "ligero.004.json", "ligero.005.json"];
let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  let catalogoCompleto = [];
  for (const archivo of ARCHIVOS) {
    try {
      const res = await kino.fetch(BASE_URL + archivo);
      if (res.ok) {
        const parte = await res.json();
        if (Array.isArray(parte)) catalogoCompleto = catalogoCompleto.concat(parte);
      }
    } catch (e) { kino.log("Error cargando " + archivo); }
  }
  memoryCache = catalogoCompleto;
  return memoryCache;
}

// 1. FORMATEO DE ITEMS (Con sinopsis incluida si existe en el JSON)
function formatItem(item) {
  const realId = item.id ? item.id.toString() : item.row.toString(); 
  return {
    id: realId,
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: item.kind === 'tv' ? 'series' : (item.kind || "movie"), // Normalizamos 'tv' a 'series'
    ref: `${item.kind === 'tv' ? 'series' : (item.kind || "movie")}:${realId}`,
    overview: item.overview || "", // Si el JSON trae sinopsis, la mostramos
    ids: { tmdb: realId }
  };
}

// 2. CLASIFICACIÓN POR GÉNERO (Anime vs Infantil vs General)
function getGenre(item) {
  const genresStr = (item.genres || "").toString().toLowerCase();
  // El ID 16 en TMDB es Animación. El ID 10762 es Infantil.
  if (genresStr.includes('16') || genresStr.includes('anime') || genresStr.includes('animación')) {
    // Si es animación, diferenciamos por idioma o por palabras clave para separar Anime de Infantil
    if (genresStr.includes('10762') || genresStr.includes('kids') || genresStr.includes('infantil')) {
      return "infantil";
    }
    // Si no es infantil, lo tratamos como anime
    return "anime";
  }
  return "otros";
}

// 3. PESTAÑAS (Sección)
export async function section({ tab }) {
  const tabs = [
    { id: "movies", label: "Películas" },
    { id: "series", label: "Series" },
    { id: "anime", label: "Anime" }
  ];
  const chosen = tabs.some(t => t.id === tab) ? tab : "movies";
  
  return {
    tabs,
    tab: chosen,
    rows: await getRowsForTab(chosen)
  };
}

// 4. GENERADOR DE FILAS (Con separación de géneros)
async function getRowsForTab(tabId) {
  const catalog = await getCatalog();
  const rows = [];

  if (tabId === "movies") {
    const movies = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) !== 'anime' && getGenre(i) !== 'infantil');
    rows.push({ id: "trending_movies", title: "🔥 Tendencias de la semana", ref: "trending_movies", genre: "peliculas", items: movies.slice(0, 20).map(formatItem) });
    rows.push({ id: "cartelera_movies", title: "🎬 En cartelera", ref: "cartelera_movies", genre: "peliculas", items: movies.slice(20, 40).map(formatItem) });
  } 
  else if (tabId === "series") {
    const series = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) !== 'anime' && getGenre(i) !== 'infantil');
    if (series.length > 0) {
      rows.push({ id: "populares_series", title: "📺 Series Populares", ref: "populares_series", genre: "series", items: series.slice(0, 20).map(formatItem) });
      rows.push({ id: "nuevas_series", title: "✨ Nuevas Series", ref: "nuevas_series", genre: "series", items: series.slice(20, 40).map(formatItem) });
    } else {
      // Si no hay series, mostramos un mensaje
      rows.push({ id: "no_series", title: "No hay series disponibles por ahora", items: [] });
    }
  } 
  else if (tabId === "anime") {
    const anime = catalog.filter(i => getGenre(i) === 'anime');
    const infantil = catalog.filter(i => getGenre(i) === 'infantil');
    
    rows.push({ id: "anime_top", title: "🌸 Anime Destacado", ref: "anime_top", genre: "anime", items: anime.slice(0, 20).map(formatItem) });
    if (infantil.length > 0) {
      rows.push({ id: "infantil_row", title: "🧸 Infantil y Caricaturas", ref: "infantil_row", genre: "infantil", items: infantil.slice(0, 20).map(formatItem) });
    }
  }
  return rows;
}

export async function home() {
  return await getRowsForTab("movies");
}

// 5. BROWSE (Para el botón "Ver más")
export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  let source = [];

  if (ref === "trending_movies" || ref === "cartelera_movies") {
    source = catalog.filter(i => (i.kind === 'movie' || i.kind === 'film') && getGenre(i) !== 'anime' && getGenre(i) !== 'infantil');
  } else if (ref === "populares_series" || ref === "nuevas_series") {
    source = catalog.filter(i => (i.kind === 'series' || i.kind === 'tv') && getGenre(i) !== 'anime' && getGenre(i) !== 'infantil');
  } else if (ref === "anime_top") {
    source = catalog.filter(i => getGenre(i) === 'anime');
  } else if (ref === "infantil_row") {
    source = catalog.filter(i => getGenre(i) === 'infantil');
  } else {
    source = catalog;
  }

  const limit = 30;
  const start = cursor ? parseInt(cursor) : 0;
  const end = start + limit;
  const items = source.slice(start, end).map(formatItem);
  const nextCursor = end < source.length ? end.toString() : null;
  return { items, next: nextCursor };
}

// 6. BÚSQUEDA
export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

// 7. SINOPSIS (Details para Películas)
export async function details(ref) {
  const parts = ref.split(':');
  const type = parts[0]; 
  const id = parts[1];

  // Primero intentamos obtener la sinopsis desde nuestro propio catálogo (si la tiene)
  const catalog = await getCatalog();
  const item = catalog.find(i => (i.id && i.id.toString() === id) || (i.row && i.row.toString() === id));
  if (item && item.overview) {
    return { overview: item.overview };
  }

  // Si no está en nuestro catálogo, la pedimos a TMDB
  try {
    const tmdb = await kino.tmdb(id, type, 'es-ES');
    return { overview: tmdb.overview || "Sin sinopsis disponible." };
  } catch (e) {
    return { overview: "No se pudo cargar la sinopsis." };
  }
}

// 8. EPISODIOS (Para Series)
export async function episodes(ref) {
  const parts = ref.split(':');
  const type = parts[0]; 
  const id = parts[1];

  // 1. Pedimos los episodios a la API de MoviePlus (asumiendo que tiene un endpoint similar)
  // Si la API no tiene un endpoint de episodios, usaremos TMDB como respaldo para obtener la lista.
  try {
    // NOTA: La API de MoviePlus puede no tener un endpoint de episodios. 
    // Por ahora, usaremos TMDB para obtener la lista de episodios si es una serie.
    const tmdb = await kino.tmdb(id, 'series', 'es-ES');
    
    // TMDB devuelve las temporadas, pero necesitamos los episodios. 
    // Hacemos una llamada a la API de TMDB para obtener los episodios de la primera temporada.
    // (Esto es un ejemplo simplificado, lo ideal es iterar sobre todas las temporadas)
    const seasonRes = await kino.fetch(`https://api.themoviedb.org/3/tv/${id}/season/1?api_key=TU_API_KEY&language=es-ES`);
    // ... (lógica para procesar episodios) ...
    
    // Como no tenemos una API de episodios directa, devolvemos un arreglo vacío por ahora
    // para evitar que la app se rompa. Deberías implementar esta parte si la API de MoviePlus tiene los episodios.
    return { series: { title: tmdb.name, overview: tmdb.overview }, episodes: [] };

  } catch (e) {
    return { series: {}, episodes: [] };
  }
}

// 9. REPRODUCCIÓN
export async function resolve(ref) {
  const parts = ref.split(':');
  const type = parts[0]; 
  const id = parts[1];
  try {
    const url = `${ADDON_BASE_URL}/addon/links/${type}/${id}.json`;
    const res = await kino.fetch(url);
    if (!res.ok) throw new Error(`No se encontraron enlaces (HTTP ${res.status})`);
    
    const links = await res.json();
    if (!links || links.length === 0) throw new Error("No hay enlaces de Yandex.");
    
    const firstLink = links[0];
    const yandexRes = await kino.fetch(YANDEX_API + encodeURIComponent(firstLink.share));
    if (!yandexRes.ok) throw new Error("Yandex rechazó la solicitud.");
    
    const yandexData = await yandexRes.json();
    if (!yandexData || !yandexData.href) throw new Error("No se pudo obtener el enlace directo.");
    
    return { url: yandexData.href };
  } catch (error) {
    throw new Error(error.message);
  }
}
