/**
 * 国际化 (i18n) 模块
 * 支持中文(zh)和英文(en)，默认英文。
 * 控制台输出始终使用英文。
 */

let currentLang = localStorage.getItem('bc_lang') || 'en';

const I18N = {
  // ===== 页面标题和头部 =====
  'app.title':         { zh: 'CT 组织成分统计分析平台', en: 'CT Tissue Composition Analysis Platform' },
  'app.title.alt':     { zh: 'BodyCompass - CT组织成分统计分析平台', en: 'BodyCompass - CT Tissue Composition Analysis Platform' },
  'app.subtitle':      { zh: 'BodyCompass — 从CT图像到统计结果的一站式分析工具', en: 'BodyCompass — One-stop analysis from CT images to statistical results' },
  'header.workingDir': { zh: '当前工作目录：', en: 'Working Directory:' },
  'header.openExplorer': { zh: '在文件管理器中打开', en: 'Open in File Explorer' },

  // ===== 步骤条 =====
  'step1.name': { zh: '数据预处理', en: 'Preprocessing' },
  'step1.desc': { zh: 'DICOM/NIfTI标准化', en: 'DICOM/NIfTI Standardization' },
  'step2.name': { zh: 'BOA 分割', en: 'BOA Segmentation' },
  'step2.desc': { zh: 'CT图像组织分割', en: 'CT Tissue Segmentation' },
  'step3.name': { zh: '统计分析', en: 'Statistical Analysis' },
  'step3.desc': { zh: '组织成分计算', en: 'Tissue Composition' },
  'step4.name': { zh: '数据导出', en: 'Data Export' },
  'step4.desc': { zh: 'CSV表格合并与下载', en: 'CSV Merge & Download' },

  // ===== 步骤1 =====
  'step1.card1.title':     { zh: '文件路径配置', en: 'File Path Configuration' },
  'step1.card2.title':     { zh: '图像预处理', en: 'Image Preprocessing' },
  'step1.card2.subtitle':  { zh: '配置CT图像的标准化处理参数', en: 'Configure CT image normalization parameters' },
  'step1.inputType':       { zh: '输入类型', en: 'Input Type' },
  'step1.dicomDir':        { zh: 'DICOM目录', en: 'DICOM Directory' },
  'step1.niftiFile':       { zh: 'NIfTI文件', en: 'NIfTI File' },
  'step1.inputPath':       { zh: '输入目录路径', en: 'Input Directory Path' },
  'step1.inputPathPH':     { zh: '包含DICOM序列或NIfTI文件的目录', en: 'Directory with DICOM series or NIfTI files' },
  'step1.workDir':         { zh: '工作根目录', en: 'Working Root Directory' },
  'step1.workDirPH':       { zh: '将在此目录下创建ct_image/等子目录', en: 'Subdirs ct_image/ etc. created here' },
  'step1.workDirExtra':    { zh: '这是项目根目录，ct_image/、boa_label/等将创建在此目录下', en: 'Root directory; ct_image/, boa_label/ etc. created under it' },
  'step1.browseHint':      { zh: '点击"浏览"选择文件夹，路径将自动填入', en: 'Click Browse to select a folder; the path fills in automatically' },
  'step1.scan':            { zh: '扫描输入数据', en: 'Scan Input Data' },
  'step1.patientList':     { zh: '检测到的序列列表：', en: 'Detected Series:' },
  'step1.emptyScan':       { zh: '请先输入目录路径并点击"扫描输入数据"', en: 'Enter a directory path and click Scan Input Data' },
  'step1.start':           { zh: '开始预处理', en: 'Start Preprocessing' },
  'step1.resampleConfig':  { zh: '重采样参数配置', en: 'Resampling Configuration' },
  'step1.sliceThickness':  { zh: '层厚设置', en: 'Slice Thickness' },
  'step1.sliceHint':       { zh: '（范围 0.5 ~ 2.5，默认 1.0）', en: '(range 0.5 ~ 2.5, default 1.0)' },
  'step1.sliceWarning':    { zh: '※ 如需进行组织成分分析，图像层厚需要设置为1mm', en: '* Slice thickness must be 1 mm for tissue composition analysis' },
  'step1.interpolation':   { zh: '图像插值方法', en: 'Interpolation Method' },
  'step1.interpHint':      { zh: '重采样时使用的插值算法，默认 B 样条插值效果最好', en: 'Interpolation algorithm for resampling; B-spline gives the best results' },
  'step1.huRange':         { zh: 'HU值范围', en: 'HU Value Range' },
  'step1.huMin':           { zh: '最小值', en: 'Min' },
  'step1.huMax':           { zh: '最大值', en: 'Max' },
  'step1.huHint':          { zh: 'CT值超出此范围的体素将被裁剪，默认范围 [-1000, 1000] HU', en: 'Voxels outside this range are clipped; default [-1000, 1000] HU' },
  'step1.gaussianEnable':  { zh: '启用高斯模糊', en: 'Enable Gaussian Blur' },
  'step1.sigmaParam':      { zh: 'Sigma 参数', en: 'Sigma Parameter' },
  'step1.sigmaHint':       { zh: '（范围 0.5 ~ 2.0，默认 0.5）', en: '(range 0.5 ~ 2.0, default 0.5)' },
  'step1.gaussianHint':    { zh: '对重采样后的图像进行三维高斯平滑（sitk.DiscreteGaussian）', en: '3D Gaussian smoothing on the resampled image (sitk.DiscreteGaussian)' },
  'step1.outputNaming':    { zh: '输出文件命名方式', en: 'Output File Naming' },
  'step1.naming.original': { zh: '原始文件/文件夹名称', en: 'Original File/Folder Name' },
  'step1.naming.seriesId': { zh: '序列ID', en: 'Series ID' },
  'step1.namingHint':      { zh: '"原始名称"使用DICOM文件夹名或NIfTI文件名；"序列ID"使用DICOM元数据中的PatientID或扫描生成的唯一标识', en: '"Original" uses the DICOM folder or NIfTI file name; "Series ID" uses PatientID from DICOM metadata or a generated unique ID' },

  // ===== 步骤2 =====
  'step2.card1.title':     { zh: 'BOA 环境检测', en: 'BOA Environment Check' },
  'step2.card1.subtitle':  { zh: '检测 conda 环境和 BOA 命令行工具是否就绪', en: 'Check the conda environment and BOA CLI readiness' },
  'step2.workDir':         { zh: '工作根目录', en: 'Working Root Directory' },
  'step2.workDirPH':       { zh: '包含ct_image/的根目录', en: 'Root dir containing ct_image/' },
  'step2.checkEnv':        { zh: '检测运行环境', en: 'Check Environment' },
  'step2.card2.title':     { zh: 'BOA 分割配置', en: 'BOA Segmentation Configuration' },
  'step2.card2.subtitle':  { zh: '在 conda 环境中运行 BOA 命令行工具进行CT图像组织分割', en: 'Run the BOA CLI in the conda environment for CT tissue segmentation' },
  'step2.models':          { zh: '分割模型', en: 'Segmentation Models' },
  'step2.selectPatient':   { zh: '选择要分割的序列：', en: 'Select series to segment:' },
  'step2.empty':           { zh: '请确认 ct_image/ 目录中有预处理完成的图像，然后点击"扫描NIfTI文件"', en: 'Ensure preprocessed images exist in ct_image/, then click Scan NIfTI Files' },
  'step2.scanNifti':       { zh: '扫描NIfTI文件', en: 'Scan NIfTI Files' },
  'step2.start':           { zh: '启动分割', en: 'Start Segmentation' },
  'step2.stop':            { zh: '停止分割', en: 'Stop Segmentation' },
  'step2.timeNote':        { zh: '单个图像序列处理时间约数分钟至数十分钟，取决于图像层数和GPU', en: 'Each series takes minutes to tens of minutes depending on slice count and GPU' },
  'step2.envConda':        { zh: 'Conda 环境', en: 'Conda Env' },
  'step2.envBoa':          { zh: 'BOA 文件夹', en: 'BOA Folder' },
  'step2.envGpu':          { zh: 'GPU', en: 'GPU' },
  'step2.envOk':           { zh: '正常', en: 'OK' },
  'step2.envFail':         { zh: '异常', en: 'Not Ready' },

  // ===== 步骤3 =====
  'step3.card1.title':     { zh: '文件路径配置', en: 'File Path Configuration' },
  'step3.card2.title':     { zh: '统计分析配置', en: 'Analysis Configuration' },
  'step3.card3.title':     { zh: '组织阈值设定', en: 'Tissue Threshold Configuration' },
  'step3.card3.subtitle':  { zh: '自定义脂肪和肌肉的CT值范围，重新生成组织标签（tissues.nii.gz）', en: 'Customize fat/muscle HU ranges to regenerate tissue labels (tissues.nii.gz)' },
  'step3.card3.defaults':  { zh: '默认阈值：脂肪 -190 ~ -30 HU，肌肉 -29 ~ 150 HU', en: 'Defaults: fat -190 ~ -30 HU, muscle -29 ~ 150 HU' },
  'step3.thresholdEnable': { zh: '更改组织阈值设定', en: 'Modify tissue thresholds' },
  'step3.fatRange':        { zh: '脂肪 CT 值范围 (HU)', en: 'Fat HU Range' },
  'step3.muscleRange':     { zh: '肌肉 CT 值范围 (HU)', en: 'Muscle HU Range' },
  'step3.thresholdHint':   { zh: '勾选后，系统将先使用自定义阈值重新生成组织标签，再执行统计分析', en: 'When checked, tissue labels are regenerated with custom thresholds before analysis' },
  'step3.workers':         { zh: '并行处理的序列数', en: 'Parallel Workers' },
  'step3.includeAll':      { zh: '全层面分析', en: 'Whole-volume Analysis' },
  'step3.includeAllHint':  { zh: '分析扫描序列的所有层面', en: 'Analyze all slices of the scan' },
  'step3.singleVert':      { zh: '单个锥体分析', en: 'Single-vertebra Analysis' },
  'step3.singleVertHint':  { zh: '分析以单个锥体为中心的指定范围', en: 'Analyze a specified range centered on a single vertebra' },
  'step3.range':           { zh: '分析范围（mm）', en: 'Analysis Range (mm)' },
  'step3.cervical':        { zh: '颈椎 C', en: 'Cervical' },
  'step3.thoracic':        { zh: '胸椎 T', en: 'Thoracic' },
  'step3.lumbar':          { zh: '腰椎 L', en: 'Lumbar' },
  'step3.customRange':     { zh: '自定义范围：', en: 'Custom range:' },
  'step3.startB':          { zh: '启动并行分析', en: 'Start Parallel Analysis' },
  'step3.imageDir':        { zh: '图像目录', en: 'Image Directory' },
  'step3.labelDir':        { zh: '标签目录', en: 'Label Directory' },
  'step3.scanNifti':       { zh: '扫描NIFTI文件', en: 'Scan NIfTI Files' },
  'step3.seriesList':      { zh: '序列列表：', en: 'Series List:' },
  'step3.emptySeries':     { zh: '请点击"扫描NIFTI文件"加载序列列表', en: 'Click Scan NIfTI Files to load the series list' },
  'step3.vertRange':       { zh: '两个锥体间范围分析', en: 'Two-vertebra Range Analysis' },
  'step3.vertRangeAdd':    { zh: '+ 添加范围', en: '+ Add Range' },
  'step3.vertRangeRemove': { zh: '删除该范围', en: 'Remove this range' },
  'step3.vertRangeStart':  { zh: '起始锥体', en: 'Start Vertebra' },
  'step3.vertRangeEnd':    { zh: '结束锥体', en: 'End Vertebra' },
  'step3.vertRangeHint':   { zh: '分析起始与结束椎体中心之间的所有层面（如 T1-T12），可添加多组范围', en: 'Analyze all slices between two vertebra centers (e.g. T1-T12); multiple ranges can be added' },

  // ===== 步骤4 =====
  'step4.card1.title':     { zh: 'CSV数据合并导出', en: 'CSV Merge & Export' },
  'step4.card1.subtitle':  { zh: '选择需要合并的分析结果类型、组织成分和统计指标，生成综合数据表', en: 'Select analysis types, tissues and metrics to generate a combined table' },
  'step4.basePath':        { zh: '数据根目录', en: 'Data Root Directory' },
  'step4.basePathPH':      { zh: '包含statistic/的根目录', en: 'Root containing statistic/' },
  'step4.scan':            { zh: '扫描CSV数据', en: 'Scan CSV Data' },
  'step4.card2.title':     { zh: '扫描范围选择', en: 'Scan Range Selection' },
  'step4.card3.title':     { zh: '组织成分选择', en: 'Tissue Selection' },
  'step4.card4.title':     { zh: '统计学指标选择', en: 'Metric Selection' },
  'step4.required':        { zh: '（至少选一项）', en: '(select at least one)' },
  'step4.generate':        { zh: '生成合并表格', en: 'Generate Table' },
  'step4.download':        { zh: '下载 CSV文件', en: 'Download CSV' },
  'step4.preview':         { zh: '数据预览', en: 'Data Preview' },
  'step4.cervical':        { zh: '颈椎 C', en: 'Cervical' },
  'step4.thoracic':        { zh: '胸椎 T', en: 'Thoracic' },
  'step4.lumbar':          { zh: '腰椎 L', en: 'Lumbar' },
  'step4.vertRange':       { zh: '椎体范围', en: 'Vertebra Range' },

  // ===== 导航 =====
  'nav.prev':    { zh: '上一步', en: 'Previous' },
  'nav.next':    { zh: '下一步', en: 'Next' },
  'nav.step':    { zh: '步骤', en: 'Step' },

  // ===== 右侧面板/控制台 =====
  'console.title':   { zh: '控制台', en: 'Console' },
  'console.clear':   { zh: '清空', en: 'Clear' },
  'console.ready':   { zh: '等待任务开始...', en: 'Waiting for tasks...' },
  'console.status':  { zh: '就绪', en: 'Ready' },
  'console.progress':{ zh: '准备就绪', en: 'Ready' },
  'console.progressTitle': { zh: '任务进度', en: 'Task Progress' },
  'console.cleared': { zh: '已清空', en: 'Cleared' },

  // ===== 图像浏览器 =====
  'viewer.title':      { zh: '图像浏览', en: 'Image Viewer' },
  'viewer.browse':     { zh: '浏览图像', en: 'View Image' },
  'viewer.browseHint': { zh: '在右侧窗口中浏览所选序列的图像（需恰好选择一个序列）', en: 'Browse the selected series in the right panel (exactly one series must be selected)' },
  'viewer.showLabel':  { zh: '显示标签', en: 'Show Label' },
  'viewer.hideLabel':  { zh: '隐藏标签', en: 'Hide Label' },
  'viewer.opacity':    { zh: '标签透明度', en: 'Label Opacity' },
  'viewer.noLabel':    { zh: '（无可用标签）', en: '(no labels available)' },
  'viewer.noSeries':   { zh: '未加载序列', en: 'No series loaded' },
  'viewer.selectOne':  { zh: '请恰好选择一个序列', en: 'Please select exactly one series' },
  'viewer.selectOneAndLabel': { zh: '请选择一个序列和一个标签', en: 'Please select one series and one label' },
  'viewer.window':     { zh: '窗宽窗位:', en: 'Window:' },
  'viewer.wlSoft':     { zh: '软组织窗', en: 'Soft Tissue' },
  'viewer.wlLung':     { zh: '肺窗', en: 'Lung' },
  'viewer.wlBone':     { zh: '骨窗', en: 'Bone' },
  'viewer.axial':      { zh: '轴位 Axial', en: 'Axial' },
  'viewer.sagittal':   { zh: '矢状位 Sagittal', en: 'Sagittal' },
  'viewer.sagittal2':  { zh: '矢状位（椎体定位）', en: 'Sagittal (Vertebrae)' },
  'viewer.info':       { zh: '图像信息', en: 'Image Info' },
  'viewer.coronal':    { zh: '冠状位 Coronal', en: 'Coronal' },
  'viewer.hint':       { zh: '滚轮/滑块：浏览层面 · 左键点击：MPR定位', en: 'Wheel/slider: browse slices · Left click: MPR positioning' },

  // ===== 数据表格 =====
  'table.title':    { zh: '数据表格', en: 'Data Table' },
  'table.empty':    { zh: '生成合并表格后在此显示数据预览', en: 'The merged table preview appears here after generation' },
  'table.seriesId': { zh: '序列ID', en: 'Series ID' },
  'table.scanDate': { zh: '扫描时间', en: 'Scan Date' },
  'table.imageSize':{ zh: '图像尺寸', en: 'Image Size' },
  'table.spacing':  { zh: '体素间距', en: 'Spacing' },
  'table.status':   { zh: '状态', en: 'Status' },
  'table.detail':   { zh: '详情', en: 'Detail' },
  'table.files':    { zh: '个文件', en: 'files' },
  'table.noLabelFolder': { zh: '无可用标签', en: 'no available label' },
  'table.csvFiles': { zh: '个CSV', en: 'CSVs' },

  // ===== 通用按钮/标签 =====
  'btn.cancel':   { zh: '取消', en: 'Cancel' },
  'btn.browse':   { zh: '浏览...', en: 'Browse...' },
  'btn.selectAll':{ zh: '全选', en: 'Select All' },
  'btn.deselect': { zh: '取消选择', en: 'Deselect' },

  // ===== 页脚 =====
  'footer': { zh: 'BodyCompass — CT组织成分统计分析平台 v1.2  |  基于 BOA (Body and Organ Analysis) + TotalSegmentator  |  用于医学研究目的',
              en: 'BodyCompass — CT Tissue Analysis Platform v1.2  |  Based on BOA + TotalSegmentator  |  For medical research' },

  // ===== JS动态文本 =====
  'js.scanFoundDetail': { zh: '检测到 {n} 个序列（{type}）', en: 'Detected {n} series ({type})' },
  'js.dicomSeries':     { zh: 'DICOM序列', en: 'DICOM series' },
  'js.niftiFiles':      { zh: 'NIfTI文件', en: 'NIfTI files' },
  'js.scanFailMsg':     { zh: '扫描失败: {msg}', en: 'Scan failed: {msg}' },
  'js.selectSeries':    { zh: '请至少选择一个序列', en: 'Please select at least one series' },
  'js.startFailMsg':    { zh: '启动失败: {msg}', en: 'Start failed: {msg}' },
  'js.preprocessDone':  { zh: '预处理完成：成功 {s}，失败 {f}', en: 'Preprocessing done: {s} OK, {f} failed' },
  'js.segDone':         { zh: '分割完成：成功 {s}，失败 {f}', en: 'Segmentation done: {s} OK, {f} failed' },
  'js.analysisDone':    { zh: '分析完成：{n}个序列，成功{s}项', en: 'Analysis done: {n} series, {s} tasks OK' },
  'js.preprocessDone2': { zh: '预处理完成！可手动进入下一步', en: 'Preprocessing done! Proceed to the next step.' },
  'js.allDone':         { zh: '全部分割完成！可手动进入下一步', en: 'All segmentation done! Proceed to the next step.' },
  'js.statsDone':       { zh: '统计分析完成！可手动进入下一步导出结果', en: 'Analysis done! Proceed to export.' },
  'js.noWorkingDir':    { zh: '请先设置数据根目录', en: 'Please set the data root directory first' },
  'js.noWorkingDirStep3': { zh: '请先在顶部栏设置工作目录', en: 'Please set the working directory in the top bar first' },
  'js.noInputPath':     { zh: '请输入输入目录路径', en: 'Please enter the input directory path' },
  'js.noInputOrWorkDir':{ zh: '请输入输入路径和工作目录', en: 'Please enter the input path and working directory' },
  'js.selectScanType':  { zh: '请至少选择一种扫描类型', en: 'Please select at least one scan type' },
  'js.selectTissue':    { zh: '请至少选择一种组织成分', en: 'Please select at least one tissue type' },
  'js.selectMetric':    { zh: '请至少选择一种统计指标', en: 'Please select at least one metric' },
  'js.selectVertRange': { zh: '选择目标椎体分析时必须同时选择分析范围', en: 'Selecting vertebrae requires selecting at least one range' },
  'js.vertRangeIncomplete': { zh: '请完整选择起始和结束椎体', en: 'Please select both start and end vertebrae' },
  'js.vertRangeSame':   { zh: '起始椎体和结束椎体不能相同', en: 'Start and end vertebrae must be different' },
  'js.tableGenerated':  { zh: '表格生成完成！', en: 'Table generated!' },
  'js.generateFail':    { zh: '生成失败: {msg}', en: 'Generation failed: {msg}' },
  'js.scanCSVHint':     { zh: '请先点击"扫描CSV数据"以加载可用选项', en: 'Click Scan CSV Data to load available options' },
  'js.noVertData':      { zh: '未检测到椎体分析数据', en: 'No vertebra analysis data detected' },
  'js.noRangeData':     { zh: '未检测到范围数据', en: 'No range data detected' },
  'js.scanNoData':      { zh: '未检测到数据，请先完成预处理和BOA分割', en: 'No data detected. Complete preprocessing and BOA segmentation first.' },
  'js.scanResult':      { zh: '发现 {ct} 个图像序列，发现 {lb} 个对应的标签序列文件夹', en: 'Found {ct} image series and {lb} matching label series folders' },
  'js.scanFoundSeries': { zh: '发现 {n} 个图像序列', en: 'Found {n} image series' },
  'js.scanCSVFound':    { zh: '发现 {n} 个图像序列，发现 {c} 个对应的分析结果文件夹', en: 'Found {n} image series and {c} matching analysis result folders' },
  'js.scanCSVEmpty':    { zh: '未在 statistic/ 目录下发现任何 CSV 数据，请先完成统计分析', en: 'No CSV data found in statistic/. Complete the statistical analysis first.' },
  'js.allDataFound':    { zh: '（已检测到全图分析数据）', en: '(whole-volume data detected)' },
  'js.allDataMissing':  { zh: '（未检测到全图分析数据，不可选）', en: '(no whole-volume data; unavailable)' },
  'js.tableStats':      { zh: '共 {r} 行 × {c} 列', en: '{r} rows x {c} columns' },
  'js.viewerLoadFail':  { zh: '图像加载失败: {msg}', en: 'Image loading failed: {msg}' },
  'js.openFolderFail':  { zh: '无法打开目录: ', en: 'Cannot open directory: ' },
  'js.taskSubmitted':   { zh: '任务已提交，等待开始...', en: 'Task submitted, waiting to start...' },
  'js.taskDone':        { zh: '任务完成', en: 'Task completed' },
  'js.taskCancelled':   { zh: '任务已取消', en: 'Task cancelled' },
  'js.errorPrefix':     { zh: '错误: ', en: 'Error: ' },
  'js.noSeries':        { zh: '暂无序列数据', en: 'No series data' },
};

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {object} params - 插值参数，替换 {key} 占位符
 */
function t(key, params) {
  const entry = I18N[key];
  let text = entry ? (entry[currentLang] || entry['en']) : key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
}

/** 始终返回英文翻译（控制台等需要固定英文的位置使用） */
function tEn(key, params) {
  const entry = I18N[key];
  let text = entry ? entry['en'] : key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
}

/**
 * 应用语言到整个页面。
 * 1. 遍历所有带 data-i18n 的元素（精确键翻译）
 * 2. 更新 document.title
 * 3. 更新 placeholder 属性
 */
function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text && text !== key) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    }
  });

  document.title = t('app.title.alt');

  document.querySelectorAll('input[placeholder]').forEach(el => {
    const ph = el.getAttribute('placeholder');
    const revKey = Object.keys(I18N).find(k => I18N[k].zh === ph || I18N[k].en === ph);
    if (revKey) el.placeholder = t(revKey);
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  updateStepIndicators();
  localStorage.setItem('bc_lang', currentLang);
}

function switchLanguage(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  localStorage.setItem('bc_lang', currentLang);
  applyLanguage();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(applyLanguage, 50);
});
