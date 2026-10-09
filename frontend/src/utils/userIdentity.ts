const COLORS = [
  "#f97316", "#22c55e", "#3b82f6", "#a855f7",
  "#ec4899", "#eab308", "#14b8a6", "#ef4444",
  "#06b6d4", "#84cc16", "#f43f5e", "#8b5cf6",
];


const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function generateGuestName(): string {
  return `Guest ${1000 + Math.floor(Math.random() * 9000)}`;
}

export function generateUserColor(exclude: string[] = []): string {
  const free = COLORS.filter((c) => !exclude.includes(c));
  return pick(free.length ? free : COLORS);
}

export interface UserIdentity {
  name: string;
  color: string;
}

const KEY = "collab-user-identity";

export function getUserIdentity(takenColors: string[] = []): UserIdentity {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as UserIdentity;
  } catch {
    /* storage unavailable, fall through */
  }
  const identity = { name: generateGuestName(), color: generateUserColor(takenColors) };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
  return identity;
}

export function peekStoredName(): string | null {
  try {
    const saved = sessionStorage.getItem("collab-user-identity");
    return saved ? ((JSON.parse(saved) as { name?: string }).name ?? null) : null;
  } catch {
    return null;
  }
}