import clsx from 'clsx'

const SUIT_COLOR = { h: 'text-red-500', d: 'text-red-500', s: 'text-gray-900', c: 'text-gray-900' }
const SUIT_SYMBOL = { h: '♥', d: '♦', s: '♠', c: '♣' }
const RANK_DISPLAY = { 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }

export default function PlayingCard({ card, faceDown = false, size = 'md', selected = false, onClick }) {
  const sizes = {
    xs: 'w-8 h-11 text-xs',
    sm: 'w-10 h-14 text-sm',
    md: 'w-14 h-20 text-base',
    lg: 'w-16 h-24 text-lg',
  }

  if (faceDown) {
    return (
      <div className={clsx(
        'rounded-lg border-2 border-blue-900 flex items-center justify-center select-none',
        'bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900',
        sizes[size],
        'shadow-md'
      )}>
        <div className="w-[70%] h-[70%] border border-blue-700 rounded opacity-40" />
      </div>
    )
  }

  if (!card) return null

  const rank   = RANK_DISPLAY[card.rank] ?? String(card.rank)
  const suit   = SUIT_SYMBOL[card.suit]  ?? card.suit
  const color  = SUIT_COLOR[card.suit]   ?? 'text-gray-900'

  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-lg bg-white border-2 flex flex-col justify-between p-1 select-none animate-deal',
        'shadow-md transition-all duration-150',
        sizes[size],
        color,
        selected
          ? 'border-gold -translate-y-2 shadow-gold/40 shadow-lg'
          : 'border-gray-200 hover:border-gray-400',
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <div className="font-bold leading-none text-left" style={{ fontSize: size === 'xs' ? '0.6rem' : undefined }}>
        {rank}
        <br />
        <span style={{ fontSize: '0.75em' }}>{suit}</span>
      </div>
      <div className="font-bold leading-none text-right rotate-180" style={{ fontSize: size === 'xs' ? '0.6rem' : undefined }}>
        {rank}
        <br />
        <span style={{ fontSize: '0.75em' }}>{suit}</span>
      </div>
    </button>
  )
}
