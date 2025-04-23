# Configuration Guide

This README explains the available configurations for each resource type in the project. 
Each section details the expected values for different keys in the JSON files.

## Remora Configuration

The main project configuration file.

| Key | Description | Possible Values |
|-----|-------------|----------------|
| `name` | Project identifier | Any string |
| `version` | Project version number | Semantic version (e.g., `1.0.0`) |
| `description` | Project purpose | Any descriptive text |
| `consumers` | Path to consumer definitions | Directory path as string |
| `producers` | Path to producer definitions | Directory path as string |
| `sources` | Path to source definitions | Directory path as string |
| `schemas` | Path to schema definitions | Directory path as string |
| `settings.SQL_MAX_QUERY_ROWS` | Maximum rows in query results | Positive integer |
| `settings.DEFAULT_TIMEOUT_SECONDS` | Maximum query execution time | Positive integer (seconds) |
| `settings.LOG_LEVEL` | Logging detail level | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

## Source Configuration

Sources define the connection to your data storage systems.

| Key | Description | Possible Values |
|-----|-------------|----------------|
| `name` | Unique identifier for the source | Any string without spaces |
| `description` | Explanation of what this source represents | Any descriptive text |
| `_version` | Version number for tracking changes | Positive integer |
| `engine` | Type of data storage system | `aws-redshift`, `aws-dynamodb`, `aws-s3`, `postgres`, `local` |
| `authentication.method` | Authentication method for connecting to the source | `iam`, `username-password`, `access-secret-key`, `arn`, `implicit` |
| `authentication.schema` | Database schema to use | Schema name as string |
| `authentication.bucketName` | Bucket s3 name | Bucket name as string |
| `authentication.accessKey` | AWS access key | String (preferably environment variable) |
| `authentication.secretKey` | AWS secret key | String (preferably environment variable) |
| `authentication.region` | AWS region | AWS region code (e.g., `us-east-1`) |
| `authentication.database` | Database name | String |
| `authentication.workgroup` | AWS workgroup | String |
| `authentication.host` | Database host (for username-password method) | Hostname or IP address |
| `authentication.user` | Database username (for username-password method) | String |
| `authentication.password` | Database password (for username-password method) | String (preferably environment variable) |
| `authentication.port` | Database port (for username-password method) | Integer |

## Producer Configuration

Producers extract data from sources and define the structure of the data.

| Key | Description | Possible Values |
|-----|-------------|----------------|
| `name` | Unique identifier for the producer | Any string without spaces |
| `description` | Explanation of what this producer represents | Any descriptive text |
| `source` | Name of the source this producer uses | Must match a source `name` |
| `_version` | Version number for tracking changes | Positive integer |
| `dimensions[].name` | Name of the field/column | Any string without spaces |
| `dimensions[].type` | Data type of the field | `string`, `number`, `datetime` |
| `dimensions[].pk` | Whether this is a primary key | `true`, `false` |
| `dimensions[].description` | Description of the field | Any descriptive text |
| `dimensions[].alias` | Alternative name for the column in the source | String |
| `dimensions[].classification` | Data privacy classification | Array containing: `PII`, `PHI`, `GDPR` |
| `dimensions[].mask` | How to protect sensitive data | `hash`, `mask`, `crypt` |
| `measures[].name` | Name of calculated measure | Any string without spaces |
| `measures[].description` | Description of the measure | Any descriptive text |
| `measures[].sql` | SQL expression to calculate the measure | Valid SQL expression (e.g., `SUM(field_name)`) |
| `settings.sqlTable` | Source table name | Table name as string |
| `settings.direct` | Whether to query directly without creating views | `true`, `false` |
| `settings.sql` | Custom SQL for this producer | SQL query string |
| `settings.fileKey` | File key for S3 sources | S3 file path |
| `settings.fileType` | File format for file-based sources | `JSON`, `JSONL`, `CSV` |

## Consumer Configuration

Consumers transform and combine data from producers for specific use cases.

| Key | Description | Possible Values |
|-----|-------------|----------------|
| `name` | Unique identifier for the consumer | Any string without spaces |
| `description` | Explanation of what this consumer represents | Any descriptive text |
| `_version` | Version number for tracking changes | Positive integer |
| `producers[].name` | Name of a producer this consumer uses | Must match a producer `name` |
| `producers[].joins[].otherName` | Name of another producer to join with | Must match a producer `name` |
| `producers[].joins[].relationship` | Type of relationship for the join | `one-to-one`, `one-to-many`, `many-to-one` |
| `producers[].joins[].sql` | SQL expression for the join | Valid SQL join condition |
| `producers[].custom.language` | Language for custom transformations | `js`, `python` |
| `producers[].custom.code` | Code for custom transformations | Valid code in the specified language |
| `fields[].key` | Field name from producer or `*` for all fields | Field name or `*` |
| `fields[].alias` | New name for the field in the output | Any string without spaces |
| `fields[].from` | Producer to get the field from | Must match a producer `name` |
| `fields[].grouping.groupingKey` | Field to group by | Any string without spaces |
| `fields[].grouping.subFields` | Fields to include in each group | Array of field objects |
| `filters[].sql` | SQL condition for filtering | SQL WHERE condition |
| `filters[].rule.member` | Field to filter on | Field name |
| `filters[].rule.operator` | Comparison operator | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains` |
| `filters[].rule.values` | Values to compare against | Array of strings |
| `outputs[].format` | Output format | `SQL`, `API`, `CSV`, `PARQUET`, `JSON` |
| `outputs[].accellerated` | Whether to materialize for performance | `true`, `false` |
| `outputs[].direct` | Whether to query directly without creating views | `true`, `false` |
| `outputs[].exportDestination` | Where to export data | Must match a source `name` |
| `outputs[].trigger.type` | How to trigger exports | `CRON`, `API` |
| `outputs[].trigger.value` | Trigger expression | CRON expression (e.g., `0 0 * * *`) or endpoint path |
| `metadata` | Custom tags | Object with string keys and values |
| `project` | Project grouping | String |
| `schema` | JSON schema to validate against | Must match a schema `title` |

## Schema Configuration

Schemas define the structure and validation rules for data.

| Key | Description | Possible Values |
|-----|-------------|----------------|
| `$schema` | JSON Schema specification version | URL (e.g., `http://json-schema.org/draft-07/schema#`) |
| `title` | Name of this schema | Any string |
| `type` | Data structure type | `object` |
| `version` | Schema version number | Positive integer |
| `description` | Explanation of this schema | Any descriptive text |
| `properties` | Field definitions | Object with field names as keys |
| `properties.*.type` | Data type of field | `string`, `number`, `integer`, `boolean`, `array`, `object` |
| `properties.*.format` | Format specification | `date-time`, `email`, `uri`, etc. |
| `properties.*.description` | Description of field | Any descriptive text |
| `properties.*.enum` | Allowed values | Array of values |
| `required` | Fields that must be present | Array of field names |
| `additionalProperties` | Whether undefined fields are allowed | `true`, `false` |# remora-public
