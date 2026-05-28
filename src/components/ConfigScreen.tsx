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
  redBg:   '#1a0800',
  neutral: '#555880',
  cooldown:'#FFCC00',
  text:    '#7a9ab5',
  textDim: '#2e4a5e',
  border:  '#0e2035',
  panelBg: '#070e18',
  cardBg:  '#050c16',
}

const mono = "'Courier New', Courier, monospace"

// ── Generic sub-components ─────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 8, fontWeight: 900, letterSpacing: '3px',
      color: C.textDim, fontFamily: mono,
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 6, marginBottom: 14,
      textTransform: 'uppercase',
    }}>
      {children}
    </div>
  )
}

interface BtnGroupOption<T> { value: T; label: string; sub?: string }
interface BtnGroupProps<T> {
  options: BtnGroupOption<T>[]
  value:   T
  onChange: (v: T) => void
  color?:  string
}

function BtnGroup<T extends string | number>({ options, value, onChange, color = C.blue }: BtnGroupProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: opt.sub ? '8px 4px 7px' : '9px 4px',
              background: active ? color + '18' : C.cardBg,
              border: `1px solid ${active ? color : C.border}`,
              borderRadius: 3,
              color: active ? color : C.textDim,
              fontFamily: mono,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.5px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              boxShadow: active ? `0 0 8px ${color}22` : 'none',
              transition: 'all 0.12s',
            }}
          >
            <span>{opt.label}</span>
            {opt.sub && (
              <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.6, letterSpacing: 0 }}>
                {opt.sub}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface SliderRowProps {
  label: string; value: number; min: number; max: number
  onChange: (v: number) => void; color: string
}

function SliderRow({ label, value, min, max, onChange, color }: SliderRowProps) {
  const pips = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px', color: C.textDim, fontFamily: mono }}>
          {label}
        </span>
        <span style={{ fontSize: 26, fontWeight: 900, color, fontFamily: mono, lineHeight: 1 }}>
          {value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 4 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {pips.map(n => (
          <span key={n} style={{
            fontSize: 9, fontFamily: mono,
            color: n === value ? color : C.textDim,
            fontWeight: n === value ? 700 : 400,
          }}>
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Difficulty descriptions ────────────────────────────────────────────────

const DIFF_INFO: Record<Difficulty, { label: string; sub: string; color: string }> = {
  easy:   { label: 'FÁCIL',   sub: 'lento',  color: '#00BF44' },
  normal: { label: 'NORMAL',  sub: 'padrão', color: C.blue    },
  hard:   { label: 'DIFÍCIL', sub: 'brutal', color: C.red     },
}

// ── CP count descriptions ─────────────────────────────────────────────────

const CP_INFO: Record<number, { label: string; sub: string }> = {
  1: { label: '1', sub: 'rei-do-morro' },
  3: { label: '3', sub: 'clássico'     },
  5: { label: '5', sub: 'flancos'      },
}

// ── Ticket options ────────────────────────────────────────────────────────

const TICKET_OPTIONS = [100, 150, 200, 250, 300]

// ── Summary row ───────────────────────────────────────────────────────────

function StatChip({ color, label, value }: { color: string; label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '6px 12px',
      background: color + '10',
      border: `1px solid ${color}44`,
      borderRadius: 3,
    }}>
      <span style={{ fontSize: 14, fontWeight: 900, color, fontFamily: mono }}>{value}</span>
      <span style={{ fontSize: 8, color: C.textDim, fontFamily: mono, letterSpacing: '1px' }}>{label}</span>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function ConfigScreen({ onStart }: Props) {
  const [blueSquads,     setBlueSquads]     = useState(4)
  const [redSquads,      setRedSquads]      = useState(4)
  const [cpCount,        setCpCount]        = useState<1 | 3 | 5>(3)
  const [initialTickets, setInitialTickets] = useState(200)
  const [difficulty,     setDifficulty]     = useState<Difficulty>('normal')

  const diffColor = DIFF_INFO[difficulty].color

  const handleStart = () => {
    onStart({ blueSquads, redSquads, cpCount, initialTickets, difficulty })
  }

  const card: CSSProperties = {
    background: C.panelBg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: '18px 20px',
    marginBottom: 12,
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
      padding: '24px 0',
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '6px', color: C.textDim, marginBottom: 8 }}>
          BATTLEFIELD 4
        </div>
        <h1 style={{
          fontSize: 36, fontWeight: 900, margin: 0,
          color: C.blue, letterSpacing: 4,
          textShadow: `0 0 28px ${C.blue}55`,
          fontFamily: mono,
        }}>
          ◈ COMMANDER MODE
        </h1>
        <div style={{ fontSize: 10, color: C.textDim, marginTop: 8, letterSpacing: '3px' }}>
          CONFIGURE SUA MISSÃO
        </div>
      </div>

      {/* ── Config panel ── */}
      <div style={{ width: 440 }}>

        {/* — Forças — */}
        <div style={card}>
          <SectionLabel>Forças</SectionLabel>
          <SliderRow
            label="SQUADS ALIADOS (US)"
            value={blueSquads} min={2} max={6}
            onChange={setBlueSquads} color={C.blue}
          />
          <div style={{ height: 18 }} />
          <SliderRow
            label="SQUADS INIMIGOS (CN)"
            value={redSquads} min={2} max={6}
            onChange={setRedSquads} color={C.red}
          />
        </div>

        {/* — Mapa — */}
        <div style={card}>
          <SectionLabel>Pontos de Controle</SectionLabel>
          <BtnGroup
            options={([1, 3, 5] as (1 | 3 | 5)[]).map(n => ({
              value: n,
              label: CP_INFO[n].label,
              sub:   CP_INFO[n].sub,
            }))}
            value={cpCount}
            onChange={setCpCount}
            color={C.neutral}
          />
        </div>

        {/* — Partida — */}
        <div style={card}>
          <SectionLabel>Configurações da Partida</SectionLabel>

          {/* Tickets */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '2px',
              color: C.textDim, marginBottom: 8,
            }}>
              TICKETS INICIAIS
            </div>
            <BtnGroup
              options={TICKET_OPTIONS.map(n => ({ value: n, label: String(n) }))}
              value={initialTickets}
              onChange={setInitialTickets}
              color={C.cooldown}
            />
          </div>

          {/* Difficulty */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '2px',
              color: C.textDim, marginBottom: 8,
            }}>
              DIFICULDADE DA IA
            </div>
            <BtnGroup
              options={(['easy', 'normal', 'hard'] as Difficulty[]).map(d => ({
                value: d,
                label: DIFF_INFO[d].label,
                sub:   DIFF_INFO[d].sub,
              }))}
              value={difficulty}
              onChange={setDifficulty}
              color={diffColor}
            />
          </div>
        </div>

        {/* — Summary chips — */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center',
          marginBottom: 14, flexWrap: 'wrap',
        }}>
          <StatChip color={C.blue}    label="ALIADOS"  value={blueSquads} />
          <StatChip color={C.red}     label="INIMIGOS" value={redSquads} />
          <StatChip color={C.neutral} label="PONTOS"   value={cpCount} />
          <StatChip color={C.cooldown} label="TICKETS" value={initialTickets} />
          <StatChip color={diffColor} label="DIFICUL." value={DIFF_INFO[difficulty].label} />
        </div>

        {/* — Start button — */}
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '14px 0',
            background: `linear-gradient(135deg, ${C.blueDim}cc, ${C.blue}88)`,
            border: `1px solid ${C.blue}`,
            borderRadius: 3,
            color: '#e8f8ff',
            fontSize: 14, fontWeight: 900,
            letterSpacing: '4px', cursor: 'pointer',
            fontFamily: mono,
            boxShadow: `0 0 20px ${C.blue}22`,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget
            btn.style.background = `linear-gradient(135deg, ${C.blue}cc, ${C.blue})`
            btn.style.boxShadow  = `0 0 30px ${C.blue}44`
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget
            btn.style.background = `linear-gradient(135deg, ${C.blueDim}cc, ${C.blue}88)`
            btn.style.boxShadow  = `0 0 20px ${C.blue}22`
          }}
        >
          ▶ INICIAR MISSÃO
        </button>

      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, fontSize: 9, color: C.textDim, letterSpacing: '2px' }}>
        IA ADAPTATIVA · PRESSÃO DE TICKETS · FOG OF WAR · KEYBINDS Q W E R A S
      </div>
    </div>
  )
}
