import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { generateSwissRound, Tournament, Player } from '@core';

const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

type TournamentForm = {
  name: string;
  timezone: string;
  rulesUrl?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  rounds?: {
    round: number;
    code: string;
    primary: string;
    deployment: string;
  }[];
  schedule?: any;
};

function App() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState<TournamentForm>({ name: 'Test Open', timezone: 'Europe/Paris' });

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
      <button
        onClick={() =>
          setForm({
            name: 'SCENARIO DU WEEKEND',
            timezone: 'Europe/Paris',
            rulesUrl:
              'https://docs.google.com/document/d/13Xyl7rr8isFkhXLvkG5t7QrBMCulDJC3cpmWdJX6aDo/edit?usp=sharing',
            location: 'Rue Henri Gandon, 49430 Huillé-Lézigné',
            startDate: '2025-12-06',
            endDate: '2025-12-07',
            capacity: 40,
            rounds: [
              { round: 1, code: 'A', primary: 'Take and Hold', deployment: 'Tipping Point' },
              { round: 2, code: 'K', primary: 'Scorched Earth', deployment: 'Search and Destroy' },
              { round: 3, code: 'N', primary: 'Hidden Supplies', deployment: 'Crucible Of Battle' },
              { round: 4, code: 'G', primary: 'Purge the Foe', deployment: 'Hammer and Anvil' },
              { round: 5, code: 'O', primary: 'Terraform', deployment: 'Crucible of Battle' }
            ],
            schedule: {
              freeze: '2025-11-16',
              inscriptions_close: '2025-11-23',
              lists_due: '2025-12-01',
              lists_publish: '2025-12-05',
              event: '2025-12-06 to 2025-12-07',
              saturday: [
                '08:00 Accueil et petit déjeuner',
                '08:30 - 12:00 Première partie',
                '12:00 - 13:00 Repas',
                '13:00 - 16:30 Seconde partie',
                '17:00 - 20:30 Troisième partie'
              ],
              sunday: [
                '08:00 Accueil et petit déjeuner',
                '08:30 - 12:00 Première partie',
                '12:00 - 13:00 Repas',
                '13:00 - 16:30 Seconde partie',
                '16:30 - 17:00 Remise des trophées'
              ]
            }
          })
        }
      >
        Charger l’exemple week-end
      </button>

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
        <h2>Détails</h2>
        <label>Règlement (URL)
          <input
            value={form.rulesUrl ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, rulesUrl: e.target.value }))}
            style={{ marginLeft: '0.5rem', width: '60%' }}
          />
        </label>
        <br />
        <label>Lieu
          <input
            value={form.location ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            style={{ marginLeft: '0.5rem', width: '60%' }}
          />
        </label>
        <br />
        <label>Début
          <input
            type="date"
            value={form.startDate ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
        <label style={{ marginLeft: '1rem' }}>Fin
          <input
            type="date"
            value={form.endDate ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
        <br />
        <label>Capacité
          <input
            type="number"
            value={form.capacity ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) || undefined }))}
            style={{ marginLeft: '0.5rem', width: '6rem' }}
          />
        </label>
      </section>

      {form.rounds && (
        <section>
          <h2>Scénarios</h2>
          <table>
            <thead>
              <tr><th>Round</th><th>Code</th><th>Primaire</th><th>Déploiement</th></tr>
            </thead>
            <tbody>
              {form.rounds.map((r) => (
                <tr key={r.round}>
                  <td>{r.round}</td><td>{r.code}</td><td>{r.primary}</td><td>{r.deployment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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
