import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { formatDayTime, formatHours } from '../../lib/format'
import { STOP_META } from '../../lib/status'
import type { Stop, StopType, TripPlan } from '../../lib/types'

const US_CENTER: LatLngExpression = [39.5, -98.35]
// Keyless raster basemap: quiet gray, so the route and stops carry the color.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'

const MAJOR = new Set<StopType>(['start', 'pickup', 'dropoff'])

// Leaflet markers take HTML strings. Render each glyph's SVG once, up front, with the
// client renderer we already ship (react-dom/server would add ~40 kB gzip for this).
const GLYPHS = (() => {
  const el = document.createElement('div')
  const root = createRoot(el)
  const glyphs = {} as Record<StopType, string>
  for (const type of Object.keys(STOP_META) as StopType[]) {
    const Icon = STOP_META[type].icon
    flushSync(() => root.render(<Icon size={MAJOR.has(type) ? 17 : 13} strokeWidth={2.4} color="white" aria-hidden />))
    glyphs[type] = el.innerHTML
  }
  root.unmount()
  return glyphs
})()

const iconCache = new Map<string, L.DivIcon>()

function stopIcon(type: StopType, active: boolean): L.DivIcon {
  const key = `${type}-${active}`
  const cached = iconCache.get(key)
  if (cached) return cached
  const size = (MAJOR.has(type) ? 34 : 26) + (active ? 8 : 0)
  const html = `<div class="trip-marker" data-active="${active}" style="width:${size}px;height:${size}px;background:${STOP_META[type].color}">${GLYPHS[type]}</div>`
  const icon = L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
  iconCache.set(key, icon)
  return icon
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (!bounds) return
    // The map narrows when the itinerary column appears; re-measure before fitting.
    map.invalidateSize({ animate: false })
    // No animation: an interrupted zoom animation (e.g. a second fit while the first is
    // running) leaves Leaflet's vector layer drawn at the old scale.
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 11, animate: false })
  }, [map, bounds])
  return null
}

/** Leaflet only measures its container on load; keep it in sync with layout changes. */
function TrackContainerSize() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

type Props = {
  plan: TripPlan | undefined
  activeStopId: string | null
  onStopHover: (id: string | null) => void
}

export function RouteMap({ plan, activeStopId, onStopHover }: Props) {
  const line = useMemo<LatLngExpression[]>(
    () => plan?.route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [],
    [plan],
  )
  const bounds = useMemo<LatLngBoundsExpression | null>(
    () => (line.length > 1 ? L.latLngBounds(line as L.LatLngTuple[]) : null),
    [line],
  )
  const timeZone = plan?.summary.timezone ?? 'UTC'
  // Draw minor stops first so start/pickup/dropoff sit on top.
  const stops = useMemo(
    () => [...(plan?.stops ?? [])].sort((a, b) => Number(MAJOR.has(a.type)) - Number(MAJOR.has(b.type))),
    [plan],
  )

  return (
    <MapContainer
      center={US_CENTER}
      zoom={4}
      minZoom={3}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url={`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`}
        maxZoom={16}
        className="base-tiles"
      />
      <TileLayer url={`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`} maxZoom={16} />
      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
          <Polyline positions={line} pathOptions={{ color: '#ea580c', weight: 4.5, opacity: 0.95 }} />
        </>
      )}
      {stops.map((stop) => (
        <StopMarker
          key={stop.id}
          stop={stop}
          active={stop.id === activeStopId}
          timeZone={timeZone}
          onHover={onStopHover}
        />
      ))}
      <TrackContainerSize />
      <FitBounds bounds={bounds} />
    </MapContainer>
  )
}

function StopMarker({
  stop,
  active,
  timeZone,
  onHover,
}: {
  stop: Stop
  active: boolean
  timeZone: string
  onHover: (id: string | null) => void
}) {
  const meta = STOP_META[stop.type]
  return (
    <Marker
      position={[stop.lat, stop.lng]}
      icon={stopIcon(stop.type, active)}
      zIndexOffset={active ? 1000 : 0}
      eventHandlers={{ mouseover: () => onHover(stop.id), mouseout: () => onHover(null) }}
      title={`${meta.label}: ${stop.label}`}
    >
      <Popup>
        <div className="min-w-44 font-sans">
          <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: meta.color }}>
            {meta.label}
          </p>
          <p className="text-sm font-semibold text-ink">{stop.label}</p>
          <p className="mt-1 text-xs text-muted">
            {stop.type === 'start' ? (
              <>Depart {formatDayTime(stop.depart_at, timeZone)}</>
            ) : (
              <>
                {formatDayTime(stop.arrive_at, timeZone)} → {formatDayTime(stop.depart_at, timeZone)}
                <br />
                {formatHours(stop.duration_hrs)} · mile {Math.round(stop.odometer_mi).toLocaleString()}
              </>
            )}
          </p>
        </div>
      </Popup>
    </Marker>
  )
}
