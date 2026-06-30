---
marp: true
theme: ray-academy
paginate: true
header: 'Ray Data Academy'
footer: 'Session 1: Why Ray?'
---

<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: "base", themeVariables: { primaryColor: "#e0f0ff", primaryTextColor: "#151515", primaryBorderColor: "#0066cc", lineColor: "#0066cc", secondaryColor: "#daf2f2", tertiaryColor: "#f2f2f2", noteBkgColor: "#fef0f0", noteTextColor: "#151515", fontFamily: "Red Hat Text, sans-serif" }});
</script>


<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

# Why Ray?

## From Python to Distributed Computing

Ray Data Academy — Session 1 of 4

---

<!-- _class: section-divider -->

# Part 1: The Single-Machine Wall

Why one machine stops being enough

---

## The problem: data outgrows your machine

You have a dataset of 10 billion rows. At 100 bytes per row, that's **1 TB** of data.

Your laptop has 16 GB of RAM. You can't even *load* the data, let alone process it.

<div class="mermaid">
graph LR
    subgraph "Single Machine"
        A[16 GB RAM] --> B[4 CPU Cores]
        B --> C[1 TB Disk]
    end
    subgraph "The Problem"
        D["10 Billion Rows
1 TB Data"]
    end
    D -->|"Won't fit in RAM"| A
</div>

<!-- This is the hook. Everyone has hit a memory error at some point. -->

---

## Three reasons you need distribution

| Problem | Single machine | Distributed |
|---|---|---|
| **Data doesn't fit** | 16 GB RAM limit | 64 machines = 1 TB RAM |
| **Too slow** | 4 cores, ~10 hours | 256 cores, ~10 minutes |
| **Machine dies** | You lose everything | Work is redistributed |

<!-- Fault tolerance is the one people forget about until prod goes down. -->

---

## The solution: use more machines

Split the data. Process in parallel. Combine results.

<div class="mermaid">
graph TD
    D[1 TB Dataset] --> S[Split]
    S --> M1["Machine 1
16 GB slice"]
    S --> M2["Machine 2
16 GB slice"]
    S --> M3["Machine 3
16 GB slice"]
    S --> M4["... Machine 64
16 GB slice"]
    M1 --> C[Combine Results]
    M2 --> C
    M3 --> C
    M4 --> C
    C --> R[Final Result]
</div>

---

## Sounds simple. It isn't.

Distribution introduces hard problems:

- **How do you split the data?** Not all splits are equal.
- **How do machines communicate?** Network is 1000x slower than memory.
- **What happens when a machine fails** mid-computation?
- **How do you collect results?** Some operations (like sorting) need coordination.

Frameworks like Ray exist to solve these problems for you.

<!-- Let them sit with the complexity before showing the solution. -->

---

<!-- _class: section-divider -->

# Part 2: Python's GIL Problem

Why Python makes this harder than it should be

---

## Python's dirty secret: the GIL

Python has a **Global Interpreter Lock** — a mutex that allows only one thread to execute Python bytecode at a time. 16-core machine, multi-threaded Python program? **One core doing Python work.**

<div class="mermaid">
graph TD
    subgraph "What you expect"
        T1A[Thread 1] --> C1A[Core 1]
        T2A[Thread 2] --> C2A[Core 2]
        T3A[Thread 3] --> C3A[Core 3]
        T4A[Thread 4] --> C4A[Core 4]
    end
    subgraph "What actually happens"
        T1B[Thread 1] --> GIL[GIL Lock]
        T2B[Thread 2] --> GIL
        T3B[Thread 3] --> GIL
        T4B[Thread 4] --> GIL
        GIL --> C1B[Core 1 only]
    end
</div>

<!-- Ask: "Who's tried threading in Python and been confused why it wasn't faster?" -->

---

## The multiprocessing workaround

Python's `multiprocessing` bypasses the GIL: separate processes, each with its own interpreter and memory. But to send data between processes, Python must **serialize** (pickle) it:

| Step | Time | Memory |
|---|---|---|
| Serialize (pickle) | ~2 seconds | +1 GB |
| Copy to other process | ~0.5 seconds | — |
| Deserialize (unpickle) | ~2 seconds | +1 GB |
| **Total** | **~4.5 seconds** | **2x original** |

For a 1 GB DataFrame: 4.5 seconds and double memory just to *move* the data.

---

## The serialization bottleneck

<div class="mermaid">
graph LR
    P1["Process 1
1 GB DataFrame"] -->|"pickle
~2s"| B["Bytes
1 GB copy"]
    B -->|"copy
~0.5s"| P2["Process 2
unpickle ~2s"]
</div>

Now imagine doing this for every chunk, to every worker, repeatedly.

What we actually need:

1. **No GIL limitation** — real parallel execution across cores and machines
2. **No serialization overhead** — shared memory so data doesn't get copied

---

<!-- _class: section-divider -->

# Part 3: Map-Reduce

The pattern behind everything

---

## The foundational pattern

Almost every data processing operation follows three steps:

1. **Split** the data into chunks
2. **Map** — process each chunk independently
3. **Reduce** — combine the results

This is **Map-Reduce**. The map step is *embarrassingly parallel* — no data element depends on another, so you can split across any number of workers.

<!-- This isn't MapReduce the Hadoop framework. It's the pattern that all distributed processing builds on. -->

---

## Map-Reduce visualized

<div class="mermaid">
graph TD
    D["Dataset
1000 rows"] --> S[Split into chunks]
    S --> C1["Chunk 1
250 rows"]
    S --> C2["Chunk 2
250 rows"]
    S --> C3["Chunk 3
250 rows"]
    S --> C4["Chunk 4
250 rows"]
    C1 -->|"Map: transform"| R1[Result 1]
    C2 -->|"Map: transform"| R2[Result 2]
    C3 -->|"Map: transform"| R3[Result 3]
    C4 -->|"Map: transform"| R4[Result 4]
    R1 --> RED[Reduce: combine]
    R2 --> RED
    R3 --> RED
    R4 --> RED
    RED --> F[Final Result]
</div>

---

## Word count: a concrete example

```python
# The Map-Reduce pattern in pseudocode

# Split
chunks = split_documents(all_documents, num_workers=4)

# Map (runs in parallel across workers)
partial_counts = [count_words(chunk) for chunk in chunks]

# Reduce (combine results)
total_counts = merge_counts(partial_counts)
```

When you write `ds.map_batches(transform)` in Ray Data, this is exactly what happens: Ray splits your dataset into blocks, maps your function across workers, and combines results.

---

<!-- _class: section-divider -->

# Part 4: Enter Ray

Distributed Python that feels like Python

---

## Ray's core insight

You write Python functions. Ray runs them across a cluster.

```python
# Regular Python — sequential, one core
def process(data):
    return transform(data)

results = [process(chunk) for chunk in chunks]
```

```python
# Ray — parallel, many cores, many machines
@ray.remote
def process(data):
    return transform(data)

futures = [process.remote(chunk) for chunk in chunks]
results = ray.get(futures)
```

---

## What changed?

Three things. That's it.

| Python | Ray |
|---|---|
| `def process(data):` | `@ray.remote` decorator |
| `process(chunk)` | `process.remote(chunk)` |
| Returns a value | Returns an `ObjectRef` (future) |
| Runs in your process | Runs in a worker process |
| Blocks until done | Returns immediately |

Plus `ray.get()` to collect results when you need them.

---

<!-- _class: section-divider -->

# Part 5: Ray's Architecture

How it works under the hood

---

## The Ray cluster

<div class="mermaid">
graph TD
    subgraph "Your Machine"
        D["Driver Program
ray.init, submit tasks"]
    end
    subgraph "Ray Cluster"
        H["Head Node
GCS + Scheduler"]
        subgraph "Worker Node 1"
            W1[Worker Process]
            O1["Object Store"]
        end
        subgraph "Worker Node 2"
            W2[Worker Process]
            O2["Object Store"]
        end
        subgraph "Worker Node N"
            W3[Worker Process]
            O3["Object Store"]
        end
    end
    D -->|"Submit tasks"| H
    H -->|"Schedule"| W1
    H -->|"Schedule"| W2
    H -->|"Schedule"| W3
    W1 <-->|"Zero-copy"| O1
    W2 <-->|"Zero-copy"| O2
    W3 <-->|"Zero-copy"| O3
    O1 <-->|"Transfer"| O2
    O2 <-->|"Transfer"| O3
</div>

---

## The key components

**Driver** — your Python script. Connects to the cluster, submits tasks, collects results. The conductor of the orchestra.

**Head Node** — runs the Global Control Store (GCS) and scheduler. Tracks all objects, actors, and cluster state. Decides which worker runs which task.

**Workers** — Python processes that execute your tasks. Can use CPU and/or GPU. Run on any node in the cluster.

**Object Store** — distributed shared memory on each node. Apache Arrow format. Zero-copy access for workers on the same node.

---

## Local mode vs. cluster mode

<div class="mermaid">
graph TD
    subgraph "Local Mode: ray.init()"
        L[Your Script] --> H1["Head Node + Workers
All on localhost"]
    end
    subgraph "Cluster Mode: ray.init address"
        R[Your Script] --> H2["Head Node
10.0.0.1"]
        H2 --> W1["Worker Node
10.0.0.2"]
        H2 --> W2["Worker Node
10.0.0.3"]
        H2 --> W3["Worker Node
10.0.0.4"]
    end
</div>

**Same code runs in both modes.** Develop locally, deploy to a cluster. No changes.

---

<!-- _class: section-divider -->

# Part 6: Core Primitives

Tasks, Actors, and the Object Store

---

## Tasks: functions that run in workers

A Ray **task** is a function decorated with `@ray.remote` that runs in a separate worker process.

```python
import ray

ray.init()

@ray.remote
def square(x):
    return x * x

# Returns an ObjectRef immediately — does NOT block
ref = square.remote(4)

# Blocks until the result is ready
result = ray.get(ref)  # 16
```

<!-- Live demo: show this in a notebook. Print ref to show it's an ObjectRef, not 16. -->

---

## Task execution model

<div class="mermaid">
graph LR
    D[Driver Process] -->|".remote(4)"| S[Scheduler]
    S -->|assign| W1[Worker 1]
    S -->|assign| W2[Worker 2]
    D -->|"returns ObjectRef
immediately"| D
    W1 -->|"result"| OS[Object Store]
    W2 -->|"result"| OS
    D -->|"ray.get(ref)"| OS
</div>

1. `.remote()` serializes function + args, sends to scheduler
2. Scheduler assigns to an available worker
3. `ObjectRef` returned immediately to driver
4. Worker writes result to object store
5. `ray.get()` fetches from object store (blocks if not ready)

---

## The right way to use tasks

```python
@ray.remote
def slow_square(x):
    time.sleep(1)  # Simulate expensive work
    return x * x

# WRONG: Sequential — takes 10 seconds
results = []
for i in range(10):
    ref = slow_square.remote(i)
    results.append(ray.get(ref))  # Blocks each time!

# RIGHT: Parallel — takes ~1 second
refs = [slow_square.remote(i) for i in range(10)]
results = ray.get(refs)  # Block once, get all
```

Submit all work first, then collect. Never call `ray.get()` in a loop.

---

## Task dependencies and resources

Pass `ObjectRef`s between tasks — Ray resolves them automatically. Data stays worker-to-worker; it never touches the driver.

```python
@ray.remote
def load_data(path):
    return pd.read_csv(path)

@ray.remote
def process(df):
    return df.describe()

# Pipeline: data flows worker-to-worker
data_ref = load_data.remote("data.csv")
result_ref = process.remote(data_ref)  # Pass ref directly
stats = ray.get(result_ref)
```

Tasks can also declare resource needs: `@ray.remote(num_cpus=4, num_gpus=1)`. The scheduler only places them on nodes with those resources available.

---

## Actors: stateful distributed objects

Tasks are stateless. But many workloads need **state** — a loaded model, a database connection, a counter. A Ray **actor** is a `@ray.remote` class with a dedicated worker process.

```python
@ray.remote
class Counter:
    def __init__(self):
        self.value = 0

    def increment(self):
        self.value += 1
        return self.value

counter = Counter.remote()       # Starts a worker process
counter.increment.remote()       # value = 1
counter.increment.remote()       # value = 2
print(ray.get(counter.increment.remote()))  # 3
```

---

## Actor lifecycle

<div class="mermaid">
graph TD
    D[Driver] -->|"Counter.remote()"| S[Scheduler]
    S -->|"Start process
Run __init__"| A["Actor Process
Counter"]
    D -->|".increment.remote()"| A
    D -->|".increment.remote()"| A
    D -->|".get_value.remote()"| A
    A -->|"state: value=2"| A
</div>

`MyClass.remote()` starts a worker process, runs `__init__`, returns an **actor handle**. The process lives until the handle is garbage collected, you call `ray.kill()`, or it crashes.

Method calls on a single actor are processed **one at a time, in order**. No locks needed. Thread safety by design.

---

## Scaling with actor pools

Need parallelism *and* state? Use multiple actors.

```python
from ray.util import ActorPool

@ray.remote
class TextProcessor:
    def __init__(self, model_name):
        self.model = load_model(model_name)  # Loaded once

    def process(self, text):
        return self.model.predict(text)

# 4 actors, each holding its own model copy
processors = [TextProcessor.remote("bert") for _ in range(4)]
pool = ActorPool(processors)

results = list(pool.map(
    lambda actor, t: actor.process.remote(t), texts
))
```

---

## Tasks vs. Actors

| | Tasks | Actors |
|---|---|---|
| **State** | Stateless | Stateful |
| **Decorator** | `@ray.remote` on function | `@ray.remote` on class |
| **Call** | `fn.remote()` | `actor.method.remote()` |
| **Lifetime** | One execution | Long-lived process |
| **Parallelism** | Embarrassingly parallel | Sequential per actor |
| **Use case** | Data transforms, batch jobs | Model serving, counters |

---

## The Object Store and ObjectRefs

Every `.remote()` call returns an `ObjectRef` — a pointer to a value that may not exist yet. The actual data lives in Ray's **object store**, not in your driver.

```python
@ray.remote
def generate_data():
    return np.random.rand(1_000_000)

ref = generate_data.remote()
print(type(ref))   # <class 'ray.ObjectRef'>

data = ray.get(ref)  # Fetch the actual array
```

Each node runs a shared-memory object store so multiple workers read the same data without copying.

---

## How the object store works

<div class="mermaid">
graph TD
    subgraph "Node 1"
        W1[Worker 1] -->|"read"| OS1["Object Store
Shared Memory"]
        W2[Worker 2] -->|"read"| OS1
        W3[Worker 3] -->|"read"| OS1
    end
    subgraph "Node 2"
        W4[Worker 4] -->|"read"| OS2["Object Store
Shared Memory"]
        W5[Worker 5] -->|"read"| OS2
    end
    OS1 ---|"network transfer
only when needed"| OS2
</div>

Workers on the same node share memory. Cross-node transfers happen automatically only when a task needs remote data.

---

## ray.put(): store once, share everywhere

When you pass a large object to many tasks, the driver serializes it **each time**. `ray.put()` stores it once.

```python
big_array = np.random.rand(10_000_000)  # ~80 MB

# BAD: Serializes big_array 100 times = 8 GB of work
refs = [process.remote(big_array) for _ in range(100)]

# GOOD: Serialize once, share the ref = 80 MB total
big_ref = ray.put(big_array)
refs = [process.remote(big_ref) for _ in range(100)]
```

For a 100 MB array sent to 100 tasks: **10 GB** vs. **100 MB**.

---

## Zero-copy reads

Workers on the same node read objects directly from shared memory via memory mapping. No data is copied into the worker's heap.

<div class="mermaid">
graph LR
    subgraph "Same Node"
        P["ray.put
np.array"] -->|"write once"| SM["Shared Memory
100 MB"]
        SM -->|"mmap read
zero-copy"| T1[Task 1]
        SM -->|"mmap read
zero-copy"| T2[Task 2]
        SM -->|"mmap read
zero-copy"| T3[Task 3]
    end
</div>

Works with **NumPy arrays** and **Arrow tables** out of the box. This is why Ray Data uses Arrow format internally.

---

## Object lifetime and spilling

Objects stay in memory as long as an `ObjectRef` references them. When the store fills up, Ray **spills to disk** automatically and reloads on demand.

```python
ref = ray.put(large_data)      # Stored in object store
del ref                         # Eligible for eviction

# Spilled objects reload transparently
result = ray.get(some_old_ref)  # May trigger disk read
```

You don't manage memory. Ray does.

---

<!-- _class: section-divider -->

# Part 7: Putting It Together

Starting Ray and running your first program

---

## Starting Ray: ray.init()

Every Ray program starts here.

```python
import ray

# Local cluster — every CPU core becomes a worker
ray.init()

# Connect to an existing cluster
ray.init(address="ray://my-cluster:10001")

# With runtime environment for reproducibility
ray.init(runtime_env={"pip": ["pandas", "pyarrow"]})
```

No arguments = local mode. Perfect for development. The dashboard runs at **port 8265**.

---

## End-to-end example

```python
import ray, time

ray.init()

@ray.remote
def process_chunk(chunk_id, size=1_000_000):
    """Simulate processing a data chunk."""
    time.sleep(1)
    return {"chunk": chunk_id, "rows": size}

# Launch 8 tasks in parallel
refs = [process_chunk.remote(i) for i in range(8)]

# Collect all results — blocks once
results = ray.get(refs)
print(f"Processed {len(results)} chunks")

ray.shutdown()
```

8 chunks, 1 second each, ~1 second total (with 8+ cores).

---

## Best practices

> **Do:** Submit all work first, collect results later.

> **Do:** Use `ray.put()` for large objects shared across tasks.

> **Do:** Pass `ObjectRef`s between tasks to keep data worker-to-worker.

> **Don't:** Call `ray.get()` inside a loop — it serializes your parallelism.

> **Don't:** Pass large raw objects to many tasks — use `ray.put()` first.

> **Don't:** Forget to call `ray.shutdown()` when you're done.

---

<!-- _class: section-divider -->

# Summary

---

## What we covered

1. **The single-machine wall** — RAM, CPU, and fault tolerance limits
2. **Python's GIL** — threads don't give you real parallelism
3. **Multiprocessing costs** — serialization overhead kills data-heavy workloads
4. **Map-Reduce** — split, process, combine: the universal pattern
5. **Ray's architecture** — driver, head node, workers, object store
6. **Tasks** — stateless parallel functions with `@ray.remote`
7. **Actors** — stateful distributed objects with `@ray.remote` on classes
8. **Object Store** — shared memory, zero-copy reads, `ray.put()`
9. **ray.init()** — local development, cluster deployment, same code

---

## The mental model

```
Python function  ──(@ray.remote)──>  Distributed task
Python class     ──(@ray.remote)──>  Distributed actor
Large data       ──(ray.put)──────>  Shared memory (zero-copy)
ObjectRef        ──(ray.get)──────>  Actual value
```

Ray takes Python constructs you already know and distributes them across a cluster. The API surface is tiny. The power is in the runtime.

---

## Session 2: Ray Data — Scalable Data Processing

In the next session, we move from Ray Core to **Ray Data**:

- **Datasets** — distributed collections of Arrow-backed blocks
- **Transformations** — `map_batches`, `filter`, `flat_map`
- **Streaming execution** — process data that doesn't fit in memory
- **Reading and writing** — Parquet, CSV, JSON, and custom sources
- **Integration** — connecting Ray Data to training and inference

Everything you learned today — tasks, actors, the object store — is the foundation Ray Data builds on.

<!-- Encourage people to play with ray.init() and tasks before the next session. -->

---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

# Questions?

Ray Data Academy — Session 1

ray.io/docs
