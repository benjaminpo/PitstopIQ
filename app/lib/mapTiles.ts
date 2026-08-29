/**
 * Production basemap. CARTO's free raster tiles stamp an "API key required"
 * watermark, so we render OpenFreeMap's dark vector style instead (OSM data,
 * no key, no watermark).
 */
export const OPENFREEMAP_DARK_STYLE =
  "https://tiles.openfreemap.org/styles/dark";

/**
 * Leaflet used to inherit this from CARTO's raster TileLayer. MapLibre is not
 * a GridLayer, so MarkerClusterGroup throws "Map has no maxZoom specified"
 * unless the map sets it. OpenFreeMap source data stops at z14; MapLibre
 * overzooms cleanly through 18.
 */
export const MAP_MAX_ZOOM = 18;

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OPENFREEMAP_ATTR =
  '<a href="https://openfreemap.org">OpenFreeMap</a>';

export const BASEMAP_ATTRIBUTION = `${OSM_ATTR} · ${OPENFREEMAP_ATTR}`;

export const PLANNER_BASEMAP_ATTRIBUTION = `${BASEMAP_ATTRIBUTION} · Routing © <a href="https://project-osrm.org">OSRM</a> / <a href="https://github.com/valhalla/valhalla">Valhalla</a>`;
