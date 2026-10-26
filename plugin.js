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

function formatItem(item) {
  const realId = item.id ? item.id.toString() : item.row.toString(); 
  return {
    id: realId,
    title: item.name || "Sin título",
    poster: item.image_path ? `https://image.tmdb.org/t/p/w500${item.image_path}` : "",
    kind: item.kind || "movie",
    ref: `${item.kind || "movie"}:${realId}`
  };
}

function filterCatalog(catalog, filterType) {
  // Un anime suele tener "JPN" en resoluciones o "animación" en el género
  const isAnime = i => {
    const res = (i.resolutions || "").toUpperCase();
    const gen = (i.genres || "").toLowerCase();
    return res.includes('JPN') || gen.includes('anime') || gen.includes('animación');
  };
  
  const isSub = i => (i.resolutions || "").toUpperCase().includes('SUB') || (i.resolutions || "").toUpperCase().includes('JPN');
  const isLat = i => (i.resolutions || "").toUpperCase().includes('LAT') || (i.resolutions || "").toUpperCase().includes('DUAL');

  switch(filterType) {
    case "anime_sub": return catalog.filter(i => isAnime(i) && isSub(i));
    case "anime_lat": return catalog.filter(i => isAnime(i) && isLat(i));
    case "latino": return catalog.filter(i => isLat(i) && !isAnime(i)); 
    case "subtitulado": return catalog.filter(i => isSub(i) && !isAnime(i));
    case "movies": return catalog.filter(i => i.kind === 'movie' && !isAnime(i));
    case "series": return catalog.filter(i => i.kind === 'series' && !isAnime(i));
    default: return catalog;
  }
}

export async function home() {
  try {
    const catalog = await getCatalog();
    const rows = [];
    const configuracionFilas = [
      { id: "anime_sub", title: "Animes Subtitulados", ref: "anime_sub" },
      { id: "anime_lat", title: "Animes en Latino", ref: "anime_lat" },
      { id: "latino", title: "Películas y Series en Latino", ref: "latino" },
      { id: "subtitulado", title: "Películas y Series Subtituladas", ref: "subtitulado" },
      { id: "movies", title: "Películas Recientes", ref: "movies" },
      { id: "series", title: "Series Recientes", ref: "series" }
    ];

    for (const config of configuracionFilas) {
      const resultados = filterCatalog(catalog, config.ref);
      if (resultados.length > 0) {
        rows.push({
          id: config.id,
          title: config.title,
          ref: config.ref,
          items: resultados.slice(0, 20).map(formatItem)
        });
      }
    }
    return rows;
  } catch (error) {
    return [{ id: "error", title: "❌ Error: " + error.message, items: [] }];
  }
}

export async function browse(ref, cursor) {
  const catalog = await getCatalog();
  const itemsSource = filterCatalog(catalog, ref);
  const limit = 30;
  const start = cursor ? parseInt(cursor) : 0;
  const end = start + limit;
  const items = itemsSource.slice(start, end).map(formatItem);
  const nextCursor = end < itemsSource.length ? end.toString() : null;
  return { items, next: nextCursor };
}

export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

export async function details(ref) {
  const apiKey = kino.settings.get("tmdb_api_key");
  if (!apiKey) return { overview: "⚠️ Ve a los ajustes de Kino y configura tu API Key de TMDB para ver la sinopsis." };

  const parts = ref.split(':');
  const type = parts[0]; 
  const id = parts[1];

  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&language=es-ES`;
    const res = await kino.fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    return { overview: data.overview || "Sin sinopsis disponible." };
  } catch (error) {
    return {};
  }
}

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
