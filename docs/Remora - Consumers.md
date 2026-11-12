# Remora - Consumers

## **Overview**

Consumers in Remora define how data is translated, transformed, combined, and output from producers. They act as the data transformation and output layer, providing field selection, data joins, filtering, transformations, trigger configuration, and export capabilities.

Each consumer configuration specifies:

- **Data sources** (which producers to consume from)
- **Field selection** (which fields to include and how to transform them)
- **Filtering** (how to subset the data)
- **Transformation** (how data is changed)
- **Output formats** (where, when and how to export the processed data)

## **Core Components**

### **Consumer Structure**

All consumers follow this basic structure:

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/consumer-schema.json",
  "name": "consumer-name",
  "description": "Consumer description",
  "producers": [/* data sources */ ],
  "fields": [/* field selection and transformation */ ],
  "outputs": [/* export configurations */ ],
  "filters": [/* data filtering */ ],
  "options": {/* processing options */ },
  "validate": [/* dataset-level validations */ ],
  "split": {/* break the output into several files */ },
  "metadata": {/* custom tags */ },
  "project": "project-name",
  "schema": "schema-name",
  "_version": 1
}
```

### **Consumer Types by Use Case**

| Use Case | Description | Key Features |
| --- | --- | --- |
| **Simple Extraction** | Basic field selection from one producer | Field selection, aliasing, transformations |
| **Data Joining** | Combine data from multiple producers | JOIN operations, relationship definitions |
| **Data Union** | Merge datasets with same structure | UNION operations, data consolidation |
| **Analytics** | Complex transformations and aggregations | Calculated fields, filtering, pivots |
| **Export Pipeline** | Automated data export with scheduling | Triggers, multiple output formats |

---

## **Basic Consumer Configuration**

### **Simple Field Selection**

The most basic consumer selects all fields from a single producer:

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/consumer-schema.json",
  "name": "simple-consumer",
  "description": "Basic field selection",
  "producers": [
    { "name": "producer-name" }
  ],
  "fields": [
    { "key": "*" }
  ],
  "outputs": [
    { "format": "JSON", "exportDestination": "destination" }
  ],
  "_version": 1
}
```

### **Selective Field Configuration**

Select specific fields with aliases and transformations:

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/consumer-schema.json",
  "name": "selective-consumer",
  "description": "Selective field extraction with aliases",
  "producers": [
    { "name": "customer-data" }
  ],
  "fields": [
    { "key": "customer_id", "alias": "Customer ID" },
    { "key": "first_name", "alias": "First Name" },
    { "key": "email", "alias": "Email Address" },
    { "key": "registration_date", "alias": "Registration Date" }
  ],
  "outputs": [
    { "format": "JSON", "exportDestination": "local-output" }
  ],
  "_version": 1
}
```

---

## **Producer Configuration**

Producers define the data sources that consumers pull from. Each consumer can have multiple producers for joining or union operations.

### **Producer Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `name` | ✅ | Producer **or consumer** name to consume from (see *Consumer as Input*) | `"customer-data"`, `"order-history"` |
| `joins` | ❌ | JOIN configurations for multi-producer consumers | Array of join definitions |
| `union` | ❌ | Union data instead of joining | `true`, `false` (default) |
| `isOptional` | ❌ | If the producer's data is missing at run time (e.g. the file isn't present), don't fail — create a placeholder dataset and continue | `true`, `false` (default) |

### **Single Producer**

```json
{
  "producers": [
    { "name": "sales-data" }
  ]
}
```

### **Multiple Producers with Joins**

```json
{
  "producers": [
    { "name": "customers" },
    {
      "name": "orders",
      "joins": [
        {
          "otherName": "customers",
          "relationship": "many-to-one",
          "sql": "${P.customer_id} = ${customers.customer_id}"
        }
      ]
    }
  ]
}
```

### **Union Operations**

```json
{
  "producers": [
    { "name": "sales-2023", "union": true },
    { "name": "sales-2024", "union": true }
  ]
}
```

### **Consumer as Input**

A producer entry can name another **consumer** instead of a producer. That consumer is run first and its **full output** is streamed in as this consumer's input — the way to chain pipelines, where one consumer transforms the output of another.

This is different from `code_lookup`, which pulls another consumer's output into a small in-memory `code → value` table. A consumer input is the whole dataset: it is materialized to disk and chunked across workers, so the upstream output can be arbitrarily large.

The upstream consumer's **output fields** (final names / aliases, not its underlying source columns) become the available columns. Its records are combined with any other producers via union, then shaped by this consumer's own fields, filters, and transforms. Chains are supported (a consumer input whose upstream also has consumer inputs), with cycle and depth detection.

```json
{
  "producers": [
    { "name": "c_active_accounts" }
  ],
  "fields": [
    { "key": "id" },
    { "key": "country", "alias": "country_upper", "transform": { "to_uppercase": true } }
  ],
  "filters": [
    { "rule": { "member": "plan", "operator": "equals", "values": ["enterprise"] } }
  ]
}
```

Here `c_active_accounts` is another consumer; `c_active_accounts` runs, and this consumer reads its output, keeps enterprise rows, and uppercases `country`.

---

## **Field Configuration**

Fields define which data columns to include in the consumer output and how to transform them.

### **Field Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `key` | ✅ | Field name from producer, `*` for all, or a pattern holding a `*` (see [Pattern Keys](#pattern-keys)) | `"customer_id"`, `"*"`, `"addr*Street"` |
| `description` | ❌ | Optional human-readable description of the field. No runtime effect, but it is shown under the field in `remora ui-preview` and the field filter matches it | Descriptive text |
| `alias` | ❌ | New name for the field in output. A template when the key is a pattern | `"Customer ID"`, `"street_*"`, `"{key}_iso"` |
| `from` | ❌ | Producer to get field from (for ambiguous fields) | `"customers"`, `"orders"` |
| `transform` | ❌ | Data transformations to apply | Transformation objects |
| `default` | ❌ | Default value if field is missing | `"Unknown"`, `0`, `null` |
| `fixed` | ❌ | Use default value always (don't look in data) | `true`, `false` |
| `hidden` | ❌ | Include in processing but exclude from output | `true`, `false` |
| `onError` | ❌ | Error handling strategy | `"set_default"`, `"skip"`, `"fail"` |
| `validate` | ❌ | Field-level data-quality rules (see [Field Validation](#field-validation)) | Array of `{ rule, onFail }` |
| `copyFrom` | ❌ | Add a new field that is a value copy of an earlier field (copies the value *before* that field's transformations) | `"amount"`, `"Sale Amount"` |
| `meta` | ❌ | A value the engine produces instead of reading a column: the run's id, or the record's source line (see [Meta Fields](#meta-fields)) | `"executionId"`, `"lineCount"` |
| `position` | ⚠️ | `FIXED` output only, and required on every visible field of one: the columns this field occupies and how its value is filled out to them (see [FIXED Output](#fixed-output)) | `{ "width": 10, "start": 21 }` |
| `path` | ❌ | `JSON`/`API` output only: where this field's value sits in the exported document. Dots make objects, each `[]` is one repeating level (see [Nested Documents](#nested-documents)) | `"patient.reference"`, `"item[].net.value"` |
| `groupConflict` | ❌ | `JSON`/`API` output only, and only on a grouped output: what happens when the records of one group disagree on this field's value. Defaults to failing the run | `"fail"` (default), `"first"` |

A field's **output name** is its `alias` when it has one and its `key` otherwise. Two fields resolving to the same output name are rejected at `compile`: a record is keyed by that name, so a collision never failed at run time — one field simply overwrote the other.

### **Field Selection Patterns**

### **All Fields**

```json
{
  "fields": [
    { "key": "*" }
  ]
}
```

### **Specific Fields**

```json
{
  "fields": [
    { "key": "customer_id" },
    { "key": "first_name" },
    { "key": "email" }
  ]
}
```

### **Fields with Aliases**

```json
{
  "fields": [
    { "key": "customer_id", "alias": "Customer ID" },
    { "key": "first_name", "alias": "First Name" },
    { "key": "order_total", "alias": "Total Amount" }
  ]
}
```

### **Pattern Keys**

A key holding a `*` selects **every field whose name matches**, and each match keeps the rest of the field's configuration. One entry then stands in for a whole family of columns — which is what makes the columns a [repeating group](Remora%20-%20Producers.md#repeating-groups-occurs) generates usable without writing one field per occurrence:

```json
{
  "fields": [
    { "key": "member_id" },
    { "key": "addr*Street", "alias": "street_*" },
    { "key": "addr*State", "alias": "{key}_upper", "transform": { "to_uppercase": true }, "onError": "skip" }
  ]
}
```

Against a producer with three address occurrences that yields `street_0`, `street_1`, `street_2`, `addr0State_upper`, `addr1State_upper` and `addr2State_upper` — and the `to_uppercase` transform, declared once, runs on each of the three matches.

Since several columns come out of one entry, `alias` becomes a **template** that has to vary per match:

| Token | Replaced by | Example (`key: "addr*Street"` matching `addr0Street`) |
| --- | --- | --- |
| `*` | What the pattern's wildcard captured, positionally | `"street_*"` gives `street_0` |
| `{key}` | The full matched field name | `"{key}_iso"` gives `addr0Street_iso` |

Notes:

- Matching is literal apart from the wildcards — a pattern is never a regular expression.
- A pattern is expanded **where it is declared**, and its matches follow the producer's own column order.
- A pattern that matches **nothing** is rejected at `compile`, as is an `alias` that would give two matches the same output name. So is a pattern combined with `fixed`, `copyFrom` or `meta`: those fields don't read a producer column, so there is nothing to match.
- Add `"onError": "skip"` when a transform can't handle every match — over a sparse repeating group most occurrences are `null`, and a transform like `to_uppercase` rejects a non-string value rather than passing it through.
- The bare `"key": "*"` keeps its own meaning: every column of one producer, under its own name.

### **Fields from Specific Producers**

```json
{
  "fields": [
    { "key": "customer_id", "from": "customers" },
    { "key": "order_date", "from": "orders" },
    { "key": "product_name", "from": "products" }
  ]
}
```

### **Fixed Fields**

```json
{
  "fields": [
    { "key": "report_date", "default": "2024-01-01", "fixed": true },
    { "key": "version", "default": "1.0", "fixed": true }
  ]
}
```

### **Copied Fields**

`copyFrom` adds a new field whose value is a copy of another field that appears **earlier** in the list. The value is copied *before* the source field's own transformations are applied, so the two fields can then diverge. Reference the source by its `alias` if it has one, otherwise its `key`.

```json
{
  "fields": [
    { "key": "amount", "alias": "raw_amount" },
    { "key": "amount", "alias": "amount_with_tax", "copyFrom": "raw_amount", "transform": { "multiply": 1.08 } }
  ]
}
```

### **Meta Fields**

`meta` fills a field with a value the engine produces, rather than one read from a producer column:

```json
{
  "fields": [
    { "key": "run_id", "meta": "executionId" },
    { "key": "row_number", "meta": "lineCount" },
    { "key": "customer_id" }
  ]
}
```

| Value | What the field holds | Type |
| --- | --- | --- |
| `executionId` | The id of the run that wrote the record, the same on every record of the run. It is the id `remora report` shows, and the one `{executionId}` renders in an [`exportPrefix`](#a-folder-per-run-exportprefix) or a [`call-api`](#call-an-api-call-api) body | string |
| `lineCount` | The 1-based source line of the record. It stays the line of the source file even when the file is processed in parallel across several workers | number |

A consumer started by a [`run-consumer`](#run-consumers) action is a run of its own, so its `executionId` is its own, not its parent's.

A meta field reads no column, so it can't also be `fixed` or `copyFrom`, can't use a pattern key or `*`, and a filter on it is never [pushed down](#pushdown-delta-share) to the source. A `lineCount` field also takes no `transform` or `validate`, and no filter, `copyFrom` or transformation can read it: its value is only final once every worker's records are merged. Each of these is rejected at `compile`.

`"lineCount": true` is the older spelling of `"meta": "lineCount"` and still works, but `compile` warns on it. Setting both on one field is rejected.

---

## **Field Transformations**

Transformations allow you to modify field values during processing.

### **Data Type Transformations**

### **Cast Operations**

```json
{
  "key": "birth_date",
  "transform": { "cast": "datetime", "format": "YYYY-MM-DD" }
}
```

```json
{
  "key": "price",
  "transform": { "cast": "number" }
}
```

### **String Transformations**

### **Case Conversions**

```json
{
  "key": "name",
  "transform": { "to_uppercase": true }
}
```

```json
{
  "key": "email",
  "transform": { "to_lowercase": true }
}
```

```json
{
  "key": "title",
  "transform": { "capitalize": true }
}
```

### **String Manipulation**

```json
{
  "key": "description",
  "transform": { "trim": true }
}
```

```json
{
  "key": "year",
  "transform": { "substring": { "start": 0, "end": 4 } }
}
```

```json
{
  "key": "code",
  "transform": { "pad_start": { "length": 6, "char": "0" } }
}
```

```json
{
  "key": "name",
  "transform": { "prepend": "Mr. " }
}
```

```json
{
  "key": "filename",
  "transform": { "append": ".txt" }
}
```

### **String Splitting**

```json
{
  "key": "full_name",
  "alias": "first_name",
  "transform": { "split": { "separator": " ", "index": 0 } }
}
```

### **Numeric Transformations**

### **Mathematical Operations**

```json
{
  "key": "price",
  "alias": "price_with_tax",
  "transform": { "multiply": 1.08 }
}
```

```json
{
  "key": "base_score",
  "alias": "adjusted_score",
  "transform": { "add": 10 }
}
```

### **Referencing Other Fields**

`multiply`, `add`, `prepend`, `append`, and the `then`/`else`/`default` of `conditional` and `switch_case` accept a `"$fieldName"` string instead of a literal — this resolves to the current value of another field in the same record (matched by its alias if set, otherwise its key). Use `"$$"` to escape a literal leading `$`.

```json
{
  "key": "net_amount",
  "alias": "total",
  "transform": { "add": "$tax_amount" }
}
```

The referenced field must be **present** in the record: if it isn't, the transformation fails and the field's `onError` policy applies. A referenced field that is present but `null` is treated as real data and passed to the operation rather than failing the row — in `multiply`/`add` it counts as `0`, and in `prepend`/`append` it concatenates as the text `null`.

### **Multiplying / Adding Multiple Fields**

`multiplyBy` and `addBy` combine several fields together (rather than a single factor/addend):

```json
{
  "key": "line_total",
  "transform": { "multiplyBy": { "fields": ["quantity", "unit_price"] } }
}
```

```json
{
  "key": "grand_total",
  "transform": { "addBy": { "fields": ["subtotal", "tax", "shipping"] } }
}
```

### **Date/Time Transformations**

### **Date Component Extraction**

```json
{
  "key": "order_date",
  "alias": "order_year",
  "transform": { "extract": "year" }
}
```

```json
{
  "key": "timestamp",
  "alias": "hour_of_day",
  "transform": { "extract": "hour" }
}
```

`extract` supports `year`, `month`, `day`, `hour`, and `minute`.

### **Date Reformatting**

`date_format` reformats a date string from one representation to another using [dayjs](https://day.js.org/docs/en/display/format) tokens — distinct from `cast`, which only parses or formats with a single token set. `strict` parsing defaults to `true`.

```json
{
  "key": "birth_date",
  "transform": { "date_format": { "input_fmt": "DDMMYYYY", "output_fmt": "YYYY-MM-DD" } }
}
```

**Day-of-year ("Julian") dates** — common in mainframe flat files, where a date is written as a year plus the ordinal day within it — are read with `DDD` or `DDDD`, always 3 digits:

```json
{
  "key": "service_date",
  "transform": { "date_format": { "input_fmt": "YYYYDDD", "output_fmt": "YYYY-MM-DD" } }
}
```

`2007305` reads as `2007-11-01`. A day-of-year format combines with `YYYY`/`YY`, `HH`, `mm`, `ss`, `SSS` and literal separators, but not with `MM`/`DD` — a date can't declare both an ordinal day and a calendar one. The same tokens work in a dimension's `format` on the producer side.

A format built on a token dayjs can only *write* and not read (`Do`, `Q`, `w`, `W`, `k`, `gggg`, `z`) is **rejected** with an error naming the token, rather than parsed loosely into a plausible wrong date.

### **Regular Expression Transformations**

### **Pattern Matching**

```json
{
  "key": "email",
  "alias": "is_valid_email",
  "transform": { "regex_match": { "pattern": "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$" } }
}
```

### **Pattern Replacement**

```json
{
  "key": "phone",
  "alias": "formatted_phone",
  "transform": { "regex_replace": { "pattern": "(\\d{3})(\\d{3})(\\d{4})", "replacement": "($1) $2-$3" } }
}
```

### **Pattern Extraction**

```json
{
  "key": "address",
  "alias": "zip_code",
  "transform": { "regex_extract": { "pattern": "\\d{5}(-\\d{4})?", "group": 0 } }
}
```

### **Conditional Transformations**

### **Simple Conditions**

```json
{
  "key": "age",
  "alias": "age_group",
  "transform": {
    "conditional": {
      "clauses": [
        { "if": { "less_than": 18 }, "then": "Minor" },
        { "if": { "less_than": 65 }, "then": "Adult" }
      ],
      "else": "Senior"
    }
  }
}
```

### **Complex Conditions**

```json
{
  "key": "score",
  "alias": "grade",
  "transform": {
    "conditional": {
      "clauses": [
        { "if": { "greater_than_or_equal": 90 }, "then": "A" },
        { "if": { "greater_than_or_equal": 80 }, "then": "B" },
        { "if": { "greater_than_or_equal": 70 }, "then": "C" },
        { "if": { "greater_than_or_equal": 60 }, "then": "D" }
      ],
      "else": "F"
    }
  }
}
```

Clauses are evaluated in order and the first match wins; `else` is optional (if omitted, the original value is kept). The `if` condition supports these operators:

| Operator | Meaning |
| --- | --- |
| `greater_than`, `greater_than_or_equal` | Numeric `>` / `>=` |
| `less_than`, `less_than_or_equal` | Numeric `<` / `<=` |
| `equals`, `not_equals` | Strict (in)equality |
| `in`, `not_in` | Value (not) in a list |
| `starts_with`, `ends_with` | String prefix / suffix |
| `contains`, `not_contains` | String (not) containing a substring |
| `is_empty`, `is_not_empty` | Value is (not) null/undefined/blank |

### **Value Mapping (switch_case)**

`switch_case` maps specific input values to outputs by strict equality (evaluated in order, first match wins). `default` is used when no case matches (optional — otherwise the original value is kept).

```json
{
  "key": "status_code",
  "alias": "status",
  "transform": {
    "switch_case": {
      "cases": [
        { "when": "A", "then": "Active" },
        { "when": "I", "then": "Inactive" }
      ],
      "default": "Unknown"
    }
  }
}
```

### **Masking**

`mask` obfuscates a value for data privacy. Options: `hash` (one-way hash), `mask` (replace with asterisks), `crypt` (reversible encryption), `random` (random value), `seeded-random` (consistent random value per input), `none`.

```json
{
  "key": "ssn",
  "transform": { "mask": "hash" }
}
```

### **Bit Extraction**

`bit_extract` reads a single bit from an integer bitmask (e.g. decoding a packed flag byte). `position` is a 0-based index from the least-significant bit; set `as_boolean` to return `true`/`false` instead of `1`/`0`.

```json
{
  "key": "flags",
  "alias": "is_active",
  "transform": { "bit_extract": { "position": 0, "as_boolean": true } }
}
```

### **Code Lookup**

`code_lookup` maps a code to a value using the output of **another consumer** as the lookup table. The referenced consumer is executed to build a `code → value` table (keep it small and cheap). If the code isn't found and no `default` is given, the field's `onError` policy applies.

```json
{
  "key": "plan_code",
  "alias": "plan_tier",
  "transform": {
    "code_lookup": {
      "consumer": "c_lookup_plans",
      "key": "plan_code",
      "value": "plan_tier",
      "default": "Unknown Tier"
    }
  }
}
```

### **Array Concatenation**

`concat` joins the elements of an array-valued field into a single string.

```json
{
  "key": "tags",
  "transform": { "concat": { "separator": ", " } }
}
```

### **Field Combination**

### **Combining Multiple Fields**

```json
{
  "key": "full_name",
  "transform": {
    "combine_fields": {
      "fields": ["first_name", "last_name"],
      "separator": " "
    }
  }
}
```

```json
{
  "key": "address_line",
  "transform": {
    "combine_fields": {
      "fields": ["street", "city", "state"],
      "template": "{street}, {city}, {state}"
    }
  }
}
```

### **Chained Transformations**

Apply multiple transformations in sequence:

```json
{
  "key": "name",
  "alias": "formatted_name",
  "transform": [
    { "trim": true },
    { "to_lowercase": true },
    { "capitalize": true }
  ]
}
```

---

## **Field Validation**

Attach data-quality rules to a field with `validate`. Each field takes an ordered array of `{ rule, onFail }` entries; every value is checked against the rules and the `onFail` action decides what happens when a rule fails.

**Rules:** `min`, `max` (numeric bounds), `min_length`, `max_length` (string length), `regex` (pattern match), `required` (value must be present), `in` / `not_in` (allowed / disallowed value lists).

**`onFail` actions:** `fail` (abort the run), `skip` (drop the record), `warn` (log and keep), `set_default` (replace with the field's `default`).

```json
{
  "fields": [
    {
      "key": "email",
      "validate": [
        { "rule": { "required": true }, "onFail": "skip" },
        { "rule": { "regex": "^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$" }, "onFail": "warn" }
      ]
    },
    {
      "key": "age",
      "default": 0,
      "validate": [
        { "rule": { "min": 0 }, "onFail": "set_default" },
        { "rule": { "max": 120 }, "onFail": "set_default" }
      ]
    }
  ]
}
```

---

## **Data Filtering**

Filters subset the consumer's result set before it is exported.

### **Rule-Based Filters**

Filters are applied per record to the consumer result set, after the producers have been read and the
fields shaped. They work the same way for every source engine — SQL or file.

```json
{
  "filters": [
    {
      "rule": {
        "member": "amount",
        "operator": "greaterThan",
        "values": ["1000"]
      }
    },
    {
      "rule": {
        "member": "status",
        "operator": "equals",
        "values": ["Active"]
      }
    }
  ]
}
```

### **Filter Operators**

| Operator | Description | Example |
| --- | --- | --- |
| `equals` | Exact match | `{"operator": "equals", "values": ["Active"]}` |
| `notEquals` | Not equal to | `{"operator": "notEquals", "values": ["Inactive"]}` |
| `contains` | String contains | `{"operator": "contains", "values": ["test"]}` |
| `notContains` | String doesn't contain | `{"operator": "notContains", "values": ["temp"]}` |
| `startsWith` | String starts with | `{"operator": "startsWith", "values": ["Mr."]}` |
| `endsWith` | String ends with | `{"operator": "endsWith", "values": [".com"]}` |
| `greaterThan` | Greater than | `{"operator": "greaterThan", "values": ["100"]}` |
| `greaterThanOrEquals` | Greater than or equal | `{"operator": "greaterThanOrEquals", "values": ["100"]}` |
| `lessThan` | Less than | `{"operator": "lessThan", "values": ["1000"]}` |
| `lessThanOrEquals` | Less than or equal | `{"operator": "lessThanOrEquals", "values": ["1000"]}` |
| `in` | Value in list | `{"operator": "in", "values": ["A", "B", "C"]}` |
| `notIn` | Value not in list | `{"operator": "notIn", "values": ["X", "Y", "Z"]}` |
| `between` | Value between range | `{"operator": "between", "values": ["100", "1000"]}` |
| `notBetween` | Value outside range | `{"operator": "notBetween", "values": ["100", "1000"]}` |
| `isNull` | Value is null | `{"operator": "isNull", "values": []}` |
| `isNotNull` | Value is not null | `{"operator": "isNotNull", "values": []}` |
| `true` | Boolean true | `{"operator": "true", "values": []}` |
| `false` | Boolean false | `{"operator": "false", "values": []}` |
| `matches` | Matches a regular expression | `{"operator": "matches", "values": ["^A.*Z$"]}` |
| `notMatches` | Does not match a regular expression | `{"operator": "notMatches", "values": ["^tmp"]}` |

### **How Values Are Compared**

A filter's `values` are always written as strings, while a record holds the value its producer
dimension was cast to — a number for a `number` dimension, a boolean for a `boolean` one, a UTC ISO
timestamp for a `datetime` one. Each side is read as the type the record holds before being compared,
so the string in the configuration is not what makes the match fail:

- **Numbers** — `{"member": "amount", "operator": "equals", "values": ["150"]}` matches an `amount`
  of `150`. A value that is not a number (`"abc"`) matches nothing.
- **Booleans** — `"true"`, `"false"`, `"1"` and `"0"` all match a `boolean` dimension. The dedicated
  `true`/`false` operators take no values and do the same thing.
- **Dates** — a `datetime` is compared as an **instant**, not as text, so `"2024-03-01"` matches a
  record holding `2024-03-01T00:00:00.000Z`, and a bound may carry its own offset
  (`"2024-03-01T11:30:00+02:00"`). A bound with no offset is read as **UTC**, so a filter means the
  same thing whatever the host's timezone. Only ISO-8601 bounds (`2024-03-01`, `2024-03-01T09:00:00`,
  `2024-03-01T09:00:00Z`) are read as dates; anything else is compared as text. A `datetime`
  dimension always holds an ISO timestamp whatever `format` it was read with, so filter it with an
  ISO bound — `"20240301"` compares as text and matches nothing. A date kept as a `string` dimension
  is text on both sides, and matches the spelling the column actually holds.
- A bound naming a **day** means that day's first instant, exactly as a SQL date literal does:
  `{"operator": "between", "values": ["2024-03-01", "2024-03-31"]}` stops at the start of the 31st.
  Write `"2024-03-31T23:59:59"` to include it.
- **Text operators** (`contains`, `startsWith`, `endsWith`, `matches`) read a non-string value's
  text form — a number's digits, a date's ISO timestamp.
- A record whose value is **null** matches no comparison: `isNull`/`isNotNull` are how you filter on
  it. The negations (`notEquals`, `notIn`, `notContains`, `notMatches`) keep such a record.

### **Run Options (API and queue invocations)**

A consumer run started by the execute-consumer API or by the project's `API_QUEUE` may carry an
`options` object asking for **more filters** and a **record limit** on top of what the consumer
already declares. The invocation's filters are applied alongside the consumer's own, and the limit
caps the output records exactly as `remora run --limit` does.

```json
{
  "consumer": "c_sales_export",
  "options": {
    "limit": 100,
    "filters": [
      {
        "rule": {
          "member": "region",
          "operator": "in",
          "values": ["EMEA", "APAC"]
        }
      }
    ]
  }
}
```

The options are checked against the named consumer **before anything is read from a source**, so a
malformed request costs nothing and is answered by the caller's own mistake rather than by a failure
from the middle of a run. The HTTP API answers **400** with the reason; a queue command fails and
follows the `deadLetterQueue` rule for the queue it arrived on.

| Option | Rule |
| --- | --- |
| `filters` | An array of filter objects. At most 100 filters, nested through `and` / `or` at most 5 levels deep |
| `filters[].rule.member` | Must name a field the consumer actually **outputs** — the final name after `alias`, which is what a record holds when filters run. An unknown name is refused rather than silently matching nothing |
| `filters[].rule.operator` | One of the [filter operators](#filter-operators) |
| `filters[].rule.values` | An array of strings, of the arity the operator needs: `between` exactly two, `in` / `notIn` at least one, `isNull` / `isNotNull` / `true` / `false` none |
| `limit` | A whole number from 1 to 10 000 000 — a number, not a string |

Every rejection names the option and where in the tree it sits, for example
`Invalid filter at filters[1].or[0]: consumer "c_sales" has no field named "regionn"`.

**Refused outright:**

- `offset` and `order` — no stage of a run implements them, so accepting them would mean answering
  with unskipped, unordered data as though the request had been honoured
- the `sql` filter operator, which is not evaluated against records
- any other key. An unknown option (`limits`, `filter`) is a typo that would otherwise be ignored in
  silence, so it is refused instead

### **Pushdown (Delta Share)**

Filters are always applied per record, but a source that can narrow the read for itself is *also*
given them as a query hint, so it hands back less than the whole table. Today that is **Delta
Share**: the eligible filters go out as `jsonPredicateHints` on the table query and the record limit
as `limitHint`, and the share server skips the files that cannot hold a matching row or that fall
past the rows being asked for. Nothing about the result changes — the per-record pass runs either
way — so this only ever saves download time and staging space.

A filter is pushed only when it can mean exactly the same thing at the source:

- The field reads a producer dimension **untouched**. A field with a `transform`, a `validate`, a
  `default`, or one that is `fixed`/`copyFrom`/`meta`, is never pushed, and neither is a masked
  dimension or one filled in after the read (`sourceFilename`).
- The operator has a counterpart in the Delta Sharing predicate grammar: `equals`, `in`, `between`
  and the four `greaterThan`/`lessThan` comparisons. The substring and regex operators
  (`contains`, `startsWith`, `matches`, …) have none and stay local.
- The filter does not also keep rows whose value is **missing**. A value the source doesn't have
  reads back as `""`/`0`, so `notEquals`, `isNotNull`, `notBetween` and any range covering `0`
  keep those rows — a source pruning on them would drop data — and none of them is pushed.
- Date bounds are ISO-8601 (`2024-01-01`, or `2024-01-01T00:00:00Z`). A date in a producer's own
  `format` is not translated, and a bound carrying milliseconds is left local rather than rounded.
- Filters supplied by the invocation (an API or queue request) are pushed on the same terms as the
  ones written in the consumer.

Boolean columns are never pushed.

The **record limit** (`remora run -l`, or `limit` on an API/queue request) is pushed on a stricter
rule, because a bounded read is only sound when every row read reaches the output. It is dropped
whenever anything between the source and the export can *drop* a record: any filter at all (a
bounded read could have fetched exactly the rows the filter rejects), `distinct`, `distinctOn`,
`pivot`, a field validation set to `"onFail": "skip"`, a producer `recordSelector`, or a group that
fans a line out to rows. A transformation's own `"onError": "skip"` does *not* — it abandons that one
transformation, not the record.

Set `"disablePushdown": true` in a **producer's** settings to turn both hints off for that producer —
the filters and the limit keep working, the whole table is just read first.

### **Complex Filter Examples**

### **Multiple Conditions**

```json
{
  "filters": [
    {
      "rule": {
        "member": "amount",
        "operator": "greaterThan",
        "values": ["100"]
      }
    },
    {
      "rule": {
        "member": "status",
        "operator": "in",
        "values": ["Active", "Pending"]
      }
    }
  ]
}
```

### **Date Range Filtering**

```json
{
  "filters": [
    {
      "rule": {
        "member": "order_date",
        "operator": "between",
        "values": ["2024-01-01", "2024-12-31"]
      }
    }
  ]
}
```

---

## **Output Configuration**

Outputs define where and how the processed data is exported. A consumer declares **exactly one** —
`outputs` stays an array, but a second entry is refused at `compile`. A run stages its records in one
encoding and *moves* that file to the destination, so there has never been anything left for a second
output to write: only the first was ever exported. To write the same data twice, declare a second
consumer over the same producers.

### **Output Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `format` | ✅ | Output format | `"JSON"`, `"CSV"`, `"TXT"`, `"FIXED"`, `"PARQUET"`, `"API"` |
| `exportDestination` | ❌ | Target destination source | `"s3-bucket"`, `"local-output"` |
| `exportName` | ❌ | Fixed filename for exports | `"daily-report"`, `"customer-data"` |
| `exportPrefix` | ❌ | A folder put in front of every exported file, rendered once per run (see [A Folder per Run](#a-folder-per-run-exportprefix)). Not on an `API` output | `"inbound/{executionId}/"` |
| `delimiter` | ❌ | Field delimiter, only used for `TXT` output (defaults to a tab). Ignored by every other format, `PARQUET` included, and rejected on `FIXED`, which has no delimiter at all | `"\t"`, `";"` |
| `header` | ❌ | `CSV`/`TXT` only: write the field names as the first line of each exported file (see [The Header Line](#the-header-line)). Rejected on `PARQUET`, which carries its own schema, and on `FIXED`, which has no room for one | `true` (default), `false` |
| `omitNull` | ❌ | `JSON`/`API` only: leave out the fields whose value is `null` (see [Omitting Null Fields](#omitting-null-fields)) | `true`, `false` (default) |
| `groupBy` | ❌ | `JSON`/`API` only: the keys several records collapse onto, one per `[]` level the field paths declare, outermost first (see [Nested Documents](#nested-documents)) | `["claim_id", "line_no"]` |
| `envelope` | ❌ | `JSON`/`API` only: wrap the whole file in one literal document — a Bundle rather than one document per line (see [Wrapping the File in One Bundle](#wrapping-the-file-in-one-bundle)) | Envelope block |
| `recordLength` | ❌ | `FIXED` only: the declared length of one record, which `compile` checks the field widths sum to (see [FIXED Output](#fixed-output)) | `196` |
| `defaults` | ❌ | `FIXED` only: the fill rules every field of one dimension type takes unless its own `position` overrides them | `{ "number": { "pad": "0" } }` |
| `lineEnding` | ❌ | `FIXED` only: what ends every record, the last one included | `"lf"` (default), `"crlf"` |
| `layouts` | ❌ | `FIXED` only: several record layouts in one file, picked per record by the value of one field (see [Several Record Layouts in One File](#several-record-layouts-in-one-file)) | Layout map |
| `trigger` | ❌ | Automated execution triggers | Trigger configuration |
| `onSuccess` | ❌ | Actions to perform on successful export | Action array |
| `onError` | ❌ | Actions to perform on export error | Action array |

### **Output Formats**

### **JSON Output**

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "s3-bucket",
      "exportName": "customer-analysis"
    }
  ]
}
```

### **Omitting Null Fields**

A record normally carries every field, including the ones with no value (`"addr2Street": null`). On a wide, sparse record — a positional layout with 1,300 fields of which a few dozen are populated — that is most of the payload. `omitNull` leaves those keys out entirely:

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "s3-bucket",
      "exportName": "member-detail",
      "omitNull": true
    }
  ]
}
```

Records then legitimately differ in shape from one another, which is why it applies to `JSON` and `API` only:

- On `CSV`/`TXT`/`FIXED`/`PARQUET` it is **rejected**, not ignored — a positional column can't be missing from a row, and a parquet row group declares every column up front.
- Only `null` is dropped. An empty string, a `0` and a `false` are values, and are exported.

### **Nested Documents**

A `JSON` or `API` output writes one flat record per line. Two properties change that, and a consumer declaring neither writes exactly what it has always written:

- a field's **`path`** says where its value sits inside a document, instead of at top level under its own name;
- the output's **`groupBy`** collapses several records into **one** document, so a repeating level can be filled from them.

```json
{
  "fields": [
    { "key": "resourceType", "fixed": true, "default": "Claim", "path": "resourceType" },
    { "key": "claim_id", "path": "id" },
    { "key": "patient_id", "path": "patient.reference", "transform": { "prepend": "Patient/" } },
    { "key": "line_no", "path": "item[].sequence" },
    { "key": "adj_amount", "path": "item[].adjudication[].amount.value" },
    { "key": "service_date", "path": "billablePeriod.start", "groupConflict": "first" }
  ],
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "s3-bucket",
      "exportName": "claims",
      "groupBy": ["claim_id", "line_no"]
    }
  ]
}
```

There is no new output format and no new resource. Nesting is a property of the fields, the way `position` is for `FIXED`, so it reaches the `API` output for free.

### **What a `path` Spells**

A path is a **static location and nothing else**: no filter, no condition, no computed segment. Dots make objects, each `[]` is one level of repetition, and the document's skeleton is derived from the paths rather than declared anywhere.

| Path | What it writes |
| --- | --- |
| no `path` | the value at top level under the field's output name — what a `JSON` output has always written |
| `a.b.c` | nested objects, no repetition |
| `item[].sequence` | one `item` entry per record of that level's group |
| `item[].adjudication[].amount.value` | one array level per `[]`, outermost first; the deepest is one entry per record |
| `name.given[]` | a path **ending** in `[]` collects the values themselves, not objects |

Keys come out in **field declaration order** at every level, a `hidden` field is absent, and `omitNull` applies as it does elsewhere — it also leaves out an object that ends up with no keys at all rather than writing `{}`.

Anything computed stays a field `transform`. A prefix, a cast, a concatenation all already exist and keep working, which is why a path never needs an expression of its own.

A constant is an ordinary `fixed` field with a `default` and a `path`, so it is visible to `compile`, to the lineage and to `remora ui-preview` like every other field.

### **Grouping Records into One Document**

`groupBy` carries **one key per `[]` level, outermost first**. The first key identifies the document, each later one an intermediate array level, and the deepest array always takes one entry per record.

So `"groupBy": ["claim_id", "line_no"]` over the fields above reads: a document per `claim_id`, an `item` per `line_no`, an `adjudication` per record. The two counts must agree, and `compile` says so when they do not.

Keys are the field's **output name** — the alias where one is set — and they are compared as text. A null and an empty string key the same group, as they do for `distinctOn` and `split.by`.

**Two arrays at the same depth share that depth's key.** `item[]` and `note[]` are filled from the same records, so they cannot have independent cardinality: a record set carrying both is their cross product. Independent collections need a second consumer, because the input is flat.

**A path is constant within the group of its own level.** `id` is one value per `claim_id`, `item[].sequence` one value per `claim_id` + `line_no`. That is the author's claim about cardinality rather than a hint, so it is checked: a record that disagrees **fails the run**, naming the field, the group key and both values. That means the configuration is wrong — the path wants a `[]`, or `groupBy` is too coarse — and a claim carrying another claim's patient is a plausible-looking claim.

`"groupConflict": "first"` on the field opts out, for the value that genuinely varies and is meant to:

```json
{ "key": "service_date", "path": "billablePeriod.start", "groupConflict": "first" }
```

A start date taken from the first line is an aggregation, and this says so in place. It sits on the field rather than on the output so that one aggregating field does not disarm the check across the other forty. "First" is the first record read, which the engine's ordering keeps stable.

**`limit` counts documents** on a grouped consumer — `remora run <name> -l 10` returns ten documents, not ten records. For the same reason a grouped run reads its source whole: a limit pushed down to the source would cut a group in half and ship a document missing the lines it never read.

### **Wrapping the File in One Bundle**

Without an envelope the file is **one document per line** (NDJSON), which is what a `JSON` output writes today. An `envelope` wraps the whole file in one literal document instead:

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "s3-bucket",
      "exportName": "claims",
      "groupBy": ["claim_id", "line_no"],
      "envelope": {
        "document": { "resourceType": "Bundle", "type": "batch", "total": "$count", "entry": [] },
        "at": "entry[].resource",
        "with": { "fullUrl": "urn:uuid:$claim_id" }
      }
    }
  ]
}
```

| Property | Meaning |
| --- | --- |
| `document` | The literal wrapper, written as it stands. `"$count"` as a value becomes the number of documents in the file. |
| `at` | Where each collapsed document is placed, spelled as a `path`. Exactly one `[]`: every document is one entry of one repeating level. |
| `with` | Keys written **beside** each document at that level, for the per-entry metadata a Bundle carries. |

Only `groupBy` values are in scope in `with`, as `$key`, and only those whose field path carries no `[]` — the records are gone by the time the wrapper is written, and a key inside a repeating level has one value per entry rather than one per document. A value that is nothing but the token keeps the group value's own type; one standing inside a longer string (`"urn:uuid:$claim_id"`) comes out as text.

The wrapper may declare the entries' key itself as an empty array, which is how it fixes where they sit among its own keys.

**A split writes one complete envelope per file**, so each file is a whole Bundle — half a JSON document is not a smaller JSON document. A dataset with no document at all is written as an empty wrapper rather than an empty file. `"$count"` is the one thing a split cannot have: one file's share of the documents is not known before that file is written.

### **What a Document Output Cannot Declare**

All of it is knowable from the configuration, so all of it is refused by `remora compile` rather than found part-way through a run with half a file already written:

| Rejected | Why |
| --- | --- |
| `path`, `groupConflict`, `groupBy` or `envelope` on a `CSV`, `TXT`, `FIXED` or `PARQUET` output | a positional or columnar file holds one flat record per line, not a document |
| a `groupBy` whose length is not the deepest path's `[]` count | the levels and their keys must agree, or an array level has no key to break on |
| a `[]` with no `groupBy` | it would repeat exactly once, every time |
| a `groupBy` key that names no field of the consumer | the same rule `split.by` follows |
| a `groupConflict` on a field at the deepest `[]` level | that level is written once per record, so it has nothing to conflict with |
| a `groupConflict` on an output that declares no `groupBy` | every record is its own document, so there is no group for values to disagree within |
| two paths that collide, such as `a` and `a.b` | one of them would be overwritten, and which one depends on field order |
| a path on a wildcard or pattern key | every matched column would land on that one place |
| a path that is no location at all — empty, an empty key between two dots, a stray bracket | `[]` marks a repeating level and goes at the end of a key, once |
| `split.by` on a grouped output | it buckets on the value of a flat field and a document has none. `split.maxFileSizeGb` counts bytes and works unchanged |
| `"$count"` together with any split | one file's share of the documents is not known before that file is written |
| an envelope `at` that does not carry exactly one `[]` | a document is one entry of one repeating level, and two levels name no entry |
| a `with` on an `at` that ends in `[]` | the document **is** the entry there, so there is nothing to write beside it |
| a `$key` in `with` that is no `groupBy` key, or one written inside a `[]` | the records are gone, and a key inside a repeating level has one value per entry |

### **Worked Example: a FHIR Claim Feed**

A claim feed arrives flat: one record per adjudication of one line of one claim, with the claim's own values repeated on every record.

```json
{"claim_id":"CLM-0001","patient_id":"PAT-0002","claim_status":"active","service_date":"2026-03-05","line_no":1,"product_code":"SRV-108","line_amount":92.25,"adj_category":"eligible","adj_amount":30.75}
```

FHIR wants it nested, and a FHIR resource is **configuration here, not a concept the engine knows**: there is no resource type, no terminology and no profile validation anywhere in the pipeline. What follows is an ordinary consumer.

**One resource per line** (`application/fhir+ndjson`):

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/consumer-schema.json",
  "name": "fhir-claims-ndjson",
  "description": "The flat claim feed as one FHIR Claim resource per line.",
  "producers": [{ "name": "claim-feed" }],
  "fields": [
    { "key": "resourceType", "fixed": true, "default": "Claim", "path": "resourceType" },
    { "key": "claim_id", "path": "id" },
    { "key": "claim_status", "path": "status" },
    { "key": "patient_id", "path": "patient.reference", "transform": { "prepend": "Patient/" } },
    { "key": "service_date", "path": "billablePeriod.start", "groupConflict": "first" },
    { "key": "line_no", "path": "item[].sequence" },
    { "key": "product_code", "path": "item[].productOrService.text" },
    { "key": "line_amount", "path": "item[].net.value" },
    { "key": "line_currency", "fixed": true, "default": "EUR", "path": "item[].net.currency" },
    { "key": "adj_category", "path": "item[].adjudication[].category.text" },
    { "key": "adj_amount", "path": "item[].adjudication[].amount.value" },
    { "key": "adj_currency", "fixed": true, "default": "EUR", "path": "item[].adjudication[].amount.currency" }
  ],
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "claims-bucket",
      "exportName": "fhir-claims",
      "groupBy": ["claim_id", "line_no"]
    }
  ],
  "_version": 1
}
```

One line of the exported file, indented here to be readable:

```json
{
  "resourceType": "Claim",
  "id": "CLM-0001",
  "status": "active",
  "patient": { "reference": "Patient/PAT-0002" },
  "billablePeriod": { "start": "2026-03-05" },
  "item": [
    {
      "sequence": 1,
      "productOrService": { "text": "SRV-108" },
      "net": { "value": 92.25, "currency": "EUR" },
      "adjudication": [
        { "category": { "text": "submitted" }, "amount": { "value": 19.75, "currency": "EUR" } },
        { "category": { "text": "eligible" }, "amount": { "value": 30.75, "currency": "EUR" } }
      ]
    }
  ]
}
```

**The same resources as one Bundle.** Only the output changes — the fields are the ones above:

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "claims-bucket",
      "exportName": "fhir-claims-bundle",
      "groupBy": ["claim_id", "line_no"],
      "envelope": {
        "document": { "resourceType": "Bundle", "type": "batch", "total": "$count", "entry": [] },
        "at": "entry[].resource",
        "with": { "fullUrl": "urn:uuid:$claim_id" }
      }
    }
  ]
}
```

The file is then one document:

```json
{
  "resourceType": "Bundle",
  "type": "batch",
  "total": 40,
  "entry": [
    { "fullUrl": "urn:uuid:CLM-0001", "resource": { "resourceType": "Claim", "id": "CLM-0001" } }
  ]
}
```

A Bundle mixing a `Claim` with its `Patient` and `Coverage` is a different thing and is not expressible here: it needs generated ids resolving between resources. One consumer writes one repeating resource type.

### **CSV Output**

```json
{
  "outputs": [
    {
      "format": "CSV",
      "exportDestination": "local-output",
      "exportName": "sales-report"
    }
  ]
}
```

### **The Header Line**

A `CSV` or `TXT` file is positional: it carries values and nothing that names them. So both formats write a **header line** first — the exported field names, in column order, quoted and delimited on exactly the rule the rows under it follow, so the header parses with the same reader the data does:

```
id,primary_email,plan,country
USR-00001,alice.rossi@example.com,free,Italy
```

The names are the exported ones: a field's `alias` where it has one, its `key` otherwise. A `hidden` field is not written, so it is not in the header either. With a `split`, **every** file of the output carries the header, not just the first one — each file has to stand on its own.

Set `header` to `false` where the destination reads the first line as data:

```json
{
  "outputs": [
    {
      "format": "CSV",
      "exportDestination": "local-output",
      "exportName": "sales-report",
      "header": false
    }
  ]
}
```

It only applies to `CSV` and `TXT`. On a `JSON` or `API` output each record already carries its own field names, a `PARQUET` file carries its own schema, and a `FIXED` line has no room for a name that would not sit on the columns it describes — so `header` is **rejected** at compile on all four rather than ignored.

### **How a value is written**

A `CSV`/`TXT` file **quotes a value only where the quotes carry meaning**. A value is written bare
unless it holds the delimiter, a `"`, a line break, or a space at either end — and an empty string
is quoted too, because that is what leaves the unquoted empty field free to mean something else: it
is a **null**. The two are different values, and on a positional line this is the only way to tell
them apart:

```
id,note,amount
USR-1,"",12.5        <- note is the empty string
USR-2,,              <- note and amount are null
USR-3,"a, b",12.5    <- note holds the delimiter, so it is quoted
USR-4,"  padded  ",0 <- note has edge spaces, so it is quoted
```

A reader that treats an unquoted empty field as "no value" — which most CSV readers do, and which is
what `COPY`, `LOAD DATA` and a pandas `read_csv` all assume — gets a null back. A reader that does
not sees an empty string, exactly as before.

Edge spaces are quoted for the same reason the empty string is: most CSV readers, Remora's own
included, trim an unquoted field, so `  padded  ` written bare would come back shorter than it went
out. Quoting it is what makes the round trip exact.

A value holding a **newline** or a carriage return is written as the two characters `\n` or `\r`.
A line of a remora file is one record, everywhere in the pipeline, so a value carrying a real
newline would otherwise arrive as two broken rows. The escape is one-way: nothing turns it back into
a newline, and an ordinary backslash in your data (`C:\path`) is never touched. Use `JSON` or
`PARQUET` where a value must carry a newline verbatim — both hold one natively.

### **TXT Output**

Delimited text export. The `delimiter` is configurable and defaults to a tab if omitted:

```json
{
  "outputs": [
    {
      "format": "TXT",
      "exportDestination": "local-output",
      "exportName": "sales-report",
      "delimiter": "|"
    }
  ]
}
```

### **FIXED Output**

A fixed-width (**positional**) flat file: no delimiter, no quoting, no header line. Every field occupies the same columns on every record, and each value is filled out to the width its layout gives it. This is the write side of the `FIXED` producer (see the Producers guide) — what you export when the receiver reads by column rather than by field name: a mainframe feed, a clearing-house submission, a banking return file.

Each visible field declares a `position`, and the output declares how long a record is:

```json
{
  "fields": [
    { "key": "member_id",    "position": { "width": 12, "start": 1 } },
    { "key": "service_date", "position": { "width": 8,  "start": 13 } },
    { "key": "amount",       "position": { "width": 10, "start": 21 } }
  ],
  "outputs": [
    {
      "format": "FIXED",
      "exportDestination": "local-output",
      "exportName": "claims",
      "recordLength": 30
    }
  ]
}
```

```
MBR000000123202604130000123.45
```

The file is exported with a `.txt` extension, to any file destination (local, S3, a pre-signed URL), with the same naming, [splitting](#output-splitting), trigger and `onSuccess` behaviour as every other file output.

### **How a Value Fills Its Field**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `position.width` | ✅ | How many characters the field occupies on the line | `10` |
| `position.align` | ❌ | Which end of the field the value sits at, the other end taking the padding. Defaults by type: `left` for a `string`, `datetime` or `boolean`, `right` for a `number` | `"left"`, `"right"` |
| `position.pad` | ❌ | The single character the rest of the field is filled with. Defaults by type: a space for a `string`, `datetime` or `boolean`, `0` for a `number` | `" "`, `"0"` |
| `position.nullFill` | ❌ | The single character a **null** field is filled with, for its full width. Defaults to a space for every type | `" "`, `"0"` |
| `position.overflow` | ❌ | What a value longer than `width` does | `"fail"` (default), `"truncate"` |
| `position.start` | ❌ | 1-based column the field is expected to start at. An assertion, not a second source of truth (see below) | `21` |
| `position.scale` | ❌ | `number` fields only: implied decimal places the field is written with, the point dropped (see [How a Number Is Spelled](#how-a-number-is-spelled)) | `2` |
| `position.sign` | ❌ | `number` fields only: how the field carries its sign, where it is not a plain leading `-` (see [How a Number Is Spelled](#how-a-number-is-spelled)) | `"overpunch"`, `"leading"`, `"trailing"` |

Five rules decide what lands on the line:

| Case | What is written |
| --- | --- |
| Value shorter than `width` | Padded out to `width` with `pad`, on the side `align` leaves free |
| Value exactly `width` | The value |
| Value longer than `width` | **The run fails**, naming the field, the value and both widths — unless `overflow` is `"truncate"` |
| `null` | The full width in `nullFill` |
| Empty string | The same as a `null`. The staged encoding keeps the two apart; a positional line cannot |

**Overflow fails rather than truncates.** A truncated account number is a plausible-looking account number, and a feed nobody re-reads is exactly where that ships unnoticed. `"overflow": "truncate"` exists per field for the layouts that genuinely specify a cut, and the end that survives follows `align`: a left-aligned value keeps its head, a right-aligned one keeps its low-order tail, which is what a COBOL `MOVE` into a shorter field does.

**A null is filled with spaces, not zeros, even on a number.** Zero-filling an empty numeric field writes `00`, which the receiver reads as the number zero — a real value where the record carried none. Set `nullFill` on the field, or per type in `defaults`, for a receiver that needs something else.

**Carry a positional field through as a `string`.** A `number` dimension drops leading zeros — `"00"` read as a number is `0` — so writing it back takes `"align": "right"` with `"pad": "0"`, a rule you have to get right field by field. Declaring the producer dimension a `string` instead carries the characters through untouched.

### **How a Number Is Spelled**

The receivers that read by column also write their numbers by column: an amount **without its decimal point**, and a negative sign carried by a byte that also holds a digit. `position.scale` and `position.sign` are the write side of the producer dimension's `scale` and `sign` (see the Producers guide), and they mean the same things in the other direction:

| Property | The field is written as | `-123.45` is written |
| --- | --- | --- |
| `"scale": 2` | digits only, the last 2 of them the fraction | `-12345` |
| `"sign": "overpunch"` | digits, the last byte carrying the sign as well as its digit | `1234N` |
| `"sign": "leading"` | a `+` or `-`, then digits | `-12345` |
| `"sign": "trailing"` | digits, then a `+` or `-` | `12345-` |

```json
{ "key": "claim_amount", "position": { "width": 10, "scale": 2, "sign": "overpunch" } }
```

`-123.45` is then written `000001234N`, and `123.45` as `000001234E`.

- `number` fields only, and both are optional on their own. A field writing a plain `-123.45` declares neither.
- **A field declaring `sign` is a signed field, so a positive value is written in the form the mode declares** — `123A`, `+123`, `123+` — never as bare digits.
- Declared on the output, not taken from the producer: the file you write is not the file you read, and a value can reach the output from anywhere. Declare the same `scale` and `sign` on both sides and a field read from a positional file is written back byte for byte.
- The padding goes where the layout wants it. A `leading` sign keeps the first column and the fill goes between it and the digits (`-0001234`), which is where a COBOL `SIGN LEADING SEPARATE` field carries it.
- `compile` prints both alongside the columns, since a wrong `scale` writes a plausible amount that is 10ⁿ off.

### **Column Order, Gaps and `start`**

**Column order is field order, and every offset is computed from the widths before it.** No column number is ever transcribed by hand: list the fields in the order the record is written, give each one a width, and the layout falls out of them. That is the same rule the read side follows, and it is why a layout is written once rather than renumbered every time a field moves.

Gaps and COBOL `FILLER` need no concept of their own — a [fixed field](#fixed-fields) with a width is blank columns:

```json
{ "key": "filler", "fixed": true, "default": "", "position": { "width": 103 } }
```

**`position.start` and `recordLength` are checksums.** Where you write them, `compile` recomputes them from the widths and fails if they disagree. A layout spec gives you the widths, the start columns *and* the record length, and declaring all three is what catches a field you left out: a missing 8-character filler shifts every field after it, and nothing about the resulting file looks wrong.

`recordLength` is the length of the record **as written**, not the length of the copybook it came from. Where a 256-column layout is cut after the last field that carries anything, the fields past the cut are simply not declared — not padded to. Every record is then exactly `recordLength` characters, a record whose last field is null included: that field is written full width in `nullFill` and the line is never cut short.

`remora compile` prints the resolved layout, so you check it against the spec once instead of counting characters:

```
FIXED layout of consumer "claims_export"
  record: 30 characters, 3 field(s)
    start    end  width  field
        1     12     12  member_id
       13     20      8  service_date
       21     30     10  amount  (2 implied decimal(s), overpunch sign)
```

Every problem with a layout is reported in one `compile` rather than one per run, so six fields missing a width come back as six lines. `run` and `verify` resolve the same layout before they read a producer, so a layout that does not add up fails in front of the run instead of after the whole dataset has been built.

### **Fill Rules by Type**

A wide layout states a rule once in `defaults` instead of on each of ninety fields, keyed by the field's dimension type:

```json
{
  "outputs": [
    {
      "format": "FIXED",
      "exportDestination": "local-output",
      "recordLength": 256,
      "defaults": {
        "number": { "nullFill": "0" },
        "datetime": { "align": "right", "pad": "0" }
      }
    }
  ]
}
```

Above: a receiver that reads a blank numeric field as an error gets `0` there instead, and dates written as bare digits are right-aligned and zero-padded like the numbers they look like.

Each of `align`, `pad`, `nullFill` and `overflow` resolves on its own, nearest declaration first: the field's own `position`, then the layout's `defaults`, then the output's `defaults`, then the type's built-in rule. A field that sets only `align` keeps the `pad` the defaults gave it.

### **Several Record Layouts in One File**

A positional feed often carries more than one kind of record in one file — a 44-character transaction and a 196-character one, told apart by a marker on the line. `layouts` is the write-side mirror of a producer's `recordSelector`: it names the field whose value picks the layout, and what each value writes.

```json
{
  "outputs": [
    {
      "format": "FIXED",
      "exportDestination": "local-output",
      "exportName": "pod_return",
      "lineEnding": "crlf",
      "layouts": {
        "discriminator": "key_tran_id",
        "order": ["1300", "1200"],
        "values": {
          "1300": {
            "fields": ["key_serv_plan", "key_tran_id", "key_prov_id", "main_user"],
            "recordLength": 44
          },
          "1200": {
            "fields": ["key_serv_plan", "key_tran_id", "key_prov_id", "key_version", "main_user", "sort_date"],
            "recordLength": 196
          }
        }
      }
    }
  ]
}
```

| Property | Required | Description |
| --- | --- | --- |
| `discriminator` | ✅ | The consumer field whose value picks the layout, by the name it is exported under. It does not have to be written by any of the layouts, though it usually is |
| `order` | ✅ | The discriminator values in the order their record blocks are written. The complete list: a record carrying a value that is not here has no block to go in and **fails the run**, naming the value |
| `values` | ✅ | One entry per value in `order`: the `fields` it writes in column order, plus its own `recordLength` and `defaults` |

How it behaves:

- **The records come out grouped**, one contiguous block per value of `order` — which is how a real positional feed is written. Within a block they keep the order they were read in; Remora has no output sort, so the order inside a block is the order the producers delivered. With a [`split`](#output-splitting), each file is grouped on its own.
- The consumer's `fields` is the **union** of every layout's, and each layout names the subset its records carry, in its own column order. So one field can sit at different columns in different layouts — and that field then declares a `width` and no `start`, because a `start` is a column on one line and that field sits on several.
- A field the consumer declares that no layout writes needs no `position`.
- A `recordLength` on the output beside `layouts` is **rejected**: a multi-layout file has no single record length. Declare one per layout.
- At most **64** layouts in one output.
- Where the record types come from different producers, `union` still requires them to share their output dimensions: each producer declares the superset of fields and leaves the ones its layout has no field for empty.

### **How a Record Ends**

`lineEnding` is `"lf"` (the default) or `"crlf"`, and it ends **every** record, the last one included. A real positional feed picks one and holds it: a POD-style transaction feed, for instance, may be CRLF throughout.

A file with **no terminator at all** — fixed record framing, `RECFM=FB`, where the record length alone says where one record ends — is not expressible here, and asking for it is the signal that what is needed is byte-mode framing rather than a line-based file. Remora does not write one.

### **What the Receiver Has To Do**

The file Remora writes is **text, encoded UTF-8, one character per column**. For the layouts this was built for that is plain ASCII and the distinction never comes up — but a non-ASCII character (`é`, a typographic quote) is one column and more than one byte, so the record stays `recordLength` *characters* while the line stops being `recordLength` *bytes*. Where the receiver counts bytes, keep the data ASCII: a [`replace`](#pattern-replacement) transform on the field is the place to force it.

Two conversions a mainframe target needs are the receiver's, not Remora's, and are the mirror image of the ones the same shops already run on data coming the other way:

- **ASCII → EBCDIC.** A z/OS job reads EBCDIC; this file leaves as ASCII.
- **Reframing to `RECFM=FB`.** This file leaves as line-terminated records; a fixed-block dataset carries no terminators at all.

Both are normally one step of the transfer job that delivers the file, not something the layout can express.

### **What a FIXED Output Cannot Declare**

Each of these is **rejected** at `compile` rather than ignored: silently dropping a rule you wrote is how a file ships looking almost right.

| Declaration | Why |
| --- | --- |
| `header` | A positional line has no room for one, and a field name would not sit on the columns it describes |
| `delimiter` | A positional line has none: its fields are found by the columns they occupy |
| `omitNull` | A column can't be missing from a positional row. A null is written as `nullFill`, full width |
| `"key": "*"` | Every field of a positional line declares its own `width`, so the field list has to be explicit. A [pattern key](#pattern-keys) is allowed, but every column it matches takes the same `position` |

The reverse is rejected too: `recordLength`, `defaults`, `lineEnding` and `layouts` on a `CSV`, `TXT`, `JSON`, `PARQUET` or `API` output, and a field `position` on a consumer whose output is not `FIXED`.

### **PARQUET Output**

Apache Parquet: a typed, SNAPPY-compressed **columnar** file, which is what a data lake expects to read. It writes to any file destination (local, S3, a pre-signed URL) with the same naming, splitting and trigger behaviour as every other file output:

```json
{
  "outputs": [
    {
      "format": "PARQUET",
      "exportDestination": "lake",
      "exportName": "sales"
    }
  ]
}
```

Two things it gives a reader that a `CSV` export cannot. The file **declares its types**, so nothing downstream has to guess them back out of the text. And it is much smaller: a four-column, 2-million-row dataset is about 28 MB as parquet against roughly 100 MB as CSV.

The schema comes from what the consumer already declares — each field's dimension type:

| Dimension type | Parquet column |
| --- | --- |
| `string` | `BYTE_ARRAY` / UTF8 |
| `number` | `DOUBLE` — every value remora holds is a double, so an integer column would promise precision the record never had |
| `boolean` | `BOOLEAN` |
| `datetime` | `INT64` / `TIMESTAMP_MILLIS` |
| *none* (a `fixed`, `meta` or `copyFrom` field, or a column matched by a pattern key) | `BYTE_ARRAY` / UTF8 — there is no declared type to read |

Every column is nullable, so **a null stays a null** rather than becoming `0`, `false` or `""` — in a column store those are different things. A `hidden` field is not in the file at all, not even as an empty column.

`header` is **rejected** on a parquet output: the file already carries its column names in its schema, and a header line would be a first row of data claiming to be one. `delimiter` means nothing to it and is ignored.

A parquet file is a container whose footer can only be written once the last row group is encoded, so it is built in full and then shipped, rather than streamed out a line at a time. One consequence is worth knowing about if you use `split`: **`split.maxFileSizeGb` caps the internal staged bytes, not the parquet bytes**, so the exported files come out comfortably *under* the cap rather than at it. See [Splitting the Output](#splitting-the-output).

### **API Output**

```json
{
  "outputs": [
    {
      "format": "API"
    }
  ]
}
```

### **A Folder per Run (`exportPrefix`)**

`exportPrefix` puts every file a run exports under one folder, named after the run, so a receiver can tell which files belong together:

```json
{
  "outputs": [
    {
      "format": "CSV",
      "exportDestination": "partner_upload",
      "exportName": "orders",
      "exportPrefix": "inbound/{executionId}/"
    }
  ]
}
```

A run then writes `inbound/3f2c9a1e-…/orders_0.csv`, and the next run a folder of its own. The prefix is put in front of the file name as written, so keep the trailing `/` to make it a folder: `"{consumerName}_"` gives a name prefix instead.

| Variable | Renders as |
| --- | --- |
| `{executionId}` | The run's id, the one `remora report` shows and a [`meta: "executionId"`](#meta-fields) field holds |
| `{consumerName}` | The consumer's `name` |
| `{date}` | The day the run started, `YYYY-MM-DD` in UTC. A run that crosses midnight keeps its start day |

It works the same on every file destination:

| Destination | What the prefix becomes |
| --- | --- |
| `aws-s3` | The object key prefix |
| `presigned-url` | Part of the file name sent to the minting endpoint, which signs that key. To send the folder as a field of its own instead, see `mintParams` in the Sources guide |
| `local` | A subfolder of the source's path, created on demand |

`compile` rejects an unknown variable, a prefix starting with `/`, a `..` segment, and an `exportPrefix` on an `API` output, which writes no file.

### **Multiple Outputs**

Export to multiple destinations simultaneously:

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "s3-archive"
    },
    {
      "format": "CSV",
      "exportDestination": "local-reports"
    },
    {
      "format": "API"
    }
  ]
}
```

---

## **Automated Triggers**

Configure automated execution of consumers based on schedules, API calls, or queue messages.

### **Trigger Types**

### **CRON Triggers**

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "daily-exports",
      "trigger": {
        "type": "CRON",
        "value": "0 2 * * *",
        "metadata": {
          "timezone": "UTC",
          "description": "Daily at 2 AM"
        }
      }
    }
  ]
}
```

### **API Triggers**

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "api-exports",
      "trigger": {
        "type": "API",
        "value": "/api/export/customer-data",
        "metadata": {
          "method": "POST",
          "auth_required": "true"
        }
      }
    }
  ]
}
```

### **Queue Triggers**

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "queue-exports",
      "trigger": {
        "type": "QUEUE",
        "value": "https://sqs.us-east-1.amazonaws.com/123456789012/data-processing-queue",
        "metadata": {
          "region": "us-east-1",
          "messageType": "data-update",
          "accessKeyId": "{AWS_ACCESS_KEY_ID}",
          "secretAccessKey": "{AWS_SECRET_ACCESS_KEY}"
        }
      }
    }
  ]
}
```

**QUEUE trigger metadata:**

| Field | Description |
| --- | --- |
| `region` | AWS region of the queue |
| `accountId` | AWS account ID — used to build the full queue URL when `value` is only a queue name |
| `messageType` | Only messages whose `type`/`messageType`/`eventType` matches are processed by this consumer; others are left on the queue. Enables one shared queue across multiple consumers |
| `method` | Credential method: `access-secret-key` (default, static keys), `arn` (assume an IAM role via STS), or `implicit`/`iam` (AWS SDK default chain — instance/task role) |
| `accessKeyId`, `secretAccessKey`, `sessionToken` | Static credentials (for `access-secret-key`) |
| `roleArn`, `roleSessionName`, `externalId` | STS AssumeRole settings (for `method: "arn"`) |
| `deadLetterQueue` | Queue URL or name where a repeatedly failing message is parked (see [Failed messages](#failed-messages)) |
| `maxReceiveCount` | Failed deliveries tolerated before the message stops being processed. Defaults to `"5"` |
| `endpoint` | Base URL of an SQS-compatible server to use instead of AWS — e.g. `http://localhost:9324` for a local ElasticMQ in development. A `value` given as a queue name is built against it. Omit it to talk to AWS; `REMORA_SQS_ENDPOINT` sets the same thing for every queue |

#### **Failed messages**

A message is only deleted from the queue once at least one consumer has processed it successfully —
which is what keeps a shared queue usable. When every consumer that picked it up failed, the message
stays in the queue and SQS redelivers it after the visibility timeout (5 minutes).

That is the right behaviour for a transient failure and the wrong one for a message that can never
succeed — a malformed payload, a consumer whose source is gone. Such a message would trigger a full
consumer run every five minutes until the queue's retention period (4 days by default) silently
discards it: roughly a thousand failed runs.

So the run is bounded. Once SQS has delivered the message `maxReceiveCount` times and it has failed
each time, it stops being processed. What happens next depends on `deadLetterQueue`:

| `deadLetterQueue` | What happens to the exhausted message |
| --- | --- |
| Set | Copied to that queue, then deleted from this one. The copy carries `remoraSourceQueue`, `remoraSourceMessageId` and `remoraReceiveCount` as message attributes, so it can be diagnosed and replayed |
| Not set | Skipped on every later delivery, without running any consumer. Nothing is deleted — the message stays in the queue for inspection and expires with the queue's retention period |

```json
{
  "trigger": {
    "type": "QUEUE",
    "value": "orders-queue",
    "metadata": {
      "region": "us-east-1",
      "accountId": "123456789012",
      "messageType": "data-update",
      "deadLetterQueue": "orders-queue-dlq",
      "maxReceiveCount": "3"
    }
  }
}
```

A dead-letter queue is worth configuring: without one the failure is bounded but invisible — the
message is skipped, and the only trace is the worker's log and the `quarantinedCount` it reports.
An SQS redrive policy on the queue itself does the same job, and applies to every system reading
that queue rather than only to Remora.

Two things are deliberately *not* treated as failures. A message no consumer **claimed** — its
`messageType` matched nobody — is left on the queue untouched for other systems, however many times
it is redelivered. And the skip list is held in the worker process only, so a restart gives every
message another chance, which is usually what should happen right after a fix is deployed.

None of this applies to the project's `API_QUEUE`, whose messages are commands rather than events: a
failed command is never retried, it leaves the queue on its first delivery. See
[As the execute-consumer API queue](Remora%20-%20Sources.md).

The delivery count itself comes from SQS, not from Remora, so it survives restarts and is shared
across every worker polling the queue.

Example authenticating via an assumed IAM role instead of static keys:

```json
{
  "trigger": {
    "type": "QUEUE",
    "value": "orders-queue",
    "metadata": {
      "region": "us-east-1",
      "accountId": "123456789012",
      "method": "arn",
      "roleArn": "arn:aws:iam::123456789012:role/remora-sqs",
      "messageType": "data-update"
    }
  }
}
```

### **When the Worker Is Busy**

A worker shares one thread and memory budget across every run. A run that does not fit waits until
an earlier run finishes, first come, first served. What happens while runs wait depends on how the
run was triggered:

| Trigger | While runs wait |
| --- | --- |
| API | Queued, up to 32 waiting runs (`REMORA_MAX_WAITING_RUNS` changes the limit). Past that the call is answered **503** at once, naming how many runs are running and waiting; retry later |
| CRON | Always queued, so a tick is never lost. A tick whose consumer already has a CRON run waiting to start is folded into it |
| QUEUE | No message is fetched until nothing waits, so a message waits in SQS rather than spending its visibility timeout |

Each run works in a thread of its own, with memory sized from what its consumer used in its last
five successful runs, or 4GB for a consumer with none. A run that outgrows it fails alone, naming the
limit it reached, and the other runs carry on. `REMORA_THREAD_ESTIMATE_MARGIN` sets the margin
over what was measured.

### **Post-Processing Actions**

### **File Movement**

```json
{
  "outputs": [
    {
      "format": "CSV",
      "exportDestination": "processing-folder",
      "onSuccess": [
        {
          "action": "move-file",
          "moveToDestination": "archive-folder"
        }
      ],
      "onError": [
        {
          "action": "move-file",
          "moveToDestination": "error-folder"
        }
      ]
    }
  ]
}
```

### **Run Consumer(s)**

The `run-consumer` action triggers one or more other consumers once the output finishes — on the success path (`onSuccess`) or the failure path (`onError`). Listed consumers run **sequentially** in declared order as fresh full runs. A downstream failure is **logged and swallowed**: it does not change the parent consumer's result or stop the rest of the chain.

```json
{
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "processing-folder",
      "onSuccess": [
        {
          "action": "run-consumer",
          "consumers": ["c_downstream_report", "c_notify"]
        }
      ],
      "onError": [
        {
          "action": "run-consumer",
          "consumers": ["c_alert"]
        }
      ]
    }
  ]
}
```

Each name in `consumers` must resolve to a consumer in the project (validated at compile time). Chains are guarded against cycles (e.g. `A → B → A` is detected and skipped) and capped at a maximum depth (`MAX_ON_FINISH_DEPTH`).

### **Call an API (`call-api`)**

The `call-api` action sends one request once the output finishes, to tell another system the run is done (`onSuccess`) or that it failed (`onError`). It names an `http-api` source, which holds the URL, the method (`httpMethod`), the headers and the credentials; the action adds what is specific to this one call:

```json
{
  "outputs": [
    {
      "format": "CSV",
      "exportDestination": "partner_upload",
      "exportPrefix": "inbound/{executionId}/",
      "onSuccess": [
        {
          "action": "call-api",
          "source": "ingest_api",
          "path": "/runs/complete",
          "body": { "runId": "{executionId}", "folder": "{folder}", "files": "{files}", "rows": "{recordCount}" },
          "onFailure": "fail",
          "retries": 2
        }
      ],
      "onError": [
        {
          "action": "call-api",
          "source": "ingest_api",
          "path": "/runs/failed",
          "body": { "runId": "{executionId}", "error": "{error}" }
        }
      ]
    }
  ]
}
```

| Property | Required | Description |
| --- | --- | --- |
| `source` | ✅ | An `http-api` source in the project |
| `path` | ❌ | Appended to the source's `url` |
| `body` | ❌ | The JSON body, a template. Needs a source whose `httpMethod` is `POST`, `PUT` or `PATCH` |
| `query` | ❌ | Query parameters, each value a template, sent beside the source's own `queryParams` |
| `onFailure` | ❌ | What a call that still fails after its retries does to the run: `fail` (default) or `ignore` |
| `retries` | ❌ | `0`–`5`, default `0`. How many times a network error, a timeout or a `5xx` answer is retried, waiting 1s, 2s, 4s… between attempts. A `4xx` is never retried |

The body and the query can name these variables:

| Variable | Renders as |
| --- | --- |
| `{executionId}`, `{consumerName}`, `{date}` | As in an [`exportPrefix`](#a-folder-per-run-exportprefix) |
| `{status}` | `success` or `error` |
| `{startedAt}` | When the run started, as an ISO 8601 timestamp |
| `{recordCount}` | The number of records exported |
| `{folder}` | The rendered `exportPrefix`, or `""` when the output sets none |
| `{files}` | The names the exported files were written under, prefix included |
| `{error}` | The failure message. `onError` only |

A body value that is exactly `"{files}"` or `"{recordCount}"` keeps its JSON type, a list or a number. Inside longer text every variable renders as text, a list as its items joined by commas. A run that fails before its export sends `{folder}` as `""`, `{files}` as `[]` and `{recordCount}` as `0`.

**What a failure does.** With `onFailure: "fail"` a call that still fails marks the run failed, with the API's answer kept in the run's record, and the output's `onError` actions then run — so an `onError` `call-api` still tells the receiver. With `"ignore"` the failure is logged and the run stays successful. On the error path a failed call is only logged: it never replaces the run's own error.

`compile` rejects a `call-api` with no `source`, one naming a source that is missing or is not `http-api`, `retries` outside `0`–`5`, and a variable the body or query can't use (`{error}` in an `onSuccess` included). `remora synth` skips every `call-api`, as it skips `move-file`, so fake data never reaches a real API.

---

## **Consumer Options**

Additional processing options for consumers.

### **Options Properties**

| Property | Description | Example |
| --- | --- | --- |
| `distinct` | Return only unique records | `true`, `false` |
| `distinctOn` | De-duplicate on specific key(s), keeping one record per key using a resolution rule | See below |
| `pivot` | Turn row values into columns with an aggregation | See below |

```json
{
  "options": {
    "distinct": true}
}
```

### **Distinct On**

`distinctOn` de-duplicates on one or more `keys` and, when duplicates collide, keeps a single record according to `resolution`. Strategies: `first`/`last` (by `orderBy`, with an optional `direction` of `asc`/`desc`), or `min`/`max` (of `orderBy`). Reference fields by their alias if set.

```json
{
  "options": {
    "distinctOn": {
      "keys": ["customer_id"],
      "resolution": {
        "strategy": "max",
        "orderBy": "updated_at"
      }
    }
  }
}
```

### **Pivot**

`pivot` groups the data by `rowKeys`, takes the distinct values of `pivotColumn` as new columns, and fills each cell by aggregating `valueColumn` with `aggregation` (`sum`, `count`, `avg`, `min`, `max`). Optionally restrict/prefix the generated columns with `pivotValues` and `columnPrefix`. Cannot be combined with `distinct`/`distinctOn`.

```json
{
  "options": {
    "pivot": {
      "rowKeys": ["product"],
      "pivotColumn": "region",
      "valueColumn": "revenue",
      "aggregation": "sum",
      "pivotValues": ["East", "West"],
      "columnPrefix": "revenue_"
    }
  }
}
```

---

## **Dataset Validation**

Beyond per-field [validation](#field-validation), a consumer can assert conditions on the **whole result set** before it's exported, via the top-level `validate` array. Each entry is a `{ rule, onFail }` pair where `onFail` is `fail` (abort) or `warn` (log and continue).

**Rules:** `unique_fields` (the given field(s) must be unique across the dataset), `min_rows` / `max_rows` (row-count bounds), `no_duplicates` (no fully-duplicate rows), `not_empty` (at least one row).

```json
{
  "validate": [
    { "rule": { "not_empty": true }, "onFail": "fail" },
    { "rule": { "unique_fields": ["customer_id"] }, "onFail": "fail" },
    { "rule": { "min_rows": 1 }, "onFail": "warn" }
  ]
}
```

---

## **Output Splitting**

A file output can be broken into several files, by the value of a field, by a size cap, or by both. One `split` block covers all three:

```json
{
  "split": {
    "by": ["country"],
    "maxFileSizeGb": 2
  }
}
```

| Property | Meaning |
| --- | --- |
| `by` | Consumer field key(s) — the **alias** where one is set. Every distinct combination of values is written to its own file, named after the value(s). |
| `maxFileSizeGb` | The largest **one** output file may get, in Gb. The file is rotated and a numbered one is started. With `by` set the cap applies per key, not across the whole output. |

Either property works on its own. The order is fixed: the key decides which rows share a file, the cap then decides how large one of those files may get — rotating across mixed keys would only produce files that need splitting again.

### **How the files are named**

Each file carries a label made of the key value, the rotation index, or both, placed before the extension:

The extension is the output's own (`.csv`, `.txt`, `.jsonl`, `.parquet`); `.csv` is used here as the example:

| Configuration | Exported files |
| --- | --- |
| no split | `sales_0.csv` |
| `maxFileSizeGb` only | `sales_0.csv`, `sales_1.csv`, `sales_2.csv` |
| `by` only | `sales_Italy.csv`, `sales_Spain.csv` |
| both | `sales_Italy_0.csv`, `sales_Italy_1.csv`, `sales_Spain_0.csv` |

A value that cannot go in a file name (a separator, a space, a dot) becomes an underscore, and a long one is cut short — so two values that would produce the same name are kept apart by a numeric suffix rather than written into one file.

A row whose key is **null** goes to `_null` and one whose key is **empty** goes to `_empty`. They are separate on purpose: a shared catch-all merges two different things and stays invisible until it matters.

### **Limits**

- **1000 files** per consumer. Splitting on a field with one value per row (a customer id, an order number) fails the run with a named error instead of filling a directory.
- An **API** output cannot be split — a response is not a file.
- A **grouped** output (one that declares `groupBy`) cannot be split by `by`: that keys off the value of a flat field and a document has none. The size cap works unchanged, and a split output carrying an [envelope](#wrapping-the-file-in-one-bundle) writes one complete envelope per file.
- A **hidden** field cannot be a split key when the consumer writes a positional format (`CSV`, `TXT`, `PARQUET`): the file never carries that column.
- On a `PARQUET` output, `maxFileSizeGb` caps the **internal staged bytes, not the parquet bytes**. Each file is encoded and compressed after it has been split, so the exported files land comfortably under the cap rather than at it. The cap is there to bound what a destination is asked to take in one object, and rotating a parquet file after it was compressed would mean rewriting it.

### **`maximumFileSize` (shorthand)**

`maximumFileSize` is the older spelling of `split.maxFileSizeGb` and keeps working on its own:

```json
{
  "maximumFileSize": 2
}
```

Setting both on one consumer is rejected at compile — move the value into `split` and remove `maximumFileSize`.

---

## **Metadata and Organization**

### **Custom Metadata**

Add custom tags for organization and filtering:

```json
{
  "metadata": {
    "department": "sales",
    "priority": "high",
    "data_classification": "internal",
    "owner": "analytics-team"
  }
}
```

### **Project Organization**

Group consumers into projects for access control:

```json
{
  "project": "customer-analytics"
}
```

### **Schema Validation**

Validate output against JSON schemas:

```json
{
  "schema": "customer-data-schema"
}
```

---

## **Advanced Examples**

### **Healthcare Claims Analysis Consumer**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/consumer-schema.json",
  "name": "healthcare-claims-analysis",
  "description": "Comprehensive healthcare claims analysis with patient demographics",
  "producers": [
    { "name": "healthcare-claims" },
    {
      "name": "patient-demographics",
      "joins": [
        {
          "otherName": "healthcare-claims",
          "relationship": "many-to-one",
          "sql": "${P.member_id} = ${healthcare-claims.member_id}"
        }
      ]
    }
  ],
  "fields": [
    { "key": "claim_id", "alias": "Claim ID" },
    { "key": "service_date", "alias": "Service Date" },
    { "key": "diagnosis_code", "alias": "Primary Diagnosis" },
    { "key": "billed_amount", "alias": "Billed Amount" },
    { "key": "allowed_amount", "alias": "Allowed Amount" },
    {
      "key": "patient_age_group",
      "from": "patient-demographics",
      "alias": "Age Group"
    },
    {
      "key": "billed_vs_allowed",
      "transform": {
        "combine_fields": {
          "fields": ["billed_amount", "allowed_amount"],
          "template": "{billed_amount} billed / {allowed_amount} allowed"
        }
      }
    },
    {
      "key": "high_value_claim",
      "transform": {
        "conditional": {
          "clauses": [
            { "if": { "greater_than": 10000 }, "then": true }
          ],
          "else": false}
      }
    }
  ],
  "filters": [
    {
      "rule": {
        "member": "service_date",
        "operator": "between",
        "values": ["2024-01-01", "2024-12-31"]
      }
    },
    {
      "rule": {
        "member": "claim_status",
        "operator": "equals",
        "values": ["Processed"]
      }
    }
  ],
  "outputs": [
    {
      "format": "JSON",
      "exportDestination": "analytics-bucket",
      "exportName": "claims-analysis-2024"
    },
    {
      "format": "CSV",
      "exportDestination": "reports-folder",
      "exportName": "claims-summary"
    }
  ],
  "options": {
    "distinct": true},
  "metadata": {
    "department": "healthcare-analytics",
    "data_classification": "PHI",
    "retention_period": "7_years"
  },
  "project": "healthcare-analytics",
  "_version": 1
}
```

### **Sales Performance Dashboard Consumer**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/consumer-schema.json",
  "name": "sales-performance-dashboard",
  "description": "Real-time sales performance metrics for executive dashboard",
  "producers": [
    { "name": "sales-transactions" },
    {
      "name": "product-catalog",
      "joins": [
        {
          "otherName": "sales-transactions",
          "relationship": "many-to-one",
          "sql": "${P.product_id} = ${sales-transactions.product_id}"
        }
      ]
    },
    {
      "name": "sales-reps",
      "joins": [
        {
          "otherName": "sales-transactions",
          "relationship": "many-to-one",
          "sql": "${P.rep_id} = ${sales-transactions.sales_rep_id}"
        }
      ]
    }
  ],
  "fields": [
    { "key": "transaction_id", "alias": "Transaction ID" },
    { "key": "sale_date", "alias": "Sale Date" },
    {
      "key": "sale_month",
      "transform": { "extract": "month" },
      "alias": "Month"
    },
    {
      "key": "sale_year",
      "transform": { "extract": "year" },
      "alias": "Year"
    },
    { "key": "amount", "alias": "Sale Amount" },
    {
      "key": "commission",
      "transform": { "multiply": 0.05 },
      "alias": "Commission (5%)"
    },
    { "key": "product_name", "from": "product-catalog", "alias": "Product" },
    { "key": "category", "from": "product-catalog", "alias": "Category" },
    { "key": "rep_name", "from": "sales-reps", "alias": "Sales Rep" },
    { "key": "region", "from": "sales-reps", "alias": "Region" },
    {
      "key": "performance_tier",
      "transform": {
        "conditional": {
          "clauses": [
            { "if": { "greater_than_or_equal": 50000 }, "then": "Platinum" },
            { "if": { "greater_than_or_equal": 25000 }, "then": "Gold" },
            { "if": { "greater_than_or_equal": 10000 }, "then": "Silver" }
          ],
          "else": "Bronze"
        }
      }
    }
  ],
  "filters": [
    {
      "rule": {
        "member": "sale_date",
        "operator": "greaterThanOrEquals",
        "values": ["2024-01-01"]
      }
    },
    {
      "rule": {
        "member": "status",
        "operator": "equals",
        "values": ["Completed"]
      }
    }
  ],
  "outputs": [
    {
      "format": "API"
    },
    {
      "format": "JSON",
      "exportDestination": "dashboard-cache",
      "trigger": {
        "type": "CRON",
        "value": "*/15 * * * *",
        "metadata": {
          "description": "Update every 15 minutes"
        }
      }
    }
  ],
  "metadata": {
    "dashboard": "executive-sales",
    "refresh_rate": "15_minutes",
    "data_classification": "internal"
  },
  "project": "sales-analytics",
  "_version": 1
}

```

### **Data Union Consumer**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/consumer-schema.json",
  "name": "historical-sales-union",
  "description": "Combined historical sales data from multiple years",
  "producers": [
    { "name": "sales-2022", "union": true },
    { "name": "sales-2023", "union": true },
    { "name": "sales-2024", "union": true }
  ],
  "fields": [
    { "key": "transaction_id", "alias": "ID" },
    { "key": "customer_id", "alias": "Customer" },
    { "key": "product_id", "alias": "Product" },
    { "key": "sale_date", "alias": "Date" },
    { "key": "amount", "alias": "Amount" },
    {
      "key": "data_source",
      "transform": { "extract": "year" },
      "alias": "Source Year"
    }
  ],
  "filters": [
    {
      "rule": {
        "member": "amount",
        "operator": "greaterThan",
        "values": ["0"]
      }
    }
  ],
  "outputs": [
    {
      "format": "CSV",
      "exportDestination": "data-warehouse",
      "exportName": "historical-sales-combined"
    }
  ],
  "options": {
    "distinct": true},
  "_version": 1
}
```

---

## **Validation and Testing**

### **Configuration Validation**

```bash
# Validate (compile) all resource configurations in the project
remora compile
```

### **Consumer Testing**

```bash
# Run a single consumer
remora run consumer-name

# Run with a limited number of output records (useful for a quick test)
remora run consumer-name --limit 10

# Run every consumer belonging to a project
remora run --project project-name
```

#### Sampling a consumer

```bash
# See what this consumer produces, without writing anything anywhere
remora sample consumer-name

# Show a specific number of rows
remora sample consumer-name -s 20
```

`remora sample` on a consumer **runs its pipeline for real** — filters, field transformations,
masking, unions, `distinct`, `pivot` and dataset validation all apply, exactly as in a
run. So the rows it shows are the rows the consumer produces, always: it is a real run's output, not
an approximation of it.

What it does *not* do is touch anything. A sample writes **nothing to the destination**, fires **no**
`onSuccess`/`onError` action, and — although it is recorded like any execution — is marked as a
sample, so it stays out of your run history, out of a consumer's run list and out of its duration
averages.

The number of rows is bounded by the same limit `remora run --limit` uses, which means the cost
depends on what the consumer does. Where nothing between the source and the output can *drop* a
record, the limit reaches the source itself and the read stops early, so the sample is quick whatever
the source's size. Where something can — any filter, `distinct`, `distinctOn`, `pivot`, or a field
validation set to `"onFail": "skip"` — there is no way to know how many rows have to go in for ten to
come out, so **the whole source is read**. On a large source that is slow. It is still only a read:
nothing is written and nothing is recorded against the consumer.

Sampling a consumer needs a source the pipeline can read — `local`, `aws-s3` or `delta-share`. A
consumer whose producer reads `aws-redshift` or `http-api` is refused with the reason, naming the
producer; sample that **producer** directly to see its rows.

### **Machine-Readable Output (`--json`)**

Every command takes `--json`, before or after the command name. Remora then writes **one JSON object
per line on stdout**, in the order things happen, for a script or a service to read while the
command runs. Errors are on stdout too, as lines of their own; the exit code is non-zero when a run
fails, as without the flag.

```bash
remora run consumer-name --json
remora --json compile
```

A run of one consumer reads like this (shortened):

```json
{"type":"task:start","task":1,"label":"Compiling the project"}
{"type":"task:end","task":1,"outcome":"succeeded","text":"Compiled 128 resources","elapsedMS":83.3}
{"type":"consumer:start","runId":"884d80af-…","consumer":"orders_daily","workers":9}
{"type":"stage:start","runId":"884d80af-…","stage":"process","detail":{"files":1,"bytes":17456}}
{"type":"stage:progress","runId":"884d80af-…","stage":"process","done":17456,"total":17456,"rows":121}
{"type":"stage:end","runId":"884d80af-…","stage":"process","elapsedMS":526.4}
{"type":"consumer:end","runId":"884d80af-…","elapsedMS":639.6,"rows":100,"resultUri":"results/orders_daily_0.csv"}
{"type":"message","kind":"info","text":"Run complete · 1 succeeded · 100 rows · 856ms"}
```

Every line has a `type`:

| `type` | Written when | Fields |
| --- | --- | --- |
| `consumer:start` | A run starts | `runId` (the run's execution id), `consumer`, `workers` (the most worker threads it can use), `parentRunId` |
| `stage:start` | A run enters a stage | `runId`, `stage`, `detail`: `producers` (prepare), `files` and `bytes` (process), `destination` (export) |
| `stage:progress` | While a stage works | `runId`, `stage`, `done`, `total` (0 when unknown), `rows` (process only: input lines read so far) |
| `stage:end` | A stage finishes | `runId`, `stage`, `elapsedMS` |
| `consumer:end` | A run finishes | `runId`, `elapsedMS`; `rows` and `resultUri` on success, `error` on failure |
| `task:start` | A command starts a piece of work (compiling, verifying a producer) | `task` (a number), `label` |
| `task:end` | That work ends | `task`, `outcome` (`succeeded`, `failed` or `warned`), `text`, `elapsedMS` |
| `message` | A notice, including the run's closing totals | `kind` (`info`, `warn`, `error` or `hint`), `text`, `detail` (extra lines) |
| `table` | A summary, a layout, sample rows | `title`, `columns`, `rows`, `align` |
| `log` | A log record that would have printed on the console | `level`, `message`, `stack` |

- **Stages** come in this order: `prepare`, `process`, `reconcile`, `postprocess`, `export`. A run
  that only feeds another consumer has no `export`.
- **Progress units**: `process` counts input bytes, so `total` matches its `detail.bytes`. `prepare`
  counts a fraction, with `total` 1.
- **A failed run** ends with a `consumer:end` carrying `error`, and the stage it failed in has no
  `stage:end`. A `task:start` with no `task:end` means the command stopped during that task.
- **Upstream runs** — a consumer input, a code lookup, an `onSuccess`/`onError` run — report under
  their own `runId`, with `parentRunId` set to the run that needed them.
- **Durations** are in milliseconds and not rounded. Lines carry facts only: no colours, symbols or
  percentages.
- **New fields may be added** to any line; existing ones are not renamed or removed. Ignore fields and
  `type`s you do not know.

`graph` still writes its diagram, `docs <topic>` its document, and `init` its questions, as they
are; use `remora graph -f json` for a machine-readable graph.

### **Common Validation Errors**

| Error | Cause | Solution |
| --- | --- | --- |
| `Producer not found` | Invalid producer reference | Check producer name exists |
| `Join relationship invalid` | Incorrect join SQL or relationship type | Verify join syntax and relationship |
| `Field not found` | Field doesn't exist in producer | Check field names and aliases |
| `Ambiguous field reference` | Field exists in multiple producers | Use `from` property to specify producer |
| `Invalid transformation` | Unsupported transformation or wrong parameters | Check transformation syntax |
| `Filter validation failed` | Filter references non-existent field | Ensure filter fields exist in consumer |

---

## **Performance Optimization**

### **SQL-Based Optimization**

1. **Use appropriate join relationships** to optimize query execution
2. **Filter early** with WHERE clauses to reduce data processing
3. **Limit field selection** to reduce memory usage

### **File-Based Optimization**

1. **Use rule-based filters** instead of processing all data
2. **Select only needed fields** to reduce memory footprint
3. **Use streaming** for large file processing
4. **Optimize transformations** to avoid expensive operations

### **Memory Management**

Configure memory settings in project configuration:

```json
{
  "settings": {
    "MAX_ITEMS_IN_MEMORY": 100000,
    "INDICATIVE_THREAD_LINE_COUNT": 10000,
    "MAX_THREAD_COUNT": 4
  }
}
```

---

## **Best Practices**

### **Naming Conventions**

- **Consumer names**: Use descriptive, lowercase with hyphens (`healthcare-claims-analysis`)
- **Field aliases**: Use descriptive, human-readable names (`"Customer ID"`, `"Total Sales"`)
- **Export names**: Use consistent naming for file exports (`daily-report`, `customer-analysis-2024`)

### **Performance**

1. **Filter early and often** to reduce data processing
2. **Use appropriate join types** for your data relationships
3. **Limit field selection** to only what's needed
4. **Monitor execution times** and optimize bottlenecks

### **Security**

1. **Apply filters** to limit data exposure
2. **Use project organization** for access control
3. **Document data classifications** in metadata
4. **Validate schema compliance** where required

### **Maintainability**

1. **Add meaningful descriptions** to all consumers
2. **Use consistent field aliasing** across related consumers
3. **Document business logic** in transformation comments
4. **Version control** consumer configurations
5. **Test thoroughly** before production deployment

---

## **Troubleshooting**

### **Common Issues**

**Join Failures:**

```
Error: Unable to join producers - relationship constraint violated
```

- Verify join relationships match data cardinality
- Check join SQL syntax and field references
- Ensure joined fields have compatible data types

**Transformation Errors:**

```
Error: Cast transformation failed for field 'amount'
```

- Check source data format and target type compatibility
- Add error handling with `onError: "set_default"`
- Verify transformation parameters

**Filter Errors:**

```
Error: Filter field 'status' not found in consumer
```

- Ensure filtered fields exist in field selection
- Check field aliases in filter references
- Verify producer field names

**Memory Issues:**

```
Error: Out of memory processing large dataset
```

- Increase `MAX_ITEMS_IN_MEMORY` setting
- Add filters to reduce data size
- Use streaming for large files
- Optimize field selection

### **Debug Mode**

Enable detailed logging:

```json
{
  "settings": {
    "LOG_LEVEL": "DEBUG",
    "DEBUG_MODE": true
   }
}
```

### **Support Resources**

- **Schema validation**: Automatic validation against JSON schemas
- **CLI help**: Run `remora --help` for command documentation
- **Error messages**: Include specific guidance for resolution
- **Execution stats**: Review processing statistics for optimization

---

## **Migration and Versioning**

### **Consumer Versioning**

Update the `_version` field when making significant changes:

```json
{
  "name": "customer-analysis",
  "_version": 2
}
```

### **Schema Evolution**

When evolving consumer configurations:

1. **Test changes** in development environment first
2. **Update field references** when producer schemas change
3. **Maintain backwards compatibility** where possible
4. **Document breaking changes** in version notes

### **Deployment Strategies**

1. **Blue-green deployment** for production consumers
2. **Canary releases** for high-volume consumers
3. **Rollback procedures** for failed deployments
4. **Health checks** for automated consumers