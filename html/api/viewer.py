"""
图像浏览器API
为前端 cornerstone.js 提供图像文件传输、元信息查询、
DICOM序列文件列表和标签文件列表。
"""
import os
from typing import List
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from wrappers.viewer import (
    get_image_info,
    list_dicom_files,
    list_label_files,
    list_label_files_dir,
    get_vertebra_centers,
    ensure_raw_cache,
)

router = APIRouter(prefix="/api/viewer", tags=["图像浏览"])

ALLOWED_FILE_SUFFIXES = (".nii.gz", ".nii", ".nrrd", ".dcm", ".DCM", ".ima", ".IMA")


@router.get("/image-info")
async def image_info(path: str):
    """返回DICOM序列或NIfTI图像的元信息（供浏览器信息窗口显示）"""
    try:
        return {"info": get_image_info(path)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"读取图像信息失败: {e}")


@router.get("/dicom-series")
async def dicom_series(dir: str):
    """返回DICOM序列的有序文件路径列表（供浏览器逐文件加载）"""
    if not os.path.isdir(dir):
        raise HTTPException(status_code=400, detail=f"目录不存在: {dir}")
    files = list_dicom_files(dir)
    if not files:
        raise HTTPException(status_code=400, detail=f"目录中未找到DICOM文件: {dir}")
    return {"files": files, "total": len(files)}


@router.get("/labels")
async def labels(base_path: str = "", series_id: str = "", label_dir: str = ""):
    """列出指定序列的可用标签文件（支持自定义标签目录）"""
    if label_dir:
        files = list_label_files_dir(label_dir, series_id)
    else:
        files = list_label_files(base_path, series_id)
    return {"labels": files, "total": len(files)}


@router.get("/vertebra-centers")
async def vertebra_centers(base_path: str = "", series_id: str = "", label_dir: str = ""):
    """返回各椎体中心层面索引（与统计分析相同的质心定位方式）"""
    try:
        return {"centers": get_vertebra_centers(base_path, series_id, label_dir)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"椎体中心计算失败: {e}")


@router.get("/file")
async def serve_file(path: str):
    """传输图像文件（NIfTI/DICOM），供浏览器端 cornerstone 加载"""
    if not path or not os.path.isabs(path):
        raise HTTPException(status_code=400, detail="需要绝对路径")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {path}")
    if not path.endswith(ALLOWED_FILE_SUFFIXES):
        raise HTTPException(status_code=400, detail="不支持的文件类型")
    return FileResponse(path, media_type="application/octet-stream")


@router.get("/volume-raw")
async def serve_volume_raw(path: str):
    """
    快速体积数据传输：服务端将 .nii.gz 解压缓存为未压缩 .nii 后直接返回，
    浏览器端无需gzip解压，可显著加快加载速度。
    """
    if not path or not os.path.isabs(path):
        raise HTTPException(status_code=400, detail="需要绝对路径")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {path}")
    if not path.endswith((".nii.gz", ".nii")):
        raise HTTPException(status_code=400, detail="不支持的文件类型")
    try:
        raw_path = ensure_raw_cache(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"解压缓存失败: {e}")
    return FileResponse(raw_path, media_type="application/octet-stream")
