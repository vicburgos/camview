import VideoMSE from "./VideoMSE.js";

export class ColorOverlay {
  constructor(initialOptions = {}) {
    this.container = STATE.elements.canvasContainer;
    
    // Extract VideoMSE config from STATE
    if (!STATE.videoMSEConfig) {
      throw new Error('VideoMSE config not found in STATE. Initialize VideoController first.');
    }
    this.videoMSEConfig = STATE.videoMSEConfig;
    
    // Default options merged with initial options
    this.options = {
      alpha: 0.5,
      borderOption: true,
      thresholds: [20, 60, 80, 100, 120, 140, 160],
      minLevel: 20,
      maxLevel: 255,
      colorMapId: 1,
      downsample: 3,
      blur: 1,
      ...initialOptions
    };
    
    // Generate thresholds based on levels if provided
    if (initialOptions.levels !== undefined) {
      const step = (this.options.maxLevel - this.options.minLevel) / initialOptions.levels;
      this.options.thresholds = [];
      for (let i = 0; i < initialOptions.levels; i++) {
        this.options.thresholds.push(Math.round(this.options.minLevel + i * step));
      }
    }
    
    this.colormap4 = [];
    this.setupColorMaps();
    this.updateColormap();
    this.createElements();
    this.initializeVideo();
    this.setupRendering();
  }

  updateDownsample() {   
    // Get canvas dimensions
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    
    // Calculate downsampled dimensions
    this.w = Math.floor(width / this.options.downsample);
    this.h = Math.floor(height / this.options.downsample);
    
    // Update d3 contour generator
    this.generateContour = d3.contours()
      .size([this.w, this.h])
      .thresholds(this.options.thresholds);
  }

  setupColorMaps() {
    const { interpolateSpectral, interpolateTurbo, interpolateRdYlGn, interpolateRainbow } = d3;
    
    this.colorsMap = {
      1: {
        interpolate: (t) => {
          const rgbString = interpolateSpectral((1 - t));
          const rgb = rgbString.match(/\d+/g);
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
        },
        name: "Spectral"
      },
      2: {
        interpolate: (t) => {
          const rgbString = interpolateTurbo(t);
          const rgb = rgbString.match(/\d+/g);
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
        },
        name: "Turbo"
      },
      3: {
        interpolate: (t) => {
          const color = interpolateRdYlGn(1-(0.1 + 0.9*t));
          const rgb = color.match(/\d+/g);
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
        },
        name: "Green to Red"
      },
      4: {
        interpolate: (t) => {
          const color = interpolateRainbow(1-(0.1 + 0.9*t));
          const rgb = color.match(/\d+/g);
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`;
        },
        name: "Rainbow"
      },
    };
    
    this.updateColormap();
  }

  hexToRgb(hex) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
  }

  updateColormap() {
    this.colormap4 = [];
    const thresholds = this.options.thresholds;
    const colorMap = this.colorsMap[this.options.colorMapId];
    
    for (let i = 0; i < 256; i++) {
      let idx = thresholds.findIndex(t => i < t) - 1;
      if (idx < 0) idx = thresholds.length - 2;
      if (idx >= thresholds.length - 1) idx = thresholds.length - 2;
      
      const t0 = thresholds[idx];
      let tNorm = (t0 - thresholds[0]) / (thresholds[thresholds.length - 1] - thresholds[0]);
      const color = colorMap.interpolate(tNorm);
      
      const rgbMatch = color.match(/\d+/g);
      const r = parseInt(rgbMatch[0]);
      const g = parseInt(rgbMatch[1]);
      const b = parseInt(rgbMatch[2]);
      const a = parseInt(rgbMatch[3]);
      
      if (i < thresholds[0]) {
        this.colormap4.push([r, g, b, 0]);
      } else {
        this.colormap4.push([r, g, b, Math.floor(a * 255)]);
      }
    }
  }

  createElements() {
    // Canvas overlay
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute('data-overlay', 'true');
    Object.assign(this.canvas.style, {
      position: "absolute",
      pointerEvents: "none",
      maxWidth: "100%",
      maxHeight: "100%",
      display: "block",
    });
    
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  initializeVideo() {
    // Create grayscale video using the same config as main video, but with type="gs"
    const gsConfig = {
      ...this.videoMSEConfig,
      type: "gs"
    };
    
    this.videoMSE = new VideoMSE(gsConfig);
    this.video = this.videoMSE.video;
    this.video.style.display = "none";
    this.container.appendChild(this.video);
    
    // // Add loading events to show spinner
    // const showSpinner = () => {
    //   if (STATE.elements.spinner) {
    //     STATE.elements.spinner.style.display = 'flex';
    //   }
    // };
    
    // const hideSpinner = () => {
    //   if (STATE.elements.spinner) {
    //     STATE.elements.spinner.style.display = 'none';
    //   }
    // };
    
    // this.video.addEventListener('waiting', showSpinner);
    // this.video.addEventListener('seeking', showSpinner);
    // this.video.addEventListener('canplay', hideSpinner);
    // this.video.addEventListener('playing', hideSpinner);
  }

  setupRendering() {
    const dpr = window.devicePixelRatio || 1;
    
    const resizeCanvas = () => {
      // Get the main canvas from the container
      const mainCanvas = this.container.querySelector('canvas:not([data-overlay])');
      if (!mainCanvas) return;
      
      // Match main canvas dimensions exactly
      const mainRect = mainCanvas.getBoundingClientRect();
      const displayWidth = mainRect.width;
      const displayHeight = mainRect.height;
      
      this.canvas.width = displayWidth * dpr;
      this.canvas.height = displayHeight * dpr;
      this.canvas.style.width = `${displayWidth}px`;
      this.canvas.style.height = `${displayHeight}px`;
      
      // Position overlay canvas exactly on top of main canvas
      const containerRect = this.container.getBoundingClientRect();
      const canvasLeft = mainRect.left - containerRect.left;
      const canvasTop = mainRect.top - containerRect.top;
      
      this.canvas.style.left = `${canvasLeft}px`;
      this.canvas.style.top = `${canvasTop}px`;
      
      // Reset transform and apply scale
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      
      // Update downsample dimensions after canvas is sized
      this.updateDownsample();
    };

    const renderFrame = () => {
      if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
        const displayWidth = this.canvas.width / dpr;
        const displayHeight = this.canvas.height / dpr;
        
        this.ctx.clearRect(0, 0, displayWidth, displayHeight);
        this.processFrame(displayWidth, displayHeight, dpr);
      }
      requestAnimationFrame(renderFrame);
    };

    resizeCanvas();
    
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(this.container);
    
    renderFrame();
  }

  processFrame(width, height, dpr) {
    if (!this.video || this.video.readyState < 2) return;
    
    // Clear main canvas
    this.ctx.clearRect(0, 0, width, height);
    
    if (!this.options.borderOption) {
      // Mode 1: Direct pixel coloring (no borders) - sin downsample
      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = height;
      const offCtx = offCanvas.getContext('2d');
      
      // Apply blur filter
      offCtx.filter = `blur(${this.options.blur}px)`;
      
      // Draw video at full resolution
      offCtx.drawImage(this.video, 0, 0, width, height);
      const imageData = offCtx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const grayscale = data[i]; // Use red channel
        const [r, g, b, a] = this.colormap4[grayscale];
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
      offCtx.putImageData(imageData, 0, 0);
      
      // Draw scaled up with alpha
      this.ctx.globalAlpha = this.options.alpha;
      this.ctx.drawImage(offCanvas, 0, 0, width, height);
      this.ctx.globalAlpha = 1;
    } else {
      // Mode 2: D3 contours with borders - con downsample
      const offCanvas = document.createElement('canvas');
      offCanvas.width = this.w;
      offCanvas.height = this.h;
      const offCtx = offCanvas.getContext('2d');
      
      // Apply blur filter
      offCtx.filter = `blur(${this.options.blur}px)`;
      
      // Draw video at downsampled resolution
      offCtx.drawImage(this.video, 0, 0, this.w, this.h);
      const imageData = offCtx.getImageData(0, 0, this.w, this.h);
      const data = imageData.data;
      
      // Extract blue channel (or red for grayscale)
      const blue = new Uint8Array((data.length / 4) | 0);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        blue[j] = data[i]; // Using red channel as grayscale
      }
      
      // Generate contours
      const contourData = this.generateContour(blue);
      
      // Save context state
      this.ctx.save();
      
      // Scale up from downsampled size to match canvas display size
      const scaleX = width / this.w;
      const scaleY = height / this.h;
      this.ctx.scale(scaleX, scaleY);
      
      // Draw contours
      contourData.forEach(c => {
        const tNorm = (c.value - this.options.thresholds[0]) / 
                      (this.options.thresholds[this.options.thresholds.length - 1] - this.options.thresholds[0]);
        const color = this.colorsMap[this.options.colorMapId].interpolate(tNorm);
        
        // lineWidth como funcion de downsample
        this.ctx.lineWidth = 0.7;
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = this.options.alpha;
        
        this.ctx.beginPath();
        c.coordinates.forEach(poly => {
          poly.forEach(ring => {
            ring.forEach(([x, y], idx) => {
              if (idx === 0) {
                this.ctx.moveTo(x, y);
              } else {
                this.ctx.lineTo(x, y);
              }
            });
          });
        });
        this.ctx.closePath();
        
        // Stroke for borders, fill for no borders
        this.ctx.stroke();
      });
      
      // Restore context state
      this.ctx.restore();
    }
  }

  // Public API
  setAlpha(alpha) {
    this.options.alpha = alpha;
  }

  setBorderOption(enabled) {
    this.options.borderOption = enabled;
    this.updateDownsample();
  }

  setLevels(count) {
    const min = this.options.minLevel;
    const max = this.options.maxLevel;
    const step = (max - min) / count;
    
    this.options.thresholds = [];
    for (let i = 0; i < count; i++) {
      this.options.thresholds.push(Math.floor(min + i * step));
    }
    
    this.updateColormap();
    this.updateDownsample();
  }

  setMinLevel(value) {
    this.options.minLevel = value;
    this.setLevels(this.options.thresholds.length);
  }

  setMaxLevel(value) {
    this.options.maxLevel = value;
    this.setLevels(this.options.thresholds.length);
  }

  setColorMap(id) {
    this.options.colorMapId = id;
    this.updateColormap();
  }

  syncWithVideo(video) {
    this.mainVideo = video;
    let isSeeking = false;
    let isWaitingForBoth = false;
    let seekTimeout = null;
    
    // Sync playback
    video.addEventListener('play', () => {
      if (!isWaitingForBoth) {
        this.video.play().catch(() => {});
      }
    });
    
    video.addEventListener('pause', () => {
      this.video.pause();
    });
    
    // Sync playback rate
    video.addEventListener('ratechange', () => {
      this.video.playbackRate = video.playbackRate;
    });
    
    // Initial playback rate sync
    this.video.playbackRate = video.playbackRate;
    
    // Handle seeking - wait for both videos to be ready
    video.addEventListener('seeking', () => {
      isSeeking = true;
      isWaitingForBoth = true;
      this.video.currentTime = video.currentTime;
      
      // Clear any existing timeout
      if (seekTimeout) {
        clearTimeout(seekTimeout);
      }
      
     
      // Safety timeout: if videos don't sync within 3 seconds, force continue
      seekTimeout = setTimeout(() => {
        if (isWaitingForBoth) {
          console.warn('Overlay video seek timeout - forcing sync');
          isWaitingForBoth = false;
          isSeeking = false;
          mainVideoReady = false;
          overlayVideoReady = false;
          
          // Force overlay to current main video time
          this.video.currentTime = video.currentTime;
                   
          // Resume playback if main video is playing
          if (!video.paused) {
            this.video.play().catch(() => {});
          }
        }
      }, 3000);
    });
    
    // Track when each video is ready after seek
    let mainVideoReady = false;
    let overlayVideoReady = false;
    
    const checkBothReady = () => {
      if (mainVideoReady && overlayVideoReady && isWaitingForBoth) {
        isWaitingForBoth = false;
        isSeeking = false;
        mainVideoReady = false;
        overlayVideoReady = false;
        
        // Clear timeout since we completed successfully
        if (seekTimeout) {
          clearTimeout(seekTimeout);
          seekTimeout = null;
        }
        
        // Resume playback if main video is playing
        if (!video.paused) {
          this.video.play().catch(() => {});
        }
      }
    };
    
    video.addEventListener('seeked', () => {
      mainVideoReady = true;
      checkBothReady();
    });
    
    this.video.addEventListener('seeked', () => {
      overlayVideoReady = true;
      checkBothReady();
    });
    
    // Enhanced continuous sync during playback and after seeks
    const syncInterval = setInterval(() => {
      const timeDiff = Math.abs(this.video.currentTime - video.currentTime);
      
      // If there's a significant time difference, resync
      if (!isSeeking && timeDiff > 0.2) {
        this.video.currentTime = video.currentTime;
      }
      
      // Also check if overlay video is stuck (not progressing)
      if (!video.paused && !isSeeking) {
        if (timeDiff > 0.5) {
          // Force hard resync if overlay is too far behind
          console.log('Forcing overlay resync, diff:', timeDiff);
          this.video.currentTime = video.currentTime;
          if (!this.video.paused) {
            this.video.play().catch(() => {});
          }
        }
      }
    }, 100);
    
    // Cleanup
    this.syncInterval = syncInterval;
  }

  show() {
    this.canvas.style.display = 'block';
  }

  hide() {
    this.canvas.style.display = 'none';
  }

  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}
