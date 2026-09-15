type Account = {
  id: string;
  createdAt: Date;
};

export function getAccount(body: string): any {
  try {
    const parsed = JSON.parse(body) as unknown as Account;
    return parsed;
  } catch {
  }
}
