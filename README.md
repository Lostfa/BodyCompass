# TissueStatistic

<img src="screenshot.png" alt="TissueStatistic Screenshot" width="100%">

CT tissue composition statistical analysis platform — segment soft tissues from CT images and generate statistical reports.

## Features

- **CT Preprocessing**: Support DICOM & NIfTI input; HU clipping, resampling, optional Gaussian blur
- **BOA Segmentation**: Based on [TotalSegmentator](https://arxiv.org/abs/2208.05868) & [Body Organ Analysis](https://pubmed.ncbi.nlm.nih.gov/32945971/) models; outputs vertebra, BCA, and tissue labels
- **Statistical Analysis**: 7 tissue types (MUSCLE, BONE, SAT, VAT, IMAT, PAT, EAT) × 8 metrics (volume, max/min/mean/std/median/q1/q3 HU) across C2–L5 vertebrae
- **Web Interface**: 4-step wizard (Preprocess → Segment → Analyze → Export CSV) with real-time progress console

## Project Structure

```
├── pipline/                 # Core pipeline scripts
│   ├── preprocess/          # DICOM/NIfTI preprocessing
│   ├── statistic/           # Tissue analysis library
│   ├── utils/               # Image I/O & processing
│   ├── main_statistic_parallel.py  # Parallel batch analysis
│   └── environment.yml      # Conda environment
├── html/                    # Web app (FastAPI + vanilla JS)
│   ├── app.py               # Entry point
│   ├── api/                 # REST endpoints
│   ├── wrappers/            # Pipeline wrappers
│   ├── tasks/               # Task manager
│   └── templates/           # Frontend (index.html)
└── boa/                     # BOA tool documentation
```

## Quick Start

### 1. Environment Setup

```bash
conda env create -f pipline/environment.yml
conda activate boa
```

### 2. Launch Web App

```bash
cd html
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Or on Windows: double-click `run.bat`.

Visit `http://localhost:8000` to use the 4-step wizard.

### 3. Command-Line Usage

```bash
# Batch statistical analysis for all patients
python pipline/main_statistic_parallel.py -b /path/to/data --workers 8
```

## Analysis Types

| Type | Description |
|------|-------------|
| **ALL** | Analyze all slices in the CT volume |
| **Vertebra + Range** | Analyze tissue within a specified mm range centered on a target vertebra (C2–L5) |

## Requirements

- Python 3.10
- CUDA 12.1 (GPU with ≥16 GB VRAM recommended)
- Conda environment `boa`

## References

- BOA: [Haubold et al., Investigative Radiology, 2023](https://journals.lww.com/investigativeradiology/abstract/9900/boa__a_ct_based_body_and_organ_analysis_for.176.aspx)
- TotalSegmentator: [Wasserthal et al., Radiol. Artif. Intell., 2023](https://pubs.rsna.org/doi/10.1148/ryai.230024)
- nnU-Net: [Isensee et al., Nat. Methods, 2021](https://www.nature.com/articles/s41592-020-01008-z)

## License

This project is for research purposes. Please cite the above papers if you use it in your work.
