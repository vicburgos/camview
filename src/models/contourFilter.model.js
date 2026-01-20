// Modelo de configuración compartida para filtros de canvas

export class ContourFilterConfig {
    constructor() {
        this.alpha = 0.8;
        this.levels = 8;
        this.minLevel = 25;  // 0-100 escala
        this.maxLevel = 100; // 0-100 escala
        this.colorMapId = 1;
        this.blur = 2;
        this.downSampleContourLineFilter = 2;
        this.downSampleContourFaceFilter = 1;
        this.lineWidth = 2; // Solo para ContourLineFilter
    }
}
