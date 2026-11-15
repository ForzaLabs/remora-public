# Remora - Upgrading

## **Overview**

When a release renames or drops a config field, the CLI keeps reading the old shape for a while and warns about it on every load. `remora migrate` rewrites your project's files to the shape the installed CLI expects, so the warnings stop and nothing is left to edit by hand.

After installing a new version of the CLI, run it from the folder that holds `remora/`:

```bash
remora migrate --dry-run   # see what would change
remora migrate             # pick the updates and apply them
remora compile             # check the updated project
```

You can tell a project needs it when a warning ends with `run "remora migrate" to fix`, or when `remora compile` closes with a line saying so.

---

## **What It Updates**

Each update is a migration with a stable id and the CLI version that introduced it. `migrate` lists only the ones whose old shape it finds in your files, oldest first, so a project several releases behind upgrades in one run.

| Id | Since | What it does |
| --- | --- | --- |
| `env-runtime-context` | 1.5.0 | Adds `REMORA_RUNTIME_CONTEXT=cli` to `.env` when it is not set |
| `project-drop-folder-keys` | 2.2.0 | Removes `consumers`, `producers`, `sources`, `schemas` and `codeSets` from `project.json`; the folder layout is fixed |
| `gitignore-generated-folders` | 2.7.0 | Adds `remora/.temp` and `remora/.synth` to `.gitignore` when missing |
| `consumer-linecount-to-meta` | 2.11.0 | Rewrites `"lineCount": true` as `"meta": "lineCount"` on consumer fields |
| `consumer-project-to-domains` | 3.1.0 | Rewrites a consumer's `"project": "x"` as `"domains": ["x"]` |
| `readme-refresh` | 3.1.0 | Replaces `remora/README.md` with the README of the installed CLI |

A missing `.gitignore`, `.env` or `remora/README.md` is left alone.

**Example.** A consumer written before 3.1.0:

```json
{
    "name": "c_orders",
    "project": "sales",
    "fields": [
        { "key": "order_id" },
        { "key": "row", "lineCount": true }
    ]
}
```

after `remora migrate`:

```json
{
    "name": "c_orders",
    "domains": ["sales"],
    "fields": [
        { "key": "order_id" },
        { "key": "row", "meta": "lineCount" }
    ]
}
```

Only the changed keys move. Indentation, key order, line endings and everything else in the file stay as you wrote them, so a diff of a migrated file shows the change and nothing else.

---

## **Options**

| Option | Does |
| --- | --- |
| none | Lists the updates as a checklist, all ticked, and asks before writing |
| `--dry-run` | Prints the change to each file and writes nothing |
| `--all` | Applies every update without asking |
| `--only <ids>` | Applies only the named updates, comma-separated, without asking |
| `--json` | Prints the report as JSON lines, like every other command |

Off a terminal (CI, scripts) or with `--json`, nothing is asked: pass `--all` or `--only`, or `migrate` lists the updates and exits with code 1. `--dry-run` combines with `--only` to show just those changes.

```bash
remora migrate --only consumer-project-to-domains --dry-run
remora migrate --all --json
```

A project that is already current prints one line and exits 0. Running `migrate` a second time changes nothing.

---

## **Before You Run It**

`migrate` rewrites files in place, and git is the undo. It warns, without stopping, when `remora/` has uncommitted changes or the folder is not in a git repository. Commit first, so the update's own changes can be reviewed and reverted on their own.

---

## **Files It Will Not Rewrite**

**A file that needs a hand edit.** A file setting both the old and the new shape, such as a consumer with both `project` and `domains`, is listed first as needing a hand edit and left unchanged; `remora compile` stops on it until you remove one. A file that does not parse, or sets the same key twice, is listed the same way.

**A README you edited.** When `remora/README.md` is not a copy of any README Remora shipped, `migrate` asks whether to overwrite it, write the current one beside it as `remora/README.remora.md`, or skip it. `--all` and `--only` write `README.remora.md` and leave yours untouched.

**A failed write** stops the run and names the file. Files already written stay written; each one is complete on its own.

---

## **Changes Without a Migration**

A migration exists only where the rewrite is mechanical and keeps the meaning. Other breaking changes are described in the release notes' **Upgrading** line for the release that made them, and `remora compile` names each one it finds.
