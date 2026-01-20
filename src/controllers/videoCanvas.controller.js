// VideoCanvasController - Renderiza videos en canvas con filtros opcionales
// Fondo: videosMSEList[0], Overlay/filtros: videosMSEList[1]

import { ContourFilterConfig } from "../models/contourFilter.model.js";

export class VideoCanvasController {
    constructor(videosMSEList) {
        if (!videosMSEList || videosMSEList.length < 2) {
            throw new Error('VideoCanvasController requires at least 2 videos (base + grayscale)');
        }
        
        this.videosMSEList = videosMSEList;
        this.canvas = null;
        this.ctx = null;
        
        // Configuracion compartida para filtros
        this.config = new ContourFilterConfig();
        
        // Thresholds calculados dinámicamente (0-255 escala interna)
        this.thresholds = [];
        this.updateThresholds();
        
        // Canvas temporales reutilizables (uno por filtro)
        this.offCanvasLine = null;
        this.offCtxLine = null;
        this.offCanvasFace = null;
        this.offCtxFace = null;
        
        // Filtros disponibles
        this.baseFilter = new BaseFilter(this.videosMSEList);
        this.contourLineFilter = new ContourLineFilter(this);
        this.contourFaceFilter = new ContourFaceFilter(this);
        
        // Filtro activo (por defecto: baseFilter)
        this.activeFilter = this.baseFilter;
        
        this.init();
    }
    
    init() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
               
        canvas.width = 1920*0.75;
        canvas.height = 1080*0.75;

        this.canvas = canvas;
        this.ctx = ctx;
    }
    
    // Renderizar frame actual
    render() {
        try {
            // const baseVideo = this.videosMSEList[0].video;
            // if (baseVideo.readyState < baseVideo.HAVE_CURRENT_DATA) {
            //     return;
            // }
            
            // Delegar rendering al filtro activo
            this.activeFilter.apply(this.ctx, this.canvas);
        } catch (error) {
            console.error('Error in canvas render:', error);
        }
    }
    
    // Obtener canvas para agregar al DOM
    getCanvas() {
        return this.canvas;
    }
    
    // Activar/desactivar filtros
    setFilter(filter) {
        this.activeFilter = filter;
        return this;
    }
    
    clearFilter() {
        this.activeFilter = null;
        return this;
    }
    
    // ===== CALCULO DE THRESHOLDS =====
    
    updateThresholds() {
        // Convertir de escala 0-100 a 0-255
        const minLevel255 = Math.floor((this.config.minLevel / 100) * 255);
        const maxLevel255 = Math.floor((this.config.maxLevel / 100) * 255);
        
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
        // Actualizar colormap del filtro de contorno facial
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
        // Actualizar colormap del filtro de contorno facial
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

// ========== FILTRO BASE (SOLO VIDEO DE FONDO) ==========
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

// ========== FILTRO DE CONTORNOS CON D3 ==========
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
        
        // Dibujar video base primero
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseVideo, 0, 0, canvas.width, canvas.height);

        // Si el video secundario no esta listo, no dibujar contornos
        if (videoGS.onPlaceholder()) return;
        // if (videoGS.video.readyState < videoGS.video.HAVE_CURRENT_DATA) return;
        
        const { width, height } = canvas;
        const { downSampleContourLineFilter, blur, alpha, lineWidth, colorMapId } = this.controller.config;
        const thresholds = this.controller.thresholds;
        
        // Dimensiones con downsample
        const w = Math.floor(width / downSampleContourLineFilter);
        const h = Math.floor(height / downSampleContourLineFilter);
        
        // Crear o reutilizar canvas temporal
        if (!this.controller.offCanvasLine || this.controller.offCanvasLine.width !== w || this.controller.offCanvasLine.height !== h) {
            this.controller.offCanvasLine = document.createElement('canvas');
            this.controller.offCanvasLine.width = w;
            this.controller.offCanvasLine.height = h;
            this.controller.offCtxLine = this.controller.offCanvasLine.getContext('2d', { willReadFrequently: true });
        }
        
        const offCtx = this.controller.offCtxLine;
        
        // Limpiar y dibujar
        offCtx.clearRect(0, 0, w, h);
        offCtx.filter = `blur(${blur}px)`;
        offCtx.drawImage(videoGS.video, 0, 0, w, h);
        
        // Extraer datos de grayscale
        const imageData = offCtx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const grayData = new Uint8Array((data.length / 4) | 0);
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            grayData[j] = data[i];
        }
        
        // Generar y dibujar contornos
        const contourGen = d3.contours().size([w, h]).thresholds(thresholds);
        const contours = contourGen(grayData);
        
        ctx.save();
        ctx.scale(width / w, height / h);
        
        contours.forEach(c => {
            const tNorm = (c.value - thresholds[0]) / (thresholds[thresholds.length - 1] - thresholds[0]);
            const color = this.colorMaps[colorMapId](tNorm);
            
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            
            ctx.beginPath();
            c.coordinates.forEach(poly => {
                poly.forEach(ring => {
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

// ========== FILTRO DE CONTORNO DE CARAS SIN D3 ==========
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
            let idx = thresholds.findIndex(t => i < t) - 1;
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
        
        // Dibujar video base primero
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseVideo, 0, 0, canvas.width, canvas.height);

        // Si el video secundario no esta listo, no dibujar contornos
        if (videoGS.onPlaceholder()) return;
        // if (videoGS.video.readyState < videoGS.video.HAVE_CURRENT_DATA) return;
        
        const { width, height } = canvas;
        const { blur, alpha, downSampleContourFaceFilter } = this.controller.config;
        
        // Dimensiones con downsample
        const w = Math.floor(width / downSampleContourFaceFilter);
        const h = Math.floor(height / downSampleContourFaceFilter);
        
        // Crear o reutilizar canvas temporal
        if (!this.controller.offCanvasFace || this.controller.offCanvasFace.width !== w || this.controller.offCanvasFace.height !== h) {
            this.controller.offCanvasFace = document.createElement('canvas');
            this.controller.offCanvasFace.width = w;
            this.controller.offCanvasFace.height = h;
            this.controller.offCtxFace = this.controller.offCanvasFace.getContext('2d', { willReadFrequently: true });
        }
        
        const offCtx = this.controller.offCtxFace;
        
        // Limpiar y dibujar
        offCtx.clearRect(0, 0, w, h);
        offCtx.filter = `blur(${blur}px)`;
        offCtx.drawImage(videoGS.video, 0, 0, w, h);
        
        // Aplicar colormap
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
        
        // Dibujar escalado al tamaño original con alpha global
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.controller.offCanvasFace, 0, 0, width, height);
        ctx.globalAlpha = 1;
    }
}
