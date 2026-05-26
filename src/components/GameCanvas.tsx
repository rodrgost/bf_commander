import React from 'react'
import { Stage, Layer, Rect, Circle, Text, Arc, Ring, Line } from 'react-konva'
import type { GameState, Squad, Vec2, SelectionTarget } from '../types'
import { MAP_W, MAP_H, BLUE_BASE, RED_BASE } from '../game/mapData'
import { VISION_RANGE } from '../game/units'

// Game coordinates = display coordinates (scale 1:1).
// Canvas is purely the map; the info panel lives in HTML beside it.
const DISPLAY_SCALE = 1.0

// ── Soldier dot ───────────────────────────────────────────────────────────
const DOT_RADIUS   = 2    // px
const LABEL_Y      = DOT_RADIUS + 10

// Selection bracket constants
const SEL_HALF  = 14
const SEL_LEG   = 6
const SEL_COLOR = '#ffffff'

// Click detection thresholds
const CLICK_SQUAD_R = 15  // px — how close to a soldier to select a squad
const CLICK_CP_R    = 22  // px — how close to a CP centre
const CLICK_BASE_R  = 26  // px — how close to a base diamond centre

interface Props {
  state:     GameState
  onMapClick: (pos: Vec2) => void
  selection:  SelectionTarget | null
  onSelect:   (sel: SelectionTarget | null) => void
}

// Visibility check: squad centroid + revealedTimer + UAV + VISION_RANGE of blue squads
function isEnemyVisible(state: GameState, squad: Squad): boolean {
  if (squad.revealedTimer > 0) return true
  if (state.uavActive && state.uavCenter) {
    const dx = squad.position.x - state.uavCenter.x
    const dy = squad.position.y - state.uavCenter.y
    if (Math.sqrt(dx * dx + dy * dy) < state.uavRadius) return true
  }
  return state.squads.some(b => {
    if (b.team !== 'blue' || b.status === 'dead') return false
    const dx = b.position.x - squad.position.x
    const dy = b.position.y - squad.position.y
    return Math.sqrt(dx * dx + dy * dy) < VISION_RANGE
  })
}

// BF3-style diamond colors per owner
const CP_STROKE: Record<string, string> = { neutral: '#f97316', blue: '#3b82f6', red: '#ef4444' }
const CP_FILL:   Record<string, string> = { neutral: '#1a0d00', blue: '#081828', red: '#200808' }

const ROLE_STROKE: Record<string, string> = {
  attack:  '#f97316',
  defend:  '#60a5fa',
  hold:    '#4ade80',
  retreat: '#f87171',
}

export default function GameCanvas({ state, onMapClick, selection, onSelect }: Props) {

  const handleClick = (e: { target: { getStage: () => { getPointerPosition: () => Vec2 | null } } }) => {
    if (state.phase !== 'playing') return
    const stage = e.target.getStage()
    const pos   = stage.getPointerPosition()
    if (!pos) return
    const gx = pos.x / DISPLAY_SCALE
    const gy = pos.y / DISPLAY_SCALE

    // Ability mode — fire the ability at click position
    if (state.pendingAbility) {
      onMapClick({ x: gx, y: gy })
      return
    }

    // ── Priority 1: control points ──────────────────────────────────────
    let nearCp: typeof state.controlPoints[0] | null = null
    let nearCpD = CLICK_CP_R
    for (const cp of state.controlPoints) {
      const d = Math.hypot(cp.position.x - gx, cp.position.y - gy)
      if (d < nearCpD) { nearCpD = d; nearCp = cp }
    }
    if (nearCp) {
      const sel: SelectionTarget = { type: 'cp', id: nearCp.id }
      onSelect(selection?.type === 'cp' && selection.id === nearCp.id ? null : sel)
      return
    }

    // ── Priority 2: bases ───────────────────────────────────────────────
    if (Math.hypot(BLUE_BASE.x - gx, BLUE_BASE.y - gy) < CLICK_BASE_R) {
      const sel: SelectionTarget = { type: 'base', team: 'blue' }
      onSelect(selection?.type === 'base' && selection.team === 'blue' ? null : sel)
      return
    }
    if (Math.hypot(RED_BASE.x - gx, RED_BASE.y - gy) < CLICK_BASE_R) {
      const sel: SelectionTarget = { type: 'base', team: 'red' }
      onSelect(selection?.type === 'base' && selection.team === 'red' ? null : sel)
      return
    }

    // ── Priority 3: blue squad soldiers ────────────────────────────────
    let best: { squad: Squad; dist: number } | null = null
    for (const sq of state.squads) {
      if (sq.team !== 'blue' || sq.status === 'dead') continue
      for (const sol of sq.soldiers) {
        if (sol.hp <= 0) continue
        const d = Math.hypot(sol.position.x - gx, sol.position.y - gy)
        if (d < CLICK_SQUAD_R && (!best || d < best.dist)) {
          best = { squad: sq, dist: d }
        }
      }
    }
    if (best) {
      const sel: SelectionTarget = { type: 'squad', id: best.squad.id }
      onSelect(selection?.type === 'squad' && selection.id === best.squad.id ? null : sel)
      return
    }

    // Clicked empty area — deselect
    onSelect(null)
  }

  // Derive selection objects for rendering
  const selSquad = selection?.type === 'squad'
    ? state.squads.find(s => s.id === selection.id && s.status !== 'dead') ?? null
    : null
  const selCp = selection?.type === 'cp'
    ? state.controlPoints.find(c => c.id === selection.id) ?? null
    : null
  const selBaseTeam = selection?.type === 'base' ? selection.team : null

  return (
    <Stage
      width={MAP_W * DISPLAY_SCALE}
      height={MAP_H * DISPLAY_SCALE}
      scaleX={DISPLAY_SCALE}
      scaleY={DISPLAY_SCALE}
      onClick={handleClick}
      style={{ cursor: state.pendingAbility ? 'crosshair' : 'default', border: '2px solid #0e2035', display: 'block' }}
    >
      {/* ── BACKGROUND ── */}
      <Layer>
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#0d1a0d" />

        {/* Subtle grid — every 100px */}
        {Array.from({ length: Math.floor(MAP_W / 100) + 1 }).map((_, i) => (
          <Rect key={`gv${i}`} x={i * 100} y={0} width={1} height={MAP_H} fill="#ffffff07" />
        ))}
        {Array.from({ length: Math.floor(MAP_H / 100) + 1 }).map((_, i) => (
          <Rect key={`gh${i}`} x={0} y={i * 100} width={MAP_W} height={1} fill="#ffffff07" />
        ))}

        {/* ── BASES — BF3/BF4 diamond markers ── */}

        {/* Blue base — selection highlight */}
        {selBaseTeam === 'blue' && (
          <Ring
            x={BLUE_BASE.x} y={BLUE_BASE.y}
            innerRadius={22} outerRadius={26}
            fill="#3b82f6" opacity={0.5}
          />
        )}
        <Rect
          x={BLUE_BASE.x} y={BLUE_BASE.y}
          width={24} height={24} offsetX={12} offsetY={12} rotation={45}
          fill="#081828" stroke="#3b82f6" strokeWidth={2}
          shadowColor="#3b82f6" shadowBlur={20} shadowOpacity={0.9}
        />
        <Text
          x={BLUE_BASE.x - 4} y={BLUE_BASE.y - 5}
          text="B" fill="#60a5fa" fontSize={9} fontStyle="bold"
        />
        <Text
          x={BLUE_BASE.x - 26} y={BLUE_BASE.y + 15}
          text="Base Aliada" fill="#60a5fa" fontSize={7} fontStyle="bold"
          width={52} align="center"
        />

        {/* Red base — selection highlight */}
        {selBaseTeam === 'red' && (
          <Ring
            x={RED_BASE.x} y={RED_BASE.y}
            innerRadius={22} outerRadius={26}
            fill="#ef4444" opacity={0.5}
          />
        )}
        <Rect
          x={RED_BASE.x} y={RED_BASE.y}
          width={24} height={24} offsetX={12} offsetY={12} rotation={45}
          fill="#200808" stroke="#ef4444" strokeWidth={2}
          shadowColor="#ef4444" shadowBlur={20} shadowOpacity={0.9}
        />
        <Text
          x={RED_BASE.x - 4} y={RED_BASE.y - 5}
          text="R" fill="#f87171" fontSize={9} fontStyle="bold"
        />
        <Text
          x={RED_BASE.x - 26} y={RED_BASE.y + 15}
          text="Base Inimiga" fill="#f87171" fontSize={7} fontStyle="bold"
          width={52} align="center"
        />
      </Layer>

      {/* ── CONTROL POINTS ── */}
      <Layer>
        {state.controlPoints.map(cp => {
          const stroke   = CP_STROKE[cp.owner]
          const fill     = CP_FILL[cp.owner]
          const letter   = cp.label[0]
          const isSelCp  = selCp?.id === cp.id

          return (
            <React.Fragment key={cp.id}>
              {/* Capture progress arc */}
              {cp.cappingTeam && cp.captureProgress > 0 && (
                <Arc
                  x={cp.position.x} y={cp.position.y}
                  innerRadius={14} outerRadius={17}
                  angle={cp.captureProgress * 360} rotation={-90}
                  fill={cp.cappingTeam === 'blue' ? '#3b82f6aa' : '#ef4444aa'}
                />
              )}

              {/* Selection highlight ring */}
              {isSelCp && (
                <Ring
                  x={cp.position.x} y={cp.position.y}
                  innerRadius={20} outerRadius={24}
                  fill={stroke} opacity={0.45}
                />
              )}

              {/* Outer glow halo */}
              <Rect
                x={cp.position.x} y={cp.position.y}
                width={22} height={22} offsetX={11} offsetY={11} rotation={45}
                fill="transparent" stroke={stroke} strokeWidth={0.5}
                shadowColor={stroke} shadowBlur={18} shadowOpacity={0.95}
              />

              {/* Diamond body */}
              <Rect
                x={cp.position.x} y={cp.position.y}
                width={16} height={16} offsetX={8} offsetY={8} rotation={45}
                fill={fill} stroke={stroke} strokeWidth={1.5}
              />

              {/* Single uppercase initial */}
              <Text
                x={cp.position.x - 7} y={cp.position.y - 5}
                text={letter}
                fill="#ffffff" fontSize={9} fontStyle="bold"
                width={14} align="center"
              />
            </React.Fragment>
          )
        })}
      </Layer>

      {/* ── BLUE ORDER INDICATOR ── */}
      <Layer>
        {state.blueOrders.type && state.blueOrders.cpId && (() => {
          const cp      = state.controlPoints.find(c => c.id === state.blueOrders.cpId)
          if (!cp) return null
          const isAtk   = state.blueOrders.type === 'attack'
          const color   = isAtk ? '#f97316' : '#22d3ee'
          const pulse   = state.blueOrders.timer % 1
          const outerR  = 20 + pulse * 5
          return (
            <React.Fragment key="order-indicator">
              <Ring
                x={cp.position.x} y={cp.position.y}
                innerRadius={outerR - 3} outerRadius={outerR}
                fill={color} opacity={0.6 - pulse * 0.4}
              />
              <Ring
                x={cp.position.x} y={cp.position.y}
                innerRadius={13} outerRadius={16}
                fill={color} opacity={0.9}
              />
              <Text
                x={cp.position.x - 22} y={cp.position.y + 17}
                text={`${isAtk ? '⚔ ATK' : '🛡 DEF'}  ${Math.ceil(state.blueOrders.timer)}s`}
                fill={color} fontSize={7} fontStyle="bold"
                width={44} align="center"
              />
            </React.Fragment>
          )
        })()}
      </Layer>

      {/* ── UAV SCAN RING ── */}
      <Layer>
        {state.uavActive && state.uavCenter && (
          <Ring
            x={state.uavCenter.x} y={state.uavCenter.y}
            innerRadius={state.uavRadius - 4} outerRadius={state.uavRadius}
            fill="#00ff8844" stroke="#00ff88" strokeWidth={1}
          />
        )}
      </Layer>

      {/* ── VISUAL EFFECTS ── */}
      <Layer>
        {state.effects.map(fx => {
          const progress = 1 - fx.timer / fx.maxTimer
          if (fx.type === 'explosion') {
            return (
              <React.Fragment key={fx.id}>
                <Circle x={fx.position.x} y={fx.position.y}
                  radius={fx.radius * (0.2 + progress * 0.8)}
                  fill={`rgba(255,120,0,${0.7 - progress * 0.7})`} />
                <Circle x={fx.position.x} y={fx.position.y}
                  radius={fx.radius * (0.1 + progress * 0.4)}
                  fill={`rgba(255,255,100,${0.9 - progress * 0.9})`} />
              </React.Fragment>
            )
          }
          if (fx.type === 'uav_scan') {
            return (
              <Circle key={fx.id} x={fx.position.x} y={fx.position.y}
                radius={fx.radius * progress}
                stroke="#00ff88" strokeWidth={2}
                fill={`rgba(0,255,136,${0.05 - progress * 0.05})`} />
            )
          }
          if (fx.type === 'emp_pulse') {
            return (
              <Circle key={fx.id} x={fx.position.x} y={fx.position.y}
                radius={fx.radius * progress}
                stroke="#a855f7" strokeWidth={3}
                fill={`rgba(168,85,247,${0.1 - progress * 0.1})`} />
            )
          }
          if (fx.type === 'ammo_drop') {
            return (
              <React.Fragment key={fx.id}>
                <Rect x={fx.position.x - 12} y={fx.position.y - 16}
                  width={24} height={18} fill="#facc15" cornerRadius={3} opacity={1 - progress} />
                <Text x={fx.position.x - 9} y={fx.position.y - 13}
                  text="+HP" fill="#000" fontSize={9} fontStyle="bold" />
              </React.Fragment>
            )
          }
          return null
        })}
      </Layer>

      {/* ── SOLDIERS ── */}
      <Layer>
        {state.squads.map(squad => {
          if (squad.status === 'dead') return null
          if (squad.team === 'red' && !isEnemyVisible(state, squad)) return null

          const isBlue     = squad.team === 'blue'
          const color      = isBlue ? '#3b82f6' : '#ef4444'
          const nameColor  = isBlue ? '#93c5fd' : '#fca5a5'
          const suppressed = squad.status === 'suppressed'
          const cx         = squad.position.x
          const cy         = squad.position.y

          return (
            <React.Fragment key={squad.id}>
              {/* Squad name label — floats at centroid */}
              <Text
                x={cx - 10} y={cy - LABEL_Y}
                text={squad.id.toUpperCase()}
                fill={suppressed ? '#a855f7' : nameColor}
                fontSize={7} fontStyle="bold"
                width={20} align="center"
              />

              {/* One dot per alive soldier at its individual position */}
              {squad.soldiers.map(sol => {
                if (sol.hp <= 0) return null
                const solHpPct = sol.hp / sol.maxHp
                const BAR_W = 6
                return (
                  <React.Fragment key={sol.id}>
                    {/* Tiny HP bar above each soldier */}
                    <Rect
                      x={sol.position.x - BAR_W / 2} y={sol.position.y - DOT_RADIUS - 3}
                      width={BAR_W} height={1} fill="#0f172a" cornerRadius={0.5}
                    />
                    <Rect
                      x={sol.position.x - BAR_W / 2} y={sol.position.y - DOT_RADIUS - 3}
                      width={BAR_W * solHpPct} height={1}
                      fill={solHpPct > 0.5 ? '#22c55e' : solHpPct > 0.25 ? '#f59e0b' : '#ef4444'}
                      cornerRadius={0.5}
                    />
                    {/* Soldier dot */}
                    <Circle
                      x={sol.position.x} y={sol.position.y}
                      radius={DOT_RADIUS}
                      fill={color}
                      stroke={suppressed ? '#a855f7' : ROLE_STROKE[squad.role]}
                      strokeWidth={1}
                      opacity={suppressed ? 0.4 : 0.4 + solHpPct * 0.6}
                    />
                  </React.Fragment>
                )
              })}
            </React.Fragment>
          )
        })}
      </Layer>

      {/* ── SQUAD SELECTION (BF4 brackets + crosshair) ── */}
      <Layer>
        {selSquad && (() => {
          const cx = selSquad.position.x
          const cy = selSquad.position.y
          const S  = SEL_HALF
          const L  = SEL_LEG
          return (
            <>
              {/* Thin crosshair spanning the full map */}
              <Line points={[0, cy, MAP_W, cy]} stroke={SEL_COLOR} strokeWidth={0.5} opacity={0.18} />
              <Line points={[cx, 0, cx, MAP_H]} stroke={SEL_COLOR} strokeWidth={0.5} opacity={0.18} />

              {/* Corner brackets */}
              <Line points={[cx-S+L, cy-S,  cx-S, cy-S,  cx-S, cy-S+L]}
                stroke={SEL_COLOR} strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx+S-L, cy-S,  cx+S, cy-S,  cx+S, cy-S+L]}
                stroke={SEL_COLOR} strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx-S+L, cy+S,  cx-S, cy+S,  cx-S, cy+S-L]}
                stroke={SEL_COLOR} strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx+S-L, cy+S,  cx+S, cy+S,  cx+S, cy+S-L]}
                stroke={SEL_COLOR} strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
            </>
          )
        })()}
      </Layer>

      {/* ── GAME OVER OVERLAY ── */}
      <Layer>
        {state.phase !== 'playing' && (
          <>
            <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="rgba(0,0,0,0.65)" />
            <Text
              x={0} y={MAP_H / 2 - 44} width={MAP_W} align="center"
              text={
                state.phase === 'victory' ? '⊕  VITÓRIA!'  :
                state.phase === 'draw'    ? '◈  EMPATE'    :
                                            '✕  DERROTA'
              }
              fill={
                state.phase === 'victory' ? '#22c55e' :
                state.phase === 'draw'    ? '#facc15' :
                                            '#ef4444'
              }
              fontSize={52} fontStyle="bold"
            />
            <Text
              x={0} y={MAP_H / 2 + 16} width={MAP_W} align="center"
              text={
                state.phase === 'draw'
                  ? 'Ambos os times ficaram sem tickets ao mesmo tempo'
                  : state.phase === 'victory'
                    ? 'O inimigo ficou sem reforços'
                    : 'Seus reforços acabaram'
              }
              fill="#94a3b8" fontSize={15}
            />
            <Text
              x={0} y={MAP_H / 2 + 44} width={MAP_W} align="center"
              text="Pressione RESTART para jogar novamente"
              fill="#475569" fontSize={13}
            />
          </>
        )}
      </Layer>
    </Stage>
  )
}
