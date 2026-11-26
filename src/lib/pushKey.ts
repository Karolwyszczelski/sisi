export function urlBase64ToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function matchesPushKey(subscription: PushSubscription | null, publicKey?: string) {
  const key = subscription?.options.applicationServerKey;
  if (!key || !publicKey) return false;
  const previous = new Uint8Array(key);
  const current = urlBase64ToUint8Array(publicKey);
  return previous.length === current.length && previous.every((byte, i) => byte === current[i]);
}
