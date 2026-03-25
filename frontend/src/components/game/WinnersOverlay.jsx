import { useEffect, useState } from 'react'

export default function WinnersOverlay({ winners, onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (winners) {
      setVisible(true)
      const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 400) }, 5000)
      return () => clearTimeout(t)
    }
  }, [winners])

  if (!winners) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity duration-400 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="bg-table-surface border border-gold/40 rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        <div className="text-5xl mb-3">🏆</div>
        <h2 className="font-display text-2xl text-gold font-bold mb-4">Hand Complete!</h2>

        <div className="space-y-3 mb-6">
          {winners.map((w, i) => (
            <div key={i} className="bg-felt/10 border border-felt/30 rounded-xl p-3">
              <div className="font-semibold text-white">{w.username}</div>
              <div className="text-gold font-mono text-lg">+${w.amount.toLocaleString()}</div>
              <div className="text-xs text-gray-400">{w.pot} · {w.hand?.rank_name}</div>
            </div>
          ))}
        </div>

        <button onClick={() => { setVisible(false); setTimeout(onDismiss, 400) }}
          className="px-6 py-2 bg-felt hover:bg-felt-light text-white rounded-xl font-semibold text-sm transition-colors">
          Next Hand
        </button>
      </div>
    </div>
  )
}
