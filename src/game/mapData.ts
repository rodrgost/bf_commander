import type { ControlPoint, GameConfig, GameState, Squad, AbilityState, Difficulty } from '../types'

export const MAP_W = 900
export const MAP_H = 520

export const BLUE_BASE: { x: number; y: number } = { x: 450, y: 468 }
export const RED_BASE:  { x: number; y: number } = { x: 450, y:  52 }

// Ticket system constants (defaults — runtime values live in GameState)
export const TICKET_DEATH_COST   = 10    // tickets lost when a squad is killed
export const RESPAWN_TICKET_COST = 5     // tickets lost when a squad respawns
export const SQUAD_RESPAWN_TIME  = 12    // seconds to respawn at base

// Kept as a fallback / reference; actual value is written into GameState at start
export const BLEED_RATE_PER_CP   = 0.4

// ── Control point layouts ─────────────────────────────────────────────────
// 1 CP  → king-of-the-hill (center only)
// 3 CPs → classic flanks + center
// 5 CPs → two upper flanks + center + two lower flanks (symmetric)
//
// Positions ensure RED is closer to upper CPs, BLUE to lower CPs,
// and Bravo (center) is equidistant from both bases.

const CP_LAYOUTS: Record<1 | 3 | 5, ControlPoint[]> = {
  1: [
    { id: 'bravo',   label: 'Bravo',   position: { x: 450, y: 260 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
  ],
  3: [
    { id: 'alpha',   label: 'Alpha',   position: { x: 200, y: 210 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
    { id: 'bravo',   label: 'Bravo',   position: { x: 450, y: 260 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
    { id: 'charlie', label: 'Charlie', position: { x: 700, y: 210 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
  ],
  5: [
    // Upper flanks — closer to RED base
    { id: 'alpha',   label: 'Alpha',   position: { x: 210, y: 175 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
    { id: 'charlie', label: 'Charlie', position: { x: 690, y: 175 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
    // Center — equidistant
    { id: 'bravo',   label: 'Bravo',   position: { x: 450, y: 260 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
    // Lower flanks — closer to BLUE base
    { id: 'delta',   label: 'Delta',   position: { x: 210, y: 345 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
    { id: 'echo',    label: 'Echo',    position: { x: 690, y: 345 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
  ],
}

// ── Difficulty settings ───────────────────────────────────────────────────

const DIFFICULTY: Record<Difficulty, { bleedRatePerCp: number; minGameTime: number }> = {
  easy:   { bleedRatePerCp: 0.20, minGameTime:  60 },   // fast unlock, slow bleed
  normal: { bleedRatePerCp: 0.40, minGameTime: 300 },   // balanced
  hard:   { bleedRatePerCp: 0.70, minGameTime: 300 },   // fast bleed, merciless AI
}

// ── Default config ────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: GameConfig = {
  blueSquads:     4,
  redSquads:      4,
  cpCount:        3,
  initialTickets: 200,
  difficulty:     'normal',
}

// ── Soldier helpers ───────────────────────────────────────────────────────

const SOLDIER_COUNT   = 4
const SOLDIER_MAX_HP  = 25   // 4 × 25 = 100 total HP per squad

const SOLDIER_OFFSETS = [
  { dx: -5, dy: -5 },
  { dx:  5, dy: -5 },
  { dx: -5, dy:  5 },
  { dx:  5, dy:  5 },
]

function makeSoldiers(squadId: string, cx: number, cy: number) {
  return SOLDIER_OFFSETS.slice(0, SOLDIER_COUNT).map((off, i) => ({
    id: `${squadId}_${i}`,
    position: { x: cx + off.dx, y: cy + off.dy },
    hp: SOLDIER_MAX_HP,
    maxHp: SOLDIER_MAX_HP,
  }))
}

function generateSquads(blueCount: number, redCount: number): Squad[] {
  const squads: Squad[] = []

  for (let i = 0; i < blueCount; i++) {
    const cx = BLUE_BASE.x + (i - (blueCount - 1) / 2) * 40
    const cy = BLUE_BASE.y - 20
    const id = `b${i + 1}`
    squads.push({
      id, team: 'blue',
      soldiers: makeSoldiers(id, cx, cy),
      position: { x: cx, y: cy },
      hp: SOLDIER_COUNT * SOLDIER_MAX_HP,
      maxHp: SOLDIER_COUNT * SOLDIER_MAX_HP,
      status: 'idle', role: 'attack', targetCpId: null,
      suppressedTimer: 0, revealedTimer: 0, respawnTimer: 0,
    })
  }

  for (let i = 0; i < redCount; i++) {
    const cx = RED_BASE.x + (i - (redCount - 1) / 2) * 40
    const cy = RED_BASE.y + 20
    const id = `r${i + 1}`
    squads.push({
      id, team: 'red',
      soldiers: makeSoldiers(id, cx, cy),
      position: { x: cx, y: cy },
      hp: SOLDIER_COUNT * SOLDIER_MAX_HP,
      maxHp: SOLDIER_COUNT * SOLDIER_MAX_HP,
      status: 'idle', role: 'attack', targetCpId: null,
      suppressedTimer: 0, revealedTimer: 0, respawnTimer: 0,
    })
  }

  return squads
}

// ── Abilities ─────────────────────────────────────────────────────────────

export const INITIAL_ABILITIES: AbilityState[] = [
  { id: 'uav',          label: 'UAV',       cost: 15, cooldownMax: 20, cooldownRemaining: 0, description: 'Revela inimigos em área por 8s' },
  { id: 'artillery',    label: 'Artillery', cost: 30, cooldownMax: 35, cooldownRemaining: 0, description: 'Bombardeia área causando 40hp de dano' },
  { id: 'ammo',         label: 'Ammo Drop', cost: 20, cooldownMax: 25, cooldownRemaining: 0, description: 'Restaura 50hp ao squad aliado mais próximo' },
  { id: 'emp',          label: 'EMP',       cost: 25, cooldownMax: 30, cooldownRemaining: 0, description: 'Paralisa inimigos em área por 6s' },
  { id: 'order_attack', label: 'Atacar',    cost: 10, cooldownMax: 20, cooldownRemaining: 0, description: 'Ordena todos os squads aliados a atacar um objetivo por 25s' },
  { id: 'order_defend', label: 'Defender',  cost: 10, cooldownMax: 20, cooldownRemaining: 0, description: 'Ordena todos os squads aliados a defender um objetivo por 25s' },
]

// ── Initial state ─────────────────────────────────────────────────────────

export function createInitialState(config: GameConfig = DEFAULT_CONFIG): GameState {
  const cpCount = (config.cpCount ?? 3) as 1 | 3 | 5
  const difficulty = config.difficulty ?? 'normal'
  const { bleedRatePerCp, minGameTime } = DIFFICULTY[difficulty]
  const tickets = config.initialTickets ?? 200

  return {
    phase:              'playing',
    squads:             generateSquads(config.blueSquads, config.redSquads),
    controlPoints:      CP_LAYOUTS[cpCount].map(cp => ({ ...cp, position: { ...cp.position } })),
    commanderPoints:    50,
    commanderPointsMax: 100,
    abilities:          INITIAL_ABILITIES.map(a => ({ ...a })),
    effects:            [],
    uavActive:          false,
    uavTimer:           0,
    uavCenter:          null,
    uavRadius:          200,
    pendingAbility:     null,
    elapsed:            0,
    blueTickets:        tickets,
    redTickets:         tickets,
    ticketsMax:         tickets,
    minGameTime,
    bleedRatePerCp,
    redAI:              { cpPressure: {} },
    blueOrders:         { type: null, cpId: null, timer: 0 },
  }
}
