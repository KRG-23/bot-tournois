import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { generateSwissRound, Tournament, Player } from '@bot-warhammer/core';

const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

type TournamentForm = {
  name: string;
  timezone: string;
};

function App() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState<TournamentForm>({ name: 'Test Open', timezone: 'UTC' });

  const previewRound = useMemo(() => {
    if (!tournament) return null;
    return generateSwissRound({ ...tournament, players, rounds: [] });
  }, [tournament, players]);

  const createTournament = async () => {
    const res = await fetch(`${apiBase}/tournaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = (await res.json()) as Tournament;
    setTournament(data);
    setPlayers([]);
  };

  const addPlayer = async (name: string, faction?: string) => {
    if (!tournament) return;
    const res = await fetch(`${apiBase}/tournaments/${tournament.id}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, faction })
    });
    const data = (await res.json()) as Player[];
    setPlayers(data);
  };

  const [playerName, setPlayerName] = useState('');
  const [playerFaction, setPlayerFaction] = useState('');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Warhammer 40k — Prévisualisation Tournoi</h1>

      <section style={{ marginBottom: '1rem' }}>
        <h2>Tournoi</h2>
        <label>Nom
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
        <label style={{ marginLeft: '1rem' }}>Timezone
          <input
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
        <button onClick={createTournament} style={{ marginLeft: '1rem' }}>Créer</button>
        {tournament && <span style={{ marginLeft: '1rem' }}>ID: {tournament.id}</span>}
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h2>Joueurs</h2>
        <input
          placeholder="Nom"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        <input
          placeholder="Faction (optionnel)"
          value={playerFaction}
          onChange={(e) => setPlayerFaction(e.target.value)}
          style={{ marginLeft: '0.5rem' }}
        />
        <button
          style={{ marginLeft: '0.5rem' }}
          onClick={() => {
            addPlayer(playerName, playerFaction || undefined);
            setPlayerName('');
            setPlayerFaction('');
          }}
          disabled={!tournament || !playerName}
        >
          Ajouter
        </button>
        <ul>
          {players.map((p) => (
            <li key={p.id}>{p.name} {p.faction ? `(${p.faction})` : ''}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Round Swiss (prévisualisation)</h2>
        {!tournament && <p>Crée un tournoi et ajoute des joueurs.</p>}
        {previewRound && (
          <table>
            <thead>
              <tr><th>Table</th><th>Joueur A</th><th>Joueur B / Bye</th></tr>
            </thead>
            <tbody>
              {previewRound.pairings.map((p) => (
                <tr key={p.table}>
                  <td>{p.table}</td>
                  <td>{players.find((pl) => pl.id === p.playerA)?.name ?? p.playerA}</td>
                  <td>{p.playerB ? (players.find((pl) => pl.id === p.playerB)?.name ?? p.playerB) : 'Bye'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<App />);
}
