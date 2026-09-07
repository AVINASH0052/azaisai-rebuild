const OWNER_KEY = "azai.owner";
const LEGACY = ["azai.jobs", "azai.credits.v2", "azai.studio.prefs"];

let owner: string | null = null;

export function scopedStorageKey(base: string, id: string | null | undefined) {
  if (!id) return null;
  return `${base}.${id}`;
}

export function localOwner() {
  if (owner) return owner;
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(OWNER_KEY);
}

export function setLocalOwner(id: string | null) {
  owner = id && id.length ? id : null;
  if (typeof window === "undefined") return;
  if (owner) sessionStorage.setItem(OWNER_KEY, owner);
  else sessionStorage.removeItem(OWNER_KEY);
  for (const key of LEGACY) window.localStorage.removeItem(key);
  window.dispatchEvent(new Event("azai-owner"));
}

export function storageKey(base: string) {
  return scopedStorageKey(base, localOwner());
}
