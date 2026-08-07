/**
 * BodyCompass 图像浏览器模块
 * 基于 cornerstone.js (cornerstone3D) 实现类 itk-snap 的 2x2 MPR 布局：
 * 轴位 / 矢状位 / 冠状位 + 图像信息列表。
 * 交互：滚轮或滑块浏览层面，左键MPR交叉定位，右键缩放，中键平移。
 * 支持标签叠加显示（不同数值不同颜色，50%透明度）。
 */

const Viewer = {
  initialized: false,
  renderingEngine: null,
  toolGroupId: 'bc-toolgroup',
  viewportIds: ['vpAxial', 'vpSagittal', 'vpCoronal'],
  elementIds: { vpAxial: 'elAxial', vpSagittal: 'elSagittal', vpCoronal: 'elCoronal' },
  orientations: { vpAxial: 'AXIAL', vpSagittal: 'SAGITTAL', vpCoronal: 'CORONAL' },
  currentVolumeId: null,
  currentLabelVolumeId: null,
  currentLabelRepUID: null,
  labelSegmentCount: 0,
  labelOpacity: 0.5,
  currentSeriesId: null,
  currentPath: null,
  windowPreset: 'soft',
  segmentationId: 'bc-labelmap',
};

const SLIDER_IDS = {
  vpAxial: 'sliderAxial',
  vpSagittal: 'sliderSagittal',
  vpCoronal: 'sliderCoronal',
};

const WINDOW_PRESETS = {
  soft: { lower: -135, upper: 215 },
  lung: { lower: -1350, upper: 150 },
  bone: { lower: -600, upper: 1400 },
};

const TISSUE_COLORS = {
  1: [231, 76, 60],
  2: [241, 196, 15],
  3: [52, 152, 219],
  4: [155, 89, 182],
  5: [26, 188, 156],
  6: [230, 126, 34],
  7: [46, 204, 113],
};

function _labelColor(i) {
  if (TISSUE_COLORS[i]) return TISSUE_COLORS[i];
  const h = (i * 67) % 360;
  const s = 0.75, v = 0.9;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

async function viewerInit() {
  if (Viewer.initialized) return;
  if (Viewer._initPromise) return Viewer._initPromise;
  Viewer._initPromise = _viewerInitImpl();
  return Viewer._initPromise;
}

async function _viewerInitImpl() {
  const { cornerstone, cornerstoneTools } = window.BCV;
  await cornerstone.init();
  cornerstoneTools.init();

  const csTools = cornerstoneTools;
  csTools.addTool(csTools.StackScrollMouseWheelTool);
  csTools.addTool(csTools.SegmentationDisplayTool);

  const toolGroup = csTools.ToolGroupManager.createToolGroup(Viewer.toolGroupId);
  toolGroup.addTool(csTools.StackScrollMouseWheelTool.toolName);
  toolGroup.addTool(csTools.SegmentationDisplayTool.toolName);
  toolGroup.setToolEnabled(csTools.SegmentationDisplayTool.toolName);
  const MouseBindings = csTools.Enums.MouseBindings;
  toolGroup.setToolActive(csTools.StackScrollMouseWheelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });

  Viewer.renderingEngine = new cornerstone.RenderingEngine('bc-rendering-engine');
  const viewportInputArray = Viewer.viewportIds.map((vpId) => ({
    viewportId: vpId,
    type: cornerstone.Enums.ViewportType.ORTHOGRAPHIC,
    element: document.getElementById(Viewer.elementIds[vpId]),
    defaultOptions: {
      orientation: cornerstone.Enums.OrientationAxis[Viewer.orientations[vpId]],
      background: [0, 0, 0],
    },
    toolGroupId: Viewer.toolGroupId,
  }));
  Viewer.renderingEngine.setViewports(viewportInputArray);
  Viewer.viewportIds.forEach((vpId) => {
    toolGroup.addViewport(vpId, 'bc-rendering-engine');
  });

  // 左键点击：MPR定位（其余两个视图移动到对应层面）
  Viewer.viewportIds.forEach((vpId) => {
    const el = document.getElementById(Viewer.elementIds[vpId]);
    el.addEventListener('click', (evt) => {
      const rect = el.getBoundingClientRect();
      _mprLink(vpId, [evt.clientX - rect.left, evt.clientY - rect.top]);
    });
    el.addEventListener('contextmenu', (evt) => evt.preventDefault());
    el.addEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, () => {
      _updateSliderForViewport(vpId);
    });
  });

  Viewer.initialized = true;
}

/** 左键点击某视图后，其余视图定位到点击点对应的层面 */
function _mprLink(vpId, canvasPos) {
  if (!Viewer.renderingEngine || !Viewer.currentVolumeId) return;
  const vp = Viewer.renderingEngine.getViewport(vpId);
  if (!vp) return;
  const world = vp.canvasToWorld(canvasPos);
  Viewer.viewportIds.forEach((otherId) => {
    if (otherId === vpId) return;
    const ovp = Viewer.renderingEngine.getViewport(otherId);
    const cam = ovp.getCamera();
    const n = cam.viewPlaneNormal || [0, 0, 1];
    let axis = 0;
    if (Math.abs(n[1]) > Math.abs(n[axis])) axis = 1;
    if (Math.abs(n[2]) > Math.abs(n[axis])) axis = 2;
    const delta = world[axis] - cam.focalPoint[axis];
    const focalPoint = [...cam.focalPoint];
    const position = [...cam.position];
    focalPoint[axis] += delta;
    position[axis] += delta;
    ovp.setCamera({ focalPoint, position });
  });
  Viewer.renderingEngine.render();
  _updateAllSliders();
}

function _viewerUrl(path) {
  return `/api/viewer/file?path=${encodeURIComponent(path)}`;
}

function _purgeVolumes() {
  const { cornerstone } = window.BCV;
  if (Viewer.initialized) _removeLabelOverlay();
  Viewer.currentLabelVolumeId = null;
  try { cornerstone.cache.purgeCache(); } catch (e) { /* ignore */ }
  Viewer.currentVolumeId = null;
}

async function viewerLoadNifti(path, seriesId) {
  await viewerInit();
  const { cornerstone } = window.BCV;
  _purgeVolumes();

  const volumeId = `nifti:${_viewerUrl(path)}`;
  await cornerstone.volumeLoader.createAndCacheVolume(volumeId);
  Viewer.currentVolumeId = volumeId;
  Viewer.currentSeriesId = seriesId;
  Viewer.currentPath = path;
  await _applyVolumeToViewports();
  _loadInfoPanel(path);
}

async function viewerLoadDicom(dir, seriesId) {
  await viewerInit();
  const { cornerstone } = window.BCV;
  _purgeVolumes();

  const resp = await apiGet('/api/viewer/dicom-series', { dir });
  const imageIds = resp.files.map((f) => `wadouri:${_viewerUrl(f)}`);
  const volumeId = `bc-dicom-${seriesId}`;

  // 并行加载DICOM切片（限制并发数），随后由切片构建体积
  const concurrency = 24;
  for (let i = 0; i < imageIds.length; i += concurrency) {
    const batch = imageIds.slice(i, i + concurrency);
    await Promise.all(batch.map((id) => cornerstone.imageLoader.loadAndCacheImage(id)));
  }
  await cornerstone.volumeLoader.createAndCacheVolumeFromImages(volumeId, imageIds);
  // 释放单切片缓存，仅保留体积
  imageIds.forEach((id) => {
    try { cornerstone.cache.removeImageLoadObject(id); } catch (e) { /* ignore */ }
  });

  Viewer.currentVolumeId = volumeId;
  Viewer.currentSeriesId = seriesId;
  Viewer.currentPath = dir;
  await _applyVolumeToViewports();
  _loadInfoPanel(dir);
}

async function _applyVolumeToViewports() {
  const { cornerstone } = window.BCV;
  await cornerstone.setVolumesForViewports(
    Viewer.renderingEngine,
    [{ volumeId: Viewer.currentVolumeId }],
    [...Viewer.viewportIds]
  );
  Viewer.viewportIds.forEach((vpId) => {
    const vp = Viewer.renderingEngine.getViewport(vpId);
    vp.resetCamera();
    vp.setProperties({ voiRange: WINDOW_PRESETS[Viewer.windowPreset] });
  });
  Viewer.renderingEngine.render();
  _updateAllSliders();
  const nameEl = document.getElementById('viewerSeriesName');
  if (nameEl) nameEl.textContent = Viewer.currentSeriesId || '';
}

function _viewportAxisInfo(vpId) {
  const { cornerstone } = window.BCV;
  if (!Viewer.renderingEngine || !Viewer.currentVolumeId) return null;
  const vp = Viewer.renderingEngine.getViewport(vpId);
  const volume = cornerstone.cache.getVolume(Viewer.currentVolumeId);
  if (!vp || !volume) return null;
  const cam = vp.getCamera();
  const n = cam.viewPlaneNormal || [0, 0, 1];
  let axis = 0;
  if (Math.abs(n[1]) > Math.abs(n[axis])) axis = 1;
  if (Math.abs(n[2]) > Math.abs(n[axis])) axis = 2;
  const origin = volume.imageData ? volume.imageData.getOrigin() : [0, 0, 0];
  return { vp, volume, cam, axis, origin };
}

/** 根据相机位置更新指定视图的滑块 */
function _updateSliderForViewport(vpId) {
  const info = _viewportAxisInfo(vpId);
  const slider = document.getElementById(SLIDER_IDS[vpId]);
  const valEl = document.getElementById(SLIDER_IDS[vpId] + 'Val');
  if (!info || !slider) return;
  const { cam, axis, origin, volume } = info;
  const dims = volume.dimensions;
  const spacing = volume.spacing;
  const max = dims[axis] - 1;
  const idx = Math.max(0, Math.min(max, Math.round((cam.focalPoint[axis] - origin[axis]) / spacing[axis])));
  slider.disabled = false;
  slider.min = 0;
  slider.max = max;
  slider.value = idx;
  if (valEl) valEl.textContent = `${idx}/${max}`;
}

function _updateAllSliders() {
  Viewer.viewportIds.forEach(_updateSliderForViewport);
}

/** 拖动某个视图的滑块，移动该视图的层面 */
function viewerSliderInput(vpId, value) {
  const info = _viewportAxisInfo(vpId);
  if (!info) return;
  const { vp, cam, axis, origin, volume } = info;
  const idx = Math.max(0, Math.min(volume.dimensions[axis] - 1, Number(value)));
  const target = origin[axis] + idx * volume.spacing[axis];
  const delta = target - cam.focalPoint[axis];
  const focalPoint = [...cam.focalPoint];
  const position = [...cam.position];
  focalPoint[axis] += delta;
  position[axis] += delta;
  vp.setCamera({ focalPoint, position });
  Viewer.renderingEngine.renderViewports([vpId]);
  const valEl = document.getElementById(SLIDER_IDS[vpId] + 'Val');
  if (valEl) valEl.textContent = `${idx}/${volume.dimensions[axis] - 1}`;
}

function viewerSetWindow(preset) {
  Viewer.windowPreset = preset;
  if (!Viewer.initialized || !Viewer.currentVolumeId) return;
  Viewer.viewportIds.forEach((vpId) => {
    const vp = Viewer.renderingEngine.getViewport(vpId);
    vp.setProperties({ voiRange: WINDOW_PRESETS[preset] });
  });
  Viewer.renderingEngine.render();
  document.querySelectorAll('.wl-btn').forEach((b) => b.classList.remove('active'));
  const map = { soft: 'btnWLSoft', lung: 'btnWLLung', bone: 'btnWLBone' };
  const btn = document.getElementById(map[preset]);
  if (btn) btn.classList.add('active');
}

async function viewerShowLabel(basePath, seriesId, labelName) {
  await viewerInit();
  const { cornerstone, cornerstoneTools } = window.BCV;

  if (Viewer.currentSeriesId !== seriesId || !Viewer.currentVolumeId) {
    await viewerLoadNifti(`${basePath}/ct_image/${seriesId}.nii.gz`, seriesId);
  }

  _removeLabelOverlay();

  const labelPath = `${basePath}/boa_label/${seriesId}/${labelName}`;
  const labelVolumeId = `nifti:${_viewerUrl(labelPath)}`;
  await cornerstone.volumeLoader.createAndCacheVolume(labelVolumeId);
  Viewer.currentLabelVolumeId = labelVolumeId;

  cornerstoneTools.segmentation.addSegmentations([
    {
      segmentationId: Viewer.segmentationId,
      representation: { type: 'LABELMAP', data: { volumeId: labelVolumeId } },
    },
  ]);
  const uids = await cornerstoneTools.segmentation.addSegmentationRepresentations(
    Viewer.toolGroupId,
    [{ segmentationId: Viewer.segmentationId, type: 'LABELMAP' }],
    { representations: { LABELMAP: { renderOutline: false, renderFill: true } } }
  );
  if (uids && uids.length) Viewer.currentLabelRepUID = uids[0];

  const labelVolume = cornerstone.cache.getVolume(labelVolumeId);
  const data = labelVolume.voxelManager ? labelVolume.voxelManager.getCompleteScalarData() : labelVolume.scalarData;
  let maxVal = 0;
  for (let i = 0; i < data.length; i += 97) {
    if (data[i] > maxVal) maxVal = data[i];
  }
  if (uids && uids.length) {
    Viewer.labelSegmentCount = Math.max(maxVal, 7);
    _applyLabelColors();
    try {
      cornerstoneTools.segmentation.triggerSegmentationEvents
        .triggerSegmentationRepresentationModified(Viewer.toolGroupId, uids[0]);
    } catch (e) { /* ignore */ }
  }
  Viewer.renderingEngine.render();
}

/** 按当前透明度为各标签段写入颜色（itk-snap风格：不同数值不同颜色） */
function _applyLabelColors() {
  const { cornerstoneTools } = window.BCV;
  if (!Viewer.currentLabelRepUID) return;
  const alpha = Math.round(Math.max(0.01, Math.min(1, Viewer.labelOpacity)) * 255);
  for (let s = 1; s <= Viewer.labelSegmentCount; s++) {
    const [r, g, b] = _labelColor(s);
    cornerstoneTools.segmentation.config.color.setColorForSegmentIndex(
      Viewer.toolGroupId, Viewer.currentLabelRepUID, s, [r, g, b, alpha]
    );
  }
}

/** 调整标签叠加透明度（1-100%） */
function viewerSetLabelOpacity(pct) {
  const { cornerstoneTools } = window.BCV;
  Viewer.labelOpacity = Math.max(1, Math.min(100, Number(pct) || 50)) / 100;
  const valEl = document.getElementById('labelOpacityVal');
  if (valEl) valEl.textContent = `${Math.round(Viewer.labelOpacity * 100)}%`;
  if (!Viewer.initialized || !Viewer.currentLabelRepUID) return;
  _applyLabelColors();
  try {
    cornerstoneTools.segmentation.triggerSegmentationEvents
      .triggerSegmentationRepresentationModified(Viewer.toolGroupId, Viewer.currentLabelRepUID);
  } catch (e) { /* ignore */ }
  Viewer.renderingEngine.render();
}

/** 移除当前的标签叠加（表示、分割状态与标签体积缓存） */
function _removeLabelOverlay() {
  const { cornerstone, cornerstoneTools } = window.BCV;
  if (Viewer.currentLabelRepUID) {
    try {
      cornerstoneTools.segmentation.removeSegmentationsFromToolGroup(
        Viewer.toolGroupId, [Viewer.currentLabelRepUID], true
      );
    } catch (e) { /* ignore */ }
    Viewer.currentLabelRepUID = null;
  }
  try {
    if (cornerstoneTools.segmentation.state.getSegmentation(Viewer.segmentationId)) {
      cornerstoneTools.segmentation.state.removeSegmentation(Viewer.segmentationId);
    }
  } catch (e) { /* ignore */ }
  if (Viewer.currentLabelVolumeId) {
    try {
      const vlo = cornerstone.cache.getVolumeLoadObject(Viewer.currentLabelVolumeId);
      if (vlo) cornerstone.cache.removeVolumeLoadObject(vlo);
    } catch (e) { /* ignore */ }
    Viewer.currentLabelVolumeId = null;
  }
}

function viewerHideLabel() {
  if (!Viewer.initialized) return;
  _removeLabelOverlay();
  Viewer.renderingEngine.render();
}

async function _loadInfoPanel(path) {
  const panel = document.getElementById('viewerInfoPanel');
  if (!panel) return;
  try {
    const resp = await apiGet('/api/viewer/image-info', { path });
    const info = resp.info || {};
    let html = '';
    Object.entries(info).forEach(([k, v]) => {
      let val = v;
      if (Array.isArray(v)) val = v.map((x) => (typeof x === 'number' ? +x.toFixed(4) : x)).join(', ');
      html += `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${val}</span></div>`;
    });
    panel.innerHTML = html || '<div class="console-empty">-</div>';
  } catch (e) {
    panel.innerHTML = `<div class="console-empty">${e.message}</div>`;
  }
}

function viewerResize() {
  if (Viewer.initialized && Viewer.renderingEngine) {
    Viewer.renderingEngine.resize(true, true);
    Viewer.renderingEngine.render();
    _updateAllSliders();
  }
}
