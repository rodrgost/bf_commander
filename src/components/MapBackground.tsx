import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Coordinates: Qinghai, China — fits BF4 CN military aesthetic
const CENTER: [number, number] = [35.53438027878519, 93.93108608227209]

// Zoom 16 ≈ 3.5 km wide at this latitude — good squad/infantry scale
const ZOOM = 16

// ESRI World Imagery — satellite tiles, no labels, no API key needed
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

// CSS filter chain that converts full-colour satellite → dark BF4 blue-grey:
//   1. saturate low  → drain colour
//   2. brightness    → darken overall
//   3. hue-rotate    → push remaining tones toward blue
//   4. contrast      → sharpen terrain detail
const MAP_FILTER =
  'saturate(0.22) brightness(0.52) hue-rotate(188deg) contrast(1.18)'

interface Props {
  width:  number
  height: number
}

export default function MapBackground({ width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:           CENTER,
      zoom:             ZOOM,
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
