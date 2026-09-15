export type User = { readonly id: string; readonly name: string };

export function describe(user: User, verbose: boolean) {
  return {
    id: user.id,
    ...(verbose ? { name: user.name } : {}),
  };
}
