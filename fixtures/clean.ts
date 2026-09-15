type User = {
  readonly id: string;
  readonly name: string;
};

function parseUser(body: string): User {
  const parsed: unknown = JSON.parse(body);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("id" in parsed) ||
    !("name" in parsed) ||
    typeof parsed.id !== "string" ||
    typeof parsed.name !== "string"
  ) {
    throw new Error("invalid user");
  }
  return { id: parsed.id, name: parsed.name };
}

export function getUser(id: string): User {
  if (id.length === 0) {
    throw new Error("id required");
  }
  return parseUser(`{"id":"${id}","name":"ada"}`);
}
