/**
 * 步骤导航与状态管理模块
 * 管理4步向导流程、步骤间数据传递、右侧面板标签页切换和UI状态更新。
 */

// ===== 文件夹选择器 =====

/**
 * 通过后端原生对话框选择文件夹。
 * 调用 Python tkinter 的文件夹选择器，获取完整的本地路径。
 *
 * @param {string} _pickerId - 未使用（保留参数兼容旧HTML onclick调用）
 * @param {string} targetInputId - 要填入路径的文本输入框ID
 */
async function pickFolder(_pickerId, targetInputId) {
  const target = document.getElementById(targetInputId);
  if (!target) return;

  try {
    const resp = await fetch('/api/system/pick-folder');
    const data = await resp.json();
    if (data.success && data.path) {
      target.value = data.path;
      if (target.classList.contains('wd-input') || targetInputId === 'baseWorkingDir') {
        syncWorkingDirs(data.path);
      } else if (targetInputId === 'step1WorkDir') {
        syncWorkingDirs(data.path);
      }
    }
  } catch (e) {
    console.error('文件夹选择失败:', e);
  }
}

/** 在系统默认文件管理器中打开当前工作目录 */
async function openWorkDirInExplorer() {
  const dirPath = document.getElementById('baseWorkingDir').value;
  if (!dirPath) {
    alert(t('js.noWorkingDir'));
    return;
  }
  try {
    await apiOpenFolder(dirPath);
  } catch (e) {
    alert(t('js.openFolderFail') + (e.message || e));
  }
}

// ===== 全局应用状态 =====
const AppState = {
  activeStep: 1,
  baseWorkingDir: 'D:/BodyCompass',
  preprocess: {
    inputType: 'dicom',
    inputPath: '',
    patients: [],
    selectedIds: [],
    taskId: null,
    running: false,
  },
  boa: {
    patients: [],
    selectedIds: [],
    models: 'all',
    taskId: null,
    running: false,
    envChecked: false,
    boaAvailable: false,
    gpuAvailable: false,
  },
  analysis: {
    mode: 'B',
    basePath: '',
    workers: 4,
    taskId: null,
    running: false,
    vertebrae: [],
    ranges: [],
    includeAll: true,
    patients: [],
  },
  export: {
    basePath: '',
    patients: [],
    scanTypes: [],
    includeAll: true,
    singleVertebrae: [],
    ranges: [],
    tissues: ['MUSCLE', 'BONE', 'SAT', 'VAT', 'IMAT', 'PAT', 'EAT'],
    metrics: ['volume', 'max-hu', 'min-hu', 'mean-hu', 'std-hu', 'median-hu', 'q1-hu', 'q3-hu'],
    taskId: null,
    running: false,
  },
};

// ===== 步骤导航 =====

function goToStep(step) {
  step = Math.max(1, Math.min(4, step));
  AppState.activeStep = step;
  updateStepIndicators();
  updateStepPanel();
}

function goToPrevStep() { goToStep(AppState.activeStep - 1); }
function goToNextStep() { goToStep(AppState.activeStep + 1); }

function updateStepIndicators() {
  document.querySelectorAll('.step-indicator').forEach((el, i) => {
    const stepNum = i + 1;
    el.classList.remove('active', 'completed');
    if (stepNum === AppState.activeStep) el.classList.add('active');
    else if (stepNum < AppState.activeStep) el.classList.add('completed');
  });

  document.getElementById('step1Status').textContent = AppState.preprocess.patients.length > 0
    ? `(${AppState.preprocess.patients.length} ${currentLang === 'zh' ? '个序列' : 'series'})` : t('step1.desc');
  document.getElementById('step2Status').textContent = AppState.boa.patients.length > 0
    ? `(${AppState.boa.patients.length} ${currentLang === 'zh' ? '个序列' : 'series'})` : t('step2.desc');

  const btnPrev = document.getElementById('btnPrevStep');
  const btnNext = document.getElementById('btnNextStep');
  const navLabel = document.getElementById('consoleNavLabel');
  if (btnPrev) {
    btnPrev.disabled = AppState.activeStep <= 1;
    btnPrev.textContent = t('nav.prev');
  }
  if (btnNext) {
    btnNext.disabled = AppState.activeStep >= 4;
    btnNext.textContent = t('nav.next');
  }
  if (navLabel) navLabel.textContent = `${t('nav.step')} ${AppState.activeStep} / 4`;
}

function updateStepPanel() {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`step${AppState.activeStep}Panel`);
  if (panel) panel.classList.add('active');

  // 右侧标签页可见性：步骤4显示"数据表格"，步骤1-3显示"图像浏览"
  const tabViewer = document.getElementById('tabViewer');
  const tabTable = document.getElementById('tabTable');
  if (tabViewer) tabViewer.style.display = AppState.activeStep === 4 ? 'none' : '';
  if (tabTable) tabTable.style.display = AppState.activeStep === 4 ? '' : 'none';
  if (AppState.activeStep === 4 && document.getElementById('tabViewer').classList.contains('active')) {
    switchRightTab('console');
  }

  if (AppState.activeStep === 2) refreshBOAPatients();
  if (AppState.activeStep === 3) refreshStep3Patients();
  if (AppState.activeStep === 4) {
    document.getElementById('step4ScanOptions').style.display = 'none';
    document.getElementById('step4Status').style.display = 'none';
  }
}

// ===== 右侧面板标签页 =====

function switchRightTab(name) {
  const views = { console: 'consoleView', viewer: 'viewerView', table: 'tableView' };
  const tabs = { console: 'tabConsole', viewer: 'tabViewer', table: 'tabTable' };
  Object.keys(views).forEach((k) => {
    const v = document.getElementById(views[k]);
    const b = document.getElementById(tabs[k]);
    if (v) v.style.display = k === name ? 'flex' : 'none';
    if (b) b.classList.toggle('active', k === name);
  });
  if (name === 'viewer') {
    viewerInit().then(() => {
      viewerResize();
      if (Viewer.currentVolumeId) Viewer.renderingEngine.render();
    }).catch((e) => console.error('viewer init failed:', e));
  }
  if (name === 'table') {
    const wrap = document.getElementById('tablePreviewWrap');
    if (wrap) wrap.scrollTop = 0;
  }
}

// ===== 任务进度UI =====

let activeTaskStream = null;

function showProgress(containerId, show) {
  const wrap = document.getElementById('consoleProgress');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}

function updateProgress(containerId, percent, text) {
  const fill = document.getElementById('consoleProgressFill');
  const textEl = document.getElementById('consoleProgressText');
  if (fill) fill.style.width = percent + '%';
  if (textEl) textEl.textContent = text || '';
  const statusEl = document.getElementById('consoleStatus');
  if (statusEl && text) statusEl.textContent = text;
}

function showLogPanel(containerId, show) { /* 控制台始终可见，保留兼容 */ }

function appendLog(containerId, message, level) {
  const panel = document.getElementById('consoleLog');
  if (!panel) return;
  const empty = panel.querySelector('.console-empty');
  if (empty) empty.remove();

  const line = document.createElement('div');
  line.className = 'log-line';
  if (level === 'success') line.classList.add('log-success');
  else if (level === 'error') line.classList.add('log-error');
  else if (level === 'warn') line.classList.add('log-warn');
  else if (level === 'info') line.classList.add('log-info');
  line.textContent = message;
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
}

function clearLog(containerId) {
  const panel = document.getElementById('consoleLog');
  if (panel) {
    panel.innerHTML = `<div class="console-empty">${t('console.ready')}</div>`;
  }
}

function clearConsole() {
  clearLog();
  showProgress('', false);
  document.getElementById('consoleStatus').textContent = t('console.cleared');
}

function showStatusBox(boxId, type, message) {
  const box = document.getElementById(boxId);
  if (box) {
    box.className = `status-box ${type}`;
    box.innerHTML = message;
    box.style.display = 'block';
  }
  const statusEl = document.getElementById('consoleStatus');
  if (statusEl) {
    let label = '';
    if (type === 'success') label = '[OK] ';
    else if (type === 'error') label = '[ERROR] ';
    else if (type === 'warning') label = '[WARN] ';
    statusEl.textContent = label + message.replace(/<[^>]*>/g, '');
  }
}

function hideStatusBox(boxId) {
  const box = document.getElementById(boxId);
  if (box) box.style.display = 'none';
}

// ===== 任务执行辅助 =====

function runTaskWithUI(taskId, progressContainerId, logContainerId,
                       onComplete, onResult, onError) {
  showProgress(progressContainerId, true);
  showLogPanel(logContainerId, true);
  clearLog(logContainerId);
  updateProgress(progressContainerId, 0, t('js.taskSubmitted'));

  try {
    activeTaskStream = apiStreamTask(taskId, {
      onProgress: (percent, msg) => {
        updateProgress(progressContainerId, percent, msg || '');
      },
      onLog: (msg) => {
        let level = '';
        if (msg.includes('[OK]') || msg.includes('[DONE]') || msg.includes('[成功]') || msg.includes('完成')) level = 'success';
        else if (msg.includes('[FAIL]') || msg.includes('[ERROR]') || msg.includes('[EXCEPTION]') || msg.includes('[失败]') || msg.includes('[异常]') || msg.includes('[错误]')) level = 'error';
        else if (msg.includes('[WARN]') || msg.includes('[警告]')) level = 'warn';
        appendLog(logContainerId, msg, level);
      },
      onComplete: () => {
        updateProgress(progressContainerId, 100, t('js.taskDone'));
        showLogPanel(logContainerId, false);
        if (onComplete) onComplete();
      },
      onResult: (result) => {
        if (onResult) onResult(result);
      },
      onError: (err) => {
        updateProgress(progressContainerId, 0, `${t('js.errorPrefix')}${err}`);
        appendLog(logContainerId, `[ERROR] ${err}`, 'error');
        if (onError) onError(err);
      },
      onCancelled: () => {
        updateProgress(progressContainerId, 0, t('js.taskCancelled'));
      },
    });
  } catch (e) {
    apiPollTask(taskId, {
      onProgress: (percent, msg) => {
        updateProgress(progressContainerId, percent, msg || '');
      },
      onLog: (msg) => {
        appendLog(logContainerId, msg, '');
      },
      onComplete: () => {
        updateProgress(progressContainerId, 100, t('js.taskDone'));
        if (onComplete) onComplete();
      },
      onResult: (result) => {
        if (onResult) onResult(result);
      },
      onError: (err) => {
        updateProgress(progressContainerId, 0, `${t('js.errorPrefix')}${err}`);
        if (onError) onError(err);
      },
    });
  }
}

function cancelActiveTask() {
  if (activeTaskStream) {
    activeTaskStream.close();
    activeTaskStream = null;
  }
}

// ===== 通用UI辅助 =====

function renderPatientTable(containerId, patients, checkboxes = false, selectedIds = [], inputType = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!patients || patients.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-text">${t('js.noSeries')}</div></div>`;
    return;
  }

  let html = '<table><thead><tr>';
  if (checkboxes) html += '<th><input type="checkbox" class="select-all-cb"></th>';

  if (inputType) {
    html += `<th>${t('table.seriesId')}</th>`;
    if (inputType === 'dicom') html += `<th>${t('table.scanDate')}</th>`;
    html += `<th>${t('table.imageSize')}</th>`;
    html += `<th>${t('table.spacing')}</th>`;
  } else {
    html += `<th>${t('table.seriesId')}</th><th>${t('table.status')}</th><th>${t('table.detail')}</th>`;
  }
  html += '</tr></thead><tbody>';

  patients.forEach((p) => {
    const pid = p.patient_id || p.id || '';
    html += '<tr>';
    if (checkboxes) {
      const checked = selectedIds.includes(pid) ? 'checked' : '';
      html += `<td><input type="checkbox" class="patient-cb" value="${pid}" ${checked}></td>`;
    }

    if (inputType) {
      html += `<td>${pid}</td>`;
      if (inputType === 'dicom') {
        const date = p.series_date || '';
        html += `<td class="${date ? '' : 'text-muted'}">${date || '-'}</td>`;
      }
      html += `<td>${p.image_size || 'N/A'}</td>`;
      html += `<td>${p.image_spacing || 'N/A'}</td>`;
    } else {
      const status = p.status || '';
      const detail = p.file_count ? `${p.file_count} ${t('table.files')}` : (p.existing_files || []).join(', ') || (p.csv_files || []).length + ` ${t('table.csvFiles')}`;
      let statusClass = '';
      if (status === 'done' || status === 'completed') statusClass = 'text-success';
      else if (status === 'pending') statusClass = 'text-muted';
      else if (status === 'partial') statusClass = 'text-muted';
      html += `<td>${pid}</td>`;
      html += `<td class="${statusClass}">${status}</td>`;
      html += `<td>${detail}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';

  container.innerHTML = html;

  if (checkboxes) {
    const selectAll = container.querySelector('.select-all-cb');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        container.querySelectorAll('.patient-cb').forEach(cb => { cb.checked = e.target.checked; });
        updateViewButtons();
      });
    }
    container.querySelectorAll('.patient-cb').forEach(cb => {
      cb.addEventListener('change', updateViewButtons);
    });
  }
  updateViewButtons();
}

function getSelectedPatientIds(tableContainerId) {
  const container = document.getElementById(tableContainerId);
  if (!container) return [];
  const cbs = container.querySelectorAll('.patient-cb:checked');
  return Array.from(cbs).map(cb => cb.value);
}

/** 恰好选中一个序列时启用"浏览图像"按钮 */
function updateViewButtons() {
  const pairs = [
    ['step1PatientTable', 'btnViewImage1'],
    ['step2PatientTable', 'btnViewImage2'],
    ['step3PatientTable', 'btnViewImage3'],
  ];
  pairs.forEach(([tableId, btnId]) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const n = getSelectedPatientIds(tableId).length;
    btn.disabled = n !== 1;
  });
  const sel3 = document.getElementById('step3LabelSelect');
  const btnShow3 = document.getElementById('btnShowLabel');
  if (sel3 && btnShow3) {
    const n = getSelectedPatientIds('step3PatientTable').length;
    sel3.disabled = n !== 1;
    btnShow3.disabled = n !== 1;
  }
}

function toggleGroup(containerId, select) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = select; });
}

function getCheckedValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
}

// ===== 同步工作目录 =====

function syncWorkingDirs(sourceValue) {
  AppState.baseWorkingDir = sourceValue;
  const headerDir = document.getElementById('baseWorkingDir');
  if (headerDir) headerDir.value = sourceValue;
  document.querySelectorAll('.wd-input').forEach(inp => { inp.value = sourceValue; });
  const step1Dir = document.getElementById('step1WorkDir');
  if (step1Dir) step1Dir.value = sourceValue;
  const step3Ct = document.getElementById('step3CtDir');
  if (step3Ct) step3Ct.value = sourceValue + '/ct_image';
  const step3Label = document.getElementById('step3LabelDir');
  if (step3Label) step3Label.value = sourceValue + '/boa_label';
  const step4Dir = document.getElementById('step4BasePath');
  if (step4Dir) step4Dir.value = sourceValue;
}

// ===== 初始化 =====

function initWizard() {
  document.querySelectorAll('.step-indicator').forEach(el => {
    el.addEventListener('click', () => {
      const step = parseInt(el.dataset.step);
      goToStep(step);
    });
  });

  document.getElementById('baseWorkingDir').value = AppState.baseWorkingDir;
  document.getElementById('baseWorkingDir').addEventListener('change', (e) => {
    syncWorkingDirs(e.target.value);
  });

  const sliderMap = { sliderAxial: 'vpAxial', sliderSagittal: 'vpSagittal', sliderCoronal: 'vpCoronal' };
  Object.entries(sliderMap).forEach(([sliderId, vpId]) => {
    const slider = document.getElementById(sliderId);
    if (slider) slider.addEventListener('input', (e) => viewerSliderInput(vpId, e.target.value));
  });

  syncWorkingDirs(AppState.baseWorkingDir);
  updateStepIndicators();
  updateStepPanel();
}
