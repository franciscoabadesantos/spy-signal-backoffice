# Layer 3 — consolidate experiment creation into the working builder

## Context / deep analysis

There are **three** experiment-creation surfaces today; two are broken and the working one is unwired:

1. `app/research/ui.tsx` + `components/research/NewExperimentForm.tsx` — **free-text stub**. Model/feature are free-text inputs; the submitted `config_json` is just echoes, not a runnable `ExperimentConfig`. Posts to `/api/research/experiments`.
2. `app/research/batches/ui.tsx` — generic `AxisPicker` that reads the (now real) axis contract from `/api/research/batches?include_spec=true`, but POSTs a `batch_spec` to `/analyst/research/batches` → the **old shallow fanout** (axes only touch `snapshot_request` + metadata, never the real `ml_lab.config`). Not runnable.
3. **`POST /analyst/research/experiments/cross-sectional`** — the **working builder** (dry-run validated end-to-end: it builds a complete inline `ExperimentConfig` from the validated preset ⊕ the request, and the orchestrator validates every step). **Not wired to any UI.**

Viewing works: `ExperimentTable` (list + events + artifacts) on `/research` is fine. Registry / production / signals are separate viewing concerns and stay as-is.

**Goal:** one catalog-driven experiment form that submits to the working builder (single + grid), surfaced on `/research`; retire the broken creation surfaces.

## Work

### 1. BFF routes
- Add `app/api/research/capabilities/route.ts` → `proxyResearchBackendJson` GET `/analyst/research/capabilities`.
- Add `app/api/research/experiments/cross-sectional/route.ts` → `proxyResearchBackendJson` POST `/analyst/research/experiments/cross-sectional`.

### 2. Replace `NewExperimentForm` with a catalog-driven `CrossSectionalExperimentForm`
- On mount, fetch `/api/research/capabilities` → `{ models, labels, splits, tasks, feature_families, universe }`.
- Fields (real dropdowns, **cross-sectional defaults pre-filled**, every field overridable):
  - **label** — select from `labels`, default `cross_sectional_rank`
  - **horizon_days** — number, default `21`
  - **model** — select from `models`, default `ridge`
  - **features** — multi-select grouped by `feature_families` (members are objects `{name, family, description}` — show `name`, tooltip `description`), default = the validated 23 (the scale-invariant technicals + 8 cs_rank; pre-check them)
  - **top_k** — number, default `15`
  - **split**: `train_window_days` (756), `test_window_days` (63), `step_days` (63), optional `start_date`/`end_date`
  - **dry_run** — toggle (default off); **registry_registration_enabled** — toggle
- **Universe (v1):** fixed to the validated 96 — render read-only (a count + an expandable list), not editable. Note: "universe selection lands in v2 (needs snapshot creation)."
- **Single vs grid:** allow a field (model / label / horizon / top_k / features-set) to take **multiple** values; when any does, the builder expands to a batch. Show a live "N configs" preview (product of multi-value selections), like the current batch page.
- Submit the structured request to `/api/research/experiments/cross-sectional`. On success: refresh the `ExperimentTable` and expand the new experiment (single) or link to the batch (grid).
- Validate client-side that required fields are set; surface the backend's `422` (unknown model/label/feature) inline.

### 3. Results
- The new experiment/batch appears in the existing `ExperimentTable` (works). 
- Surface the **eval card** for completed experiments: read from the experiment detail `result_json` (rank_ic, rank_ic_ir, top_bottom_spread, mcpt_p_value; backtest IR, return vs benchmark, max_drawdown, avg_turnover) and render compact metric chips in the expanded row. (The fields exist on the orchestrator result.)

### 4. Retire the broken/duplicate surfaces
- **Remove** the free-text `NewExperimentForm` (replaced by `CrossSectionalExperimentForm`).
- **`/research/batches`:** stop using it to *create* via the old shallow fanout. Repurpose it to **view batch results** only (keep the leque/distribution view at `/research/batches/[batchId]`). The "Submit batch" axis-picker is superseded by the grid mode of the new form; remove the submit block (or point it at the new builder). Update the Sidebar so "Batches" reads as a results view, not a second creation path.
- Keep `/registry/*`, `/production/daily-inference`, `/signals/*` as-is (separate lifecycle/output concerns).

### 5. Organization
- `/research` becomes the single **create + view experiments** home: the `CrossSectionalExperimentForm` on top, the `ExperimentTable` below.
- Sidebar "Pipeline" group: Research (create+view) → Batches (results) → Cross-Sectional (signals) → Daily Inference. Make the labels reflect that Research is where you launch runs.

## Notes
- The builder is **v1 cross-sectional only** (universe fixed to the 96). When other presets/universes land, the form gains a preset selector + a universe picker — but the catalog-driven dropdown pattern here already generalizes.
- Don't reintroduce free-text model/feature inputs — everything comes from `/analyst/research/capabilities`.
