# Remora - Code Sets

## **Overview**

Code sets are named, reusable lists of allowed values used to drive **synthetic data generation** (the `synth` command). They let you produce realistic, domain-accurate fake data by telling Remora which values a field may take — and, for related fields, which values belong together on the same row.

Code sets affect **only** synthetic generation. They have no effect on normal producer reads, consumer transformations, or any other part of the pipeline.

There are three ways to constrain a producer dimension's synthetic values:

- **Inline** (`synth.allowedValues`) — a quick, one-off list on a single dimension.
- **Named flat code set** (`synth.codeSet: "name"`) — a reusable list, defined once and referenced from many dimensions.
- **Named structured code set** (`synth.codeSet: { "name": ..., "field": ... }`) — a table of correlated rows, so related fields (e.g. a code and its description) stay coherent.

All of them are declared under the dimension's `synth` object, which holds every synthetic-only property.

Remora also ships a library of **built-in code sets** (HEDIS measures, code systems, gap statuses, and more) that are applied automatically by field name, with no configuration required.

---

## **How Values Are Chosen**

For each dimension, synthetic generation resolves a value in this order of precedence:

1. Explicit `synth.references` on the dimension (a foreign key — see below)
2. Explicit `synth.allowedValues` on the dimension
3. Explicit `synth.codeSet` on the dimension
4. A **built-in** code set matched by the field's name
5. A name-based generator (email, city, dates, identifiers, etc.)

`references`, `allowedValues` and `codeSet` are mutually exclusive within a dimension's `synth` object, and any of them wins over a built-in match, so you can override the defaults per field. Picks are uniform (each value equally likely).

---

## **Referential Integrity (Foreign Keys)**

Code sets keep *categorical* fields coherent. To keep *keys* coherent across producers — so a consumer's joins and unions actually line up — declare a foreign key with `synth.references`:

```json
{ "name": "patient_id", "type": "string",
  "synth": { "references": { "producer": "p_members", "field": "member_id" } } }
```

Every synthetic value generated for `patient_id` is drawn from the values `p_members.member_id` emits, so the foreign key is always valid — there are no orphan rows. The relationship works even when the foreign key and the parent key have different names (`patient_id` → `member_id`).

- `producer` / `field` name the parent producer and the parent dimension (by its `name`).
- The referenced parent field is generated as a **unique key** (like a primary key) so children always find a match. If it isn't marked `pk`, `synth` logs a warning and proceeds.
- Only single-column relationships are supported. Composite (multi-column) keys are not yet correlated: two `synth.references` fields pointing at the same parent are picked independently, so their pair may not match a single parent row.
- Generation stays deterministic — the same `--seed` reproduces the same keys and the same joined output.

---

## **Defining Code Sets**

Code sets are a top-level project resource, like sources, producers and consumers. They are **optional** — omit them entirely and the built-in sets still apply.

### **Project Setup**

Create a `code_sets` folder next to `project.json` and place one JSON file per code set inside it. There is nothing to declare: the folder is picked up automatically when it is there, and ignored when it is not.

```
remora/
├── project.json
├── code_sets/
│   ├── gap_statuses.json
│   └── hedis_measures.json
├── producers/
└── ...
```

### **Flat Code Sets**

A flat code set is a simple list of values. One value is picked per row.

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/code-set-schema.json",
  "name": "gap_statuses",
  "description": "Care-gap compliance statuses.",
  "values": ["OPEN", "CLOSED", "COMPLIANT", "NON-COMPLIANT", "EXCLUDED", "PENDING"]
}
```

Values may be strings, numbers, or booleans:

```json
{
  "name": "days_supply",
  "values": [30, 60, 90]
}
```

### **Structured (Correlated) Code Sets**

A structured code set is a table of records. Dimensions bind to a **field** of the set, and every dimension bound to the same set lands on the **same row per record** — so related values stay coherent.

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/code-set-schema.json",
  "name": "hedis_measures",
  "description": "Correlated HEDIS measure code, name and coding system.",
  "records": [
    { "code": "CBP", "name": "Controlling High Blood Pressure", "system": "LOINC" },
    { "code": "COL", "name": "Colorectal Cancer Screening", "system": "CPT" },
    { "code": "BCS", "name": "Breast Cancer Screening", "system": "CPT" }
  ]
}
```

> A code set must have **either** `values` **or** `records`, never both.

---

## **Referencing a Code Set from a Producer**

You reference a code set from a producer's dimension's `synth` object (see [Remora - Producers](Remora%20-%20Producers.md)). `allowedValues` and `codeSet` are mutually exclusive on the same dimension.

### **Inline values**

```json
{
  "name": "gender_code",
  "type": "string",
  "synth": { "allowedValues": ["M", "F", "U"] }
}
```

### **Named flat set**

Reference a flat code set by name (a string):

```json
{
  "name": "gap_status",
  "type": "string",
  "synth": { "codeSet": "gap_statuses" }
}
```

### **Named structured set**

Reference a structured code set with `{ "name", "field" }`. Point multiple dimensions at the same set to keep them correlated:

```json
{
  "name": "measure_code",
  "type": "string",
  "synth": { "codeSet": { "name": "hedis_measures", "field": "code" } }
},
{
  "name": "measure_name",
  "type": "string",
  "synth": { "codeSet": { "name": "hedis_measures", "field": "name" } }
}
```

With the set above, every generated row pairs a code with its correct name — e.g. `CBP` always appears alongside `Controlling High Blood Pressure`, never a mismatched description.

---

## **Built-in Code Sets**

Remora ships built-in healthcare/payer-quality code sets that are applied **automatically** when a dimension's name matches — no `synth.codeSet` needed. This is why, out of the box, a field named `measure_code` produces real HEDIS codes and `gap_status` produces valid statuses.

| Built-in set | Kind | Applied to fields whose name contains |
| --- | --- | --- |
| `hedis_measures` | structured (`code`, `name`, `system`) | `measure_code`, `sub_measure_code`, `measure_classification_code` → `code`; `measure_name`, `measure_description` → `name` |
| `code_systems` | flat | `code_system` |
| `gap_statuses` | flat | `gap_code`, `gap_status`, `compliance` |
| `product_types` | flat | `product_type` |
| `specialties` | flat | `specialty` |
| `clinical_events` | flat | `event_name`, `event_category` |
| `run_types` | flat | `run_type` |
| `genders` | flat | `gender_code`, `gender`, `sex` |
| `yn_indicators` | flat | `indicator` |
| `days_supply` | flat | `days_supply` |

Because `measure_code` and `measure_name` both bind to the built-in `hedis_measures` set, they are automatically correlated on each row — with no configuration.

A built-in set is only applied when it can produce the dimension's declared `type`. A numeric surrogate key such as `heb_quality_gaps_measure_code_sk` matches `measure_code` by name, but HEDIS codes are not numbers, so the binding is skipped and the field is generated from its own type instead. An **explicit** `synth.codeSet` or `synth.allowedValues` that cannot produce the declared type is a configuration error and fails the run by name.

### **Overriding a built-in set**

Define a code set with the **same name** as a built-in one to override it project-wide:

```json
{
  "name": "gap_statuses",
  "values": ["OPEN", "CLOSED"]
}
```

Now any field that maps to `gap_statuses` (whether by built-in name matching or an explicit `synth.codeSet`) draws only from your values.

---

## **Determinism**

Synthetic generation is fully deterministic: the same `--seed` always produces the same dataset, including code-set picks and correlated rows. Change the seed to get a different-but-equally-valid dataset. This makes generated data reproducible across runs and machines.

---

## **Code Set Schema Reference**

| Property | Required | Description | Values |
| --- | --- | --- | --- |
| `name` | ✅ | Unique code set name, referenced from a dimension's `synth.codeSet` | Any valid identifier |
| `description` | ❌ | Human-readable description | Descriptive text |
| `values` | one of `values`/`records` | Flat list; one value picked per row | Array of string / number / boolean |
| `records` | one of `values`/`records` | Correlated rows; dimensions bind to a field | Array of objects (string / number / boolean fields) |

---

## **End-to-End Example**

`remora/code_sets/hedis_measures.json`:

```json
{
  "name": "hedis_measures",
  "records": [
    { "code": "CBP", "name": "Controlling High Blood Pressure", "system": "LOINC" },
    { "code": "COL", "name": "Colorectal Cancer Screening", "system": "CPT" }
  ]
}
```

`remora/code_sets/gap_statuses.json`:

```json
{
  "name": "gap_statuses",
  "values": ["OPEN", "CLOSED", "COMPLIANT", "EXCLUDED"]
}
```

`remora/producers/p_quality_gaps.json` (excerpt):

```json
{
  "name": "p_quality_gaps",
  "source": "s_local",
  "dimensions": [
    { "name": "member_id", "type": "string", "pk": true },
    { "name": "measure_code", "type": "string", "synth": { "codeSet": { "name": "hedis_measures", "field": "code" } } },
    { "name": "measure_name", "type": "string", "synth": { "codeSet": { "name": "hedis_measures", "field": "name" } } },
    { "name": "gap_status",   "type": "string", "synth": { "codeSet": "gap_statuses" } },
    { "name": "gender_code",  "type": "string", "synth": { "allowedValues": ["M", "F", "U"] } }
  ],
  "settings": { "sqlTable": "quality_gaps_vw" },
  "_version": 1
}
```

Generate synthetic data through a consumer that uses this producer:

```bash
# Run one consumer (100 rows, default seed)
npx @forzalabs/remora synth c_quality_gaps

# Control row count and seed
npx @forzalabs/remora synth c_quality_gaps --records 500 --seed my-seed

# Run every consumer tagged with a given project
npx @forzalabs/remora synth --project my-project
```

Each generated row will pair `measure_code` with its matching `measure_name`, draw `gap_status` from your flat set, and pick `gender_code` from the inline list.
