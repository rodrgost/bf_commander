import { useState, useEffect } from 'react'
import type { GameConfig, SelectionTarget } from './types'
import { useGameLoop } from './hooks/useGameLoop'
import GameCanvas from './components/GameCanvas'
import HUD from './components/HUD'
import AbilityBar from './components/AbilityBar'
import ContextPanel from './components/ContextPanel'
import ConfigScreen from './components/ConfigScreen'
import styles from './App.module.css'

export default function App() {
  const [config, setConfig] = useState<GameConfig | null>(null)

  if (!config) {
    return <ConfigScreen onStart={cfg => setConfig(cfg)} />
  }

  return <Game config={config} onRestart={() => setConfig(null)} />
}

// Separate component so useGameLoop only mounts after config is set
function Game({ config, onRestart }: { config: GameConfig; onRestart: () => void }) {
  const { state, selectAbility, fireAbility, fireAbilityAt, setSquadOrders, restart } = useGameLoop(config)
  const [selection, setSelection] = useState<SelectionTarget | null>(null)

  // Pending squad-target mode: player clicked "Definir Alvo" and must now pick a CP
  const [pendingSquadTarget, setPendingSquadTarget] = useState(false)

  // Escape cancels squad-target mode (ability Escape is handled in useGameLoop)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingSquadTarget(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleRestart = () => {
    setSelection(null)
    setPendingSquadTarget(false)
    onRestart()
  }

  // Auto-clear selection when selected squads die; filter dead ids out of multi-select
  const effectiveSelection = (() => {
    if (!selection) return null
    if (selection.type === 'squad') {
      const aliveIds = selection.ids.filter(id => {
        const sq = state.squads.find(s => s.id === id)
        return sq && sq.status !== 'dead'
      })
      if (aliveIds.length === 0) return null
      return { type: 'squad' as const, ids: aliveIds }
    }
    return selection
  })()

  // When squad-target mode is active and the user picks a CP on the canvas
  const handleSquadTarget = (cpId: string) => {
    if (!effectiveSelection || effectiveSelection.type !== 'squad') return
    setSquadOrders(effectiveSelection.ids, { manualTargetCpId: cpId })
    setPendingSquadTarget(false)
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <span className={styles.logo}>◈ COMMANDER MODE</span>
        <span className={styles.subtitle}>BF4 MVP</span>
      </header>

      <HUD state={state} onRestart={handleRestart} />

      <div className={styles.main}>
        <GameCanvas
          state={state}
          onMapClick={fireAbility}
          selection={effectiveSelection}
          onSelect={sel => { setSelection(sel); setPendingSquadTarget(false) }}
          pendingSquadTarget={pendingSquadTarget}
          onSquadTarget={handleSquadTarget}
        />
        <ContextPanel
          selection={effectiveSelection}
          onSelect={setSelection}
          state={state}
          fireAbilityAt={fireAbilityAt}
          setSquadOrders={setSquadOrders}
          pendingSquadTarget={pendingSquadTarget}
          setPendingSquadTarget={setPendingSquadTarget}
        />
      </div>

      <AbilityBar
        abilities={state.abilities}
        commanderPoints={state.commanderPoints}
        pendingAbility={state.pendingAbility}
        onSelect={selectAbility}
        phase={state.phase}
      />
    </div>
  )
}
