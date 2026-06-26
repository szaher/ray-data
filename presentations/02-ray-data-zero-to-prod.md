---
marp: true
theme: ray-academy
paginate: true
header: "Ray Data Academy - Session 2"
footer: "Ray Data: From Zero to Production"
---

<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: "base", themeVariables: { primaryColor: "#e0f0ff", primaryTextColor: "#151515", primaryBorderColor: "#0066cc", lineColor: "#0066cc", secondaryColor: "#daf2f2", tertiaryColor: "#f2f2f2", noteBkgColor: "#fef0f0", noteTextColor: "#151515", fontFamily: "Red Hat Text, sans-serif" }});
</script>


<!-- _class: lead -->

# Ray Data
## From Zero to Production

Ray Data Academy - Session 2 of 4

<!-- Session 2 builds on the Ray foundations from Session 1. We move from Ray Core primitives to Ray Data, the library purpose-built for ML data preprocessing. -->

---

## Session roadmap

1. What Ray Data is and when to use it
2. The Dataset abstraction and Arrow
3. Reading data from anywhere
4. Transformations: map, map_batches, filter
5. Consuming results
6. Schemas and type handling
7. Lazy execution and streaming
8. Execution plans and operator fusion
9. Memory, fault tolerance, and shuffles

<!-- This is the densest session in the series. We go from "what is this thing" to "how does it actually work under the hood" in about 90 minutes. -->

---

<!-- _class: section-divider -->

# What is Ray Data?
Last-mile data preprocessing for ML

---

## The problem Ray Data solves

You have raw data in S3. You need to load it, transform it, and feed it into a training loop or batch inference pipeline.

You could use Spark, but then you have two clusters, a serialization boundary, and a team of Spark engineers.

Ray Data runs **on the same Ray cluster** as your training and serving code. No separate infrastructure. No serialization gap.

<div class="mermaid">
graph LR
    S["Raw Data\nS3 / GCS / Disk"] --> RD["Ray Data\nLoad + Transform"]
    RD --> T["ML Training\nRay Train"]
    RD --> I["Batch Inference\nRay Serve"]
</div>

<!-- This is the pitch. One cluster, one framework. Your data preprocessing and your model training share the same resources. -->

---

## When to use Ray Data

| Scenario | Ray Data | Spark | Dask |
|----------|----------|-------|------|
| ML preprocessing (images, text) | **Best fit** | Overhead | Possible |
| Batch inference at scale | **Best fit** | Poor fit | Possible |
| ETL into a data warehouse | Not ideal | **Best fit** | Possible |
| Ad-hoc SQL analytics | Not ideal | **Best fit** | Not ideal |
| Streaming ML pipelines | Good fit | Good fit | Poor fit |

If your end goal is a data warehouse, use Spark. If your end goal is feeding a model, use Ray Data.

<!-- If your end goal is a data warehouse or BI dashboard, use Spark. If your end goal is feeding a model, Ray Data is the right tool. -->

---

## Key features at a glance

- **Lazy execution** -- transformations are deferred until you consume results
- **Arrow-native** -- Apache Arrow format for zero-copy reads and efficient memory
- **Heterogeneous compute** -- attach GPUs to specific steps, keep others on CPU
- **Streaming execution** -- data flows through a pipeline; the full dataset never needs to fit in memory

These four properties define how Ray Data thinks about data processing. Everything else follows from them.

---

<!-- _class: section-divider -->

# The Dataset Abstraction
Blocks, Arrow, and distributed collections

---

## Dataset: the core object

A `Dataset` is a distributed collection of rows, split into **blocks** that are processed in parallel.

```python
import ray

# Create a Dataset -- this is lazy, no data is read yet
ds = ray.data.read_csv("s3://my-bucket/data/")

# Chain transformations -- still lazy
ds = ds.map_batches(preprocess)
ds = ds.filter(lambda row: row["label"] is not None)

# Consume -- this triggers execution
for batch in ds.iter_batches(batch_size=256):
    model.train(batch)
```

You define **what** to do. Ray Data decides **how** to distribute, schedule, and pipeline the work.

<!-- A Dataset is not a DataFrame. It is a lazy, distributed pipeline definition that happens to look like a collection. -->

---

## Blocks and Arrow

Each block is an **Apache Arrow table**. Arrow is the internal storage format for all data in Ray Data.

<div class="mermaid">
graph LR
    DS["Dataset\n(logical)"] --> B1["Block 1\nArrow Table"]
    DS --> B2["Block 2\nArrow Table"]
    DS --> B3["Block 3\nArrow Table"]
    DS --> B4["Block N\nArrow Table"]
</div>

Why Arrow?

- **Columnar** -- operations on a single column touch only that column's memory
- **Zero-copy** -- blocks can be shared between processes without serialization
- **Typed** -- strict schema enforcement catches errors early
- **Ecosystem** -- pandas, PyArrow, and NumPy all interoperate natively

<!-- Arrow is the reason Ray Data can hand batches to your model without copying data. This matters when you are moving gigabytes per second through a GPU pipeline. -->

---

## From Arrow to your code

Arrow is always the internal representation. You choose the format your functions receive.

<div class="mermaid">
graph TD
    SRC["Source Data\nCSV / Parquet / Python"] -->|read| ARR["Arrow Blocks\nColumnar - Typed - Zero-copy"]
    ARR -->|"batch_format='pandas'"| PD["pandas DataFrame"]
    ARR -->|"batch_format='pyarrow'"| PA["pyarrow Table"]
    ARR -->|"batch_format='numpy'"| NP["dict of numpy arrays"]
</div>

- **pandas** -- good default, wide library support
- **pyarrow** -- fastest, best for column transforms
- **numpy** -- natural fit for numeric ML features

---

<!-- _class: section-divider -->

# Reading Data
Getting data into Ray Data

---

## Data sources

<div class="mermaid">
graph LR
    CSV["CSV Files"] --> R["Ray Data\nReaders"]
    PQ["Parquet Files"] --> R
    JSON["JSON Files"] --> R
    IMG["Image Files"] --> R
    MEM["Python Objects"] --> R
    R --> DS["Dataset\nDistributed Blocks"]
</div>

Every reader returns a `Dataset`. All reads are lazy -- no data moves until you consume.

---

## Reading structured data

```python
import ray

# CSV -- single file or directory of files
ds = ray.data.read_csv("s3://bucket/data/users.csv")
ds = ray.data.read_csv("s3://bucket/data/csvs/")

# Parquet -- columnar format, best performance
ds = ray.data.read_parquet("data/events.parquet")
ds = ray.data.read_parquet(
    "s3://bucket/events/",
    columns=["user_id", "action"]  # read only what you need
)

# JSON -- line-delimited JSON files
ds = ray.data.read_json("logs/2024-01-*.json")
```

Parquet is the best choice for production. Columnar, compressed, and supports predicate pushdown.

<!-- read_parquet with a columns filter is the fastest way to load data. Ray Data pushes the column selection down to the I/O layer so you never read bytes you don't need. -->

---

## Reading images and cloud storage

```python
# Images -- loaded as numpy arrays, ready for CV pipelines
ds = ray.data.read_images("s3://bucket/images/", size=(224, 224))
ds.schema()
# Column  Type
# ------  ----
# image   numpy.ndarray(shape=(224, 224, 3), dtype=uint8)

# Cloud storage -- just use the URI scheme
ds = ray.data.read_parquet("s3://my-bucket/data/")   # AWS S3
ds = ray.data.read_parquet("gs://my-bucket/data/")   # GCS
ds = ray.data.read_parquet("az://container/data/")   # Azure

# Glob patterns work
ds = ray.data.read_csv("s3://bucket/logs/2024-*/events.csv")
```

Authentication uses your environment credentials (AWS_PROFILE, GOOGLE_APPLICATION_CREDENTIALS, etc.).

<!-- This is one of the clearest wins over Spark. Try loading 10 million PNGs from S3 into Spark. Now try it with Ray Data. Night and day. -->

---

## Creating datasets from Python

`from_items` is useful for testing and prototyping. Not for production data loading.

```python
ds = ray.data.from_items([
    {"name": "Alice", "age": 30},
    {"name": "Bob", "age": 25},
    {"name": "Carol", "age": 35},
])

ds.show(3)
# {'name': 'Alice', 'age': 30}
# {'name': 'Bob', 'age': 25}
# {'name': 'Carol', 'age': 35}
```

| Format | Speed | Compression | Column Pruning | Best For |
|--------|-------|-------------|----------------|----------|
| Parquet | Fast | Yes | Yes | Production ML pipelines |
| CSV | Slow | No | No | Legacy data, small files |
| JSON | Slow | No | No | Log files, API outputs |
| Images | N/A | N/A | N/A | Computer vision |

---

<!-- _class: section-divider -->

# Transformations
map, map_batches, flat_map, filter

---

## map: row-by-row

`map` applies a function to each row. Each row is a Python dictionary.

```python
ds = ray.data.from_items([
    {"text": "Hello World", "label": 1},
    {"text": "Ray Data", "label": 0},
])

def add_length(row):
    row["text_length"] = len(row["text"])
    return row

ds = ds.map(add_length)
ds.show()
# {'text': 'Hello World', 'label': 1, 'text_length': 11}
# {'text': 'Ray Data', 'label': 0, 'text_length': 8}
```

Simple, but not the fastest option for numeric work.

---

## map_batches: vectorized processing

`map_batches` is the workhorse. Your function receives a pandas DataFrame (or Arrow table) and returns one. Vectorized operations are **much faster** than row-at-a-time.

```python
import pandas as pd

ds = ray.data.read_csv("s3://bucket/users.csv")

def normalize_ages(batch: pd.DataFrame) -> pd.DataFrame:
    batch["age_normalized"] = (
        (batch["age"] - batch["age"].mean()) / batch["age"].std()
    )
    return batch

ds = ds.map_batches(normalize_ages, batch_format="pandas")
```

<!-- map_batches is where you spend 90% of your time with Ray Data. Get comfortable with it. -->

---

## map_batches with classes: stateful transforms

Use a callable class when you need to load a model or other expensive state once per worker.

```python
class Predictor:
    def __init__(self):
        import torch
        self.model = torch.load("model.pt")

    def __call__(self, batch: pd.DataFrame) -> pd.DataFrame:
        batch["pred"] = self.model.predict(
            batch["features"].tolist()
        )
        return batch

ds = ds.map_batches(
    Predictor,
    concurrency=4,
    num_gpus=1  # each worker gets 1 GPU
)
```

The class is instantiated once per worker. The model is loaded once, not once per batch.

<!-- This is the pattern for batch inference. One class, one model load, millions of predictions. -->

---

## flat_map and filter

**flat_map** -- one input row produces multiple output rows:

```python
ds = ray.data.from_items([
    {"sentence": "Hello world. How are you."},
])

def split_words(row):
    return [{"word": w} for w in row["sentence"].split()]

ds = ds.flat_map(split_words)
# {'word': 'Hello'}, {'word': 'world.'}, {'word': 'How'}, ...
```

**filter** -- keep matching rows:

```python
ds = ray.data.from_items([
    {"name": "Alice", "score": 85},
    {"name": "Bob", "score": 42},
    {"name": "Carol", "score": 91},
])
ds = ds.filter(lambda row: row["score"] >= 50)
# Alice (85), Carol (91) -- Bob is dropped
```

---

## Choosing the right method

| Method | Input | Output | Best For |
|--------|-------|--------|----------|
| `map` | 1 row (dict) | 1 row | Simple per-row transforms |
| `map_batches` | batch (DataFrame) | batch | Vectorized ops, ML inference |
| `flat_map` | 1 row | 0+ rows | Splitting, exploding |
| `filter` | 1 row | bool | Dropping unwanted rows |
| `add_column` | 1 row | 1 value | Adding a single column |

**Rule of thumb:** if you can express it as a pandas/numpy operation, use `map_batches`. If you need per-row logic with Python control flow, use `map`.

<!-- The performance difference is real. map_batches with vectorized pandas can be 10-100x faster than map with Python dicts for numeric transforms. -->

---

<!-- _class: section-divider -->

# Consuming Results
Iterators, writers, and materialization

---

## Consuming data: peek and stream

Consuming is what **triggers execution**. Until you consume, nothing runs.

```python
ds = ray.data.read_csv("data/users.csv")

# Peek: quick inspection during development
ds.show(3)   # prints to stdout
rows = ds.take(5)  # returns list of dicts

# Stream: production workloads
for batch in ds.iter_batches(
    batch_size=256,
    batch_format="pandas"
):
    print(batch.shape)  # (256, 3)

# ML training: numpy format for tensor conversion
for batch in ds.iter_batches(
    batch_size=64, batch_format="numpy"
):
    features = batch["features"]  # numpy array
    labels = batch["labels"]      # numpy array
```

<!-- iter_batches is the main consumer for ML training loops. batch_format="numpy" gives you arrays ready for tensor conversion. -->

---

## The ML training pattern

The most common consumption pattern in practice:

```python
ds = ray.data.read_parquet("s3://bucket/training-data/")
ds = ds.map_batches(preprocess, batch_format="pandas")

for epoch in range(10):
    for batch in ds.iter_batches(
        batch_size=128, batch_format="numpy"
    ):
        loss = train_step(batch["features"], batch["labels"])
    print(f"Epoch {epoch}: loss={loss:.4f}")
```

Read. Transform. Iterate. Train. That is the whole pattern.

---

## Writing data to disk

Write processed data out in parallel. Ray Data creates one file per block.

```python
# Write to Parquet -- best for downstream ML
ds.write_parquet("s3://bucket/processed/output/")

# Write to CSV or JSON
ds.write_csv("/tmp/output_csvs/")
ds.write_json("/tmp/output_json/")

# Control output file count
ds.repartition(10).write_parquet("s3://bucket/output/")
```

| Method | Returns | Use Case |
|--------|---------|----------|
| `show(n)` / `take(n)` | Prints / list | Inspection, debugging |
| `iter_batches()` | Iterator | ML training, batch processing |
| `write_parquet()` / `write_csv()` | None | Persist to storage |
| `materialize()` | Dataset | Pin results in memory |

<!-- repartition before write is how you control the number of output files. Without it, you get one file per block, which can be thousands of tiny files. -->

---

<!-- _class: section-divider -->

# Schemas and Types
Arrow types and type safety

---

## Inspecting the schema

Every Dataset has a schema. Arrow types are strict -- no silent coercion.

```python
ds = ray.data.from_items([
    {"name": "Alice", "age": 30, "score": 95.5},
])
print(ds.schema())
# Column  Type
# ------  ----
# name    string
# age     int64
# score   double
```

| Python Type | Arrow Type | | Python Type | Arrow Type |
|-------------|------------|-|-------------|------------|
| `str` | `string` | | `bool` | `bool` |
| `int` | `int64` | | `bytes` | `binary` |
| `float` | `double` | | `np.ndarray` | `ArrowTensorType` |

Schema mismatches cause runtime errors. If one batch returns `int` and another returns `float` for the same column, Arrow will reject it. Be consistent.

---

## Batch formats in practice

```python
import pandas as pd
import pyarrow as pa

ds = ray.data.read_parquet("data/events.parquet")

# pandas -- familiar API, good default
def transform_pandas(batch: pd.DataFrame) -> pd.DataFrame:
    batch["event_upper"] = batch["event"].str.upper()
    return batch
ds.map_batches(transform_pandas, batch_format="pandas")

# pyarrow -- fastest, zero-copy column ops
def transform_arrow(table: pa.Table) -> pa.Table:
    col = pa.compute.utf8_upper(table.column("event"))
    return table.append_column("event_upper", col)
ds.map_batches(transform_arrow, batch_format="pyarrow")

# numpy -- dict of arrays, ideal for ML models
ds.map_batches(scale_fn, batch_format="numpy")
```

<!-- pandas is the right default for most people. Switch to pyarrow when you have profiled and need the extra speed. -->

---

<!-- _class: section-divider -->

# Lazy Execution
Nothing runs until you say so

---

## Lazy by default

When you chain transformations, **nothing executes**. Each call adds a step to a logical plan. Execution is deferred until you consume.

<div class="mermaid">
graph LR
    R["read_parquet()"] -->|lazy| M["map_batches()"]
    M -->|lazy| F["filter()"]
    F -->|lazy| A["add_column()"]
    A -->|"TRIGGERS\nexecution"| C["show() / iter_batches()\nwrite_parquet() / count()"]
</div>

```python
# None of these lines trigger computation
ds = ray.data.read_parquet("s3://bucket/events/")
ds = ds.map_batches(parse_json_fields)
ds = ds.filter(lambda row: row["status"] == "active")
ds = ds.map_batches(extract_features)

print(ds)  # Dataset(num_rows=?, schema={...})
ds.show(5)  # THIS triggers execution
```

The `?` in `num_rows` is the tell. Ray Data does not know how many rows exist until it reads them.

<!-- This is the same idea as Spark's lazy evaluation, TensorFlow's graph mode, or SQL query planning. Build the plan, then execute it. -->

---

## Why lazy? Two optimizations

**1. Operator fusion** -- Ray Data merges adjacent map steps into a single pass over the data, reducing serialization overhead.

**2. Streaming execution** -- data flows through the pipeline block-by-block instead of materializing every intermediate result.

| Triggers Execution | Extends the Plan |
|---|---|
| `show(n)`, `take(n)`, `count()` | `map()`, `map_batches()` |
| `iter_rows()`, `iter_batches()` | `filter()`, `flat_map()` |
| `write_parquet()`, `write_csv()` | `add_column()` |
| `materialize()` | `repartition()`, `sort()` |

---

## materialize(): pinning results

By default, blocks are freed after they flow through a consumer. Use `materialize()` to keep results in memory for multi-pass consumption.

```python
# Without materialize -- re-reads and re-computes every epoch
ds = ray.data.read_parquet("s3://bucket/train/")
ds = ds.map_batches(preprocess)
for epoch in range(5):
    for batch in ds.iter_batches(batch_size=128):
        train(batch)  # re-executes pipeline each time

# With materialize -- compute once, iterate many times
ds = ray.data.read_parquet("s3://bucket/train/")
ds = ds.map_batches(preprocess)
ds = ds.materialize()  # pins blocks in object store
for epoch in range(5):
    for batch in ds.iter_batches(batch_size=128):
        train(batch)  # reads from memory
```

**Materialize** for multi-epoch training. **Stream** for single-pass inference.

<!-- materialize is your checkpoint. It trades memory for compute. Use it when you will read the same data more than once. -->

---

<!-- _class: section-divider -->

# Streaming Execution
Pipeline parallelism and backpressure

---

## Bulk vs streaming

<div class="mermaid">
graph LR
    subgraph "Bulk Execution"
    R1["Read ALL"] -->|wait| T1["Transform ALL"] -->|wait| W1["Write ALL"]
    end
    subgraph "Streaming Execution"
    R2["Read window"] -->|overlap| T2["Transform window"] -->|overlap| W2["Write window"]
    end
</div>

**Bulk:** each step finishes before the next starts. Peak memory = full dataset.

**Streaming (default):** steps overlap. While block N is transformed, block N+1 is read, block N-1 is written. Peak memory = a few blocks.

```python
# This pipeline never materializes the full 1 TB dataset
ds = ray.data.read_parquet("s3://bucket/terabyte-dataset/")
ds = ds.map_batches(preprocess, batch_size=4096)
ds = ds.map_batches(run_model, batch_size=512, num_gpus=1)
ds.write_parquet("s3://bucket/output/")
```

<!-- Streaming is the default in Ray Data. You get it for free. This is how you process a terabyte dataset on a cluster with 64 GB of RAM. -->

---

## Backpressure: automatic flow control

When operators run at different speeds, Ray Data applies **backpressure** -- slowing fast producers to match slow consumers.

<div class="mermaid">
graph TD
    READ["Read\n10K rows/sec"] -->|"backpressure\nslows to 1K/sec"| PREP["Preprocess\n5K rows/sec"]
    PREP -->|"backpressure\nslows to 1K/sec"| GPU["GPU Inference\n1K rows/sec"]
    GPU --> WRITE["Write\n10K rows/sec"]
</div>

You can also set explicit memory limits with `ExecutionOptions`:

```python
ctx = ray.data.DataContext.get_current()
ctx.execution_options = ExecutionOptions(
    resource_limits=ray.data.ExecutionResources(
        object_store_memory=4 * 1024**3,  # 4 GB cap
    ),
)
```

<!-- Backpressure is invisible when it works. You only notice its absence -- when your job OOMs because the reader outran the GPU. Start without limits, add them when you see spilling. -->

---

<!-- _class: section-divider -->

# Execution Plans
Operator fusion and optimization

---

## From logical plan to physical execution

Ray Data builds a **logical plan**, then an optimizer converts it into a **physical plan** with fused operators.

<div class="mermaid">
graph TD
    L1["Logical: ReadParquet"] --> L2["Logical: Map(parse)"]
    L2 --> L3["Logical: Map(normalize)"]
    L3 --> L4["Logical: Filter(valid)"]
    L4 --> L5["Logical: Write"]
    L1 -.->|"Optimizer"| P1["Physical: ReadParquet\n+ Map(parse)"]
    P1 -.-> P2["Physical: Map(normalize)\n+ Filter(valid)"]
    P2 -.-> P3["Physical: Write"]
</div>

5 logical operators become 3 physical stages. Fewer stages = less serialization overhead.

---

## Operator fusion and explain()

Use `explain()` to see the optimized physical plan before running expensive pipelines.

```python
ds = (
    ray.data.read_parquet("s3://bucket/data/")
    .map(lambda row: {**row, "name": row["name"].lower()})
    .filter(lambda row: row["age"] > 18)
    .map_batches(lambda batch: batch)
)
ds.explain()
# == Logical Plan ==
# ReadParquet -> Map(fn) -> Filter(fn) -> MapBatches(fn)
# == Optimized Physical Plan ==
# ReadParquet -> MapBatches(fn) [fused: Map, Filter, MapBatches]
```

**Fuses:** consecutive `map`, `filter`, `map_batches` merge into a single stage.

**Breaks fusion:** shuffle operations (`repartition`, `random_shuffle`, `sort`, `groupby`) force a materialization boundary between stages.

---

<!-- _class: section-divider -->

# Memory Management
Object store, spilling, and tuning

---

## How Ray Data uses memory

Data blocks live in the **Ray object store** -- shared memory on each node.

<div class="mermaid">
graph LR
    R["Read\n(Producer)"] -->|blocks| OS["Object Store\n(Shared Memory)"]
    OS -->|blocks| M["Map\n(Consumer)"]
    M -->|blocks| W["Write\n(Consumer)"]
    BP["Backpressure"] -.->|"slow down"| R
    SPILL["Disk Spill"] -.->|"overflow"| OS
</div>

Two safety mechanisms: **backpressure** slows producers, **spilling** overflows to disk.

---

## Tuning memory

```python
ctx = ray.data.DataContext.get_current()
ctx.target_max_block_size = 64 * 1024 * 1024  # 64 MiB (default ~128)
ctx.execution_options.resource_limits.object_store_memory = 4e9
```

1. **Start with defaults.** Backpressure handles most workloads.
2. **If spilling:** reduce `target_max_block_size`, lower `concurrency`, or add nodes.
3. **For GPU inference:** set `concurrency` to match your GPU count.
4. **Monitor:** `ds.materialize().stats()` reports bytes spilled and peak memory.

---

<!-- _class: section-divider -->

# Fault Tolerance
Lineage reconstruction and retries

---

## Task-level retries

At scale, node failures and OOM kills are normal. Ray Data retries at the **task level**, not the job level.

<div class="mermaid">
graph TD
    R["Read Block A"] --> M1["Map Task 1"]
    R2["Read Block B"] --> M2["Map Task 2"]
    R3["Read Block C"] --> M3["Map Task 3 X"]
    M1 --> W["Write"]
    M2 --> W
    M3 -->|"FAIL"| RETRY["Retry: re-read Block C\nthen re-run Map Task 3"]
    RETRY --> W
</div>

Only the failed task is retried. The rest of the pipeline continues unaffected.

<!-- This is task-level, not job-level retry. Spark restages entire stages. Ray Data retries individual tasks. -->

---

## Lineage reconstruction

When a worker dies, its blocks are lost. Ray Data reconstructs them using **lineage** -- the recorded chain of operations from the durable source.

<div class="mermaid">
graph LR
    SRC["Source File\n(durable)"] -->|"lineage"| B1["Block v1\n(lost)"]
    B1 -->|"lineage"| B2["Block v2\n(lost)"]
    SRC -->|"reconstruct"| B1R["Block v1\n(recomputed)"]
    B1R -->|"reconstruct"| B2R["Block v2\n(recomputed)"]
</div>

Use `materialize()` as checkpoints to truncate deep lineage chains and limit recomputation.

---

## Fault tolerance configuration and best practices

```python
ctx = ray.data.DataContext.get_current()
ctx.max_task_retries = 5  # default is 3

# Checkpoint with materialize() to truncate lineage
ds = ray.data.read_parquet("s3://bucket/raw/")
ds = ds.map_batches(expensive_parse).materialize()
ds = ds.map_batches(expensive_transform).materialize()
ds = ds.map_batches(expensive_inference)
# Failure at inference only recomputes from last checkpoint
```

1. **Keep transforms idempotent.** Retries re-execute your function.
2. **Checkpoint before expensive stages.** `materialize()` or write to durable storage.
3. **Use durable sources.** S3/GCS are safer than ephemeral streams.
4. **Monitor retries.** Excessive retries signal OOM or bad data, not transient failures.

---

<!-- _class: section-divider -->

# Shuffles and Aggregations
The expensive operations

---

## The cost of shuffles

Most operations are pipelined. Shuffles require **all-to-all data movement**, breaking the streaming model.

<div class="mermaid">
graph TD
    subgraph "Pipelined (Fast)"
        A1["Block 1"] -->|map| B1["Block 1'"]
        A2["Block 2"] -->|map| B2["Block 2'"]
        A3["Block 3"] -->|map| B3["Block 3'"]
    end
    subgraph "Shuffle (Expensive)"
        C1["Block 1"] --> S["All-to-All\nExchange"]
        C2["Block 2"] --> S
        C3["Block 3"] --> S
        S --> D1["Block A"]
        S --> D2["Block B"]
        S --> D3["Block C"]
    end
</div>

---

## Repartition, sort, and groupby

```python
ds = ray.data.read_parquet("s3://bucket/data/")

# Repartition: full shuffle or local split/merge
ds = ds.repartition(100)                  # full shuffle
ds = ds.repartition(100, shuffle=False)   # local only (faster)

# Sort: distributed range-partitioned
ds = ds.sort("timestamp")
ds = ds.sort(["category", "score"], descending=[False, True])
```

```python
from ray.data.aggregate import Count, Mean, Max, Sum

# GroupBy: built-in aggregations
result = ds.groupby("user_id").aggregate(
    Count(), Mean("duration"), Max("score"), Sum("revenue"),
)

# Custom group transforms (like pandas groupby().apply())
ds = ds.groupby("category").map_groups(
    normalize_fn, batch_format="pandas"
)
```

<!-- groupby + map_groups is the Ray Data equivalent of pandas groupby().apply(). Same semantics, distributed execution. -->

---

## Random shuffle vs local shuffle

```python
# Full global shuffle (expensive -- all-to-all exchange)
ds = ray.data.read_parquet("training_data/")
ds = ds.random_shuffle(seed=42)

# Local shuffle within iter_batches (cheap -- no exchange)
for batch in ds.iter_batches(
    batch_size=256,
    local_shuffle_buffer_size=1000,
):
    train_step(batch)
```

| Operation | Cost | When to Use |
|---|---|---|
| `repartition(n)` | High | Fix block skew |
| `repartition(n, shuffle=False)` | Low | Adjust block count |
| `sort(key)` | High | Ordered output |
| `groupby(key).aggregate(...)` | High | Group statistics |
| `random_shuffle()` | High | Global randomization |
| `local_shuffle_buffer_size=N` | **Low** | ML training shuffle |

> For ML training, `local_shuffle_buffer_size` is usually sufficient.

---

<!-- _class: section-divider -->

# Putting It All Together

---

## End-to-end: batch inference pipeline

```python
import ray

ds = ray.data.read_images("s3://bucket/images/", size=(224, 224))

class ImageClassifier:
    def __init__(self):
        import torch
        self.model = torch.load("resnet50.pt").eval().cuda()

    def __call__(self, batch):
        import torch
        imgs = torch.tensor(batch["image"]).cuda()
        batch["prediction"] = self.model(imgs).argmax(1).cpu()
        return batch

ds = ds.map_batches(
    ImageClassifier, concurrency=4, num_gpus=1,
    batch_size=64, batch_format="numpy"
)
ds.write_parquet("s3://bucket/predictions/")
```

Read images. Classify on GPU. Write predictions. Ray Data handles the rest.

<!-- Read images from S3, run them through a GPU model, write predictions back. Three lines of pipeline logic. Ray Data handles the rest. -->

---

## What we covered

1. **Ray Data** -- last-mile ML preprocessing, bridge between storage and models
2. **Dataset** -- lazy, distributed collection of Arrow blocks
3. **Readers** -- CSV, Parquet, JSON, images from local disk or cloud
4. **Transformations** -- `map`, `map_batches`, `flat_map`, `filter`
5. **Consumers** -- `iter_batches` for training, `write_*` for persistence
6. **Schemas** -- Arrow-native with strict typing
7. **Lazy execution** -- defers work, enables fusion and streaming
8. **Streaming** -- pipelines operators, datasets larger than memory
9. **Backpressure** -- automatic flow control, prevents OOM
10. **Execution plans** -- operator fusion reduces overhead
11. **Fault tolerance** -- lineage reconstruction, task-level retries
12. **Shuffles** -- expensive, use `local_shuffle_buffer_size` for training

---

## What's next: Session 3

**Ray Data in Production**

- Data pipelines with Ray Train integration
- Multi-modal data pipelines (text + images)
- Performance profiling and optimization
- Production deployment patterns
- Monitoring and observability
- Common pitfalls and how to avoid them

See you in Session 3.

---

<!-- _class: lead -->

# Questions?

Ray Data Academy - Session 2 of 4
