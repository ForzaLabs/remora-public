# Remora - Sources

## **Overview**

Sources in Remora define the connection configurations to your data storage systems. They act as the foundation for data extraction through producers and serve as the bridge between Remora and your various data stores.

Each source configuration specifies:

- **Connection details** (host, credentials, region, etc.)
- **Authentication method** (how to securely connect)
- **Engine type** (what kind of data store it is)

## **Source Types (Engines)**

Remora supports the following source engines:

| Engine | Description | Use Cases |
| --- | --- | --- |
| `local` | Local file system | Development, testing, file-based data processing |
| `aws-s3` | Amazon S3 storage | Cloud object storage, data lakes, file archives |
| `aws-redshift` | Amazon Redshift data warehouse | SQL analytics, business intelligence, data warehousing |
| `postgres` | PostgreSQL server (RDS, Aurora, or self-hosted) | Operational databases, application data, SQL extraction |
| `delta-share` | Delta Share protocol | Data sharing across organizations, Databricks integration |
| `http-api` | REST / HTTP API endpoint | External services, SaaS integrations |
| `presigned-url` | A file reached through a URL signed on demand by an API | Reading from or writing to a bucket Remora holds no credentials for |
| `aws-sqs` | Amazon SQS queue | Queue-triggered consumer execution (see consumer QUEUE triggers) |

---

## **Authentication Methods**

The `authentication.method` field selects how Remora connects. The methods available depend on the engine:

| Method | Used by | Description |
| --- | --- | --- |
| `implicit` | `local` | No credentials — read/write a local path |
| `access-secret-key` | `aws-s3`, `aws-redshift`, `aws-sqs` | Static AWS access key + secret (optionally a session token) |
| `iam` | `aws-s3`, `aws-redshift`, `aws-sqs`, `postgres` | Use the AWS SDK default credential chain (EC2/ECS/EKS instance or task role, SSO, env vars) — no static keys stored. On `postgres` this signs a short-lived RDS IAM auth token instead of sending a password |
| `arn` | `aws-s3`, `aws-redshift`, `aws-sqs`, `postgres` | Assume an IAM role via STS (`roleArn`); base identity comes from the SDK default chain |
| `bearer-token` | `delta-share`, `http-api`, `presigned-url` | Static bearer token |
| `oidc` | `delta-share`, `presigned-url` | OAuth2 client-credentials grant (e.g. Okta/Cognito) that mints a short-lived token. This is what machine-to-machine (M2M) authentication on an API Gateway means |
| `api-key` | `http-api`, `presigned-url` | API key sent in a header |
| `username-password` | `http-api`, `postgres`, `presigned-url` | HTTP Basic authentication, or a database user and password |
| `none` | `http-api`, `presigned-url` | No authentication (public endpoints) |

> **Security tip:** never hard-code secrets. Reference environment variables with the `{ENV_VAR}` notation (e.g. `"accessKey": "{AWS_ACCESS_KEY_ID}"`), and prefer `iam`/`arn` over static keys on AWS.

---

## **Local Sources**

Local sources connect to files on your local file system or network-accessible directories.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "source-name",
  "engine": "local",
  "authentication": {
    "method": "implicit",
    "path": "/path/to/data/directory"
  },
  "_version": 1
}
```

### **Authentication Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `method` | ✅ | Must be `"implicit"` | `"implicit"` |
| `path` | ✅ | Directory path containing data files | `"./data"`, `"/Users/john/datasets"` |

### **Supported File Types**

Local sources can process:

- **JSON** files (`.json`)
- **JSON Lines** files (`.jsonl`, `.ndjson`)
- **CSV** files (`.csv`)
- **Text** files (`.txt`)
- **Excel** files (`.xlsx`, `.xls`)
- **XML** files (`.xml`)

## Supported compression type

Local sources can process:

- GZ files  (`'GZ'`)
- TAR files (`'TAR'`)
- ZIP files (`'ZIP'`)

### **Example Configurations**

**Development Data Source:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "local-dev",
  "description": "Local development data files",
  "engine": "local",
  "authentication": {
    "method": "implicit",
    "path": "./demo"
  },
  "_version": 1
}
```

**Output Destination:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "output-folder",
  "description": "Local directory for processed results",
  "engine": "local",
  "authentication": {
    "method": "implicit",
    "path": "./output"
  },
  "_version": 1
}
```

### **Best Practices**

- Use **relative paths** for portability across environments
- Ensure the path exists and has appropriate read/write permissions
- Use descriptive names that indicate the data purpose
- Consider file organization within the specified directory

---

## **AWS S3 Sources**

AWS S3 sources connect to Amazon Simple Storage Service buckets for cloud-based object storage.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "source-name",
  "engine": "aws-s3",
  "authentication": {
    "method": "access-secret-key",
    "region": "aws-region",
    "accessKey": "{AWS_ACCESS_KEY_ID}",
    "secretKey": "{AWS_SECRET_ACCESS_KEY}",
    "sessionToken": "{AWS_SESSION_TOKEN}",
    "bucket": "bucket-name"
  },
  "_version": 1
}
```

### **Authentication Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `method` | ✅ | `"access-secret-key"` for static keys, or `"iam"` / `"arn"` for IAM roles | `"access-secret-key"` |
| `region` | ✅ | AWS region where the bucket is located | `"us-east-1"`, `"eu-west-1"` |
| `accessKey` | ✅ | AWS Access Key ID (use environment variables) | `"{AWS_ACCESS_KEY_ID}"` |
| `secretKey` | ✅ | AWS Secret Access Key (use environment variables) | `"{AWS_SECRET_ACCESS_KEY}"` |
| `bucket` | ✅ | S3 bucket name | `"my-data-bucket"` |
| `sessionToken` | ❌ | AWS Session Token for temporary credentials | `"{AWS_SESSION_TOKEN}"` |

> `method` can also be `"iam"` or `"arn"` — see [IAM Role Authentication](#iam-role-authentication) below. With those, `accessKey`/`secretKey` are not required.

### **IAM Role Authentication**

Instead of static keys, AWS sources (`aws-s3`, `aws-redshift`, `aws-sqs`) can authenticate through IAM roles — the recommended approach for anything running on AWS:

- **`method: "iam"`** — use the AWS SDK default credential chain (EC2/ECS/EKS instance or task role, SSO, or `AWS_*` env vars). No keys are stored in the config.

  ```json
  {
    "authentication": {
      "method": "iam",
      "region": "us-east-1",
      "bucket": "company-data-lake"
    }
  }
  ```

- **`method: "arn"`** — assume a specific IAM role via STS. The base identity that performs the AssumeRole call still comes from the SDK default chain (no data-access keys in the config). Useful for cross-account access.

  | Property | Required | Description |
  | --- | --- | --- |
  | `roleArn` | ✅ | ARN of the role to assume, e.g. `arn:aws:iam::123456789012:role/remora-reader` |
  | `roleSessionName` | ❌ | Session name for the assumed credentials (defaults to `remora`) |
  | `externalId` | ❌ | STS ExternalId for third-party / cross-account trust policies |

  ```json
  {
    "authentication": {
      "method": "arn",
      "region": "eu-west-1",
      "bucket": "analytics-exports",
      "roleArn": "arn:aws:iam::123456789012:role/remora-s3-reader",
      "externalId": "{REMORA_STS_EXTERNAL_ID}"
    }
  }
  ```

### **Security Best Practices**

**Environment Variables (Recommended):**

```json
{
  "authentication": {
    "method": "access-secret-key",
    "region": "us-east-1",
    "accessKey": "{AWS_ACCESS_KEY_ID}",
    "secretKey": "{AWS_SECRET_ACCESS_KEY}",
    "sessionToken": "{AWS_SESSION_TOKEN}",
    "bucket": "my-data-bucket"
  }
}
```

Set these environment variables:

```bash
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_SESSION_TOKEN=your_session_token_here# Optional
```

### **IAM Permissions Required**

Your AWS credentials need the following S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### **Example Configurations**

**Data Lake Source:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "data-lake",
  "description": "Production data lake in S3",
  "engine": "aws-s3",
  "authentication": {
    "method": "access-secret-key",
    "region": "us-east-1",
    "accessKey": "{AWS_ACCESS_KEY_ID}",
    "secretKey": "{AWS_SECRET_ACCESS_KEY}",
    "bucket": "company-data-lake"
  },
  "_version": 1
}
```

**Archive Storage:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "archive-storage",
  "description": "Historical data archive",
  "engine": "aws-s3",
  "authentication": {
    "method": "access-secret-key",
    "region": "us-west-2",
    "accessKey": "{ARCHIVE_ACCESS_KEY}",
    "secretKey": "{ARCHIVE_SECRET_KEY}",
    "bucket": "historical-data-archive"
  },
  "_version": 1
}
```

### **Supported Operations**

- **Reading files** from S3 buckets
- **Writing processed results** back to S3
- **Listing objects** within bucket prefixes
- **Streaming large files** for memory-efficient processing

---

## **AWS Redshift Sources**

AWS Redshift sources connect to Amazon Redshift data warehouses for SQL-based analytics and data processing.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "source-name",
  "engine": "aws-redshift",
  "authentication": {
    "method": "access-secret-key",
    "region": "aws-region",
    "accessKey": "{AWS_ACCESS_KEY_ID}",
    "secretKey": "{AWS_SECRET_ACCESS_KEY}",
    "sessionToken": "{AWS_SESSION_TOKEN}",
    "database": "database-name",
    "workgroup": "workgroup-name"
  },
  "_version": 1
}
```

### **Authentication Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `method` | ✅ | `"access-secret-key"` for static keys, or `"iam"` / `"arn"` for IAM roles | `"access-secret-key"` |
| `region` | ✅ | AWS region where Redshift cluster is located | `"us-east-1"`, `"eu-west-1"` |
| `accessKey` | ✅ | AWS Access Key ID (use environment variables) | `"{AWS_ACCESS_KEY_ID}"` |
| `secretKey` | ✅ | AWS Secret Access Key (use environment variables) | `"{AWS_SECRET_ACCESS_KEY}"` |
| `database` | ✅ | Redshift database name | `"analytics_db"`, `"data_warehouse"` |
| `workgroup` | ✅ | Redshift workgroup name | `"primary"`, `"analytics-workgroup"` |
| `sessionToken` | ❌ | AWS Session Token for temporary credentials | `"{AWS_SESSION_TOKEN}"` |

### **IAM Permissions Required**

Your AWS credentials need the following Redshift permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "redshift-data:ExecuteStatement",
        "redshift-data:DescribeStatement",
        "redshift-data:GetStatementResult",
        "redshift-data:ListStatements"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "redshift-serverless:GetWorkgroup",
        "redshift-serverless:GetNamespace"
      ],
      "Resource": "*"
    }
  ]
}
```

### **Example Configurations**

**Analytics Data Warehouse:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "analytics-warehouse",
  "description": "Main analytics data warehouse",
  "engine": "aws-redshift",
  "authentication": {
    "method": "access-secret-key",
    "region": "us-east-1",
    "accessKey": "{REDSHIFT_ACCESS_KEY}",
    "secretKey": "{REDSHIFT_SECRET_KEY}",
    "database": "analytics_db",
    "workgroup": "analytics-workgroup"
  },
  "_version": 1
}
```

**Development Environment:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "dev-redshift",
  "description": "Development Redshift environment",
  "engine": "aws-redshift",
  "authentication": {
    "method": "access-secret-key",
    "region": "us-west-2",
    "accessKey": "{DEV_ACCESS_KEY}",
    "secretKey": "{DEV_SECRET_KEY}",
    "database": "dev_database",
    "workgroup": "dev-workgroup"
  },
  "_version": 1
}
```

### **How a run reads a table**

A producer on a Redshift source names its table with `sqlTable` and lists the columns it wants as
dimensions — there is no `fileKey` and no `fileType`. Remora builds the `SELECT` from those
dimensions (a dimension's `alias` is the column name when it differs from the dimension name), runs
it through the Redshift Data API, and stages the result as a local dataset file that the rest of the
pipeline reads. The staging read follows the Data API's `NextToken` pages to the end of the result
and compares what it staged against the row count the cluster reports, so a result larger than one
page can never come back short without an error.

```json
{
  "name": "p_customers",
  "source": "analytics-warehouse",
  "settings": { "sqlTable": "analytics.customers" },
  "dimensions": [
    { "name": "id", "type": "string", "pk": true },
    { "name": "firstName", "type": "string", "alias": "first_name" },
    { "name": "monthlySpend", "type": "number", "alias": "monthly_spend" }
  ],
  "_version": 1
}
```

`sqlTable` may be `table` or `schema.table`. An unqualified name falls back to the source's `schema`.

### **SQL Query Limitations**

- **Maximum query rows**: `SQL_MAX_QUERY_ROWS` (default `10000`) caps the ad-hoc reads behind
  `remora sample` and `remora discover`, which return rows in memory. It does **not** cap a run: a run
  stages the whole table a page at a time, bounded by disk rather than by this setting
- **Statement timeout**: a staging statement is polled for up to 30 minutes before it is abandoned
- **Concurrent queries**: Limited by Redshift workgroup configuration
- **Memory usage**: no page of the result is held once it has been written to the staged file

### **Performance Considerations**

- **Index usage** in underlying tables improves query performance
- **Workgroup sizing** affects concurrent query capacity
- Producers query the source directly; use the producer-level `direct: true` setting to signal read-only access (see the Producers guide)

> **IAM authentication:** Redshift sources can also use `method: "iam"` (or `"arn"`). In that case supply `host`, `clusterId`, `port`, and an `iamProfile` (or `roleArn` for `arn`) instead of static keys.

---

## **PostgreSQL Sources**

`postgres` sources read from a PostgreSQL server over the native wire protocol — Amazon RDS, Aurora
PostgreSQL, or a self-hosted instance. The engine is not named `aws-postgres` because nothing about
it requires AWS; the IAM auth token below is the only AWS-specific part, and it is optional.

Unlike Redshift, which is reached over an HTTPS API, a `postgres` source needs network reachability
to the database: a security group that admits the machine running remora, and a route to it (a VPC,
a peering connection or a VPN) when the database is not public.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "source-name",
  "engine": "postgres",
  "authentication": {
    "method": "username-password",
    "host": "{PG_HOST}",
    "port": "5432",
    "database": "analytics",
    "schema": "public",
    "user": "{PG_USER}",
    "password": "{PG_PASSWORD}",
    "sslMode": "require"
  },
  "_version": 1
}
```

### **Authentication Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `method` | ✅ | `"username-password"` for a password, or `"iam"` / `"arn"` for an RDS IAM auth token | `"username-password"` |
| `host` | ✅ | Hostname of the server or cluster endpoint | `"db.cluster-abc.eu-west-1.rds.amazonaws.com"` |
| `database` | ✅ | Database to connect to | `"analytics"` |
| `user` | ✅ | Database user | `"remora_reader"` |
| `password` | ⚠️ | Required unless the method signs an IAM token. Use the `{ENV_VAR}` notation | `"{PG_PASSWORD}"` |
| `region` | ⚠️ | Required when the method is `"iam"` or `"arn"`, to sign the token | `"eu-west-1"` |
| `roleArn` | ⚠️ | Required when the method is `"arn"` | `"arn:aws:iam::123456789012:role/remora-reader"` |
| `port` | ❌ | Defaults to `5432` | `"5432"` |
| `schema` | ❌ | Default schema for producers whose `sqlTable` is unqualified | `"public"` |
| `sslMode` | ❌ | `disable`, `require` (default for a remote host) or `verify-full` | `"require"` |
| `connectionTimeoutMs` | ❌ | Connection and handshake timeout in milliseconds, default `30000` | `10000` |

⚠️ = required depending on `method`. `remora verify` reports which of these is missing for the method the source declares.

### **TLS**

`sslMode` defaults to `require` for a remote host and `disable` for `localhost` / `127.0.0.1`, since
a database on the same machine usually speaks no TLS at all.

- `require` encrypts the connection but does not verify the server certificate. This is what RDS
  accepts with nothing else configured
- `verify-full` also verifies the certificate chain against the process trust store. Point
  `NODE_EXTRA_CA_CERTS` at the RDS CA bundle when you use it, or the handshake will fail

### **IAM authentication (RDS and Aurora)**

With `method: "iam"` there is no database password anywhere in the configuration: remora signs a
short-lived RDS auth token for each connection and sends that instead. The AWS credentials that sign
it come from the SDK default credential chain — an ECS task role, an EC2 instance role, SSO, or
environment variables — exactly as for every other AWS engine. Use `method: "arn"` with a `roleArn`
to sign it with an assumed role instead.

This requires IAM authentication to be enabled on the instance or cluster, a database user granted
`rds_iam`, and the following permission:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["rds-db:connect"],
      "Resource": "arn:aws:rds-db:eu-west-1:123456789012:dbuser:cluster-ABCDEFGH/remora_reader"
    }
  ]
}
```

### **Example — Aurora with IAM authentication**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "aurora-analytics",
  "description": "Aurora PostgreSQL read replica, no stored password",
  "engine": "postgres",
  "authentication": {
    "method": "iam",
    "host": "analytics.cluster-ro-abc123.eu-west-1.rds.amazonaws.com",
    "port": "5432",
    "database": "analytics",
    "schema": "public",
    "user": "remora_reader",
    "region": "eu-west-1",
    "sslMode": "require"
  },
  "_version": 1
}
```

### **How a run reads a table**

Exactly as for Redshift: the producer names its table with `sqlTable` and its columns as dimensions,
and remora builds the `SELECT` and stages the result as a local dataset file. The read goes through a
server-side cursor inside a `READ ONLY` transaction, pulling 10 000 rows per round trip and writing
each batch to disk before asking for the next, so staging a large table costs disk and not memory.

### **Performance Considerations**

- The staging query is a plain `SELECT` of the producer's columns. Narrow the producer's dimensions
  rather than selecting columns the consumer discards
- Point the source at a **read replica** where one exists: a full-table read competes with the
  primary's operational traffic
- Filters and limits are not yet pushed into the `WHERE` / `LIMIT` of the staging query, so the whole
  table is read and narrowed by the pipeline

---

## **Delta Share Sources**

Delta Share sources connect to Delta Share endpoints for secure data sharing across organizations and platforms.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "source-name",
  "engine": "delta-share",
  "authentication": {
    "method": "bearer-token",
    "host": "https://sharing-endpoint.com/api/2.0/delta-sharing/metastores/...",
    "bearerToken": "{DELTA_TOKEN}",
    "share": "share-name",
    "schema": "schema-name",
    "table": "table-name"
  },
  "_version": 1
}
```

### **Authentication Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `method` | ✅ | `"bearer-token"` for a static token, or `"oidc"` for OAuth2 client-credentials | `"bearer-token"` |
| `host` | ✅ | Delta Share endpoint URL | `"https://oregon.cloud.databricks.com/api/2.0/delta-sharing/metastores/..."` |
| `bearerToken` | ✅ | Delta Share authentication token | `"{DELTA_TOKEN}"` |
| `share` | ✅ | Share name in Delta Share | `"analytics_share"`, `"customer_data"` |
| `schema` | ✅ | Schema within the share | `"default"`, `"production"` |
| `table` | ✅ | Table name within the schema | `"customer_orders"`, `"product_catalog"` |

### **OIDC Authentication**

Instead of a static `bearerToken`, Delta Share sources can use `method: "oidc"` to obtain a short-lived token via the OAuth2 client-credentials grant (e.g. Okta or Cognito). Remora fetches and refreshes the token automatically.

| Property | Required | Description |
| --- | --- | --- |
| `tokenEndpoint` | ✅ | OAuth2 token endpoint that issues the access token |
| `clientId` | ✅ | OAuth2 client identifier |
| `clientSecret` | ✅ | OAuth2 client secret |
| `scope` | ❌ | Space-delimited scopes (required by Okta/Cognito for client-credentials) |
| `audience` | ❌ | Audience/resource parameter for IdPs that require it |
| `clientAuthMethod` | ❌ | How client credentials are sent: `"basic"` (default) or `"post"` (request body) |

```json
{
  "engine": "delta-share",
  "authentication": {
    "method": "oidc",
    "host": "https://sharing.example.com/delta-sharing",
    "share": "my_share",
    "schema": "my_schema",
    "table": "my_table",
    "tokenEndpoint": "https://example.okta.com/oauth2/default/v1/token",
    "clientId": "{DELTA_SHARE_CLIENT_ID}",
    "clientSecret": "{DELTA_SHARE_CLIENT_SECRET}",
    "scope": "delta_sharing"
  }
}
```


### **Security Configuration**

**Environment Variables (Recommended):**

```json
{
  "authentication": {
    "method": "bearer-token",
    "host": "https://oregon.cloud.databricks.com/api/2.0/delta-sharing/metastores/f53bde37-1e8b-4668-a1e4-e62333110018",
    "bearerToken": "{DELTA_TOKEN}",
    "share": "analytics_share",
    "schema": "default",
    "table": "customer_data"
  }
}
```

Set the environment variable:

```bash
export DELTA_TOKEN=your_delta_share_token_here
```

### **Example Configurations**

**External Data Share:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "partner-data",
  "description": "Shared data from business partner",
  "engine": "delta-share",
  "authentication": {
    "method": "bearer-token",
    "host": "https://partner.cloud.databricks.com/api/2.0/delta-sharing/metastores/abc123-def4-5678-90ab-cdef12345678",
    "bearerToken": "{PARTNER_DELTA_TOKEN}",
    "share": "customer_insights",
    "schema": "public",
    "table": "demographic_data"
  },
  "_version": 1
}
```

**Internal Data Sharing:**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "internal-analytics",
  "description": "Internal analytics data via Delta Share",
  "engine": "delta-share",
  "authentication": {
    "method": "bearer-token",
    "host": "https://oregon.cloud.databricks.com/api/2.0/delta-sharing/metastores/internal-metastore-id",
    "bearerToken": "{INTERNAL_DELTA_TOKEN}",
    "share": "company_analytics",
    "schema": "processed",
    "table": "quarterly_metrics"
  },
  "_version": 1
}
```

### **Delta Share Features**

- **Version control**: Access to historical versions of shared data
- **Incremental updates**: Efficient processing of data changes
- **Schema evolution**: Automatic handling of schema changes
- **Access control**: Token-based security with fine-grained permissions

---

## **HTTP API Sources**

HTTP API sources read data from a REST endpoint. The source holds the base `url` and connection settings; a producer using this source sets `fileKey` to the endpoint path and `fileType` to the response format (see the Producers guide).

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "rest-api",
  "engine": "http-api",
  "authentication": {
    "method": "bearer-token",
    "url": "https://api.example.com",
    "bearerToken": "{API_BEARER_TOKEN}",
    "headers": { "Accept": "application/json" },
    "timeout": 30000
  },
  "_version": 1
}
```

### **Authentication Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `method` | ✅ | `"none"`, `"api-key"`, `"bearer-token"`, or `"username-password"` (HTTP Basic) | `"bearer-token"` |
| `url` | ✅ | Base URL of the API | `"https://api.example.com"` |
| `headers` | ❌ | Custom headers sent with every request | `{ "Accept": "application/json" }` |
| `queryParams` | ❌ | Default query parameters sent with every request | `{ "version": "2" }` |
| `httpMethod` | ❌ | HTTP method (default `GET`) | `"GET"`, `"POST"` |
| `timeout` | ❌ | Request timeout in milliseconds (default `30000`) | `30000` |
| `bearerToken` | ❌ | Token for `bearer-token` | `"{API_BEARER_TOKEN}"` |
| `apiKey` | ❌ | Key for `api-key` | `"{API_KEY}"` |
| `apiKeyHeader` | ❌ | Header name for the API key (default `X-API-Key`) | `"X-API-Key"` |
| `user` / `password` | ❌ | Credentials for `username-password` (HTTP Basic) | `"{API_USER}"` / `"{API_PASSWORD}"` |

### **Example — API-key authentication**

```json
{
  "engine": "http-api",
  "authentication": {
    "method": "api-key",
    "url": "https://api.example.com",
    "apiKey": "{SERVICE_API_KEY}",
    "apiKeyHeader": "X-API-Key",
    "headers": { "Accept": "application/json" }
  }
}
```

### **Example — Public API (no auth)**

```json
{
  "engine": "http-api",
  "authentication": {
    "method": "none",
    "url": "https://api.publicapis.org",
    "httpMethod": "GET"
  }
}
```

---

## **Presigned URL Sources**

Use this engine when the bucket is reachable only through a URL that something else signs: an API — typically a Lambda behind API Gateway — mints a presigned URL for one file, and Remora transfers against it. Remora needs no AWS credentials at all, because a signed URL authenticates itself.

It works in both directions. Referenced by a producer it **downloads**; referenced as a consumer output's `exportDestination` it **uploads**.

### **How it works**

Every transfer is two calls:

1. **Mint** — Remora calls your endpoint with the file name and reads the signed URL out of the JSON response.
2. **Transfer** — Remora GETs or PUTs that URL directly. No credentials are sent; the signature in the query string is the authentication.

The URL is minted immediately before each transfer, per file. That is deliberate: a URL in a config file would expire, and would address only one object — but a consumer that splits its output (`split.maxFileSizeGb`, or `split.by`) writes several files, and each gets its own URL.

### **Configuration Schema**

```json
{
    "name": "partner_upload",
    "engine": "presigned-url",
    "authentication": {
        "method": "oidc",
        "url": "https://api.example.com/v1/uploads/presign",
        "httpMethod": "POST",
        "fileNameParam": "filename",
        "signedUrlField": "uploadUrl",
        "tokenEndpoint": "https://example.auth.eu-west-1.amazoncognito.com/oauth2/token",
        "clientId": "{PRESIGN_CLIENT_ID}",
        "clientSecret": "{PRESIGN_CLIENT_SECRET}",
        "scope": "uploads/write"
    },
    "_version": 1
}
```

### **Authentication Properties**

Everything here configures the **mint call only**. The signed URL that comes back is transferred unauthenticated.

| Property | Required | Description |
| --- | --- | --- |
| `method` | Yes | How to authenticate to the minting endpoint: `oidc`, `bearer-token`, `api-key`, `username-password` or `none` |
| `url` | Yes | The minting endpoint |
| `httpMethod` | No | Method for the mint call. Defaults to `POST` |
| `fileNameParam` | No | Field carrying the file name — in the JSON body on `POST`/`PUT`/`PATCH`, as a query parameter otherwise. Defaults to `filename` |
| `signedUrlField` | No | Dot path to the URL in the response, e.g. `data.uploadUrl`. Defaults to `url` |
| `signedHeadersField` | No | Dot path to an object of headers in the response. Set it when your minter signs headers (see below) |
| `signedUrlMethod` | No | Method used against the signed URL. Defaults to `GET` when reading and `PUT` when exporting |
| `headers`, `queryParams`, `timeout` | No | Sent with the mint call, as for `http-api` |

An M2M-protected API Gateway is the `oidc` method: set `tokenEndpoint`, `clientId`, `clientSecret` and `scope`, and the token is cached and refreshed shortly before it expires rather than fetched per file.

### **What your endpoint must return**

A JSON response holding the URL. Anything else in it is ignored:

```json
{ "uploadUrl": "https://bucket.s3.eu-west-1.amazonaws.com/exports/report.csv?X-Amz-Signature=..." }
```

If the signature covers headers — a `Content-Type`, any `x-amz-*` — return them too and point `signedHeadersField` at them, because they must be sent back verbatim or S3 answers `403 SignatureDoesNotMatch`:

```json
{ "uploadUrl": "https://...", "headers": { "content-type": "text/csv" } }
```

### **Example — reading a file**

```json
{
    "name": "partner_download",
    "engine": "presigned-url",
    "authentication": {
        "method": "api-key",
        "url": "https://api.example.com/v1/downloads/presign",
        "httpMethod": "GET",
        "apiKey": "{PRESIGN_API_KEY}",
        "apiKeyHeader": "x-api-key",
        "fileNameParam": "key",
        "signedUrlField": "data.url"
    },
    "_version": 1
}
```

The producer's `settings.fileKey` is the name sent to the minting endpoint. All the usual file types and compression apply — the file is staged locally and parsed exactly as one from S3 or disk.

### **Limits**

- **One file per name, no patterns.** A `%` pattern in `fileKey` is refused: the minting endpoint signs one named object and Remora cannot list the others. Use `aws-s3` or `local` when you need a pattern.
- **5 GB per object.** A signed `PUT` is a single request, which is S3's limit for one. Set the consumer's `split.maxFileSizeGb` below 5 and the normal rotation ships larger exports as several objects, each with its own URL. Exceeding 5 GB in a *single* object would need presigned multipart, which your endpoint would have to implement as three separate operations.
- **No resume.** A dropped connection restarts the file, so prefer a smaller `split.maxFileSizeGb` here than you would on `aws-s3`, which uploads in 5 MB parts.
- **No connection test at startup.** Unlike `http-api`, this engine does not probe on `init`: minting is not a free health check, since each call leaves a live signed URL behind. The first real transfer is the test.

---

## **AWS SQS Sources**

SQS sources point at an Amazon SQS queue. They are used to drive consumers from queue messages (see consumer **QUEUE triggers**) rather than to extract producer data.

### **Configuration Schema**

```json
{
  "$schema": "https://raw.githubusercontent.com/ForzaLabs/remora-public/refs/heads/main/json_schemas/source-schema.json",
  "name": "execute-queue",
  "engine": "aws-sqs",
  "authentication": {
    "method": "access-secret-key",
    "queue": "remora-execute-consumer",
    "accountId": "{AWS_ACCOUNT_ID}",
    "region": "us-east-1",
    "accessKey": "{AWS_ACCESS_KEY_ID}",
    "secretKey": "{AWS_SECRET_ACCESS_KEY}"
  },
  "_version": 1
}
```

### **Authentication Properties**

| Property | Required | Description | Example |
| --- | --- | --- | --- |
| `method` | ✅ | `"access-secret-key"`, `"iam"`, or `"arn"` | `"access-secret-key"` |
| `queue` | ✅ | Queue URL, or queue name (combined with `accountId` + `region`) | `"remora-execute-consumer"` |
| `region` | ✅ | AWS region of the queue | `"us-east-1"` |
| `accountId` | ❌ | AWS account ID, used to build the queue URL from a queue name | `"{AWS_ACCOUNT_ID}"` |
| `accessKey` / `secretKey` | ❌ | Static credentials (for `access-secret-key`) | `"{AWS_ACCESS_KEY_ID}"` |
| `roleArn` | ❌ | Role to assume for `arn` (see [IAM Role Authentication](#iam-role-authentication)) | `"arn:aws:iam::...:role/remora-sqs"` |

### **As the execute-consumer API queue**

Pointing the project's `API_QUEUE` setting at an SQS source turns that queue into an alternative to
the HTTP execute-consumer API: each message names a consumer to run.

A message may also carry an `options` object asking the run for extra filters and a record limit,
on the same terms as the HTTP API — see
[Run Options](Remora%20-%20Consumers.md) under the consumer's data filtering. The options are
checked against the named consumer before the run reads anything, and a command carrying an invalid
one fails without executing.

```json
{
  "settings": {
    "SQL_MAX_QUERY_ROWS": 10000,
    "API_QUEUE": {
      "source": "execute-queue",
      "deadLetterQueue": "remora-execute-consumer-dlq"
    }
  }
}
```

| Property | Required | Description |
| --- | --- | --- |
| `source` | ✅ | Name of the `aws-sqs` source to poll |
| `deadLetterQueue` | ❌ | Queue URL, or queue name resolved against the source's `region` and `accountId`. A failed command is moved here instead of being deleted, so it can be inspected and replayed |

### **Failed commands**

Each message on this queue is a **command**: it asks for one consumer run. So it is removed from the
queue once it has run, whether the run succeeded or failed — a redelivery would be a second
execution, not a resumption of the first, and the usual failures here (a consumer that no longer
exists, a malformed payload, a source that is down) are not ones another delivery fixes.

That is the opposite of a consumer `QUEUE` trigger, where a failed message *is* retried — see
[Failed messages](Remora%20-%20Consumers.md) under the consumer QUEUE triggers. There is therefore no
delivery count to bound here, only a destination: with `deadLetterQueue` set, a failed command is
copied there (carrying `remoraSourceQueue`, `remoraSourceMessageId` and `remoraReceiveCount` as
message attributes) and then deleted; without one, it is deleted outright and the only trace is the
worker's log. Configuring one is worth it for anything that has to be diagnosed or replayed.

---


## **Common Configuration Patterns**

### **Environment Variable Usage**

**Recommended Pattern:**

```json
{
  "authentication": {
    "accessKey": "{AWS_ACCESS_KEY_ID}",
    "secretKey": "{AWS_SECRET_ACCESS_KEY}",
    "sessionToken": "{AWS_SESSION_TOKEN}"
  }
}
```

**Environment Setup:**

```bash
# AWS Credentialsexport AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=wJa...
export AWS_SESSION_TOKEN=IQoJ...

# Delta Shareexport DELTA_TOKEN=dapi...

# Custom Variablesexport PROD_DATABASE_HOST=prod-db.company.com
export DEV_BUCKET_NAME=dev-data-bucket
```

### **Multi-Environment Configuration**

**Development:**

```json
{
  "name": "dev-data",
  "description": "Development environment data source",
  "engine": "local",
  "authentication": {
    "method": "implicit",
    "path": "./dev-data"
  }
}
```

**Staging:**

```json
{
  "name": "staging-s3",
  "description": "Staging environment S3 bucket",
  "engine": "aws-s3",
  "authentication": {
    "method": "access-secret-key",
    "region": "us-east-1",
    "accessKey": "{STAGING_ACCESS_KEY}",
    "secretKey": "{STAGING_SECRET_KEY}",
    "bucket": "staging-data-bucket"
  }
}
```

**Production:**

```json
{
  "name": "prod-warehouse",
  "description": "Production data warehouse",
  "engine": "aws-redshift",
  "authentication": {
    "method": "access-secret-key",
    "region": "us-east-1",
    "accessKey": "{PROD_ACCESS_KEY}",
    "secretKey": "{PROD_SECRET_KEY}",
    "database": "production_db",
    "workgroup": "production-workgroup"
  }
}
```

---

## **Validation and Testing**

### **Configuration Validation**

Use the Remora CLI to validate your source configurations:

```bash
# Compile & validate every resource configuration in the project
# (includes source checks, e.g. required AWS credential fields per method)
remora compile
```

### **Connection Testing**

There is no standalone source-connectivity command. To exercise a source end-to-end, run a producer that uses it and inspect the extracted rows:

```bash
# Read a few records through a producer that uses the source
remora sample my-producer -s 10
```

If the source is misconfigured (bad credentials, missing bucket, expired token, …) the command fails with the underlying connection error.

### **Common Validation Errors**

| Error | Cause | Solution |
| --- | --- | --- |
| `Invalid AWS credentials` | Wrong access keys | Check environment variables |
| `Bucket not found` | Incorrect bucket name | Verify bucket exists and region |
| `Permission denied` | Insufficient IAM permissions | Review and update IAM policies |
| `Invalid workgroup` | Wrong Redshift workgroup | Check workgroup name and region |
| `Invalid token` | Expired Delta Share token | Refresh authentication token |

---

## **Performance Optimization**

### **Memory Management**

- **File Processing**: Large files are streamed to minimize memory usage
- **Query Results**: Limited by `SQL_MAX_QUERY_ROWS` setting
- **Parallel Processing**: Remora automatically multithread large file for computing optimization

### **Connection Pooling**

- **Reuse connections** across multiple operations
- **Connection warming** during initialization
- **Automatic retry** for transient failures

### **Best Practices**

1. **Use appropriate source types** for your data storage pattern
2. **Configure memory limits** based on available system resources
3. **Implement proper error handling** in your data pipelines
4. **Monitor connection health** in production environments
5. **Use environment variables** for sensitive configuration values

---

## **Troubleshooting**

### **Common Issues**

**Connection Timeouts:**

- Increase `DEFAULT_TIMEOUT_SECONDS` in project configuration
- Check network connectivity to source systems
- Verify firewall and security group settings

**Authentication Failures:**

- Verify environment variables are set correctly
- Check IAM permissions for AWS sources
- Ensure tokens are not expired for Delta Share

**File Not Found Errors:**

- Verify file paths exist for local sources
- Check S3 object keys and bucket permissions
- Ensure proper case sensitivity in file names

### **Debug Mode**

Enable debug logging in your project configuration:

```json
{
  "settings": {
    "LOG_LEVEL": "DEBUG",
    "DEBUG_MODE": true}
}

```

### **Support Resources**

- **Schema Validation**: All configurations are validated against JSON schemas
- **CLI Help**: Run `remora --help` for command documentation
- **Error Messages**: Include specific guidance for resolution
- **Connection errors**: Run a producer with `remora sample <producer>` to surface source connection issues

---