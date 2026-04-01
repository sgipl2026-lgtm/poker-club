import { useEffect, useState } from 'react'
import clsx from 'clsx'

const VARIANTS = [
  { key: 'texas_holdem', name: "Texas Hold'em" },
  { key: 'omaha',        name: 'Omaha' },
  { key: 'omaha_hilo',   name: 'Omaha Hi-Lo' },
]

export default function WinnersOverlay({
  winners, isAdmin, isDealerChoice,
  selectedVariant, onVariantChange, onNextHand, onDismiss
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (winners) setVisible(true)
    else setVisible(false)
  }, [winners])

  if (!winners) return null

  const dismiss = () => { setVisible(false); setTimeout(onDismiss, 300) }

  return (
    <div className={clsx(
      'fixed inset-0 z-50 flex items-center justify-center bg-black/75 transition-opacity duration-300',
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
    )}>
      <div className="bg-table-surface border border-gold/30 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="font-display text-xl text-gold font-bold">Hand Complete!</h2>
        </div>

        {/* Winners list */}
        <div className="space-y-2 mb-5">
          {winners.map((w, i) => (
            <div key={i} className="bg-felt/10 border border-felt/30 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-sm">{w.username}</div>
                <div className="text-xs text-gray-400">{w.pot} · {w.hand?.rank_name}</div>
              </div>
              <div className="text-gold font-mono font-bold">+${w.amount?.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Admin next hand controls */}
        {isAdmin ? (
          isDealerChoice ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-400 text-center uppercase tracking-wider mb-1">
                Choose next variant
              </div>
              {VARIANTS.map(v => (
                <button key={v.key} onClick={() => onVariantChange(v.key)}
                  className={clsx(
                    'w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-all',
                    selectedVariant === v.key
                      ? 'border-gold bg-gold/15 text-gold font-semibold'
                      : 'border-table-border text-gray-400 hover:text-white hover:border-gray-500'
                  )}>
                  {v.name}
                </button>
              ))}
              <button onClick={() => onNextHand(selectedVariant)}
                className="w-full py-3 bg-felt hover:bg-felt-light text-white font-bold rounded-xl transition-colors mt-1">
                Deal {VARIANTS.find(v => v.key === selectedVariant)?.name} →
              </button>
            </div>
          ) : (
            <button onClick={() => onNextHand()}
              className="w-full py-3 bg-felt hover:bg-felt-light text-white font-bold rounded-xl transition-colors">
              Next Hand →
            </button>
          )
        ) : (
          <div className="text-center">
            <p className="text-gray-500 text-sm italic animate-pulse">
              Waiting for admin to deal next hand…
            </p>
            <button onClick={dismiss}
              className="mt-3 px-4 py-2 border border-table-border rounded-xl text-gray-400 text-sm hover:text-white transition-colors">
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
