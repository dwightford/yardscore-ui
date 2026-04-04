"use client";

/**
 * useWalkTrail
 *
 * Records a breadcrumb trail during an active walk by sampling
 * the current GPS position at a regular interval. Now includes
 * altitude for topographic profiling.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import type { GpsPosition } from "./useGps";

export interface TrailPoint {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
}

const SAMPLE_INTERVAL_MS = 3000;
const MIN_MOVE_M = 1.5;

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function useWalkTrail(locationRef: React.RefObject<GpsPosition | null>) {
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef<number | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha != null) headingRef.current = e.alpha;
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  const startRecording = useCallback(() => {
    if (recordingRef.current) return;
    recordingRef.current = true;
    lastPointRef.current = null;

    intervalRef.current = setInterval(() => {
      const loc = locationRef.current;
      if (!loc) return;

      if (lastPointRef.current) {
        const dist = haversineM(lastPointRef.current, loc);
        if (dist < MIN_MOVE_M) return;
      }

      const point: TrailPoint = {
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        heading: headingRef.current,
        altitude: loc.altitude,
        timestamp: Date.now(),
      };

      setTrail((prev) => [...prev, point]);
      lastPointRef.current = { lat: loc.lat, lng: loc.lng };
    }, SAMPLE_INTERVAL_MS);
  }, [locationRef]);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const clearTrail = useCallback(() => {
    setTrail([]);
    lastPointRef.current = null;
  }, []);

  useEffect(() => stopRecording, [stopRecording]);

  return { trail, startRecording, stopRecording, clearTrail };
}
