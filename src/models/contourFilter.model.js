// Modelo de configuración compartida para filtros de canvas

export class ContourFilterConfig {
    constructor() {
        this._alpha = 0.8;
        this._levels = 8;
        this._minLevel = 25;  // 0-100 escala
        this._maxLevel = 100; // 0-100 escala
        this.colorMapId = 1;
        this.blur = 2;
        this.downSampleContourLineFilter = 3;
        this.downSampleContourFaceFilter = 1;
        this.lineWidth = 1; // Solo para ContourLineFilter
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
