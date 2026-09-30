# Agent Guide: @opentheme/cli

For agents that create or check OpenTheme themes. Read [README.md](./README.md) first.

## Workflow

1. Start from a valid file: `opentheme init <file> --name "<name>"`.
2. Edit the JSON, then `opentheme validate <file> --json` after every change. Fix diagnostics in
   the order given; each has a JSON pointer to the exact member.
3. Check what users will see: `opentheme resolve <file> --json --path <token>` in each mode you
   care about (`--scheme`, `--contrast`, `--forced-colors`).
4. Run `opentheme report <file> --strict` before publishing.

```bash
opentheme init agent-theme.opentheme.json --name "Agent Theme"
opentheme validate agent-theme.opentheme.json --json
opentheme resolve agent-theme.opentheme.json --json --scheme light --path color.surface.base --path color.text.primary
opentheme report agent-theme.opentheme.json --strict
```

## Rules

- Never pass `--trusted` for a theme you did not write for your own application. Trust comes from
  where a theme came from, never from what it says about itself.
- Never pass `--relaxed-gate` to make a theme "pass"; fix the contrast instead.
- AI-generated themes are untrusted with `--source ai-generated`.
- Read `status` in the JSON (or the exit status): `1` means the theme is not usable as is.

## Common mistakes

| Mistake | Instead |
|---|---|
| Parsing human output | Use `--json` |
| Treating a fallback as success | A resolution that fell back exits `1` and says which theme was applied |
| Setting preferences without a preset | Add `--preset common-personalization` |
| Guessing token names | Resolve without `--path` to list every token |
