import { format } from "sql-formatter";

const SQL_START_KEYWORDS = new Set([
  "ALTER", "BEGIN", "CALL", "CREATE", "DECLARE", "DELETE", "DESC", "DESCRIBE", "DROP", "EXEC", "EXECUTE", "EXPLAIN", "GRANT", "INSERT",
  "MERGE", "REPLACE", "REVOKE", "SELECT", "SET", "SHOW", "TRUNCATE", "UPDATE", "USE", "VALUES", "WITH",
]);

export interface SqlNormalizationResult {
  valid: boolean;
  text: string;
}

function withoutLeadingComments(text: string): string {
  let candidate = text.trimStart();
  while (candidate) {
    if (candidate.startsWith("--")) {
      const end = candidate.search(/[\r\n]/);
      candidate = end < 0 ? "" : candidate.slice(end + 1).trimStart();
      continue;
    }
    if (candidate.startsWith("/*")) {
      const end = candidate.indexOf("*/", 2);
      if (end < 0) return candidate;
      candidate = candidate.slice(end + 2).trimStart();
      continue;
    }
    break;
  }
  return candidate;
}

export function looksLikeSql(text: string): boolean {
  const firstWord = /^[A-Za-z]+/.exec(withoutLeadingComments(text))?.[0];
  return firstWord ? SQL_START_KEYWORDS.has(firstWord.toUpperCase()) : false;
}

export function normalizeSql(text: string): SqlNormalizationResult {
  for (const language of ["sql", "transactsql"] as const) {
    try {
      return {
        valid: true,
        text: format(text, {
          language,
          tabWidth: 2,
          useTabs: false,
          keywordCase: "upper",
          linesBetweenQueries: 1,
        }).trim(),
      };
    } catch {
      continue;
    }
  }
  return { valid: false, text };
}
