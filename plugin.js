// plugin.js - CATALOG//NET (Versión definitiva con diagnóstico)

const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";

// ⚠️ IMPORTANTE: Asegúrate de que estos nombres coincidan EXACTAMENTE con los de tu GitHub.
// Si la herramienta los llamó distinto, cámbialos aquí.
const ARCHIVOS = [
  "catalogo_completo_1.json",
  "catalogo_completo_2.json",
  "catalogo_completo_3.json",
  "catalogo_completo_4.json" 
];

let memoryCache = null;

async function getCatalog() {
  if (memoryCache) return memoryCache;
  
  let catalogoCompleto = [];
  let errores = [];

  // Descargamos los archivos uno por uno para saber exactamente cuál falla si hay un error
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
  
  // Si no se descargó nada de nada, lanzamos el error
  if (catalogoCompleto.length === 0) {
    throw new Error("No se pudo cargar ningún archivo. Revisa: " + errores.join(", "));
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
  try {
    const catalog = await getCatalog();
    
    // FILA DE DIAGNÓSTICO (Te dirá cuántos títulos cargó)
    const rows = [{
      id: "status",
      title: `✅ Catálogo cargado: ${catalog.length} títulos`,
      items: catalog.slice(0, 10).map(formatItem)
    }];

    const movies = catalog.filter(i => i.kind === 'movie');
    const series = catalog.filter(i => i.kind === 'series');

    if (movies.length > 0) {
      rows.push({ id: "movies", title: "Películas", items: movies.slice(0, 30).map(formatItem) });
    }

    return rows;

  } catch (error) {
    kino.log("ERROR EN HOME:", error.message);
    // Si falla, mostramos el error exacto en pantalla
    return [{
      id: "error",
      title: "❌ Error: " + error.message,
      items: [{
        id: "err", title: "Revisa el nombre de los archivos en GitHub", poster: "", kind: "movie", ref: "movie:err"
      }]
    }];
  }
}

export async function search(query) {
  const catalog = await getCatalog();
  const q = query.q.toLowerCase();
  return catalog.filter(item => item.name && item.name.toLowerCase().includes(q)).slice(0, 50).map(formatItem);
}

export async function browse(ref) { return { items: [], next: null }; }

export async function resolve(ref) {
  const parts = ref.split(':');
  const id = parts[1]; 
  const catalog = await getCatalog();
  const item = catalog.find(i => (i.row && i.row.toString() === id) || (i.id && i.id.toString() === id));
  
  if (!item || !item.files) throw new Error("No hay enlaces de video.");
  const validFile = item.files.find(f => f.plain);
  if (!validFile) throw new Error("Enlace no disponible.");
  
  return { url: validFile.plain };
}
