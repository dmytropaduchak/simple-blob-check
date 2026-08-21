export type Severity = "high" | "medium" | "low";
export type Finding = {
  ruleId: string;
  severity: Severity;
  title: string;
  detail: string;
  file: string;
  line?: number;
};

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|bz2|7z|rar|mp4|mov|webm|woff2?|ttf|eot|exe|dll|so|dylib|bin|wasm)$/i;

export function scanBlobs(
  files: Array<{ filename: string; status: string; additions: number; changes: number; size?: number }>,
  maxBytes: number,
  maxAdditions: number,
): Finding[] {
  const findings: Finding[] = [];
  for (const f of files) {
    if (f.status === "removed") continue;
    const isBinary = BINARY_EXT.test(f.filename);
    const size = f.size ?? 0;
    if (isBinary && size > maxBytes) {
      findings.push({
        ruleId: "blob-too-large",
        severity: size > maxBytes * 2 ? "high" : "medium",
        title: `Large binary: ${f.filename}`,
        detail: `Size ${size} bytes (limit ${maxBytes})`,
        file: f.filename,
      });
      continue;
    }
    if (isBinary && f.additions >= maxAdditions) {
      findings.push({
        ruleId: "blob-many-lines",
        severity: "medium",
        title: `Binary-looking file with large diff: ${f.filename}`,
        detail: `+${f.additions} lines (limit ${maxAdditions})`,
        file: f.filename,
      });
    }
  }
  return findings;
}
