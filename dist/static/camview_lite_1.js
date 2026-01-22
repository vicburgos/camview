var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _videoMSE_instances, loopbuffer_fn;
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
class VideoController {
  constructor(videos = []) {
    var _a, _b;
    if (!videos || videos.length === 0) {
      throw new Error("VideoController requires at least one video");
    }
    this.videosMSEList = videos;
    this.masterVideo = videos[0].video;
    this.slaveVideos = videos.slice(1).map((v) => v.video);
    this.fps = ((_b = (_a = videos[0]) == null ? void 0 : _a.metadata) == null ? void 0 : _b.fps) || 10;
    this.syncThreshold = 1 / (this.fps * 2);
    this.isPlaying = false;
    this.isLoading = false;
    this.isSeeking = false;
    this.wasPlayingBeforeSeek = false;
    this.loadingListeners = [];
    this.playingListeners = [];
    this.seekingListeners = [];
    this.endVideoListeners = [];
    this.init();
  }
  // Agregar listener para cambios de loading
  onLoadingChange(callback) {
    this.loadingListeners.push(callback);
  }
  // Emitir evento de loading
  emitLoadingChange(isLoading) {
    this.loadingListeners.forEach((listener) => listener(isLoading));
  }
  onPlayingChange(callback) {
    this.playingListeners = this.playingListeners || [];
    this.playingListeners.push(callback);
  }
  emitPlayingChange(isPlaying) {
    if (this.playingListeners) {
      this.playingListeners.forEach((listener) => listener(isPlaying));
    }
  }
  onSeekingChange(callback) {
    this.seekingListeners.push(callback);
  }
  emitSeekingChange(isSeeking) {
    this.seekingListeners.forEach((listener) => listener(isSeeking));
  }
  onEndVideo(callback) {
    this.endVideoListeners.push(callback);
  }
  emitEndVideo() {
    this.endVideoListeners.forEach((listener) => listener());
  }
  init() {
    this.setupMasterListeners();
    this.syncInterval = setInterval(() => this.syncLoop(), 100);
  }
  setupMasterListeners() {
    this.masterVideo.addEventListener("play", () => {
      const wasPlaying = this.isPlaying;
      this.isPlaying = true;
      if (!wasPlaying) {
        this.emitPlayingChange(true);
      }
      this.playSlaves();
    });
    this.masterVideo.addEventListener("pause", () => {
      if (!this.isSeeking && !this.isLoading) {
        const wasPlaying = this.isPlaying;
        this.isPlaying = false;
        if (wasPlaying) {
          this.emitPlayingChange(false);
        }
        this.pauseSlaves();
      }
    });
    this.masterVideo.addEventListener("seeking", () => {
      this.isSeeking = true;
      this.wasPlayingBeforeSeek = this.isPlaying;
      this.emitSeekingChange(true);
    });
    this.masterVideo.addEventListener("seeked", () => {
      this.isSeeking = false;
      this.emitSeekingChange(false);
      this.syncSlaves();
      if (this.wasPlayingBeforeSeek) {
        this.isPlaying = true;
        setTimeout(() => {
          if (!this.isSeeking && this.wasPlayingBeforeSeek) {
            this.masterVideo.play().catch((err) => {
              console.warn("Error playing after seek:", err);
            });
          }
        }, 100);
      }
    });
    this.masterVideo.addEventListener("ratechange", () => {
      this.syncRate();
    });
    this.masterVideo.addEventListener("canplay", () => {
      this.checkAndResume();
    });
    this.masterVideo.addEventListener("playing", () => {
      this.checkAndResume();
    });
  }
  syncLoop() {
    this.updateLoadingState();
    if (this.isLoading) {
      this.pauseAll();
      return;
    }
    this.syncSlaves();
  }
  updateLoadingState() {
    const isAtEnd = this.masterVideo.currentTime >= this.videosMSEList[0].duration - 2 / this.fps;
    if (isAtEnd) {
      if (this.isPlaying) {
        this.emitEndVideo();
      }
    }
    const anyLoading = [this.masterVideo, ...this.slaveVideos].some((video) => {
      return video.readyState < 3;
    });
    const wasLoading = this.isLoading;
    this.isLoading = anyLoading;
    if (wasLoading !== anyLoading) {
      this.emitLoadingChange(anyLoading);
    }
    if (wasLoading && !anyLoading && this.isPlaying) {
      this.resumeAll();
    }
  }
  syncSlaves() {
    const masterTime = this.masterVideo.currentTime;
    this.slaveVideos.forEach((video) => {
      const timeDiff = Math.abs(video.currentTime - masterTime);
      if (timeDiff > this.syncThreshold) {
        video.currentTime = masterTime;
      }
    });
  }
  syncRate() {
    const masterRate = this.masterVideo.playbackRate;
    this.slaveVideos.forEach((video) => {
      if (video.playbackRate !== masterRate) {
        video.playbackRate = masterRate;
      }
    });
  }
  playSlaves() {
    this.slaveVideos.forEach((video) => {
      if (video.paused && !this.isLoading) {
        video.currentTime = this.masterVideo.currentTime;
        video.playbackRate = this.masterVideo.playbackRate;
        video.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("Error playing slave:", err);
          }
        });
      }
    });
  }
  pauseSlaves() {
    this.slaveVideos.forEach((video) => {
      if (!video.paused) {
        video.pause();
      }
    });
  }
  pauseAll() {
    if (!this.masterVideo.paused) {
      this.masterVideo.pause();
    }
    this.pauseSlaves();
  }
  resumeAll() {
    this.syncSlaves();
    if (this.masterVideo.paused && this.masterVideo.readyState >= 3) {
      this.masterVideo.play().catch((err) => {
        console.warn("Error resuming master:", err);
      });
    }
  }
  checkAndResume() {
    if (!this.isLoading && this.isPlaying) {
      this.resumeAll();
    }
  }
  // API pública
  play() {
    if (this.masterVideo.currentTime >= this.videosMSEList[0].duration - 1 / this.fps) {
      console.log("Video at end. You can seek to start again.");
      this.emitEndVideo();
      return;
    }
    this.masterVideo.play().catch((err) => {
      if (err.name !== "AbortError") {
        console.warn("Error playing master:", err);
      }
    });
  }
  pause() {
    this.masterVideo.pause();
  }
  seekTo(time) {
    this.masterVideo.currentTime = time;
  }
  setPlaybackRate(rate) {
    this.masterVideo.playbackRate = rate;
  }
  nextFrame() {
    this.masterVideo.currentTime += 1 / this.fps;
  }
  prevFrame() {
    this.masterVideo.currentTime -= 1 / this.fps;
  }
  getCurrentTime() {
    return this.masterVideo.currentTime;
  }
  getDuration() {
    return this.masterVideo.duration;
  }
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}
class ContourFilterConfig {
  constructor() {
    this._alpha = 0.8;
    this._levels = 8;
    this._minLevel = 25;
    this._maxLevel = 100;
    this.colorMapId = 1;
    this.blur = 2;
    this.downSampleContourLineFilter = 3;
    this.downSampleContourFaceFilter = 1;
    this.lineWidth = 1.5;
  }
  // Getter y setter para alpha con clamp 0-1
  get alpha() {
    return this._alpha;
  }
  set alpha(value) {
    this._alpha = Math.max(0, Math.min(1, value));
  }
  // Getter y setter para levels con clamp 2-25
  get levels() {
    return this._levels;
  }
  set levels(value) {
    this._levels = Math.max(2, Math.min(25, Math.floor(value)));
  }
  // Getter y setter para minLevel con clamp 0-100
  get minLevel() {
    return this._minLevel;
  }
  set minLevel(value) {
    this._minLevel = Math.max(0, Math.min(100, value));
  }
  // Getter y setter para maxLevel con clamp 0-100
  get maxLevel() {
    return this._maxLevel;
  }
  set maxLevel(value) {
    this._maxLevel = Math.max(0, Math.min(100, value));
  }
}
class VideoCanvasController {
  constructor(videosMSEList) {
    if (!videosMSEList || videosMSEList.length < 2) {
      throw new Error("VideoCanvasController requires at least 2 videos (base + grayscale)");
    }
    this.videosMSEList = videosMSEList;
    this.canvas = null;
    this.ctx = null;
    this.config = new ContourFilterConfig();
    this.thresholds = [];
    this.updateThresholds();
    this.offCanvasLine = null;
    this.offCtxLine = null;
    this.offCanvasFace = null;
    this.offCtxFace = null;
    this.baseFilter = new BaseFilter(this.videosMSEList);
    this.contourLineFilter = new ContourLineFilter(this);
    this.contourFaceFilter = new ContourFaceFilter(this);
    this.activeFilter = this.baseFilter;
    this.init();
  }
  init() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = 1920 * 0.7;
    canvas.height = 1080 * 0.7;
    this.canvas = canvas;
    this.ctx = ctx;
  }
  // Renderizar frame actual
  render() {
    try {
      const baseVideo = this.videosMSEList[0].video;
      if (baseVideo.readyState < baseVideo.HAVE_CURRENT_DATA) {
        return;
      }
      this.activeFilter.apply(this.ctx, this.canvas);
    } catch (error) {
      console.error("Error in canvas render:", error);
    }
  }
  // Obtener canvas para agregar al DOM
  getCanvas() {
    return this.canvas;
  }
  // Activar/desactivar filtros
  setFilter(filter, options = null) {
    this.activeFilter = filter;
    if (options) {
      if (options.opacity !== void 0) this.setAlpha(options.opacity);
      if (options.levels !== void 0) this.setLevels(options.levels);
      if (options.minLevel !== void 0) this.setMinLevel(options.minLevel);
      if (options.maxLevel !== void 0) this.setMaxLevel(options.maxLevel);
      if (options.colorMapId !== void 0) this.setColorMap(options.colorMapId);
      if (options.blur !== void 0) this.setBlur(options.blur);
      if (options.lineWidth !== void 0) this.setLineWidth(options.lineWidth);
    }
    return this;
  }
  clearFilter() {
    this.activeFilter = null;
    return this;
  }
  // ===== CALCULO DE THRESHOLDS =====
  updateThresholds() {
    const minLevel255 = Math.floor(this.config.minLevel / 100 * 255);
    const maxLevel255 = Math.floor(this.config.maxLevel / 100 * 255);
    const step = (maxLevel255 - minLevel255) / this.config.levels;
    this.thresholds = [];
    for (let i = 0; i < this.config.levels; i++) {
      this.thresholds.push(Math.floor(minLevel255 + i * step));
    }
  }
  // ===== METODOS COMPARTIDOS PARA AMBOS FILTROS =====
  setAlpha(value) {
    this.config.alpha = value;
    return this;
  }
  setLevels(count) {
    this.config.levels = count;
    this.updateThresholds();
    if (this.contourFaceFilter) {
      this.contourFaceFilter.updateColormap();
    }
    return this;
  }
  setMinLevel(value) {
    this.config.minLevel = value;
    this.updateThresholds();
    if (this.contourFaceFilter) {
      this.contourFaceFilter.updateColormap();
    }
    return this;
  }
  setMaxLevel(value) {
    this.config.maxLevel = value;
    this.updateThresholds();
    if (this.contourFaceFilter) {
      this.contourFaceFilter.updateColormap();
    }
    return this;
  }
  setColorMap(id) {
    this.config.colorMapId = id;
    if (this.contourFaceFilter) {
      this.contourFaceFilter.updateColormap();
    }
    return this;
  }
  setBlur(value) {
    this.config.blur = value;
    return this;
  }
  // ===== METODOS ESPECÍFICOS POR FILTRO =====
  setDownSampleContourLineFilter(value) {
    this.config.downSampleContourLineFilter = value;
    return this;
  }
  setDownSampleContourFaceFilter(value) {
    this.config.downSampleContourFaceFilter = value;
    return this;
  }
  setLineWidth(value) {
    this.config.lineWidth = value;
    return this;
  }
}
class BaseFilter {
  constructor(videosMSEList) {
    this.videosMSEList = videosMSEList;
  }
  apply(ctx, canvas) {
    const baseVideo = this.videosMSEList[0].video;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseVideo, 0, 0, canvas.width, canvas.height);
  }
}
class ContourLineFilter {
  constructor(controller) {
    this.controller = controller;
    this.colorMaps = {
      1: (t) => {
        const rgb = d3.interpolateSpectral(1 - t).match(/\d+/g);
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
      },
      2: (t) => {
        const rgb = d3.interpolateTurbo(t).match(/\d+/g);
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
      },
      3: (t) => {
        const rgb = d3.interpolateRdYlGn(1 - (0.1 + 0.9 * t)).match(/\d+/g);
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
      },
      4: (t) => {
        const rgb = d3.interpolateRainbow(1 - (0.1 + 0.9 * t)).match(/\d+/g);
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
      }
    };
  }
  apply(ctx, canvas) {
    const baseVideo = this.controller.videosMSEList[0].video;
    const videoGS = this.controller.videosMSEList[1];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseVideo, 0, 0, canvas.width, canvas.height);
    if (videoGS.onPlaceholder()) return;
    const { width, height } = canvas;
    const { downSampleContourLineFilter, blur, alpha, lineWidth, colorMapId } = this.controller.config;
    const thresholds = this.controller.thresholds;
    const w = Math.floor(width / downSampleContourLineFilter);
    const h = Math.floor(height / downSampleContourLineFilter);
    if (!this.controller.offCanvasLine || this.controller.offCanvasLine.width !== w || this.controller.offCanvasLine.height !== h) {
      this.controller.offCanvasLine = document.createElement("canvas");
      this.controller.offCanvasLine.width = w;
      this.controller.offCanvasLine.height = h;
      this.controller.offCtxLine = this.controller.offCanvasLine.getContext("2d", { willReadFrequently: true });
    }
    const offCtx = this.controller.offCtxLine;
    offCtx.clearRect(0, 0, w, h);
    offCtx.filter = `blur(${blur}px)`;
    offCtx.drawImage(videoGS.video, 0, 0, w, h);
    const imageData = offCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const grayData = new Uint8Array(data.length / 4 | 0);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      grayData[j] = data[i];
    }
    const contourGen = d3.contours().size([w, h]).thresholds(thresholds);
    const contours = contourGen(grayData);
    ctx.save();
    ctx.scale(width / w, height / h);
    contours.forEach((c) => {
      const tNorm = (c.value - thresholds[0]) / (thresholds[thresholds.length - 1] - thresholds[0]);
      const color = this.colorMaps[colorMapId](tNorm);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      c.coordinates.forEach((poly) => {
        poly.forEach((ring) => {
          ring.forEach(([x, y], idx) => {
            idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
        });
      });
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  }
}
class ContourFaceFilter {
  constructor(controller) {
    this.controller = controller;
    this.colorMaps = {
      1: (t) => {
        const rgb = d3.interpolateSpectral(1 - t).match(/\d+/g);
        return [parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2])];
      },
      2: (t) => {
        const rgb = d3.interpolateTurbo(t).match(/\d+/g);
        return [parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2])];
      },
      3: (t) => {
        const rgb = d3.interpolateRdYlGn(1 - (0.1 + 0.9 * t)).match(/\d+/g);
        return [parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2])];
      },
      4: (t) => {
        const rgb = d3.interpolateRainbow(1 - (0.1 + 0.9 * t)).match(/\d+/g);
        return [parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2])];
      }
    };
    this.colormap = [];
    this.updateColormap();
  }
  updateColormap() {
    const thresholds = this.controller.thresholds;
    const { colorMapId } = this.controller.config;
    this.colormap = [];
    for (let i = 0; i < 256; i++) {
      let idx = thresholds.findIndex((t) => i < t) - 1;
      if (idx < 0) idx = thresholds.length - 2;
      if (idx >= thresholds.length - 1) idx = thresholds.length - 2;
      const t0 = thresholds[idx];
      const tNorm = (t0 - thresholds[0]) / (thresholds[thresholds.length - 1] - thresholds[0]);
      const [r, g, b] = this.colorMaps[colorMapId](tNorm);
      const alpha = i < thresholds[0] ? 0 : 255;
      this.colormap.push([r, g, b, alpha]);
    }
  }
  apply(ctx, canvas) {
    const baseVideo = this.controller.videosMSEList[0].video;
    const videoGS = this.controller.videosMSEList[1];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseVideo, 0, 0, canvas.width, canvas.height);
    if (videoGS.onPlaceholder()) return;
    const { width, height } = canvas;
    const { blur, alpha, downSampleContourFaceFilter } = this.controller.config;
    const w = Math.floor(width / downSampleContourFaceFilter);
    const h = Math.floor(height / downSampleContourFaceFilter);
    if (!this.controller.offCanvasFace || this.controller.offCanvasFace.width !== w || this.controller.offCanvasFace.height !== h) {
      this.controller.offCanvasFace = document.createElement("canvas");
      this.controller.offCanvasFace.width = w;
      this.controller.offCanvasFace.height = h;
      this.controller.offCtxFace = this.controller.offCanvasFace.getContext("2d", { willReadFrequently: true });
    }
    const offCtx = this.controller.offCtxFace;
    offCtx.clearRect(0, 0, w, h);
    offCtx.filter = `blur(${blur}px)`;
    offCtx.drawImage(videoGS.video, 0, 0, w, h);
    const imageData = offCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i];
      const [r, g, b, a] = this.colormap[gray];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    offCtx.putImageData(imageData, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.controller.offCanvasFace, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}
const spanishMonth = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic"
];
class ChartController {
  constructor(config, videoController) {
    this.config = config;
    this.videoController = videoController;
    this.chart = null;
    this.cursorValue = null;
    this.BAND_COLOR_1 = "rgb(255, 255, 255)";
    this.BAND_COLOR_2 = "rgb(203, 236, 249)";
  }
  generateDayPlotBands() {
    const plotBands = [];
    const CONFIG = this.config;
    const startTime = CONFIG.firstUnixtime;
    const endTime = CONFIG.endUnixtime;
    const useUTC = CONFIG.useUTC;
    let isFirstColor = true;
    const firstDayEnd = new Date(startTime);
    if (useUTC) {
      firstDayEnd.setUTCHours(23, 59, 59, 999);
    } else {
      firstDayEnd.setHours(23, 59, 59, 999);
    }
    let bandStart = startTime;
    let bandEnd = Math.min(firstDayEnd.getTime(), endTime);
    plotBands.push({
      from: bandStart,
      to: bandEnd,
      color: isFirstColor ? this.BAND_COLOR_1 : this.BAND_COLOR_2,
      zIndex: 0
    });
    isFirstColor = !isFirstColor;
    let current = new Date(firstDayEnd.getTime() + 1);
    if (useUTC) {
      current.setUTCHours(0, 0, 0, 0);
    } else {
      current.setHours(0, 0, 0, 0);
    }
    while (true) {
      let nextDay = new Date(current);
      if (useUTC) {
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        nextDay.setUTCHours(0, 0, 0, 0);
      } else {
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
      }
      bandStart = current.getTime();
      bandEnd = Math.min(nextDay.getTime() - 1, endTime);
      if (bandStart >= endTime) break;
      if (bandStart < bandEnd) {
        plotBands.push({
          from: bandStart,
          to: bandEnd,
          color: isFirstColor ? this.BAND_COLOR_1 : this.BAND_COLOR_2,
          zIndex: 0
        });
      }
      isFirstColor = !isFirstColor;
      current = nextDay;
    }
    return plotBands;
  }
  initialize() {
    const CONFIG = this.config;
    const start = new Date(CONFIG.firstUnixtime);
    const end = new Date(CONFIG.endUnixtime);
    const zoom = {
      start: new Date(CONFIG.zoomStart),
      end: new Date(CONFIG.zoomEnd)
    };
    const plotBands = this.generateDayPlotBands();
    Highcharts.setOptions({
      lang: {
        shortMonths: spanishMonth,
        weekdays: [
          "domingo",
          "lunes",
          "martes",
          "miércoles",
          "jueves",
          "viernes",
          "sábado"
        ]
      },
      time: { useUTC: CONFIG.useUTC },
      chart: {
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: "12px"
        }
      }
    });
    [
      { type: "all", text: "Todo" },
      {
        type: "hour",
        count: Math.round((CONFIG.zoomEnd - CONFIG.zoomStart) / (1e3 * 60 * 60)),
        text: "1d"
      }
    ];
    this.chart = Highcharts.stockChart("chart", {
      boost: { seriesThreshold: 1, useGPUTranslations: true },
      rangeSelector: {
        inputEnabled: false,
        buttons: []
        // buttonTheme: { width: 30, height: 7 },
        // buttonSpacing: 0,
        // inputSpacing: 5,
        // inputStyle: { fontSize: '8px' },
        // verticalAlign: 'bottom',
        // height: 10,
      },
      exporting: {
        enabled: false
      },
      chart: {
        spacingTop: 0,
        spacingBottom: 0,
        marginTop: 12,
        marginBottom: 5
      },
      xAxis: {
        type: "datetime",
        opposite: true,
        tickColor: "grey",
        lineColor: "rgba(0, 0, 0, 0.5)",
        min: start.getTime(),
        max: end.getTime(),
        plotBands,
        dateTimeLabelFormats: {
          millisecond: "%H:%M:%S.%L",
          second: "%H:%M:%S",
          minute: "%H:%M",
          hour: "%H:%M",
          day: "%e %b",
          week: "%e %b",
          month: "%b '%y",
          year: "%Y"
        }
      },
      yAxis: {
        min: 0,
        max: 100,
        lineColor: "rgba(0, 0, 0, 0.5)",
        tickColor: "grey",
        tickInterval: 25,
        gridLineColor: "rgba(0, 0, 0, 0.25)",
        gridLineWidth: 1
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          animation: false,
          enableMouseTracking: true,
          states: { hover: { enabled: false } }
        }
      },
      legend: {
        enabled: false,
        symbolWidth: 0
      },
      accessibility: { enabled: false },
      navigator: {
        adaptToUpdatedData: false,
        height: 30,
        xAxis: {
          plotBands,
          gridLineWidth: 0,
          tickLength: 0,
          labels: {
            enabled: true,
            formatter: function() {
              const date = new Date(this.value);
              const dia = date.getDate();
              const mes = spanishMonth[date.getMonth()];
              return `${dia} ${mes}`;
            },
            style: {
              fontSize: "12px"
            },
            align: "center",
            x: 0,
            y: -33
          },
          tickPositioner: function() {
            return CONFIG.centerPerDataDay;
          }
        },
        yAxis: {
          min: 0,
          max: 100
        },
        series: {
          boostThreshold: 1,
          type: "line",
          dataGrouping: {
            enabled: true,
            groupPixelWidth: 2,
            smoothed: false
          }
        }
      },
      scrollbar: {
        height: 1
      },
      series: [],
      tooltip: {
        enabled: false,
        // // no mostrar el valor de y
        pointFormat: ""
        // // mostrar abajo
        // positioner: function (labelWidth, labelHeight, point) {
        //   const chart = this.chart;
        //   const tooltipX = point.plotX + chart.plotLeft - labelWidth / 2;
        //   const tooltipY = chart.plotTop + chart.plotHeight - labelHeight - 5;
        //   return { x: tooltipX, y: tooltipY };
        // }
      },
      credits: { enabled: false }
    });
    this.chart.xAxis[0].setExtremes(
      zoom.start.getTime(),
      zoom.end.getTime()
    );
    this.setupInteraction();
    this.addDummySeries();
    this.updateCursor(CONFIG.initialTime);
    return this.chart;
  }
  addDummySeries() {
    const CONFIG = this.config;
    const data = [];
    for (let i = 0; i < CONFIG.videotimeToUnixtime.length; i++) {
      const time = CONFIG.videotimeToUnixtime[i];
      data.push([time, null]);
    }
    this.addOrUpdateSeries("dummy", data, false, "#4a90e2");
  }
  updateCursor(currentTime) {
    if (!this.chart) return;
    const CONFIG = this.config;
    const currentTimeIndex = Math.round(currentTime * CONFIG.fps);
    const value = CONFIG.videotimeToUnixtime[currentTimeIndex];
    this.cursorValue = value;
    const colorCursor = "dodgerblue";
    const optionsCursor = {
      value,
      color: colorCursor,
      width: 5,
      zIndex: 5
    };
    this.chart.xAxis[0].removePlotLine("cursor");
    this.chart.xAxis[0].addPlotLine({
      id: "cursor",
      ...optionsCursor
    });
    if (this.chart.xAxis[1]) {
      this.chart.xAxis[1].removePlotLine("cursor-nav");
      this.chart.xAxis[1].addPlotLine({
        id: "cursor-nav",
        ...optionsCursor
      });
    }
  }
  setupInteraction() {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    const DRAG_THRESHOLD = 4;
    const wrapper = document.getElementById("chart");
    if (!wrapper) return;
    wrapper.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
    });
    wrapper.addEventListener("pointermove", (e) => {
      if (Math.abs(e.clientX - startX) > DRAG_THRESHOLD || Math.abs(e.clientY - startY) > DRAG_THRESHOLD) {
        isDragging = true;
      }
    });
    wrapper.addEventListener("pointerup", (e) => {
      if (isDragging) return;
      const chart = this.chart;
      const plotArea = chart.plotBox;
      const rect = wrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      if (clickX < plotArea.x || clickX > plotArea.x + plotArea.width || clickY < plotArea.y || clickY > plotArea.y + plotArea.height) {
        return;
      }
      const CONFIG = this.config;
      const xAxis = chart.xAxis[0];
      let xValue = xAxis.toValue(clickX);
      if (xValue < CONFIG.firstUnixtime) {
        xValue = CONFIG.firstUnixtime;
      }
      if (xValue > CONFIG.endUnixtime) {
        xValue = CONFIG.endUnixtime;
      }
      const xValueIndex = Math.round((xValue - CONFIG.firstUnixtime) / CONFIG.timestep);
      const currentTimeMs = CONFIG.unixtimeToVideotime[xValueIndex];
      const currentTime = currentTimeMs / 1e3;
      this.updateCursor(currentTime);
      this.videoController.seekTo(currentTime);
    });
  }
  centerNavigatorAtCursor() {
    if (!this.chart) return;
    const xAxis = this.chart.xAxis[0];
    const cursor = this.cursorValue;
    if (!cursor && cursor !== 0) return;
    const range = 12 * 60 * 60 * 1e3;
    let newMin = cursor - range;
    let newMax = cursor + range;
    const dataMin = xAxis.dataMin;
    const dataMax = xAxis.dataMax;
    if (newMin < dataMin) {
      newMin = dataMin;
      newMax = dataMin + range;
    }
    if (newMax > dataMax) {
      newMax = dataMax;
      newMin = dataMax - range;
    }
    xAxis.setExtremes(newMin, newMax);
  }
  addOrUpdateSeries(id, data, visible, color) {
    if (!this.chart) return;
    let series = this.chart.get(id);
    const seriesConfig = {
      id,
      type: "line",
      data,
      dataGrouping: {
        enabled: true,
        groupPixelWidth: 2,
        smoothed: true
      },
      // gapSize: 3600000, // 1 hora en milisegundos - no conectar si hay saltos mayores
      gapUnit: "value",
      color: visible ? color : "rgba(255, 255, 255, 0)",
      lineColor: visible ? color : "rgba(255, 255, 255, 0)",
      showInNavigator: true
    };
    if (series) {
      series.update(seriesConfig, false);
      this.chart.redraw();
    } else {
      this.chart.addSeries(seriesConfig);
    }
  }
  removeSeries(id) {
    if (!this.chart) return;
    const series = this.chart.get(id);
    if (series) {
      series.remove();
    }
  }
}
class GeometryModel {
  constructor() {
    this.geometries = /* @__PURE__ */ new Map();
    this.nextId = 1;
    this.listeners = [];
  }
  addPoint(x, y, color = "#770000") {
    const id = `point_${this.nextId++}`;
    const geometry = {
      id,
      type: "point",
      x,
      y,
      color,
      visible: true,
      series: null
      // Para almacenar datos de serie
    };
    this.geometries.set(id, geometry);
    this.notifyListeners("add", geometry);
    return geometry;
  }
  updatePoint(id, x, y) {
    const geometry = this.geometries.get(id);
    if (geometry && geometry.type === "point") {
      geometry.x = x;
      geometry.y = y;
      this.notifyListeners("update", geometry);
    }
  }
  removeGeometry(id) {
    const geometry = this.geometries.get(id);
    if (geometry) {
      this.geometries.delete(id);
      this.notifyListeners("remove", geometry);
    }
  }
  getGeometry(id) {
    return this.geometries.get(id);
  }
  getAllGeometries() {
    return Array.from(this.geometries.values());
  }
  getPoints() {
    return this.getAllGeometries().filter((g) => g.type === "point");
  }
  setSeries(id, seriesData) {
    const geometry = this.geometries.get(id);
    if (geometry) {
      geometry.series = seriesData;
      this.notifyListeners("series-update", geometry);
    }
  }
  clear() {
    this.geometries.clear();
    this.notifyListeners("clear", null);
  }
  onChange(callback) {
    this.listeners.push(callback);
  }
  notifyListeners(event, geometry) {
    this.listeners.forEach((listener) => listener(event, geometry));
  }
}
async function fetchManifest(camara) {
  try {
    const response = await fetch(
      `/camview/camara/?cam=${camara}`
    );
    const json = await response.json();
    return json;
  } catch (error) {
    console.error("Error fetching metadata:", error);
  }
}
async function fetchSeries(camara, x, y) {
  try {
    const params = new URLSearchParams({
      cam: camara,
      x: x.toFixed(4),
      y: y.toFixed(4)
    });
    const response = await fetch(`/camview/series?${params}`);
    const json = await response.json();
    return json;
  } catch (error) {
    console.error("Error fetching series data:", error);
    return null;
  }
}
class GeometryController {
  constructor(config) {
    this.config = config;
    this.model = new GeometryModel();
    this.chartController = null;
    this.isFetching = false;
  }
  setChartController(chartController) {
    this.chartController = chartController;
  }
  async addPoint(x, y, color = "#ff0000", precalculatedData = null) {
    console.log("Add point", x, y);
    if (this.isFetching) {
      console.log("Ya hay una carga en progreso, ignorando solicitud");
      return null;
    }
    this.isFetching = true;
    try {
      const existingGeometries = this.model.getAllGeometries();
      for (const existingGeometry of existingGeometries) {
        if (this.chartController) {
          this.chartController.removeSeries(existingGeometry.id);
        }
      }
      this.model.clear();
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      const geometry = this.model.addPoint(x, y, color);
      if (precalculatedData && precalculatedData.length > 0) {
        this.model.setSeries(geometry.id, precalculatedData);
        if (this.chartController) {
          this.updateChartSeries(geometry);
        }
      } else {
        geometry.fetchPending = true;
        await this.fetchSeriesForGeometry(geometry);
        geometry.fetchPending = false;
      }
      return geometry;
    } finally {
      this.isFetching = false;
    }
  }
  async fetchSeriesForGeometry(geometry) {
    try {
      if (!this.model.getGeometry(geometry.id)) {
        return;
      }
      if (this.chartController && this.chartController.chart) {
        this.chartController.chart.showLoading("Cargando datos...");
      }
      const { x, y } = geometry;
      const camara = this.config.camara;
      const start = new Date(this.config.firstUnixtime);
      const end = new Date(this.config.endUnixtime);
      const seriesData = await fetchSeries(camara, x, y, start, end);
      if (!this.model.getGeometry(geometry.id)) {
        return;
      }
      if (seriesData && seriesData.data) {
        const filteredData = seriesData.data.filter((point) => {
          const time = point[0];
          return time >= this.config.firstUnixtime && time <= this.config.endUnixtime;
        });
        this.model.setSeries(geometry.id, filteredData);
        if (this.chartController && filteredData.length > 0 && this.model.getGeometry(geometry.id)) {
          this.updateChartSeries(geometry);
        }
      }
    } catch (error) {
      console.error("Error fetching series for geometry:", error);
    } finally {
      if (this.chartController && this.chartController.chart) {
        this.chartController.chart.hideLoading();
      }
    }
  }
  updateChartSeries(geometry) {
    if (!this.chartController || !geometry.series) return;
    const data = geometry.series;
    this.chartController.addOrUpdateSeries(
      geometry.id,
      data,
      geometry.visible,
      geometry.color
    );
  }
  updatePoint(id, x, y) {
    if (this.chartController) {
      this.chartController.removeSeries(id);
    }
    const geometry = this.model.getGeometry(id);
    if (!geometry) return;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    const dx = Math.abs(geometry.x - x);
    const dy = Math.abs(geometry.y - y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 5e-3) {
      return;
    }
    this.model.updatePoint(id, x, y);
    this.fetchSeriesForGeometry(geometry);
  }
  removeGeometry(id) {
    if (this.chartController) {
      this.chartController.removeSeries(id);
    }
    this.model.removeGeometry(id);
  }
  clearAll() {
    if (this.chartController) {
      this.model.getAllGeometries().forEach((geometry) => {
        this.chartController.removeSeries(geometry.id);
      });
    }
    this.model.clear();
  }
  getModel() {
    return this.model;
  }
}
function calculateTimestep(manifest) {
  const availableTimes = manifest.videos.map((v) => v.times);
  availableTimes.sort((a, b) => a[0] - b[0]);
  const timestepBetweenAvailableTimes = [];
  for (let i = 0; i < availableTimes.length; i++) {
    const times = availableTimes[i];
    for (let j = 1; j < times.length; j++) {
      const diff = (times[j] - times[j - 1]) * 1e3;
      timestepBetweenAvailableTimes.push(diff);
    }
  }
  return Math.min(...timestepBetweenAvailableTimes);
}
function calculateDateRange(manifest, startDate, endDate) {
  const availableTimes = manifest.videos.map((v) => v.times);
  let firstUnixtime = null;
  let endUnixtime = null;
  if (startDate) {
    const startUnix = startDate.getTime();
    let nearestStart = null;
    for (let i = 0; i < availableTimes.length; i++) {
      const times = availableTimes[i];
      for (let j = 0; j < times.length; j++) {
        const timeUnix = times[j] * 1e3;
        if (timeUnix >= startUnix) {
          if (!nearestStart || timeUnix < nearestStart) {
            nearestStart = times[0] * 1e3;
          }
        }
      }
    }
    firstUnixtime = nearestStart ? nearestStart : availableTimes[0][0] * 1e3;
  }
  if (endDate) {
    const endUnix = endDate.getTime();
    let nearestEnd = null;
    for (let i = 0; i < availableTimes.length; i++) {
      const times = availableTimes[i];
      for (let j = 0; j < times.length; j++) {
        const timeUnix = times[j] * 1e3;
        if (timeUnix <= endUnix) {
          if (!nearestEnd || timeUnix > nearestEnd) {
            nearestEnd = times[times.length - 1] * 1e3;
          }
        }
      }
    }
    endUnixtime = nearestEnd ? nearestEnd : availableTimes[availableTimes.length - 1].slice(-1)[0] * 1e3;
  }
  if (!firstUnixtime || !endUnixtime) {
    endUnixtime = availableTimes[availableTimes.length - 1].slice(-1)[0] * 1e3;
  }
  if (!firstUnixtime) {
    firstUnixtime = endUnixtime - 7 * 24 * 60 * 60 * 1e3;
    let nearestStart = null;
    for (let i = 0; i < availableTimes.length; i++) {
      const times = availableTimes[i];
      for (let j = 0; j < times.length; j++) {
        const timeUnix = times[j] * 1e3;
        if (timeUnix >= firstUnixtime) {
          if (!nearestStart || timeUnix < nearestStart) {
            nearestStart = times[0] * 1e3;
          }
        }
      }
    }
    firstUnixtime = nearestStart ? nearestStart : availableTimes[0][0] * 1e3;
  }
  return { firstUnixtime, endUnixtime };
}
function buildMappings(CONFIG, manifest) {
  const videoChunksSet = /* @__PURE__ */ new Set();
  const chunkRanges = manifest.videos.map((video, idx) => {
    video.durationSeconds = video.times.length * (1 / CONFIG.fps);
    return {
      video,
      originalIndex: idx,
      start: video.times[0] * 1e3,
      end: video.times[video.times.length - 1] * 1e3
    };
  });
  let chunkIdxAux = 0;
  for (let t = CONFIG.firstUnixtime; t <= CONFIG.endUnixtime; t += CONFIG.timestep) {
    while (chunkIdxAux < chunkRanges.length - 1 && t > chunkRanges[chunkIdxAux].end) {
      chunkIdxAux++;
    }
    const { video, start, end } = chunkRanges[chunkIdxAux];
    if (start <= t && t <= end) {
      const videoURL = video.inp;
      let chunkIndex;
      if (!videoChunksSet.has(videoURL)) {
        videoChunksSet.add(videoURL);
        chunkIndex = CONFIG.videoChunksList.length;
        CONFIG.videoChunksList.push(video);
      } else {
        chunkIndex = CONFIG.videoChunksList.findIndex((v) => v.inp === videoURL);
      }
      const innerIndex = video.times.findIndex(
        (time) => time * 1e3 >= t
      );
      CONFIG.unixtimeToChunkIndex.push(chunkIndex);
      CONFIG.unixtimeToInnerIndex.push(innerIndex);
    } else {
      CONFIG.unixtimeToChunkIndex.push(null);
      CONFIG.unixtimeToInnerIndex.push(null);
    }
  }
  let accumulatedTime = 0;
  for (let i = 0; i < CONFIG.videoChunksList.length; i++) {
    const video = CONFIG.videoChunksList[i];
    video.timestampOffset = accumulatedTime;
    accumulatedTime += video.durationSeconds;
    video.inp = manifest.base_url_prefix + video.inp;
    video.gs = manifest.base_url_prefix + video.gs;
  }
}
function healMappings(CONFIG) {
  for (let i = 0; i < CONFIG.unixtimeToChunkIndex.length; i++) {
    if (CONFIG.unixtimeToChunkIndex[i] === null) {
      for (let j = i + 1; j < CONFIG.unixtimeToChunkIndex.length; j++) {
        if (CONFIG.unixtimeToChunkIndex[j] !== null) {
          for (let k = i; k < j; k++) {
            CONFIG.unixtimeToChunkIndex[k] = CONFIG.unixtimeToChunkIndex[j];
            CONFIG.unixtimeToInnerIndex[k] = CONFIG.unixtimeToInnerIndex[j];
          }
          break;
        }
      }
    }
  }
}
function buildUnixtimeToVideotimeMap(CONFIG) {
  for (let i = 0; i < CONFIG.unixtimeToChunkIndex.length; i++) {
    const chunkIndex = CONFIG.unixtimeToChunkIndex[i];
    const innerIndex = CONFIG.unixtimeToInnerIndex[i];
    const video = CONFIG.videoChunksList[chunkIndex];
    const videoTimeMs = Math.round(innerIndex * (1 / CONFIG.fps) * 1e3);
    const globalVideoTimeMs = Math.round(video.timestampOffset * 1e3) + videoTimeMs;
    CONFIG.unixtimeToVideotime.push(globalVideoTimeMs);
  }
}
function buildVideotimeToUnixtimeMap(CONFIG) {
  const videotimeToUnixtimeMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < CONFIG.unixtimeToVideotime.length; i++) {
    const videoTime = CONFIG.unixtimeToVideotime[i];
    const unixtime = CONFIG.firstUnixtime + i * CONFIG.timestep;
    if (!videotimeToUnixtimeMap.has(videoTime)) {
      videotimeToUnixtimeMap.set(videoTime, unixtime);
    }
  }
  CONFIG.videotimeToUnixtime = Array.from(videotimeToUnixtimeMap.values());
}
function buildVideotimeToChunkIndexMap(CONFIG) {
  for (let i = 0; i < CONFIG.videotimeToUnixtime.length; i++) {
    const unixtime = CONFIG.videotimeToUnixtime[i];
    const unixtimeIndex = Math.round((unixtime - CONFIG.firstUnixtime) / CONFIG.timestep);
    const chunkIndex = CONFIG.unixtimeToChunkIndex[unixtimeIndex];
    CONFIG.videotimeToChunkIndex.push(chunkIndex);
  }
}
async function buildConfig(camara, start, end, useUTC, manifest, initialTimeUTC = null, defaultSeries = null) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const CONFIG = {
    camara,
    useUTC: useUTC || false,
    fps: (manifest == null ? void 0 : manifest.fps) || 10,
    videoDuration: null,
    initialTime: null,
    initialtTimeIndex: null,
    defaultSeriesData: null,
    // Para almacenar datos precalculados
    timestep: (manifest == null ? void 0 : manifest.timestep) || calculateTimestep(manifest),
    firstUnixtime: null,
    endUnixtime: null,
    // Lista principal de chunks (info)
    videoChunksList: [],
    // Mapeos con indices
    unixtimeToChunkIndex: [],
    unixtimeToInnerIndex: [],
    // Mapeos temporales
    unixtimeToVideotime: [],
    videotimeToUnixtime: [],
    // Mapeo para video
    videotimeToChunkIndex: [],
    // Total video time
    totalVideoTime: null,
    //centerPerDataDay
    centerPerDataDay: []
  };
  const { firstUnixtime, endUnixtime } = calculateDateRange(
    manifest,
    startDate,
    endDate
  );
  CONFIG.firstUnixtime = firstUnixtime;
  CONFIG.endUnixtime = endUnixtime;
  buildMappings(CONFIG, manifest);
  healMappings(CONFIG);
  buildUnixtimeToVideotimeMap(CONFIG);
  buildVideotimeToUnixtimeMap(CONFIG);
  buildVideotimeToChunkIndexMap(CONFIG);
  CONFIG.totalVideoTime = CONFIG.videoChunksList.at(-1).timestampOffset + CONFIG.videoChunksList.at(-1).durationSeconds;
  if (initialTimeUTC) {
    const initialUnixtime = new Date(initialTimeUTC).getTime();
    const clampedInitialUnixtime = Math.max(
      CONFIG.firstUnixtime,
      Math.min(initialUnixtime, CONFIG.endUnixtime)
    );
    const xValueIndex = Math.floor((clampedInitialUnixtime - CONFIG.firstUnixtime) / CONFIG.timestep);
    const currentTimeMs = CONFIG.unixtimeToVideotime[xValueIndex];
    CONFIG.initialTime = currentTimeMs / 1e3;
    CONFIG.initialtTimeIndex = Math.round(CONFIG.initialTime * CONFIG.fps);
  } else {
    const xValueIndex = Math.floor((CONFIG.endUnixtime - CONFIG.firstUnixtime) / CONFIG.timestep);
    const currentTimeMs = CONFIG.unixtimeToVideotime[xValueIndex];
    CONFIG.initialTime = currentTimeMs / 1e3;
    CONFIG.initialtTimeIndex = Math.round(CONFIG.initialTime * CONFIG.fps);
  }
  let currentDay = null;
  let dayStart = null;
  let dayEnd = null;
  for (let i = 0; i < CONFIG.videotimeToUnixtime.length; i++) {
    const unixtime = CONFIG.videotimeToUnixtime[i];
    const date = new Date(unixtime);
    const day = date.getUTCDate();
    if (day !== currentDay) {
      if (currentDay !== null && dayStart !== null && dayEnd !== null) {
        const center = (dayStart + dayEnd) / 2;
        CONFIG.centerPerDataDay.push(center);
      }
      currentDay = day;
      dayStart = unixtime;
      dayEnd = unixtime;
    } else {
      dayEnd = unixtime;
    }
  }
  if (dayStart !== null && dayEnd !== null) {
    const center = (dayStart + dayEnd) / 2;
    CONFIG.centerPerDataDay.push(center);
  }
  if (defaultSeries && defaultSeries.x !== null && defaultSeries.y !== null) {
    try {
      const seriesData = await fetchSeries(
        camara,
        defaultSeries.x,
        defaultSeries.y
      );
      if (seriesData && seriesData.data) {
        const filteredData = seriesData.data.filter((point) => {
          const time = point[0];
          return time >= CONFIG.firstUnixtime && time <= CONFIG.endUnixtime;
        });
        CONFIG.defaultSeriesData = {
          x: defaultSeries.x,
          y: defaultSeries.y,
          data: filteredData
        };
      }
    } catch (error) {
      console.error("Error precalculating default series:", error);
    }
  }
  const rangeMs = 12 * 60 * 60 * 1e3;
  const countFrames = Math.floor(rangeMs / CONFIG.timestep);
  CONFIG.initialtTimeIndex - Math.round(countFrames / 2) > 0 ? CONFIG.zoomStart = CONFIG.videotimeToUnixtime[CONFIG.initialtTimeIndex - Math.floor(countFrames / 2)] : CONFIG.zoomStart = CONFIG.firstUnixtime;
  CONFIG.initialtTimeIndex + Math.round(countFrames / 2) < CONFIG.videotimeToUnixtime.length ? CONFIG.zoomEnd = CONFIG.videotimeToUnixtime[CONFIG.initialtTimeIndex + Math.ceil(countFrames / 2)] : CONFIG.zoomEnd = CONFIG.endUnixtime;
  console.log(CONFIG.firstUnixtime, CONFIG.endUnixtime, CONFIG.zoomStart);
  return CONFIG;
}
const placeholderColor = `
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
`;
const placeholderBlack = `
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
`;
const placeholderWhite = `
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
`;
function buildPlaceholder(color = "black") {
  let binary;
  if (color === "black") {
    binary = atob(placeholderBlack);
  } else if (color === "white") {
    binary = atob(placeholderWhite);
  } else {
    binary = atob(placeholderColor);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
class videoMSE {
  constructor({
    videoChunksList = [],
    metadata = {}
  }) {
    __privateAdd(this, _videoMSE_instances);
    if (!videoChunksList || videoChunksList.length === 0) {
      throw new Error("videoChunksList is required and cannot be empty");
    }
    this.metadata = {
      fps: 10,
      mime: 'video/mp4; codecs="avc1.640028"',
      bufferAhead: 2,
      mapping: null,
      initialTime: 0,
      cleanupBuffer: false,
      urlKey: null,
      ...metadata
      // override
    };
    this.mode = this.metadata.mapping ? "seek" : "sequential";
    const firstChunkToCheck = videoChunksList[0];
    if (!firstChunkToCheck.inp) {
      throw new Error('Each chunk in videoChunksList must have a "url" property');
    }
    if (this.mode === "seek") {
      if (firstChunkToCheck.timestampOffset === void 0 || firstChunkToCheck.durationSeconds === void 0) {
        throw new Error('In seek mode, each chunk must have "url", "timestampOffset", and "durationSeconds"');
      }
    }
    this.video = document.createElement("video");
    this.videoChunksList = videoChunksList;
    this.playListURL = videoChunksList.map((v) => v[this.metadata.urlKey || "url"]);
    this.duration = this.metadata.mapping ? videoChunksList.at(-1).timestampOffset + videoChunksList.at(-1).durationSeconds : null;
    this.initialTime = this.metadata.initialTime;
    this.currentChunkIndex = 0;
    this.loadedChunks = /* @__PURE__ */ new Set();
    this.failedChunks = /* @__PURE__ */ new Set();
    this.isAppending = false;
    this.timeOffsetAdjustment = 0;
    this.placeholderBuffer = null;
    this.placeholderDuration = 0.1;
    this.addBuffer = this.mode === "seek" ? this.addBufferWithMapping : this.addBufferSequential;
    this.loadPlaceholder();
    this.initMediaSource();
  }
  //-----------------------------
  //MediaSource setup            
  // -----------------------------
  async loadPlaceholder() {
    try {
      this.placeholderBuffer = buildPlaceholder();
    } catch (err) {
      console.warn("the chunk placeholder is not available:", err.message);
    }
  }
  async generatePlaceholder() {
    if (!this.placeholderBuffer) {
      console.warn("Chunk placeholder no available");
      return null;
    }
    return this.placeholderBuffer;
  }
  async fetchWithRetry(url, chunkIndex, maxRetries = 1, delay = 1e3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const minSize = 10 * 1024;
        if (arrayBuffer.byteLength < minSize) {
          throw new Error(
            `Buffer corrupted: size ${arrayBuffer.byteLength} bytes < ${minSize} bytes`
          );
        }
        return arrayBuffer;
      } catch (err) {
        console.warn(
          `Try ${i + 1}/${maxRetries} failed for chunk ${chunkIndex}:`,
          err.message
        );
        if (i === maxRetries - 1) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  initMediaSource() {
    this.mediaSource = new MediaSource();
    this.video.src = URL.createObjectURL(this.mediaSource);
    if (this.mode === "seek" && this.duration) {
      this.video.addEventListener("timeupdate", () => {
        if (this.video.currentTime > this.duration - 2 / this.metadata.fps) {
          this.video.pause();
          if (this.video.currentTime > this.duration - 1 / this.metadata.fps) {
            this.video.currentTime = this.duration - 1 / this.metadata.fps;
          }
        }
      });
    }
    this.mediaSource.addEventListener("sourceopen", () => {
      if (this.sourceBuffer) return;
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.metadata.mime);
      this.sourceBuffer.mode = "sequence";
      if (this.metadata.mapping && this.duration) {
        this.mediaSource.duration = this.duration;
      }
      this.addBuffer(this.initialTime).then(() => {
        if (this.metadata.mapping && this.initialTime > 0) {
          this.video.currentTime = this.initialTime;
        }
      });
      __privateMethod(this, _videoMSE_instances, loopbuffer_fn).call(this);
    });
  }
  //-----------------------------
  //Buffer logic - Soporta dos modos:
  // 1. Con mapping: seek habilitado, usa indices
  // 2. Sin mapping: secuencial, sin seek
  // El metodo addBuffer se asigna en el constructor segun el modo
  //-----------------------------
  async addBufferWithMapping(currentTime) {
    if (this.isAppending) return;
    const currentTimeIndex = Math.floor(currentTime * this.metadata.fps);
    const currentChunkIndex = this.metadata.mapping[currentTimeIndex];
    if (currentChunkIndex === null || currentChunkIndex === void 0) {
      console.warn("No available chunk for current time:", currentTime);
      return;
    }
    const startChunk = currentChunkIndex;
    const endChunk = Math.min(
      currentChunkIndex + this.metadata.bufferAhead,
      this.playListURL.length - 1
    );
    const chunksToLoad = [];
    for (let i = startChunk; i <= endChunk; i++) {
      if (!this.loadedChunks.has(i)) {
        chunksToLoad.push(i);
      }
    }
    if (chunksToLoad.length === 0) return;
    this.isAppending = true;
    for (const chunkIndex of chunksToLoad) {
      const url = this.playListURL[chunkIndex];
      try {
        const arrayBuffer = await this.fetchWithRetry(url, chunkIndex);
        const chunkInfo = this.videoChunksList[chunkIndex];
        this.sourceBuffer.timestampOffset = chunkInfo.timestampOffset;
        await this.appendBuffer(arrayBuffer);
        this.loadedChunks.add(chunkIndex);
        if (chunkIndex === this.videoChunksList.length - 1) {
          const placeholderBuffer = await this.generatePlaceholder();
          if (placeholderBuffer) {
            try {
              const finalPlaceholderCopies = 20;
              const lastChunkInfo = this.videoChunksList[chunkIndex];
              const finalOffset = lastChunkInfo.timestampOffset + lastChunkInfo.durationSeconds;
              for (let i = 0; i < finalPlaceholderCopies; i++) {
                const offset = finalOffset + i * this.placeholderDuration - this.timeOffsetAdjustment;
                this.sourceBuffer.timestampOffset = offset;
                await this.appendBuffer(placeholderBuffer);
              }
            } catch (appendErr) {
              console.error(`Error insertando placeholder final:`, appendErr.message);
            }
          }
        }
        if (this.metadata.cleanupBuffer) {
          this.cleanupBuffer(currentTime);
        }
      } catch (err) {
        console.error(
          `Chunk ${chunkIndex} failed to load`
        );
        const chunkInfo = this.videoChunksList[chunkIndex];
        const placeholderBuffer = await this.generatePlaceholder();
        if (placeholderBuffer) {
          try {
            const repetitions = Math.ceil(
              chunkInfo.durationSeconds / this.placeholderDuration
            );
            console.log(
              `Insert placeholder for chunk ${chunkIndex}, repetitions: ${repetitions}`
            );
            for (let i = 0; i < repetitions; i++) {
              const offset = chunkInfo.timestampOffset + i * this.placeholderDuration - this.timeOffsetAdjustment;
              this.sourceBuffer.timestampOffset = offset;
              await this.appendBuffer(placeholderBuffer);
            }
          } catch (appendErr) {
            console.error(`Error insertando placeholder:`, appendErr.message);
            this.timeOffsetAdjustment += chunkInfo.durationSeconds;
          }
        } else {
          this.timeOffsetAdjustment += chunkInfo.durationSeconds;
        }
        this.loadedChunks.add(chunkIndex);
        this.failedChunks.add(chunkIndex);
        continue;
      }
    }
    this.isAppending = false;
  }
  async addBufferSequential() {
    if (this.isAppending) return;
    if (this.currentChunkIndex >= this.playListURL.length) {
      return;
    }
    const chunksToLoad = [];
    const maxChunks = Math.min(
      this.currentChunkIndex + this.metadata.bufferAhead,
      this.playListURL.length
    );
    for (let i = this.currentChunkIndex; i < maxChunks; i++) {
      if (!this.loadedChunks.has(i)) {
        chunksToLoad.push(i);
      }
    }
    if (chunksToLoad.length === 0) {
      this.currentChunkIndex = maxChunks;
      return;
    }
    this.isAppending = true;
    for (const chunkIndex of chunksToLoad) {
      const url = this.playListURL[chunkIndex];
      try {
        const arrayBuffer = await this.fetchWithRetry(url, chunkIndex);
        await this.appendBuffer(arrayBuffer);
        this.loadedChunks.add(chunkIndex);
        this.currentChunkIndex = chunkIndex + 1;
        if (chunkIndex === this.videoChunksList.length - 1) {
          this.mediaSource.endOfStream();
        }
        if (this.metadata.cleanupBuffer) {
          this.cleanupBuffer();
        }
      } catch (err) {
        console.error(`Chunk ${chunkIndex} failed to load:`, err.message);
        this.loadedChunks.add(chunkIndex);
        this.failedChunks.add(chunkIndex);
        this.currentChunkIndex = chunkIndex + 1;
        continue;
      }
    }
    this.isAppending = false;
  }
  appendBuffer(arrayBuffer) {
    return new Promise((resolve, reject) => {
      this.sourceBuffer.addEventListener(
        "updateend",
        () => resolve(),
        { once: true }
      );
      this.sourceBuffer.appendBuffer(arrayBuffer);
    });
  }
  //-----------------------------
  // Método para limpiar el buffer y evitar sobrecarga
  //-----------------------------
  cleanupBuffer(currentTime) {
    if (!this.metadata.cleanupBuffer) return;
    if (!this.sourceBuffer || this.sourceBuffer.updating) return;
    if (this.mode === "seek") {
      const currentTimeIndex = Math.round(currentTime * this.metadata.fps);
      const currentChunkIndex = this.metadata.mapping[currentTimeIndex];
      const chunkInfo = this.videoChunksList[currentChunkIndex];
      const keepBehind = 2 * chunkInfo.durationSeconds;
      const removeEnd = currentTime - keepBehind;
      if (removeEnd <= 0) return;
      try {
        this.sourceBuffer.remove(0, removeEnd);
      } catch {
      }
    } else {
      const currentVideoTime = this.video.currentTime;
      const keepBehindSeconds = 10;
      const removeEnd = currentVideoTime - keepBehindSeconds;
      if (removeEnd <= 0) return;
      try {
        this.sourceBuffer.remove(0, removeEnd);
      } catch {
      }
    }
  }
  //-----------------------------
  // Metodo para verificar si el currentTime está en un placeholder
  //-----------------------------
  onPlaceholder(currentTime = null) {
    if (this.mode !== "seek") {
      return false;
    }
    const time = currentTime !== null ? currentTime : this.video.currentTime;
    const currentTimeIndex = Math.round(time * this.metadata.fps);
    const currentChunkIndex = this.metadata.mapping[currentTimeIndex];
    if (currentChunkIndex === null || currentChunkIndex === void 0) {
      return false;
    }
    return this.failedChunks.has(currentChunkIndex);
  }
  onLoading() {
    return this.video.readyState < 3;
  }
}
_videoMSE_instances = new WeakSet();
loopbuffer_fn = function() {
  if (this.video.ended) return;
  this.addBuffer(this.video.currentTime);
  setTimeout(() => __privateMethod(this, _videoMSE_instances, loopbuffer_fn).call(this), 500);
};
function GeometryView({ geometryController, canvasElement }) {
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "5"
  });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.assign(svg.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none"
  });
  container.appendChild(svg);
  let currentPoint = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  const getCanvasRect = () => {
    const rect = canvasElement.getBoundingClientRect();
    const videoWidth = canvasElement.videoWidth || canvasElement.width;
    const videoHeight = canvasElement.videoHeight || canvasElement.height;
    if (!videoWidth || !videoHeight) return rect;
    const rectAspect = rect.width / rect.height;
    const videoAspect = videoWidth / videoHeight;
    let visibleWidth = rect.width;
    let visibleHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    if (rectAspect > videoAspect) {
      visibleWidth = rect.height * videoAspect;
      offsetX = (rect.width - visibleWidth) / 2;
    } else {
      visibleHeight = rect.width / videoAspect;
      offsetY = (rect.height - visibleHeight) / 2;
    }
    return {
      left: rect.left + offsetX,
      top: rect.top + offsetY,
      width: visibleWidth,
      height: visibleHeight,
      right: rect.left + offsetX + visibleWidth,
      bottom: rect.top + offsetY + visibleHeight,
      offsetX,
      offsetY
    };
  };
  const updateSVGPosition = () => {
    const canvasRect = canvasElement.getBoundingClientRect();
    const videoWidth = canvasElement.videoWidth || canvasElement.width;
    const videoHeight = canvasElement.videoHeight || canvasElement.height;
    if (!videoWidth || !videoHeight) return;
    const rectAspect = canvasRect.width / canvasRect.height;
    const videoAspect = videoWidth / videoHeight;
    let visibleWidth = canvasRect.width;
    let visibleHeight = canvasRect.height;
    let offsetX = 0;
    let offsetY = 0;
    if (rectAspect > videoAspect) {
      visibleWidth = canvasRect.height * videoAspect;
      offsetX = (canvasRect.width - visibleWidth) / 2;
    } else {
      visibleHeight = canvasRect.width / videoAspect;
      offsetY = (canvasRect.height - visibleHeight) / 2;
    }
    container.style.left = `${offsetX}px`;
    container.style.top = `${offsetY}px`;
    container.style.width = `${visibleWidth}px`;
    container.style.height = `${visibleHeight}px`;
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
  };
  container.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (geometryController.isFetching) {
      container.style.cursor = "wait";
      setTimeout(() => {
        container.style.cursor = "";
      }, 500);
      return;
    }
    const rect = getCanvasRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (currentPoint) {
      const circle = svg.querySelector(`[data-geometry-id="${currentPoint.id}"]`);
      if (circle) {
        const cx = parseFloat(circle.getAttribute("cx"));
        const cy = parseFloat(circle.getAttribute("cy"));
        const radius = parseFloat(circle.getAttribute("r")) + 4;
        const distSq = (e.clientX - rect.left - cx) ** 2 + (e.clientY - rect.top - cy) ** 2;
        if (distSq <= radius * radius) {
          geometryController.removeGeometry(currentPoint.id);
          currentPoint = null;
          return;
        }
      }
    }
    if (currentPoint) {
      geometryController.removeGeometry(currentPoint.id);
      currentPoint = null;
    }
    geometryController.addPoint(x, y).then((geometry) => {
      if (geometry) {
        currentPoint = geometry;
        renderPoint(geometry);
      }
    });
  });
  container.style.pointerEvents = "auto";
  updateSVGPosition();
  function renderPoint(geometry) {
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    if (!geometry) return;
    const rect = getCanvasRect();
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", geometry.x * rect.width);
    circle.setAttribute("cy", geometry.y * rect.height);
    circle.setAttribute("r", 10);
    circle.setAttribute("fill", "transparent");
    circle.setAttribute("stroke", geometry.color);
    circle.setAttribute("stroke-width", 2);
    circle.setAttribute("data-geometry-id", geometry.id);
    circle.style.cursor = "move";
    circle.style.pointerEvents = "auto";
    circle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDragging = true;
      const rect2 = getCanvasRect();
      dragStartX = e.clientX - rect2.left - geometry.x * rect2.width;
      dragStartY = e.clientY - rect2.top - geometry.y * rect2.height;
    });
    svg.appendChild(circle);
  }
  document.addEventListener("mousemove", (e) => {
    if (!isDragging || !currentPoint) return;
    const rect = getCanvasRect();
    const circle = svg.querySelector(`[data-geometry-id="${currentPoint.id}"]`);
    if (!circle) return;
    const newX = e.clientX - rect.left - dragStartX;
    const newY = e.clientY - rect.top - dragStartY;
    circle.setAttribute("cx", newX);
    circle.setAttribute("cy", newY);
  });
  document.addEventListener("mouseup", () => {
    if (isDragging && currentPoint) {
      isDragging = false;
      const circle = svg.querySelector(`[data-geometry-id="${currentPoint.id}"]`);
      if (circle) {
        const rect = getCanvasRect();
        const finalX = parseFloat(circle.getAttribute("cx")) / rect.width;
        const finalY = parseFloat(circle.getAttribute("cy")) / rect.height;
        geometryController.updatePoint(currentPoint.id, finalX, finalY);
      }
    }
  });
  function redrawAll() {
    updateSVGPosition();
    const geometries = geometryController.getModel().getAllGeometries();
    const rect = getCanvasRect();
    geometries.forEach((geometry) => {
      const circle = svg.querySelector(`[data-geometry-id="${geometry.id}"]`);
      if (circle) {
        circle.setAttribute("cx", geometry.x * rect.width);
        circle.setAttribute("cy", geometry.y * rect.height);
      }
    });
  }
  const resizeObserver = new ResizeObserver(() => {
    redrawAll();
  });
  resizeObserver.observe(canvasElement);
  geometryController.getModel().onChange((event, geometry) => {
    if (event === "add" || event === "update") {
      currentPoint = geometry;
      renderPoint(geometry);
    } else if (event === "remove" || event === "clear") {
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }
      currentPoint = null;
    }
  });
  return {
    el: container,
    redrawAll
    // Exponer método para forzar redibujado si es necesario
  };
}
function VideoView({ canvasController, videoController, chartController, geometryController }) {
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    margin: "auto",
    overflow: "hidden"
  });
  const canvasWrapper = document.createElement("div");
  canvasWrapper.id = "canvas-wrapper";
  Object.assign(canvasWrapper.style, {
    position: "relative",
    // Importante para que el overlay se posicione correctamente
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  });
  const canvas = canvasController.getCanvas(0);
  const canvasHeight = 100;
  Object.assign(canvas.style, {
    width: "100%",
    height: `${canvasHeight}%`,
    minHeight: "200px",
    objectFit: "contain"
  });
  canvasWrapper.appendChild(canvas);
  if (geometryController) {
    const geometryView = GeometryView({
      geometryController,
      canvasElement: canvas
    });
    canvasWrapper.appendChild(geometryView.el);
  }
  container.appendChild(canvasWrapper);
  const loadingOverlay = document.createElement("div");
  Object.assign(loadingOverlay.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "10",
    backgroundColor: "rgba(255, 255, 255, 0.5)"
  });
  const spinner = document.createElement("div");
  spinner.className = "spinner-border text-dark";
  spinner.setAttribute("role", "status");
  spinner.style.cssText = "width: 4rem; height: 4em;";
  loadingOverlay.appendChild(spinner);
  container.appendChild(loadingOverlay);
  const makeBtn = (icon, fontSize = "12px") => {
    const btn = document.createElement("button");
    btn.innerHTML = icon;
    Object.assign(btn.style, {
      width: "40px",
      height: "40px",
      border: "none",
      background: "none",
      cursor: "pointer",
      fontSize
    });
    return btn;
  };
  const controlBarHeight = 30;
  const controlsBar = document.createElement("div");
  Object.assign(controlsBar.style, {
    display: "flex",
    width: "100%",
    height: `${100 - canvasHeight}%`,
    minHeight: `${controlBarHeight}px`,
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    userSelect: "none",
    backgroundColor: "rgba(255, 255, 255, 0.95)"
  });
  const btnPrev = makeBtn('<i class="bi bi-chevron-double-left"></i>');
  const btnPP = makeBtn('<i class="bi bi-play-fill"></i>', "18px");
  const btnNext = makeBtn('<i class="bi bi-chevron-double-right"></i>');
  const btnGoto = makeBtn('<i class="bi bi-input-cursor"></i>');
  btnPrev.title = "Frame Anterior";
  btnPP.title = "Play/Pause";
  btnNext.title = "Frame Siguiente";
  btnGoto.title = "Centrar Cursor";
  btnPrev.onclick = () => {
    videoController.prevFrame();
  };
  btnNext.onclick = () => {
    videoController.nextFrame();
  };
  btnPP.onclick = () => {
    videoController.isPlaying ? videoController.pause() : videoController.play();
  };
  btnGoto.onclick = () => {
    if (chartController) {
      chartController.centerNavigatorAtCursor();
    }
  };
  videoController.onPlayingChange((isPlaying) => {
    isPlaying ? btnPP.innerHTML = '<i class="bi bi-pause-fill"></i>' : btnPP.innerHTML = '<i class="bi bi-play-fill"></i>';
  });
  const speedSelect = document.createElement("select");
  speedSelect.title = "Velocidad de Reproducción";
  Object.assign(speedSelect.style, {
    height: `${controlBarHeight * 0.8}px`,
    border: "1px solid #ccc",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    padding: "0 4px",
    marginLeft: "8px",
    userSelect: "none"
  });
  const speeds = [0.25, 0.5, 1, 1.5, 2];
  speeds.forEach((speed) => {
    const option = document.createElement("option");
    option.value = speed;
    option.textContent = `${speed}x`;
    if (speed === 1) option.selected = true;
    speedSelect.appendChild(option);
  });
  speedSelect.onchange = () => {
    videoController.setPlaybackRate(parseFloat(speedSelect.value));
  };
  controlsBar.append(btnGoto, btnPrev, btnPP, btnNext, speedSelect);
  container.appendChild(controlsBar);
  let loadingTimeout = null;
  let thesholdTime = 200;
  videoController.onLoadingChange((isLoading) => {
    if (isLoading) {
      loadingTimeout = setTimeout(() => {
        loadingOverlay.style.display = "flex";
        loadingTimeout = null;
      }, thesholdTime);
    } else {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }
      loadingOverlay.style.display = "none";
    }
  });
  videoController.onEndVideo(() => {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-info fade";
    alertDiv.role = "alert";
    Object.assign(alertDiv.style, {
      position: "absolute",
      top: "10px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "20"
    });
    alertDiv.innerHTML = `
            <strong>El video ha finalizado</strong> </br> Rebobine a un instante anterior para seguir reproduciendo
        `;
    container.appendChild(alertDiv);
    setTimeout(() => alertDiv.classList.add("show"), 10);
    setTimeout(() => {
      alertDiv.classList.remove("show");
      setTimeout(() => container.removeChild(alertDiv), 150);
    }, 1800);
  });
  function update() {
    try {
      canvasController.render();
    } catch (error) {
      console.error("Error updating VideoView:", error);
    }
  }
  return {
    el: container,
    canvasWrapper,
    // Exponer para agregar overlays
    update
  };
}
function InfoView({ videoController, videoMSE: videoMSE2, config }) {
  const screen = document.createElement("div");
  Object.assign(screen.style, {
    position: "absolute",
    top: "5px",
    left: "5px",
    background: "rgba(0, 0, 0, 0.6)",
    color: "white",
    padding: "5px",
    borderRadius: "5px",
    fontFamily: "monospace",
    fontSize: "9px",
    zIndex: "1000"
  });
  function update() {
    const currentTimeIndex = Math.round(videoMSE2.video.currentTime * config.fps);
    const unixtime = config.videotimeToUnixtime[currentTimeIndex] ? config.videotimeToUnixtime[currentTimeIndex] : config.videotimeToUnixtime.at(-1);
    const date = new Date(unixtime);
    const onPlaceholder = videoMSE2.onPlaceholder();
    const dateToString = config.useUTC ? date.toUTCString().slice(0, 25) : date.toString().slice(0, 24);
    screen.innerHTML = `
            <div><strong>Date:</strong> ${dateToString}</div>
            <div><strong>Placeholder:</strong> ${onPlaceholder}</div>
            <div><strong>Loading:</strong> ${videoController.isLoading}</div>
            <div><strong>Playing:</strong> ${videoController.isPlaying}</div>
            <div><strong>Seeking:</strong> ${videoController.isSeeking}</div>
            <div><strong>Current Time:</strong> ${videoMSE2.video.currentTime.toFixed(2)} s</div>
            <div><strong>Duration:</strong> ${videoMSE2.video.duration.toFixed(2)} s</div>
        `;
  }
  return {
    el: screen,
    update
  };
}
function LoadingView() {
  const container = document.createElement("div");
  Object.assign(container.style, {
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center"
  });
  const message = document.createElement("h2");
  Object.assign(message.style, {
    margin: "0",
    padding: "20px",
    fontWeight: "normal",
    color: "#333",
    fontSize: "32px",
    textAlign: "center",
    display: "inline-block",
    minWidth: "320px"
  });
  const text = document.createElement("span");
  text.textContent = "Inicializando aplicación";
  const dots = document.createElement("span");
  dots.style.display = "inline-block";
  dots.style.width = "1.5em";
  dots.style.textAlign = "left";
  message.appendChild(text);
  message.appendChild(dots);
  container.appendChild(message);
  let dotCount = 0;
  const intervalId = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    dots.textContent = ".".repeat(dotCount);
  }, 350);
  return {
    el: container,
    destroy: () => {
      clearInterval(intervalId);
      container.remove();
    }
  };
}
function TabPanel(options = {}) {
  var _a;
  const tabs = options.tabs || [];
  let activeTab = options.active || ((_a = tabs[0]) == null ? void 0 : _a.id);
  let collapsed = options.collapsed ?? false;
  const onChange = options.onChange || (() => {
  });
  const maxWidth = options.maxWidth || 350;
  const minWidth = options.minWidth || 16;
  const container = document.createElement("div");
  container.className = "tab-panel-container border-start bg-white";
  const header = document.createElement("div");
  header.id = "tab-panel-header";
  header.style.width = `${maxWidth}px`;
  const content = document.createElement("div");
  content.id = "tab-panel-content";
  content.style.width = `${maxWidth}px`;
  content.className = "content-panel flex-fill overflow-auto";
  container.append(header, content);
  const style = document.createElement("style");
  style.textContent = `
        .tab-panel-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-width: ${minWidth}px;
            width: ${maxWidth}px;
            max-width: ${maxWidth}px;
            transition: width 0.3s ease;
        }
        .tab-panel-container:has(.collapsed) {
            width: ${minWidth}px !important;
        }
        .tab-panel-container:has(.collapsed) > .content-panel {
            display: none;
        }
        .tab-panel-container:has(.collapsed) .nav {
            display: none;
        }
        .nav-link.active {
            border-top: 3px solid silver;
        }
        .tab-panel-container .nav.single-tab {
            display: none;
        }
    `;
  document.head.appendChild(style);
  function renderHeader() {
    header.innerHTML = "";
    const wrapperHeader = document.createElement("div");
    wrapperHeader.className = "d-flex align-items-center";
    if (collapsed) wrapperHeader.classList.add("collapsed");
    const toggleBtn = document.createElement("button");
    Object.assign(toggleBtn.style, {
      width: `${minWidth}px`,
      height: `30px`,
      padding: "2px",
      margin: "2px",
      border: "none"
    });
    toggleBtn.className = "btn btn-link text-secondary text-decoration-none d-flex align-items-center justify-content-center";
    const icon = document.createElement("i");
    Object.assign(icon.style, {
      fontSize: `18px`,
      color: `black`
    });
    icon.className = collapsed ? "bi bi-chevron-left" : "bi bi-chevron-right";
    toggleBtn.appendChild(icon);
    toggleBtn.onclick = toggle;
    wrapperHeader.appendChild(toggleBtn);
    window.addEventListener("resize", () => {
      if (window.innerWidth < 800 && !collapsed) {
        collapsed = true;
        renderHeader();
      }
    });
    const nav = document.createElement("ul");
    nav.className = "nav nav-tabs";
    tabs.forEach((tab) => {
      const li = document.createElement("li");
      li.className = "nav-item";
      const link = document.createElement("a");
      link.className = "nav-link";
      link.href = "#";
      link.textContent = tab.label;
      if (tab.id === activeTab) link.classList.add("active");
      link.onclick = (e) => {
        e.preventDefault();
        setActive(tab.id);
      };
      li.appendChild(link);
      nav.appendChild(li);
    });
    wrapperHeader.appendChild(nav);
    header.appendChild(wrapperHeader);
  }
  function renderContent() {
    const currentTab = tabs.find((tab) => tab.id === activeTab);
    content.innerHTML = "";
    if (currentTab && currentTab.content) {
      if (typeof currentTab.content === "function") {
        const result = currentTab.content();
        if (result && result.el) {
          content.appendChild(result.el);
        } else {
          content.appendChild(result);
        }
      } else if (typeof currentTab.content === "string") {
        content.innerHTML = currentTab.content;
      } else if (currentTab.content instanceof HTMLElement) {
        content.appendChild(currentTab.content);
      }
    } else {
      const placeholder = document.createElement("div");
      placeholder.innerHTML = `Contenido para la pestaña <strong>${activeTab}</strong>`;
      content.appendChild(placeholder);
    }
  }
  function setActive(id) {
    if (id === activeTab) return;
    activeTab = id;
    renderHeader();
    renderContent();
    onChange(id);
  }
  function toggle() {
    collapsed = !collapsed;
    renderHeader();
  }
  renderHeader();
  renderContent();
  return {
    el: container,
    setActive,
    toggle,
    update: () => {
      renderContent();
    }
  };
}
function FilterOptionsView({ canvasController }) {
  const container = document.createElement("div");
  container.className = "filter-options-view p-3";
  const title = document.createElement("h6");
  title.className = "mb-3";
  title.textContent = "Opciones del Filtro";
  function createControl(label, value, onChange, options = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-3";
    const labelRow = document.createElement("div");
    labelRow.className = "d-flex justify-content-between align-items-center mb-1";
    const labelEl = document.createElement("label");
    labelEl.className = "form-label small mb-0";
    labelEl.textContent = label;
    labelRow.appendChild(labelEl);
    let valueDisplay = null;
    if (options.showBadge !== false) {
      valueDisplay = document.createElement("span");
      valueDisplay.className = "badge bg-secondary";
      valueDisplay.textContent = value;
      labelRow.appendChild(valueDisplay);
    }
    wrapper.appendChild(labelRow);
    if (options.type === "select") {
      const select = document.createElement("select");
      select.className = "form-select form-select-sm";
      options.items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        if (item.value === value) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      select.onchange = () => {
        const newValue = options.items.find((item) => item.value == select.value);
        if (valueDisplay) {
          valueDisplay.textContent = newValue.label;
        }
        onChange(select.value);
      };
      wrapper.appendChild(select);
    } else {
      const rangeWrapper = document.createElement("div");
      rangeWrapper.className = "d-flex align-items-center gap-2";
      const range = document.createElement("input");
      range.type = "range";
      range.className = "form-range flex-grow-1";
      range.min = options.min || 0;
      range.max = options.max || 100;
      range.step = options.step || 1;
      range.value = value;
      range.oninput = () => {
        const val = parseFloat(range.value);
        if (valueDisplay) {
          valueDisplay.textContent = options.toFixed ? val.toFixed(options.toFixed) : val;
        }
        onChange(val);
      };
      rangeWrapper.appendChild(range);
      wrapper.appendChild(rangeWrapper);
    }
    return wrapper;
  }
  const config = canvasController.config;
  let currentFilter = "line";
  let filterEnabled = true;
  if (canvasController.activeFilter === canvasController.baseFilter) {
    filterEnabled = false;
  } else if (canvasController.activeFilter === canvasController.contourLineFilter) {
    currentFilter = "line";
  } else if (canvasController.activeFilter === canvasController.contourFaceFilter) {
    currentFilter = "face";
  }
  const switchWrapper = document.createElement("div");
  switchWrapper.className = "mb-3";
  const switchRow = document.createElement("div");
  switchRow.className = "d-flex justify-content-between align-items-center";
  const switchLabel = document.createElement("label");
  switchLabel.className = "form-label small mb-0";
  switchLabel.textContent = "Activar detección de polvo";
  const switchControl = document.createElement("div");
  switchControl.className = "form-check form-switch";
  const switchInput = document.createElement("input");
  switchInput.type = "checkbox";
  switchInput.className = "form-check-input";
  switchInput.checked = filterEnabled;
  switchInput.style.cursor = "pointer";
  let selectedFilterType = currentFilter;
  switchInput.onchange = () => {
    if (switchInput.checked) {
      if (selectedFilterType === "line") {
        canvasController.setFilter(canvasController.contourLineFilter);
      } else {
        canvasController.setFilter(canvasController.contourFaceFilter);
      }
    } else {
      canvasController.setFilter(canvasController.baseFilter);
    }
  };
  switchControl.appendChild(switchInput);
  switchRow.appendChild(switchLabel);
  switchRow.appendChild(switchControl);
  switchWrapper.appendChild(switchRow);
  container.appendChild(switchWrapper);
  const filterTypeControl = createControl(
    "Tipo de contorno",
    currentFilter,
    (value) => {
      selectedFilterType = value;
      if (switchInput.checked) {
        if (value === "line") {
          canvasController.setFilter(canvasController.contourLineFilter);
        } else {
          canvasController.setFilter(canvasController.contourFaceFilter);
        }
      }
    },
    {
      type: "select",
      showBadge: false,
      items: [
        { value: "line", label: "Línea" },
        { value: "face", label: "Interior" }
      ]
    }
  );
  container.appendChild(filterTypeControl);
  const colorMapControl = createControl(
    "Mapa de Colores",
    config.colorMapId,
    (value) => canvasController.setColorMap(parseInt(value)),
    {
      type: "select",
      showBadge: false,
      items: [
        { value: 1, label: "Espectral" },
        { value: 2, label: "Turbo" },
        { value: 3, label: "Gradiente Verde-Rojo" },
        { value: 4, label: "Rainbow" }
      ]
    }
  );
  container.appendChild(colorMapControl);
  const separator = document.createElement("hr");
  separator.className = "my-3";
  container.appendChild(separator);
  const alphaControl = createControl(
    "Opacidad",
    config.alpha.toFixed(2),
    (value) => canvasController.setAlpha(value),
    { min: 0, max: 1, step: 0.01, toFixed: 2 }
  );
  container.appendChild(alphaControl);
  const levelsControl = createControl(
    "Niveles de Contorno",
    config.levels,
    (value) => canvasController.setLevels(value),
    { min: 2, max: 25, step: 1 }
  );
  container.appendChild(levelsControl);
  const minLevelControl = createControl(
    "Nivel Mínimo (%)",
    config.minLevel,
    (value) => canvasController.setMinLevel(value),
    { min: 0, max: 100, step: 1 }
  );
  container.appendChild(minLevelControl);
  const maxLevelControl = createControl(
    "Nivel Máximo (%)",
    config.maxLevel,
    (value) => canvasController.setMaxLevel(value),
    { min: 0, max: 100, step: 1 }
  );
  container.appendChild(maxLevelControl);
  return {
    el: container
  };
}
async function App(camara, start, end, useUTC, debug, root2) {
  console.time("App initialization");
  console.time("Fetching metadata");
  const loadingView = LoadingView();
  root2.appendChild(loadingView.el);
  const manifest = await fetchManifest(camara);
  loadingView.destroy();
  console.timeEnd("Fetching metadata");
  const CONFIG = buildConfig(camara, start, end, useUTC, manifest);
  console.timeEnd("App initialization");
  const layout = document.createElement("div");
  layout.id = "layout";
  Object.assign(layout.style, {
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "row",
    gap: "5px",
    overflow: "hidden",
    userSelect: "none",
    padding: "5px"
  });
  root2.appendChild(layout);
  const leftPanel = document.createElement("div");
  leftPanel.id = "left-panel";
  Object.assign(leftPanel.style, {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    flex: "1",
    overflow: "hidden",
    minWidth: "400px"
  });
  layout.appendChild(leftPanel);
  const rightPanel = document.createElement("div");
  rightPanel.id = "right-panel";
  layout.appendChild(rightPanel);
  root2.appendChild(layout);
  const videoWrapper = document.createElement("div");
  videoWrapper.id = "video-wrapper";
  const videoWrapperHeight = 60;
  Object.assign(videoWrapper.style, {
    position: "relative",
    // height: `${videoWrapperHeight}%`,
    width: "100%",
    overflow: "hidden"
  });
  leftPanel.appendChild(videoWrapper);
  const chartWrapper = document.createElement("div");
  chartWrapper.id = "chart";
  Object.assign(chartWrapper.style, {
    height: `${100 - videoWrapperHeight}%`,
    minHeight: "200px",
    width: "100%",
    overflow: "hidden"
  });
  leftPanel.appendChild(chartWrapper);
  const videoINP = new videoMSE({
    videoChunksList: CONFIG.videoChunksList,
    metadata: {
      mapping: CONFIG.videotimeToChunkIndex,
      urlKey: "inp",
      fps: CONFIG.fps,
      initialTime: CONFIG.initialTime
    }
  });
  const videoGS = new videoMSE({
    videoChunksList: CONFIG.videoChunksList,
    metadata: {
      mapping: CONFIG.videotimeToChunkIndex,
      urlKey: "gs",
      fps: CONFIG.fps,
      initialTime: CONFIG.initialTime
    }
  });
  const videoController = new VideoController([videoINP, videoGS]);
  const canvasController = new VideoCanvasController([videoINP, videoGS]);
  const chartController = new ChartController(CONFIG, videoController);
  const geometryController = new GeometryController(CONFIG);
  geometryController.setChartController(chartController);
  window.videoController = videoController;
  window.canvasController = canvasController;
  window.chartController = chartController;
  window.geometryController = geometryController;
  canvasController.setFilter(canvasController.baseFilter);
  const videoView = VideoView({
    canvasController,
    videoController,
    chartController,
    geometryController
  });
  videoWrapper.appendChild(videoView.el);
  let lastUpdateTime = 0;
  const targetFPS = 10;
  const frameInterval = 1e3 / targetFPS;
  function renderLoop(currentTime) {
    if (currentTime - lastUpdateTime >= frameInterval) {
      videoView.update();
      lastUpdateTime = currentTime;
    }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);
  const videoContainer = document.createElement("div");
  videoContainer.style.position = "absolute";
  videoContainer.style.bottom = "0";
  videoContainer.style.right = "0";
  videoContainer.style.width = "1px";
  videoContainer.style.display = "flex";
  videoContainer.style.flexDirection = "column";
  videoWrapper.appendChild(videoContainer);
  videoContainer.appendChild(videoINP.video);
  videoContainer.appendChild(videoGS.video);
  if (debug) {
    const infoView = InfoView({
      videoController,
      videoMSE: videoINP,
      config: CONFIG
    });
    root2.appendChild(infoView.el);
    videoController.onLoadingChange(() => infoView.update());
    videoController.onPlayingChange(() => infoView.update());
    videoController.onSeekingChange(() => infoView.update());
    videoINP.video.addEventListener(
      "timeupdate",
      () => infoView.update()
    );
    videoINP.video.addEventListener(
      "loadedmetadata",
      () => infoView.update()
    );
    videoContainer.style.width = "240px";
  }
  const filterOptionsView = FilterOptionsView({ canvasController });
  const tabPanel = TabPanel({
    tabs: [
      {
        id: "setting",
        label: "Configuración",
        content: () => filterOptionsView
      }
    ],
    active: "setting",
    collapsed: false,
    maxWidth: 280,
    onChange: (tabId) => {
      console.log("Tab changed:", tabId);
    }
  });
  rightPanel.appendChild(tabPanel.el);
  chartController.initialize();
  videoINP.video.addEventListener("timeupdate", () => {
    chartController.updateCursor(videoINP.video.currentTime);
  });
}
async function CamView(container, options = {}) {
  var _a, _b;
  const defaultOptions = {
    camID: null,
    time: {
      startUTC: null,
      endUTC: null,
      initialTimeUTC: null
    },
    chart: {
      useUTC: true,
      defaultSeries: null
    },
    settings: {
      collapse: false,
      color: {
        active: false,
        type: "line",
        // 'line' o 'face'
        opacity: 0.5,
        levels: 10,
        minLevel: 0,
        maxLevel: 100
      }
    },
    debug: false
  };
  const config = {
    ...defaultOptions,
    ...options,
    time: { ...defaultOptions.time, ...options.time },
    chart: { ...defaultOptions.chart, ...options.chart },
    settings: {
      ...defaultOptions.settings,
      ...options.settings,
      color: { ...defaultOptions.settings.color, ...(_a = options.settings) == null ? void 0 : _a.color }
    }
  };
  const { camID, time, chart, settings, debug } = config;
  console.time("CamView initialization");
  const root2 = typeof container === "string" ? document.getElementById(container) : container;
  if (!root2) {
    throw new Error(`Container element not found: ${container}`);
  }
  const loadingView = LoadingView();
  root2.appendChild(loadingView.el);
  const manifest = await fetchManifest(camID);
  const CONFIG = await buildConfig(
    camID,
    time == null ? void 0 : time.startUTC,
    time == null ? void 0 : time.endUTC,
    chart == null ? void 0 : chart.useUTC,
    manifest,
    time == null ? void 0 : time.initialTimeUTC,
    chart == null ? void 0 : chart.defaultSeries
  );
  loadingView.destroy();
  console.timeEnd("CamView initialization");
  const layout = document.createElement("div");
  layout.id = "layout";
  Object.assign(layout.style, {
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "row",
    gap: "5px",
    overflow: "hidden",
    userSelect: "none",
    padding: "5px"
  });
  root2.appendChild(layout);
  const leftPanel = document.createElement("div");
  leftPanel.id = "left-panel";
  Object.assign(leftPanel.style, {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    flex: "1",
    overflow: "hidden",
    minWidth: "400px"
  });
  layout.appendChild(leftPanel);
  const rightPanel = document.createElement("div");
  rightPanel.id = "right-panel";
  layout.appendChild(rightPanel);
  const videoWrapper = document.createElement("div");
  videoWrapper.id = "video-wrapper";
  const videoWrapperHeight = 60;
  Object.assign(videoWrapper.style, {
    position: "relative",
    width: "100%",
    overflow: "hidden"
  });
  leftPanel.appendChild(videoWrapper);
  const chartWrapper = document.createElement("div");
  chartWrapper.id = "chart";
  Object.assign(chartWrapper.style, {
    height: `${100 - videoWrapperHeight}%`,
    minHeight: "200px",
    width: "100%",
    overflow: "hidden"
  });
  leftPanel.appendChild(chartWrapper);
  const videoINP = new videoMSE({
    videoChunksList: CONFIG.videoChunksList,
    metadata: {
      mapping: CONFIG.videotimeToChunkIndex,
      urlKey: "inp",
      fps: CONFIG.fps,
      initialTime: CONFIG.initialTime
    }
  });
  const videoGS = new videoMSE({
    videoChunksList: CONFIG.videoChunksList,
    metadata: {
      mapping: CONFIG.videotimeToChunkIndex,
      urlKey: "gs",
      fps: CONFIG.fps,
      initialTime: CONFIG.initialTime
    }
  });
  const videoController = new VideoController([videoINP, videoGS]);
  const canvasController = new VideoCanvasController([videoINP, videoGS]);
  const chartController = new ChartController(CONFIG, videoController);
  const geometryController = new GeometryController(CONFIG);
  geometryController.setChartController(chartController);
  if ((_b = settings == null ? void 0 : settings.color) == null ? void 0 : _b.active) {
    const filterOptions = {
      type: settings.color.type,
      opacity: settings.color.opacity,
      levels: settings.color.levels,
      minLevel: settings.color.minLevel,
      maxLevel: settings.color.maxLevel,
      active: settings.color.active
    };
    if (filterOptions.type == "line") {
      canvasController.setFilter(canvasController.contourLineFilter, filterOptions);
    } else if (filterOptions.type == "face") {
      canvasController.setFilter(canvasController.contourFaceFilter, filterOptions);
    } else {
      canvasController.setFilter(canvasController.contourLineFilter, filterOptions);
    }
  } else {
    canvasController.setFilter(canvasController.baseFilter);
  }
  const videoView = VideoView({
    canvasController,
    videoController,
    chartController,
    geometryController
  });
  videoWrapper.appendChild(videoView.el);
  let lastUpdateTime = 0;
  const targetFPS = 10;
  const frameInterval = 1e3 / targetFPS;
  function renderLoop(currentTime) {
    if (currentTime - lastUpdateTime >= frameInterval) {
      videoView.update();
      lastUpdateTime = currentTime;
    }
    requestAnimationFrame(renderLoop);
  }
  videoINP.video.addEventListener("loadedmetadata", () => {
    requestAnimationFrame(renderLoop);
  });
  const videoContainer = document.createElement("div");
  videoContainer.style.position = "absolute";
  videoContainer.style.bottom = "0";
  videoContainer.style.right = "0";
  videoContainer.style.width = "1px";
  videoContainer.style.display = "flex";
  videoContainer.style.flexDirection = "column";
  videoWrapper.appendChild(videoContainer);
  videoContainer.appendChild(videoINP.video);
  videoContainer.appendChild(videoGS.video);
  if (debug) {
    const infoView = InfoView({
      videoController,
      videoMSE: videoINP,
      config: CONFIG
    });
    root2.appendChild(infoView.el);
    videoController.onLoadingChange(() => infoView.update());
    videoController.onPlayingChange(() => infoView.update());
    videoController.onSeekingChange(() => infoView.update());
    videoINP.video.addEventListener(
      "timeupdate",
      () => infoView.update()
    );
    videoINP.video.addEventListener(
      "loadedmetadata",
      () => infoView.update()
    );
    videoContainer.style.width = "240px";
  }
  const filterOptionsView = FilterOptionsView({ canvasController });
  const tabPanel = TabPanel({
    tabs: [
      {
        id: "setting",
        label: "Configuración",
        content: () => filterOptionsView
      }
    ],
    active: "setting",
    collapsed: settings.collapse,
    maxWidth: 280,
    onChange: (tabId) => {
      console.log("Tab changed:", tabId);
    }
  });
  rightPanel.appendChild(tabPanel.el);
  chartController.initialize();
  videoINP.video.addEventListener("timeupdate", () => {
    chartController.updateCursor(videoINP.video.currentTime);
  });
  if (CONFIG.defaultSeriesData) {
    const { x, y, data } = CONFIG.defaultSeriesData;
    videoINP.video.addEventListener("loadedmetadata", () => {
      geometryController.addPoint(x, y, "#ff0000", data).catch((error) => {
        console.error("Error loading default series:", error);
      });
    }, { once: true });
  }
  return {
    videoController,
    canvasController,
    chartController,
    geometryController,
    destroy: () => {
      var _a2, _b2, _c, _d, _e;
      (_a2 = videoView.destroy) == null ? void 0 : _a2.call(videoView);
      (_b2 = filterOptionsView.destroy) == null ? void 0 : _b2.call(filterOptionsView);
      (_c = tabPanel.destroy) == null ? void 0 : _c.call(tabPanel);
      (_d = videoINP.cleanup) == null ? void 0 : _d.call(videoINP);
      (_e = videoGS.cleanup) == null ? void 0 : _e.call(videoGS);
      root2.innerHTML = "";
    }
  };
}
async function WrapperApp(root2) {
  var _a;
  const camAvailable = (_a = root2.getAttribute("cam-availables")) == null ? void 0 : _a.split(" ");
  const header = document.createElement("header");
  header.classList.add("bg-gradient", "shadow-sm");
  header.style.padding = "0.25rem 0";
  header.innerHTML = `
        <div class="container-fluid">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-camera-video-fill" style="font-size: 1.5rem;"></i>
                    <div style="line-height: 1.2;">
                        <h1 class="mb-0" style="font-size: 1rem; font-weight: 600;">
                            DustCam
                        </h1>
                        <small style="font-size:10px;" class="opacity-75">Sistema de detección y monitoreo de polvo</small>
                    </div>
                </div>
            </div>
        </div>
    `;
  root2.appendChild(header);
  const main = document.createElement("main");
  main.classList.add("container", "py-2");
  root2.appendChild(main);
  const alertInfo = document.createElement("div");
  alertInfo.classList.add("d-flex", "align-items-center");
  alertInfo.innerHTML = `
        <div class="mb-2 p-2">
            Seleccione una cámara de la lista para iniciar la aplicación.
        </div>
    `;
  main.appendChild(alertInfo);
  const cardContainer = document.createElement("div");
  cardContainer.classList.add("row", "row-cols-1", "row-cols-md-2", "row-cols-lg-3", "g-4", "mb-4");
  main.appendChild(cardContainer);
  let selectedCard = null;
  let selectedCamera = null;
  camAvailable.forEach((camara, index) => {
    var _a2;
    const colDiv = document.createElement("div");
    colDiv.classList.add("col");
    const card = document.createElement("div");
    card.style.userSelect = "none";
    card.classList.add("card", "h-100", "shadow-sm", "border-2");
    card.style.cursor = "pointer";
    card.style.transition = "all 0.3s ease";
    card.dataset.camera = camara;
    const camara_human = ((_a2 = root2.getAttribute("cam-availables-human")) == null ? void 0 : _a2.split(" ")[index]) || camara;
    card.innerHTML = `
            <div class="card-body text-center py-4">
                <div class="mb-1">
                    <i class="bi bi-camera-video-fill text-primary" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold mb-2">${camara_human.split("_").join(" ")}</h5>
            </div>
        `;
    card.addEventListener("click", () => {
      if (selectedCard && selectedCard !== card) {
        selectedCard.classList.remove("border-primary", "border-3", "bg-primary", "bg-opacity-10");
        selectedCard.classList.add("border-2");
      }
      selectedCard = card;
      selectedCamera = camara;
      card.classList.remove("border-3");
      card.classList.add("border-primary", "bg-primary", "bg-opacity-10");
    });
    colDiv.appendChild(card);
    cardContainer.appendChild(colDiv);
  });
  const controlSection = document.createElement("div");
  controlSection.classList.add("card", "border-0");
  controlSection.innerHTML = `
        <div class="card-body p-2">
            <button id="start-app-btn" class="btn btn-primary fw-semibold">
                <i class="bi bi-play-fill me-2"></i>
                INICIAR APLICACIÓN
            </button>
        </div>
    `;
  main.appendChild(controlSection);
  const startAppBtn = document.getElementById("start-app-btn");
  startAppBtn.addEventListener("click", async () => {
    var _a2;
    if (!selectedCamera) {
      const errorAlert = document.createElement("div");
      errorAlert.classList.add("alert", "alert-info", "alert-dismissible", "fade", "show", "mt-3");
      errorAlert.innerHTML = `
                Por favor, seleccione una cámara para iniciar la aplicación.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
      controlSection.after(errorAlert);
      setTimeout(() => errorAlert.remove(), 1300);
      return;
    }
    startAppBtn.disabled = true;
    main.innerHTML = "";
    main.classList.remove("container", "py-2");
    const appsContainer = document.createElement("div");
    appsContainer.classList.add("container-fluid");
    main.appendChild(appsContainer);
    const headerHeight = header.offsetHeight;
    appsContainer.style.height = `calc(99vh - ${headerHeight}px)`;
    appsContainer.style.overflow = "auto";
    const start = root2.getAttribute("start-utc");
    const end = root2.getAttribute("end-utc");
    const useUTC = root2.getAttribute("use-utc") === "true";
    const debug = root2.getAttribute("debug") === "true";
    const camara_human = ((_a2 = root2.getAttribute("cam-availables-human")) == null ? void 0 : _a2.split(" ")[camAvailable.indexOf(selectedCamera)]) || selectedCamera;
    header.querySelector("h1").textContent = camara_human ? `DustCam - ${camara_human.split("_").join(" ")}` : "DustCam";
    const backBtn = document.createElement("button");
    backBtn.style.fontSize = "0.7rem";
    backBtn.classList.add("btn", "btn-outline-secondary", "btn-sm", "ms-3");
    backBtn.innerHTML = `<i class="bi bi-arrow-left"></i> Volver`;
    backBtn.addEventListener("click", () => {
      window.location.reload();
    });
    header.querySelector(".d-flex.justify-content-between").appendChild(backBtn);
    App(selectedCamera, start, end, useUTC, debug, appsContainer);
  });
}
window.CamView = CamView;
window.App = App;
window.WrapperApp = WrapperApp;
const root = document.getElementById("root-app");
if (root == null ? void 0 : root.classList.contains("cam-view")) {
  const camara = root.getAttribute("camara");
  const start = root.getAttribute("start-utc");
  const end = root.getAttribute("end-utc");
  const useUTC = root.getAttribute("use-utc") === "true";
  const debug = root.getAttribute("debug") === "true";
  App(camara, start, end, useUTC, debug, root).catch((error) => {
    console.error("Error starting app:", error);
    root.innerHTML = error;
  });
}
if (root == null ? void 0 : root.classList.contains("wrapper")) {
  WrapperApp(root).catch((error) => {
    console.error("Error starting wrapper app:", error);
    root.innerHTML = error;
  });
}
