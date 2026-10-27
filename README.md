# Remora — schemas and documentation

Remora is a data transformation system built around a **Source → Producer → Consumer** pipeline. You
describe each stage as JSON; Remora reads, reshapes and writes the data. There is no pipeline code
to write.

```bash
npm install -g @forzalabs/remora
remora init
```

This repository is a published mirror of two things from the Remora source tree: the JSON Schemas
every configuration file is validated against, and the full prose reference. It holds no code.

## JSON Schemas

Each generated config carries a `$schema` key pointing at one of these, so VS Code and most editors
give you completion, inline documentation and validation as you type.

| Resource | Schema |
|---|---|
| Project | [project-schema.json](json_schemas/project-schema.json) |
| Source | [source-schema.json](json_schemas/source-schema.json) |
| Producer | [producer-schema.json](json_schemas/producer-schema.json) |
| Consumer | [consumer-schema.json](json_schemas/consumer-schema.json) |
| Code set | [code-set-schema.json](json_schemas/code-set-schema.json) |

The schemas carry a description for every property — around 350 across the five — so they are the
authoritative reference for what an option does and what values it accepts. They are also exactly
what `remora compile` enforces.

## Documentation

| | |
|---|---|
| [Sources](docs/Remora%20-%20Sources.md) | Connecting to Redshift, Postgres, S3, SQS, Delta Share, HTTP APIs, presigned URLs and local files |
| [Producers](docs/Remora%20-%20Producers.md) | Reading tables and files, dimensions, fixed-width layouts, masking, discovery |
| [Consumers](docs/Remora%20-%20Consumers.md) | Joins, fields, the 28 transformations, filters, validation, outputs and triggers |
| [Code Sets](docs/Remora%20-%20Code%20Sets.md) | Reusable value lists that drive synthetic data generation |

## Versioning

This mirror tracks the latest published CLI. The same schemas and documents ship **inside** the npm
package, so the copy that matches the version you installed is always on your own disk:

```bash
ls "$(npm root -g)/@forzalabs/remora/docs"
ls "$(npm root -g)/@forzalabs/remora/json_schemas"
```

Prefer those when the two disagree — and run `remora compile`, which validates against them.

## Licence

The schemas and documentation in this repository are free to use, copy, modify and redistribute for
any purpose, commercial included, so that any editor, validator or generator can build on them. See
[LICENSE](LICENSE).

That grant covers this repository only. The Remora program itself is proprietary and licensed
separately: free for non-commercial use, with any organisational or commercial use requiring a
written licence from Forza Labs. Contact admin@forza-labs.com.

## Issues

Bug reports and questions belong on the CLI package: [@forzalabs/remora](https://www.npmjs.com/package/@forzalabs/remora).
`remora report` packages a run — versions, redacted configuration, the run record and its slice of
the log — into a zip worth attaching.
