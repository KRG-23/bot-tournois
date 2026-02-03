import { Pairing, Round, Tournament } from './types';

/**
 * Génère un round Swiss simple :
 * - Trie les joueurs actifs par ID (placeholder, pas de score pour l'instant)
 * - Associe les joueurs par paires; si impair, dernier joueur prend un bye.
 */
export function generateSwissRound(t: Tournament): Round {
  const active = t.players.filter((p) => p.active);
  const sorted = [...active].sort((a, b) => a.id.localeCompare(b.id)); // TODO: remplacer par tri sur standings
  const pairings: Pairing[] = [];
  let table = 1;
  for (let i = 0; i < sorted.length; i += 2) {
    const a = sorted[i];
    const b = sorted[i + 1];
    pairings.push({
      table: table++,
      playerA: a.id,
      playerB: b?.id ?? null
    });
  }
  return {
    number: t.rounds.length + 1,
    pairings
  };
}
