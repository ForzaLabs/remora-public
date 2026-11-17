---
name: remora
description: Build, edit, run and debug Remora data pipelines (the @forzalabs/remora CLI). Use whenever the work touches a Remora project — a remora/ folder with project.json and sources/, producers/, consumers/ JSON files — or the user mentions Remora, a Remora source, producer or consumer, or commands like remora compile, run, sample, synth, discover or migrate. Covers writing configs against the installed docs and schemas, the compile → sample → synth → run loop, and diagnosing failed runs.
---

# Remora

Remora is a data transformation CLI. A project is plain JSON in a `remora/` folder, validated against
JSON Schemas; there is no pipeline code. Three resources, in a chain:

- **Source** (`remora/sources/`) — a connection: engine, credentials, host, bucket, folder or URL.
  Nothing about the data.
- **Producer** (`remora/producers/`) — one dataset read from one source: the table or file, its
  `settings` (file type, compression…) and its fields (`dimensions`).
- **Consumer** (`remora/consumers/`) — the output: takes producers, joins them, picks and transforms
  `fields`, filters, validates, and writes to exactly one destination in `outputs`.

Also: `remora/project.json` (project settings), `remora/schemas/` (JSON Schemas that validate a
consumer's output) and `remora/code_sets/` (value lists for synthetic data only). These folder names
are fixed. A run is always driven by a consumer.

## Ground rules

1. **Never write an option from memory.** Remora's options change between versions, and older public
   docs are still indexed. Look up every property you use in the docs or schema installed with the
   user's CLI (see [Finding the reference](#finding-the-reference)).
2. **`remora compile` after every edit.** It validates every file against the schema and names the
   file and JSON path that is wrong. The plugin's hook runs it after each JSON edit in a Remora
   project and shows you the errors; fix them before moving on. Run it yourself after creating or
   deleting files outside your edit tools.
3. **Compile is not correctness.** After it passes, `remora sample <name>` shows the rows a producer
   or consumer actually yields. Check them before calling a pipeline done.
4. **Keep secrets out of the JSON.** Reference environment variables with `{ENV_VAR}` (e.g.
   `"secretKey": "{AWS_SECRET_ACCESS_KEY}"`), set in the `.env` beside `remora/`. Never paste
   credentials into a config, and never print the `.env`.
5. **Keep `$schema`** on every file: it is what gives the user completion and inline docs.
6. **Run commands from the folder that contains `remora/`**, not from inside it.

## Finding the reference

The prose docs and schemas ship inside the CLI package and always match the installed version.

```bash
remora -v                      # installed version
remora docs --json             # topics (sources, producers, consumers, code-sets, upgrading) and their file paths
remora docs consumers          # print one topic to stdout
```

The docs are long (the consumers topic is ~2,700 lines). Take the file path from `remora docs --json`,
grep it for the heading or option you need (`grep -n '^## '` lists the sections), and read that
section, rather than printing the whole topic.

The JSON Schemas are the authoritative list of properties, with a description on each. They sit in
`json_schemas/` next to the `docs/` folder those paths point into: `source-schema.json`,
`producer-schema.json`, `consumer-schema.json`, `project-schema.json`, `code-set-schema.json`. They
are exactly what `compile` enforces. If the CLI is not installed locally, the latest copies are at
https://github.com/ForzaLabs/remora-public.

To see what an existing project contains without reading every file:

```bash
remora graph -f json           # every resource and what feeds what
```

## Building a pipeline

1. **Project.** No `remora/` folder yet? `remora init` creates one with a working default source,
   producer and consumer. It asks questions interactively, so ask the user to run it (`! remora init`
   in Claude Code) rather than running it yourself.
2. **Source.** Write `remora/sources/<name>.json`. Pick the `engine` and `authentication.method` from
   the source schema and the sources topic.
3. **Producer.** `remora create-producer <name>` scaffolds one. If the source is reachable,
   `remora discover <producer>` reads it and fills in the `dimensions` (it merges into the ones already
   written; `--replace` rewrites them). Then `remora sample <producer>` to see real rows.
4. **Consumer.** `remora create-consumer <name> -p <producer>` scaffolds a one-to-one mapping. Add
   joins, `fields[].transform`, filters, validation and the single output, checking each option in the
   consumers topic.
5. **Check.** `remora compile`, then `remora sample <consumer>`, then
   `remora synth <consumer> -r 100` to exercise the whole pipeline on generated data (exports go to
   `remora/.synth`, never the real destinations).
6. **Run.** `remora run <consumer>` (`-l <n>` limits the output rows for a quick test). A real run
   writes to the configured destination — confirm with the user before running one that writes to a
   shared system (a database, S3, an API).

## Commands

Every command takes `--json`: progress, messages and tables as one JSON object per line on stdout.
Prefer it when you will parse the output. Exit code is non-zero on failure.

| Command | Use |
|---|---|
| `remora compile` | Validate the whole project. The first thing to run, always |
| `remora docs [topic]` | List or print the installed documentation |
| `remora graph [-f mermaid\|dot\|json]` | Lineage of the project |
| `remora verify [producer]` | Test that sources connect. Compile passes but nothing reads? Run this |
| `remora sample <name> [-s rows]` | Print rows from a producer or consumer, nothing written |
| `remora synth [consumer] [-r n] [-s seed] [-d domain]` | Whole pipeline on fake data, written to `remora/.synth` |
| `remora run [consumer] [-d domain] [-l n] [--parallel]` | Execute for real. No name runs every consumer |
| `remora discover <producer> [--replace]` | Fill dimensions from the source's schema or a file's fields |
| `remora create-producer <name>` / `create-consumer <name> [-p producer]` | Scaffold a resource |
| `remora import-copybook <file>` | Write a `FIXED` producer from a COBOL copybook |
| `remora migrate --dry-run` / `--all` | Rewrite configs written for an older CLI. `--json` needs `--all` |
| `remora report [run-id]` | Zip a run (versions, config, redacted log) for a bug report |
| `remora ui-preview` | Browser view of the project. Long-running: start it in the background or let the user run it |
| `remora package` / `remora deploy` | Build / upload to a Remora Worker. Only when the user asks |

Check `remora <command> --help` for anything not listed here; the help is authoritative for the
installed version.

## When something fails

Work down this list, one step at a time:

1. `remora compile` — almost every problem is a config problem, and this names the file and path.
   A warning ending in `run "remora migrate" to fix` means the config predates the CLI: run
   `remora migrate --dry-run`, show the user the changes, then `remora migrate --all`.
2. `remora verify` — compile passes but a run reads nothing: connectivity or credentials.
3. `remora sample <producer>` — what Remora actually reads, before any consumer logic. Wrong types or
   empty fields point at the producer's `dimensions` or `settings`.
4. `remora sample <consumer>` and `remora synth <consumer> -r 100` — the consumer logic in isolation.
5. `remora report` — packages the last run for the Remora developers. Tell the user what it contains
   (versions, configuration as written, the run record and its log with secrets redacted) before they
   send it anywhere.

## Options that no longer exist

Assistants often produce these from outdated docs. `compile` rejects them; know the replacements:

| Wrong | Use |
|---|---|
| `"engine": "aws-dynamodb"` | Removed — pick an engine from the source schema |
| `"operator": "eq"` / `neq` / `gt` / `gte` / `lt` / `lte` | `equals`, `notEquals`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals` |
| `"operator": "not_contains"` | `notContains` |
| `authentication.bucketName` | `authentication.bucket` |
| `outputs[].accellerated`, `outputs[].direct` | Removed — delete them |
| `producers[].custom.language` / `.code` | Removed — use `fields[].transform` |
| `fields[].grouping` | Removed |
| Two or more entries in `outputs` | Exactly one output per consumer |
| `"format": "SQL"` as an output | Removed |
| `project.json` listing `consumers`/`producers`/`sources`/`schemas` paths | Ignored — the folders are fixed |
| `decimals`, `allowedValues`, `codeSet`, `references` on a dimension | Under `dimension.synth` |
| `--project` / `-p` on `run` or `synth` | `--domain` / `-d`, matching a consumer's `domains` |

## Licence

Without `REMORA_LICENCE_KEY`, Remora is free for non-commercial use, and `run`, `synth`, `sample` and
`ui-preview` print a notice saying so — that is not an error. `deploy` requires a key. Never set,
read or print the user's key.
