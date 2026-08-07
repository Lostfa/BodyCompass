# BodyCompass

<img src="screenshot.png" alt="BodyCompass Screenshot" width="100%">

An integrated, interactive CT tissue composition analysis platform: from raw DICOM/NIfTI images to statistical CSV reports, with an embedded cornerstone.js-based MPR image viewer.

## Features

- **Preprocessing**: DICOM / NIfTI input; resampling (0.5–2.5 mm), HU clipping, optional Gaussian blur
- **BOA Segmentation**: runs the bundled Body-and-Organ-Analysis code (`boa/`) in the `boa` conda environment; outputs vertebra (total), BCA and tissue labels
- **Statistical Analysis**: 7 tissues (MUSCLE / BONE / SAT / VAT / IMAT / PAT / EAT) × 8 metrics (volume, max/min/mean/std/median/q1/q3 HU), whole-volume and per-vertebra (C2–L5) ranges, parallel processing
- **Data Export**: merge per-series CSVs into a single table, preview and download
- **Image Viewer**: 2×2 layout (axial / sagittal / coronal / image info), wheel & slider scrolling, left-click MPR cross-linking, soft-tissue / lung / bone window presets, label overlay with per-label colors and adjustable opacity (1–100%)

## Project Structure

```
├── pipline/          # Core pipeline (preprocess / statistic / utils)
├── html/             # Web app (FastAPI backend + vanilla JS frontend)
├── boa/              # Bundled Body-and-Organ-Analysis code (BOA CLI)
├── 2026_utils/       # Standalone image I/O utilities
└── run.bat           # Windows launcher (activates conda env `boa`)
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

Open `http://localhost:8000` and follow the 4-step wizard: Preprocessing → BOA Segmentation → Statistical Analysis → Data Export.

Working directory layout (set in the top bar):

```
<work_dir>/
├── ct_image/         # preprocessed NIfTI ({series}.nii.gz)
├── boa_label/        # segmentation labels per series
└── statistic/        # per-series statistical CSVs
```

## Requirements

- Python 3.10, conda environment `boa`
- CUDA-capable GPU (≥16 GB VRAM recommended) for segmentation

## References

- BOA: [Haubold et al., Investigative Radiology, 2023](https://journals.lww.com/investigativeradiology/abstract/9900/boa__a_ct_based_body_and_organ_analysis_for.176.aspx)
- TotalSegmentator: [Wasserthal et al., Radiol. Artif. Intell., 2023](https://pubs.rsna.org/doi/10.1148/ryai.230024)
- nnU-Net: [Isensee et al., Nat. Methods, 2021](https://www.nature.com/articles/s41592-020-01008-z)

## License

For research purposes only. Please cite the above papers if used in scientific work.
