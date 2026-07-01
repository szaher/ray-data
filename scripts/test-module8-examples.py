"""Smoke test for module-8 API comparison code examples.

Validates that the exact code patterns taught in the lesson produce
correct results against the pinned ray==2.55.1 runtime.
"""
import sys

import pyarrow as pa
import pyarrow.compute as pc
import ray


def test_project_batch():
    """Validate the Arrow projection example from 02-api-comparison.mdx."""
    table = pa.table({
        "name": ["Alice", "Bob", "Carol"],
        "city": ["new york", "LONDON", "Tokyo"],
    })

    def project_batch(batch):
        city_upper = pc.utf8_upper(batch.column("city"))
        return batch.select(["name"]).append_column("city_upper", city_upper)

    result = project_batch(table)

    assert result.num_columns == 2, f"Expected 2 columns, got {result.num_columns}"
    assert result.column_names == ["name", "city_upper"]
    assert result.column("city_upper").to_pylist() == [
        "NEW YORK", "LONDON", "TOKYO"
    ], f"Unexpected values: {result.column('city_upper').to_pylist()}"
    print("  project_batch: OK")


def test_joins():
    """Validate Dataset.join() for every join type named in the lesson."""
    ray.init(num_cpus=2)
    try:
        left = ray.data.from_items([
            {"dept_id": 1, "name": "Alice"},
            {"dept_id": 2, "name": "Bob"},
            {"dept_id": 3, "name": "Carol"},
        ])
        right = ray.data.from_items([
            {"dept_id": 1, "dept_name": "Engineering"},
            {"dept_id": 2, "dept_name": "Sales"},
            {"dept_id": 4, "dept_name": "Marketing"},
        ])

        join_types = {
            "inner": {
                "expected_count": 2,
                "expected_columns": {"dept_id", "name", "dept_name"},
                "expected_dept_ids": {1, 2},
            },
            "left_outer": {
                "expected_count": 3,
                "expected_columns": {"dept_id", "name", "dept_name"},
                "expected_dept_ids": {1, 2, 3},
            },
            "right_outer": {
                "expected_count": 3,
                "expected_columns": {"dept_id", "name", "dept_name"},
                "expected_dept_ids": {1, 2, 4},
            },
            "full_outer": {
                "expected_count": 4,
                "expected_columns": {"dept_id", "name", "dept_name"},
                "expected_dept_ids": {1, 2, 3, 4},
            },
            "left_semi": {
                "expected_count": 2,
                "expected_columns": {"dept_id", "name"},
                "expected_dept_ids": {1, 2},
            },
            "right_semi": {
                "expected_count": 2,
                "expected_columns": {"dept_id", "dept_name"},
                "expected_dept_ids": {1, 2},
            },
            "left_anti": {
                "expected_count": 1,
                "expected_columns": {"dept_id", "name"},
                "expected_dept_ids": {3},
            },
            "right_anti": {
                "expected_count": 1,
                "expected_columns": {"dept_id", "dept_name"},
                "expected_dept_ids": {4},
            },
        }

        for join_type, spec in join_types.items():
            result = left.join(
                right,
                on=("dept_id",),
                join_type=join_type,
                num_partitions=2,
            )
            rows = result.take_all()
            result_columns = set(rows[0].keys()) if rows else set()

            assert len(rows) == spec["expected_count"], (
                f"{join_type}: expected {spec['expected_count']} rows, "
                f"got {len(rows)}"
            )
            assert result_columns == spec["expected_columns"], (
                f"{join_type}: expected columns {spec['expected_columns']}, "
                f"got {result_columns}"
            )
            result_dept_ids = {row["dept_id"] for row in rows}
            assert result_dept_ids == spec["expected_dept_ids"], (
                f"{join_type}: expected dept_ids {spec['expected_dept_ids']}, "
                f"got {result_dept_ids}"
            )
            print(f"  join({join_type}): OK — {len(rows)} rows, "
                  f"columns {sorted(result_columns)}")
    finally:
        ray.shutdown()


if __name__ == "__main__":
    print("Testing module-8 API comparison examples...")
    print()

    print("1. Arrow projection (project_batch):")
    test_project_batch()

    print()
    print("2. Dataset.join() — all 8 join types:")
    test_joins()

    print()
    print("All module-8 example checks passed.")
    sys.exit(0)
