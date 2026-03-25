import { useState } from 'react'
import clsx from 'clsx'

export default function ActionPanel({ validActions, gameState, onAction, disabled }) {
  const [raiseAmount, setRaiseAmount] = useState(0)

  if (!validActions || validActions.length === 0 || disabled) {
    return (
      <div className="flex items-center justify-center h-16 text-gray-500 text-sm italic">
        Waiting for your turn…
      </div>
    )
  }

  const fold   = validActions.find(a => a.action === 'fold')
  const check  = validActions.find(a => a.action === 'check')
  const call   = validActions.find(a => a.action === 'call')
  const raise  = validActions.find(a => a.action === 'raise')
  const allIn  = validActions.find(a => a.action === 'all_in')

  // Initialise raise slider when raise becomes available
  if (raise && raiseAmount < raise.min) setRaiseAmount(raise.min)

  const pot    = gameState?.pots?.reduce((s, p) => s + p.amount, 0) ?? 0
  const presets = raise ? [
    { label: '½ Pot', val: Math.floor(pot / 2) },
    { label: 'Pot',   val: pot },
    { label: '2×',    val: raise.min * 2 },
  ].filter(p => p.val >= raise.min && p.val <= raise.max) : []

  return (
    <div className="space-y-3">
      {/* Raise slider */}
      {raise && (
        <div className="bg-table-surface border border-table-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Raise to</span>
            <span className="text-gold font-bold font-mono">${raiseAmount.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={raise.min} max={raise.max} step={gameState?.big_blind ?? 10}
            value={raiseAmount} onChange={e => setRaiseAmount(Number(e.target.value))}
            className="w-full accent-gold"
          />
          {/* Preset buttons */}
          <div className="flex gap-2">
            {presets.map(p => (
              <button key={p.label} onClick={() => setRaiseAmount(p.val)}
                className="flex-1 text-xs py-1 rounded-lg border border-table-border text-gray-300 hover:border-gold hover:text-gold transition-colors">
                {p.label}
              </button>
            ))}
            <button onClick={() => setRaiseAmount(raise.max)}
              className="flex-1 text-xs py-1 rounded-lg border border-table-border text-gray-300 hover:border-red-500 hover:text-red-400 transition-colors">
              Max
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {fold && (
          <ActionBtn color="red" onClick={() => onAction('fold')}>
            Fold
          </ActionBtn>
        )}
        {check && (
          <ActionBtn color="gray" onClick={() => onAction('check')}>
            Check
          </ActionBtn>
        )}
        {call && (
          <ActionBtn color="blue" onClick={() => onAction('call', call.amount)}>
            Call <span className="font-mono">${call.amount}</span>
          </ActionBtn>
        )}
        {raise && (
          <ActionBtn color="green" onClick={() => onAction('raise', raiseAmount)} flex2>
            Raise to <span className="font-mono">${raiseAmount.toLocaleString()}</span>
          </ActionBtn>
        )}
        {allIn && !raise && (
          <ActionBtn color="yellow" onClick={() => onAction('all_in', allIn.amount)}>
            All-In <span className="font-mono">${allIn.amount}</span>
          </ActionBtn>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ color, onClick, children, flex2 }) {
  const colors = {
    red:    'bg-red-800/60 hover:bg-red-700 border-red-700 text-red-200',
    gray:   'bg-gray-700/60 hover:bg-gray-600 border-gray-600 text-gray-200',
    blue:   'bg-blue-800/60 hover:bg-blue-700 border-blue-700 text-blue-200',
    green:  'bg-felt/60 hover:bg-felt border-felt-light text-white',
    yellow: 'bg-gold/20 hover:bg-gold/30 border-gold text-gold',
  }

  return (
    <button onClick={onClick}
      className={clsx(
        'py-3 px-4 rounded-xl border font-semibold text-sm transition-all active:scale-95',
        colors[color],
        flex2 ? 'flex-[2]' : 'flex-1'
      )}>
      {children}
    </button>
  )
}
