# Follow-On Content Audit

Modules below were **not edited** in the content review remediation (Phases 1-3). They contain integration-specific claims, version-sensitive UI references, and ecosystem details that require fact-checking against Ray 2.55.1 before publication.

## Audit checklist per module

Each module needs:

- [ ] **Compatibility matrix** — verify all APIs, config keys, and CLI commands against Ray 2.55.1
- [ ] **Citation of authoritative docs** — add reference-style links with version and access date
- [ ] **Qualification of unbenchmarked claims** — replace "always", "best", "fastest" with qualified language
- [ ] **Accessibility** — ensure all diagrams have meaningful fallback text (automated by validator)
- [ ] **Frontmatter** — add `description` field to every lesson

---

## Module 9: Monitoring & Dashboard

**Risk:** Version-sensitive UI — dashboard layout, metric names, and navigation paths change between Ray releases.

- [ ] Verify Ray Dashboard screenshots / descriptions match Ray 2.55.1 UI
- [ ] Confirm metric names (e.g., `ray_data_*` Prometheus metrics) exist in 2.55.1
- [ ] Check deployment paths for dashboard access (standalone vs. cluster)
- [ ] Validate Grafana/Prometheus integration steps

## Module 10: Cloud & Ecosystem Integration

**Risk:** Cloud storage paths, connector APIs, and orchestration tool versions change frequently.

- [ ] Verify S3/GCS/ADLS read/write paths and authentication patterns
- [ ] Check Delta Lake / Iceberg / Hudi connector availability with Ray Data 2.55.1
- [ ] Validate database/warehouse connector examples (Snowflake, BigQuery, etc.)
- [ ] Confirm ML framework integration versions (PyTorch, TensorFlow, HuggingFace)
- [ ] Check orchestration examples (Airflow, Prefect, Dagster) for current API compatibility

## Module 11: Troubleshooting & Debugging

**Risk:** Error messages, debugging approaches, and diagnostic tools may be version-specific.

- [ ] Verify error messages match Ray 2.55.1 output
- [ ] Check memory debugging tools and their availability
- [ ] Validate serialization workarounds for current Ray version
- [ ] Confirm performance debugging approaches (profiling, metrics) work as described

## Module 12: Advanced Topics

**Risk:** RayDP, feature stores, streaming pipelines, and multi-modal support — compatibility and API status change frequently.

- [ ] Verify RayDP compatibility and API with current Spark versions
- [ ] Check feature store integration status (Feast, Tecton)
- [ ] Validate streaming pipeline patterns against Ray Data 2.55.1 streaming API
- [ ] Confirm multi-modal data handling APIs and patterns

## Module 13: Reference & Configuration

**Risk:** API reference and configuration tuning need version pinning.

- [ ] Cross-reference API examples against Ray 2.55.1 API docs
- [ ] Verify configuration parameters and their defaults
- [ ] Check that pattern recipes use current API (not deprecated)
- [ ] Pin all configuration examples to specific Ray version behavior

---

## How to use this document

1. Pick a module section above
2. Read each lesson file in that module
3. For each claim, verify against the linked authoritative source
4. Apply the same editorial standards used in Phases 1-3: qualify claims, add citations, fix deprecated APIs
5. Check off items as you complete them
6. Run `pnpm validate && pnpm lint && pnpm test && pnpm build` after each module
