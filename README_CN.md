# BodyCompass

<img src="screenshot.png" alt="BodyCompass 截图" width="100%">

一体化可交互 CT 组织成分分析平台：从原始 DICOM/NIfTI 图像到统计 CSV 报告，内置基于 cornerstone.js 的 MPR 图像浏览器。

## 功能特性

- **数据预处理**：支持 DICOM / NIfTI 输入；重采样（0.5–2.5 mm）、HU 裁剪、可选高斯模糊
- **BOA 分割**：在 `boa` conda 环境中运行项目内置的 Body-and-Organ-Analysis 代码（`boa/`），输出椎体（total）、BCA 与组织标签
- **统计分析**：7 种组织（MUSCLE / BONE / SAT / VAT / IMAT / PAT / EAT）× 8 项指标（体积、最大/最小/均值/标准差/中位数/Q1/Q3 HU），支持全图与逐椎体（C2–L5）范围分析，并行处理
- **数据导出**：合并各序列 CSV 为综合表格，支持预览与下载
- **图像浏览**：2×2 布局（轴位 / 矢状位 / 冠状位 / 图像信息），滚轮与滑块浏览层面，左键点击 MPR 联动定位，软组织窗 / 肺窗 / 骨窗预设，标签叠加显示（不同标签不同颜色，透明度 1–100% 可调）

## 项目结构

```
├── pipline/          # 核心管线（preprocess / statistic / utils）
├── html/             # Web 应用（FastAPI 后端 + 原生 JS 前端）
├── boa/              # 内置 Body-and-Organ-Analysis 代码（BOA 命令行）
├── 2026_utils/       # 独立图像读写工具
└── run.bat           # Windows 启动脚本（激活 conda 环境 boa）
```

## 快速开始

```bash
# 1. 创建 conda 环境（仅首次）
conda env create -f pipline/environment.yml
conda activate boa
```

```bash
# 2. 启动服务（二选一）：
#    方式 A（Windows）：双击 run.bat
#    方式 B（命令行）：
cd html
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

访问 `http://localhost:8000`，按 4 步向导操作：数据预处理 → BOA 分割 → 统计分析 → 数据导出。

工作目录结构（顶部栏设置）：

```
<work_dir>/
├── ct_image/         # 预处理后的 NIfTI（{序列}.nii.gz）
├── boa_label/        # 各序列的分割标签
└── statistic/        # 各序列的统计 CSV
```

## 环境要求

- Python 3.10，conda 环境 `boa`
- 分割步骤建议配备 ≥16 GB 显存的 CUDA GPU

## 参考文献

- BOA: [Haubold et al., Investigative Radiology, 2023](https://journals.lww.com/investigativeradiology/abstract/9900/boa__a_ct_based_body_and_organ_analysis_for.176.aspx)
- TotalSegmentator: [Wasserthal et al., Radiol. Artif. Intell., 2023](https://pubs.rsna.org/doi/10.1148/ryai.230024)
- nnU-Net: [Isensee et al., Nat. Methods, 2021](https://www.nature.com/articles/s41592-020-01008-z)

## 许可证

仅用于学术研究，如用于科研工作请引用上述论文。
