import { useState } from 'react'
import type { GameConfig } from '../types'

interface Props {
  onStart: (config: GameConfig) => void
}

export default function ConfigScreen({ onStart }: Props) {
  const [blueSquads, setBlueSquads] = useState(4)
  const [redSquads,  setRedSquads]  = useState(4)

  const handleStart = () => {
    onStart({ blueSquads, redSquads })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', monospace",
      color: '#e2e8f0',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: '#64748b', marginBottom: 8 }}>
          BATTLEFIELD 4
        </div>
        <h1 style={{
          fontSize: 42, fontWeight: 900, margin: 0,
          color: '#60a5fa', letterSpacing: 3,
          textShadow: '0 0 30px rgba(96,165,250,0.4)',
        }}>
          ◈ COMMANDER MODE
        </h1>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 8, letterSpacing: 2 }}>
          CONFIGURE SUA MISSÃO
        </div>
      </div>

      {/* Config panel */}
      <div style={{
        background: '#111827',
        border: '1px solid #1e3a5f',
        borderRadius: 12,
        padding: '36px 48px',
        minWidth: 380,
        boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
      }}>
        <SliderRow
          label="SQUADS ALIADOS"
          value={blueSquads}
          onChange={setBlueSquads}
          color="#3b82f6"
          accentColor="#60a5fa"
        />

        <div style={{ height: 28 }} />

        <SliderRow
          label="SQUADS INIMIGOS"
          value={redSquads}
          onChange={setRedSquads}
          color="#ef4444"
          accentColor="#f87171"
        />

        <div style={{ height: 40 }} />

        {/* Summary */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginBottom: 32, padding: '10px 14px',
          background: '#0f172a', borderRadius: 8,
          border: '1px solid #1e293b',
          fontSize: 12, color: '#64748b',
        }}>
          <span style={{ color: '#60a5fa', fontWeight: 700 }}>
            {blueSquads} × ALIADOS
          </span>
          <span style={{ color: '#94a3b8' }}>vs</span>
          <span style={{ color: '#f87171', fontWeight: 700 }}>
            {redSquads} × INIMIGOS
          </span>
        </div>

        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '14px 0',
            background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
            border: '2px solid #3b82f6',
            borderRadius: 8,
            color: '#e0f2fe',
            fontSize: 15, fontWeight: 800,
            letterSpacing: 3, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = 'linear-gradient(135deg, #2563eb, #3b82f6)'
            ;(e.target as HTMLButtonElement).style.color = '#ffffff'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = 'linear-gradient(135deg, #1e3a5f, #2563eb)'
            ;(e.target as HTMLButtonElement).style.color = '#e0f2fe'
          }}
        >
          INICIAR MISSÃO
        </button>
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 24, fontSize: 11, color: '#334155', letterSpacing: 1 }}>
        IA VERMELHA ADAPTATIVA · PRESSÃO POR TICKETS · FOG OF WAR
      </div>
    </div>
  )
}

interface SliderRowProps {
  label: string
  value: number
  onChange: (v: number) => void
  color: string
  accentColor: string
}

function SliderRow({ label, value, onChange, color, accentColor }: SliderRowProps) {
  const pips = [2, 3, 4, 5, 6]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#64748b' }}>
          {label}
        </span>
        <span style={{ fontSize: 28, fontWeight: 900, color: accentColor, lineHeight: 1 }}>
          {value}
        </span>
      </div>

      <input
        type="range" min={2} max={6} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 4 }}
      />

      {/* Pip labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {pips.map(n => (
          <span key={n} style={{
            fontSize: 9, color: n === value ? accentColor : '#334155',
            fontWeight: n === value ? 700 : 400, transition: 'color 0.15s',
          }}>
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}
