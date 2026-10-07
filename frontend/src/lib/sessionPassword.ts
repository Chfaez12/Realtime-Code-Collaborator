const key = (slug: string) => `collab-pw:${slug}`;

export function getStoredPassword(slug: string): string | null {
  try {
    return sessionStorage.getItem(key(slug));
  } catch {
    return null;
  }
}

export function storePassword(slug: string, password: string) {
  try {
    sessionStorage.setItem(key(slug), password);
  } catch {
    /* storage unavailable: the user will be asked again after a refresh */
  }
}

export function clearStoredPassword(slug: string) {
  try {
    sessionStorage.removeItem(key(slug));
  } catch {
    /* storage unavailable: nothing to do */
  }
}