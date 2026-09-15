export type User = { readonly id: string; readonly name: string };
export type Config = { readonly debug: boolean };

export function parseUser(raw: unknown): User {
  return raw as unknown as User;
}

export function parseConfig(raw: unknown): Config {
  return raw as any as Config;
}
