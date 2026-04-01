import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../utils/api'

const VARIANTS = [
  { key: 'dealer_choice', name: "Dealer's Choice",  desc: 'Admin picks the variant before each hand' },
  { key: 'texas_holdem',  name: "Texas Hold'em",    desc: '2 hole cards, 5 community cards' },
  { key: 'omaha',         name: 'Omaha',             desc: '4 hole cards, use exactly 2' },
  { key: 'omaha_hilo',    name: 'Omaha Hi-Lo',       desc: 'Split pot — best high and low hand' },
]

const STRUCTURES = [
  { key: 'no_limit',  name: 'No Limit',    desc: 'Raise any amount up to your stack' },
  { key: 'pot_limit', name: 'Pot Limit',   desc: 'Max raise = current pot size' },
  { key: 'fixed',     name: 'Fixed Limit', desc: 'Bet/raise in fixed increments' },
]

export default function CreateTablePage() {
  const navigate  = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [form, setForm] = useState({
    table_name:        '',
    variant:           'texas_holdem',
    betting_structure: 'no_limit',
    small_blind:       10,
    big_blind:         20,
    min_bet:           20,
    max_bet:           0,
    starting_chips:    1000,
    max_seats:         6,
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.table_name.trim()) { setError('Please enter a table name'); return }
    setLoading(true); setError('')
    try {
      const data = await api.post('/tables', {
        ...form,
        table_name:     form.table_name.trim(),
        small_blind:    Number(form.small_blind),
        big_blind:      Number(form.big_blind),
        min_bet:        Number(form.min_bet),
        max_bet:        Number(form.max_bet),
        starting_chips: Number(form.starting_chips),
        max_seats:      Number(form.max_seats),
        dealer_choice:  form.variant === 'dealer_choice',
      })
      navigate(`/table/${data.table_id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-table text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
          ← Back to lobby
        </button>

        <h1 className="font-display text-3xl font-bold text-gold mb-1">Create a Table</h1>
        <p className="text-gray-400 mb-8 text-sm">Configure your game. You'll get a shareable invite link.</p>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Table Name */}
          <Section title="Table Name">
            <input
              type="text"
              placeholder="e.g. Friday Night Poker, Rohit's Game…"
              value={form.table_name}
              onChange={e => set('table_name', e.target.value)}
              maxLength={40}
              required
              className="w-full bg-table border border-table-border rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-felt-light transition-colors"
            />
          </Section>

          {/* Variant */}
          <Section title="Game Variant">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VARIANTS.map(v => (
                <OptionCard key={v.key} selected={form.variant === v.key}
                  onClick={() => set('variant', v.key)}
                  title={v.name} desc={v.desc}
                  highlight={v.key === 'dealer_choice'} />
              ))}
            </div>
            {form.variant === 'dealer_choice' && (
              <div className="mt-2 text-xs text-gold bg-gold/10 border border-gold/20 rounded-lg px-3 py-2">
                You'll choose the variant before each hand starts from the table screen.
              </div>
            )}
          </Section>

          {/* Betting structure */}
          <Section title="Betting Structure">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STRUCTURES.map(s => (
                <OptionCard key={s.key} selected={form.betting_structure === s.key}
                  onClick={() => set('betting_structure', s.key)}
                  title={s.name} desc={s.desc} />
              ))}
            </div>
          </Section>

          {/* Blinds & Chips */}
          <Section title="Blinds & Chips">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <NumField label="Small Blind"    value={form.small_blind}    onChange={v => set('small_blind', v)}    min={1} />
              <NumField label="Big Blind"      value={form.big_blind}      onChange={v => set('big_blind', v)}      min={2} />
              <NumField label="Starting Chips" value={form.starting_chips} onChange={v => set('starting_chips', v)} min={100} step={100} />
              <NumField label="Min Bet"        value={form.min_bet}        onChange={v => set('min_bet', v)}        min={1} />
              <NumField label="Max Bet (0=∞)"  value={form.max_bet}        onChange={v => set('max_bet', v)}        min={0} />
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Max Seats</label>
                <select value={form.max_seats} onChange={e => set('max_seats', e.target.value)}
                  className="w-full bg-table border border-table-border rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-felt-light">
                  {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n} players</option>)}
                </select>
              </div>
            </div>
          </Section>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-felt hover:bg-felt-light text-white font-bold text-lg rounded-2xl transition-colors disabled:opacity-50 shadow-lg">
            {loading ? 'Creating table…' : 'Create Table & Get Invite Link'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  )
}

function OptionCard({ selected, onClick, title, desc, highlight }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        selected
          ? 'border-felt-light bg-felt/20 text-white'
          : highlight
          ? 'border-gold/40 bg-gold/5 text-gray-300 hover:border-gold hover:text-white'
          : 'border-table-border bg-table-surface text-gray-400 hover:border-gray-500 hover:text-gray-200'
      }`}>
      <div className="font-semibold text-sm mb-1">{title}</div>
      <div className="text-xs opacity-70 leading-snug">{desc}</div>
    </button>
  )
}

function NumField({ label, value, onChange, min = 0, step = 1 }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">{label}</label>
      <input type="number" value={value} min={min} step={step}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-table border border-table-border rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-felt-light transition-colors" />
    </div>
  )
}
