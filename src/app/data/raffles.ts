export type Raffle = {
  id: string;
  title: string;
  prize: string;
  ticketPrice: number;
  durationMs: number;
  description: string;
  demoTotalTickets: number;
  image: string;
};

export const DEFAULT_RAFFLES: Raffle[] = [
  {
    id: "1",
    title: "Rolex Raffle",
    prize: "Rolex Submariner",
    ticketPrice: 10,
    durationMs: 2 * 60 * 1000,
    demoTotalTickets: 200,
    image: "/prizes/rolex.jpg",
    description: "Teilnahme mit Tickets. Nach Ablauf wird automatisch ausgelost. Demo-Version.",
  },
  {
    id: "2",
    title: "iPhone Raffle",
    prize: "iPhone 15 Pro",
    ticketPrice: 3,
    durationMs: 60 * 1000,
    demoTotalTickets: 150,
    image: "/prizes/iphone.jpg",
    description: "Schnelle Runde. Tickets kaufen, Countdown läuft, danach wird ausgelost. Demo-Version.",
  },
  {
    id: "3",
    title: "Car Raffle",
    prize: "Mercedes A-Klasse",
    ticketPrice: 25,
    durationMs: 30 * 1000,
    demoTotalTickets: 300,
    image: "/prizes/car.jpg",
    description: "Großer Preis. Nach Ablauf wird automatisch ausgelost. Demo-Version.",
  },
];

const KEY = "raffles_db";

export function loadRaffles(): Raffle[] {
  if (typeof window === "undefined") return DEFAULT_RAFFLES;
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as Raffle[]) : DEFAULT_RAFFLES;
    return Array.isArray(arr) && arr.length ? arr : DEFAULT_RAFFLES;
  } catch {
    return DEFAULT_RAFFLES;
  }
}

export function saveRaffles(raffles: Raffle[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(raffles));
}

export function resetRafflesToDefault() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(DEFAULT_RAFFLES));
}
