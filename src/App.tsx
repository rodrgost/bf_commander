import { useState } from 'react'
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
  const { state, selectAbility, fireAbility, fireAbilityAt, restart } = useGameLoop(config)
  const [selection, setSelection] = useState<SelectionTarget | null>(null)

  const handleRestart = () => {
    setSelection(null)
    onRestart()
  }

  // Auto-clear selection when selected squad dies
  const effectiveSelection = (() => {
    if (!selection) return null
    if (selection.type === 'squad') {
      const sq = state.squads.find(s => s.id === selection.id)
      if (!sq || sq.status === 'dead') return null
    }
    return selection
  })()

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
          onSelect={setSelection}
        />
        <ContextPanel
          selection={effectiveSelection}
          state={state}
          fireAbilityAt={fireAbilityAt}
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
