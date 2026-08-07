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
async def labels(base_path: str, series_id: str):
    """列出指定序列的可用标签文件（boa_label/{series_id}/）"""
    files = list_label_files(base_path, series_id)
    return {"labels": files, "total": len(files)}


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
