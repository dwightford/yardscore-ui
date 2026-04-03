# Walk HUD Test Script

Run from `/web`:
```
npm install && npm run dev
```

Open `http://localhost:3000/walk` on your phone (or Chrome DevTools mobile emulation).

---

## A. Demo Mode (unauthenticated)

Skip login — just go to `/walk`.

| # | Action | Expected |
|---|--------|----------|
| 1 | Page loads | Dark camera-first shell. Strip says "Good time to record afternoon light." Bottom rail: Walk (pulsing green dot), Identify, Anchor, Mark Area, Light, More. |
| 2 | Tap **Walk** | Panel slides up (spring animation). Shows "Walk in progress" with live timer, counts: 2 reference points, 1 plant, 1 area. "Finish Walk" button. |
| 3 | Close panel (tap backdrop or ✕) | Panel slides down. |
| 4 | Tap **Anchor** | Panel slides up: "Add Reference Point." 7 anchor types in 2-column grid. |
| 5 | Pick "Big tree", tap **Save Reference Point** | Panel closes. Strip flashes "Anchor saved..." (amber, 3s), then returns to contextual suggestion. Badge count increments. |
| 6 | Tap **Identify** | Panel: "Identify a Plant." No "Identify from Camera" button (camera not live in demo). Type picker + label input + "Note This Plant." |
| 7 | Pick "Shrub", type "azalea by deck", tap **Note This Plant** | Panel closes. Strip flashes "Noted. Keep walking..." (green, 3s). |
| 8 | Tap **Mark Area** | Panel: "Mark an Area." 7 area types. |
| 9 | Pick "Mulch bed", tap **Mark This Area** | Panel closes. Strip flashes "Area marked." (lime, 3s). |
| 10 | Tap **Light** | Panel: "Record Light." Sun exposure pills + sky condition pills. |
| 11 | Pick "full shade" + "overcast", tap **Record Light** | Panel closes. Strip stops suggesting light (shows "Walk in progress"). |
| 12 | Tap **More** | Panel: 6 action buttons with icons (Property, Dashboard, Scan plants, Identify, Map, Help). |
| 13 | Tap **Walk** again, then **Finish Walk** | Walk review slides up: stats (duration, distance --, counts), narrative text, "Start Another Walk" button. No trail map (no GPS in demo). |
| 14 | Tap **Start Another Walk** | Review dismisses. Walk restarts. Counts reset to 0. |

---

## B. Live Mode (authenticated)

Log in first at `/login`, then go to `/walk`.

| # | Action | Expected |
|---|--------|----------|
| 1 | Page loads | Loading spinner briefly, then shell appears with your property name in the strip. If you have >1 property, full-screen selector shown first. |
| 2 | Strip shows | "Start at your front door..." (no_walk state). Existing anchor/subject badges may appear top-right if property has prior data. |
| 3 | Tap **Walk** → **Start Walk** | Walk starts. Check: GPS permission prompt appears (allow it). Strip → "Walk in progress." Camera attempts to start (allow camera if prompted). "Recording" pulse indicator top-left. |
| 4 | Walk around for ~15s | Breadcrumb trail dots appear bottom-left (count incrementing every 3s if you move >1.5m). |
| 5 | Tap **Anchor** → pick type → **Save Reference Point** | Network tab: POST to `/land_units/{id}/anchors`. Amber badge appears top-right on camera overlay. Strip flashes "Anchor saved." |
| 6 | Tap **Identify** | "Identify from Camera" button visible (camera is live). Tap it → captures frame → sends to `/plantnet-proxy` → shows species result (name, family, confidence) or "Could not identify" if too dark. |
| 7 | Type a label or accept the auto-filled one, tap **Note This Plant** | POST to `/land_units/{id}/subjects`. Green badge on overlay. |
| 8 | Tap **Mark Area** → pick type → **Mark This Area** | POST to `/land_units/{id}/patches`. Lime badge on overlay. |
| 9 | Tap **Light** → pick exposure + sky → **Record Light** | POST to `/light-observations`. Yellow "Light recorded" badge. Strip stops suggesting light. |
| 10 | Tap **Walk** → **Finish Walk** | POST to `/field/walk-sessions/{id}/end`. Review slides up with: trail map (green polyline), start/end dots, anchor/subject/area pins, stats, distance in ft, narrative. |
| 11 | Tap **View Property** | Navigates to `/property/{id}` (structure browser). |
| 12 | Go back to `/walk` | Active walk detection: if walk was not ended, it resumes automatically (GPS restarts, counts hydrated from server). |

---

## C. Edge Cases

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Deny camera permission | Dark placeholder with "Camera access needed" message + instructions. Everything else works (just no live view or plant ID from camera). |
| 2 | Deny GPS permission | Yellow warning under strip: "Location unavailable — points will be saved without coordinates." Walk still works. Saves send null coords. |
| 3 | API down / network error | Red error toast appears under strip, auto-dismisses after 4s. Action does NOT complete (panel stays open so user can retry). |
| 4 | Multiple properties | Full-screen property selector on first load. Compact dropdown top-right after selection. Switching reloads the shell with new land unit. |
| 5 | End walk with 0 items | Review shows: narrative "You completed a walk. Next time, try marking some plants..." |
| 6 | PlantNet returns no match | Identify panel shows "Could not identify — try a closer shot" in amber text. |
| 7 | Navigate away during walk, come back | Walk resumes from server state. Counts hydrated. GPS + trail restart. |

---

## D. Quick Smoke (DevTools Console)

Open console on `/walk` in demo mode and verify no errors on:
```
1. Page load
2. Open each panel (walk, identify, anchor, area, light, more)
3. Close each panel
4. End walk → review appears
5. Dismiss review
```

Warnings about `leaflet` CSS or `next/dynamic` are fine. Red errors are not.

---

## E. Dark/Night Testing Notes

Camera feed will be very dark — that's expected. PlantNet ID will likely fail (too dark for recognition) — the "Could not identify" fallback should appear. GPS should still work fine indoors/outdoors. Trail recording works regardless of light. All panel interactions are independent of camera quality.
