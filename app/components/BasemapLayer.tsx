"use client";

import {
  createElementObject,
  createTileLayerComponent,
  type LayerProps,
} from "@react-leaflet/core";
import L from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import { OPENFREEMAP_DARK_STYLE } from "@/app/lib/mapTiles";

export interface BasemapLayerProps extends LayerProps {
  attribution: string;
}

/**
 * Dark OSM basemap via OpenFreeMap + MapLibre, hosted in Leaflet's tile pane
 * so markers, routes, and clusters stay on top.
 */
type BasemapGlOptions = L.LeafletMaplibreGLOptions & {
  attribution: string;
  pane: string;
};

export const BasemapLayer = createTileLayerComponent<
  L.MaplibreGL,
  BasemapLayerProps
>(function createBasemapLayer({ attribution }, context) {
  const layer = maplibreGL({
    style: OPENFREEMAP_DARK_STYLE,
    attribution,
    attributionControl: { customAttribution: attribution },
    interactive: false,
    pane: "tilePane",
  } as BasemapGlOptions);
  return createElementObject(layer, context);
});
