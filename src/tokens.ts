export type Position = {
  readonly line: number;
  readonly column: number;
};

export type Token = Position & {
  readonly text: string;
  readonly pair?: number;
};

const END: Token = { text: "", line: 0, column: 0 };

const OPERATORS: readonly string[] = ["...", "?.", "??", "=>"];

const WORD = /[A-Za-z0-9_$]/;

const OPENERS: Readonly<Record<string, string>> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

const CLOSERS: Readonly<Record<string, string>> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

type Cursor = {
  i: number;
  line: number;
  column: number;
};

type Draft = {
  text: string;
  line: number;
  column: number;
  pair?: number;
};

function advance(c: Cursor, text: string): void {
  const ch = text[c.i];
  if (ch === "\r" && text[c.i + 1] === "\n") {
    c.i += 2;
    c.line += 1;
    c.column = 1;
    return;
  }
  if (ch === "\n" || ch === "\r") {
    c.i += 1;
    c.line += 1;
    c.column = 1;
    return;
  }
  c.i += 1;
  c.column += 1;
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD.test(ch);
}

function isDivisionSlash(previous: Draft | undefined): boolean {
  if (previous === undefined) {
    return false;
  }
  if (previous.text === ")" || previous.text === "]" || previous.text === "}") {
    return true;
  }
  return /^[A-Za-z0-9_$]+$/.test(previous.text);
}

function skipLineComment(c: Cursor, text: string): void {
  while (c.i < text.length && text[c.i] !== "\n" && text[c.i] !== "\r") {
    advance(c, text);
  }
}

function skipBlockComment(c: Cursor, text: string): void {
  const opened = c.line;
  advance(c, text);
  advance(c, text);
  while (c.i < text.length) {
    if (text[c.i] === "*" && text[c.i + 1] === "/") {
      advance(c, text);
      advance(c, text);
      return;
    }
    advance(c, text);
  }
  throw new Error(`unterminated block comment opened at line ${opened}`);
}

function skipQuoted(c: Cursor, text: string, quote: string): void {
  const opened = c.line;
  advance(c, text);
  while (c.i < text.length) {
    const ch = text[c.i];
    if (ch === "\\") {
      advance(c, text);
      if (c.i < text.length) {
        advance(c, text);
      }
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      throw new Error(`unterminated string opened at line ${opened}`);
    }
    if (ch === quote) {
      advance(c, text);
      return;
    }
    advance(c, text);
  }
  throw new Error(`unterminated string opened at line ${opened}`);
}

function skipTemplate(c: Cursor, text: string): void {
  const opened = c.line;
  advance(c, text);
  while (c.i < text.length) {
    const ch = text[c.i];
    if (ch === "\\") {
      advance(c, text);
      if (c.i < text.length) {
        advance(c, text);
      }
      continue;
    }
    if (ch === "`") {
      advance(c, text);
      return;
    }
    if (ch === "$" && text[c.i + 1] === "{") {
      advance(c, text);
      advance(c, text);
      skipInterpolation(c, text, opened);
      continue;
    }
    advance(c, text);
  }
  throw new Error(`unterminated string opened at line ${opened}`);
}

function skipInterpolation(c: Cursor, text: string, opened: number): void {
  let depth = 1;
  while (c.i < text.length && depth > 0) {
    const ch = text[c.i];
    if (ch === "`") {
      skipTemplate(c, text);
      continue;
    }
    if (ch === "'" || ch === '"') {
      skipQuoted(c, text, ch);
      continue;
    }
    if (ch === "/" && text[c.i + 1] === "/") {
      skipLineComment(c, text);
      continue;
    }
    if (ch === "/" && text[c.i + 1] === "*") {
      skipBlockComment(c, text);
      continue;
    }
    if (ch === "{") {
      depth += 1;
      advance(c, text);
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      advance(c, text);
      continue;
    }
    advance(c, text);
  }
  if (depth > 0) {
    throw new Error(`unterminated string opened at line ${opened}`);
  }
}

function skipRegex(c: Cursor, text: string): void {
  const opened = c.line;
  advance(c, text);
  let inClass = false;
  while (c.i < text.length) {
    const ch = text[c.i];
    if (ch === "\\") {
      advance(c, text);
      if (c.i < text.length) {
        advance(c, text);
      }
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      throw new Error(`unterminated string opened at line ${opened}`);
    }
    if (ch === "[" && !inClass) {
      inClass = true;
      advance(c, text);
      continue;
    }
    if (ch === "]" && inClass) {
      inClass = false;
      advance(c, text);
      continue;
    }
    if (ch === "/" && !inClass) {
      advance(c, text);
      while (isWordChar(text[c.i])) {
        advance(c, text);
      }
      return;
    }
    advance(c, text);
  }
  throw new Error(`unterminated string opened at line ${opened}`);
}

function operatorAt(text: string, i: number): string | undefined {
  for (const op of OPERATORS) {
    if (text.startsWith(op, i)) {
      return op;
    }
  }
  return undefined;
}

function pairBrackets(tokens: Draft[]): void {
  const stack: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) {
      return;
    }
    const closer = OPENERS[token.text];
    if (closer !== undefined) {
      stack.push(i);
      continue;
    }
    const opener = CLOSERS[token.text];
    if (opener === undefined) {
      continue;
    }
    const openIndex = stack.pop();
    if (openIndex === undefined) {
      throw new Error(`Unbalanced ${JSON.stringify(token.text)} at line ${token.line}`);
    }
    const open = tokens[openIndex];
    if (open === undefined || OPENERS[open.text] !== token.text) {
      throw new Error(`Unbalanced ${JSON.stringify(token.text)} at line ${token.line}`);
    }
    open.pair = i;
    token.pair = openIndex;
  }
  const leftover = stack.pop();
  if (leftover !== undefined) {
    const open = tokens[leftover];
    const line = open === undefined ? 1 : open.line;
    const text = open === undefined ? "(" : open.text;
    throw new Error(`Unclosed ${JSON.stringify(text)} at line ${line}`);
  }
}

export function tokenize(text: string): readonly Token[] {
  const c: Cursor = { i: 0, line: 1, column: 1 };
  const tokens: Draft[] = [];

  while (c.i < text.length) {
    const ch = text[c.i];
    if (ch === undefined) {
      break;
    }
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v") {
      advance(c, text);
      continue;
    }
    if (ch === "/" && text[c.i + 1] === "/") {
      skipLineComment(c, text);
      continue;
    }
    if (ch === "/" && text[c.i + 1] === "*") {
      skipBlockComment(c, text);
      continue;
    }
    if (ch === "'" || ch === '"') {
      skipQuoted(c, text, ch);
      continue;
    }
    if (ch === "`") {
      skipTemplate(c, text);
      continue;
    }
    if (ch === "/") {
      if (isDivisionSlash(tokens[tokens.length - 1])) {
        const { line, column } = c;
        advance(c, text);
        tokens.push({ text: "/", line, column });
        continue;
      }
      skipRegex(c, text);
      continue;
    }
    if (isWordChar(ch)) {
      const { line, column } = c;
      const start = c.i;
      while (isWordChar(text[c.i])) {
        advance(c, text);
      }
      tokens.push({ text: text.slice(start, c.i), line, column });
      continue;
    }
    const op = operatorAt(text, c.i);
    if (op !== undefined) {
      const { line, column } = c;
      for (let n = 0; n < op.length; n++) {
        advance(c, text);
      }
      tokens.push({ text: op, line, column });
      continue;
    }
    const { line, column } = c;
    advance(c, text);
    tokens.push({ text: ch, line, column });
  }

  pairBrackets(tokens);
  return tokens;
}

export type TokenWindow = (offset: number) => Token;

export function windowAt(tokens: readonly Token[], index: number): TokenWindow {
  return (offset) => {
    const token = tokens[index + offset];
    if (token === undefined) {
      return END;
    }
    if (token.pair === undefined) {
      return token;
    }
    return {
      text: token.text,
      line: token.line,
      column: token.column,
      pair: token.pair - index,
    };
  };
}
