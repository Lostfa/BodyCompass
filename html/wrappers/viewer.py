"""
图像浏览器后端包装器
为前端 cornerstone.js 浏览器提供图像元信息、DICOM序列文件列表、
标签文件列表等数据。信息字段与 2026_utils/image_io.py 的 show_info 保持一致。
"""
import os
import sys
import glob
from pathlib import Path
from typing import Any, Dict, List

PIPLINE_DIR = Path(__file__).parent.parent.parent / "pipline"
if str(PIPLINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPLINE_DIR))

import SimpleITK as sitk


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

    def _fmt_tuple(values) -> str:
        return '(' + ', '.join(f'{v:.4f}' if isinstance(v, float) else str(v) for v in values) + ')'

    return {
        'nifti_path': str(nifti_path),
        'type': 'NIfTI',
        'size': tuple(reader.GetSize()),
        'spacing': _fmt_tuple(reader.GetSpacing()),
        'origin': _fmt_tuple(reader.GetOrigin()),
        'direction': _fmt_tuple([round(d, 4) for d in reader.GetDirection()]),
        'dtype': sitk.GetPixelIDValueAsString(reader.GetPixelID()),
    }


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
    label_dir = os.path.join(base_path, "boa_label", series_id)
    if not os.path.isdir(label_dir):
        return []
    files = sorted(glob.glob(os.path.join(label_dir, "*.nii.gz")))
    files += sorted(glob.glob(os.path.join(label_dir, "*.nii")))
    return [os.path.basename(f) for f in files]
