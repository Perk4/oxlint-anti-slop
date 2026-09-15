export function loadUser(text: string): undefined {
  try {
    JSON.parse(text);
  } catch {}
  return undefined;
}

export function loadConfig(text: string): undefined {
  try {
    JSON.parse(text);
  } catch (error) {
  }
  return undefined;
}
