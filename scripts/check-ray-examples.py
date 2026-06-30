#!/usr/bin/env python3
"""Smoke test: verify representative Ray Data compute strategy patterns.

Requires: pip install "ray[data]==2.55.1"
Runs a CPU-only local Ray cluster, exercises each supported strategy
pattern on an in-memory dataset, and asserts results are correct.
"""

import sys

import ray
import ray.data


def test_function_with_task_pool():
    """Plain function + TaskPoolStrategy."""

    def double(row):
        return {"value": row["value"] * 2}

    ds = ray.data.from_items([{"value": i} for i in range(10)])
    ds = ds.map(double, compute=ray.data.TaskPoolStrategy(size=2))
    results = sorted(ds.take_all(), key=lambda r: r["value"])
    assert len(results) == 10
    assert results[0]["value"] == 0
    assert results[9]["value"] == 18
    print("  PASS: function + TaskPoolStrategy(size=2)")


def test_class_with_actor_pool_map_batches():
    """Callable class + ActorPoolStrategy via map_batches."""

    class Doubler:
        def __init__(self):
            self.factor = 2

        def __call__(self, batch):
            batch["value"] = batch["value"] * self.factor
            return batch

    ds = ray.data.from_items([{"value": i} for i in range(10)])
    ds = ds.map_batches(Doubler, compute=ray.data.ActorPoolStrategy(size=2))
    results = sorted(ds.take_all(), key=lambda r: r["value"])
    assert len(results) == 10
    assert results[9]["value"] == 18
    print("  PASS: class + ActorPoolStrategy(size=2) via map_batches")


def test_class_with_actor_pool_map():
    """Callable class + ActorPoolStrategy via map."""

    class Tripler:
        def __call__(self, row):
            return {"value": row["value"] * 3}

    ds = ray.data.from_items([{"value": i} for i in range(10)])
    ds = ds.map(Tripler, compute=ray.data.ActorPoolStrategy(size=2))
    results = sorted(ds.take_all(), key=lambda r: r["value"])
    assert len(results) == 10
    assert results[9]["value"] == 27
    print("  PASS: class + ActorPoolStrategy(size=2) via map")


def test_class_with_autoscaling_actor_pool():
    """Callable class + ActorPoolStrategy with min/max (autoscaling)."""

    class Identity:
        def __call__(self, batch):
            return batch

    ds = ray.data.from_items([{"value": i} for i in range(100)])
    ds = ds.map_batches(
        Identity,
        compute=ray.data.ActorPoolStrategy(min_size=1, max_size=4),
    )
    results = ds.take_all()
    assert len(results) == 100
    print("  PASS: class + ActorPoolStrategy(min_size=1, max_size=4)")


def test_max_concurrency_preserved():
    """actor.options(max_concurrency=N) is Ray Core API, not deprecated."""

    @ray.remote
    class Counter:
        def __init__(self):
            self.count = 0

        def increment(self):
            self.count += 1
            return self.count

    actor = Counter.options(max_concurrency=4).remote()
    result = ray.get(actor.increment.remote())
    assert result == 1
    print("  PASS: actor.options(max_concurrency=4) preserved")


def main():
    print("Ray Data compute strategy smoke test")
    print(f"Ray version: {ray.__version__}")
    print()

    ray.init(num_cpus=4)
    try:
        test_function_with_task_pool()
        test_class_with_actor_pool_map_batches()
        test_class_with_actor_pool_map()
        test_class_with_autoscaling_actor_pool()
        test_max_concurrency_preserved()
        print("\nAll smoke tests passed.")
    finally:
        ray.shutdown()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)
