import type { ControlPoint, GameConfig, GameState, Squad, AbilityState } from '../types'

export const MAP_W = 900
export const MAP_H = 520

export const BLUE_BASE: { x: number; y: number } = { x: 450, y: 468 }
export const RED_BASE:  { x: number; y: number } = { x: 450, y:  52 }

// Ticket system constants
export const INITIAL_TICKETS      = 200   // each team starts with this
export const TICKET_DEATH_COST    = 10    // tickets lost when a squad is killed
export const RESPAWN_TICKET_COST  = 5     // tickets lost when a squad respawns (reinforcement cost)
export const MIN_GAME_TIME        = 300   // 5 minutes before tickets can end the game

// Bleeding rate: tickets/s lost per CP advantage the enemy has.
// 1 CP adv → 0.4/s  (200 tickets ~ 8.3 min)
// 2 CP adv → 0.8/s  (200 tickets ~ 4.2 min)
// 3 CP adv → 1.2/s  (200 tickets ~ 2.8 min)
export const BLEED_RATE_PER_CP = 0.4

export const SQUAD_RESPAWN_TIME = 12      // seconds to respawn at base

export const CONTROL_POINTS: ControlPoint[] = [
  { id: 'alpha',   label: 'Alpha',   position: { x: 200, y: 210 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
  { id: 'bravo',   label: 'Bravo',   position: { x: 450, y: 260 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
  { id: 'charlie', label: 'Charlie', position: { x: 700, y: 210 }, owner: 'neutral', captureProgress: 0, cappingTeam: null },
]

export const DEFAULT_CONFIG: GameConfig = { blueSquads: 4, redSquads: 4 }

const SOLDIER_COUNT   = 4
const SOLDIER_MAX_HP  = 25   // 4 × 25 = 100 total HP per squad

// 2×2 grid offsets around the squad spawn point
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

export const INITIAL_ABILITIES: AbilityState[] = [
  { id: 'uav',          label: 'UAV',       cost: 15, cooldownMax: 20, cooldownRemaining: 0, description: 'Revela inimigos em área por 8s' },
  { id: 'artillery',    label: 'Artillery', cost: 30, cooldownMax: 35, cooldownRemaining: 0, description: 'Bombardeia área causando 40hp de dano' },
  { id: 'ammo',         label: 'Ammo Drop', cost: 20, cooldownMax: 25, cooldownRemaining: 0, description: 'Restaura 50hp ao squad aliado mais próximo' },
  { id: 'emp',          label: 'EMP',       cost: 25, cooldownMax: 30, cooldownRemaining: 0, description: 'Paralisa inimigos em área por 6s' },
  { id: 'order_attack', label: 'Atacar',    cost: 10, cooldownMax: 20, cooldownRemaining: 0, description: 'Ordena todos os squads aliados a atacar um objetivo por 25s' },
  { id: 'order_defend', label: 'Defender',  cost: 10, cooldownMax: 20, cooldownRemaining: 0, description: 'Ordena todos os squads aliados a defender um objetivo por 25s' },
]

export function createInitialState(config: GameConfig = DEFAULT_CONFIG): GameState {
  return {
    phase: 'playing',
    squads: generateSquads(config.blueSquads, config.redSquads),
    controlPoints: CONTROL_POINTS.map(cp => ({ ...cp, position: { ...cp.position } })),
    commanderPoints: 50,
    commanderPointsMax: 100,
    abilities: INITIAL_ABILITIES.map(a => ({ ...a })),
    effects: [],
    uavActive: false,
    uavTimer: 0,
    uavCenter: null,
    uavRadius: 200,
    pendingAbility: null,
    elapsed: 0,
    blueTickets: INITIAL_TICKETS,
    redTickets:  INITIAL_TICKETS,
    ticketsMax:  INITIAL_TICKETS,
    minGameTime: MIN_GAME_TIME,
    redAI: { cpPressure: {} },
    blueOrders: { type: null, cpId: null, timer: 0 },
  }
}
