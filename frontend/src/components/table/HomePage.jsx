import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function HomePage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuthStore()

  return (
    <div className="min-h-screen bg-table text-white">
      {/* Header */}
      <header className="border-b border-table-border bg-table-surface px-6 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-gold font-bold">Poker Club</h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">{profile?.username}</div>
            <div className="text-xs text-gray-500">{profile?.games_played} games · {profile?.games_won} wins</div>
          </div>
          <button onClick={signOut}
            className="text-xs text-gray-400 hover:text-red-400 border border-table-border hover:border-red-800 px-3 py-1.5 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Create table CTA */}
        <div className="bg-gradient-to-br from-felt/30 to-felt-dark/20 border border-felt/40 rounded-3xl p-8 text-center">
          <div className="text-4xl mb-3">🃏</div>
          <h2 className="font-display text-2xl font-bold mb-2">Ready to Play?</h2>
          <p className="text-gray-400 text-sm mb-6">Create a private table and invite your friends with a single link.</p>
          <button onClick={() => navigate('/create')}
            className="px-8 py-3 bg-felt hover:bg-felt-light text-white font-bold text-lg rounded-2xl transition-colors shadow-lg">
            Create a Table
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          {[
            ['Games Played', profile?.games_played ?? 0],
            ['Hands Won',    profile?.hands_won    ?? 0],
            ['Total Winnings', `$${(profile?.total_winnings ?? 0).toLocaleString()}`],
          ].map(([label, val]) => (
            <div key={label} className="bg-table-surface border border-table-border rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-gold font-mono">{val}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-sm">
          Share your table link after creating a game. Friends click it to join instantly.
        </p>
      </main>
    </div>
  )
}
