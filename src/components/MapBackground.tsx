import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Coordinates: Qinghai, China — fits BF4 CN military aesthetic
const CENTER: [number, number] = [35.53438027878519, 93.93108608227209]

// ESRI World Imagery — satellite tiles, no labels, no API key needed
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

// CSS filter chain: full-colour satellite → distinct BF4 blue tint
//   sepia   → unifies all tones into warm brown first
//   hue-rotate → rotates brown family → blue family (~220°)
//   saturate    → amplifies the resulting blue
//   brightness  → darken to match the gloomy BF4 palette
//   contrast    → punch up terrain detail
const MAP_FILTER =
  'sepia(1) hue-rotate(185deg) saturate(3.5) brightness(0.48) contrast(1.20)'

interface Props {
  width:  number
  height: number
  zoom:   number
}

export default function MapBackground({ width, height, zoom }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:           CENTER,
      zoom,
      zoomControl:      false,
      attributionControl: false,
      dragging:         false,
      scrollWheelZoom:  false,
      doubleClickZoom:  false,
      touchZoom:        false,
      keyboard:         false,
      boxZoom:          false,
      tap:              false,
    })

    L.tileLayer(TILE_URL, { maxZoom: 19, maxNativeZoom: 18 }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Keep map sized correctly if dimensions change
  useEffect(() => {
    mapRef.current?.invalidateSize()
  }, [width, height])

  return (
    <div
      ref={containerRef}
      style={{
        position:      'absolute',
        top:           0,
        left:          0,
        width,
        height,
        filter:        MAP_FILTER,
        pointerEvents: 'none',   // let Konva clicks pass through
        zIndex:        0,
        overflow:      'hidden',
      }}
    />
  )
}
