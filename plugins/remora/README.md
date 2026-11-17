# Remora plugin for Claude Code

Helps Claude Code build, check and debug [Remora](https://www.npmjs.com/package/@forzalabs/remora)
projects.

- **Skill `remora`** — how Remora projects are laid out, the compile → sample → synth → run loop, and
  where the documentation and JSON Schemas installed with your CLI are, so Claude looks options up
  there instead of guessing them.
- **Hook** — after Claude edits a JSON file inside a `remora/` project, it runs `remora compile` and
  shows Claude any errors, so a broken config is fixed straight away.

## Install

```text
/plugin marketplace add ForzaLabs/remora-public
/plugin install remora@forzalabs
```

You need Node and the Remora CLI (`npm install -g @forzalabs/remora`, or a local install in the
project). Without the CLI the hook does nothing.
