import React from 'react'
import { Stage, Layer, Rect, Circle, Text, Arc, Ring, Line, RegularPolygon } from 'react-konva'
import type { GameState, Squad, Vec2, SelectionTarget } from '../types'
import { MAP_W, MAP_H, BLUE_BASE, RED_BASE } from '../game/mapData'
import { VISION_RANGE } from '../game/units'

const DISPLAY_SCALE = 1.0

// ── BF4 colour palette ────────────────────────────────────────────────────
const C = {
  // Allied (US)
  BLUE:         '#00C8FF',
  BLUE_DIM:     '#0065CC',
  BLUE_BG:      '#03101a',
  // Enemy (CN)
  RED:          '#FF6633',
  RED_DIM:      '#CC3300',
  RED_BG:       '#1a0800',
  // States
  NEUTRAL:      '#555880',
  NEUTRAL_BG:   '#0d0d14',
  COOLDOWN:     '#FFCC00',
  SUPPRESS:     '#a855f7',
  // Map
  MAP_BG:       '#111A22',
  GRID:         '#ffffff06',
  // Text
  TEXT_DIM:     '#4a6278',
}

// Soldier / label sizes
const DOT_RADIUS  = 2
const TRI_RADIUS  = 3.2   // slightly larger so triangle reads clearly
const LABEL_Y     = DOT_RADIUS + 11

// Selection bracket
const SEL_HALF  = 14
const SEL_LEG   = 6

// Click thresholds
const CLICK_SQUAD_R = 15
const CLICK_CP_R    = 22
const CLICK_BASE_R  = 26

// ── CP / Role colours ─────────────────────────────────────────────────────
const CP_STROKE: Record<string, string> = {
  neutral: C.NEUTRAL,
  blue:    C.BLUE,
  red:     C.RED,
}
const CP_FILL: Record<string, string> = {
  neutral: C.NEUTRAL_BG,
  blue:    C.BLUE_BG,
  red:     C.RED_BG,
}
const ROLE_STROKE: Record<string, string> = {
  attack:  C.RED,
  defend:  C.BLUE,
  hold:    '#00BF44',
  retreat: C.RED_DIM,
}

interface Props {
  state:      GameState
  onMapClick: (pos: Vec2) => void
  selection:  SelectionTarget | null
  onSelect:   (sel: SelectionTarget | null) => void
}

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

// Squad action tag text: "B2 / ATK A", "R1 / DEF B", …
function actionTag(squad: Squad, cps: typeof state.controlPoints): string {
  if (!squad.targetCpId) return squad.id.toUpperCase()
  const cp = cps.find(c => c.id === squad.targetCpId)
  if (!cp) return squad.id.toUpperCase()
  const verb =
    squad.role === 'defend'  ? 'DEF' :
    squad.role === 'retreat' ? 'RET' :
    squad.role === 'hold'    ? 'HLD' : 'ATK'
  return `${squad.id.toUpperCase()} / ${verb} ${cp.label[0]}`
}

export default function GameCanvas({ state, onMapClick, selection, onSelect }: Props) {

  const handleClick = (e: { target: { getStage: () => { getPointerPosition: () => Vec2 | null } } }) => {
    if (state.phase !== 'playing') return
    const stage = e.target.getStage()
    const pos   = stage.getPointerPosition()
    if (!pos) return
    const gx = pos.x / DISPLAY_SCALE
    const gy = pos.y / DISPLAY_SCALE

    if (state.pendingAbility) { onMapClick({ x: gx, y: gy }); return }

    // Priority 1 — CPs
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

    // Priority 2 — Bases
    if (Math.hypot(BLUE_BASE.x - gx, BLUE_BASE.y - gy) < CLICK_BASE_R) {
      onSelect(selection?.type === 'base' && selection.team === 'blue' ? null : { type: 'base', team: 'blue' })
      return
    }
    if (Math.hypot(RED_BASE.x - gx, RED_BASE.y - gy) < CLICK_BASE_R) {
      onSelect(selection?.type === 'base' && selection.team === 'red' ? null : { type: 'base', team: 'red' })
      return
    }

    // Priority 3 — Blue squad soldiers
    let best: { squad: Squad; dist: number } | null = null
    for (const sq of state.squads) {
      if (sq.team !== 'blue' || sq.status === 'dead') continue
      for (const sol of sq.soldiers) {
        if (sol.hp <= 0) continue
        const d = Math.hypot(sol.position.x - gx, sol.position.y - gy)
        if (d < CLICK_SQUAD_R && (!best || d < best.dist)) best = { squad: sq, dist: d }
      }
    }
    if (best) {
      const sel: SelectionTarget = { type: 'squad', id: best.squad.id }
      onSelect(selection?.type === 'squad' && selection.id === best.squad.id ? null : sel)
      return
    }

    onSelect(null)
  }

  const selSquad   = selection?.type === 'squad'
    ? state.squads.find(s => s.id === selection.id && s.status !== 'dead') ?? null : null
  const selCp      = selection?.type === 'cp'
    ? state.controlPoints.find(c => c.id === selection.id) ?? null : null
  const selBaseTeam = selection?.type === 'base' ? selection.team : null

  return (
    <Stage
      width={MAP_W * DISPLAY_SCALE}
      height={MAP_H * DISPLAY_SCALE}
      scaleX={DISPLAY_SCALE}
      scaleY={DISPLAY_SCALE}
      onClick={handleClick}
      style={{
        cursor: state.pendingAbility ? 'crosshair' : 'default',
        border: `1px solid ${C.BLUE_DIM}55`,
        display: 'block',
      }}
    >
      {/* ── BACKGROUND ── */}
      <Layer>
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill={C.MAP_BG} />

        {/* Grid */}
        {Array.from({ length: Math.floor(MAP_W / 100) + 1 }).map((_, i) => (
          <Rect key={`gv${i}`} x={i * 100} y={0} width={1} height={MAP_H} fill={C.GRID} />
        ))}
        {Array.from({ length: Math.floor(MAP_H / 100) + 1 }).map((_, i) => (
          <Rect key={`gh${i}`} x={0} y={i * 100} width={MAP_W} height={1} fill={C.GRID} />
        ))}

        {/* ── BASES ── */}
        {selBaseTeam === 'blue' && (
          <Ring x={BLUE_BASE.x} y={BLUE_BASE.y} innerRadius={20} outerRadius={25}
            fill={C.BLUE} opacity={0.4} />
        )}
        <Rect x={BLUE_BASE.x} y={BLUE_BASE.y}
          width={24} height={24} offsetX={12} offsetY={12} rotation={45}
          fill={C.BLUE_BG} stroke={C.BLUE} strokeWidth={2}
          shadowColor={C.BLUE} shadowBlur={18} shadowOpacity={0.85}
        />
        <Text x={BLUE_BASE.x - 4} y={BLUE_BASE.y - 5}
          text="B" fill={C.BLUE} fontSize={9} fontStyle="bold"
        />
        <Text x={BLUE_BASE.x - 26} y={BLUE_BASE.y + 15}
          text="Base Aliada" fill={C.BLUE_DIM} fontSize={7} fontStyle="bold"
          width={52} align="center"
        />

        {selBaseTeam === 'red' && (
          <Ring x={RED_BASE.x} y={RED_BASE.y} innerRadius={20} outerRadius={25}
            fill={C.RED} opacity={0.4} />
        )}
        <Rect x={RED_BASE.x} y={RED_BASE.y}
          width={24} height={24} offsetX={12} offsetY={12} rotation={45}
          fill={C.RED_BG} stroke={C.RED} strokeWidth={2}
          shadowColor={C.RED} shadowBlur={18} shadowOpacity={0.85}
        />
        <Text x={RED_BASE.x - 4} y={RED_BASE.y - 5}
          text="R" fill={C.RED} fontSize={9} fontStyle="bold"
        />
        <Text x={RED_BASE.x - 26} y={RED_BASE.y + 15}
          text="Base Inimiga" fill={C.RED_DIM} fontSize={7} fontStyle="bold"
          width={52} align="center"
        />
      </Layer>

      {/* ── CONTROL POINTS ── */}
      <Layer>
        {state.controlPoints.map(cp => {
          const stroke  = CP_STROKE[cp.owner]
          const fill    = CP_FILL[cp.owner]
          const letter  = cp.label[0]
          const isSel   = selCp?.id === cp.id

          return (
            <React.Fragment key={cp.id}>
              {/* Capture progress arc */}
              {cp.cappingTeam && cp.captureProgress > 0 && (
                <Arc
                  x={cp.position.x} y={cp.position.y}
                  innerRadius={14} outerRadius={17}
                  angle={cp.captureProgress * 360} rotation={-90}
                  fill={cp.cappingTeam === 'blue' ? C.BLUE + 'aa' : C.RED + 'aa'}
                />
              )}

              {/* Selection highlight */}
              {isSel && (
                <Ring x={cp.position.x} y={cp.position.y}
                  innerRadius={20} outerRadius={24}
                  fill={stroke} opacity={0.45}
                />
              )}

              {/* Outer glow halo */}
              <Rect x={cp.position.x} y={cp.position.y}
                width={22} height={22} offsetX={11} offsetY={11} rotation={45}
                fill="transparent" stroke={stroke} strokeWidth={0.5}
                shadowColor={stroke} shadowBlur={18} shadowOpacity={0.95}
              />

              {/* Diamond body */}
              <Rect x={cp.position.x} y={cp.position.y}
                width={16} height={16} offsetX={8} offsetY={8} rotation={45}
                fill={fill} stroke={stroke} strokeWidth={1.5}
              />

              {/* Initial letter */}
              <Text x={cp.position.x - 7} y={cp.position.y - 5}
                text={letter} fill="#ffffff" fontSize={9} fontStyle="bold"
                width={14} align="center"
              />
            </React.Fragment>
          )
        })}
      </Layer>

      {/* ── BLUE ORDER INDICATOR ── */}
      <Layer>
        {state.blueOrders.type && state.blueOrders.cpId && (() => {
          const cp    = state.controlPoints.find(c => c.id === state.blueOrders.cpId)
          if (!cp) return null
          const isAtk = state.blueOrders.type === 'attack'
          const color = isAtk ? C.RED : C.BLUE
          const pulse = state.blueOrders.timer % 1
          const outerR = 20 + pulse * 5
          return (
            <React.Fragment key="order-indicator">
              <Ring x={cp.position.x} y={cp.position.y}
                innerRadius={outerR - 3} outerRadius={outerR}
                fill={color} opacity={0.6 - pulse * 0.4}
              />
              <Ring x={cp.position.x} y={cp.position.y}
                innerRadius={13} outerRadius={16}
                fill={color} opacity={0.9}
              />
              <Text x={cp.position.x - 24} y={cp.position.y + 17}
                text={`${isAtk ? '⚔ ATK' : '🛡 DEF'}  ${Math.ceil(state.blueOrders.timer)}s`}
                fill={color} fontSize={7} fontStyle="bold"
                width={48} align="center"
              />
            </React.Fragment>
          )
        })()}
      </Layer>

      {/* ── UAV SCAN ── */}
      <Layer>
        {state.uavActive && state.uavCenter && (
          <Ring
            x={state.uavCenter.x} y={state.uavCenter.y}
            innerRadius={state.uavRadius - 4} outerRadius={state.uavRadius}
            fill={C.BLUE + '33'} stroke={C.BLUE} strokeWidth={1}
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
                  fill={`rgba(255,100,0,${0.7 - progress * 0.7})`} />
                <Circle x={fx.position.x} y={fx.position.y}
                  radius={fx.radius * (0.1 + progress * 0.4)}
                  fill={`rgba(255,230,80,${0.9 - progress * 0.9})`} />
              </React.Fragment>
            )
          }
          if (fx.type === 'uav_scan') {
            return (
              <Circle key={fx.id} x={fx.position.x} y={fx.position.y}
                radius={fx.radius * progress}
                stroke={C.BLUE} strokeWidth={2}
                fill={C.BLUE + '0d'}
              />
            )
          }
          if (fx.type === 'emp_pulse') {
            return (
              <Circle key={fx.id} x={fx.position.x} y={fx.position.y}
                radius={fx.radius * progress}
                stroke={C.SUPPRESS} strokeWidth={3}
                fill={`rgba(168,85,247,${0.1 - progress * 0.1})`}
              />
            )
          }
          if (fx.type === 'ammo_drop') {
            return (
              <React.Fragment key={fx.id}>
                <Rect x={fx.position.x - 12} y={fx.position.y - 16}
                  width={24} height={18} fill={C.COOLDOWN} cornerRadius={3}
                  opacity={1 - progress}
                />
                <Text x={fx.position.x - 9} y={fx.position.y - 13}
                  text="+HP" fill="#000" fontSize={9} fontStyle="bold"
                />
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
          const suppressed = squad.status === 'suppressed'
          const cx         = squad.position.x
          const cy         = squad.position.y

          // Action tag text
          const tag      = isBlue ? actionTag(squad, state.controlPoints) : squad.id.toUpperCase()
          const tagColor = suppressed ? C.SUPPRESS : isBlue ? C.BLUE : C.RED
          const tagW     = 58   // wider to fit "B2 / ATK A"

          return (
            <React.Fragment key={squad.id}>
              {/* Floating action tag */}
              <Rect
                x={cx - tagW / 2 - 2} y={cy - LABEL_Y - 1}
                width={tagW + 4} height={9}
                fill="rgba(0,0,0,0.50)" cornerRadius={1}
              />
              <Text
                x={cx - tagW / 2} y={cy - LABEL_Y}
                text={tag}
                fill={tagColor}
                fontSize={7} fontStyle="bold"
                width={tagW} align="center"
              />

              {/* Individual soldiers */}
              {squad.soldiers.map(sol => {
                if (sol.hp <= 0) return null
                const solHpPct = sol.hp / sol.maxHp
                const BAR_W    = 6
                const solColor = suppressed ? C.SUPPRESS : isBlue ? C.BLUE : C.RED

                return (
                  <React.Fragment key={sol.id}>
                    {/* Tiny HP bar */}
                    <Rect
                      x={sol.position.x - BAR_W / 2} y={sol.position.y - DOT_RADIUS - 3}
                      width={BAR_W} height={1} fill="#040c14" cornerRadius={0.5}
                    />
                    <Rect
                      x={sol.position.x - BAR_W / 2} y={sol.position.y - DOT_RADIUS - 3}
                      width={BAR_W * solHpPct} height={1}
                      fill={solHpPct > 0.5 ? '#00BF44' : solHpPct > 0.25 ? C.COOLDOWN : C.RED}
                      cornerRadius={0.5}
                    />

                    {/* Allied = circle · Enemy = inverted triangle */}
                    {isBlue ? (
                      <Circle
                        x={sol.position.x} y={sol.position.y}
                        radius={DOT_RADIUS}
                        fill={suppressed ? C.SUPPRESS : C.BLUE}
                        stroke={suppressed ? C.SUPPRESS : ROLE_STROKE[squad.role]}
                        strokeWidth={1}
                        opacity={suppressed ? 0.45 : 0.4 + solHpPct * 0.6}
                      />
                    ) : (
                      <RegularPolygon
                        x={sol.position.x} y={sol.position.y}
                        sides={3} radius={TRI_RADIUS}
                        rotation={180}
                        fill={solColor}
                        stroke={suppressed ? C.SUPPRESS : C.RED_DIM}
                        strokeWidth={0.5}
                        opacity={suppressed ? 0.45 : 0.45 + solHpPct * 0.55}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </React.Fragment>
          )
        })}
      </Layer>

      {/* ── SELECTION (brackets + crosshair + action line) ── */}
      <Layer>
        {selSquad && (() => {
          const cx = selSquad.position.x
          const cy = selSquad.position.y
          const S  = SEL_HALF
          const L  = SEL_LEG

          // Dashed line to target CP
          const targetCp = selSquad.targetCpId
            ? state.controlPoints.find(c => c.id === selSquad.targetCpId) : null

          return (
            <>
              {/* Dashed line to target CP */}
              {targetCp && (
                <Line
                  points={[cx, cy, targetCp.position.x, targetCp.position.y]}
                  stroke={C.BLUE} strokeWidth={1}
                  dash={[5, 4]} opacity={0.45}
                />
              )}

              {/* Crosshair */}
              <Line points={[0, cy, MAP_W, cy]}
                stroke="#ffffff" strokeWidth={0.5} opacity={0.15} />
              <Line points={[cx, 0, cx, MAP_H]}
                stroke="#ffffff" strokeWidth={0.5} opacity={0.15} />

              {/* Corner brackets */}
              <Line points={[cx-S+L, cy-S, cx-S, cy-S, cx-S, cy-S+L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx+S-L, cy-S, cx+S, cy-S, cx+S, cy-S+L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx-S+L, cy+S, cx-S, cy+S, cx-S, cy+S-L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx+S-L, cy+S, cx+S, cy+S, cx+S, cy+S-L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
            </>
          )
        })()}
      </Layer>

      {/* ── GAME OVER OVERLAY ── */}
      <Layer>
        {state.phase !== 'playing' && (
          <>
            <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="rgba(0,0,0,0.68)" />
            <Text
              x={0} y={MAP_H / 2 - 44} width={MAP_W} align="center"
              text={
                state.phase === 'victory' ? '⊕  VITÓRIA!'  :
                state.phase === 'draw'    ? '◈  EMPATE'    :
                                            '✕  DERROTA'
              }
              fill={
                state.phase === 'victory' ? '#00BF44' :
                state.phase === 'draw'    ? C.COOLDOWN :
                                            C.RED
              }
              fontSize={52} fontStyle="bold"
            />
            <Text x={0} y={MAP_H / 2 + 16} width={MAP_W} align="center"
              text={
                state.phase === 'draw'
                  ? 'Ambos os times ficaram sem tickets ao mesmo tempo'
                  : state.phase === 'victory'
                    ? 'O inimigo ficou sem reforços'
                    : 'Seus reforços acabaram'
              }
              fill="#6a8090" fontSize={15}
            />
            <Text x={0} y={MAP_H / 2 + 44} width={MAP_W} align="center"
              text="Pressione RESTART para jogar novamente"
              fill="#344a58" fontSize={13}
            />
          </>
        )}
      </Layer>
    </Stage>
  )
}
