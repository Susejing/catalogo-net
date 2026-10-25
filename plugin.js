const BASE_URL = "https://raw.githubusercontent.com/Susejing/catalogo-net/main/";
const ARCHIVO_PRUEBA = "catalogo_completo.001.json"; // Solo cargaremos este para probar

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

  // FILA 1: PRUEBA FORZADA (Si esto no sale, el error está en kino-plugin.json)
  rows.push({
    id: "test-1",
    title: "✅ PRUEBA: El plugin responde",
    items: [{
      id: "t1",
      title: "Si ves esto, la app sí lee el código",
      poster: "https://image.tmdb.org/t/p/w500/9EpOhoSZApJEojx3L3hwr3V3CWd.jpg",
      kind: "movie",
      ref: "movie:t1"
    }]
  });

  // FILA 2: INTENTO DE CARGAR TU ARCHIVO 1
  try {
    const res = await kino.fetch(BASE_URL + ARCHIVO_PRUEBA);
    if (!res.ok) throw new Error("Error HTTP " + res.status);
    
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("El archivo no es una lista válida");

    rows.push({
      id: "parte-1",
      title: `✅ Archivo 1 cargado (${data.length} títulos)`,
      items: data.slice(0, 20).map(formatItem)
    });

  } catch (error) {
    rows.push({
      id: "error-1",
      title: "❌ Error al cargar el archivo",
      items: [{
        id: "err1", title: error.message, poster: "", kind: "movie", ref: "movie:err1"
      }]
    });
  }

  return rows;
}

export async function search(query) {
  return []; // Desactivado por ahora para no saturar
}

export async function browse() { return { items: [], next: null }; }

export async function resolve(ref) {
  throw new Error("No hay enlaces de video en los datos extraídos.");
}
