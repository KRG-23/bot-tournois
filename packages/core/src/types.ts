export type Player = {
  id: string;
  name: string;
  faction?: string;
  active: boolean;
};

export type Pairing = {
  table: number;
  playerA: string;
  playerB: string | null; // null = bye
};

export type Round = {
  number: number;
  pairings: Pairing[];
};

export type Tournament = {
  id: string;
  name: string;
  timezone: string;
  players: Player[];
  rounds: Round[];
};
