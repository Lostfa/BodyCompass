/**
 * BodyCompass 图像浏览器模块
 * 基于 cornerstone.js (cornerstone3D) 实现类 itk-snap 的 2x2 MPR 布局：
 * 轴位 / 矢状位 / 冠状位 / 矢状位（椎体定位）。
 * 交互：滚轮或滑块浏览层面，左键点击MPR联动定位。
 * 支持标签叠加显示（不同数值不同颜色，透明度可调）。
 * 右下矢状位：骨窗固定，叠加椎体中心层面蓝色细线及椎体名称。
 */

const Viewer = {
  initialized: false,
  _initPromise: null,
  renderingEngine: null,
  toolGroupId: 'bc-toolgroup',
  toolGroup2Id: 'bc-toolgroup2',
  viewportIds: ['vpAxial', 'vpSagittal', 'vpCoronal'],
  sag2Id: 'vpSagittal2',
  elementIds: {
    vpAxial: 'elAxial',
    vpSagittal: 'elSagittal',
    vpCoronal: 'elCoronal',
    vpSagittal2: 'elSagittal2',
  },
  orientations: {
    vpAxial: 'AXIAL',
    vpSagittal: 'SAGITTAL',
    vpCoronal: 'CORONAL',
    vpSagittal2: 'SAGITTAL',
  },
  currentVolumeId: null,
  currentLabelVolumeId: null,
  currentLabelRepUID: null,
  labelSegmentCount: 0,
  labelOpacity: 1.0,
  vertebraCenters: {},
  vertVolumeId: null,
  vertRepUID: null,
  vertSegId: 'bc-vertlines',
  currentSeriesId: null,
  currentPath: null,
  currentBasePath: '',
  currentLabelDir: '',
  sag2Mode: false,
  windowPreset: 'soft',
  segmentationId: 'bc-labelmap',
  _syncing: false,
  _loadSeq: 0,
};

function viewerAllViewportIds() {
  return [...Viewer.viewportIds, Viewer.sag2Id];
}

const SLIDER_IDS = {
  vpAxial: 'sliderAxial',
  vpSagittal: 'sliderSagittal',
  vpCoronal: 'sliderCoronal',
  vpSagittal2: 'sliderSagittal2',
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

  const toolGroup2 = csTools.ToolGroupManager.createToolGroup(Viewer.toolGroup2Id);
  toolGroup2.addTool(csTools.StackScrollMouseWheelTool.toolName);
  toolGroup2.addTool(csTools.SegmentationDisplayTool.toolName);
  toolGroup2.setToolEnabled(csTools.SegmentationDisplayTool.toolName);

  const MouseBindings = csTools.Enums.MouseBindings;
  toolGroup.setToolActive(csTools.StackScrollMouseWheelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });
  toolGroup2.setToolActive(csTools.StackScrollMouseWheelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Wheel }] });

  Viewer.renderingEngine = new cornerstone.RenderingEngine('bc-rendering-engine');
  const viewportInputArray = viewerAllViewportIds().map((vpId) => ({
    viewportId: vpId,
    type: cornerstone.Enums.ViewportType.ORTHOGRAPHIC,
    element: document.getElementById(Viewer.elementIds[vpId]),
    defaultOptions: {
      orientation: cornerstone.Enums.OrientationAxis[Viewer.orientations[vpId]],
      background: [0, 0, 0],
    },
    toolGroupId: vpId === Viewer.sag2Id ? Viewer.toolGroup2Id : Viewer.toolGroupId,
  }));
  Viewer.renderingEngine.setViewports(viewportInputArray);
  Viewer.viewportIds.forEach((vpId) => toolGroup.addViewport(vpId, 'bc-rendering-engine'));
  toolGroup2.addViewport(Viewer.sag2Id, 'bc-rendering-engine');

  viewerAllViewportIds().forEach((vpId) => {
    const el = document.getElementById(Viewer.elementIds[vpId]);
    el.addEventListener('click', (evt) => {
      const rect = el.getBoundingClientRect();
      _mprLink(vpId, [evt.clientX - rect.left, evt.clientY - rect.top]);
    });
    el.addEventListener('contextmenu', (evt) => evt.preventDefault());
    el.addEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, () => {
      _updateSliderForViewport(vpId);
      if (vpId === 'vpSagittal' || vpId === Viewer.sag2Id) _syncSagittals(vpId);
      if (vpId === Viewer.sag2Id) _updateVertebraLabelPositions();
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
  viewerAllViewportIds().forEach((otherId) => {
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
  _updateVertebraLabelPositions();
}

/** 两个矢状位视图保持层面同步 */
function _syncSagittals(sourceId) {
  if (Viewer._syncing || !Viewer.renderingEngine) return;
  const otherId = sourceId === Viewer.sag2Id ? 'vpSagittal' : Viewer.sag2Id;
  const src = Viewer.renderingEngine.getViewport(sourceId);
  const dst = Viewer.renderingEngine.getViewport(otherId);
  if (!src || !dst) return;
  const cam = src.getCamera();
  Viewer._syncing = true;
  try {
    dst.setCamera({ focalPoint: [...cam.focalPoint], position: [...cam.position] });
    Viewer.renderingEngine.renderViewports([otherId]);
  } finally {
    Viewer._syncing = false;
  }
  if (otherId === Viewer.sag2Id) _updateVertebraLabelPositions();
}

function _viewerUrl(path) {
  return `/api/viewer/file?path=${encodeURIComponent(path)}`;
}

/** 移除当前的组织标签叠加（表示、分割状态与标签体积缓存） */
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
  _releaseVolume(Viewer.currentLabelVolumeId);
  Viewer.currentLabelVolumeId = null;
}

/** 在视口已切换到新体积后，安全释放体积缓存 */
function _releaseVolume(volumeId) {
  if (!volumeId) return;
  const { cornerstone } = window.BCV;
  try {
    const vlo = cornerstone.cache.getVolumeLoadObject(volumeId);
    if (vlo) cornerstone.cache.removeVolumeLoadObject(vlo);
  } catch (e) { /* ignore */ }
}

async function viewerLoadNifti(path, seriesId, basePath, labelDir) {
  await viewerInit();
  const { cornerstone } = window.BCV;
  viewerSetLoading(true);
  try {
    _removeLabelOverlay();
    _removeVertebraOverlay();
    const oldVolumeId = Viewer.currentVolumeId;

    // 快速路径：服务端解压缓存+原始二进制传输；失败时回退到nifti加载器
    let volumeId;
    try {
      volumeId = await _loadVolumeFast(path);
    } catch (e) {
      volumeId = `nifti:${_viewerUrl(path)}`;
      await cornerstone.volumeLoader.createAndCacheVolume(volumeId);
      await new Promise((r) => setTimeout(r, 0));
    }
    Viewer.currentVolumeId = volumeId;
    Viewer.currentSeriesId = seriesId;
    Viewer.currentPath = path;
    Viewer.currentLabelDir = labelDir || (basePath ? `${basePath}/boa_label` : '');
    Viewer.currentBasePath = basePath || '';
    await _applyVolumeToViewports();
    if (oldVolumeId && oldVolumeId !== volumeId) _releaseVolume(oldVolumeId);
    _loadInfoPanel(path);
    if (Viewer.sag2Mode) _asyncBuildVertebraOverlay();
  } finally {
    viewerSetLoading(false);
  }
}

/** 快速加载NIfTI体积：直接读取服务端解压后的原始体素数据，避免浏览器端gzip解压 */
async function _loadVolumeFast(path) {
  const { cornerstone } = window.BCV;
  const volumeId = `raw:${path}`;
  if (cornerstone.cache.getVolume(volumeId)) return volumeId;

  const resp = await fetch(`/api/viewer/volume-raw?path=${encodeURIComponent(path)}`);
  if (!resp.ok) throw new Error(`volume-raw ${resp.status}`);
  const buf = await resp.arrayBuffer();
  const dv = new DataView(buf);
  let le = true;
  if (dv.getInt32(0, true) !== 348) {
    if (dv.getInt32(0, false) === 348) le = false;
    else throw new Error('not a NIfTI-1 file');
  }
  const dims = [dv.getInt16(42, le), dv.getInt16(44, le), dv.getInt16(46, le)];
  const datatype = dv.getInt16(70, le);
  const spacing = [
    Math.abs(dv.getFloat32(80, le)) || 1,
    Math.abs(dv.getFloat32(84, le)) || 1,
    Math.abs(dv.getFloat32(88, le)) || 1,
  ];
  const voxOffset = Math.round(dv.getFloat32(108, le)) || 352;
  const raw = buf.slice(voxOffset);
  let scalarData;
  switch (datatype) {
    case 2: scalarData = new Uint8Array(raw); break;
    case 4: scalarData = new Int16Array(raw); break;
    case 8: scalarData = new Int32Array(raw); break;
    case 16: scalarData = new Float32Array(raw); break;
    case 512: scalarData = new Uint16Array(raw); break;
    default: throw new Error(`unsupported NIfTI datatype ${datatype}`);
  }

  const infoResp = await apiGet('/api/viewer/image-info', { path });
  const info = infoResp.info;

  cornerstone.volumeLoader.createLocalVolume({
    scalarData,
    dimensions: dims,
    spacing,
    origin: Array.from(info.origin),
    direction: Array.from(info.direction),
    metadata: {},
  }, volumeId);
  await new Promise((r) => setTimeout(r, 0));
  if (!cornerstone.cache.getVolume(volumeId)) throw new Error('local volume not cached');
  return volumeId;
}

async function viewerLoadDicom(dir, seriesId, basePath) {
  await viewerInit();
  const { cornerstone } = window.BCV;
  viewerSetLoading(true);
  try {
    _removeLabelOverlay();
    _removeVertebraOverlay();
    const oldVolumeId = Viewer.currentVolumeId;

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
    imageIds.forEach((id) => {
      try { cornerstone.cache.removeImageLoadObject(id); } catch (e) { /* ignore */ }
    });

    Viewer.currentVolumeId = volumeId;
    Viewer.currentSeriesId = seriesId;
    Viewer.currentPath = dir;
    Viewer.currentLabelDir = basePath ? `${basePath}/boa_label` : '';
    Viewer.currentBasePath = basePath || '';
    await _applyVolumeToViewports();
    if (oldVolumeId && oldVolumeId !== volumeId) _releaseVolume(oldVolumeId);
    _loadInfoPanel(dir);
    if (Viewer.sag2Mode) _asyncBuildVertebraOverlay();
  } finally {
    viewerSetLoading(false);
  }
}

/** 加载动画显示/隐藏 */
function viewerSetLoading(on) {
  document.querySelectorAll('.vp-loading').forEach((d) => {
    d.style.display = on ? 'flex' : 'none';
  });
}

/** 右下窗口模式：步骤3=椎体定位矢状位；步骤1/2=图像信息 */
function viewerSetSag2Mode(enabled) {
  Viewer.sag2Mode = !!enabled;
  const show = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? '' : 'none';
  };
  show('elSagittal2', enabled);
  show('sag2SliderRow', enabled);
  show('vertLabels', enabled);
  show('sag2Label', enabled);
  show('infoLabel', !enabled);
  const infoPanel = document.getElementById('viewerInfoPanel');
  if (infoPanel) infoPanel.style.display = enabled ? 'none' : '';
  if (Viewer.initialized) Viewer.renderingEngine.resize(true, true);
  if (enabled && Viewer.currentVolumeId && !Viewer.vertRepUID) {
    _asyncBuildVertebraOverlay();
  }
}

/** 异步构建椎体叠加：先显示视图，再补充右下内容 */
function _asyncBuildVertebraOverlay() {
  const token = ++Viewer._loadSeq;
  const basePath = Viewer.currentBasePath;
  const labelDir = Viewer.currentLabelDir;
  const seriesId = Viewer.currentSeriesId;
  _loadVertebraCenters(basePath, seriesId, labelDir).then(() => {
    if (token !== Viewer._loadSeq || !Viewer.sag2Mode) return;
    return _buildVertebraOverlay();
  }).catch(() => { /* ignore */ });
}

/** 图像信息面板 */
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

async function _loadVertebraCenters(basePath, seriesId, labelDir) {
  Viewer.vertebraCenters = {};
  if (!basePath && !labelDir) return;
  try {
    const resp = await apiGet('/api/viewer/vertebra-centers', {
      base_path: basePath || '', series_id: seriesId, label_dir: labelDir || '',
    });
    Viewer.vertebraCenters = resp.centers || {};
  } catch (e) { /* 无标签时忽略 */ }
}

async function _applyVolumeToViewports() {
  const { cornerstone } = window.BCV;
  await cornerstone.setVolumesForViewports(
    Viewer.renderingEngine,
    [{ volumeId: Viewer.currentVolumeId }],
    viewerAllViewportIds()
  );
  Viewer.renderingEngine.resize(true, true);
  viewerAllViewportIds().forEach((vpId) => {
    const vp = Viewer.renderingEngine.getViewport(vpId);
    vp.resetCamera();
  });
  // 主三窗应用当前窗宽窗位；右下矢状位固定骨窗
  Viewer.viewportIds.forEach((vpId) => {
    Viewer.renderingEngine.getViewport(vpId)
      .setProperties({ voiRange: WINDOW_PRESETS[Viewer.windowPreset] });
  });
  Viewer.renderingEngine.getViewport(Viewer.sag2Id)
    .setProperties({ voiRange: WINDOW_PRESETS.bone });
  _syncSagittals('vpSagittal');
  Viewer.renderingEngine.render();
  _updateAllSliders();
  const nameEl = document.getElementById('viewerSeriesName');
  if (nameEl) nameEl.textContent = Viewer.currentSeriesId || '';
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
  viewerAllViewportIds().forEach(_updateSliderForViewport);
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
  // 右下矢状位固定骨窗，不随调节变化
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

// ===== 组织标签叠加 =====

async function viewerShowLabel(basePath, seriesId, labelName, dirs) {
  await viewerInit();
  const { cornerstone, cornerstoneTools } = window.BCV;

  const ctBase = (dirs && dirs.ctDir) ? dirs.ctDir : `${basePath}/ct_image`;
  const labelBase = (dirs && dirs.labelDir) ? dirs.labelDir : `${basePath}/boa_label`;

  if (Viewer.currentSeriesId !== seriesId || !Viewer.currentVolumeId) {
    await viewerLoadNifti(`${ctBase}/${seriesId}.nii.gz`, seriesId, basePath, labelBase);
  }

  _removeLabelOverlay();

  const labelPath = `${labelBase}/${seriesId}/${labelName}`;
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

function viewerHideLabel() {
  if (!Viewer.initialized) return;
  _removeLabelOverlay();
  Viewer.renderingEngine.render();
}

// ===== 椎体中心层面叠加（右下矢状位） =====

function _removeVertebraOverlay() {
  const { cornerstone, cornerstoneTools } = window.BCV;
  if (Viewer.vertRepUID) {
    try {
      cornerstoneTools.segmentation.removeSegmentationsFromToolGroup(
        Viewer.toolGroup2Id, [Viewer.vertRepUID], true
      );
    } catch (e) { /* ignore */ }
    Viewer.vertRepUID = null;
  }
  try {
    if (cornerstoneTools.segmentation.state.getSegmentation(Viewer.vertSegId)) {
      cornerstoneTools.segmentation.state.removeSegmentation(Viewer.vertSegId);
    }
  } catch (e) { /* ignore */ }
  _releaseVolume(Viewer.vertVolumeId);
  Viewer.vertVolumeId = null;
  const holder = document.getElementById('vertLabels');
  if (holder) holder.innerHTML = '';
}

async function _buildVertebraOverlay() {
  const { cornerstone, cornerstoneTools } = window.BCV;
  const holder = document.getElementById('vertLabels');
  const names = Object.keys(Viewer.vertebraCenters || {});
  if (holder) holder.innerHTML = '';
  if (!Viewer.currentVolumeId || names.length === 0) return;

  const ct = cornerstone.cache.getVolume(Viewer.currentVolumeId);
  if (!ct) return;
  const dims = ct.dimensions;
  const spacing = ct.spacing;
  const origin = ct.origin;
  const direction = ct.direction;

  // 构建椎体中心层面label体积：每个中心层面为1个体素厚的平面
  const data = new Uint8Array(dims[0] * dims[1] * dims[2]);
  const plane = dims[0] * dims[1];
  names.forEach((name) => {
    const z = Viewer.vertebraCenters[name];
    if (z >= 0 && z < dims[2]) data.fill(1, z * plane, (z + 1) * plane);
  });

  const volId = `bc-vertlines-${Viewer.currentSeriesId}`;
  cornerstone.volumeLoader.createLocalVolume({
    scalarData: data,
    dimensions: [dims[0], dims[1], dims[2]],
    spacing: [spacing[0], spacing[1], spacing[2]],
    origin: [origin[0], origin[1], origin[2]],
    direction: Array.from(direction),
    metadata: {},
  }, volId);
  // createLocalVolume 的缓存写入在微任务中完成，需让出一个事件循环
  await new Promise((r) => setTimeout(r, 0));
  Viewer.vertVolumeId = volId;

  cornerstoneTools.segmentation.addSegmentations([
    {
      segmentationId: Viewer.vertSegId,
      representation: { type: 'LABELMAP', data: { volumeId: volId } },
    },
  ]);
  const uids = await cornerstoneTools.segmentation.addSegmentationRepresentations(
    Viewer.toolGroup2Id,
    [{ segmentationId: Viewer.vertSegId, type: 'LABELMAP' }],
    { representations: { LABELMAP: { renderOutline: false, renderFill: true } } }
  );
  Viewer.vertRepUID = uids && uids[0];
  if (Viewer.vertRepUID) {
    cornerstoneTools.segmentation.config.color.setColorForSegmentIndex(
      Viewer.toolGroup2Id, Viewer.vertRepUID, 1, [77, 163, 255, 255]
    );
    try {
      cornerstoneTools.segmentation.triggerSegmentationEvents
        .triggerSegmentationRepresentationModified(Viewer.toolGroup2Id, Viewer.vertRepUID);
    } catch (e) { /* ignore */ }
  }

  // 椎体名称标签
  if (holder) {
    names.forEach((name) => {
      const d = document.createElement('div');
      d.className = 'vert-label';
      d.textContent = name;
      d.dataset.z = Viewer.vertebraCenters[name];
      holder.appendChild(d);
    });
  }
  Viewer.renderingEngine.render();
  _updateVertebraLabelPositions();
}

/** 根据右下矢状位相机位置更新椎体名称标签的垂直位置 */
function _updateVertebraLabelPositions() {
  const holder = document.getElementById('vertLabels');
  if (!holder || !holder.childElementCount || !Viewer.renderingEngine || !Viewer.currentVolumeId) return;
  const { cornerstone } = window.BCV;
  const vp = Viewer.renderingEngine.getViewport(Viewer.sag2Id);
  const ct = cornerstone.cache.getVolume(Viewer.currentVolumeId);
  if (!vp || !ct) return;
  const h = vp.canvas.clientHeight || 1;
  holder.querySelectorAll('.vert-label').forEach((d) => {
    const z = Number(d.dataset.z);
    let pos = null;
    try {
      pos = vp.worldToCanvas([0, 0, ct.origin[2] + z * ct.spacing[2]]);
    } catch (e) { /* ignore */ }
    if (!pos || !isFinite(pos[1]) || pos[1] < 0 || pos[1] > h) {
      d.style.display = 'none';
      return;
    }
    d.style.display = '';
    d.style.top = `${Math.round(pos[1] - 8)}px`;
  });
}
