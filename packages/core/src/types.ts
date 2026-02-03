export type Player = {
  id: string;
  name: string;
  faction?: string;
  active: boolean;
  pseudo?: string;
  discordId?: string;
  status?: 'PENDING' | 'VALIDATED';
  listStatus?: 'LIST_WAITING' | 'LIST_ACCEPTED' | 'LIST_REFUSED' | 'LIST_NOT_SUBMITTED';
  paymentStatus?: 'PAYMENT_PENDING' | 'PAYMENT_ACCEPTED';
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
