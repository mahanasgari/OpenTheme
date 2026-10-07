# Quickstart: React Bindings

```tsx
import { createCore } from "@opentheme/core";
import { OpenThemeProvider, useOpenTheme } from "@opentheme/react";

const core = createCore();
core.registry.admit({ kind: "theme", bytes: auroraBytes, trust: "trusted" });

function ThemeName() {
  const { resolved, select } = useOpenTheme();
  return <button onClick={() => select({ id: "org.opentheme.aurora" })}>{String(resolved?.displayText?.name ?? "")}</button>;
}

export function App() {
  return (
    <OpenThemeProvider core={core} scope="app" policy={{ preset: "common-personalization", defaultTheme: "org.opentheme.aurora" }}>
      <ThemeName />
    </OpenThemeProvider>
  );
}
```

**Expected**: the document gets the adapter's `--ot-` and `--otc-` properties; the button shows
"Aurora"; unmounting removes the scope. `packages/react/test/quickstart.test.tsx` runs this.
