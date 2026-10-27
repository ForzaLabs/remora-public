# Remora - Producers

## **Overview**

Producers in Remora define how data is extracted from sources and specify the structure and characteristics of that data. They act as the data extraction layer between sources and consumers, providing schema definition, data transformation, and security controls.

Each producer configuration specifies:

- **Data source connection** (which source to use)
- **Data schema** (dimensions)
- **Extraction settings** (file type, compression type, SQL tables, processing options and more)
- **Security controls** (data classification and masking)

## **Core Components**

### **Producer Structure**

All producers follow this basic structure:

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "producer-name",
  "description": "Producer description",
  "source": "source-name",
  "settings": {/* extraction settings */ },
  "dimensions": [/* field definitions */ ],
  "_version": 1
}
```

### **Producer Types by Source Engine**

| Source Engine | Data Type | Use Cases |
| --- | --- | --- |
| `local` | Files (JSON, CSV, Excel, XML, etc.) | Development, testing, file-based processing |
| `aws-s3` | Cloud storage files | Data lakes, archives, distributed file processing |
| `aws-redshift` | SQL tables/views | Data warehousing, analytics, structured data |
| `delta-share` | Shared datasets | Cross-organization data sharing |
| `http-api` | REST API responses | External services, SaaS integrations |

---

## **File-Based Producers**

File-based producers work with local files or S3 storage, supporting various file formats.

### **Common Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "file-producer",
  "description": "File-based data producer",
  "source": "local",
  "settings": {
    "fileKey": "data-file.csv",
    "fileType": "CSV",
    "delimiter": ",",
    "hasHeaderRow": true},
  "dimensions": [/* field definitions */ ],
  "_version": 1
}
```

### **Settings Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `fileKey` | ✅ | File name or path pattern | `"data.csv"`, `"files/data%.json"` |
| `fileType` | ✅ | File format type | `"CSV"`, `"JSON"`, `"JSONL"`, `"XLSX"`, `"XLS"`, `"XML"`, `"TXT"`, `"PARQUET"`, `"FIXED"` |
| `delimiter` | ❌ | CSV delimiter character | `","`, `";"`, `"\t"` |
| `hasHeaderRow` | ❌ | Whether CSV/TXT has header row. For `FIXED` it defaults to `false` — set it to `true` only if the file starts with a line to skip | `true`, `false` |
| `recordSelector` | ❌ | `FIXED`: read only the lines whose marker at a given position matches, optionally asserting a `minLength` | `{ "position": { "start": 1, "length": 1 }, "equals": "D", "minLength": 2400 }` |
| `sheetName` | ❌ | Excel sheet name to read | `"Sheet1"`, `"Data"` |
| `compressionType` | ❌ | Decompress the source file before parsing | `"GZ"`, `"ZIP"`, `"TAR"` |
| `startRow` | ❌ | Excel: 1-indexed row to start reading from | `1`, `3` |
| `startColumn` | ❌ | Excel: 1-indexed column to start reading from | `1`, `2` |

### **Supported File Types**

### **CSV Files**

```json
{
  "settings": {
    "fileKey": "customers.csv",
    "fileType": "CSV",
    "delimiter": ",",
    "hasHeaderRow": true}
}
```

### **JSON Files**

```json
{
  "settings": {
    "fileKey": "transactions.json",
    "fileType": "JSON"
  }
}
```

### **JSON Lines (JSONL/NDJSON)**

```json
{
  "settings": {
    "fileKey": "events.jsonl",
    "fileType": "JSONL"
  }
}
```

### **Excel Files**

```json
{
  "settings": {
    "fileKey": "report.xlsx",
    "fileType": "XLSX",
    "sheetName": "Data"
  }
}
```

### **XML Files**

```json
{
  "settings": {
    "fileKey": "config.xml",
    "fileType": "XML"
  }
}
```

### **Text Files**

```json
{
  "settings": {
    "fileKey": "log.txt",
    "fileType": "TXT",
    "delimiter": "\t",
    "hasHeaderRow": false}
}
```

### **Fixed-Width Files (FIXED)**

A fixed-width (positional) flat file has no delimiter and no header: every field is identified by where it sits in the line. Each dimension declares a `position`, and that position *is* the mapping — `alias` and `delimiter` are unused.

Coordinates are **1-based and inclusive**, exactly how a file layout spec is written ("columns 21-30"). Give the width as either `length` or `end` (never both):

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `position.start` | ✅ | 1-based position of the field's first character | `21` |
| `position.length` | ⚠️ | How many characters the field spans (or use `end`) | `10` |
| `position.end` | ⚠️ | 1-based position of the field's last character, inclusive (or use `length`) | `30` |

```json
{
  "settings": {
    "fileKey": "claims.txt",
    "fileType": "FIXED"
  },
  "dimensions": [
    { "name": "member_id", "type": "string", "position": { "start": 1, "length": 12 } },
    { "name": "service_date", "type": "datetime", "format": "YYYYMMDD", "position": { "start": 13, "length": 8 } },
    { "name": "amount", "type": "number", "position": { "start": 21, "end": 30 } }
  ]
}
```

Notes:

- Values are **trimmed**, so space- and zero-padded fields (`"0000123.45"`, `"ABC   "`) read as their real value. A field that is entirely padding reads as `null` — or as its type's empty value, if the dimension declares `nullable: false`.
- Gaps are fine: filler columns you don't map simply have no dimension. Overlaps are fine too — a composite field and its subfields can both be declared.
- Combine `position` with `format` to parse dates written as bare digits, as in `service_date` above. Day-of-year ("Julian") dates use `DDD`: `"format": "YYYYDDD"` reads `2007305` as 1 November 2007.
- An amount written **without its decimal point** — `0012345` meaning `123.45`, the way a COBOL `PIC S9(7)V99` field is written — needs `scale`. See [Implied decimals](#implied-decimals).
- A dimension marked `sourceFilename` needs no `position`: it isn't in the line.
- `discover` cannot be used on a `FIXED` producer — a positional layout can only come from the file's spec. Use `sample` to check that your positions line up.

### **Repeating Groups (OCCURS)**

Flat files transcribed from a COBOL copybook repeat a segment of fields a fixed number of times — three address slots, 36 reimbursement rows. Declaring each occurrence by hand means writing the same fields once per slot, with every offset shifted. A **group dimension** declares them once instead: a dimension that carries its own nested `dimensions` and no `type` of its own.

```json
{
  "name": "addr",
  "description": "Address segment, 3 occurrences",
  "position": { "start": 32, "length": 30 },
  "occurs": 3,
  "dimensions": [
    { "name": "street",  "type": "string", "position": { "start": 1,  "length": 20 } },
    { "name": "state",   "type": "string", "position": { "start": 21, "length": 2 } },
    { "name": "zip",     "type": "string", "position": { "start": 23, "length": 5 } }
  ]
}
```

Two rules carry the whole feature:

- **The group's `position` is the extent of ONE occurrence** — `start` is where the *first* occurrence begins, and `length` is the bytes *per occurrence*, not the group's whole span. (The `end` form means the same thing: `{ "start": 32, "end": 61 }` is occurrence 1 only.)
- **A child's `position` is relative to its occurrence**, so it reads exactly as the copybook writes it: `street` is characters 1-20 *of an address*, not of the line.

The group expands into one dimension per (occurrence × child) when the project loads — `addr0Street`, `addr0State`, `addr0Zip`, `addr1Street`, … `addr2Zip` above, at 32-51, 52-53, 54-58, then 62-81, … 114-118. Everything downstream sees plain dimensions, so a group changes nothing about how consumers, transforms, validations or exports work: it is purely a way to write the layout once.

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `dimensions` | ✅ | The fields that repeat, each `position` relative to one occurrence | see above |
| `position` | ✅ | Extent of **one** occurrence: `start` of the first, `length` per occurrence | `{ "start": 32, "length": 30 }` |
| `occurs` | ❌ | Number of occurrences. Default `1`, max `1000`. An object when the count varies per line — see [Variable Occurrences](#variable-occurrences-and-anchoring) | `3` |
| `indexFrom` | ❌ | First index used in generated names: `0` (default) or `1` | `1` |
| `naming` | ❌ | Name template. Tokens `{group}`, `{index}`, `{field}`, `{Field}` (capitalized). `{index}` is required unless `occurs` is `1`. Default `{group}{index}{Field}` | `{group}_{index}_{field}` → `addr_0_street` |

Notes:

- A group **expands in place**, at its own index, so the columns follow the physical order of the record. A dimension declared after the group stays after it.
- A group carries no `type`, `alias`, `pk`, `mask`, `synth`, `format` or `sourceFilename` — it produces no column of its own, so those belong on its children.
- `occurs: 1` is useful on its own: a group is then simply a way to **structure** a segment of the layout, and with `"naming": "{field}"` the children keep their own names.
- Unpopulated occurrences read as `null`, exactly like any all-padding field.
- A child position that doesn't fit inside one occurrence is rejected — that is the classic transcription slip, an absolute offset pasted where a relative one belongs.
- Nested groups (a group inside a group) are **not supported yet** and are rejected with a message saying so. Declare the inner group as a sibling with its own absolute `position`.

### **Occurrences as Rows**

By default a group's occurrences become **columns** — `addr0Street`, `addr1Street`, `addr2Street`. `"emit": "rows"` turns them into **records** instead: one output record per occurrence, which is usually what you want from a slot list that is mostly empty.

```json
{
  "name": "addr",
  "position": { "start": 39, "length": 30 },
  "occurs": 3,
  "emit": "rows",
  "occurrenceField": "addr_occurrence",
  "dimensions": [
    { "name": "street", "type": "string", "position": { "start": 1,  "length": 20 } },
    { "name": "state",  "type": "string", "position": { "start": 21, "length": 2 } }
  ]
}
```

One line with two populated addresses comes out as two records:

```json
{"id":"USR-1","addr_occurrence":0,"street":"12 MAIN ST","state":"OR","plan":"free"}
{"id":"USR-1","addr_occurrence":1,"street":"7 ELM AVE","state":"WA","plan":"free"}
```

The children keep their **own names** (there is no index to tell them apart, so `naming` defaults to `{field}` and a `{index}` token is rejected), every dimension outside the group **repeats** on each record, and a generated field carries the occurrence index.

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `emit` | ❌ | `columns` (default) or `rows` | `"rows"` |
| `occurrenceField` | ❌ | Name of the generated occurrence-index field. Default `{group}Occurrence` | `"addr_occurrence"` |
| `skipEmptyOccurrences` | ❌ | Drop occurrences whose fields are all empty. Default `true` | `false` |

Notes:

- **At most one group per producer** may fan out — two would multiply their occurrences together.
- Records stay flat, so CSV/TXT export, `pivot`, `distinctOn`, transforms and validations all keep working exactly as they do on any other producer.
- Empty occurrences are dropped by default: a layout reserving 121 slots usually populates a handful, and the empty records would bury the real ones. Set `skipEmptyOccurrences: false` to keep them.
- A `lineCount` field still means the **source line**, so the records fanned out of one line share it. Dataset row counts (`min_rows`/`max_rows`) count output records, which is what fanning out changes.
- `indexFrom` numbers the occurrences here too, as the value of the occurrence field rather than part of a name.

### **Variable Occurrences and Anchoring**

Some layouts repeat a segment a number of times that **changes from line to line** — 34 reimbursement rows on one record, 36 on the next. Every field after such a block sits at a different column on almost every line, so an absolute `position` there doesn't fail: it reads plausible, wrong values. Two properties close that gap.

**`occurs` as an object** declares a count the line decides:

```json
{
  "name": "reimb",
  "position": { "start": 500, "length": 24 },
  "occurs": { "min": 34, "max": 36, "while": { "position": { "start": 1, "length": 1 }, "equals": "R" } },
  "dimensions": [ ... ]
}
```

```json
{
  "name": "progId",
  "position": { "after": "reimb", "length": 18 },
  "occurs": { "from": "$slotCount", "max": 61 },
  "dimensions": [ ... ]
}
```

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `occurs.max` | ✅ | Upper bound, and **how many columns the group generates** | `36` |
| `occurs.min` | ❌ | Occurrences every line has, whatever the rule reports. Default `0` | `34` |
| `occurs.while` | ⚠️ | Take occurrences while this marker matches. Its `position` is relative to one occurrence, like a child's | `{ "position": { "start": 1, "length": 1 }, "equals": "R" }` |
| `occurs.from` | ⚠️ | Read the count from an earlier dimension, referenced with `$`. Floored at `min`, capped at `max` | `"$slotCount"` |

Exactly one of `while` / `from` is required, and `max` is mandatory in both forms: the output columns have to be knowable before a single line is read.

**`position.after`** anchors a position to the end of a group's *actual* occurrences on that line, instead of to the start of the line:

```json
{ "name": "plan_code", "type": "string", "position": { "after": "progId", "length": 10 } }
```

`after` replaces `start`. To sit further into the anchored region, keep `start` as an offset inside it: `{ "after": "progId", "start": 11, "length": 2 }` reads characters 11-12 after the block. It must name a **group declared earlier** in the layout, and both groups and plain dimensions can use it.

Notes:

- **The column set stays fixed at `max`.** A line carrying fewer occurrences reads the missing ones as `null` — never as the characters of whatever follows the block.
- Only producers that need it pay for it: positions are still resolved once, and only a layout with a variable group or an `after` anchor is resolved per line.
- A dimension declared after a variable group but pinned to an absolute column is **warned** about at compile, not rejected — a layout is free to leave a variable block last, or to pad records to a fixed length.
- `occurs.from` must reference a single field at an absolute position, declared before the group: the count has to be readable before the occurrences it counts.

### **Flag Bitmaps**

Flat files often pack a set of yes/no indicators into one string, one character each (`"01101000"`). `flags` decodes such a field into one dimension per character, named after each flag:

```json
{
  "name": "addressUse",
  "type": "string",
  "position": { "start": 40, "length": 8 },
  "flags": ["mailing", "home", "billing", "emergency", "work", "school", "temp", "other"]
}
```

That yields `addressUseMailing` … `addressUseOther`, each a 1-character slice starting at `position.start`. `flags` must list exactly one name per character the dimension spans.

Each character is **sliced, never interpreted**, so a value that isn't strictly binary survives as itself (`"3"` stays `"3"`) — decode the characters into real values downstream with a consumer `conditional` or `code_lookup` transform if you need to.

Use `naming` to shape the generated names, with the tokens `{field}`, `{Field}`, `{flag}` and `{Flag}` — e.g. `"naming": "{field}_{flag}"` gives `addressUse_mailing`. `flags` works on a `string` dimension, including one inside a repeating group, where the group's naming applies first.

### **Mixed Record Types (H/D/T)**

Flat files often interleave record types in one file — a header, many detail records and a trailer — that share no layout. `recordSelector` reads only the lines whose marker matches, so one producer describes exactly one record layout:

```json
{
  "settings": {
    "fileKey": "claims.txt",
    "fileType": "FIXED",
    "recordSelector": {
      "position": { "start": 1, "length": 1 },
      "equals": "D"
    }
  }
}
```

Every other line (the `H` header and `T` trailer above) is dropped before parsing. `equals` also takes a list (`["D", "E"]`) when several record types share the same layout. To read the header or trailer records too, add a second producer over the same file with its own selector and positions, and combine them in a consumer.

A matching marker only says the line *claims* to be that record type, not that all of it is there. `minLength` asserts the rest of it is:

```json
{
  "settings": {
    "recordSelector": {
      "position": { "start": 1, "length": 1 },
      "equals": "D",
      "minLength": 2400,
      "onLengthMismatch": "skip"
    }
  }
}
```

A matching line shorter than `minLength` is dropped and logged at debug level (`"skip"`, the default), or fails the run (`"onLengthMismatch": "fail"`). Without it a truncated record parses into a plausible half-record whose missing tail reads as `null`. The check applies only to lines the marker already matched, so a short header or trailer is unaffected.

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `position` | ✅ | Where the record-type marker sits in the line | `{ "start": 1, "length": 1 }` |
| `equals` | ✅ | Marker value(s) to keep, compared against the trimmed marker | `"D"`, `["D", "E"]` |
| `minLength` | ❌ | Shortest a valid line of this record type can be, in characters | `2400` |
| `onLengthMismatch` | ❌ | What to do with a matching line that is too short | `"skip"` (default), `"fail"` |

### **File Pattern Matching**

Use wildcards to process multiple files matching a pattern:

```json
{
  "settings": {
    "fileKey": "sales_%.csv",
    "fileType": "CSV"
  }
}
```

This processes files like:

- `sales_2023.csv`
- `sales_2024.csv`
- `sales_january.csv`

### **Compressed Files**

Set `compressionType` to have Remora decompress the source file before parsing. Supported values: `GZ`, `ZIP`, `TAR`. The `fileType` still describes the *decompressed* content.

```json
{
  "settings": {
    "fileKey": "events.jsonl.gz",
    "fileType": "JSONL",
    "compressionType": "GZ"
  }
}
```

`GZ` wraps a single file. `ZIP` and `TAR` are archives and may hold several: every file inside is read, so one `fileKey` naming an archive produces the same result as a wildcard `fileKey` matching those files individually. Every member must therefore be the same `fileType` and share the same shape, exactly as the files behind a wildcard must.

```json
{
  "settings": {
    "fileKey": "daily_exports.zip",
    "fileType": "CSV",
    "delimiter": ",",
    "hasHeaderRow": true,
    "compressionType": "ZIP"
  }
}
```

Archives are decompressed a member at a time, streamed to disk rather than held in memory, so the size of the archive and of the largest file in it are not bound by the worker's memory. A single archive may hold up to 10 000 files; an encrypted member is refused.

A file that cannot be decompressed fails the run naming the file and the declared format, so a producer staging hundreds of files through a wildcard `fileKey` says which one to go and look at. Three cases are worth knowing apart, because the compression libraries report the first two identically:

| What is wrong | What the run says |
| --- | --- |
| The file is empty (0 bytes) | `Source file "..." is empty (0 bytes), so there is no GZ archive in it to read` |
| The file is a real archive that stops mid-stream | `Failed to decompress "..." as GZ: unexpected end of file. The archive ends mid-stream, so it is truncated` |
| The file is not that format at all | `Source file "..." is declared as GZ but does not start with the GZ signature 1f 8b` |

The first two are what a **drop folder** produces when a run reads a file while something else is still writing it: the file exists at zero bytes before it holds anything, and holds a partial archive until the write completes. Nothing on Remora's side can tell that file from a finished one, so have the writer stage it under a temporary name and rename it into place once written — a rename within a filesystem is atomic, so a run either sees the whole file or does not see it at all.

The third is a configuration mistake: `compressionType` names a format the file is not in. Remora checks the file's leading bytes against the declared format before decompressing it (`1f 8b` for `GZ`, `50 4b` for `ZIP`), so this is refused by name rather than reported as whatever the decompressor made of the first chunk. `TAR` carries no signature at the start of the file, so a mislabelled `TAR` is reported by the extractor instead.

### **Excel Start Row / Column**

For Excel files, `startRow` and `startColumn` (both 1-indexed) let you skip leading rows/columns before the data begins:

```json
{
  "settings": {
    "fileKey": "report.xlsx",
    "fileType": "XLSX",
    "sheetName": "Data",
    "startRow": 3,
    "startColumn": 2
  }
}
```

### **Example Configurations**

**CSV Data Processing:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "customer-data",
  "description": "Customer information from CSV file",
  "source": "local",
  "settings": {
    "fileKey": "customers.csv",
    "fileType": "CSV",
    "delimiter": ",",
    "hasHeaderRow": true},
  "dimensions": [
    {
      "name": "customer_id",
      "type": "string",
      "pk": true,
      "description": "Unique customer identifier"
    },
    {
      "name": "first_name",
      "type": "string",
      "classification": ["PII"],
      "mask": "hash"
    },
    {
      "name": "email",
      "type": "string",
      "classification": ["PII"],
      "mask": "mask"
    },
    {
      "name": "registration_date",
      "type": "datetime"
    }
  ],
  "_version": 1
}
```

**JSON Lines Processing:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "event-logs",
  "description": "Application event logs",
  "source": "s3-bucket",
  "settings": {
    "fileKey": "logs/events.jsonl",
    "fileType": "JSONL"
  },
  "dimensions": [
    {
      "name": "timestamp",
      "type": "datetime",
      "description": "Event timestamp"
    },
    {
      "name": "user_id",
      "type": "string",
      "classification": ["PII"]
    },
    {
      "name": "event_type",
      "type": "string"
    },
    {
      "name": "session_id",
      "type": "string"
    }
  ],
  "_version": 1
}
```

---

## **SQL-Based Producers**

SQL-based producers work with database sources like Redshift, providing structured data access.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "sql-producer",
  "description": "SQL-based data producer",
  "source": "redshift-warehouse",
  "settings": {
    "sqlTable": "customers",
    "direct": true},
  "dimensions": [/* field definitions */ ],
  "_version": 1
}
```

### **Settings Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `sqlTable` | ✅ | Database table name, `table` or `schema.table` | `"customers"`, `"analytics.sales_summary"` |
| `direct` | ❌ | Query the source directly as read-only (no view/DDL is created either way) | `true`, `false` (default) |
| `disablePushdown` | ❌ | Stop the run's filters and record limit being sent to the server as a `WHERE` and a `LIMIT`, so the whole table is read and narrowed locally. Both still apply either way — this only costs bandwidth | `true`, `false` (default) |

`sqlTable` is the only way to say where a SQL producer reads. A hand-written statement is not accepted: Remora builds the statement itself, from the table and the producer's own dimensions, so what a producer reads is always what it declares.

### **Filter and Limit Pushdown**

A consumer's filters, the filters an API or queue request carries, and the run's record limit (`remora run -l`) are sent to the server as part of the staging statement whenever Remora can guarantee they prune nothing the run would keep:

```sql
SELECT "id", "country", "score" FROM "public"."accounts" WHERE "country" IN ('Italy', 'Spain') LIMIT 100
```

This is an optimization and nothing else: every filter is applied per record and the limit enforced regardless, so a statement built without them reads more rows and returns the same result. Remora is deliberately conservative about what it pushes — the server is asked only for what it can be *proven* to agree with Remora about:

- The column's type in the database's own catalog must match the dimension's declared `type`, so the catalog is read once per producer when there is a filter to push. A `timestamptz` column declared as a `string` is read whole and filtered locally.
- Only `string` and `number` columns are pushed. A `datetime` bound names a different instant depending on how the value was parsed and on the session timezone, and a `boolean` is read back from a staged file differently than the server compares it.
- Only the operators that mean the same thing on both sides: `equals`, `in`, `contains`, `startsWith` and `endsWith` on text, and `equals`, `in`, `between` and the four comparisons on numbers. Every negation, null check and regular expression stays local.
- A filter on a field whose value is touched between the source and the filter — a transform, a default, a mask, a validation — is never pushed, since the record's value and the column's are no longer the same thing.
- The limit is pushed only when nothing between the source and the output can drop a record: no filters, `distinct`, `distinctOn`, `pivot`, `"onFail": "skip"` validation, producer `recordSelector` or row-fanning group.

Anything that does not qualify is simply read and narrowed locally, exactly as before. Set `"disablePushdown": true` on the producer to turn both off.

### **Direct Access**

Remora queries the SQL source directly — it builds `SELECT <dimensions> FROM <sqlTable>`, projecting the producer's dimensions in declaration order. Set `direct: true` to signal that Remora has read-only access to the source and should query it as-is (recommended for customer-cloud deployments where Remora holds read-only permissions).

```json
{
  "settings": {
    "sqlTable": "customer_orders",
    "direct": true}
}
```

### **Example Configurations**

**Simple Table Access:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "claims-data",
  "description": "Healthcare claims from data warehouse",
  "source": "redshift-warehouse",
  "settings": {
    "sqlTable": "claims",
    "direct": true},
  "dimensions": [
    {
      "name": "claim_id",
      "type": "string",
      "pk": true,
      "description": "Unique claim identifier"
    },
    {
      "name": "member_id",
      "type": "string",
      "classification": ["PHI"],
      "mask": "hash"
    },
    {
      "name": "provider_id",
      "type": "string"
    },
    {
      "name": "service_date",
      "type": "datetime"
    },
    {
      "name": "amount",
      "type": "number"
    }
  ],
  "_version": 1
}
```

---

## **Delta Share Producers**

Delta Share producers access shared datasets through the Delta Share protocol.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "shared-data",
  "description": "Data from Delta Share",
  "source": "delta-share-source",
  "settings": {
    "sqlTable": "shared_table_name",
    "fileType": "PARQUET"
  },
  "dimensions": [/* field definitions */ ],
  "_version": 1
}
```

### **Settings Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `sqlTable` | ✅ | Shared table name | `"customer_segments"`, `"market_data"` |
| `fileType` | ❌ | Specify PARQUET for Delta tables | `"PARQUET"` |
| `disableHistory` | ❌ | Skip sending the current table version in the Delta Share query request | `true`, `false` (default) |
| `disablePushdown` | ❌ | Stop the run's filters and record limit being sent to the source as query hints, so the whole table is read and narrowed locally. Both still apply either way — this only costs bandwidth | `true`, `false` (default) |

### **Example Configuration**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "shared-claims",
  "description": "Shared healthcare claims data",
  "source": "partner-delta-share",
  "settings": {
    "sqlTable": "claim_share_external",
    "fileType": "PARQUET"
  },
  "dimensions": [
    {
      "name": "hvid",
      "type": "number",
      "pk": true,
      "description": "Health plan member ID"
    },
    {
      "name": "claim_id",
      "type": "number",
      "description": "Unique claim identifier"
    },
    {
      "name": "service_date",
      "type": "datetime",
      "description": "Date of service"
    },
    {
      "name": "diagnosis_code",
      "type": "string",
      "description": "Primary diagnosis code"
    },
    {
      "name": "patient_state",
      "type": "string",
      "description": "Patient location state"
    }
  ],
  "_version": 1
}
```

---

## **HTTP API Producers**

HTTP API producers read data from a REST endpoint exposed by an `http-api` source. The `fileKey` holds the endpoint path, and `fileType` describes the response body (usually `JSON`).

### **Settings Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `fileKey` | ✅ | The API endpoint path (appended to the source's base URL) | `"/api/v1/users"` |
| `fileType` | ✅ | The format of the response body | `"JSON"` |
| `httpApi.dataProperty` | ❌ | If the records are wrapped in a property of the response object, its name | `"result"`, `"data"` |

### **Example Configuration**

If the API returns `{ "size": 10, "success": true, "result": [ ... ] }`, point `dataProperty` at `result` so Remora reads the array inside it:

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "api-users",
  "description": "User data from a REST API",
  "source": "rest-api-source",
  "settings": {
    "fileKey": "/api/v1/users",
    "fileType": "JSON",
    "httpApi": {
      "dataProperty": "result"
    }
  },
  "dimensions": [
    { "name": "user_id", "type": "string", "pk": true },
    { "name": "username", "type": "string" },
    { "name": "email", "type": "string", "classification": ["PII"], "mask": "mask" }
  ],
  "_version": 1
}
```

---

## **Dimensions (Fields)**

Dimensions define the structure and characteristics of data fields in your producer.

### **Dimension Schema**

```json
{
  "name": "field_name",
  "description": "Field description",
  "type": "string",
  "alias": "source_column_name",
  "pk": false,
  "classification": ["PII"],
  "mask": "hash"
}
```

### **Properties Reference**

| Property | Required | Description | Values |
| --- | --- | --- | --- |
| `name` | ✅ | Field name in Remora | Any valid identifier |
| `description` | ❌ | Field description. No runtime effect, but it is shown under the dimension in `remora ui-preview` and the field filter matches it | Descriptive text |
| `type` | ✅ | Data type. Omitted only on a repeating group, which produces no column of its own | `string`, `number`, `datetime`, `boolean` |
| `alias` | ❌ | Source column/field name | Source-specific field name |
| `pk` | ❌ | Primary key indicator | `true`, `false` (default) |
| `nullable` | ❌ | Whether the field may hold null/missing values. **Defaults to `true`**: a missing value (including the empty field a SQL `NULL` is staged as) is kept as `null`. Set `false` to get the type's own empty value instead — `""` for `string`, `0` for `number`, `false` for `boolean`; a `datetime` has none and stays `null`. To reject a missing value rather than fill it, use a consumer field `required` validation. | `true`, `false` |
| `classification` | ❌ | Data privacy classification | `["PII"]`, `["PHI"]`, `["GDPR"]` |
| `mask` | ❌ | Data masking method | `hash`, `mask`, `crypt`, `random`, `seeded-random`, `none` |
| `format` | ❌ | Source parse/cast format (e.g. a date format). `DDD` reads a day-of-year ("Julian") date | `"YYYYMMDD"`, `"DD-MM-YYYY"`, `"YYYYDDD"` |
| `scale` | ❌ | Implied decimal places of a `number` written without a decimal point. See [Implied decimals](#implied-decimals). | `2` |
| `sourceFilename` | ❌ | Populate this dimension with the source file name (file producers only; one per producer) | `true`, `false` (default) |
| `position` | ⚠️ | Where the value sits in the line, for `FIXED` (fixed-width) producers — required on every dimension of one, ignored elsewhere. See [Fixed-Width Files](#fixed-width-files-fixed). | `{ "start": 21, "length": 10 }`, `{ "start": 21, "end": 30 }` |
| `position.after` | ❌ | Anchors the position to the end of an earlier group's actual occurrences instead of to the start of the line. See [Variable Occurrences](#variable-occurrences-and-anchoring). | `{ "after": "reimb", "length": 18 }` |
| `dimensions` | ❌ | Makes this a repeating group (`FIXED` only): the fields that repeat, positioned relative to one occurrence. See [Repeating Groups](#repeating-groups-occurs). | see Repeating Groups |
| `occurs` | ❌ | Occurrences of a repeating group. Default `1`, max `1000`; an object when the count varies per line | `3`, `{ "max": 36, "while": { ... } }` |
| `indexFrom` | ❌ | First index used in the names a group generates | `0` (default), `1` |
| `naming` | ❌ | Name template for the dimensions a group or `flags` generates | `"{group}_{index}_{field}"`, `"{field}_{flag}"` |
| `emit` | ❌ | Whether a group's occurrences become columns (default) or one record each. See [Occurrences as Rows](#occurrences-as-rows). | `"columns"`, `"rows"` |
| `occurrenceField` | ❌ | Name of the occurrence-index field an `emit: "rows"` group generates. Default `{group}Occurrence` | `"addr_occurrence"` |
| `skipEmptyOccurrences` | ❌ | Whether an `emit: "rows"` group drops all-empty occurrences. Default `true` | `false` |
| `flags` | ❌ | Decodes a per-character bitmap into one dimension per character (`FIXED` only). See [Flag Bitmaps](#flag-bitmaps). | `["mailing", "billing", "physical"]` |
| `synth` | ❌ | Synthetic-data configuration for this dimension, used only by `synth`. See [Synthetic data properties](#synthetic-data-properties) below. | `{ "decimals": 0 }` |

### **Synthetic Data Properties**

Everything that shapes a dimension's *generated* values lives under `synth`. None of it affects a real
producer read — it only applies when you run `synth`:

```json
{
  "name": "gap_status",
  "type": "string",
  "synth": { "codeSet": "gap_statuses" }
}
```

| Property | Required | Description | Values |
| --- | --- | --- | --- |
| `synth.decimals` | ❌ | Decimal places for generated `number` values. `0` forces whole integers (loads into an `integer` column); a positive value rounds to that many decimals. | `0`, `4` |
| `synth.min` / `synth.max` | ❌ | Inclusive bounds for generated values — a number range, a date window for a `datetime`, or a length in characters for a `string`. Either can be given alone. Works on key/ID columns too. Not for `boolean` dimensions, and not combined with `allowedValues`/`codeSet`/`references`. | `{ "min": 18, "max": 90 }`, `{ "min": "2024-01-01", "max": "2024-12-31" }`, `{ "max": 20 }` |
| `synth.unique` | ❌ | Emit a distinct value in every row, for a column that must not repeat without being the primary key. Generated as an identifier from the key pool, not from the column's topic. `string`/`number` dimensions only, and not combined with `allowedValues`/`codeSet`/`references`. | `true` |
| `synth.allowedValues` | ❌ | Inline closed set of values. See [Code Sets](Remora%20-%20Code%20Sets.md). Mutually exclusive with `synth.codeSet`. | e.g. `["Y", "N"]` |
| `synth.codeSet` | ❌ | Reference to a named [code set](Remora%20-%20Code%20Sets.md). Mutually exclusive with `synth.allowedValues`. | `"gap_statuses"` or `{ "name": "hedis_measures", "field": "code" }` |
| `synth.references` | ❌ | Declares this dimension as a foreign key into another producer's field. Generated values are drawn from the referenced field's key domain so joins/unions line up. Single-column only. Mutually exclusive with `synth.allowedValues`/`synth.codeSet`. | `{ "producer": "p_members", "field": "member_id" }` |

> These properties used to sit directly on the dimension (`"codeSet": "gap_statuses"`). They must now be
> nested under `synth`; a leftover top-level property is rejected with an error telling you to move it.

### **Data Types**

### **String**

```json
{
  "name": "customer_name",
  "type": "string",
  "description": "Customer full name"
}
```

For synthetic data (`synth`), `synth.min` / `synth.max` are the value's **length in characters**, both ends inclusive, and either can be given alone. On a string the bounds *clamp* the generated value rather than replace it — a value longer than `max` is cut to it, a value shorter than `min` is filled out with letters — so a column keeps generating plausible names or cities while still fitting the width it has to load into:

```json
{
  "name": "member_last_name",
  "type": "string",
  "synth": { "max": 20 }
}
{
  "name": "external_ref",
  "type": "string",
  "synth": { "min": 8, "max": 8 }
}
```

Lengths must be whole numbers (`min` at least 0, `max` at least 1). A cut value is trimmed, so it never ends on a space.

#### Key and ID columns

A key column — a primary key, or one whose name reads like an identifier (`member_id`, `account_key`, …) — is not generated from a topic. Its values come from a shared pool, so the same key name means the same value domain in every producer that has it and datasets relate to each other. Bounds work there too, and mean the same thing, but they are applied differently: the pool is **generated at** the declared width instead of being clamped to it, because cutting `member_id_10` and `member_id_100` down to a width would make them the same value and break the relationships the pool exists to keep.

```json
{
  "name": "member_id",
  "type": "string",
  "pk": true,
  "synth": { "min": 10, "max": 10 }
}
```

That generates `memberid01`, `memberid02`, … — a name-derived prefix plus a sequence number, together exactly 10 characters. The prefix gives way to the digits when the width is tight, so a narrow key still gets a distinct value per row. When both ends are given the pool is generated at `max`, so the value fills the column that declared it.

On a `number` key, `min`/`max` are the value range as usual and the pool is taken from the start of it: `{ "min": 500000, "max": 999999 }` yields `500000`, `500001`, …

A **primary key** (`"pk": true`) walks that pool by row, so every row gets its own value. Any other key draws from it at random, which is what makes a `customer_id` repeat across rows the way a real one does. When a column has to be distinct without being the primary key — a natural key, an external reference, an account number — declare `synth.unique`:

```json
{
  "name": "external_ref",
  "type": "string",
  "synth": { "unique": true }
}
```

That column is then served from the pool too (`external_ref_1`, `external_ref_2`, …) and walked by row, so no two rows share a value. Note what it costs: a unique column is generated as an *identifier*, not from its name — uniqueness is not something a name-based generator can promise, so `synth.unique` on `email` gives you `email_1`, not a realistic address. It applies to `string` and `number` columns, combines with `min`/`max` the way any key does, and is rejected on a column whose values come from an `allowedValues`/`codeSet` list (those repeat by definition) or from `references` (a unique foreign key is a one-to-one relation, which `synth` does not generate yet).

Because the pool holds one value per generated record, a run that asks for more records than the pool can hold (100,000) while something has to stay distinct fails with an error rather than quietly repeating values.

Two rules follow from the pool being shared, and both fail with an error rather than quietly producing something wrong:

- **The width has to hold the pool.** The pool has one value per generated record (`--records`), so `{ "max": 3 }` cannot serve 5,000 rows. Widen the column or generate fewer records.
- **Same-named keys must agree.** If two producers both have `member_id` and declare different bounds for it, there is no single domain left to share.

Bound the **parent** field of a foreign key, never the child: a `synth.references` column's values *are* the parent's, so it inherits the parent's width automatically.

### **Number**

```json
{
  "name": "transaction_amount",
  "type": "number",
  "description": "Transaction amount in dollars"
}
```

#### Implied decimals

Flat files from mainframe and other legacy systems write an amount **without its decimal point**: the field holds digits only, and the layout says how many of the trailing ones are the fraction. A COBOL `PIC S9(7)V99` amount of `123.45` is written `000012345`. Read as-is that is `12345` — a perfectly plausible amount, 100× wrong, and nothing downstream can tell.

`scale` says how many of the trailing digits are the fraction:

```json
{
  "name": "claim_amount",
  "type": "number",
  "scale": 2,
  "position": { "start": 21, "length": 9 }
}
```

`000012345` then reads as `123.45`, and `000000005` as `0.05`.

- `number` dimensions only, and 1 or more. A field written *with* its decimal point, or with no fraction at all, omits `scale` entirely.
- A field declaring `scale` holds digits and an optional leading sign, nothing else. A decimal point in the value contradicts the layout, so the run fails naming the value rather than guessing which of the two readings was meant.
- Not restricted to `FIXED`: a CSV column written the same way reads the same way.
- Only text is decoded. A source that already hands Remora a number (JSON, SQL) hands over the value itself, so `scale` leaves it alone.
- `synth` generates values with `scale` decimal places, so synthetic data fits the column it describes. `synth.decimals` overrides that.

For synthetic data (`synth`), use `synth.decimals` to control how many decimal places generated `number` values get, so they load into the destination column. `decimals: 0` forces whole integers (fits an `integer` column); a positive value rounds to that many decimals:

```json
{
  "name": "readmission_probability",
  "type": "number",
  "synth": { "decimals": 0 }
}
{
  "name": "days_covered_percentage",
  "type": "number",
  "synth": { "decimals": 4 }
}
```

Use `synth.min` / `synth.max` to pin the range a generated `number` is drawn from — both ends inclusive, and either one can be given alone. Bounds replace the name-based generator, so this is how you keep a column inside a real-world range the field name can't imply (a plausible age, a rate between 0 and 1, an amount that has to fit a fixed-width column):

```json
{
  "name": "member_age",
  "type": "number",
  "synth": { "min": 18, "max": 90, "decimals": 0 }
}
{
  "name": "risk_factor",
  "type": "number",
  "synth": { "min": 0.5, "max": 2.5, "decimals": 3 }
}
```

Values are whole numbers unless `decimals` asks otherwise. Bounds apply to `number`, `datetime` and `string` dimensions (never `boolean`), and not to a dimension whose value already comes from somewhere else — `allowedValues`, `codeSet` or `references` — where they would be silently ignored; `synth` fails with an error naming the dimension instead.

### **DateTime**

```json
{
  "name": "created_at",
  "type": "datetime",
  "description": "Record creation timestamp"
}
```

For synthetic data (`synth`), `synth.min` / `synth.max` set the window dates are drawn from, instead of the default 2020–2024 one. Write them the way the column's own values are written: with the dimension's `format` if it has one, otherwise as a plain or ISO date. Either bound can be given alone, and the other then spans the default window's width from it:

```json
{
  "name": "measurement_year_start",
  "type": "datetime",
  "synth": { "min": "2024-01-01", "max": "2024-12-31" }
}
{
  "name": "claim_paid_date",
  "type": "datetime",
  "format": "YYYYMMDD",
  "synth": { "min": "20240101", "max": "20240131" }
}
{
  "name": "event_at",
  "type": "datetime",
  "synth": { "min": "2025-06-01T08:00:00Z", "max": "2025-06-01T17:00:00Z" }
}
```

A bound that names a day covers that whole day, so the `20240101`–`20240131` window above generates every date in January including the 31st. Give a time (as in the third example) when you want the window to end at a precise instant. Dates are parsed and rendered in UTC, so a window means the same thing on every machine.

### **Boolean**

```json
{
  "name": "is_active",
  "type": "boolean",
  "description": "Whether the record is active"
}
```

### **Field Aliases**

Use aliases when source field names differ from desired Remora field names:

```json
{
  "name": "customer_id",
  "alias": "cust_id",
  "type": "string",
  "description": "Maps cust_id column to customer_id field"
}
```

### **Primary Keys**

Mark fields that uniquely identify records:

```json
{
  "name": "transaction_id",
  "type": "string",
  "pk": true,
  "description": "Unique transaction identifier"
}
```

### **Source Format**

When the source represents a value in a format Remora can't infer (most often dates), set `format` to tell Remora how to parse it while casting to the dimension's `type`:

```json
{
  "name": "service_date",
  "type": "datetime",
  "format": "YYYYMMDD"
}
```

### **Source Filename**

Set `sourceFilename: true` on a dimension to populate it with the name of the file each record came from. This is especially useful with wildcard `fileKey` patterns that merge many files into one dataset. Only one dimension per producer can use it, and only for file-based sources (`local`, `aws-s3`). The dimension does not need to exist in the source data.

```json
{
  "name": "source_file",
  "type": "string",
  "sourceFilename": true
}
```

### **Value Constraints (Code Sets)**

For **synthetic data generation** (the `synth` command), you can constrain a dimension to a closed set of values — inline with `synth.allowedValues`, or by referencing a reusable, named **code set** with `synth.codeSet`. Code sets also keep related fields coherent (e.g. a measure code and its description on the same row). Like everything under `synth`, these only affect `synth`; they have no effect on normal producer reads.

```json
{
  "name": "gender_code",
  "type": "string",
  "synth": { "allowedValues": ["M", "F", "U"] }
}
```

See [Remora - Code Sets](Remora%20-%20Code%20Sets.md) for the full feature, including structured (correlated) code sets and the built-in healthcare sets.

---

## **Data Classification and Masking**

Protect sensitive data with classification and masking controls.

### **Data Classifications**

### **Personally Identifiable Information (PII)**

```json
{
  "name": "social_security_number",
  "type": "string",
  "classification": ["PII"],
  "mask": "hash"
}
```

### **Protected Health Information (PHI)**

```json
{
  "name": "patient_id",
  "type": "string",
  "classification": ["PHI"],
  "mask": "crypt"
}
```

### **GDPR Protected Data**

```json
{
  "name": "email_address",
  "type": "string",
  "classification": ["GDPR", "PII"],
  "mask": "mask"
}
```

### **Multiple Classifications**

```json
{
  "name": "medical_record_number",
  "type": "string",
  "classification": ["PII", "PHI", "GDPR"],
  "mask": "hash"
}
```

### **Masking Methods**

### **Hash Masking**

- **Purpose**: One-way transformation for analytics
- **Use case**: Customer IDs, account numbers
- **Reversible**: No

```json
{
  "name": "customer_id",
  "type": "string",
  "classification": ["PII"],
  "mask": "hash"
}
```

### **Field Masking**

- **Purpose**: Partial data hiding
- **Use case**: Email addresses, phone numbers
- **Reversible**: No

```json
{
  "name": "email",
  "type": "string",
  "classification": ["PII"],
  "mask": "mask"
}
```

### **Encryption**

- **Purpose**: Secure, reversible protection
- **Use case**: Highly sensitive data
- **Reversible**: Yes (with proper keys)

```json
{
  "name": "medical_record",
  "type": "string",
  "classification": ["PHI"],
  "mask": "crypt"
}
```

### **Random Replacement**

- **Purpose**: Replace with random values
- **Use case**: Testing and development
- **Reversible**: No

```json
{
  "name": "phone_number",
  "type": "string",
  "classification": ["PII"],
  "mask": "random"
}
```

### **Seeded Random**

- **Purpose**: Consistent random values
- **Use case**: Repeatable test data
- **Reversible**: No

```json
{
  "name": "address",
  "type": "string",
  "classification": ["PII"],
  "mask": "seeded-random"
}
```

### **No Masking**

- **Purpose**: Explicitly disable masking
- **Use case**: Public data, overriding defaults

```json
{
  "name": "product_name",
  "type": "string",
  "mask": "none"
}
```

---

## **Schema Discovery**

Remora can automatically discover field schemas from your data sources.

### **Auto-Discovery Command**

```bash
# Discover the schema and merge the fields into the producer's dimensions
remora discover producer-name

# Rewrite the dimensions from the source instead of merging into them
remora discover producer-name --replace
```

Where the fields come from depends on the source:

- **File sources** (local, S3, Delta Share) have no schema to ask for, so discovery reads a sample of the data and infers each field's type from its values.
- **SQL sources** (Redshift, Postgres) declare their own schema, so discovery reads the table's columns from `information_schema` — the table named in `settings.sqlTable`, not the dimensions the producer already declares. It therefore finds the columns you have **not** declared yet, which is the point of running it, and it types them from the column's SQL type rather than from a handful of values: a `numeric` column is a `number` even if every row sampled from it happened to be whole. No data is read at all.

### **What Discovery Writes**

Discovery **merges** into the producer you already have. It never rewrites a dimension you wrote: re-running it on a curated producer is safe, and the only thing it changes about an existing dimension is to supply a property that dimension declared nothing for.

| What discovery found | What it does |
| --- | --- |
| A field the producer does not declare | Adds a dimension for it |
| A dimension that declares no `nullable`, where the source states the column is `NOT NULL` | Fills in `"nullable": false` |
| A dimension whose declared `type` is not the one the source reports | **Leaves it alone** and prints the difference |
| A dimension the source has no field for | **Keeps it** and prints it |

Everything else a dimension carries — `pk`, `description`, `alias`, `format`, `mask`, `classification`, `synth` — is yours, and is never touched. So is the rest of the producer: its `description` and `settings` are written back exactly as you left them.

A declared type is left alone on purpose. A producer is free to read a `timestamptz` as a `string` or a padded `char(n)` as one, and that decision is not discovery's to undo — it tells you about the disagreement and lets you decide.

A dimension that is matched by `alias` rather than by `name` is still recognised, including an `alias` that reaches into a field (`address.city` matches the field `address`), so a renamed or decomposed column is not re-added as a duplicate.

A **new** dimension is created as:

```json
{
  "name": "field_name",
  "type": "string",
  "description": "Auto-mapped field: field_name"
}
```

A column a SQL table declares as `NOT NULL` also gets `"nullable": false`, since that is something the catalog states and a sample cannot. A nullable column carries no declaration, because [`nullable` already defaults to `true`](#dimension-properties).

### **Rewriting Instead of Merging**

```bash
remora discover producer-name --replace
```

`--replace` rebuilds the dimension list from the source: a dimension the source has no field for is **dropped**, and a declared type the source disagrees with is **overwritten**. Everything hand-written on the dimensions goes with it, so this is for one situation — bootstrapping a producer created from the `create-producer` template, whose placeholder dimensions nothing else removes. It is also the only way to delete a dimension whose column is gone upstream.

Dimensions the source could never describe are kept even here: a [`sourceFilename`](#dimension-properties) dimension holds the name of the file it was read from, not a field of the data, so no discovery can speak for it.

### **Manual Schema Refinement**

After auto-discovery, manually refine the schema:

1. **Update data types** for better precision
2. **Add classifications** for sensitive data
3. **Configure masking** for privacy protection
4. **Set primary keys** for unique identifiers
5. **Add descriptions** for business context

All of it survives the next `remora discover` — that is what the merge above is for. Re-run discovery whenever the source gains a column.

**Before Refinement:**

```json
{
  "name": "customer_email",
  "type": "string",
  "description": "Auto-mapped field: customer_email"
}
```

**After Refinement:**

```json
{
  "name": "customer_email",
  "type": "string",
  "description": "Customer email address for communications",
  "classification": ["PII", "GDPR"],
  "mask": "mask"
}
```

---

## **Validation and Testing**

### **Configuration Validation**

```bash
# Compile & validate all resource configurations in the project
remora compile

# Validate a single producer (checks its config against its source)
remora verify producer-name
```

### **Producer Testing**

```bash
# Read a few records from the producer to inspect the extracted data
remora sample producer-name

# Show a specific number of sample rows
remora sample producer-name -s 10
```

The rows come back exactly as the producer reads them: dimensions renamed to their declared names,
values cast to their declared types, repeating groups expanded, and any dimension carrying a `mask`
already masked. A column declared `"mask": "hash"` is therefore shown hashed here, the same as in a
run — sampling never shows a masked value in the clear.

### **Common Validation Errors**

| Error | Cause | Solution |
| --- | --- | --- |
| `Source not found` | Invalid source reference | Check source name exists |
| `Invalid file type` | Unsupported file format | Use supported file types |
| `Invalid dimension type` | Wrong data type | Use valid dimension types |

---

## **Performance Optimization**

### **File-Based Producers**

1. **Use appropriate file formats**
    - JSON Lines for streaming large datasets
    - CSV for simple tabular data
    - Parquet for analytics workloads
2. **Optimize file patterns**
    - Use specific patterns to limit file scanning
    - Partition large datasets by date/category
3. **Configure memory settings**
    - Adjust `MAX_ITEMS_IN_MEMORY` for large files
    - Use streaming for files exceeding memory limits

### **SQL-Based Producers**

1. **Use direct access** for simple queries
    
    ```json
    {
      "settings": {
        "direct": true,
        "sqlTable": "optimized_table"
      }
    }
    ```
    
2. **Index source tables** for better query performance
3. **Limit data with WHERE clauses** in custom SQL

### **Memory Management**

Configure memory settings in your project configuration:

```json
{
  "settings": {
    "MAX_ITEMS_IN_MEMORY": 100000,
    "SQL_MAX_QUERY_ROWS": 1000000,
    "INDICATIVE_THREAD_LINE_COUNT": 10000
  }
}
```

---

## **Migration and Versioning**

### **Producer Versioning**

Update the `_version` field when making significant changes:

```json
{
  "name": "customer-data",
  "_version": 2
}
```

### **Schema Evolution**

When evolving producer schemas:

1. **Add new dimensions** at the end of the dimensions array
2. **Mark deprecated fields** with descriptions
3. **Use aliases** to maintain compatibility
4. **Test thoroughly** before deploying changes

### **Backwards Compatibility**

Maintain backwards compatibility by:

```json
{
  "dimensions": [
    {
      "name": "customer_id",
      "alias": "legacy_cust_id",
      "type": "string",
      "description": "Mapped from legacy system"
    }
  ]
}
```

---

## **Best Practices**

### **Naming Conventions**

- **Producer names**: Use descriptive, lowercase with hyphens (`customer-orders`)
- **Dimension names**: Use snake_case (`customer_id`, `order_date`)

### **Security**

1. **Classify sensitive data** appropriately
2. **Apply masking** to protected fields
3. **Use least-privilege** source access
4. **Document data lineage** in descriptions

### **Performance**

1. **Use direct access** when possible
2. **Limit data scope** with filters
3. **Index source tables** for better performance
4. **Monitor query performance** in production

### **Documentation**

1. **Add meaningful descriptions** to all components
2. **Explain data transformations** in comments
3. **Maintain schema documentation** separately

### **Testing**

1. **Validate configurations** before deployment
2. **Test with sample data** during development
3. **Monitor data quality** in production
4. **Set up alerts** for schema changes

---

## **Troubleshooting**

### **Common Issues**

**File Not Found:**

```
Error: File 'data.csv' not found in source 'local'
```

- Verify file exists in source path
- Check file name spelling and case sensitivity
- Ensure source path is correct

**Invalid SQL Table:**

```
Error: Table 'customers' does not exist
```

- Verify table name in database
- Check schema permissions
- Ensure source connection is valid

**Type Mismatch:**

```
Error: Cannot convert 'abc' to number for field 'amount'
```

- Review data types in source
- Update dimension type or add data cleaning
- Check for null/empty values

**Permission Denied:**

```
Error: Insufficient permissions to create view
```

- Use `"direct": true` for read-only access
- Check database permissions
- Verify source credentials

### **Debug Mode**

Enable detailed logging in project configuration:

```json
{
  "settings": {
    "LOG_LEVEL": "DEBUG",
    "DEBUG_MODE": true}
}
```

### **Support Resources**

- **Schema validation**: Automatic validation against JSON schemas
- **CLI help**: Run `remora --help` for command documentation
- **Error messages**: Include specific guidance for resolution
- **Discovery tools**: Use `remora discover` for schema generation

---

## **Example Producer Library**

### **Simple CSV Producer**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "sales-data",
  "description": "Daily sales transactions",
  "source": "local",
  "settings": {
    "fileKey": "sales.csv",
    "fileType": "CSV",
    "hasHeaderRow": true},
  "dimensions": [
    {
      "name": "transaction_id",
      "type": "string",
      "pk": true},
    {
      "name": "customer_id",
      "type": "string",
      "classification": ["PII"],
      "mask": "hash"
    },
    {
      "name": "product_name",
      "type": "string"
    },
    {
      "name": "amount",
      "type": "number"
    },
    {
      "name": "sale_date",
      "type": "datetime"
    }
  ],
  "_version": 1
}
```

### **Healthcare Claims Producer**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "healthcare-claims",
  "description": "Healthcare claims from data warehouse",
  "source": "redshift-warehouse",
  "settings": {
    "sqlTable": "claims",
    "direct": true},
  "dimensions": [
    {
      "name": "claim_id",
      "type": "string",
      "pk": true,
      "description": "Unique claim identifier"
    },
    {
      "name": "member_id",
      "type": "string",
      "classification": ["PHI"],
      "mask": "hash",
      "description": "Patient member ID"
    },
    {
      "name": "provider_npi",
      "type": "string",
      "description": "Healthcare provider NPI number"
    },
    {
      "name": "service_date",
      "type": "datetime",
      "description": "Date of medical service"
    },
    {
      "name": "diagnosis_code",
      "type": "string",
      "description": "Primary diagnosis ICD-10 code"
    },
    {
      "name": "procedure_code",
      "type": "string",
      "description": "Medical procedure CPT code"
    },
    {
      "name": "billed_amount",
      "type": "number",
      "description": "Amount billed by provider"
    },
    {
      "name": "allowed_amount",
      "type": "number",
      "description": "Amount allowed by insurance"
    }
  ],
  "_version": 1
}
```

### **Multi-File JSON Producer**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/producer-schema.json",
  "name": "application-logs",
  "description": "Application event logs from multiple files",
  "source": "s3-logs",
  "settings": {
    "fileKey": "logs/app-%.jsonl",
    "fileType": "JSONL"
  },
  "dimensions": [
    {
      "name": "timestamp",
      "type": "datetime",
      "description": "Event timestamp"
    },
    {
      "name": "level",
      "type": "string",
      "description": "Log level (INFO, WARN, ERROR)"
    },
    {
      "name": "user_id",
      "type": "string",
      "classification": ["PII"],
      "mask": "hash",
      "description": "User performing the action"
    },
    {
      "name": "action",
      "type": "string",
      "description": "Action performed"
    },
    {
      "name": "ip_address",
      "type": "string",
      "classification": ["PII"],
      "mask": "mask",
      "description": "User IP address"
    },
    {
      "name": "response_time_ms",
      "type": "number",
      "description": "Response time in milliseconds"
    }
  ],
  "_version": 1
}
```