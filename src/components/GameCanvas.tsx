import React from 'react'
import { Stage, Layer, Rect, Circle, Text, Arc, Ring, Line, RegularPolygon } from 'react-konva'
import type { GameState, Squad, Vec2, SelectionTarget } from '../types'
import { MAP_W, MAP_H, BLUE_BASE, RED_BASE, squadNatoShort } from '../game/mapData'
import { VISION_RANGE } from '../game/units'
import type { KonvaEventObject } from 'konva/lib/Node'
import MapBackground from './MapBackground'
import UAVOverlay from './UAVOverlay'

const DISPLAY_SCALE = 1.0

// ── BF4 colour palette ────────────────────────────────────────────────────
const C = {
  BLUE:         '#00C8FF',
  BLUE_DIM:     '#0065CC',
  BLUE_BG:      '#03101a',
  RED:          '#FF6633',
  RED_DIM:      '#CC3300',
  RED_BG:       '#1a0800',
  NEUTRAL:      '#555880',
  NEUTRAL_BG:   '#0d0d14',
  COOLDOWN:     '#FFCC00',
  SUPPRESS:     '#a855f7',
  MAP_BG:       '#111A22',
  GRID:         '#ffffff06',
  TEXT_DIM:     '#4a6278',
}

// Soldier / label sizes
const DOT_RADIUS  = 2
const TRI_RADIUS  = 3.2
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
  state:              GameState
  onMapClick:         (pos: Vec2) => void
  selection:          SelectionTarget | null
  onSelect:           (sel: SelectionTarget | null) => void
  pendingSquadTarget: boolean
  onSquadTarget:      (cpId: string) => void
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

// Squad action tag text: "BRV / ATK A", "CHR / DEF B", …
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function actionTag(squad: Squad, cps: any[]): string {
  const callsign = squadNatoShort(squad.id)
  // Show manual target indicator
  if (squad.manualTargetCpId) {
    const cp = cps.find((c: { id: string; label: string }) => c.id === squad.manualTargetCpId)
    if (cp) return `${callsign} ▶ ${cp.label[0]}`
  }
  if (!squad.targetCpId) return callsign
  const cp = cps.find((c: { id: string; label: string }) => c.id === squad.targetCpId)
  if (!cp) return callsign
  const verb =
    squad.role === 'defend'  ? 'DEF' :
    squad.role === 'retreat' ? 'RET' :
    squad.role === 'hold'    ? 'HLD' : 'ATK'
  return `${callsign} / ${verb} ${cp.label[0]}`
}

export default function GameCanvas({
  state, onMapClick, selection, onSelect,
  pendingSquadTarget, onSquadTarget,
}: Props) {

  const selectedIds = selection?.type === 'squad' ? selection.ids : []

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (state.phase !== 'playing') return
    const stage = e.target.getStage()
    const pos   = stage?.getPointerPosition()
    if (!pos) return
    const gx = pos.x / DISPLAY_SCALE
    const gy = pos.y / DISPLAY_SCALE
    const ctrl = e.evt.ctrlKey || e.evt.metaKey

    // ── If ability pending → fire it ──────────────────────────────────────
    if (state.pendingAbility) { onMapClick({ x: gx, y: gy }); return }

    // ── If squad-target mode → clicking a CP sets manual target ───────────
    if (pendingSquadTarget) {
      for (const cp of state.controlPoints) {
        if (Math.hypot(cp.position.x - gx, cp.position.y - gy) < CLICK_CP_R) {
          onSquadTarget(cp.id)
          return
        }
      }
      // Clicked empty space — cancel target mode (App toggles pendingSquadTarget off via onSelect)
      onSelect(selection)   // keep squad selection, just exit target mode
      return
    }

    // ── Priority 1 — CPs ──────────────────────────────────────────────────
    let nearCp: typeof state.controlPoints[0] | null = null
    let nearCpD = CLICK_CP_R
    for (const cp of state.controlPoints) {
      const d = Math.hypot(cp.position.x - gx, cp.position.y - gy)
      if (d < nearCpD) { nearCpD = d; nearCp = cp }
    }
    if (nearCp && !ctrl) {
      const sel: SelectionTarget = { type: 'cp', id: nearCp.id }
      onSelect(selection?.type === 'cp' && selection.id === nearCp.id ? null : sel)
      return
    }

    // ── Priority 2 — Bases ────────────────────────────────────────────────
    if (!ctrl) {
      if (Math.hypot(BLUE_BASE.x - gx, BLUE_BASE.y - gy) < CLICK_BASE_R) {
        onSelect(selection?.type === 'base' && selection.team === 'blue' ? null : { type: 'base', team: 'blue' })
        return
      }
      if (Math.hypot(RED_BASE.x - gx, RED_BASE.y - gy) < CLICK_BASE_R) {
        onSelect(selection?.type === 'base' && selection.team === 'red' ? null : { type: 'base', team: 'red' })
        return
      }
    }

    // ── Priority 3 — Blue squad soldiers (supports Ctrl+click multi-select)
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
      const clickedId = best.squad.id
      if (ctrl && selectedIds.length > 0) {
        // Ctrl+click: toggle this squad in multi-selection
        const newIds = selectedIds.includes(clickedId)
          ? selectedIds.filter(id => id !== clickedId)   // remove if already selected
          : [...selectedIds, clickedId]                   // add if not selected
        onSelect(newIds.length > 0 ? { type: 'squad', ids: newIds } : null)
      } else {
        // Regular click: single-select (or deselect if same)
        const alreadySel = selection?.type === 'squad' && selection.ids.length === 1 && selection.ids[0] === clickedId
        onSelect(alreadySel ? null : { type: 'squad', ids: [clickedId] })
      }
      return
    }

    // ── Nothing hit → deselect ────────────────────────────────────────────
    onSelect(null)
  }

  const selCp       = selection?.type === 'cp'
    ? state.controlPoints.find(c => c.id === selection.id) ?? null : null
  const selBaseTeam = selection?.type === 'base' ? selection.team : null

  // Cursor style
  const cursor = pendingSquadTarget
    ? 'crosshair'
    : state.pendingAbility ? 'crosshair' : 'default'

  return (
    <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
      {/* Satellite map background */}
      <MapBackground width={MAP_W * DISPLAY_SCALE} height={MAP_H * DISPLAY_SCALE} zoom={state.mapZoom} />

      {/* UAV surveillance camera effects */}
      <UAVOverlay width={MAP_W * DISPLAY_SCALE} height={MAP_H * DISPLAY_SCALE} />

    <Stage
      width={MAP_W * DISPLAY_SCALE}
      height={MAP_H * DISPLAY_SCALE}
      scaleX={DISPLAY_SCALE}
      scaleY={DISPLAY_SCALE}
      onClick={handleClick}
      style={{ cursor, border: `1px solid ${C.BLUE_DIM}55`, display: 'block', position: 'relative', zIndex: 1 }}
    >
      {/* ── BACKGROUND (transparent — satellite map shows through) ── */}
      <Layer>
        {/* Very subtle dark vignette to ground the game elements */}
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="rgba(4,9,15,0.30)" />

        {/* Military grid — slightly more visible over satellite */}
        {Array.from({ length: Math.floor(MAP_W / 100) + 1 }).map((_, i) => (
          <Rect key={`gv${i}`} x={i * 100} y={0} width={1} height={MAP_H} fill="#ffffff09" />
        ))}
        {Array.from({ length: Math.floor(MAP_H / 100) + 1 }).map((_, i) => (
          <Rect key={`gh${i}`} x={0} y={i * 100} width={MAP_W} height={1} fill="#ffffff09" />
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

          // Highlight CPs that are manual targets of selected squads
          const isManualTarget = selectedIds.some(id => {
            const sq = state.squads.find(s => s.id === id)
            return sq?.manualTargetCpId === cp.id
          })

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

              {/* Manual target glow */}
              {isManualTarget && (
                <Ring x={cp.position.x} y={cp.position.y}
                  innerRadius={22} outerRadius={26}
                  fill={C.COOLDOWN} opacity={0.6}
                />
              )}

              {/* Selection highlight */}
              {isSel && (
                <Ring x={cp.position.x} y={cp.position.y}
                  innerRadius={20} outerRadius={24}
                  fill={stroke} opacity={0.45}
                />
              )}

              {/* Shape depends on ownership:
                    blue    → axis-aligned square
                    red     → diamond (rotated square)
                    neutral → diamond (rotated square)  */}
              {cp.owner === 'blue' ? (
                // ── Square (axis-aligned) ──────────────────────────────────
                <>
                  <Rect x={cp.position.x} y={cp.position.y}
                    width={22} height={22} offsetX={11} offsetY={11}
                    fill="transparent" strokeWidth={0}
                    shadowColor={stroke} shadowBlur={18} shadowOpacity={0.95}
                  />
                  <Rect x={cp.position.x} y={cp.position.y}
                    width={16} height={16} offsetX={8} offsetY={8}
                    fill={fill} stroke={stroke} strokeWidth={1.5}
                  />
                </>
              ) : (
                // ── Diamond (rotated square) — red & neutral ──────────────
                <>
                  <Rect x={cp.position.x} y={cp.position.y}
                    width={22} height={22} offsetX={11} offsetY={11} rotation={45}
                    fill="transparent" strokeWidth={0}
                    shadowColor={stroke} shadowBlur={18} shadowOpacity={0.95}
                  />
                  <Rect x={cp.position.x} y={cp.position.y}
                    width={16} height={16} offsetX={8} offsetY={8} rotation={45}
                    fill={fill} stroke={stroke} strokeWidth={1.5}
                  />
                </>
              )}

              {/* Letter — pixel-perfect centre of the shape.
                  Text node: width=14, align=center  → horizontal centre = x+7 = cp.x ✓
                  fontSize=9, lineHeight≈1 → vertical centre ≈ y + 4.5; offset by -4 gives cp.y ✓ */}
              <Text
                x={cp.position.x - 7} y={cp.position.y - 4}
                text={letter} fill="#fff" fontSize={9} fontStyle="bold"
                fontFamily="'Courier New', Courier, monospace"
                width={14} align="center"
              />

              {/* "Click to assign" hint when in target-pick mode */}
              {pendingSquadTarget && (
                <Ring x={cp.position.x} y={cp.position.y}
                  innerRadius={28} outerRadius={31}
                  fill={C.COOLDOWN} opacity={0.5}
                />
              )}
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

          const tag      = isBlue ? actionTag(squad, state.controlPoints) : squadNatoShort(squad.id)
          const tagColor = suppressed ? C.SUPPRESS
            : squad.berserker    ? '#FF3366'     // berserker = bright magenta-red
            : isBlue             ? C.BLUE : C.RED
          const tagW = 64

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
                const solColor = suppressed ? C.SUPPRESS
                  : squad.berserker && isBlue ? '#FF3366'
                  : isBlue ? C.BLUE : C.RED

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
                        fill={suppressed ? C.SUPPRESS : solColor}
                        stroke={suppressed ? C.SUPPRESS : squad.berserker ? '#FF3366' : ROLE_STROKE[squad.role]}
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

      {/* ── SELECTION (brackets + crosshair + action lines) ── */}
      <Layer>
        {selectedIds.map(sqId => {
          const sq = state.squads.find(s => s.id === sqId && s.status !== 'dead')
          if (!sq) return null
          const cx = sq.position.x
          const cy = sq.position.y
          const S  = SEL_HALF
          const L  = SEL_LEG

          // Dashed line to manual target (yellow) or AI target (blue)
          const manualCp = sq.manualTargetCpId
            ? state.controlPoints.find(c => c.id === sq.manualTargetCpId) : null
          const aiCp = !manualCp && sq.targetCpId
            ? state.controlPoints.find(c => c.id === sq.targetCpId) : null
          const targetCp = manualCp ?? aiCp

          const onlyOne = selectedIds.length === 1

          return (
            <React.Fragment key={sqId}>
              {/* Line to target CP */}
              {targetCp && (
                <Line
                  points={[cx, cy, targetCp.position.x, targetCp.position.y]}
                  stroke={manualCp ? C.COOLDOWN : C.BLUE}
                  strokeWidth={manualCp ? 1.5 : 1}
                  dash={[5, 4]} opacity={0.55}
                />
              )}

              {/* Crosshair only when single-selected */}
              {onlyOne && <>
                <Line points={[0, cy, MAP_W, cy]}
                  stroke="#ffffff" strokeWidth={0.5} opacity={0.12} />
                <Line points={[cx, 0, cx, MAP_H]}
                  stroke="#ffffff" strokeWidth={0.5} opacity={0.12} />
              </>}

              {/* Corner brackets */}
              <Line points={[cx-S+L, cy-S, cx-S, cy-S, cx-S, cy-S+L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx+S-L, cy-S, cx+S, cy-S, cx+S, cy-S+L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx-S+L, cy+S, cx-S, cy+S, cx-S, cy+S-L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
              <Line points={[cx+S-L, cy+S, cx+S, cy+S, cx+S, cy+S-L]}
                stroke="#ffffff" strokeWidth={1.5} opacity={0.95} lineJoin="miter" />
            </React.Fragment>
          )
        })}

        {/* Squad-target mode hint banner */}
        {pendingSquadTarget && (
          <>
            <Rect x={0} y={0} width={MAP_W} height={18} fill="rgba(255,204,0,0.12)" />
            <Text x={0} y={3} width={MAP_W} align="center"
              text={`🎯 CLIQUE EM UM PONTO DE CONTROLE PARA DESIGNAR ALVO  (${selectedIds.length} squad${selectedIds.length > 1 ? 's' : ''})`}
              fill={C.COOLDOWN} fontSize={8} fontStyle="bold"
            />
          </>
        )}
      </Layer>

      {/* ── MAP-EMBEDDED HUD (timer + CP score) ── */}
      <Layer>
        {(() => {
          const mono = "'Courier New', Courier, monospace"
          const hasLimit  = state.maxGameTime > 0
          const remaining = hasLimit ? Math.max(0, state.maxGameTime - state.elapsed) : 0
          const urgent    = hasLimit && remaining <= 60 && state.phase === 'playing'
          const seconds   = hasLimit ? remaining : state.elapsed
          const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
          const ss = String(Math.floor(seconds % 60)).padStart(2, '0')
          const timerText = `${mm}:${ss}`
          const timerColor = urgent
            ? (Math.floor(state.elapsed * 2) % 2 === 0 ? '#FF3333' : '#FF6633')
            : '#FFCC00'

          const blueCPs = state.controlPoints.filter(cp => cp.owner === 'blue').length
          const redCPs  = state.controlPoints.filter(cp => cp.owner === 'red').length
          const cpCount = state.controlPoints.length

          // Layout: timer centred at top, CP row below it
          const cx      = MAP_W / 2
          const timerY  = 7
          const cpRowY  = 29

          // Width of CP badge row: each badge is 16px + 3px gap
          const BADGE_W   = 16
          const BADGE_GAP = 3
          const rowW      = cpCount * (BADGE_W + BADGE_GAP) - BADGE_GAP
          const scoreW    = 20   // space for the number on each side
          const totalW    = scoreW + 6 + rowW + 6 + scoreW
          const rowLeft   = cx - totalW / 2

          return (
            <>
              {/* Timer background pill */}
              <Rect
                x={cx - 38} y={timerY - 2}
                width={76} height={18}
                fill="rgba(0,5,12,0.70)" cornerRadius={3}
              />
              {/* Timer text */}
              <Text
                x={cx - 36} y={timerY}
                text={hasLimit ? `⏱ ${timerText}` : timerText}
                fill={timerColor}
                fontSize={12} fontStyle="bold" fontFamily={mono}
                width={72} align="center"
              />

              {/* CP score background */}
              <Rect
                x={cx - totalW / 2 - 6} y={cpRowY - 3}
                width={totalW + 12} height={22}
                fill="rgba(0,5,12,0.65)" cornerRadius={3}
              />

              {/* Blue CP count */}
              <Text
                x={rowLeft} y={cpRowY}
                text={String(blueCPs)}
                fill="#00C8FF" fontSize={14} fontStyle="bold" fontFamily={mono}
                width={scoreW} align="center"
              />

              {/* CP badges */}
              {state.controlPoints.map((cp, i) => {
                const bx = rowLeft + scoreW + 6 + i * (BADGE_W + BADGE_GAP)
                const by = cpRowY
                const col = cp.owner === 'blue' ? '#00C8FF'
                          : cp.owner === 'red'  ? '#FF6633' : '#555880'
                const bg  = cp.owner === 'blue' ? '#001e2e'
                          : cp.owner === 'red'  ? '#2a0a00' : '#121220'
                const capCol = cp.cappingTeam === 'blue' ? '#00C8FF88' : '#FF663388'

                return (
                  <React.Fragment key={cp.id}>
                    {/* Badge background */}
                    <Rect x={bx} y={by} width={BADGE_W} height={16}
                      fill={bg} stroke={cp.cappingTeam ? capCol : col + '55'}
                      strokeWidth={1} cornerRadius={2}
                    />
                    {/* Capture fill */}
                    {cp.cappingTeam && cp.captureProgress > 0 && (
                      <Rect x={bx} y={by + 16 - 16 * cp.captureProgress}
                        width={BADGE_W} height={16 * cp.captureProgress}
                        fill={capCol} cornerRadius={2}
                      />
                    )}
                    {/* Letter */}
                    <Text x={bx} y={by + 3}
                      text={cp.label[0]} fill={col}
                      fontSize={9} fontStyle="bold" fontFamily={mono}
                      width={BADGE_W} align="center"
                    />
                  </React.Fragment>
                )
              })}

              {/* Red CP count */}
              <Text
                x={rowLeft + scoreW + 6 + rowW + 6} y={cpRowY}
                text={String(redCPs)}
                fill="#FF6633" fontSize={14} fontStyle="bold" fontFamily={mono}
                width={scoreW} align="center"
              />

              {/* ── Ticket bars ── */}
              {(() => {
                const tkY     = cpRowY + 26    // row below CP badges
                const BAR_H   = 6
                const NUM_W   = 28
                const LABEL_W = 18
                const GAP     = 4
                const half    = MAP_W / 2 - 10  // available width per side
                const barW    = half - NUM_W - LABEL_W - GAP * 2

                const bluePct = Math.max(0, state.blueTickets / state.ticketsMax)
                const redPct  = Math.max(0, state.redTickets  / state.ticketsMax)

                const blueCol = bluePct < 0.10 ? '#FF3333' : bluePct < 0.25 ? '#FFCC00' : '#00C8FF'
                const redCol  = redPct  < 0.10 ? '#FF3333' : redPct  < 0.25 ? '#FFCC00' : '#FF6633'

                // US side: label | bar→ | number   (left half)
                const usLabelX = 10
                const usBarX   = usLabelX + LABEL_W + GAP
                const usNumX   = usBarX + barW + GAP

                // CN side: number | ←bar | label   (right half, mirrored)
                const cnNumX   = MAP_W / 2 + 10
                const cnBarX   = cnNumX + NUM_W + GAP
                const cnLabelX = cnBarX + barW + GAP

                return (
                  <>
                    {/* Background pill */}
                    <Rect x={8} y={tkY - 3} width={MAP_W - 16} height={BAR_H + 8}
                      fill="rgba(0,5,12,0.65)" cornerRadius={3}
                    />

                    {/* US label */}
                    <Text x={usLabelX} y={tkY} text="US"
                      fill={blueCol} fontSize={8} fontStyle="bold" fontFamily={mono}
                      width={LABEL_W} align="right"
                    />
                    {/* US bar track */}
                    <Rect x={usBarX} y={tkY} width={barW} height={BAR_H}
                      fill="#0a1828" cornerRadius={2}
                    />
                    {/* US bar fill */}
                    <Rect x={usBarX} y={tkY} width={barW * bluePct} height={BAR_H}
                      fill={blueCol} cornerRadius={2}
                    />
                    {/* US value */}
                    <Text x={usNumX} y={tkY - 1} text={String(Math.ceil(state.blueTickets))}
                      fill={blueCol} fontSize={9} fontStyle="bold" fontFamily={mono}
                      width={NUM_W} align="left"
                    />

                    {/* CN value */}
                    <Text x={cnNumX} y={tkY - 1} text={String(Math.ceil(state.redTickets))}
                      fill={redCol} fontSize={9} fontStyle="bold" fontFamily={mono}
                      width={NUM_W} align="right"
                    />
                    {/* CN bar track */}
                    <Rect x={cnBarX} y={tkY} width={barW} height={BAR_H}
                      fill="#1a0800" cornerRadius={2}
                    />
                    {/* CN bar fill — grows right-to-left */}
                    <Rect x={cnBarX + barW * (1 - redPct)} y={tkY}
                      width={barW * redPct} height={BAR_H}
                      fill={redCol} cornerRadius={2}
                    />
                    {/* CN label */}
                    <Text x={cnLabelX} y={tkY} text="CN"
                      fill={redCol} fontSize={8} fontStyle="bold" fontFamily={mono}
                      width={LABEL_W} align="left"
                    />
                  </>
                )
              })()}
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
              text={(() => {
                const timesUp = state.maxGameTime > 0 && state.elapsed >= state.maxGameTime
                if (state.phase === 'draw')    return timesUp ? 'Tempo esgotado — tickets empatados' : 'Ambos os times ficaram sem tickets'
                if (state.phase === 'victory') return timesUp ? 'Tempo esgotado — US tinha mais tickets' : 'O inimigo ficou sem reforços'
                return timesUp ? 'Tempo esgotado — CN tinha mais tickets' : 'Seus reforços acabaram'
              })()}
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
    </div>
  )
}
