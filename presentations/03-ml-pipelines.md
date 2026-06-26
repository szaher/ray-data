---
marp: true
theme: ray-academy
paginate: true
header: 'Ray Data Academy'
footer: 'Session 3: ML Pipelines and Real-World Patterns'
---

<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: "base", themeVariables: { primaryColor: "#e0f0ff", primaryTextColor: "#151515", primaryBorderColor: "#0066cc", lineColor: "#0066cc", secondaryColor: "#daf2f2", tertiaryColor: "#f2f2f2", noteBkgColor: "#fef0f0", noteTextColor: "#151515", fontFamily: "Red Hat Text, sans-serif" }});
</script>


<!-- _class: lead -->

# ML Pipelines and Real-World Patterns

## Ray Data Academy — Session 3

Deck 3 of 4 | Building production ML systems with Ray Data

<!-- This is session 3. We assume attendees have completed sessions 1 (foundations) and 2 (streaming architecture). Today we go from concepts to production patterns. -->

---

## What we'll cover today

1. **GPU batch inference** — the actor pool pattern
2. **Ray Data + Ray Train** — distributed training data pipelines
3. **Ray Data + Ray Serve** — online inference
4. **Preprocessors** — reusable, composable transforms
5. **Real-world projects** — image, LLM, ETL, and serving pipelines
6. **Performance benchmarking** — measuring and tuning

<!-- This deck is the practical core of the workshop. Everything here maps to production patterns you'll use. -->

---

<!-- _class: section-divider -->

# GPU Batch Inference

The pattern that makes large-scale model inference practical

---

## The GPU inference challenge

Running a model on millions of inputs means solving two problems at once:

1. **Model loading is expensive** — you want to load it once, not per-batch
2. **GPUs need saturation** — they only reach full speed with large batches

Ray Data solves both through `map_batches` combined with actor pools.

<!-- The naive approach — load model, predict, repeat — wastes most of your time on model loading. The actor pattern fixes this. -->

---

## How actor pools work

<div class="mermaid">
graph LR
    DS[Dataset\nMillions of rows] --> B1[Batch 1\n1024 rows]
    DS --> B2[Batch 2\n1024 rows]
    DS --> B3[Batch 3\n1024 rows]
    B1 --> G1["GPU Actor 1\n(model loaded once)"]
    B2 --> G2["GPU Actor 2\n(model loaded once)"]
    B3 --> G1
    G1 --> R1[Predictions]
    G2 --> R2[Predictions]
</div>

Data gets split into batches. Each batch is routed to a persistent GPU actor that already has the model loaded. No redundant loading.

---

## The callable class pattern

The constructor loads the model **once**. `__call__` runs inference on each batch.

```python
class ImageClassifier:
    def __init__(self):
        import torch
        from torchvision.models import resnet50, ResNet50_Weights
        self.model = resnet50(
            weights=ResNet50_Weights.DEFAULT
        ).cuda().eval()
        self.transforms = ResNet50_Weights.DEFAULT.transforms()

    def __call__(self, batch: dict) -> dict:
        import torch
        images = [self.transforms(img) for img in batch["image"]]
        tensor = torch.stack(images).cuda()
        with torch.no_grad():
            preds = self.model(tensor)
        batch["prediction"] = preds.argmax(dim=1).cpu().numpy()
        return batch
```

<!-- Key insight: imports inside __init__ and __call__ because these run on workers, not the driver. -->

---

## Putting it together: ActorPoolStrategy

`ActorPoolStrategy` creates a fixed pool of GPU actors. Each loads the model once, then processes many batches over its lifetime.

```python
ds = ray.data.read_images("s3://my-bucket/images/")

predictions = ds.map_batches(
    ImageClassifier,
    compute=ActorPoolStrategy(size=4),  # 4 GPU workers
    num_gpus=1,                         # 1 GPU per worker
    batch_size=256,                     # rows per batch
)

predictions.write_parquet("s3://my-bucket/results/")
```

Three parameters control everything: **pool size**, **GPUs per worker**, and **batch size**.

---

## Batch size tuning

Choose `batch_size` based on GPU memory. Too small wastes GPU cycles. Too large causes OOM.

<div class="mermaid">
graph TD
    subgraph "Batch Size Tradeoffs"
    SM["batch_size=32\nLow GPU utilization\nSafe on memory"] --> MED["batch_size=256\nGood throughput\nRecommended start"]
    MED --> LG["batch_size=1024\nMax throughput\nRisk of OOM"]
    end
</div>

Start at **256**. Monitor with `nvidia-smi`. Increase until you hit ~80% GPU memory.

<!-- The sweet spot depends on your model and input size. ResNet with 224x224 images can usually handle 256-512. Larger models need smaller batches. -->

---

## Batch size guidance by workload

| Workload | Start | Sweet spot | Watch for |
|---|---|---|---|
| Image classification | 64 | 256-512 | OOM on high-res images |
| Text generation (HF) | 8 | 32-64 | Memory-bound |
| Text generation (vLLM) | 128 | 256-512 | Continuous batching helps |
| Embeddings | 256 | 1024-4096 | Usually compute-bound |

The right batch size is the one where `nvidia-smi` shows ~80% memory and GPU utilization stays above 90%.

---

<!-- _class: section-divider -->

# Ray Data + Ray Train

CPU preprocessing, GPU training — no idle resources

---

## The data loading bottleneck

In distributed training, each GPU worker needs a continuous stream of preprocessed batches. If data loading is slow, GPUs sit idle.

Ray Data fixes this by running preprocessing on **separate CPU workers** and streaming results to trainers.

<div class="mermaid">
graph LR
    subgraph "Ray Data (CPU workers)"
    R[Read] --> P[Preprocess]
    end
    subgraph "Ray Train (GPU workers)"
    P -->|stream shard 1| W1["Worker 1\nGPU 0"]
    P -->|stream shard 2| W2["Worker 2\nGPU 1"]
    P -->|stream shard 3| W3["Worker 3\nGPU 2"]
    end
</div>

<!-- This is the key architecture: CPU workers do the heavy data lifting so GPU workers never wait. The streaming execution model makes the overlap automatic. -->

---

## Passing datasets to a trainer

Create your Ray Dataset outside the trainer, then pass it via `datasets`. Ray Train handles sharding automatically.

```python
import ray
from ray.train.torch import TorchTrainer
from ray.train import ScalingConfig

# 1. Create and preprocess the dataset
train_ds = ray.data.read_parquet("s3://bucket/train/")
train_ds = train_ds.map_batches(normalize, batch_size=4096)

val_ds = ray.data.read_parquet("s3://bucket/val/")

# 2. Pass datasets to the trainer
trainer = TorchTrainer(
    train_loop_per_worker=train_fn,
    datasets={"train": train_ds, "val": val_ds},
    scaling_config=ScalingConfig(num_workers=4, use_gpu=True),
)
result = trainer.fit()
```

---

## The training function

Inside each worker, `get_dataset_shard` returns that worker's portion. `iter_torch_batches` gives you PyTorch tensors directly.

```python
def train_fn(config):
    model = build_model().cuda()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    # Each worker gets its own shard automatically
    train_shard = ray.train.get_dataset_shard("train")

    for epoch in range(config.get("epochs", 10)):
        for batch in train_shard.iter_torch_batches(
            batch_size=256, dtypes=torch.float32,
        ):
            features = batch["features"].cuda()
            labels = batch["labels"].cuda()
            loss = train_step(model, optimizer, features, labels)
        report({"loss": loss.item(), "epoch": epoch})
```

<!-- Two key APIs: get_dataset_shard splits data across workers. iter_torch_batches converts Arrow to PyTorch tensors with zero-copy where possible. -->

---

## End-to-end data flow

<div class="mermaid">
graph TD
    S3["S3 / Parquet Files"] --> RD["ray.data.read_parquet()"]
    RD --> PP["map_batches(preprocess)"]
    PP --> TR["TorchTrainer(datasets=...)"]
    TR --> SH1["get_dataset_shard\nWorker 1"]
    TR --> SH2["get_dataset_shard\nWorker 2"]
    SH1 --> IT1["iter_torch_batches()"]
    SH2 --> IT2["iter_torch_batches()"]
    IT1 --> GPU1["Training on GPU 0"]
    IT2 --> GPU2["Training on GPU 1"]
</div>

Preprocessing and training overlap via streaming. GPUs stay fed without idle time.

---

## Key takeaway: separation of concerns

| Concern | Who handles it |
|---|---|
| Reading data | Ray Data — distributed, streaming |
| Preprocessing | Ray Data — on CPU workers |
| Sharding | Ray Train — automatic, even splits |
| Format conversion | `iter_torch_batches` — Arrow to tensors |
| Training | Your code — on GPU workers |

You write the preprocessing logic and the training loop. Ray handles the plumbing between them.

---

<!-- _class: section-divider -->

# Ray Data + Ray Serve

From batch pipeline to online endpoint

---

## The training-serving skew problem

A common production pitfall: you train with one preprocessing pipeline but serve with a different one. Small differences in normalization, tokenization, or feature engineering cause silent accuracy degradation.

<div class="mermaid">
graph LR
    subgraph "Training Pipeline"
    TD[Training Data] --> PP1["Preprocessor\n(Ray Data)"] --> MODEL1[Train Model]
    end
    subgraph "Serving Pipeline"
    REQ[HTTP Request] --> PP2["Same Preprocessor\n(Ray Data)"] --> MODEL2[Run Inference]
    MODEL2 --> RESP[Response]
    end
</div>

The fix: define preprocessing **once**, reuse it in both contexts.

<!-- Training-serving skew is one of the most common causes of degraded model performance in production. It's subtle because the model still returns predictions — they're just wrong. -->

---

## A basic Ray Serve deployment

Load the model in `__init__`, handle requests in `__call__`. Same pattern as batch inference.

```python
from ray import serve

@serve.deployment(
    num_replicas=2,
    ray_actor_options={"num_gpus": 1}
)
class TextClassifier:
    def __init__(self):
        from transformers import pipeline
        self.model = pipeline(
            "text-classification",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=0,
        )

    async def __call__(self, request):
        data = await request.json()
        result = self.model(data["text"])
        return {"label": result[0]["label"],
                "score": result[0]["score"]}
```

---

## Multi-stage serving pipeline

Compose deployments using `.bind()`. Preprocessor handles tokenization on CPU, model runs inference on GPU.

```python
@serve.deployment(num_replicas=2)
class Preprocessor:
    def __init__(self):
        from transformers import AutoTokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            "distilbert-base-uncased")

    async def __call__(self, text: str) -> dict:
        return self.tokenizer(
            text, padding="max_length",
            truncation=True, max_length=128)

preprocessor = Preprocessor.bind()
app = ModelInference.bind(preprocessor)
serve.run(app)
```

<!-- The .bind() API lets you wire deployments together. Each stage scales independently. -->

---

## Deployment architecture

<div class="mermaid">
graph TD
    CLIENT["HTTP Client"] --> INGRESS["Ray Serve Ingress"]
    INGRESS --> P1["Preprocessor\nReplica 1 (CPU)"]
    INGRESS --> P2["Preprocessor\nReplica 2 (CPU)"]
    P1 --> M1["Model\nReplica 1 (GPU)"]
    P2 --> M2["Model\nReplica 2 (GPU)"]
    M1 --> CLIENT
    M2 --> CLIENT
</div>

CPU preprocessing scales on cheap CPU replicas. GPU inference runs on dedicated GPU replicas. Ray Serve autoscales each stage independently based on load.

---

## Shared preprocessing: batch + online

The same `compute_features` function in both pipelines:

```python
def compute_features(batch: dict) -> dict:
    amounts = np.array(batch["amount"], dtype=np.float32)
    batch["log_amount"] = np.log1p(amounts)
    batch["is_high_value"] = (amounts > 1000).astype(np.int32)
    hours = np.array([int(t[11:13]) for t in batch["timestamp"]])
    batch["hour_sin"] = np.sin(2 * np.pi * hours / 24).astype(np.float32)
    batch["hour_cos"] = np.cos(2 * np.pi * hours / 24).astype(np.float32)
    return batch
```

**Batch path:** `ds.map_batches(compute_features)`
**Online path:** `compute_features({"amount": [payload["amount"]], ...})`

Update once, both pipelines stay in sync.

---

<!-- _class: section-divider -->

# Preprocessors

Reusable, composable, portable transforms

---

## Why preprocessors?

ML pipelines need consistent data transformations at training and inference time. Preprocessors encapsulate transforms as **portable, composable objects**.

<div class="mermaid">
graph LR
    RAW[Raw Data] --> P1["StandardScaler\n(normalize)"]
    P1 --> P2["OneHotEncoder\n(categoricals)"]
    P2 --> P3["BatchMapper\n(custom features)"]
    P3 --> READY["ML-Ready\nDataset"]
</div>

Fit once on training data. Apply identically everywhere.

---

## Built-in preprocessors

Ray Data ships with common ML preprocessors. They follow a **fit/transform** pattern.

```python
from ray.data.preprocessors import (
    StandardScaler, MinMaxScaler, OrdinalEncoder
)

# StandardScaler: zero mean, unit variance
scaler = StandardScaler(columns=["age", "income", "score"])

# MinMaxScaler: scale to [0, 1] range
minmax = MinMaxScaler(columns=["price", "quantity"])

# OrdinalEncoder: convert categories to integers
encoder = OrdinalEncoder(columns=["city", "product_type"])

# Fit on training data, then transform
ds = ray.data.read_parquet("s3://bucket/train/")
scaler.fit(ds)
transformed = scaler.transform(ds)
```

---

## Custom transforms with BatchMapper

When built-ins don't cover your use case, `BatchMapper` lets you write arbitrary functions.

```python
from ray.data.preprocessors import BatchMapper
import numpy as np

def add_features(batch: dict) -> dict:
    batch["price_per_sqft"] = batch["price"] / batch["sqft"]
    batch["log_income"] = np.log1p(batch["income"])
    batch["age_bucket"] = (batch["age"] // 10) * 10
    return batch

feature_eng = BatchMapper(add_features, batch_format="numpy")
```

Use it for text tokenization, image augmentation, domain-specific feature engineering — anything the built-in preprocessors don't cover.

---

## Composing with Chain

`Chain` combines multiple preprocessors into a single pipeline. Order matters.

```python
from ray.data.preprocessors import Chain, StandardScaler, OrdinalEncoder

preprocessor = Chain(
    OrdinalEncoder(columns=["city", "category"]),
    BatchMapper(add_features, batch_format="numpy"),
    StandardScaler(columns=["price_per_sqft", "log_income", "score"]),
)

# Fit the entire chain on training data
train_ds = ray.data.read_parquet("s3://bucket/train/")
preprocessor.fit(train_ds)
train_processed = preprocessor.transform(train_ds)

# Same chain at inference time -- guarantees consistency
test_ds = ray.data.read_parquet("s3://bucket/test/")
test_processed = preprocessor.transform(test_ds)
```

<!-- Chain is the answer to "how do I ensure training and serving use the same preprocessing?" Build the chain once, serialize it, load it everywhere. -->

---

## Preprocessors with Ray Train

Pass the preprocessor to the Trainer. It gets applied automatically and **saved with checkpoints**.

```python
from ray.train.torch import TorchTrainer
from ray.train import ScalingConfig

trainer = TorchTrainer(
    train_loop_per_worker=train_fn,
    datasets={"train": train_ds, "val": val_ds},
    preprocessor=preprocessor,  # auto-applied
    scaling_config=ScalingConfig(
        num_workers=4, use_gpu=True
    ),
)
result = trainer.fit()
```

When you load a checkpoint later for serving, the preprocessor comes with it. No separate tracking needed.

---

## The consistency guarantee

| Stage | How preprocessor is applied |
|---|---|
| Training | `preprocessor=` argument to Trainer |
| Evaluation | `preprocessor.transform(eval_ds)` |
| Batch inference | `preprocessor.transform(new_ds)` |
| Online serving | Loaded from checkpoint, applied to requests |

One definition, four contexts, zero skew.

---

<!-- _class: section-divider -->

# Project: End-to-End Image Pipeline

Read, resize, normalize, classify — at scale

---

## Image pipeline architecture

<div class="mermaid">
graph LR
    A[Read Images\nS3 / Local] --> B[Resize & Normalize\nCPU]
    B --> C[Classify\nResNet on GPU]
    C --> D[Write Results\nParquet]
</div>

Images are independent, processing is compute-heavy, and throughput matters. This is Ray Data's sweet spot.

---

## Step 1: read and preprocess

```python
import ray
import numpy as np

ds = ray.data.read_images("s3://my-bucket/images/", mode="RGB")

def preprocess(batch: dict) -> dict:
    from PIL import Image
    images = []
    for img in batch["image"]:
        pil = Image.fromarray(img).resize((224, 224))
        arr = np.array(pil, dtype=np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        images.append((arr - mean) / std)
    batch["image"] = np.stack(images)
    return batch

ds = ds.map_batches(preprocess, batch_format="numpy")
```

<!-- ImageNet normalization constants. These must match what the model was trained with. -->

---

## Step 2: GPU classification

```python
import torch
from torchvision.models import resnet50, ResNet50_Weights

class ImageClassifier:
    def __init__(self):
        self.model = resnet50(
            weights=ResNet50_Weights.DEFAULT
        ).eval().cuda()
        self.labels = ResNet50_Weights.DEFAULT.meta["categories"]

    def __call__(self, batch: dict) -> dict:
        tensors = torch.from_numpy(
            batch["image"]
        ).permute(0, 3, 1, 2).cuda()
        with torch.no_grad():
            preds = self.model(tensors).argmax(dim=1).cpu().numpy()
        return {"label": [self.labels[p] for p in preds]}

ds = ds.map_batches(
    ImageClassifier, batch_size=64, concurrency=2, num_gpus=1
)
ds.write_parquet("s3://my-bucket/results/")
```

---

## Image pipeline resource layout

<div class="mermaid">
graph TD
    subgraph CPU["CPU Workers"]
        R[read_images] --> P[preprocess]
    end
    subgraph GPU["GPU Actors x2"]
        P --> G1[Classifier\nGPU 0]
        P --> G2[Classifier\nGPU 1]
    end
    G1 --> W[write_parquet]
    G2 --> W
</div>

`read_images` handles decoding. CPU transforms scale automatically. GPU stage uses `concurrency=2` for two parallel actors. The model loads once per actor.

---

<!-- _class: section-divider -->

# Project: LLM Batch Inference

Running language models over millions of prompts

---

## LLM batch inference architecture

<div class="mermaid">
graph LR
    A[Read Prompts\nParquet] --> B[LLM Inference\nGPU Actors]
    B --> C[Write Results\nParquet]
</div>

Each prompt is independent. GPU utilization is critical. Batching improves throughput. Same pattern, bigger models.

---

## Approach 1: HuggingFace Transformers

Works well for models that fit on a single GPU.

```python
ds = ray.data.read_parquet("s3://data/prompts/")

class HFPredictor:
    def __init__(self):
        from transformers import pipeline
        self.pipe = pipeline(
            "text-generation",
            model="meta-llama/Llama-3.1-8B-Instruct",
            device="cuda", torch_dtype="auto",
        )

    def __call__(self, batch: dict) -> dict:
        outputs = self.pipe(
            batch["prompt"].tolist(),
            max_new_tokens=256,
            batch_size=len(batch["prompt"]),
        )
        batch["response"] = [o[0]["generated_text"]
                             for o in outputs]
        return batch

ds = ds.map_batches(
    HFPredictor, batch_size=32, concurrency=4, num_gpus=1
)
```

---

## Approach 2: vLLM for high throughput

vLLM uses PagedAttention and continuous batching. Supports tensor parallelism for large models.

```python
class VLLMPredictor:
    def __init__(self):
        from vllm import LLM, SamplingParams
        self.llm = LLM(
            model="meta-llama/Llama-3.1-70B-Instruct",
            tensor_parallel_size=4,
            max_model_len=4096,
        )
        self.params = SamplingParams(
            temperature=0.7, max_tokens=512
        )

    def __call__(self, batch: dict) -> dict:
        outputs = self.llm.generate(
            batch["prompt"].tolist(), self.params
        )
        batch["response"] = [o.outputs[0].text
                             for o in outputs]
        return batch

ds.map_batches(
    VLLMPredictor, batch_size=256, concurrency=2, num_gpus=4
)
```

---

## vLLM resource layout

<div class="mermaid">
graph TD
    DS[Dataset\n1M prompts] --> A1[Actor 1\n4 GPUs\ntensor parallel]
    DS --> A2[Actor 2\n4 GPUs\ntensor parallel]
    A1 --> OUT[Results Parquet]
    A2 --> OUT
</div>

Each actor uses 4 GPUs with tensor parallelism. `concurrency=2` means 8 GPUs total processing batches in parallel.

---

## HuggingFace vs vLLM comparison

| | HuggingFace | vLLM |
|---|---|---|
| Best for | Single-GPU models | Large models, high throughput |
| Batch size | 8-64 | 128-512 |
| Multi-GPU | Manual | `tensor_parallel_size` |
| Batching | Static | Continuous (PagedAttention) |
| GPUs per actor | 1 | 1-8 |
| Throughput | Good | Excellent |

Use HuggingFace for simplicity. Use vLLM when throughput matters or the model needs multiple GPUs.

---

<!-- _class: section-divider -->

# Project: ETL Pipeline

Read from multiple sources, clean, enrich, write partitioned output

---

## ETL pipeline architecture

<div class="mermaid">
graph LR
    A[Read Events\nParquet] --> C[Clean & Validate]
    B[Read Users\nCSV] --> D[Broadcast Lookup]
    C --> E[Enrich: Join Users]
    D --> E
    E --> F[Write Partitioned\nParquet]
</div>

Ray Data streams data without materializing entire datasets in memory. Well-suited for ETL.

---

## Step 1: extract from multiple sources

```python
import ray

# Main dataset — streaming, not materialized
events = ray.data.read_parquet(
    "s3://datalake/raw/events/2025-06/"
)

# Small lookup table — materialized for broadcast join
users_list = ray.data.read_csv(
    "s3://datalake/dim/users.csv"
).take_all()
user_lookup = {u["user_id"]: u for u in users_list}
```

The events stream. The users table is small enough to materialize into a dict. This is the **broadcast join** pattern.

<!-- Ray Data doesn't have SQL-style joins. The standard approach: materialize the small side, reference it in map_batches. This is efficient and avoids shuffle. -->

---

## Step 2: clean and validate

```python
import numpy as np

def clean(batch: dict) -> dict:
    # Drop rows with missing user_id
    mask = batch["user_id"] != b""
    batch = {k: v[mask] for k, v in batch.items()}
    # Normalize event types
    batch["event_type"] = np.array(
        [e.decode().lower() for e in batch["event_type"]]
    )
    return batch

events = events.map_batches(clean, batch_format="numpy")
```

Filter invalid rows, normalize strings, enforce types — all in a single streaming pass.

---

## Step 3: enrich with broadcast join

```python
def enrich(batch: dict) -> dict:
    countries, segments = [], []
    for uid in batch["user_id"]:
        user = user_lookup.get(uid.decode(), {})
        countries.append(user.get("country", "unknown"))
        segments.append(user.get("segment", "unknown"))
    batch["country"] = countries
    batch["segment"] = segments
    return batch

events = events.map_batches(enrich, batch_format="numpy")
```

The `user_lookup` dict is captured in the closure and serialized to each worker. No shuffle, no coordination needed.

---

## Step 4: write partitioned output

```python
def add_date_partition(batch: dict) -> dict:
    batch["date"] = np.array(
        [ts.decode()[:10] for ts in batch["timestamp"]]
    )
    return batch

events = events.map_batches(
    add_date_partition, batch_format="numpy"
)
events.write_parquet(
    "s3://datalake/curated/events/",
    partition_cols=["date", "country"],
)
```

`partition_cols` enables downstream **partition pruning** — query engines skip entire file groups that don't match filter predicates.

---

## ETL data flow

<div class="mermaid">
graph TD
    RAW["Raw Zone\ns3://datalake/raw/"] --> PIPE["Ray Data Pipeline\nClean -> Enrich -> Partition"]
    DIM["Dimension Tables\ns3://datalake/dim/"] --> PIPE
    PIPE --> CURATED["Curated Zone\nPartitioned by date & country"]
</div>

Streaming execution means you process terabytes without terabytes of memory. The pipeline reads, transforms, and writes in a continuous flow.

---

<!-- _class: section-divider -->

# Project: Online Serving

Multi-model deployments with autoscaling

---

## Online serving architecture

<div class="mermaid">
graph LR
    A[HTTP Request] --> B[Ray Serve\nDeployment]
    B --> C[Feature Engineering\nShared transforms]
    C --> D[Model Inference\nGPU]
    D --> E[HTTP Response]
</div>

Reuse the same preprocessing logic from your batch pipeline in the serving path. Same function, different context.

---

## Fraud detection: serving deployment

```python
from ray import serve
from starlette.requests import Request

@serve.deployment(
    num_replicas=2,
    ray_actor_options={"num_gpus": 1}
)
class FraudDetector:
    def __init__(self):
        import torch
        self.model = torch.jit.load("model.pt").eval().cuda()

    async def __call__(self, request: Request) -> dict:
        import torch
        payload = await request.json()
        features = compute_features({
            "amount": [payload["amount"]],
            "timestamp": [payload["timestamp"]],
        })
        tensor = torch.tensor([[
            features["log_amount"][0],
            features["is_high_value"][0],
            features["hour_sin"][0],
            features["hour_cos"][0],
        ]], dtype=torch.float32).cuda()
        with torch.no_grad():
            score = self.model(tensor).item()
        return {"fraud_score": score, "is_fraud": score > 0.5}
```

---

## Testing the endpoint

```python
import requests

resp = requests.post(
    "http://localhost:8000/predict",
    json={
        "amount": 5432.10,
        "timestamp": "2025-06-15T02:30:00Z",
    },
)
print(resp.json())
# {"fraud_score": 0.87, "is_fraud": true}
```

The `compute_features` function is identical in both batch and online paths. Update the feature logic once, both pipelines stay in sync.

---

## Multi-model composition with .bind()

```python
@serve.deployment(num_replicas=2)
class Preprocessor:
    def __init__(self):
        from transformers import AutoTokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            "distilbert-base-uncased"
        )

    async def __call__(self, text: str) -> dict:
        return self.tokenizer(
            text, padding="max_length",
            truncation=True, max_length=128
        )

@serve.deployment(num_replicas=2, ray_actor_options={"num_gpus": 1})
class ModelInference:
    def __init__(self, preprocessor):
        self.preprocessor = preprocessor
        # ... load model

    async def __call__(self, request):
        data = await request.json()
        tokens = await self.preprocessor.remote(data["text"])
        # ... run inference
```

---

## Autoscaling configuration

Ray Serve autoscales each deployment independently based on request load.

| Parameter | Purpose | Example |
|---|---|---|
| `num_replicas` | Fixed replica count | `2` |
| `autoscaling_config` | Dynamic scaling | min=1, max=10 |
| `ray_actor_options` | Resource per replica | `{"num_gpus": 1}` |
| `max_ongoing_requests` | Concurrency limit | `10` |

CPU preprocessing scales cheaply. GPU inference scales based on latency targets. Each stage is independent.

<!-- The key insight: different stages have different scaling characteristics. CPU stages are cheap to replicate. GPU stages are expensive. Autoscaling lets you optimize each independently. -->

---

<!-- _class: section-divider -->

# Performance Benchmarking

Measuring, diagnosing, and tuning

---

## The benchmarking loop

Optimizing without measurement is guesswork.

<div class="mermaid">
graph LR
    A[Baseline\nMeasure] --> B[Identify\nBottleneck]
    B --> C[Tune\nParameters]
    C --> D[Re-measure]
    D -->|"Still slow?"| B
    D -->|"Fast enough"| E[Ship It]
</div>

Always start with a baseline. Change one parameter at a time. Measure again.

---

## Profiling with ds.stats()

```python
import ray, time

ds = ray.data.read_parquet("s3://data/events/", parallelism=200)
ds = ds.map_batches(lambda b: b, batch_size=4096)

start = time.perf_counter()
result = ds.materialize()
elapsed = time.perf_counter() - start

print(f"Total: {elapsed:.1f}s")
print(result.stats())
# ReadParquet: 200 blocks, 12.3s, 450 MB/s
# MapBatches:  200 blocks,  8.1s, 680 MB/s
```

`ds.stats()` shows per-stage wall time, throughput (rows/sec, MB/sec), block counts, and memory usage.

<!-- This is the primary diagnostic tool. Always start here. The slowest stage is your bottleneck. -->

---

## A reusable benchmark framework

```python
def benchmark(name, pipeline_fn, runs=3):
    times = []
    for _ in range(runs):
        start = time.perf_counter()
        pipeline_fn().materialize()
        times.append(time.perf_counter() - start)
    avg = sum(times) / len(times)
    best = min(times)
    print(f"{name}: avg={avg:.1f}s best={best:.1f}s")

# Sweep batch sizes
for bs in [1024, 4096, 8192]:
    benchmark(
        f"batch_size={bs}",
        lambda bs=bs: ray.data.read_parquet("s3://data/events/")
            .map_batches(lambda b: b, batch_size=bs),
    )
```

Run multiple iterations. Report average and best. First run often includes JIT warmup.

---

## Parameters that affect throughput

<div class="mermaid">
graph TD
    A["batch_size\n1K-64K"] --> T[Throughput]
    B["concurrency\n1-N actors"] --> T
    C["parallelism\nread splits"] --> T
    D["num_cpus / num_gpus"] --> T
    T --> M["ds.stats()"]
</div>

Four knobs. Tune one at a time. Measure with `ds.stats()` after each change.

---

## Common bottlenecks and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Low read throughput | Too few blocks | Increase `parallelism` |
| CPU stage slow | Not enough workers | Increase `concurrency` |
| GPU idle | CPU can't keep up | Add CPU workers, simplify preprocessing |
| OOM errors | Batches too large | Reduce `batch_size` or `target_max_block_size` |
| Uneven work | Data skew | Repartition or increase block count |

Always start with `ds.stats()`, find the slowest operator, and tune that stage first.

---

## When to use Ray Data vs alternatives

| Workload | Ray Data | Spark | Dask |
|---|---|---|---|
| GPU ML pipelines | Best choice | Limited GPU support | Limited GPU support |
| Mixed CPU/GPU | Streaming overlap | Manual coordination | Manual coordination |
| SQL-heavy analytics | Not ideal | Best choice | Decent |
| Large shuffle joins | Use broadcast pattern | Native support | Native support |
| Arrow zero-copy | Native | Via conversion | Via conversion |

Ray Data excels at GPU-heavy ML pipelines and mixed CPU/GPU workloads. Use Spark for SQL analytics and large joins.

---

<!-- _class: section-divider -->

# Patterns Recap

The patterns that tie everything together

---

## Pattern 1: callable class for GPU actors

```python
class MyModel:
    def __init__(self):
        self.model = load_model().cuda()    # once per actor

    def __call__(self, batch):
        return self.model(batch)            # every batch

ds.map_batches(MyModel, concurrency=N, num_gpus=1, batch_size=B)
```

Load once, predict many. This is the foundation of every GPU pipeline in this deck.

---

## Pattern 2: broadcast join for enrichment

```python
# Materialize small table
lookup = {r["id"]: r for r in small_ds.take_all()}

# Reference in map_batches
def enrich(batch):
    batch["extra"] = [lookup.get(k, {}).get("val") for k in batch["id"]]
    return batch

ds.map_batches(enrich)
```

No shuffle. No coordination. Just a dict in a closure.

---

## Pattern 3: training-serving consistency

```python
# Define once
preprocessor = Chain(OrdinalEncoder(...), StandardScaler(...))

# Training: pass to trainer, saved with checkpoint
trainer = TorchTrainer(..., preprocessor=preprocessor)

# Serving: load from checkpoint, apply to requests
checkpoint = result.checkpoint
preprocessor = checkpoint.get_preprocessor()
```

One definition. Saved with the model. No skew.

---

## Pattern 4: CPU-GPU pipeline overlap

```python
# CPU stage
ds = ray.data.read_images(...)
ds = ds.map_batches(resize_normalize)        # CPU workers

# GPU stage — streams from CPU stage
ds = ds.map_batches(Classifier, num_gpus=1)  # GPU actors

# Write stage — streams from GPU stage
ds.write_parquet(...)                        # CPU workers
```

Three stages, overlapping execution. No stage waits for the previous one to finish. This is streaming in action.

---

## What we covered

- **GPU batch inference** — callable class + ActorPoolStrategy, batch size tuning
- **Ray Data + Ray Train** — CPU preprocessing feeds GPU training via streaming
- **Ray Data + Ray Serve** — online inference with shared preprocessing
- **Preprocessors** — StandardScaler, BatchMapper, Chain for composability
- **Image pipeline** — read, resize, normalize, classify with ResNet
- **LLM batch inference** — HuggingFace and vLLM patterns
- **ETL pipeline** — multi-source read, broadcast join, partitioned write
- **Online serving** — multi-model composition, autoscaling
- **Performance benchmarking** — ds.stats(), tuning methodology, bottleneck diagnosis

---

<!-- _class: section-divider -->

# What's Next

---

## Session 4: Advanced Topics and Production Deployment

In the final session, we'll cover:

- **Fault tolerance** — retries, checkpointing, recovery from failures
- **Resource management** — memory tuning, backpressure, cluster sizing
- **Production operations** — monitoring, logging, alerting
- **Scaling patterns** — going from prototype to production at scale
- **Migration strategies** — moving existing pipelines to Ray Data

See you in **Session 4: Production Deployment and Operations**.

<!-- Session 4 is the final deck. It covers everything you need to take these patterns into production with confidence. -->
