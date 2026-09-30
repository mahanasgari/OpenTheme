/** The interchange report (FR-D021): every token left out, converted, renamed, or restored. */
export interface ReportEntry {
  readonly path: string;
  readonly action: "left-out" | "converted" | "renamed" | "restored" | "kept-computed" | "defaulted" | "dropped-extensions";
  readonly reason: string;
}

export class Report {
  readonly #entries: ReportEntry[] = [];
  add(path: string, action: ReportEntry["action"], reason: string): void {
    this.#entries.push({ path, action, reason });
  }
  /** Sorted by path, then action, then reason (deterministic, FR-D022). */
  entries(): readonly ReportEntry[] {
    const key = (e: ReportEntry) => [e.path, e.action, e.reason] as const;
    return Object.freeze(
      [...this.#entries].sort((a, b) => {
        const x = key(a);
        const y = key(b);
        for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i]! < y[i]! ? -1 : 1;
        return 0;
      }),
    );
  }
}
