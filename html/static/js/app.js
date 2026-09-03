/**
 * 主应用控制器
 * 连接UI事件与API调用，管理4步工作流的业务逻辑与图像浏览器联动。
 */

document.addEventListener('DOMContentLoaded', () => {
  initWizard();
  loadAnalysisDefaults();
  initStep1();
  initStep2();
  initStep3();
  initStep4();
});

// ===== 加载默认配置 =====

async function loadAnalysisDefaults() {
  try {
    const defaults = await apiGetAnalysisDefaults();
    applyDefaults(defaults);
  } catch (e) {
    console.log('加载默认配置失败，使用内置默认值:', e);
    applyDefaults({
      vertebrae: ['C2','C3','C4','C5','C6','C7','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12','L1','L2','L3','L4','L5'],
      ranges: [1, 5, 10, 20],
      tissues: {'MUSCLE':'肌肉','BONE':'骨骼','SAT':'皮下脂肪','VAT':'腹腔脂肪','IMAT':'肌间脂肪','PAT':'纵隔脂肪','EAT':'心包脂肪'},
      metrics: {'volume':'容积','max-hu':'最大值','min-hu':'最小值','mean-hu':'均值','std-hu':'标准差','median-hu':'中位数','q1-hu':'四分位数间距1','q3-hu':'四分位数间距2'},
    });
  }
}

function applyDefaults(defaults) {
    AppState.analysis.vertebrae = defaults.vertebrae || [];
    AppState.analysis.ranges = defaults.ranges || [];
    AppState.export.singleVertebrae = [];
    AppState.export.ranges = [];
    renderModeBOptions(defaults);
    renderTissueMetrics(defaults);
    renderVertebraOptions(defaults);
}

function renderModeBOptions(defaults) {
  if (defaults.vertebrae) {
    const numSort = (a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1));
    const cervical = defaults.vertebrae.filter(v => v.startsWith('C')).sort(numSort);
    const thoracic = defaults.vertebrae.filter(v => v.startsWith('T')).sort(numSort);
    const lumbar   = defaults.vertebrae.filter(v => v.startsWith('L')).sort(numSort);

    const vertContainer = document.getElementById('step3VertGrid');
    if (vertContainer) {
      vertContainer.innerHTML = '';
      const renderGroup = (key, verts) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'vertebra-group';
        groupDiv.innerHTML = `<span class="vertebra-group-label" data-i18n="${key}">${t(key)}</span>`;
        verts.forEach(v => {
          const item = document.createElement('div');
          item.className = 'tag-item';
          item.innerHTML = `
            <input type="checkbox" id="sv_${v}" value="${v}" checked>
            <label for="sv_${v}">${v}</label>`;
          groupDiv.appendChild(item);
        });
        vertContainer.appendChild(groupDiv);
      };
      if (cervical.length) renderGroup('step3.cervical', cervical);
      if (thoracic.length) renderGroup('step3.thoracic', thoracic);
      if (lumbar.length)   renderGroup('step3.lumbar', lumbar);
    }
  }

  const rangeContainer = document.getElementById('step3RangeGrid');
  if (rangeContainer && defaults.ranges) {
    rangeContainer.innerHTML = defaults.ranges.map(r =>
      `<div class="tag-item">
        <input type="checkbox" id="rg_${r}" value="${r}" checked>
        <label for="rg_${r}">${r}mm</label>
      </div>`
    ).join('');
  }

  const customContainer = document.getElementById('step3CustomRange');
  if (customContainer) {
    customContainer.innerHTML = `
      <div class="custom-range-row">
        <label class="custom-range-check">
          <input type="checkbox" id="rg_custom_enable">
          <span data-i18n="step3.customRange">${t('step3.customRange')}</span>
        </label>
        <input type="range" id="rg_custom_slider" min="1" max="30" value="15" step="1"
               disabled oninput="document.getElementById('rg_custom_val').textContent=this.value">
        <span class="custom-range-val" id="rg_custom_val">15</span>
        <span>mm</span>
      </div>`;
    document.getElementById('rg_custom_enable').addEventListener('change', function() {
      document.getElementById('rg_custom_slider').disabled = !this.checked;
    });
  }
}

function renderVertebraOptions(defaults) {
  const vertGrid = document.getElementById('exportVertGrid');
  if (vertGrid) {
    vertGrid.innerHTML = `<span style="font-size:12px;color:#999;">${t('js.scanCSVHint')}</span>`;
  }
  const rangeGrid = document.getElementById('exportRangeGrid');
  if (rangeGrid) rangeGrid.innerHTML = '';
}

// ===== 椎体范围分析（两椎体之间）=====

function sortVertebraeForRange(arr) {
  const numSort = (a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1));
  return [
    ...arr.filter(v => v.startsWith('C')).sort(numSort),
    ...arr.filter(v => v.startsWith('T')).sort(numSort),
    ...arr.filter(v => v.startsWith('L')).sort(numSort),
  ];
}

function vertRangeSelectOptions(selected, placeholder) {
  const list = sortVertebraeForRange(AppState.analysis.vertebrae || []);
  const labels = { C: t('step3.cervical'), T: t('step3.thoracic'), L: t('step3.lumbar') };
  let html = `<option value="">${placeholder || '--'}</option>`;
  ['C', 'T', 'L'].forEach(prefix => {
    const vs = list.filter(v => v.startsWith(prefix));
    if (!vs.length) return;
    html += `<optgroup label="${labels[prefix] || prefix}">` + vs.map(v =>
      `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`).join('') + '</optgroup>';
  });
  return html;
}

function addVertRangeRow() {
  const list = document.getElementById('step3VertRangeList');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'vert-range-row';
  row.innerHTML = `
    <select class="vert-range-select vr-start">${vertRangeSelectOptions('', t('step3.vertRangeStart'))}</select>
    <span class="vert-range-sep">~</span>
    <select class="vert-range-select vr-end">${vertRangeSelectOptions('', t('step3.vertRangeEnd'))}</select>
    <button class="btn btn-outline btn-sm vr-remove" type="button" title="${t('step3.vertRangeRemove')}">&#10005;</button>`;
  list.appendChild(row);
}

function collectVertRangePairs() {
  const list = document.getElementById('step3VertRangeList');
  if (!list) return [];
  const pairs = [];
  for (const row of list.querySelectorAll('.vert-range-row')) {
    const start = row.querySelector('.vr-start').value;
    const end = row.querySelector('.vr-end').value;
    if (!start && !end) continue; // 未填写的空行忽略
    if (!start || !end) { alert(t('js.vertRangeIncomplete')); return null; }
    if (start === end) { alert(t('js.vertRangeSame')); return null; }
    pairs.push({ start, end });
  }
  return pairs;
}

function initVertRangeUI() {
  const list = document.getElementById('step3VertRangeList');
  if (!list) return;
  const addBtn = document.getElementById('step3AddVertRange');
  if (addBtn) addBtn.addEventListener('click', addVertRangeRow);

  list.addEventListener('change', (e) => {
    if (!e.target.classList.contains('vert-range-select')) return;
    const row = e.target.closest('.vert-range-row');
    const other = e.target.classList.contains('vr-start')
      ? row.querySelector('.vr-end') : row.querySelector('.vr-start');
    if (e.target.value && e.target.value === other.value) {
      alert(t('js.vertRangeSame'));
      e.target.value = '';
    }
  });

  list.addEventListener('click', (e) => {
    if (e.target.classList.contains('vr-remove')) {
      e.target.closest('.vert-range-row').remove();
    }
  });
}

function renderTissueMetrics(defaults) {
  const tissueGrid = document.getElementById('exportTissueGrid');
  if (tissueGrid && defaults.tissues) {
    tissueGrid.innerHTML = Object.entries(defaults.tissues).map(([key, name]) =>
      `<div class="tag-item">
        <input type="checkbox" id="ex_ts_${key}" value="${key}" checked>
        <label for="ex_ts_${key}">${name}<br><small>${key}</small></label>
      </div>`
    ).join('');
  }
  const metricGrid = document.getElementById('exportMetricGrid');
  if (metricGrid && defaults.metrics) {
    metricGrid.innerHTML = Object.entries(defaults.metrics).map(([key, name]) =>
      `<div class="tag-item">
        <input type="checkbox" id="ex_mt_${key}" value="${key}" checked>
        <label for="ex_mt_${key}">${name}<br><small>${key}</small></label>
      </div>`
    ).join('');
  }
}

// ===== 步骤1: 预处理 =====

function initStep1() {
  document.querySelectorAll('input[name="step1InputType"]').forEach(r => {
    r.addEventListener('change', (e) => {
      AppState.preprocess.inputType = e.target.value;
    });
  });

  document.getElementById('btnScanInputs').addEventListener('click', async () => {
    const inputPath = document.getElementById('step1InputPath').value;
    const inputType = AppState.preprocess.inputType;
    if (!inputPath) {
      showStatusBox('step1ScanStatus', 'error', 'js.noInputPath');
      return;
    }
    try {
      const result = await apiScanInputs(inputPath, inputType);
      AppState.preprocess.patients = result.patients || [];
      AppState.preprocess.inputPath = inputPath;

      renderPatientTable('step1PatientTable', AppState.preprocess.patients, true, [], AppState.preprocess.inputType);
      showStatusBox('step1ScanStatus', 'info', 'js.scanFoundDetail',
        {n: `<b>${result.total}</b>`, type: inputType === 'dicom' ? 'DICOM' : 'NIfTI'});
    } catch (e) {
      showStatusBox('step1ScanStatus', 'error', 'js.scanFailMsg', {msg: e.message});
    }
  });

  document.getElementById('step1GaussianEnable').addEventListener('change', (e) => {
    document.getElementById('step1GaussianSigma').disabled = !e.target.checked;
  });
  document.getElementById('step1GaussianSigma').disabled = !document.getElementById('step1GaussianEnable').checked;

  // 浏览图像（步骤1）
  document.getElementById('btnViewImage1').addEventListener('click', async () => {
    const ids = getSelectedPatientIds('step1PatientTable');
    if (ids.length !== 1) { alert(t('viewer.selectOne')); return; }
    const patient = AppState.preprocess.patients.find(p => (p.patient_id || p.id) === ids[0]);
    if (!patient) return;
    switchRightTab('viewer');
    try {
      if (AppState.preprocess.inputType === 'dicom') {
        await viewerLoadDicom(patient.input_path, ids[0]);
      } else {
        await viewerLoadNifti(patient.input_path, ids[0]);
      }
    } catch (e) {
      alert(t('js.viewerLoadFail', {msg: e.message}));
    }
  });

  document.getElementById('btnStartPreprocess').addEventListener('click', async () => {
    const inputPath = document.getElementById('step1InputPath').value;
    const outputPath = document.getElementById('step1WorkDir').value;
    const selectedIds = getSelectedPatientIds('step1PatientTable');

    if (!inputPath || !outputPath) {
      showStatusBox('step1ScanStatus', 'error', 'js.noInputOrWorkDir');
      return;
    }

    const sliceThickness = parseFloat(document.getElementById('step1SliceThickness').value) || 1.0;
    const interpolation = document.getElementById('step1Interpolation').value || 'sitkBSpline';
    const huMin = parseInt(document.getElementById('step1HuMin').value) || -3000;
    const huMax = parseInt(document.getElementById('step1HuMax').value) || 3000;
    const gaussianEnable = document.getElementById('step1GaussianEnable').checked;
    const gaussianSigma = gaussianEnable ? (parseFloat(document.getElementById('step1GaussianSigma').value) || 0.5) : 0.0;
    const outputNaming = document.querySelector('input[name="step1OutputNaming"]:checked')?.value || 'original';

    AppState.baseWorkingDir = outputPath;
    document.getElementById('baseWorkingDir').value = outputPath;
    syncWorkingDirs(outputPath);

    try {
      const result = await apiStartPreprocess(
        inputPath, AppState.preprocess.inputType,
        outputPath, selectedIds.length > 0 ? selectedIds : null,
        huMin, huMax, gaussianSigma, outputNaming,
        sliceThickness, interpolation,
      );
      AppState.preprocess.taskId = result.task_id;

      document.getElementById('btnStartPreprocess').disabled = true;
      document.getElementById('btnCancelStep1').style.display = 'inline-flex';
      switchRightTab('console');

      runTaskWithUI(result.task_id, 'step1Progress', 'step1Log',
        () => {
          document.getElementById('btnStartPreprocess').disabled = false;
          document.getElementById('btnCancelStep1').style.display = 'none';
          showStatusBox('step1ScanStatus', 'success', 'js.preprocessDone2');
        },
        (res) => {
          showStatusBox('step1ScanStatus', 'success', 'js.preprocessDone', {s: res.success_count || 0, f: res.fail_count || 0});
        },
        () => {
          document.getElementById('btnStartPreprocess').disabled = false;
          document.getElementById('btnCancelStep1').style.display = 'none';
        }
      );
    } catch (e) {
      showStatusBox('step1ScanStatus', 'error', 'js.startFailMsg', {msg: e.message});
    }
  });

  document.getElementById('btnCancelStep1').addEventListener('click', () => {
    if (AppState.preprocess.taskId) apiCancelTask(AppState.preprocess.taskId);
    document.getElementById('btnStartPreprocess').disabled = false;
    document.getElementById('btnCancelStep1').style.display = 'none';
  });
}

// ===== 步骤2: BOA分割 =====

async function refreshBOAPatients() {
  const basePath = document.getElementById('step2WorkDir').value || AppState.baseWorkingDir;
  try {
    const result = await apiGetBOAPatients(basePath);
    AppState.boa.patients = result.patients || [];
    renderPatientTable('step2PatientTable', AppState.boa.patients, true,
      AppState.boa.patients.filter(p => p.status === 'pending').map(p => p.patient_id),
      'nifti');
  } catch (e) {
    // 静默处理
  }
}

function initStep2() {
  document.getElementById('btnCheckEnv').addEventListener('click', async () => {
    try {
      const result = await apiCheckBOAEnv();
      AppState.boa.envChecked = true;
      AppState.boa.boaAvailable = result.boa_available;
      AppState.boa.gpuAvailable = result.gpu_available;

      const okTag = (ok) => ok ? `[OK] ${t('step2.envOk')}` : `[X] ${t('step2.envFail')}`;
      const condaVal = result.conda_env
        ? `${okTag(true)} (${result.conda_env})`
        : okTag(false);
      const boaVal = result.boa_available
        ? `${okTag(true)} (${result.boa_command})`
        : `${okTag(false)} (${result.message})`;
      const gpuFirst = String(result.gpu_info || '').split('\n')[0].trim();
      const gpuVal = result.gpu_available ? `${okTag(true)} (${gpuFirst})` : okTag(false);

      const html = `<div class="env-rows">
        <div class="env-row"><span class="env-key">${t('step2.envConda')}</span><span class="env-val">${condaVal}</span></div>
        <div class="env-row"><span class="env-key">${t('step2.envBoa')}</span><span class="env-val">${boaVal}</span></div>
        <div class="env-row"><span class="env-key">${t('step2.envGpu')}</span><span class="env-val">${gpuVal}</span></div>
      </div>`;
      showStatusBox('step2EnvStatus', result.boa_available ? 'success' : 'error', html);
    } catch (e) {
      showStatusBox('step2EnvStatus', 'error', 'js.scanFailMsg', {msg: e.message});
    }
  });

  // 扫描NIfTI文件（步骤2）
  document.getElementById('btnScanStep2').addEventListener('click', async () => {
    await refreshBOAPatients();
    const n = (AppState.boa.patients || []).length;
    showStatusBox('step2EnvStatus', n > 0 ? 'info' : 'error',
      n > 0 ? 'js.scanFoundSeries' : 'js.scanNoData',
      {n: n});
  });

  // 浏览图像（步骤2）
  document.getElementById('btnViewImage2').addEventListener('click', async () => {
    const ids = getSelectedPatientIds('step2PatientTable');
    if (ids.length !== 1) { alert(t('viewer.selectOne')); return; }
    const basePath = document.getElementById('step2WorkDir').value || AppState.baseWorkingDir;
    switchRightTab('viewer');
    try {
      await viewerLoadNifti(`${basePath}/ct_image/${ids[0]}.nii.gz`, ids[0], basePath);
    } catch (e) {
      alert(t('js.viewerLoadFail', {msg: e.message}));
    }
  });

  document.getElementById('btnStartBOA').addEventListener('click', async () => {
    const basePath = document.getElementById('step2WorkDir').value;
    const selectedIds = getSelectedPatientIds('step2PatientTable');
    const checkedModels = [];
    document.querySelectorAll('#md_total, #md_bca').forEach(cb => {
      if (cb.checked) checkedModels.push(cb.value);
    });
    const models = checkedModels.length > 0 ? checkedModels.join('+') : 'total+bca';

    if (!basePath || selectedIds.length === 0) {
      showStatusBox('step2EnvStatus', 'error', 'js.selectSeries');
      return;
    }

    AppState.baseWorkingDir = basePath;
    document.getElementById('baseWorkingDir').value = basePath;
    syncWorkingDirs(basePath);

    try {
      const result = await apiStartBOA(basePath, selectedIds, models);
      AppState.boa.taskId = result.task_id;
      document.getElementById('btnStartBOA').disabled = true;
      document.getElementById('btnCancelStep2').style.display = 'inline-flex';
      switchRightTab('console');

      showStatusBox('step2EnvStatus', 'info', result.message);

      runTaskWithUI(result.task_id, 'step2Progress', 'step2Log',
        () => {
          document.getElementById('btnStartBOA').disabled = false;
          document.getElementById('btnCancelStep2').style.display = 'none';
          showStatusBox('step2EnvStatus', 'success', 'js.allDone');
          refreshBOAPatients();
        },
        (res) => {
          showStatusBox('step2EnvStatus', 'success', 'js.segDone', {s: res.success_count || 0, f: res.fail_count || 0});
        },
        () => {
          document.getElementById('btnStartBOA').disabled = false;
          document.getElementById('btnCancelStep2').style.display = 'none';
        }
      );
    } catch (e) {
      showStatusBox('step2EnvStatus', 'error', 'js.startFailMsg', {msg: e.message});
    }
  });

  document.getElementById('btnCancelStep2').addEventListener('click', () => {
    if (AppState.boa.taskId) apiCancelTask(AppState.boa.taskId);
    document.getElementById('btnStartBOA').disabled = false;
    document.getElementById('btnCancelStep2').style.display = 'none';
    // 停止后刷新序列列表（最后一个不完整结果已被后端删除）
    setTimeout(refreshBOAPatients, 2000);
  });
}

// ===== 步骤3: 统计分析 =====

/** 由ct_image目录推导工作根目录（用于兼容默认目录结构） */
function _baseFromCtDir(ctDir) {
  const norm = (ctDir || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (/\/ct_image$/i.test(norm)) return norm.slice(0, -'/ct_image'.length);
  return '';
}

async function refreshStep3Patients(ctDir, labelDir) {
  if (!ctDir && !labelDir) {
    const workDir = AppState.baseWorkingDir;
    if (!workDir) return;
    ctDir = workDir + '/ct_image';
    labelDir = workDir + '/boa_label';
  }
  try {
    const result = await apiGetBOAPatients('', ctDir, labelDir);
    AppState.analysis.patients = result.patients || [];
    renderPatientTable('step3PatientTable', AppState.analysis.patients, true, [], null);
    // 绑定选择变化以刷新标签下拉
    const table = document.getElementById('step3PatientTable');
    table.querySelectorAll('.patient-cb').forEach(cb => {
      cb.addEventListener('change', onStep3SelectionChange);
    });
  } catch (e) {
    // 静默处理
  }
}

async function onStep3SelectionChange() {
  updateViewButtons();
  const ids = getSelectedPatientIds('step3PatientTable');
  const select = document.getElementById('step3LabelSelect');
  const btnShow = document.getElementById('btnShowLabel');
  const btnHide = document.getElementById('btnHideLabel');
  if (ids.length !== 1) {
    select.innerHTML = `<option value="">${t('viewer.noLabel')}</option>`;
    select.disabled = true;
    btnShow.disabled = true;
    btnHide.disabled = true;
    return;
  }
  try {
    const labelDir = document.getElementById('step3LabelDir').value.trim();
    const resp = await apiGet('/api/viewer/labels', {
      base_path: AppState.baseWorkingDir, series_id: ids[0], label_dir: labelDir,
    });
    const labels = resp.labels || [];
    if (labels.length === 0) {
      select.innerHTML = `<option value="">${t('viewer.noLabel')}</option>`;
      select.disabled = true;
      btnShow.disabled = true;
      btnHide.disabled = true;
    } else {
      select.innerHTML = labels.map(l => `<option value="${l}">${l}</option>`).join('');
      if (labels.includes('tissues.nii.gz')) select.value = 'tissues.nii.gz';
      select.disabled = false;
      btnShow.disabled = false;
      btnHide.disabled = false;
    }
  } catch (e) {
    select.innerHTML = `<option value="">${t('viewer.noLabel')}</option>`;
    select.disabled = true;
    btnShow.disabled = true;
    btnHide.disabled = true;
  }
}

function initStep3() {
  AppState.analysis.mode = 'B';

  const thresholdInputs = ['step3FatMin', 'step3FatMax', 'step3MuscleMin', 'step3MuscleMax'];
  document.getElementById('step3ThresholdEnable').addEventListener('change', function() {
    thresholdInputs.forEach(id => {
      document.getElementById(id).disabled = !this.checked;
    });
  });
  thresholdInputs.forEach(id => {
    document.getElementById(id).disabled = !document.getElementById('step3ThresholdEnable').checked;
  });

  initVertRangeUI();

  document.getElementById('btnScanDirs').addEventListener('click', async () => {
    let ctDir = document.getElementById('step3CtDir').value.trim();
    let labelDir = document.getElementById('step3LabelDir').value.trim();
    const workDir = AppState.baseWorkingDir;
    if (!ctDir) ctDir = workDir ? workDir + '/ct_image' : '';
    if (!labelDir) labelDir = workDir ? workDir + '/boa_label' : '';
    if (!ctDir || !labelDir) {
      showStatusBox('step3ScanStatus', 'error', 'js.noWorkingDirStep3');
      return;
    }
    document.getElementById('step3CtDir').value = ctDir;
    document.getElementById('step3LabelDir').value = labelDir;

    try {
      const result = await apiScanAnalysisDirs(workDir || ctDir, ctDir, labelDir);
      if (result.ct_count === 0 && result.label_count === 0) {
        showStatusBox('step3ScanStatus', 'error', 'js.scanNoData');
      } else {
        showStatusBox('step3ScanStatus', 'info', 'js.scanResult',
          {ct: `<b>${result.ct_count}</b>`, lb: `<b>${result.label_count}</b>`});
      }
      await refreshStep3Patients(ctDir, labelDir);
    } catch (e) {
      showStatusBox('step3ScanStatus', 'error', 'js.scanFailMsg', {msg: e.message});
    }
  });

  // 浏览图像（步骤3）
  document.getElementById('btnViewImage3').addEventListener('click', async () => {
    const ids = getSelectedPatientIds('step3PatientTable');
    if (ids.length !== 1) { alert(t('viewer.selectOne')); return; }
    const ctDir = document.getElementById('step3CtDir').value.trim();
    const labelDir = document.getElementById('step3LabelDir').value.trim();
    switchRightTab('viewer');
    try {
      await viewerLoadNifti(`${ctDir}/${ids[0]}.nii.gz`, ids[0], _baseFromCtDir(ctDir), labelDir);
      await onStep3SelectionChange();
    } catch (e) {
      alert(t('js.viewerLoadFail', {msg: e.message}));
    }
  });

  // 显示标签
  document.getElementById('btnShowLabel').addEventListener('click', async () => {
    const ids = getSelectedPatientIds('step3PatientTable');
    const labelName = document.getElementById('step3LabelSelect').value;
    if (ids.length !== 1 || !labelName) { alert(t('viewer.selectOneAndLabel')); return; }
    const ctDir = document.getElementById('step3CtDir').value.trim();
    const labelDir = document.getElementById('step3LabelDir').value.trim();
    switchRightTab('viewer');
    try {
      await viewerShowLabel(AppState.baseWorkingDir, ids[0], labelName, { ctDir, labelDir });
    } catch (e) {
      alert(t('js.viewerLoadFail', {msg: e.message}));
    }
  });

  // 隐藏标签
  document.getElementById('btnHideLabel').addEventListener('click', () => {
    viewerHideLabel();
  });

  // 标签透明度滑块
  document.getElementById('labelOpacitySlider').addEventListener('input', (e) => {
    viewerSetLabelOpacity(e.target.value);
  });

  document.getElementById('btnStartModeB').addEventListener('click', async () => {
    const basePath = AppState.baseWorkingDir;
    const workers = parseInt(document.getElementById('step3Workers').value) || 4;
    const includeAll = document.getElementById('step3IncludeAll').checked;
    const vertebrae = getCheckedValues('step3VertGrid');
    const ranges = getCheckedValues('step3RangeGrid').map(Number);

    const customEnable = document.getElementById('rg_custom_enable');
    if (customEnable && customEnable.checked) {
      const customVal = parseInt(document.getElementById('rg_custom_slider').value);
      if (!ranges.includes(customVal)) ranges.push(customVal);
    }

    const thresholdEnabled = document.getElementById('step3ThresholdEnable').checked;
    const fatMin = parseInt(document.getElementById('step3FatMin').value) || -190;
    const fatMax = parseInt(document.getElementById('step3FatMax').value) || -30;
    const muscleMin = parseInt(document.getElementById('step3MuscleMin').value) || -29;
    const muscleMax = parseInt(document.getElementById('step3MuscleMax').value) || 150;

    const vertebraRanges = collectVertRangePairs();
    if (vertebraRanges === null) return;

    try {
      const result = await apiStartModeB(basePath, workers, vertebrae, ranges, includeAll,
        thresholdEnabled, fatMin, fatMax, muscleMin, muscleMax, vertebraRanges);
      AppState.analysis.taskId = result.task_id;
      document.getElementById('btnStartModeB').disabled = true;
      document.getElementById('btnCancelStep3').style.display = 'inline-flex';
      switchRightTab('console');

      runTaskWithUI(result.task_id, 'step3Progress', 'step3Log',
        () => {
          document.getElementById('btnStartModeB').disabled = false;
          document.getElementById('btnCancelStep3').style.display = 'none';
          showStatusBox('step3Status', 'success', 'js.statsDone');
        },
        (res) => {
          showStatusBox('step3Status', 'success', 'js.analysisDone',
            {n: res.total_patients, s: res.success_tasks});
        },
        () => {
          document.getElementById('btnStartModeB').disabled = false;
          document.getElementById('btnCancelStep3').style.display = 'none';
        }
      );
    } catch (e) {
      showStatusBox('step3Status', 'error', 'js.startFailMsg', {msg: e.message});
    }
  });

  document.getElementById('btnCancelStep3').addEventListener('click', () => {
    if (AppState.analysis.taskId) apiCancelTask(AppState.analysis.taskId);
    document.getElementById('btnStartModeB').disabled = false;
    document.getElementById('btnCancelStep3').style.display = 'none';
  });
}

// ===== 步骤4: 数据导出 =====

async function refreshExportData() {
  const basePath = document.getElementById('step4BasePath').value || AppState.baseWorkingDir;
  if (!basePath) {
    showStatusBox('step4Status', 'error', 'js.noWorkingDir');
    return;
  }
  try {
    const result = await apiScanCSVs(basePath);
    AppState.export.patients = result.patients || [];
    AppState.export.scanResult = result;

    if (result.total > 0) {
      showStatusBox('step4Status', 'info', 'js.scanCSVFound',
        {n: `<b>${result.total}</b>`, c: `<b>${result.total}</b>`});
    } else {
      showStatusBox('step4Status', 'error', 'js.scanCSVEmpty');
    }

    renderExportScanOptions(result);
  } catch (e) {
    showStatusBox('step4Status', 'error', 'js.scanFailMsg', {msg: e.message});
  }
}

function renderExportScanOptions(result) {
  const optionsCard = document.getElementById('step4ScanOptions');
  if (!result || result.total === 0) {
    if (optionsCard) optionsCard.style.display = 'none';
    return;
  }
  if (optionsCard) optionsCard.style.display = '';

  const hasAll = result.has_all;
  const vertebrae = result.available_vertebrae || [];
  const ranges = result.available_ranges || [];

  const allCheckbox = document.getElementById('exportALL');
  const allHint = document.getElementById('exportALLHint');
  if (allCheckbox) {
    allCheckbox.checked = hasAll;
    allCheckbox.disabled = !hasAll;
  }
  if (allHint) {
    allHint.textContent = hasAll ? t('js.allDataFound') : t('js.allDataMissing');
  }

  const vertGrid = document.getElementById('exportVertGrid');
  if (vertGrid && vertebrae.length > 0) {
    const numSort = (a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1));
    const cervical = vertebrae.filter(v => v.startsWith('C')).sort(numSort);
    const thoracic = vertebrae.filter(v => v.startsWith('T')).sort(numSort);
    const lumbar   = vertebrae.filter(v => v.startsWith('L')).sort(numSort);

    vertGrid.innerHTML = '';
    const renderGroup = (key, verts) => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'vertebra-group';
      groupDiv.innerHTML = `<span class="vertebra-group-label" data-i18n="${key}">${t(key)}</span>`;
      verts.forEach(v => {
        const item = document.createElement('div');
        item.className = 'tag-item';
        item.innerHTML = `
          <input type="checkbox" id="ex_sv_${v}" value="${v}">
          <label for="ex_sv_${v}">${v}</label>`;
        groupDiv.appendChild(item);
      });
      vertGrid.appendChild(groupDiv);
    };
    if (cervical.length) renderGroup('step4.cervical', cervical);
    if (thoracic.length) renderGroup('step4.thoracic', thoracic);
    if (lumbar.length)   renderGroup('step4.lumbar', lumbar);
  } else if (vertGrid) {
    vertGrid.innerHTML = `<span style="font-size:12px;color:#999;">${t('js.noVertData')}</span>`;
  }

  const rangeGrid = document.getElementById('exportRangeGrid');
  if (rangeGrid && ranges.length > 0) {
    rangeGrid.innerHTML = ranges.map(r =>
      `<div class="tag-item">
        <input type="checkbox" id="ex_rg_${r}" value="${r}">
        <label for="ex_rg_${r}">${r}mm</label>
      </div>`
    ).join('');
  } else if (rangeGrid) {
    rangeGrid.innerHTML = `<span style="font-size:12px;color:#999;">${t('js.noRangeData')}</span>`;
  }

  const pairGroup = document.getElementById('exportVertPairGroup');
  const pairGrid = document.getElementById('exportVertPairGrid');
  const pairs = result.available_pairs || [];
  if (pairGrid) {
    if (pairGroup) pairGroup.style.display = pairs.length > 0 ? '' : 'none';
    pairGrid.innerHTML = pairs.map(p =>
      `<div class="tag-item">
        <input type="checkbox" id="ex_pair_${p}" value="${p}">
        <label for="ex_pair_${p}">${p}</label>
      </div>`).join('');
  }
}

function initStep4() {
  document.getElementById('btnScanCSVs').addEventListener('click', refreshExportData);

  document.getElementById('btnStep4Generate').addEventListener('click', async () => {
    const basePath = document.getElementById('step4BasePath').value;
    const includeAll = document.getElementById('exportALL').checked;
    const singleVert = getCheckedValues('exportVertGrid');
    const vertPairs = getCheckedValues('exportVertPairGrid');
    const ranges = getCheckedValues('exportRangeGrid').map(Number);
    const tissues = getCheckedValues('exportTissueGrid');
    const metrics = getCheckedValues('exportMetricGrid');

    if (!includeAll && singleVert.length === 0 && vertPairs.length === 0) { alert(t('js.selectScanType')); return; }
    if (tissues.length === 0) { alert(t('js.selectTissue')); return; }
    if (metrics.length === 0) { alert(t('js.selectMetric')); return; }
    if (singleVert.length > 0 && ranges.length === 0) { alert(t('js.selectVertRange')); return; }

    try {
      const result = await apiGenerateMerge(basePath, includeAll, singleVert, ranges, vertPairs, tissues, metrics, null);
      AppState.export.taskId = result.task_id;
      document.getElementById('btnStep4Generate').disabled = true;
      switchRightTab('console');

      runTaskWithUI(result.task_id, 'step4Progress', 'step4Log',
        async () => {
          document.getElementById('btnStep4Generate').disabled = false;
          document.getElementById('btnStep4Download').style.display = 'inline-flex';
          showStatusBox('step4Status', 'success', 'js.tableGenerated');
          try {
            const preview = await apiPreviewMerge(result.task_id);
            renderPreviewTable(preview);
            switchRightTab('table');
          } catch (e) { /* ignore */ }
        },
        null,
        () => { document.getElementById('btnStep4Generate').disabled = false; }
      );
    } catch (e) {
      alert(t('js.generateFail', {msg: e.message}));
    }
  });

  document.getElementById('btnStep4Download').addEventListener('click', () => {
    if (AppState.export.taskId) {
      window.open(apiDownloadMerge(AppState.export.taskId), '_blank');
    }
  });
}

/** 在右侧"数据表格"窗口中渲染CSV预览 */
function renderPreviewTable(preview) {
  const container = document.getElementById('tablePreviewWrap');
  if (!container || !preview.headers || preview.headers.length === 0) return;

  let html = '<table><thead><tr>';
  preview.headers.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';

  (preview.rows || []).forEach(row => {
    html += '<tr>';
    row.forEach((cell) => {
      const val = cell !== undefined && cell !== null && cell !== '' ? String(cell) : '-';
      const css = val === '-' ? ' class="empty"' : '';
      html += `<td${css}>${val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  container.innerHTML = html;
  document.getElementById('tablePreviewStats').textContent =
    t('js.tableStats', {r: preview.total_rows || 0, c: preview.total_columns || preview.headers.length});
}
