import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { GameConfig, Difficulty } from '../types'

interface Props {
  onStart: (config: GameConfig) => void
}

// ── BF4 colour tokens ─────────────────────────────────────────────────────
const C = {
  blue:    '#00C8FF',
  blueDim: '#0065CC',
  blueBg:  '#03101a',
  red:     '#FF6633',
  neutral: '#555880',
  cooldown:'#FFCC00',
  green:   '#00BF44',
  text:    '#7a9ab5',
  textDim: '#2e4a5e',
  border:  '#0e2035',
  panelBg: '#070e18',
  cardBg:  '#050c16',
}
const mono = "'Courier New', Courier, monospace"

// ── Reusable: group of toggle buttons ─────────────────────────────────────

interface BtnGroupOption<T> { value: T; label: string; sub?: string }

function BtnGroup<T extends string | number>({
  label, options, value, onChange, color = C.blue,
}: {
  label: string
  options: BtnGroupOption<T>[]
  value: T
  onChange: (v: T) => void
  color?: string
}) {
  return (
    <div>
      <div style={{
        fontSize: 8, fontWeight: 900, letterSpacing: '2px',
        color: C.textDim, fontFamily: mono,
        marginBottom: 6, textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {options.map(opt => {
          const active = opt.value === value
          return (
            <button
              key={String(opt.value)}
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                padding: opt.sub ? '6px 4px 5px' : '7px 4px',
                background: active ? color + '18' : C.cardBg,
                border: `1px solid ${active ? color : C.border}`,
                borderRadius: 3,
                color: active ? color : C.textDim,
                fontFamily: mono,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.5px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                boxShadow: active ? `0 0 6px ${color}22` : 'none',
                transition: 'all 0.1s',
              }}
            >
              <span>{opt.label}</span>
              {opt.sub && (
                <span style={{ fontSize: 7, fontWeight: 400, opacity: 0.55, letterSpacing: 0 }}>
                  {opt.sub}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Compact squad slider ───────────────────────────────────────────────────

function SquadSlider({
  label, value, onChange, color,
}: {
  label: string; value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '1.5px', color: C.textDim, fontFamily: mono }}>
          {label}
        </span>
        <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: mono, lineHeight: 1 }}>
          {value}
        </span>
      </div>
      <input
        type="range" min={2} max={6} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 3 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        {[2, 3, 4, 5, 6].map(n => (
          <span key={n} style={{
            fontSize: 8, fontFamily: mono,
            color: n === value ? color : C.textDim,
            fontWeight: n === value ? 700 : 400,
          }}>{n}</span>
        ))}
      </div>
    </div>
  )
}

// ── Difficulty & CP helpers ───────────────────────────────────────────────

const DIFF_COLOR: Record<Difficulty, string> = {
  easy: C.green, normal: C.blue, hard: C.red,
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function ConfigScreen({ onStart }: Props) {
  const [blueSquads,     setBlueSquads]     = useState(4)
  const [redSquads,      setRedSquads]      = useState(4)
  const [cpCount,        setCpCount]        = useState<1 | 3 | 5>(3)
  const [initialTickets, setInitialTickets] = useState(200)
  const [difficulty,     setDifficulty]     = useState<Difficulty>('normal')
  const [maxGameTime,    setMaxGameTime]    = useState(600)   // seconds; 0 = unlimited
  const [mapZoom,        setMapZoom]        = useState(16)
  const [squadSpeedMult, setSquadSpeedMult] = useState(1.0)

  const diffColor = DIFF_COLOR[difficulty]

  const card: CSSProperties = {
    background: C.panelBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: '14px 16px',
    marginBottom: 8,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#04090f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: mono,
      color: C.text,
      padding: '16px 0',
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 8, letterSpacing: '6px', color: C.textDim, marginBottom: 6 }}>
          BATTLEFIELD 4
        </div>
        <h1 style={{
          fontSize: 30, fontWeight: 900, margin: 0,
          color: C.blue, letterSpacing: 4,
          textShadow: `0 0 22px ${C.blue}44`,
          fontFamily: mono,
        }}>
          ◈ COMMANDER MODE
        </h1>
        <div style={{ fontSize: 8, color: C.textDim, marginTop: 5, letterSpacing: '3px' }}>
          CONFIGURE SUA MISSÃO
        </div>
      </div>

      <div style={{ width: 480 }}>

        {/* ── Forças — two sliders side by side ── */}
        <div style={card}>
          <div style={{
            fontSize: 8, fontWeight: 900, letterSpacing: '2px',
            color: C.textDim, fontFamily: mono,
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 8, marginBottom: 12,
            textTransform: 'uppercase',
          }}>
            Forças
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <SquadSlider label="ALIADOS (US)" value={blueSquads} onChange={setBlueSquads} color={C.blue} />
            <SquadSlider label="INIMIGOS (CN)" value={redSquads}  onChange={setRedSquads}  color={C.red}  />
          </div>
        </div>

        {/* ── Options — three groups in one row ── */}
        <div style={card}>
          <div style={{
            fontSize: 8, fontWeight: 900, letterSpacing: '2px',
            color: C.textDim, fontFamily: mono,
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 8, marginBottom: 12,
            textTransform: 'uppercase',
          }}>
            Mapa &amp; Partida
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* CP count */}
            <div style={{ flex: '0 0 auto', width: 100 }}>
              <BtnGroup
                label="Pontos de controle"
                options={([1, 3, 5] as (1|3|5)[]).map(n => ({
                  value: n,
                  label: String(n),
                  sub: n === 1 ? 'centro' : n === 3 ? 'clássico' : 'flancos',
                }))}
                value={cpCount}
                onChange={setCpCount}
                color={C.neutral}
              />
            </div>

            {/* Tickets */}
            <div style={{ flex: 1 }}>
              <BtnGroup
                label="Tickets iniciais"
                options={[100, 150, 200, 250, 300].map(n => ({ value: n, label: String(n) }))}
                value={initialTickets}
                onChange={setInitialTickets}
                color={C.cooldown}
              />
            </div>

            {/* Difficulty */}
            <div style={{ flex: '0 0 auto', width: 145 }}>
              <BtnGroup
                label="Dificuldade da IA"
                options={[
                  { value: 'easy'   as Difficulty, label: 'FÁCIL',   sub: 'lento'  },
                  { value: 'normal' as Difficulty, label: 'NORMAL',  sub: 'padrão' },
                  { value: 'hard'   as Difficulty, label: 'DIFÍCIL', sub: 'brutal' },
                ]}
                value={difficulty}
                onChange={setDifficulty}
                color={diffColor}
              />
            </div>

          </div>

          {/* ── Duration — full width below ── */}
          <div style={{ marginTop: 12 }}>
            <BtnGroup
              label="Duração da partida"
              options={[
                { value: 300,  label: '5min'  },
                { value: 600,  label: '10min', sub: 'padrão' },
                { value: 900,  label: '15min' },
                { value: 1200, label: '20min' },
                { value: 0,    label: '∞',    sub: 'sem fim' },
              ]}
              value={maxGameTime}
              onChange={setMaxGameTime}
              color={C.green}
            />
          </div>

        </div>

        {/* ── Mapa & Velocidade ── */}
        <div style={card}>
          <div style={{
            fontSize: 8, fontWeight: 900, letterSpacing: '2px',
            color: C.textDim, fontFamily: mono,
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 8, marginBottom: 12,
            textTransform: 'uppercase',
          }}>
            Visualização &amp; Velocidade
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* Map zoom */}
            <div style={{ flex: 1 }}>
              <BtnGroup
                label="Zoom do mapa"
                options={[
                  { value: 13, label: '13', sub: '~28km' },
                  { value: 14, label: '14', sub: '~14km' },
                  { value: 15, label: '15', sub: '~7km'  },
                  { value: 16, label: '16', sub: '~3.5km' },
                  { value: 17, label: '17', sub: '~1.7km' },
                ]}
                value={mapZoom}
                onChange={setMapZoom}
                color={C.neutral}
              />
            </div>

            {/* Squad speed */}
            <div style={{ flex: 1 }}>
              <BtnGroup
                label="Velocidade dos squads"
                options={[
                  { value: 0.5,  label: '0.5×', sub: 'lento'   },
                  { value: 0.75, label: '0.75×' },
                  { value: 1.0,  label: '1×',   sub: 'normal'  },
                  { value: 1.5,  label: '1.5×' },
                  { value: 2.0,  label: '2×',   sub: 'rápido'  },
                ]}
                value={squadSpeedMult}
                onChange={setSquadSpeedMult}
                color={C.blue}
              />
            </div>

          </div>
        </div>

        {/* ── Summary + Start ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* Mini summary chips */}
          {[
            { color: C.blue,    val: blueSquads,     label: 'US'  },
            { color: C.red,     val: redSquads,       label: 'CN'  },
            { color: C.neutral, val: `${cpCount} CP`, label: 'map' },
            { color: C.cooldown,val: initialTickets,  label: 'tkts'},
            { color: diffColor, val: difficulty[0].toUpperCase(), label: 'dif' },
            { color: C.green,   val: maxGameTime > 0 ? `${maxGameTime / 60}m` : '∞', label: 'tempo' },
            { color: C.neutral, val: `z${mapZoom}`,     label: 'zoom'  },
            { color: C.blue,    val: `${squadSpeedMult}×`, label: 'vel'   },
          ].map(({ color, val, label }) => (
            <div key={label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '5px 8px',
              background: color + '12',
              border: `1px solid ${color}40`,
              borderRadius: 3,
              minWidth: 40,
            }}>
              <span style={{ fontSize: 13, fontWeight: 900, color, fontFamily: mono, lineHeight: 1 }}>{val}</span>
              <span style={{ fontSize: 7, color: C.textDim, fontFamily: mono, marginTop: 2 }}>{label}</span>
            </div>
          ))}

          {/* Start button — takes remaining space */}
          <button
            onClick={() => onStart({ blueSquads, redSquads, cpCount, initialTickets, difficulty, maxGameTime, mapZoom, squadSpeedMult })}
            style={{
              flex: 1,
              padding: '12px 0',
              background: `linear-gradient(135deg, ${C.blueDim}cc, ${C.blue}88)`,
              border: `1px solid ${C.blue}`,
              borderRadius: 3,
              color: '#e8f8ff',
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: '3px',
              cursor: 'pointer',
              fontFamily: mono,
              boxShadow: `0 0 16px ${C.blue}22`,
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget
              b.style.background = C.blue
              b.style.boxShadow  = `0 0 24px ${C.blue}55`
            }}
            onMouseLeave={e => {
              const b = e.currentTarget
              b.style.background = `linear-gradient(135deg, ${C.blueDim}cc, ${C.blue}88)`
              b.style.boxShadow  = `0 0 16px ${C.blue}22`
            }}
          >
            ▶ INICIAR MISSÃO
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 8, color: C.textDim, letterSpacing: '2px', textAlign: 'center' }}>
          IA ADAPTATIVA · FOG OF WAR · KEYBINDS Q W E R A S
        </div>
      </div>
    </div>
  )
}
