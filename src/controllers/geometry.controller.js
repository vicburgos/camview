import { GeometryModel } from '../models/geometry.model.js';
import { fetchSeries } from '../services/fetch.service.js';

export class GeometryController {
    constructor(config) {
        this.config = config;
        this.model = new GeometryModel();
        this.chartController = null;
        this.isFetching = false;
    }

    setChartController(chartController) {
        this.chartController = chartController;
    }

    async addPoint(x, y, color = '#ff0000', precalculatedData = null) {
        console.log("Add point", x, y);
        if (this.isFetching) {
            console.log('Ya hay una carga en progreso, ignorando solicitud');
            return null;
        }

        this.isFetching = true;
        
        try {
            // Limpiar todas las geometrías existentes (solo se permite una a la vez)
            const existingGeometries = this.model.getAllGeometries();
            for (const existingGeometry of existingGeometries) {
                // Remover del chart primero
                if (this.chartController) {
                    this.chartController.removeSeries(existingGeometry.id);
                }
            }
            // Limpiar el modelo
            this.model.clear();
            
            // Clamping para asegurar valores entre 0 y 1
            x = Math.max(0, Math.min(1, x));
            y = Math.max(0, Math.min(1, y));

            const geometry = this.model.addPoint(x, y, color);
            
            // Si hay datos precalculados, usarlos directamente
            if (precalculatedData && precalculatedData.length > 0) {
                this.model.setSeries(geometry.id, precalculatedData);
                
                // Actualizar chart directamente
                if (this.chartController) {
                    this.updateChartSeries(geometry);
                }
            } else {
                // Marcar como pendiente el fetch
                geometry.fetchPending = true;
                
                // Fetch series data
                await this.fetchSeriesForGeometry(geometry);
                
                // Marcar como completado
                geometry.fetchPending = false;
            }
            
            return geometry;
        } finally {
            this.isFetching = false;
        }
    }

    async fetchSeriesForGeometry(geometry) {
        try {
            // Verificar que la geometría aún existe antes de hacer fetch
            if (!this.model.getGeometry(geometry.id)) {
                return;
            }
            
            // Mostrar loading en el chart
            if (this.chartController && this.chartController.chart) {
                this.chartController.chart.showLoading('Cargando datos...');
            }
            
            const { x, y } = geometry;
            const camara = this.config.camara;
            const start = new Date(this.config.firstUnixtime);
            const end = new Date(this.config.endUnixtime);

            const seriesData = await fetchSeries(camara, x, y, start, end);
            
            // Verificar nuevamente que la geometría aún existe después del fetch
            if (!this.model.getGeometry(geometry.id)) {
                return;
            }
            
            if (seriesData && seriesData.data) {
                // Filtrar datos entre firstUnixtime y endUnixtime
                const filteredData = seriesData.data.filter(point => {
                    const time = point[0];
                    return time >= this.config.firstUnixtime && time <= this.config.endUnixtime;
                });
                
                // Almacenar en el modelo
                this.model.setSeries(geometry.id, filteredData);
                
                // Actualizar chart si existe y la geometría aún existe
                if (this.chartController && filteredData.length > 0 && this.model.getGeometry(geometry.id)) {
                    this.updateChartSeries(geometry);
                }
            }
        } catch (error) {
            console.error('Error fetching series for geometry:', error);
        } finally {
            // Ocultar loading en el chart
            if (this.chartController && this.chartController.chart) {
                this.chartController.chart.hideLoading();
            }
        }
    }

    updateChartSeries(geometry) {
        if (!this.chartController || !geometry.series) return;

        // Los datos ya están en formato Highcharts [time, value]
        const data = geometry.series;
        
        this.chartController.addOrUpdateSeries(
            geometry.id,
            data,
            geometry.visible,
            geometry.color
        );
    }

    updatePoint(id, x, y) {
        // Remover del chart
        if (this.chartController) {
            this.chartController.removeSeries(id);
        }
        const geometry = this.model.getGeometry(id);
        if (!geometry) return;
        
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        
        // Calcular distancia con posición anterior
        const dx = Math.abs(geometry.x - x);
        const dy = Math.abs(geometry.y - y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Solo actualizar si la distancia es significativa (más de 0.5% del tamaño)
        if (distance < 0.005) {
            return;
        }
        
        this.model.updatePoint(id, x, y);
        
        // Re-fetch series con nueva posición
        this.fetchSeriesForGeometry(geometry);
    }

    removeGeometry(id) {
        // Remover del chart
        if (this.chartController) {
            this.chartController.removeSeries(id);
        }
        
        this.model.removeGeometry(id);
    }

    clearAll() {
        // Remover todas las series del chart
        if (this.chartController) {
            this.model.getAllGeometries().forEach(geometry => {
                this.chartController.removeSeries(geometry.id);
            });
        }
        
        this.model.clear();
    }

    getModel() {
        return this.model;
    }
}
