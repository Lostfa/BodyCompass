# BodyCompass v1.2

<img src="screenshot.png" alt="BodyCompass Screenshot" width="100%">

An integrated, interactive CT tissue composition analysis platform: from raw DICOM/NIfTI images to statistical CSV reports, with an embedded cornerstone.js-based MPR image viewer.

## What's New in v1.2

- **New analysis mode**: all slices between two vertebrae (e.g. T1–T12); multiple ranges can be added
- **UI**: clearer mode names (whole-volume / single-vertebra / two-vertebra)
- **Defaults**: tissue-threshold regeneration enabled by default; preprocessing HU max changed to 1000; Gaussian blur enabled by default with sigma 0.5

## Features

- **Preprocessing**: DICOM / NIfTI input; resampling (0.5–2.5 mm), HU clipping, optional Gaussian blur
- **BOA Segmentation**: runs the bundled Body-and-Organ-Analysis code (`boa/`) in the `boa` conda environment; outputs vertebra (total), BCA and tissue labels; can be stopped mid-run (the incomplete result is removed automatically)
- **Statistical Analysis**: 7 tissues (MUSCLE / BONE / SAT / VAT / IMAT / PAT / EAT) × 8 metrics (volume, max/min/mean/std/median/q1/q3 HU), whole-volume and per-vertebra (C2–L5) ranges, parallel processing
- **Data Export**: merge per-series CSVs into a single table, preview in the side panel and download
- **Image Viewer** (cornerstone.js, 2×2 layout):
  - Axial / sagittal / coronal views plus a fourth panel: image info (steps 1–2) or vertebra-localization sagittal (step 3)
  - Wheel & per-view sliders for slice browsing; left-click MPR cross-linking
  - Soft-tissue / lung / bone window presets
  - Label overlay with per-label colors and adjustable opacity (1–100%)
  - Vertebra center lines (blue, 1-voxel) with vertebra name tags on the localization sagittal, computed with the same centroid method as the analysis module

## Project Structure

```
├── pipline/          # Core pipeline (preprocess / statistic / utils)
├── html/             # Web app (FastAPI backend + vanilla JS frontend)
│   ├── api/          # REST endpoints (preprocess / boa / analysis / merge / viewer)
│   ├── wrappers/     # Pipeline wrappers
│   ├── tasks/        # Background task manager (SSE progress)
│   ├── static/       # CSS / JS / vendored cornerstone bundle
│   └── templates/    # index.html
├── boa/              # Bundled Body-and-Organ-Analysis code (BOA CLI)
└── run.bat           # Windows launcher (activates conda env `boa`)
```

Working directory layout (set in the top bar):

```
<work_dir>/
├── ct_image/         # preprocessed NIfTI ({series}.nii.gz)
├── boa_label/        # segmentation labels per series
└── statistic/        # per-series statistical CSVs
```

## Quick Start

```bash
# 1. Create the conda environment (first time only)
conda env create -f pipline/environment.yml
conda activate boa
```

```bash
# 2. Launch the server — choose one:
#    Option A (Windows): double-click run.bat
#    Option B (command line):
cd html
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000` and follow the 4-step wizard: Preprocessing → BOA Segmentation → Statistical Analysis → Data Export. The right panel switches between Console, Image Viewer and Data Table.

## Requirements

- Python 3.10, conda environment `boa`
- CUDA-capable GPU (≥16 GB VRAM recommended) for segmentation

## References

- BOA: [Haubold et al., Investigative Radiology, 2023](https://journals.lww.com/investigativeradiology/abstract/9900/boa__a_ct_based_body_and_organ_analysis_for.176.aspx)
- TotalSegmentator: [Wasserthal et al., Radiol. Artif. Intell., 2023](https://pubs.rsna.org/doi/10.1148/ryai.230024)
- nnU-Net: [Isensee et al., Nat. Methods, 2021](https://www.nature.com/articles/s41592-020-01008-z)

## License

Copyright (c) 2026 wuzhifa

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

The full license text is provided in [LICENSE](LICENSE).
