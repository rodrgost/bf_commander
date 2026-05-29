import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ESRI World Imagery — satellite tiles, no labels, no API key needed
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const MAP_FILTER =
  'sepia(1) hue-rotate(185deg) saturate(3.5) brightness(0.48) contrast(1.20)'

interface Props {
  width:   number
  height:  number
  center:  [number, number]   // [lat, lng] — updated when the viewport pans/zooms
  zoom:    number             // continuous Leaflet zoom (e.g. 14.7)
}

export default function MapBackground({ width, height, center, zoom }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)

  // Initialise Leaflet once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl:       false,
      attributionControl: false,
      dragging:          false,
      scrollWheelZoom:   false,
      doubleClickZoom:   false,
      touchZoom:         false,
      keyboard:          false,
      boxZoom:           false,
      tap:               false,
    })

    L.tileLayer(TILE_URL, { maxZoom: 19, maxNativeZoom: 18 }).addTo(map)
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync view whenever center or zoom changes (driven by scroll zoom in GameCanvas)
  useEffect(() => {
    mapRef.current?.setView(center, zoom, { animate: false })
  }, [center[0], center[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { mapRef.current?.invalidateSize() }, [width, height])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width, height,
        filter: MAP_FILTER,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    />
  )
}
