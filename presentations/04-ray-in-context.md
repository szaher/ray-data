---
marp: true
theme: ray-academy
paginate: true
header: 'Ray Data Academy'
footer: 'Session 4: Ray Data in Context'
---

<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: "base", themeVariables: { primaryColor: "#e0f0ff", primaryTextColor: "#151515", primaryBorderColor: "#0066cc", lineColor: "#0066cc", secondaryColor: "#daf2f2", tertiaryColor: "#f2f2f2", noteBkgColor: "#fef0f0", noteTextColor: "#151515", fontFamily: "Red Hat Text, sans-serif" }});
</script>


<!-- _class: lead -->

# Ray Data in Context

## Spark, Operations, and Ecosystem

Ray Data Academy -- Session 4 of 4

<!-- This is the capstone session. We tie everything together: how Ray Data compares to Spark, how to operate it in production, the ecosystem around it, and a reference you can take home. -->

---

<!-- _class: section-divider -->

# Part I
# Ray vs Spark: Architecture

Two frameworks, different origins, different tradeoffs.

---

## Two frameworks, different origins

| | Apache Spark | Ray |
|---|---|---|
| **Born** | 2009, UC Berkeley AMPLab | 2017, UC Berkeley RISELab |
| **Original goal** | Large-scale data processing (MapReduce done right) | Distributed Python apps (RL and ML) |
| **Runtime** | JVM (Scala/Java) | Python-native |
| **Sweet spot** | SQL analytics, batch ETL | ML pipelines, GPU workloads |

Both follow a **driver-worker** pattern, but the internals diverge sharply.

<!-- Spark was built for data engineers writing SQL and Scala. Ray was built for ML researchers writing Python. Their architectures reflect these origins. -->

---

## Spark architecture

<div class="mermaid">
graph TD
    subgraph "Apache Spark"
        SD[Spark Driver] --> SC[SparkContext]
        SC --> CM["Cluster Manager\nYARN / Mesos / K8s"]
        CM --> E1["Executor 1\nJVM Process"]
        CM --> E2["Executor 2\nJVM Process"]
        CM --> E3["Executor 3\nJVM Process"]
        E1 --> T1[Task] & T2[Task]
        E2 --> T3[Task] & T4[Task]
        E3 --> T5[Task] & T6[Task]
    end
</div>

- Driver creates SparkContext, talks to a cluster manager
- Executors are **JVM processes** running tasks as threads
- PySpark adds overhead: data crosses a JVM-to-Python bridge via sockets

<!-- Every Python UDF in Spark has to serialize data from the JVM to a Python subprocess and back. That bridge is the tax you pay. -->

---

## Ray architecture

<div class="mermaid">
graph TD
    subgraph "Ray"
        RD[Ray Driver] --> GCS[Global Control Store]
        GCS --> R1[Raylet Node 1]
        GCS --> R2[Raylet Node 2]
        GCS --> R3[Raylet Node 3]
        R1 --> W1[Worker 1 Python] & W2[Worker 2 Python]
        R2 --> W3[Worker 3 Python] & W4[Worker 4 Python]
        R3 --> W5[Worker 5 Python] & W6[Worker 6 Python]
        R1 --> OS1[Object Store]
        R2 --> OS2[Object Store]
        R3 --> OS3[Object Store]
    end
</div>

- GCS coordinates raylets (one per node)
- Workers are **native Python processes** -- no JVM in the path
- Each node has a shared-memory **object store** (Arrow/Plasma)

<!-- No JVM means no GC pauses, no serialization bridge for Python code. Your UDF runs directly in the worker process. -->

---

## JVM vs Python: memory models

<div class="mermaid">
graph TD
    subgraph "Spark Executor Memory"
        JH[JVM Heap] --> EM["Execution Memory\nShuffles, Joins"]
        JH --> SM["Storage Memory\nCached DataFrames"]
        JH --> UM["User Memory\nUDFs, Metadata"]
        OH[Off-Heap Tungsten] --> JH
        PY[Python Subprocess] ---|"Arrow\nserialization"| JH
    end
    subgraph "Ray Worker Memory"
        OS["Shared Object Store\nApache Arrow"]
        WP1[Worker 1] ---|"mmap\nzero-copy"| OS
        WP2[Worker 2] ---|"mmap\nzero-copy"| OS
        WP3[Worker 3] ---|"mmap\nzero-copy"| OS
    end
</div>

<!-- Spark divides JVM heap into execution, storage, and user memory, plus off-heap Tungsten. Ray uses a flat shared-memory store with zero-copy reads. -->

---

## Memory model: key differences

| Aspect | Spark | Ray Data |
|---|---|---|
| **Data format** | JVM objects / Tungsten binary | Arrow columnar (native) |
| **Cross-worker sharing** | Serialize between JVM heaps | mmap zero-copy on same node |
| **GC pressure** | Yes -- full GC stalls all threads | None -- reference counting |
| **Python UDF cost** | Arrow serialization across JVM bridge | Direct -- runs in-process |
| **Configurable regions** | Execution, storage, off-heap | Object store (30% RAM default) |

> For SQL-heavy batch analytics, Spark's JVM overhead is negligible.
> For Python-heavy ML pipelines, the overhead compounds fast.

---

## Execution models: stages vs streaming

<div class="mermaid">
graph LR
    subgraph "Spark: Stage-Based DAG"
        S1[Stage 1 Map] -->|"shuffle barrier"| S2[Stage 2 Reduce]
        S2 -->|"shuffle barrier"| S3[Stage 3 Final Agg]
    end
    subgraph "Ray: Streaming Task Graph"
        T1[Read Block 1] --> T3[Map Block 1] --> T5[Write Block 1]
        T2[Read Block 2] --> T4[Map Block 2] --> T6[Write Block 2]
    end
</div>

**Spark**: Catalyst optimizer produces stages. All tasks in a stage must finish before the next begins.

**Ray Data**: Blocks stream through operators. Block 1 can be written while Block 2 is still being read. No global barriers unless you force materialization.

<!-- This is the deepest architectural difference. Spark's barriers simplify fault tolerance but add latency and force materialization. Ray's streaming keeps memory low. -->

---

## The optimizer question

**Spark Catalyst** -- arguably Spark's greatest achievement:
- Predicate pushdown, column pruning, join reordering
- Constant folding, code generation
- Handles naive queries gracefully

**Ray Data** -- no general-purpose optimizer:
- Basic operator fusion (adjacent maps)
- Read-compute overlap
- **You** optimize the pipeline

> Spark says: *"Tell me what you want, I will figure out how."*
> Ray says: *"Tell me what to do, I will run it efficiently."*

<!-- This is a genuine tradeoff. If your team writes sloppy queries, Catalyst saves you. If your team writes deliberate pipelines, Ray's transparency is an advantage. -->

---

## When JVM overhead matters

Three places the JVM tax shows up:

1. **Startup**: JVM init adds 5-15 seconds. Ray workers start in <1 second.
2. **GC pauses**: Large heaps trigger full GC that stalls all executor threads. Ray uses reference counting -- no pauses.
3. **Python interop**: PySpark routes every Python UDF through a serialize-deserialize bridge. Ray runs your function directly.

For a pipeline that runs a PyTorch model on every batch of images, these costs compound at every step.

---

<!-- _class: section-divider -->

# Part II
# API Comparison

The same operations, side by side.

---

## Reading data: Spark vs Ray

```python
# PySpark
spark = SparkSession.builder.appName("ex").getOrCreate()
df = spark.read.parquet("s3://bucket/data.parquet")
csv_df = spark.read.csv("s3://bucket/data.csv",
                         header=True, inferSchema=True)
```

```python
# Ray Data
import ray
ray.init()
ds = ray.data.read_parquet("s3://bucket/data.parquet")
csv_ds = ray.data.read_csv("s3://bucket/data.csv")
```

Spark supports explicit schema enforcement with `StructType`. Ray Data relies on Arrow inference and column projection at read time.

---

## Filtering rows

```python
# PySpark -- Column expressions, Catalyst can push down
filtered = df.filter(col("age") > 30)
filtered = df.filter("age > 30 AND city = 'NYC'")
```

```python
# Ray Data -- Python callable, opaque to optimizer
filtered = ds.filter(
    lambda row: row["age"] > 30 and row["city"] == "NYC"
)
# Batch filter for better performance
filtered = ds.map_batches(
    lambda b: b[(b["age"] > 30) & (b["city"] == "NYC")],
    batch_format="pandas",
)
```

Spark's filter expressions enable predicate pushdown into Parquet readers. Ray Data reads all data first, then filters in Python.

---

## Map / transform

```python
# PySpark -- built-in expressions + UDFs
result = df.withColumn("tier",
    when(col("age") < 18, "minor")
    .when(col("age") < 65, "adult")
    .otherwise("senior"))
```

```python
# Ray Data -- map_batches with Pandas (preferred)
def categorize(batch):
    batch["tier"] = "bronze"
    batch.loc[batch["spend"] > 100, "tier"] = "silver"
    batch.loc[batch["spend"] > 1000, "tier"] = "gold"
    return batch
result = ds.map_batches(categorize, batch_format="pandas")
```

Spark distinguishes built-in functions (fast, JVM) from UDFs (slow, bridge). Ray Data: everything is Python, no bridge.

---

## GroupBy / aggregate

```python
# PySpark -- rich built-in library + SQL
result = df.groupBy("city").agg(
    count("*").alias("total"),
    avg("age").alias("avg_age"),
    sum("salary").alias("total_salary"))
```

```python
# Ray Data -- core aggregations
from ray.data.aggregate import Count, Mean, Sum, Max
result = ds.groupby("city").aggregate(
    Count(), Mean("age"), Sum("salary"), Max("age"))
```

Spark has dozens of built-in aggregations + HAVING, ROLLUP, CUBE. Ray Data covers the basics and offers `AggregateFn` for custom logic. For complex analytics, Spark wins here.

---

## Joins: Spark dominates

```python
# PySpark -- full join support
joined = employees.join(departments, "dept_id", "left")
joined = employees.join(broadcast(departments), "dept_id")
```

```python
# Ray Data -- manual broadcast-style lookup
dept_lookup = {r["id"]: r for r in dept_ds.iter_rows()}
dept_ref = ray.put(dept_lookup)
def join_dept(batch):
    lookup = ray.get(dept_ref)
    batch["dept_name"] = batch["dept_id"].map(
        lambda d: lookup.get(d, {}).get("name", "?"))
    return batch
result = ds.map_batches(join_dept, batch_format="pandas")
```

Spark supports inner, outer, left, right, cross, semi, anti joins with automatic broadcast. Ray Data joins are minimal. For complex joins, use Spark or pre-join your data.

<!-- This is where the "use the right tool" message really hits home. -->

---

## API philosophy summary

<div class="mermaid">
graph LR
    subgraph "PySpark"
        D1[DataFrame API] --> O1[Catalyst Optimizer]
        O1 --> P1[Optimized JVM Plan]
        S1[SQL Queries] --> O1
    end
    subgraph "Ray Data"
        D2[Dataset API] --> F1[Python Functions]
        F1 --> P2[Streaming Task Graph]
    end
</div>

| | PySpark | Ray Data |
|---|---|---|
| **Model** | Declarative | Functional |
| **Optimizer** | Catalyst (automatic) | Manual |
| **SQL** | Full support | None |
| **Joins** | Rich | Minimal |
| **Python UDFs** | Slow (JVM bridge) | Fast (native) |

---

## When to pick Spark vs Ray Data

| Factor | Pick Spark | Pick Ray Data |
|---|---|---|
| **Primary workload** | SQL, complex joins, aggregations | Python transforms, ML inference |
| **GPU needs** | Not required | Critical |
| **Data governance** | Delta Lake, Iceberg, ACLs | Not the focus |
| **Team expertise** | SQL / Scala / Java | Python / ML |
| **Optimizer** | Need Catalyst for naive queries | Willing to optimize manually |
| **Memory model** | Can tolerate JVM/GC | Want zero-copy, no GC |
| **Ecosystem** | JDBC, Kafka, Snowflake connectors | Ray Train, Serve, Tune |
| **Scale** | Petabyte shuffles | Streaming map pipelines |

<!-- Print this table. Stick it on your wall. -->

---

<!-- _class: section-divider -->

# Part III
# Migration & RayDP

From Spark to Ray -- and running both together.

---

## Concept mapping: Spark to Ray Data

| Spark | Ray Data | Notes |
|---|---|---|
| `SparkSession` | `ray.init()` | No session object in Ray |
| `DataFrame` | `Dataset` | Both are distributed row collections |
| RDD Partition | Block | Block = Arrow table or Pandas chunk |
| Executor | Worker | Python process, not JVM |
| `broadcast()` | `ray.put()` | Shared-memory object store |
| Spark UDF | `map` / `map_batches` | No registration needed |
| Catalyst | *(none)* | You optimize manually |
| `cache()` | `materialize()` | Forces execution, stores results |
| Spark SQL | *(none)* | Use functional API |

---

## Migration pattern: read-transform-write

```python
# Spark
df = spark.read.parquet("s3://bucket/raw/")
result = (df.filter(col("status") == "active")
    .withColumn("email", lower(trim(col("email"))))
    .select("user_id", "email", "spend"))
result.write.parquet("s3://bucket/out/", mode="overwrite")
```

```python
# Ray Data
def transform(batch):
    batch = batch[batch["status"] == "active"]
    batch["email"] = batch["email"].str.lower().str.strip()
    return batch[["user_id", "email", "spend"]]
ds = ray.data.read_parquet("s3://bucket/raw/")
ds.map_batches(transform, batch_format="pandas") \
  .write_parquet("s3://bucket/out/")
```

Spark gets predicate pushdown on the `status` filter. Ray reads everything, then filters in Python.

---

## Migration pattern: broadcast to ray.put()

```python
# Spark
lookup = {"US": "United States", "UK": "United Kingdom"}
bc = spark.sparkContext.broadcast(lookup)
@udf(returnType=StringType())
def expand(code):
    return bc.value.get(code, code)
result = df.withColumn("country", expand(col("code")))
```

```python
# Ray Data
lookup = {"US": "United States", "UK": "United Kingdom"}
lookup_ref = ray.put(lookup)  # -> shared object store
def expand(batch):
    lk = ray.get(lookup_ref)  # zero-copy on same node
    batch["country"] = batch["code"].map(
        lambda c: lk.get(c, c))
    return batch
result = ds.map_batches(expand, batch_format="pandas")
```

---

## Migration decision flowchart

<div class="mermaid">
graph TD
    START[Spark Pipeline] --> Q1{Heavy SQL / Joins?}
    Q1 -->|Yes| Q2{Can rewrite in Python?}
    Q1 -->|No| Q3{Python UDFs dominant?}
    Q2 -->|Yes| MIGRATE[Migrate to Ray Data]
    Q2 -->|No| HYBRID["Keep SQL in Spark\nML in Ray Data"]
    Q3 -->|Yes| Q4{GPU needed?}
    Q3 -->|No| KEEP[Keep in Spark]
    Q4 -->|Yes| MIGRATE
    Q4 -->|No| Q5{ML integration?}
    Q5 -->|Yes| MIGRATE
    Q5 -->|No| BENCHMARK[Benchmark both]
    HYBRID --> BRIDGE["Bridge via Parquet\nor RayDP"]
</div>

<!-- Walk through this with the audience. Most real pipelines end up at "hybrid." -->

---

## RayDP: Spark on Ray

**RayDP** runs Spark executors as Ray actors on a Ray cluster. One cluster, both engines.

```python
import ray, raydp
ray.init()
spark = raydp.init_spark(
    app_name="spark_on_ray",
    num_executors=4,
    executor_cores=4,
    executor_memory="8g",
)
# Full SparkSession -- SQL, joins, Catalyst, everything
result = spark.sql("SELECT city, COUNT(*) FROM t GROUP BY city")
```

You get a real `SparkSession`. Same API, same optimizer. Executors are Ray actors instead of standalone JVMs.

---

## RayDP: Spark to Ray Dataset (zero-copy)

```python
# Phase 1: Spark ETL
spark_df = spark.read.parquet("s3://lake/events/")
features = spark.sql("""
    SELECT user_id, COUNT(*) as events,
           AVG(duration) as avg_dur
    FROM events GROUP BY user_id
""")

# Phase 2: Convert in-memory (no disk I/O)
ray_ds = raydp.spark.spark_dataframe_to_ray_dataset(features)

# Phase 3: Free Spark, train with Ray
raydp.stop_spark()  # releases executor actors

trainer = TorchTrainer(
    train_func,
    datasets={"train": ray_ds},
    scaling_config=ScalingConfig(num_workers=4, use_gpu=True),
)
result = trainer.fit()
```

<!-- This is the canonical RayDP use case. Spark for SQL, Ray for ML, one cluster. -->

---

## RayDP architecture

<div class="mermaid">
graph TD
    subgraph "Ray Cluster"
        GCS[Global Control Store]
        subgraph "Node 1"
            R1[Raylet] --> SE1[Spark Executor as Ray Actor]
            R1 --> RW1[Ray Worker ML Training]
        end
        subgraph "Node 2"
            R2[Raylet] --> SE2[Spark Executor as Ray Actor]
            R2 --> RW2[Ray Worker ML Training]
        end
        GCS --> R1
        GCS --> R2
        SD[Spark Driver via RayDP] --> SE1 & SE2
    end
</div>

RayDP implements a custom `ExternalClusterManager`. When Spark requests executors, RayDP creates Ray actors. Spark's engine (Catalyst, Tungsten, shuffle) works exactly as on YARN -- just scheduled by Ray.

---

## The hybrid approach

<div class="mermaid">
graph LR
    subgraph "Spark Domain"
        S1[Data Ingestion] --> S2[SQL ETL]
        S2 --> S3[Data Quality]
        S3 --> S4[Write to Delta Lake]
    end
    subgraph "Bridge"
        S4 -->|Parquet / Delta| B1[Data Lake S3/GCS]
        B1 -->|read_parquet| R1
    end
    subgraph "Ray Domain"
        R1[Read Features] --> R2[Preprocessing]
        R2 --> R3[Ray Train]
        R3 --> R4[Ray Tune]
        R4 --> R5[Ray Serve]
    end
</div>

Spark handles ingestion, SQL ETL, governance. Ray handles preprocessing, training, tuning, serving. The data lake is the handoff point.

---

<!-- _class: section-divider -->

# Part IV
# Operations & Monitoring

Dashboard, metrics, and keeping pipelines healthy.

---

## Ray Dashboard overview

The dashboard ships with Ray. No install needed. Starts automatically.

```python
import ray
ctx = ray.init()
print(ctx.dashboard_url)  # "127.0.0.1:8265"
```

**Six tabs:**

| Tab | What it shows |
|---|---|
| **Jobs** | Pipeline progress, operator DAG, task timelines |
| **Actors** | Actor states, restart counts, resource usage |
| **Metrics** | CPU/GPU/memory/disk time-series (Prometheus) |
| **Logs** | stdout/stderr for every task, actor, system process |
| **Cluster** | Node topology, resource bars, alive/dead status |
| **Serve** | Ray Serve deployments, latency, replicas |

---

## Dashboard: how it works

<div class="mermaid">
graph LR
    subgraph "Head Node"
        GCS[Global Control Store]
        DASH["Dashboard :8265"]
        DASH -->|queries| GCS
    end
    subgraph "Worker Node 1"
        R1[Raylet] -->|reports| GCS
    end
    subgraph "Worker Node 2"
        R2[Raylet] -->|reports| GCS
    end
    BROWSER[Your Browser] -->|HTTP| DASH
</div>

- Dashboard is a lightweight web server on the head node
- Reads all state from GCS (metadata, not data)
- Raylets continuously report CPU, memory, task states
- For remote access: `ray start --head --dashboard-host=0.0.0.0`

---

## Monitoring pipelines: operator timeline

<div class="mermaid">
gantt
    title Ray Data Pipeline Execution
    dateFormat X
    axisFormat %s
    section Read
        read_parquet (24 blocks)     :done, r1, 0, 8
    section Map
        preprocess (24 blocks)       :active, m1, 3, 15
    section Filter
        filter_invalid (24 blocks)   :f1, 10, 18
    section Write
        write_parquet (24 blocks)    :w1, 14, 22
</div>

Operators **overlap** in streaming execution. Read does not need to finish before Map starts. If one operator's bar stretches far beyond the others, that is your bottleneck.

---

## Monitoring: ds.stats()

```python
result = ds.materialize()
print(result.stats())
```

```
Operator 1 ReadParquet->SplitBlocks(24):
  Wall time: 3.2s
  Output: 24 blocks, 1.5GB, 12000000 rows
  Throughput: 3750000 rows/s

Operator 2 Map(preprocess):
  24 tasks executed
  Wall time: 8.1s          <-- bottleneck
  Throughput: 1481481 rows/s
  Peak memory: 512MB

Operator 3 Filter(filter_invalid):
  Wall time: 2.4s
  Output: 24 blocks, 900MB, 7200000 rows
```

Always call `.stats()` after execution. It costs nothing and gives you a performance baseline.

---

## Bottleneck diagnosis

<div class="mermaid">
graph TD
    SLOW["Pipeline is slow"]
    SLOW --> CHECK1{"One operator much\nslower than others?"}
    CHECK1 -->|Yes| FIX1["Increase concurrency\nor optimize UDF"]
    CHECK1 -->|No| CHECK2{"Few tasks take\nmuch longer?"}
    CHECK2 -->|Yes| FIX2["Data skew -- add\n.repartition() before it"]
    CHECK2 -->|No| CHECK3{"CPUs/GPUs at 100%?"}
    CHECK3 -->|Yes| FIX3["Scale cluster or\nreserve resources"]
    CHECK3 -->|No| OTHER["Check network I/O\nor object store spilling"]
</div>

Three patterns: **slow operator** (increase concurrency), **data skew** (repartition), **resource contention** (scale up).

---

<!-- _class: section-divider -->

# Part V
# Ecosystem Integrations

Cloud storage, data lakes, ML frameworks.

---

## Cloud storage: S3, GCS, Azure

Ray Data uses PyArrow's filesystem layer. Same `read_*` API, different URI prefix.

```python
# AWS S3 -- uses boto3 credential chain
ds = ray.data.read_parquet("s3://bucket/data/events/")

# Google Cloud Storage
ds = ray.data.read_parquet("gs://bucket/data/features/")

# Azure Blob (via adlfs)
import adlfs
az_fs = adlfs.AzureBlobFileSystem(account_name="acct",
                                   account_key="key")
ds = ray.data.read_parquet("az://container/data/",
                           filesystem=az_fs)
```

Each worker reads its assigned partitions **directly** from storage. Throughput scales linearly with workers.

---

## Cloud storage: performance tips

- **Explicit file lists** skip slow directory listing:

```python
# Slow: lists entire directory tree
ds = ray.data.read_parquet("s3://bucket/data/")
# Fast: skip listing
ds = ray.data.read_parquet([
    "s3://bucket/data/part-00000.parquet",
    "s3://bucket/data/part-00001.parquet",
])
```

- **File size**: aim for 128 MiB to 1 GiB Parquet files
- **`override_num_blocks`**: more blocks = more parallelism, more overhead
- **Column projection**: `columns=["a", "b"]` reads only what you need

---

## Data lakes: Delta Lake

```python
# pip install deltalake
ds = ray.data.read_delta("s3://lake/events_delta/")

# Time travel -- read a historical version
ds_v5 = ray.data.read_delta(
    "s3://lake/events_delta/", version=5)

# Write back atomically
ds.write_delta("s3://lake/processed/", mode="overwrite")
```

Delta Lake adds ACID transactions, schema evolution, and time travel on top of Parquet files. Ray Data reads/writes through the `deltalake` Python package.

---

## Data lakes: Apache Iceberg

```python
# pip install pyiceberg
from pyiceberg.catalog import load_catalog

catalog = load_catalog("glue", **{
    "type": "glue",
    "glue.region": "us-east-1",
    "warehouse": "s3://bucket/iceberg-warehouse/",
})
table = catalog.load_table("analytics.user_sessions")
ds = ray.data.read_iceberg(table)
```

Iceberg supports partition pruning and predicate pushdown -- filters skip entire files using column statistics. Always push filters as close to the source as possible.

---

## ML frameworks: PyTorch

```python
ds = ray.data.read_parquet("s3://bucket/training/")

# Stream batches as PyTorch tensors
for batch in ds.iter_torch_batches(
    batch_size=256, dtypes=torch.float32):
    features = batch["features"]  # torch.Tensor
    labels = batch["label"]       # torch.Tensor
    loss = criterion(model(features), labels)
    loss.backward()
    optimizer.step()
```

`iter_torch_batches()` replaces `DataLoader` with a streaming, distributed alternative. No need to load the full dataset into memory.

---

## ML frameworks: HuggingFace inference

```python
class SentimentPredictor:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(
            "distilbert-base-uncased-finetuned-sst-2-english")
        self.model = AutoModelForSequenceClassification \
            .from_pretrained(self.tokenizer.name_or_path)
        self.model.eval()
    def __call__(self, batch):
        enc = self.tokenizer(batch["text"].tolist(),
            padding=True, truncation=True, return_tensors="pt")
        with torch.no_grad():
            scores = torch.softmax(
                self.model(**enc).logits, dim=-1)
        return {"text": batch["text"],
                "score": scores[:, 1].numpy()}

ds.map_batches(SentimentPredictor, concurrency=4,
               num_gpus=1, batch_size=32)
```

<!-- Class-based callable: __init__ loads model once per actor. Reused for every batch. -->

---

## Batch inference pattern

The general pattern for scalable inference:

1. **Class with `__init__`** -- load model once per actor
2. **`__call__`** -- process each batch
3. **`concurrency`** -- number of model replicas
4. **`num_gpus`** -- GPU per replica

```python
ds.map_batches(
    ModelClass,
    concurrency=8,    # 8 replicas
    num_gpus=1,       # 1 GPU each
    batch_size=64,    # inference batch size
)
```

This is Ray Data's killer feature for ML workloads. No other data framework makes GPU batch inference this simple.

---

<!-- _class: section-divider -->

# Part VI
# Troubleshooting

The errors you will hit, and how to fix them.

---

## Error taxonomy

<div class="mermaid">
flowchart TD
    E[Ray Data Error] --> E1[Import/Setup]
    E --> E2[Memory]
    E --> E3[Serialization]
    E --> E4[Schema]
    E --> E5[Execution]
    E1 --> E1a["No module named ray"]
    E1 --> E1b["Connection refused"]
    E2 --> E2a["Object store full"]
    E2 --> E2b["OutOfMemoryError"]
    E3 --> E3a["Cannot pickle"]
    E4 --> E4a["Schema mismatch"]
    E5 --> E5a["RayTaskError"]
    E5 --> E5b["Deadline exceeded"]
    E5 --> E5c["No available nodes"]
    E5 --> E5d["Block too large"]
</div>

Most errors fall into one of five categories. Let's cover the top ones.

---

## Top errors: serialization

**"TypeError: cannot pickle '_thread.lock' object"**

Your lambda or function captures an unpicklable object (DB connection, lock, GPU tensor).

```python
# BROKEN -- conn cannot be serialized to workers
conn = psycopg2.connect("postgresql://localhost/db")
ds.map(lambda row: conn.execute(row["q"]))  # pickle error!

# FIXED -- create the resource per worker
class QueryDB:
    def __init__(self):
        import psycopg2
        self.conn = psycopg2.connect("postgresql://...")
    def __call__(self, row):
        return {"result": self.conn.execute(row["q"])}
ds.map(QueryDB, concurrency=4)
```

Rule: if it cannot be pickled, initialize it in `__init__`.

---

## Top errors: schema mismatch

**"ValueError: Schema mismatch between blocks"**

Your `map` function returns different columns or types for different rows.

```python
# BROKEN -- inconsistent output
def process(row):
    result = {"text": row["text"]}
    if row.get("score"):
        result["score"] = row["score"]  # missing in some rows!
    return result

# FIXED -- always return the same columns and types
def process(row):
    return {
        "text": row["text"],
        "score": float(row.get("score", 0.0)),  # always present
    }
```

Ray Data requires a consistent Arrow schema across all blocks.

---

## Top errors: memory

**"OutOfMemoryError: Task killed due to running out of memory"**

| Fix | When to use |
|---|---|
| Reduce `batch_size` | Each batch is too large in memory |
| Limit `concurrency` | Too many workers loading models |
| Streaming execution | Avoid `.materialize()` on large data |
| `repartition()` | A few blocks are disproportionately large |
| Set memory budget | Multiple pipelines competing |

```python
ctx = ray.data.DataContext.get_current()
ctx.execution_options.resource_limits \
    .object_store_memory = 4 * 1024**3  # 4 GiB cap
```

---

## OOM debugging: Ray's memory model

<div class="mermaid">
graph TB
    subgraph "Node Memory (32 GB)"
        OS["OS + Libraries ~2 GB"]
        OBJ["Object Store\n30% RAM = ~9.6 GB"]
        OBJ --> SPILL["Spills to disk when full"]
        W1["Worker 1 Heap"]
        W2["Worker 2 Heap"]
        W3["Worker 3 Heap"]
        GCS2["GCS + Raylet ~500 MB"]
    end
</div>

Three memory regions, three possible culprits:
- **Object store** full: blocks piling up between operators
- **Worker heap** too large: model + batch exceeds node RAM
- **System OOM killer**: everything combined > node capacity

---

## OOM debugging: symptom guide

| Symptom | Likely cause | Fix |
|---|---|---|
| Workers killed and restarted | Worker heap too large | Reduce `batch_size` |
| Tasks retried multiple times | Transient memory spike | Limit `concurrency` |
| Pipeline slows to a crawl | Object store spilling to disk | Use streaming execution |
| Entire node unresponsive | System OOM killer | Reduce total memory usage |

**Step 1:** Check the Dashboard memory tab.
**Step 2:** Check `ds.size_bytes()` at each pipeline stage.
**Step 3:** Look for spilling warnings in logs.

<!-- The dashboard is your first tool. Always check it before guessing. -->

---

## Error debugging flowchart

<div class="mermaid">
flowchart TD
    A[Error Occurred] --> B{Can you import ray?}
    B -->|No| C["pip install 'ray[data]'"]
    B -->|Yes| D{Can you connect?}
    D -->|No| E[Check ray start / address]
    D -->|Yes| F{Error type?}
    F --> G[Memory]
    F --> H[Serialization]
    F --> I[Task Error]
    F --> J[Schema Error]
    G --> G1["Reduce batch_size\nLimit concurrency\nIncrease object store"]
    H --> H1["Class-based transforms\nAvoid lambdas with state"]
    I --> I1["Read inner traceback\nAdd try/except"]
    J --> J1["Consistent columns\nand types from map"]
</div>

---

<!-- _class: section-divider -->

# Part VII
# Cheat Sheets & Reference

Take these home.

---

## Cheat sheet: reading data

| API | What it reads |
|---|---|
| `ray.data.read_parquet(path)` | Parquet files (columnar, efficient) |
| `ray.data.read_csv(path)` | CSV files |
| `ray.data.read_json(path)` | JSON / JSONL files |
| `ray.data.read_text(path)` | Text files (one row per line) |
| `ray.data.read_binary_files(path)` | Raw binary (images, PDFs) |
| `ray.data.read_delta(path)` | Delta Lake tables |
| `ray.data.read_iceberg(table)` | Iceberg tables |
| `ray.data.read_sql(sql, conn)` | SQL databases |
| `ray.data.from_items(list)` | Python dicts |
| `ray.data.from_pandas(df)` | Pandas DataFrame |

---

## Cheat sheet: transforms

| API | Description |
|---|---|
| `ds.map(fn)` | Apply fn to each row |
| `ds.flat_map(fn)` | One row in, zero or more out |
| `ds.filter(fn)` | Keep rows where fn returns True |
| `ds.map_batches(fn)` | Apply fn to batches (vectorized) |
| `ds.select_columns([cols])` | Keep only listed columns |
| `ds.drop_columns([cols])` | Remove columns |
| `ds.add_column(name, fn)` | Add a computed column |
| `ds.rename_columns({old: new})` | Rename columns |
| `ds.sort(key)` | Sort by column |
| `ds.random_shuffle()` | Randomly shuffle rows |
| `ds.repartition(n)` | Reorganize into n blocks |
| `ds.groupby(key).aggregate(...)` | Grouped aggregations |

---

## Cheat sheet: consuming data

| API | Description |
|---|---|
| `ds.show(n)` | Print first n rows |
| `ds.take(n)` | Return first n rows as list |
| `ds.count()` | Total row count |
| `ds.schema()` | Arrow schema |
| `ds.iter_rows()` | Iterate row by row |
| `ds.iter_batches(batch_size=N)` | Iterate in batches |
| `ds.iter_torch_batches(...)` | Iterate as PyTorch tensors |
| `ds.to_pandas()` | Collect as Pandas DataFrame |
| `ds.write_parquet(path)` | Write Parquet |
| `ds.write_csv(path)` | Write CSV |
| `ds.write_delta(path)` | Write Delta Lake |
| `ds.materialize()` | Force execution, cache in object store |
| `ds.stats()` | Execution statistics |

---

## Cheat sheet: tuning knobs

| Knob | Default | When to change |
|---|---|---|
| `batch_size` | 4096 | Decrease for large rows (images). Increase for numerical vectorization. |
| `concurrency` | Auto | Set fixed when workers load models. Use range `(2, 16)` for auto-scale. |
| `target_max_block_size` | 512 MiB | Decrease for OOM. Increase for throughput on big machines. |
| `override_num_blocks` | Auto | More blocks = more parallelism. Fewer = less overhead. |
| `object_store_memory` | 30% RAM | Increase for shuffle-heavy pipelines. |
| `preserve_order` | False | True when output ordering matters. |
| `batch_format` | pyarrow | `"pandas"` for string ops. `"numpy"` for numerical. |
| `zero_copy_batch` | False | True for read-only transforms (saves a copy). |
| `num_gpus` | 0 | Match your model's needs per worker. |

---

## Tuning: symptom-to-fix table

| Symptom | Likely cause | Fix |
|---|---|---|
| `OutOfMemoryError` | Blocks too large | Decrease `target_max_block_size` or `batch_size` |
| Slow with many small files | Scheduling overhead | Fewer `override_num_blocks`, larger `batch_size` |
| Low GPU utilization | Batch size too small | Increase `batch_size` in `map_batches` |
| High memory on shuffle/sort | Too many blocks in memory | Set `resource_limits.object_store_memory` |
| Slow model inference | Model reloaded per task | Use class-based callable + `concurrency` |
| Output order scrambled | Unordered execution | Set `preserve_order = True` |
| Slow Pandas transforms | DataFrame conversion overhead | Try `batch_format="numpy"` |

---

## Full tuned pipeline example

```python
import ray
from ray.data import DataContext

ray.init(num_cpus=32, num_gpus=4,
         object_store_memory=30 * 1024**3)

ctx = DataContext.get_current()
ctx.target_max_block_size = 256 * 1024 * 1024
ctx.execution_options.resource_limits.object_store_memory = 20e9

ds = ray.data.read_parquet("s3://bucket/data/",
                           override_num_blocks=128)

ds = ds.map_batches(preprocess, batch_format="numpy",
                    batch_size=4096, zero_copy_batch=True)

ds = ds.map_batches(ModelClass, concurrency=4,
                    batch_size=64, num_gpus=1)

ds.write_parquet("s3://bucket/results/")
print(ds.stats())
```

<!-- This is the template. Adjust the numbers for your cluster and workload. -->

---

<!-- _class: section-divider -->

# Series Wrap-Up

Four sessions. One framework. Everything you need.

---

## What we covered: all 4 sessions

**Session 1 -- Foundations**
- Ray Data core concepts: Datasets, blocks, lazy execution
- Reading and writing data (Parquet, CSV, JSON)
- Transforms: `map`, `map_batches`, `filter`, `flat_map`
- Aggregations and groupby

**Session 2 -- Performance & Patterns**
- Streaming execution model and backpressure
- Memory management and the object store
- Batch size and concurrency tuning
- Actor-based stateful transforms for ML inference

---

## What we covered (continued)

**Session 3 -- Advanced Pipelines**
- GPU-accelerated pipelines with heterogeneous resources
- Distributed training with Ray Train integration
- Preprocessor chains for training/serving consistency
- Data loading for PyTorch, TensorFlow, HuggingFace

**Session 4 -- Ray Data in Context** *(today)*
- Ray vs Spark: architecture, APIs, and when to pick each
- Migrating from Spark and bridging with RayDP
- Production operations: dashboard, monitoring, debugging
- Ecosystem: cloud storage, data lakes, ML frameworks
- Troubleshooting: errors, OOM, and tuning reference

---

## The decision framework (one last time)

<div class="mermaid">
graph TD
    Q1{Primary workload?} -->|SQL Analytics| SPARK[Spark]
    Q1 -->|ML Pipeline| Q2{GPU required?}
    Q1 -->|Mixed ETL + ML| HYBRID[Both]
    Q2 -->|Yes| RAY[Ray Data]
    Q2 -->|No| Q3{Complex joins?}
    Q3 -->|Yes| SPARK
    Q3 -->|No| Q4{Team expertise?}
    Q4 -->|SQL / JVM| SPARK
    Q4 -->|Python / ML| RAY
    HYBRID --> NOTE["Spark for ETL\nRay for ML"]
</div>

They are not competitors. They are complementary tools with different strengths. Use the right one for the job.

---

<!-- _class: lead -->

# Thank you

## Ray Data Academy -- Complete

Questions? Let's discuss.

<!-- Final slide. Open the floor. -->
