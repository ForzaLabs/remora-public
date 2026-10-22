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
| `lineCount` | ❌ | Populate the field with the 1-based source line number of each record (consistent across parallel workers) | `true`, `false` |

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
- A pattern that matches **nothing** is rejected at `compile`, as is an `alias` that would give two matches the same output name. So is a pattern combined with `fixed`, `copyFrom` or `lineCount`: those fields don't read a producer column, so there is nothing to match.
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

### **Line Number Fields**

Set `lineCount` to populate a field with the 1-based source line number of each record. The value stays consistent even when a file is processed in parallel across multiple workers.

```json
{
  "fields": [
    { "key": "row_number", "lineCount": true },
    { "key": "customer_id" }
  ]
}
```

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
  `default`, or one that is `fixed`/`copyFrom`/`lineCount`, is never pushed, and neither is a masked
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
| `format` | ✅ | Output format | `"JSON"`, `"CSV"`, `"TXT"`, `"PARQUET"`, `"API"` |
| `exportDestination` | ❌ | Target destination source | `"s3-bucket"`, `"local-output"` |
| `exportName` | ❌ | Fixed filename for exports | `"daily-report"`, `"customer-data"` |
| `delimiter` | ❌ | Field delimiter, only used for `TXT` output (defaults to a tab). Ignored by every other format, `PARQUET` included | `"\t"`, `";"` |
| `header` | ❌ | `CSV`/`TXT` only: write the field names as the first line of each exported file (see [The Header Line](#the-header-line)). Rejected on `PARQUET`, which carries its own schema | `true` (default), `false` |
| `omitNull` | ❌ | `JSON`/`API` only: leave out the fields whose value is `null` (see [Omitting Null Fields](#omitting-null-fields)) | `true`, `false` (default) |
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

- On `CSV`/`TXT`/`PARQUET` it is **rejected**, not ignored — a positional column can't be missing from a row, and a parquet row group declares every column up front.
- Only `null` is dropped. An empty string, a `0` and a `false` are values, and are exported.

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

A `CSV` or `TXT` file is positional: it carries values and nothing that names them. So both formats write a **header line** first — the exported field names, in column order, quoted and delimited exactly as the rows under them, so the header parses with the same reader the data does:

```
"id","primary_email","plan","country"
"USR-00001","alice.rossi@example.com","free","Italy"
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

It only applies to `CSV` and `TXT`. On a `JSON` or `API` output each record already carries its own field names, and a `PARQUET` file carries its own schema, so `header` is **rejected** at compile there rather than ignored.

### **How a value is written**

A `CSV`/`TXT` file writes every value quoted, and that leaves the unquoted empty field free to mean
something: it is a **null**. An empty string is `""`. The two are different values, and on a
positional line this is the only way to tell them apart:

```
"id","note","amount"
"USR-1","","12.5"       <- note is the empty string
"USR-2",,               <- note and amount are null
```

A reader that treats an unquoted empty field as "no value" — which most CSV readers do, and which is
what `COPY`, `LOAD DATA` and a pandas `read_csv` all assume — gets a null back. A reader that does
not sees an empty string, exactly as before.

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

Two things it gives a reader that a `CSV` export cannot. The file **declares its types**, so nothing downstream has to guess them back out of the text. And it is much smaller: a four-column, 2-million-row dataset is about 28 MB as parquet against 115 MB as quoted CSV.

The schema comes from what the consumer already declares — each field's dimension type:

| Dimension type | Parquet column |
| --- | --- |
| `string` | `BYTE_ARRAY` / UTF8 |
| `number` | `DOUBLE` — every value remora holds is a double, so an integer column would promise precision the record never had |
| `boolean` | `BOOLEAN` |
| `datetime` | `INT64` / `TIMESTAMP_MILLIS` |
| *none* (a `fixed`, `lineCount` or `copyFrom` field, or a column matched by a pattern key) | `BYTE_ARRAY` / UTF8 — there is no declared type to read |

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