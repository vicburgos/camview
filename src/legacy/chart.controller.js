export class ChartController {

    static generateDayPlotBands(start, end) {
        const plotBands = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        // Normalizar startDate al inicio del día (00:00:00) en UTC
        startDate.setUTCHours(0, 0, 0, 0);
        let currentDate = new Date(startDate);
        let isFisrtColor = true; // Alternar entre gris y blanco
        while (currentDate < endDate) {
            const dayStart = currentDate.getTime();
            const nextDay = new Date(currentDate);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            const dayEnd = Math.min(nextDay.getTime(), endDate.getTime());

            plotBands.push({
                from: dayStart,
                to: dayEnd,
                color: isFisrtColor ? 'rgb(255, 251, 202)' : 'rgb(203, 249, 222)',
                zIndex: 0
            });

            currentDate = nextDay;
            isFisrtColor = !isFisrtColor; // Alternar color
        }
        return plotBands;
    }

    static initialize(CONFIG) {
        const start = new Date(CONFIG.firstUnixtime);
        const end = new Date(CONFIG.endUnixtime);
        const zoom = {
            start: new Date(CONFIG.endUnixtime - 9 * 60 * 60 * 1000),
            end: end
        }

        // Generar plotBands para alternar colores por día en el navigator
        const plotBands = this.generateDayPlotBands(start, end);

        Highcharts.setOptions({
            time: { useUTC: CONFIG.useUTC },
            // reducir font
            chart: {
                style: {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '14px'
                },
                // animation: false
            }
        });

        const buttons = [
            { type: 'all', text: 'All' },
            // { type: 'hour', count: 3, text: '3h' },
            // { type: 'hour', count: 6, text: '6h' },
            { type: 'hour', count: 10, text: '1d' }
        ];
        const ONE_DAY = 24 * 60 * 60 * 1000;

        const chart = Highcharts.stockChart("chart", {
            boost: { seriesThreshold: 1, useGPUTranslations: true },
            rangeSelector: {
                inputEnabled: true,
                buttons: buttons,
                buttonTheme: { width: 28 }
            },
            exporting: {
                enabled: false, // Mantenemos el menú de exportación
            },
            xAxis: {
                type: "datetime",
                opposite: true,
                tickColor: 'grey',
                lineColor: 'rgba(0, 0, 0, 0.5)',
                min: start.getTime(),
                max: end.getTime(),
                plotBands: plotBands,
            },
            yAxis: {
                min: 0,
                max: 101,
                lineColor: 'rgba(0, 0, 0, 0.5)',
                tickColor: 'grey',
                tickInterval: 25,
                gridLineColor: 'rgba(0, 0, 0, 0.25)',
                gridLineWidth: 1,
            },
            plotOptions: {
                series: {
                    marker: { enabled: false },
                    animation: false,
                    enableMouseTracking: false,
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
                height: 25, // Aumentar para que se vean las etiquetas
                xAxis: {
                    plotBands: plotBands,
                    labels: {
                        enabled: true,
                        formatter: function () {
                            // Encontrar el plotBand que contiene este tick
                            const tickValue = this.value;
                            const band = plotBands.find(b => tickValue >= b.from && tickValue <= b.to);

                            if (band) {
                                // Calcular el centro del plotBand
                                const bandCenter = (band.from + band.to) / 2;
                                const tolerance = (band.to - band.from) * 0.1; // 10% de tolerancia

                                // Solo mostrar label si estamos cerca del centro
                                if (Math.abs(tickValue - bandCenter) < tolerance) {
                                    const date = new Date(tickValue);
                                    return Highcharts.dateFormat('%d %b', date);
                                }
                            }
                            return null; // No mostrar label si no está en el centro
                        },
                        style: {
                            fontSize: '12px'
                        }
                    },
                    tickPositioner: function () {
                        // Generar ticks en el centro de cada plotBand
                        const positions = plotBands.map(band => (band.from + band.to) / 2);
                        return positions;
                    }
                },
                yAxis: {
                    min: 0,
                    max: 101
                },
                series: {
                    boostThreshold: 1,
                    type: 'line',
                    dataGrouping: {
                        enabled: true,
                        groupPixelWidth: 1,
                        smoothed: true
                    }
                }
            },
            scrollbar: {
                height: 1,
                // liveRedraw:false,
            },
            series: [],
            tooltip: {
                enabled: false,
                // // no mostrar el valor de y
                // pointFormat: '',
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

        chart.xAxis[0].setExtremes(
            zoom.start.getTime(), zoom.end.getTime()
        );

        this.updateCursor(0);
        this.setupInteraction(CONFIG);


        return chart;
    }

    static updateCursor(currentTime) {
        const chart = STATE.chart;
        if (!chart) return;

        const currentTimeIndex = Math.floor(currentTime * CONFIG.fps);
        const value = CONFIG.videotimeToUnixtime[currentTimeIndex]
        STATE.setCursorValue(value);

        const colorCursor = "dodgerblue";
        const optionsCursor = {
            value,
            color: colorCursor,
            width: 3,
            zIndex: 5,
        }
        chart.xAxis[0].removePlotLine("cursor");
        chart.xAxis[0].addPlotLine({
            id: "cursor",
            ...optionsCursor
        });

        // Agregar también al navigator
        if (chart.xAxis[1]) {
            chart.xAxis[1].removePlotLine("cursor-nav");
            chart.xAxis[1].addPlotLine({
                id: "cursor-nav",
                ...optionsCursor
            });
        }
    }

    static setupInteraction(CONFIG) {
        let startX = 0;
        let startY = 0;
        let isDragging = false;
        const DRAG_THRESHOLD = 4;

        const wrapper = STATE.elements.wrapperChart;

        wrapper.addEventListener("pointerdown", e => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            startX = e.clientX;
            startY = e.clientY;
            isDragging = false;
        });

        wrapper.addEventListener("pointermove", e => {
            if (
                Math.abs(e.clientX - startX) > DRAG_THRESHOLD ||
                Math.abs(e.clientY - startY) > DRAG_THRESHOLD
            ) {
                isDragging = true;
            }
        });

        wrapper.addEventListener("pointerup", e => {
            if (isDragging) return;

            // Verificar que el click sea dentro del área del gráfico
            const chart = STATE.chart;
            const plotArea = chart.plotBox;
            const rect = wrapper.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            // Verificar que el click esté dentro del área de ploteo
            if (
                clickX < plotArea.x ||
                clickX > plotArea.x + plotArea.width ||
                clickY < plotArea.y ||
                clickY > plotArea.y + plotArea.height
            ) {
                return;
            }

            const video = STATE.video;
            const xAxis = chart.xAxis[0];
            const xValue = xAxis.toValue(clickX);

            //Buscar index basado en el primer indice CONFIG.firstUnixtime
            // y el ultimo CONFIG.endUnixtime
            // Clamp antes
            if (xValue < CONFIG.firstUnixtime) {
                xValue = CONFIG.firstUnixtime;
            }
            if (xValue > CONFIG.endUnixtime) {
                xValue = CONFIG.endUnixtime;
            }
            const xValueIndex = Math.floor(
                (xValue - CONFIG.firstUnixtime) / CONFIG.timestep
            );
            const currentTime = CONFIG.unixtimeToVideotime[xValueIndex];

            this.updateCursor(currentTime);
            video.currentTime = currentTime;
        });
    }

    static centerNavigatorAtCursor() {
        const chart = STATE.chart;
        if (!chart) return;

        const xAxis = chart.xAxis[0];
        const cursor = STATE.getCursorValue();

        if (!cursor && cursor !== 0) return;

        const currentMin = xAxis.min;
        const currentMax = xAxis.max;
        const range = currentMax - currentMin;

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

    static addOrUpdateSeries(id, data, visible, color) {
        const chart = STATE.chart;
        if (!chart) return;

        if (!STATE.getPoint(id)) {
            return;
        }

        let series = chart.get(id);

        const seriesConfig = {
            id: id,
            type: 'line',
            data: data,
            dataGrouping: {
                enabled: true,
                groupPixelWidth: 2,
                smoothed: true
            },
            color: visible ? color : 'rgba(255, 255, 255, 0)',
            lineColor: visible ? color : 'rgba(255, 255, 255, 0)',
            showInNavigator: true
        };

        if (series) {
            series.update(seriesConfig, false);
            chart.redraw();
        } else {
            chart.addSeries(seriesConfig);
        }
    }

    static removeSeries(id) {
        const chart = STATE.chart;
        if (!chart) return;

        const series = chart.get(id);
        if (series) {
            series.remove();
        }
    }
}