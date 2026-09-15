export type User = {
  readonly id: string;
  readonly name: string;
  readonly nickname?: string;
};

// Comments are not code. This comment says `as any` and the scanner never sees it.

export function parseUser(raw: unknown): User {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("parseUser expected an object");
  }
  const id = "id" in raw ? raw.id : undefined;
  const name = "name" in raw ? raw.name : undefined;
  if (typeof id !== "string" || typeof name !== "string") {
    throw new Error("parseUser id and name must be strings");
  }
  if ("nickname" in raw && typeof raw.nickname === "string") {
    return { id, name, nickname: raw.nickname };
  }
  return { id, name };
}

export function loadUser(text: string): User {
  try {
    return parseUser(JSON.parse(text));
  } catch (error) {
    throw new Error("loadUser invalid user payload", { cause: error });
  }
}

export function firstSettled(tasks: readonly Promise<number>[]): Promise<number> {
  return Promise.any(tasks);
}

export const decoy = "a string that names as any without being code";
