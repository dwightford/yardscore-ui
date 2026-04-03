/**
 * Field Mapper API client.
 *
 * Thin async wrappers for walk-session, anchor, subject, patch,
 * and light-observation endpoints. Used by FieldMapperShell in
 * authenticated (live) mode.
 */

import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WalkSession {
  id: string;
  status: string;
  started_at: string;
}

export interface Anchor {
  id: string;
  anchor_type: string;
  label: string;
  confidence: number;
}

export interface Subject {
  id: string;
  subject_type: string;
  label?: string | null;
}

export interface Patch {
  id: string;
  patch_type: string;
  label?: string | null;
}

// ── Walk sessions ────────────────────────────────────────────────────────────

export async function startWalk(
  token: string,
  landUnitId: string,
): Promise<WalkSession> {
  const res = await apiFetch(token, `${API}/field/walk-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ land_unit_id: landUnitId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function endWalk(
  token: string,
  walkSessionId: string,
): Promise<void> {
  const res = await apiFetch(
    token,
    `${API}/field/walk-sessions/${walkSessionId}/end`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchActiveWalk(
  token: string,
  landUnitId: string,
): Promise<WalkSession | null> {
  const res = await apiFetch(
    token,
    `${API}/land_units/${landUnitId}/walk-sessions`,
  );
  if (!res.ok) return null;
  const walks: WalkSession[] = await res.json();
  return walks.find((w) => w.status === "active") ?? null;
}

// ── Property memory (for hydrating counts + badge data) ─────────────────────

export type MemoryStage = "unstarted" | "walked_no_origin" | "origin_only" | "forming" | "established";

export interface PropertyMemorySummary {
  memory_stage: MemoryStage;
  prompt: string;
  anchor_count: number;
  anchors: Array<{
    id: string;
    anchor_type: string;
    label: string;
    device_lat?: number | null;
    device_lng?: number | null;
  }>;
  walk_sessions_completed: number;
  subjects: { total: number; trees: number; shrubs: number };
  patches: { total: number };
}

export async function fetchPropertyMemory(
  token: string,
  landUnitId: string,
): Promise<PropertyMemorySummary | null> {
  const res = await apiFetch(
    token,
    `${API}/land_units/${landUnitId}/memory`,
  );
  if (!res.ok) return null;
  return res.json();
}

export interface SubjectEntry {
  id: string;
  subject_type: string;
  label?: string | null;
  device_lat?: number | null;
  device_lng?: number | null;
}

export interface PatchEntry {
  id: string;
  patch_type: string;
  label?: string | null;
  device_lat?: number | null;
  device_lng?: number | null;
}

export async function fetchSubjects(
  token: string,
  landUnitId: string,
): Promise<SubjectEntry[]> {
  const res = await apiFetch(token, `${API}/land_units/${landUnitId}/subjects`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPatches(
  token: string,
  landUnitId: string,
): Promise<PatchEntry[]> {
  const res = await apiFetch(token, `${API}/land_units/${landUnitId}/patches`);
  if (!res.ok) return [];
  return res.json();
}

// ── Anchors ──────────────────────────────────────────────────────────────────

export async function saveAnchor(
  token: string,
  landUnitId: string,
  data: {
    anchor_type: string;
    label: string;
    device_lat: number | null;
    device_lng: number | null;
    accuracy_m: number | null;
    walk_session_id?: string;
  },
): Promise<Anchor> {
  const res = await apiFetch(
    token,
    `${API}/land_units/${landUnitId}/anchors`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Subjects ─────────────────────────────────────────────────────────────────

export async function saveSubject(
  token: string,
  landUnitId: string,
  data: {
    subject_type: string;
    label: string | null;
    device_lat: number | null;
    device_lng: number | null;
    accuracy_m: number | null;
    walk_session_id?: string;
  },
): Promise<Subject> {
  const res = await apiFetch(
    token,
    `${API}/land_units/${landUnitId}/subjects`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Patches ──────────────────────────────────────────────────────────────────

export async function savePatch(
  token: string,
  landUnitId: string,
  data: {
    patch_type: string;
    label: string | null;
    device_lat: number | null;
    device_lng: number | null;
    accuracy_m: number | null;
    walk_session_id?: string;
  },
): Promise<Patch> {
  const res = await apiFetch(
    token,
    `${API}/land_units/${landUnitId}/patches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Light observations ───────────────────────────────────────────────────────

/** Map user-facing direction labels to API time_bucket + light_level. */
function mapDirection(dir: string): { time_bucket: string; light_level: string } {
  const hour = new Date().getHours();
  const autoTimeBucket =
    hour < 10 ? "morning" : hour < 14 ? "midday" : hour < 17 ? "afternoon" : "dusk";

  switch (dir) {
    case "morning sun":
      return { time_bucket: "morning", light_level: "full_sun" };
    case "afternoon sun":
      return { time_bucket: "afternoon", light_level: "full_sun" };
    case "full day":
      return { time_bucket: "midday", light_level: "full_sun" };
    case "mostly shade":
      return { time_bucket: autoTimeBucket, light_level: "part_shade" };
    case "full shade":
      return { time_bucket: autoTimeBucket, light_level: "full_shade" };
    default:
      return { time_bucket: autoTimeBucket, light_level: "part_sun" };
  }
}

/** Map user-facing sky condition to API cloud_cover. */
function mapCloudCover(cond: string): string {
  switch (cond) {
    case "partly cloudy":
      return "partly_cloudy";
    case "overcast":
      return "overcast";
    default:
      return "clear";
  }
}

export async function saveLight(
  token: string,
  opts: {
    land_unit_id: string;
    direction: string;
    condition: string;
    lat: number | null;
    lng: number | null;
  },
): Promise<void> {
  const { time_bucket, light_level } = mapDirection(opts.direction);
  const cloud_cover = mapCloudCover(opts.condition);

  const res = await apiFetch(token, `${API}/light-observations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      land_unit_id: opts.land_unit_id,
      time_bucket,
      light_level,
      cloud_cover,
      device_lat: opts.lat,
      device_lng: opts.lng,
      confidence: 0.8,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Readiness ────────────────────────────────────────────────────────────────

export interface NextObservation {
  observation_type: string;
  description: string;
  impact: string;
}

export async function fetchNextObservation(
  token: string,
  landUnitId: string,
): Promise<NextObservation | null> {
  const res = await apiFetch(
    token,
    `${API}/land_units/${landUnitId}/readiness/next`,
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Breadcrumbs ─────────────────────────────────────────────────────────────

export interface BreadcrumbPoint {
  seq: number;
  device_lat: number | null;
  device_lng: number | null;
  heading_degrees: number | null;
  accuracy_m: number | null;
  movement_confidence: number;
}

export async function postBreadcrumbs(
  token: string,
  walkSessionId: string,
  points: BreadcrumbPoint[],
): Promise<{ appended: number }> {
  if (points.length === 0) return { appended: 0 };
  const res = await apiFetch(
    token,
    `${API}/field/walk-sessions/${walkSessionId}/breadcrumbs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Weather ─────────────────────────────────────────────────────────────────

export interface WeatherConditions {
  station_id: string;
  description: string;
  temperature_c: number | null;
  wind_speed_kmh: number | null;
  humidity_pct: number | null;
  cloud_cover: "clear" | "partly_cloudy" | "overcast" | "precipitation" | "unknown";
  observed_at: string | null;
}

export async function fetchWeather(
  token: string,
  landUnitId: string,
): Promise<WeatherConditions | null> {
  const res = await apiFetch(
    token,
    `${API}/land_units/${landUnitId}/weather`,
  );
  if (!res.ok) return null;
  return res.json();
}

/** Returns true if conditions are suitable for a light observation. */
export function isGoodLightConditions(weather: WeatherConditions | null): boolean {
  if (!weather) return true; // no data = don't suppress
  return weather.cloud_cover === "clear" || weather.cloud_cover === "partly_cloudy";
}

// ── Plant identification (PlantNet proxy) ────────────────────────────────────

export interface PlantIdResult {
  scientificName: string;
  commonName: string;
  family: string;
  confidence: number;
}

export async function identifyPlant(
  imageBlob: Blob,
): Promise<PlantIdResult | null> {
  const form = new FormData();
  form.append("file", imageBlob, "capture.jpg");

  const res = await fetch("/plantnet-proxy", {
    method: "POST",
    body: form,
  });
  if (!res.ok) return null;

  const data = await res.json();
  const best = data.results?.[0];
  if (!best) return null;

  return {
    scientificName: best.species?.scientificNameWithoutAuthor ?? "Unknown",
    commonName: best.species?.commonNames?.[0] ?? "",
    family: best.species?.family?.scientificNameWithoutAuthor ?? "",
    confidence: best.score ?? 0,
  };
}
