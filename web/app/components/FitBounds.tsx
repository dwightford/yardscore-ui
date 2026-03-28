"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export default function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (bounds.length > 1) {
      const leafletBounds = L.latLngBounds(
        bounds.map(([lat, lng]) => L.latLng(lat, lng))
      );
      map.fitBounds(leafletBounds, { padding: [30, 30], maxZoom: 20 });
    }
  }, [map, bounds]);

  return null;
}
