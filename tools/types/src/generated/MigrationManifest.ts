/* Generated from specification/schemas/1.0/migration-manifest.schema.json */

/**
 * This interface was referenced by `OpenThemeMigrationManifest`'s JSON-Schema
 * via the `definition` "operation".
 */
export type Operation =
  | {
      op: "rename-path";
      from: string;
      to: string;
    }
  | {
      op: "move-member";
      from: string;
      to: string;
    }
  | {
      op: "map-value";
      at: string;
      mapping: {
        [k: string]: any;
      };
    }
  | {
      op: "drop-member";
      at: string;
      lossy: true;
    };

/**
 * Migration manifest per data-model §19: from previous major M.x to N.0.
 */
export interface OpenThemeMigrationManifest {
  /**
   * Source major.minor (or M.x) accepted as previous major.
   */
  from: string;
  /**
   * Target major.0 after migration.
   */
  to: string;
  /**
   * Ordered migration operations applied left to right.
   */
  operations: Operation[];
}
