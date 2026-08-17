"""
图像浏览器后端包装器
为前端 cornerstone.js 浏览器提供图像元信息、DICOM序列文件列表、
标签文件列表、椎体中心层面以及解压缓存的快速体积数据传输。
信息字段与 2026_utils/image_io.py 的 show_info 保持一致。
"""
import os
import sys
import glob
import hashlib
import tempfile
from pathlib import Path
from typing import Any, Dict, List

PIPLINE_DIR = Path(__file__).parent.parent.parent / "pipline"
if str(PIPLINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPLINE_DIR))

import SimpleITK as sitk

RAW_CACHE_DIR = Path(tempfile.gettempdir()) / "bodycompass_viewer_cache"

_centers_cache: Dict[str, Dict[str, int]] = {}


def get_dicom_info(dicom_dir: str) -> Dict[str, Any]:
    """读取DICOM序列元数据（字段与 2026_utils.ImageInfo.get_dicom_metadata 一致）"""
    dicom_dir = str(dicom_dir)
    reader = sitk.ImageSeriesReader()
    names = reader.GetGDCMSeriesFileNames(dicom_dir)
    if not names:
        names = sorted(glob.glob(os.path.join(dicom_dir, "*")))
    if not names:
        raise FileNotFoundError(f'未在 "{dicom_dir}" 中找到DICOM文件')

    file_reader = sitk.ImageFileReader()
    file_reader.SetFileName(names[0])
    file_reader.LoadPrivateTagsOn()
    file_reader.ReadImageInformation()

    def _get(tag: str, default: str = "Unknown") -> str:
        try:
            return file_reader.GetMetaData(tag)
        except RuntimeError:
            return default

    rows = _get('0028|0010')
    cols = _get('0028|0011')
    if rows != "Unknown" and cols != "Unknown":
        dimensions = f'{rows} * {cols}'
    else:
        dimensions = 'Unknown'

    return {
        'dicom_path': dicom_dir,
        'patient_id': _get('0010|0020'),
        'patient_name': _get('0010|0010'),
        'patient_age': _get('0010|1010'),
        'patient_sex': _get('0010|0040'),
        'modality': _get('0008|0060'),
        'institution': _get('0008|0080'),
        'manufacturer': _get('0008|0070'),
        'protocol_name': _get('0018|1030'),
        'study_uid': _get('0020|000d'),
        'series_uid': _get('0020|000e'),
        'series_number': _get('0020|0011'),
        'series_date': _get('0008|0021'),
        'series_description': _get('0008|103e'),
        'dimensions': dimensions,
        'num_slices': len(names),
    }


def get_nifti_info(nifti_path: str) -> Dict[str, Any]:
    """读取NIfTI文件头信息（不加载体素数据，字段与 show_info 一致）"""
    reader = sitk.ImageFileReader()
    reader.SetFileName(str(nifti_path))
    reader.ReadImageInformation()

    return {
        'nifti_path': str(nifti_path),
        'type': 'NIfTI',
        'size': tuple(reader.GetSize()),
        'spacing': tuple(round(s, 6) for s in reader.GetSpacing()),
        'origin': tuple(round(o, 6) for o in reader.GetOrigin()),
        'direction': tuple(round(d, 6) for d in reader.GetDirection()),
        'dtype': sitk.GetPixelIDValueAsString(reader.GetPixelID()),
    }


def ensure_raw_cache(nifti_path: str) -> str:
    """
    将 .nii.gz 解压缓存为未压缩 .nii（仅首次），供前端直接读取原始体素数据，
    避免浏览器端耗时的gzip解压。返回缓存文件路径。
    """
    p = Path(nifti_path)
    if not p.name.lower().endswith(".gz"):
        return str(p)

    RAW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    stat = p.stat()
    key = hashlib.md5(
        f"{p.resolve()}|{stat.st_size}|{stat.st_mtime}".encode("utf-8")
    ).hexdigest()
    cached = RAW_CACHE_DIR / f"{key}.nii"
    if not cached.exists():
        tmp = RAW_CACHE_DIR / f"{key}.partial.nii"
        img = sitk.ReadImage(str(p))
        sitk.WriteImage(img, str(tmp))
        os.replace(tmp, cached)
    return str(cached)


def get_image_info(path: str) -> Dict[str, Any]:
    """根据路径类型（目录=DICOM序列 / 文件=NIfTI）返回图像信息"""
    path_obj = Path(path)
    if path_obj.is_dir():
        return get_dicom_info(str(path_obj))
    if path_obj.is_file():
        return get_nifti_info(str(path_obj))
    raise FileNotFoundError(f'路径不存在: {path}')


def list_dicom_files(series_dir: str) -> List[str]:
    """按GDCM序列顺序返回DICOM文件路径列表"""
    reader = sitk.ImageSeriesReader()
    names = list(reader.GetGDCMSeriesFileNames(str(series_dir)))
    if not names:
        names = sorted(glob.glob(os.path.join(str(series_dir), "*")))
    return names


def list_label_files(base_path: str, series_id: str) -> List[str]:
    """列出 boa_label/{series_id}/ 下所有 .nii.gz 标签文件名"""
    return list_label_files_dir(os.path.join(base_path, "boa_label"), series_id)


def list_label_files_dir(label_dir: str, series_id: str) -> List[str]:
    """列出 {label_dir}/{series_id}/ 下所有 .nii/.nii.gz 标签文件名"""
    series_dir = os.path.join(label_dir, series_id)
    if not os.path.isdir(series_dir):
        return []
    files = sorted(glob.glob(os.path.join(series_dir, "*.nii.gz")))
    files += sorted(glob.glob(os.path.join(series_dir, "*.nii")))
    return [os.path.basename(f) for f in files]


def get_vertebra_centers(base_path: str, series_id: str, label_dir: str = "") -> Dict[str, int]:
    """
    计算各椎体中心层面（质心z坐标），定位方式与统计分析模块一致：
    使用BCA标签清理椎体后取质心（见 statistic.tissue_statistic）。
    返回 {椎体名称: 中心层面索引}，仅包含存在的椎体。结果带内存缓存。
    """
    import numpy as np
    from utils.image_io import ImageIO
    from statistic.tissue_statistic import VERTEBRA_LABEL

    if not label_dir:
        label_dir = os.path.join(base_path, "boa_label")
    series_dir = os.path.join(label_dir, series_id)
    bca_path = os.path.join(series_dir, "bca.nii.gz")
    total_path = os.path.join(series_dir, "total.nii.gz")
    if not os.path.isfile(bca_path) or not os.path.isfile(total_path):
        return {}

    # 缓存键：两个标签文件的路径+修改时间
    cache_key = "|".join(
        f"{f}|{os.path.getsize(f)}|{os.path.getmtime(f)}" for f in (bca_path, total_path)
    )
    if cache_key in _centers_cache:
        return _centers_cache[cache_key]

    bca_array = ImageIO.nii2array(bca_path, dtype=np.uint8)
    total_array = ImageIO.nii2array(total_path, dtype=np.uint8)

    # 向量化实现 remove_extra_vertebra_parts（与统计分析相同的清理逻辑）：
    # 对每列(i,j)，将BCA标签11（脊柱）最前缘之后的椎体标签置零（沿height轴）
    depth, height, width = bca_array.shape
    eq = bca_array == 11                       # (d, h, w)
    any11 = eq.any(axis=1)                     # (d, w)
    minpos = eq.argmax(axis=1)                 # (d, w) 首个11的位置(height轴)
    yidx = np.arange(height)[None, :, None]    # (1, h, 1)
    cut = (yidx >= minpos[:, None, :]) & any11[:, None, :]
    cleaned = np.where(cut, 0, total_array)

    centers = {}
    ar = np.arange(depth)
    for name, label_value in VERTEBRA_LABEL.items():
        counts = (cleaned == label_value).sum(axis=(1, 2))  # 每层体素数
        total = int(counts.sum())
        if total > 0:
            centers[name] = int((ar * counts).sum() // total)

    # 边缘过滤：中心层面距离序列起始/末尾层面小于10mm的椎体不显示，
    # 防止中心线位置过高或过低
    try:
        reader = sitk.ImageFileReader()
        reader.SetFileName(total_path)
        reader.ReadImageInformation()
        z_dim = reader.GetSize()[2]
        z_sp = abs(reader.GetSpacing()[2]) or 1.0
        centers = {
            name: z for name, z in centers.items()
            if z * z_sp >= 10.0 and (z_dim - 1 - z) * z_sp >= 10.0
        }
    except Exception:
        pass

    _centers_cache[cache_key] = centers
    return centers
