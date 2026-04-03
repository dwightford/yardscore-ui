"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export function useGps() {
  const locationRef = useRef<GpsPosition | null>(null);
  const watchRef = useRef<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS not available on this device");
      return;
    }
    if (watchRef.current !== null) return; // already watching
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        locationRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGpsError(null);
      },
      () => setGpsError("Location unavailable"),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
  }, []);

  const stopGps = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopGps, [stopGps]);

  return { locationRef, gpsError, startGps, stopGps };
}
