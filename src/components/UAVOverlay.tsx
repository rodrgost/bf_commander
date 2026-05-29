import { useEffect, useState } from 'react'

// ── UAV / surveillance-camera overlay ────────────────────────────────────────
// Layered purely with CSS + SVG — no extra dependencies.
// pointer-events:none on every element so Konva clicks pass through.

interface Props {
  width:  number
  height: number
}

const LAT  = 35.53438027878519
const LON  = 93.93108608227209
const C    = '#00C8FF'        // BF4 blue
const CDIM = '#1a4a5a'
const mono = "'Courier New', Courier, monospace"

function pad(n: number, d = 2) { return String(Math.floor(n)).padStart(d, '0') }

function formatDMS(deg: number, isLat: boolean) {
  const d = Math.abs(deg)
  const dd = Math.floor(d)
  const mm = Math.floor((d - dd) * 60)
  const ss = ((d - dd) * 3600 - mm * 60).toFixed(1)
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W')
  return `${pad(dd)}°${pad(mm)}'${ss}"${dir}`
}

function nowString() {
  const n = new Date()
  return `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`
}

export default function UAVOverlay({ width, height }: Props) {
  const [time, setTime] = useState(nowString)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setTime(nowString())
      setFrame(f => f + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Slow-drift values (simulates UAV holding station)
  const altJitter = (Math.sin(frame * 0.3) * 8).toFixed(0)
  const alt = 3184 + Number(altJitter)
  const hdg = (187 + Math.sin(frame * 0.07) * 2).toFixed(1)
  const signalBars = 4 + (frame % 5 === 0 ? -1 : 0)   // drops a bar every 5s
  const recBlink = frame % 2 === 0

  const text = {
    fontSize: 9,
    fontFamily: mono,
    color: C,
    letterSpacing: '0.5px',
    lineHeight: '1.6',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
  }
  const dimText = { ...text, color: CDIM }

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width, height,
      pointerEvents: 'none', zIndex: 2, overflow: 'hidden',
    }}>

      {/* ── Keyframe definitions ── */}
      <style>{`
        @keyframes uav-flicker {
          0%,100% { opacity:1 }
          92%      { opacity:1 }
          93%      { opacity:0.82 }
          94%      { opacity:1 }
          97%      { opacity:0.88 }
          98%      { opacity:1 }
        }
        @keyframes uav-scanmove {
          from { background-position: 0 0 }
          to   { background-position: 0 4px }
        }
        @keyframes uav-glitch {
          0%,90%,100% { transform:translateX(0); opacity:1 }
          91%          { transform:translateX(-3px); opacity:0.7 }
          92%          { transform:translateX(3px);  opacity:0.9 }
          93%          { transform:translateX(0);    opacity:1 }
        }
        @keyframes uav-noisemove {
          0%   { transform:translate(0,0) }
          25%  { transform:translate(-5%,-5%) }
          50%  { transform:translate(5%,0) }
          75%  { transform:translate(0,5%) }
          100% { transform:translate(-5%,-5%) }
        }
      `}</style>

      {/* ── SVG noise filter definition ── */}
      <svg style={{ position:'absolute', width:0, height:0 }}>
        <defs>
          <filter id="uav-noise-filter" x="0" y="0" width="100%" height="100%"
            colorInterpolationFilters="linearRGB">
            <feTurbulence
              type="fractalNoise" baseFrequency="0.80" numOctaves="4"
              seed="5" stitchTiles="stitch" result="noiseOut"
            />
            <feColorMatrix type="saturate" values="0" in="noiseOut" result="grayNoise"/>
            <feComponentTransfer in="grayNoise" result="dimNoise">
              <feFuncA type="linear" slope="0.055" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="dimNoise" mode="overlay" />
          </filter>
        </defs>
      </svg>

      {/* ── Whole-frame flickering shell ── */}
      <div style={{
        position:'absolute', inset:0,
        animation:'uav-flicker 7s infinite, uav-glitch 11s infinite',
      }}>

        {/* ── Scanlines ── */}
        <div style={{
          position:'absolute', inset:0,
          background:`repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0.10) 0px,
            rgba(0,0,0,0.10) 1px,
            transparent 1px,
            transparent 3px
          )`,
          animation:'uav-scanmove 0.12s linear infinite',
          mixBlendMode:'multiply',
        }} />

        {/* ── Vignette ── */}
        <div style={{
          position:'absolute', inset:0,
          background:`radial-gradient(ellipse at center,
            transparent 45%,
            rgba(0,5,12,0.55) 100%
          )`,
        }} />

        {/* ── Noise grain layer ── */}
        <div style={{
          position:'absolute',
          top:'-10%', left:'-10%',
          width:'120%', height:'120%',
          filter:'url(#uav-noise-filter)',
          opacity:0.45,
          animation:'uav-noisemove 0.18s steps(1) infinite',
        }} />

        {/* ── Horizontal glitch bar (rare) ── */}
        <div style={{
          position:'absolute',
          top:`${30 + (frame * 7) % 40}%`,
          left:0, width:'100%', height:2,
          background:`rgba(0,200,255,0.06)`,
          mixBlendMode:'screen',
        }} />

      </div>

      {/* ── HUD telemetry — rendered ABOVE glitch so it stays readable ── */}

      {/* Top-left: timestamp + coords */}
      <div style={{
        position:'absolute', top:8, left:10,
        display:'flex', flexDirection:'column', gap:1,
      }}>
        <span style={{ ...text, fontSize:8, color:CDIM }}>
          {new Date().toISOString().slice(0,10)} &nbsp; UTC {time}Z
        </span>
        <span style={text}>{formatDMS(LAT, true)} &nbsp; {formatDMS(LON, false)}</span>
        <span style={{ ...dimText, fontSize:8 }}>
          ALT {alt}m &nbsp; HDG {hdg}°
        </span>
      </div>

      {/* Top-right: signal + REC */}
      <div style={{
        position:'absolute', top:8, right:10,
        display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2,
      }}>
        {/* REC blinking */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{
            ...text, fontSize:8,
            color: recBlink ? '#FF3333' : '#660000',
            transition:'color 0.1s',
          }}>●</span>
          <span style={{ ...text, fontSize:8, color:'#FF3333', letterSpacing:'2px' }}>REC</span>
        </div>
        {/* Signal bars */}
        <div style={{ display:'flex', gap:2, alignItems:'flex-end' }}>
          {[1,2,3,4,5].map(b => (
            <div key={b} style={{
              width:3,
              height: 4 + b * 2,
              background: b <= signalBars ? C : CDIM,
              borderRadius:1,
            }} />
          ))}
        </div>
        <span style={{ ...dimText, fontSize:8 }}>RF &nbsp; 5.8GHz</span>
      </div>

      {/* Bottom-left: platform + mode */}
      <div style={{
        position:'absolute', bottom:8, left:10,
        display:'flex', flexDirection:'column', gap:1,
      }}>
        <span style={{ ...dimText, fontSize:8 }}>MQ-9 REAPER · EO/IR</span>
        <span style={{ ...text, fontSize:8 }}>
          ZOOM 16× &nbsp; FOCUS AUTO
        </span>
      </div>

      {/* Bottom-right: classification + frame counter */}
      <div style={{
        position:'absolute', bottom:8, right:10,
        display:'flex', flexDirection:'column', alignItems:'flex-end', gap:1,
      }}>
        <span style={{ ...text, fontSize:8, color:'#FF9900', letterSpacing:'2px' }}>
          CONFIDENTIAL
        </span>
        <span style={{ ...dimText, fontSize:8 }}>
          FRM {String(frame * 30).padStart(6,'0')}
        </span>
      </div>

      {/* Centre crosshair */}
      <div style={{
        position:'absolute',
        top: height / 2 - 10, left: width / 2 - 10,
        width:20, height:20, pointerEvents:'none',
      }}>
        {/* horizontal arm */}
        <div style={{
          position:'absolute', top:9, left:0,
          width:'100%', height:1,
          background:`linear-gradient(to right, transparent, ${C}66, transparent)`,
        }} />
        {/* vertical arm */}
        <div style={{
          position:'absolute', left:9, top:0,
          height:'100%', width:1,
          background:`linear-gradient(to bottom, transparent, ${C}66, transparent)`,
        }} />
        {/* centre dot */}
        <div style={{
          position:'absolute', top:8, left:8,
          width:3, height:3,
          border:`1px solid ${C}88`,
          borderRadius:'50%',
        }} />
      </div>

      {/* Corner brackets */}
      {([
        { top:0,    left:0,    borderTop:true,  borderLeft:true  },
        { top:0,    right:0,   borderTop:true,  borderRight:true },
        { bottom:0, left:0,    borderBottom:true,borderLeft:true },
        { bottom:0, right:0,   borderBottom:true,borderRight:true },
      ] as const).map((corner, i) => (
        <div key={i} style={{
          position:'absolute',
          ...corner,
          width:22, height:22,
          borderTopWidth:    corner.borderTop    ? 1.5 : 0,
          borderLeftWidth:   corner.borderLeft   ? 1.5 : 0,
          borderRightWidth:  corner.borderRight  ? 1.5 : 0,
          borderBottomWidth: corner.borderBottom ? 1.5 : 0,
          borderStyle:'solid',
          borderColor:`${C}80`,
        }} />
      ))}

    </div>
  )
}
