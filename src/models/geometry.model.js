export class GeometryModel {
    constructor() {
        this.geometries = new Map(); // id -> geometry
        this.nextId = 1;
        this.listeners = [];
    }

    addPoint(x, y, color = '#770000') {
        const id = `point_${this.nextId++}`;
        const geometry = {
            id,
            type: 'point',
            x,
            y,
            color,
            visible: true,
            series: null, // Para almacenar datos de serie
        };
        this.geometries.set(id, geometry);
        this.notifyListeners('add', geometry);
        return geometry;
    }

    updatePoint(id, x, y) {
        const geometry = this.geometries.get(id);
        if (geometry && geometry.type === 'point') {
            geometry.x = x;
            geometry.y = y;
            this.notifyListeners('update', geometry);
        }
    }

    removeGeometry(id) {
        const geometry = this.geometries.get(id);
        if (geometry) {
            this.geometries.delete(id);
            this.notifyListeners('remove', geometry);
        }
    }

    getGeometry(id) {
        return this.geometries.get(id);
    }

    getAllGeometries() {
        return Array.from(this.geometries.values());
    }

    getPoints() {
        return this.getAllGeometries().filter(g => g.type === 'point');
    }

    setSeries(id, seriesData) {
        const geometry = this.geometries.get(id);
        if (geometry) {
            geometry.series = seriesData;
            this.notifyListeners('series-update', geometry);
        }
    }

    clear() {
        this.geometries.clear();
        this.notifyListeners('clear', null);
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(event, geometry) {
        this.listeners.forEach(listener => listener(event, geometry));
    }
}
