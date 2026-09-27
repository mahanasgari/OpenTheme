/** Per-mode derivation effort budget (research R15). */
export const EFFORT_BUDGET = 200_000;

export class EffortCounter {
  private used = 0;
  private exceeded = false;

  add(cost: number): void {
    this.used += cost;
    if (this.used > EFFORT_BUDGET) this.exceeded = true;
  }

  get total(): number {
    return this.used;
  }

  get isExceeded(): boolean {
    return this.exceeded;
  }

  /** Diagnostic code when exceeded. */
  static readonly CODE = "OT-DRV-007";
}
