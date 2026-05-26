import React from 'react'
import type { CSSProperties } from 'react'
import type { GameState, SelectionTarget, AbilityId, Vec2, Squad, ControlPoint } from '../types'
import { SQUAD_RESPAWN_TIME } from '../game/mapData'

interface Props {
  selection:    SelectionTarget | null
  state:        GameState
  fireAbilityAt: (id: AbilityId, pos: Vec2) => void
}

// ── Shared style tokens ───────────────────────────────────────────────────

const mono = "'Courier New', Courier, monospace"

const panel: CSSProperties = {
  width: 220,
  minWidth: 220,
  background: '#06101a',
  borderLeft: '1px solid #112236',
  color: '#7a9ab5',
  fontFamily: mono,
  fontSize: 11,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  overflowX: 'hidden',
}

const sectionTitle: CSSProperties = {
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: '2.5px',
  color: '#2d4f6a',
  padding: '7px 12px 4px',
  borderBottom: '1px solid #0e2035',
  textTransform: 'uppercase',
}

const header: CSSProperties = {
  padding: '10px 12px 8px',
  borderBottom: '1px solid #0e2035',
  background: '#081420',
}

const headerTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '1px',
  color: '#c0d8f0',
  marginBottom: 2,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 12px',
}

const hpBarTrack: CSSProperties = {
  flex: 1,
  height: 3,
  background: '#0e2035',
  borderRadius: 2,
  overflow: 'hidden',
}

// ── Ability button ────────────────────────────────────────────────────────

function AbilBtn({
  id, icon, label, pos, state, fireAbilityAt,
}: {
  id: AbilityId; icon: string; label: string
  pos: Vec2; state: GameState; fireAbilityAt: (id: AbilityId, pos: Vec2) => void
}) {
  const ab      = state.abilities.find(a => a.id === id)!
  const onCd    = ab.cooldownRemaining > 0
  const noPoints = state.commanderPoints < ab.cost
  const canUse  = !onCd && !noPoints && state.phase === 'playing'

  const reason = onCd
    ? `CD ${Math.ceil(ab.cooldownRemaining)}s`
    : noPoints ? 'sem pts' : `${ab.cost}pt`

  return (
    <button
      onClick={() => canUse && fireAbilityAt(id, pos)}
      disabled={!canUse}
      title={ab.description}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        margin: '2px 8px',
        background: canUse ? '#0b1e30' : '#060f1a',
        border: `1px solid ${canUse ? '#1a3a5c' : '#0d1e2e'}`,
        borderRadius: 3,
        color: canUse ? '#8ab4cc' : '#243547',
        fontSize: 10,
        fontFamily: mono,
        cursor: canUse ? 'pointer' : 'not-allowed',
        width: 'calc(100% - 16px)',
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 8,
        color: onCd ? '#f97316' : noPoints ? '#ef4444' : '#2d4f6a',
        fontWeight: 700,
      }}>
        {reason}
      </span>
    </button>
  )
}

// ── Role & status labels ──────────────────────────────────────────────────

const ROLE_LABEL: Record<string, { icon: string; color: string; text: string }> = {
  attack:  { icon: '⚔', color: '#f97316', text: 'ATAQUE'  },
  defend:  { icon: '🛡', color: '#3b82f6', text: 'DEFESA'  },
  hold:    { icon: '📌', color: '#22c55e', text: 'POSIÇÃO' },
  retreat: { icon: '↩', color: '#ef4444', text: 'RECUO'   },
}

const STATUS_LABEL: Record<string, { icon: string; color: string }> = {
  idle:       { icon: '●',  color: '#475569' },
  moving:     { icon: '▶',  color: '#60a5fa' },
  fighting:   { icon: '⚔', color: '#f97316' },
  suppressed: { icon: '⚡', color: '#a855f7' },
  dead:       { icon: '↺',  color: '#374151' },
}

// ── Squad HP bar ──────────────────────────────────────────────────────────

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, hp / maxHp)
  const fill = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444'
  return (
    <div style={hpBarTrack}>
      <div style={{ width: `${pct * 100}%`, height: '100%', background: fill, borderRadius: 2 }} />
    </div>
  )
}

// ── Squad mini row (used in default panel) ────────────────────────────────

function SquadRow({ squad, idx }: { squad: Squad; idx: number }) {
  const isDead     = squad.status === 'dead'
  const role       = ROLE_LABEL[squad.role]
  const status     = STATUS_LABEL[squad.status]
  const aliveSol   = squad.soldiers.filter(s => s.hp > 0).length
  const respawnPct = isDead ? 1 - squad.respawnTimer / SQUAD_RESPAWN_TIME : 0

  return (
    <div style={{
      ...rowStyle,
      opacity: isDead ? 0.45 : 1,
      paddingTop: 4, paddingBottom: 4,
      borderBottom: '1px solid #081420',
    }}>
      <span style={{ color: '#3b82f6', fontWeight: 700, minWidth: 20 }}>
        B{idx + 1}
      </span>

      <span style={{ color: role.color, fontSize: 9, minWidth: 18 }} title={squad.role}>
        {role.icon}
      </span>

      <span style={{ color: status.color, fontSize: 9, minWidth: 10 }}>
        {status.icon}
      </span>

      {isDead ? (
        <>
          <div style={{ ...hpBarTrack, background: '#1a0a0a' }}>
            <div style={{ width: `${respawnPct * 100}%`, height: '100%', background: '#7f1d1d', borderRadius: 2 }} />
          </div>
          <span style={{ color: '#7f1d1d', minWidth: 28, textAlign: 'right', fontSize: 10 }}>
            {Math.ceil(squad.respawnTimer)}s
          </span>
        </>
      ) : (
        <>
          <HpBar hp={squad.hp} maxHp={squad.maxHp} />
          <span style={{ color: '#475569', minWidth: 28, textAlign: 'right', fontSize: 10 }}>
            {aliveSol}/4
          </span>
        </>
      )}
    </div>
  )
}

// ── Sub-panels ────────────────────────────────────────────────────────────

function DefaultPanel({ state }: { state: GameState }) {
  const blue = state.squads.filter(s => s.team === 'blue')
  const red  = state.squads.filter(s => s.team === 'red')
  const redAlive = red.filter(s => s.status !== 'dead').length
  const redDead  = red.filter(s => s.status === 'dead')
  const nextRespawn = redDead.length > 0
    ? Math.min(...redDead.map(s => s.respawnTimer))
    : 0

  return (
    <>
      <div style={sectionTitle}>Esquadrões Aliados</div>
      {blue.map((sq, i) => <SquadRow key={sq.id} squad={sq} idx={i} />)}

      <div style={{ ...sectionTitle, color: '#4a2020', marginTop: 4 }}>Intel Inimiga</div>
      <div style={{ ...rowStyle, justifyContent: 'space-between', padding: '5px 12px' }}>
        <span style={{ color: '#2d4f6a' }}>Ativos</span>
        <span style={{ color: redAlive > 0 ? '#ef4444' : '#374151', fontWeight: 700 }}>
          {redAlive} / {red.length}
        </span>
      </div>
      {redDead.length > 0 && (
        <div style={{ ...rowStyle, justifyContent: 'space-between', padding: '2px 12px 5px' }}>
          <span style={{ color: '#2d4f6a' }}>Reforços</span>
          <span style={{ color: '#f97316', fontSize: 10 }}>
            {redDead.length} em {Math.ceil(nextRespawn)}s
          </span>
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 10px',
        padding: '8px 12px',
        borderTop: '1px solid #0e2035',
        marginTop: 'auto',
      }}>
        {Object.entries(ROLE_LABEL).map(([k, r]) => (
          <span key={k} style={{ color: r.color, fontSize: 9 }}>{r.icon} {r.text}</span>
        ))}
      </div>
    </>
  )
}

function SquadContextPanel({ squad, state, fireAbilityAt }: {
  squad: Squad; state: GameState; fireAbilityAt: (id: AbilityId, pos: Vec2) => void
}) {
  const role      = ROLE_LABEL[squad.role]
  const status    = STATUS_LABEL[squad.status]
  const aliveSol  = squad.soldiers.filter(s => s.hp > 0).length
  const hpPct     = squad.hp / squad.maxHp

  return (
    <>
      <div style={header}>
        <div style={{ ...headerTitle, color: '#60a5fa' }}>◈ SQUAD {squad.id.toUpperCase()}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <span style={{ color: role.color, fontSize: 10 }}>{role.icon} {role.text}</span>
          <span style={{ color: status.color, fontSize: 10 }}>{status.icon} {squad.status.toUpperCase()}</span>
        </div>
      </div>

      <div style={sectionTitle}>Status</div>

      <div style={{ ...rowStyle, justifyContent: 'space-between', padding: '5px 12px' }}>
        <span>Soldados</span>
        <span style={{ color: aliveSol > 2 ? '#22c55e' : aliveSol > 1 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
          {aliveSol} / 4
        </span>
      </div>

      <div style={{ padding: '3px 12px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: '#2d4f6a' }}>HP</span>
          <span style={{ fontSize: 10, color: '#475569' }}>
            {Math.ceil(squad.hp)} / {squad.maxHp}
          </span>
        </div>
        <HpBar hp={squad.hp} maxHp={squad.maxHp} />
      </div>

      {squad.suppressedTimer > 0 && (
        <div style={{ ...rowStyle, color: '#a855f7', fontSize: 10, padding: '2px 12px 6px' }}>
          ⚡ Suprimido {Math.ceil(squad.suppressedTimer)}s
        </div>
      )}

      <div style={sectionTitle}>Ações</div>
      <div style={{ paddingTop: 4, paddingBottom: 8 }}>
        <AbilBtn id="ammo" icon="📦" label="Suprimento" pos={squad.position} state={state} fireAbilityAt={fireAbilityAt} />
      </div>
    </>
  )
}

function CPContextPanel({ cp, state, fireAbilityAt }: {
  cp: ControlPoint; state: GameState; fireAbilityAt: (id: AbilityId, pos: Vec2) => void
}) {
  const ownerLabel = cp.owner === 'neutral' ? 'NEUTRO' : cp.owner === 'blue' ? 'ALIADO' : 'INIMIGO'
  const ownerColor = cp.owner === 'neutral' ? '#f97316' : cp.owner === 'blue' ? '#3b82f6' : '#ef4444'

  return (
    <>
      <div style={header}>
        <div style={{ ...headerTitle, color: ownerColor }}>◈ {cp.label.toUpperCase()}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{ color: ownerColor, fontSize: 10, fontWeight: 700 }}>{ownerLabel}</span>
          {cp.cappingTeam && (
            <span style={{
              color: cp.cappingTeam === 'blue' ? '#60a5fa' : '#f87171',
              fontSize: 10,
            }}>
              {cp.cappingTeam === 'blue' ? '▶' : '▶'} {Math.round(cp.captureProgress * 100)}%
            </span>
          )}
        </div>
      </div>

      {cp.cappingTeam && (
        <div style={{ padding: '6px 12px 2px' }}>
          <div style={{ ...hpBarTrack, height: 4 }}>
            <div style={{
              width: `${cp.captureProgress * 100}%`,
              height: '100%',
              background: cp.cappingTeam === 'blue' ? '#3b82f6' : '#ef4444',
              borderRadius: 2,
            }} />
          </div>
        </div>
      )}

      <div style={sectionTitle}>Ações</div>
      <div style={{ paddingTop: 4, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <AbilBtn id="artillery"    icon="💥" label="Artilharia"    pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <AbilBtn id="uav"          icon="📡" label="UAV Scan"      pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <AbilBtn id="emp"          icon="⚡" label="Pulso EMP"     pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <div style={{ margin: '4px 8px 2px', borderTop: '1px solid #0e2035' }} />
        <AbilBtn id="order_attack" icon="⚔" label="Ordem: Atacar"  pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
        <AbilBtn id="order_defend" icon="🛡" label="Ordem: Defender" pos={cp.position} state={state} fireAbilityAt={fireAbilityAt} />
      </div>
    </>
  )
}

function BaseContextPanel({ team, state }: {
  team: 'blue' | 'red'; state: GameState
}) {
  const isBlue   = team === 'blue'
  const color    = isBlue ? '#3b82f6' : '#ef4444'
  const label    = isBlue ? 'BASE ALIADA' : 'BASE INIMIGA'
  const squads   = state.squads.filter(s => s.team === team)
  const alive    = squads.filter(s => s.status !== 'dead')
  const dead     = squads.filter(s => s.status === 'dead')

  return (
    <>
      <div style={header}>
        <div style={{ ...headerTitle, color }}>{label}</div>
        <div style={{ color: '#2d4f6a', fontSize: 10, marginTop: 3 }}>
          {alive.length} ativo{alive.length !== 1 ? 's' : ''} · {dead.length} respawnando
        </div>
      </div>

      {alive.length > 0 && (
        <>
          <div style={sectionTitle}>Ativos</div>
          {alive.map((s, i) => {
            const role = ROLE_LABEL[s.role]
            const aliveSol = s.soldiers.filter(sol => sol.hp > 0).length
            return (
              <div key={s.id} style={{ ...rowStyle, padding: '4px 12px', borderBottom: '1px solid #081420' }}>
                <span style={{ color, fontWeight: 700, minWidth: 24 }}>{s.id.toUpperCase()}</span>
                <span style={{ color: role.color, fontSize: 9 }}>{role.icon}</span>
                <HpBar hp={s.hp} maxHp={s.maxHp} />
                <span style={{ color: '#475569', fontSize: 10, minWidth: 20, textAlign: 'right' }}>
                  {aliveSol}/4
                </span>
              </div>
            )
          })}
        </>
      )}

      {dead.length > 0 && (
        <>
          <div style={sectionTitle}>Respawnando</div>
          {dead.map(s => (
            <div key={s.id} style={{ ...rowStyle, padding: '4px 12px', borderBottom: '1px solid #081420' }}>
              <span style={{ color: '#374151', minWidth: 24 }}>{s.id.toUpperCase()}</span>
              <span style={{ color: '#374151', fontSize: 9 }}>↺</span>
              <div style={{ ...hpBarTrack, background: '#1a0a0a' }}>
                <div style={{
                  width: `${(1 - s.respawnTimer / SQUAD_RESPAWN_TIME) * 100}%`,
                  height: '100%',
                  background: isBlue ? '#1e3a5f' : '#5f1e1e',
                  borderRadius: 2,
                }} />
              </div>
              <span style={{ color: '#475569', fontSize: 10, minWidth: 28, textAlign: 'right' }}>
                {Math.ceil(s.respawnTimer)}s
              </span>
            </div>
          ))}
        </>
      )}
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────

export default function ContextPanel({ selection, state, fireAbilityAt }: Props) {
  let content: React.ReactNode

  if (!selection) {
    content = <DefaultPanel state={state} />
  } else if (selection.type === 'squad') {
    const squad = state.squads.find(s => s.id === selection.id && s.status !== 'dead')
    content = squad
      ? <SquadContextPanel squad={squad} state={state} fireAbilityAt={fireAbilityAt} />
      : <DefaultPanel state={state} />
  } else if (selection.type === 'cp') {
    const cp = state.controlPoints.find(c => c.id === selection.id)
    content = cp
      ? <CPContextPanel cp={cp} state={state} fireAbilityAt={fireAbilityAt} />
      : <DefaultPanel state={state} />
  } else {
    content = <BaseContextPanel team={selection.team} state={state} />
  }

  return (
    <div style={panel}>
      {content}
    </div>
  )
}
