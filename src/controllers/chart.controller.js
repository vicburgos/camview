
const spanishMonth = [
    'ene', 'feb', 'mar', 'abr',
    'may', 'jun', 'jul', 'ago',
    'sep', 'oct', 'nov', 'dic'
];

export class ChartController {
    constructor(config, videoController, chartWrapper) {
        this.config = config;
        this.videoController = videoController;
        this.chart = null;
        this.chartWrapper = chartWrapper;
        this.cursorValue = null;

        // Colores de las bandas de día
        this.BAND_COLOR_1 = 'rgb(255, 255, 255)';
        this.BAND_COLOR_2 = 'rgb(203, 236, 249)';
    }

    generateDayPlotBands() {
        const plotBands = [];
        const CONFIG = this.config;
        const startTime = CONFIG.firstUnixtime;
        const endTime = CONFIG.endUnixtime;
        const useUTC = CONFIG.useUTC;
        let isFirstColor = true;

        // Primer día: de startTime a fin de ese día
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

        // Días intermedios completos
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
                    'domingo', 'lunes', 'martes', 'miércoles', 
                    'jueves', 'viernes', 'sábado'
                ],
            },
            time: { useUTC: CONFIG.useUTC },
            chart: {
                style: {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '12px'
                }
            }
        });

        const buttons = [
            { type: 'all', text: 'Todo' },
            {
                type: 'hour',
                count: Math.round((CONFIG.zoomEnd - CONFIG.zoomStart) / (1000 * 60 * 60)),
                text: '1d'
            }
        ];

        this.chart = Highcharts.stockChart(this.chartWrapper, {
            boost: { seriesThreshold: 1, useGPUTranslations: true },
            rangeSelector: {
                inputEnabled: false,
                buttons: [],
                // buttonTheme: { width: 30, height: 7 },
                // buttonSpacing: 0,
                // inputSpacing: 5,
                // inputStyle: { fontSize: '8px' },
                // verticalAlign: 'bottom',
                // height: 10,
            },
            exporting: {
                enabled: false,
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
                tickColor: 'grey',
                lineColor: 'rgba(0, 0, 0, 0.5)',
                min: start.getTime(),
                max: end.getTime(),
                plotBands: plotBands,
                dateTimeLabelFormats: {
                    millisecond: '%H:%M:%S.%L',
                    second: '%H:%M:%S',
                    minute: '%H:%M',
                    hour: '%H:%M',
                    day: '%e %b',
                    week: '%e %b',
                    month: '%b \'%y',
                    year: '%Y'
                }
            },
            yAxis: {
                min: 0,
                max: 100,
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
                    plotBands: plotBands,
                    gridLineWidth: 0,
                    tickLength: 0,
                    labels: {
                        enabled: true,
                        formatter: function () {
                            const date = new Date(this.value);
                            const dia = date.getDate();
                            const mes = spanishMonth[date.getMonth()];
                            return `${dia} ${mes}`;
                        },
                        style: {
                            fontSize: '12px'
                        },
                        align: 'center',
                        x: 0,
                        y: -33
                    },
                    tickPositioner: function () {
                        return CONFIG.centerPerDataDay;
                    }
                },
                yAxis: {
                    min: 0,
                    max: 100
                },
                series: {
                    boostThreshold: 1,
                    type: 'line',
                    dataGrouping: {
                        enabled: true,
                        groupPixelWidth: 2,
                        smoothed: false
                    }
                }
            },
            scrollbar: {
                height: 1,
            },
            series: [],
            tooltip: {
                enabled: false,
                // // no mostrar el valor de y
                pointFormat: '',
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
            zoom.start.getTime(), zoom.end.getTime()
        );
        this.setupInteraction();

        // Generar serie dummy
        this.addDummySeries();
        this.updateCursor(CONFIG.initialTime);
        
        return this.chart;
    }

    addDummySeries() {
        const CONFIG = this.config;
        const data = [];

        // Usar videotimeToUnixtime para generar puntos con valores null
        for (let i = 0; i < CONFIG.videotimeToUnixtime.length; i++) {
            const time = CONFIG.videotimeToUnixtime[i];
            data.push([time, null]);
        }

        this.addOrUpdateSeries('dummy', data, false, '#4a90e2');
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
            zIndex: 5,
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

        const wrapper = this.chartWrapper;
        if (!wrapper) return;

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

            const chart = this.chart;
            const plotArea = chart.plotBox;
            const rect = wrapper.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            if (
                clickX < plotArea.x ||
                clickX > plotArea.x + plotArea.width ||
                clickY < plotArea.y ||
                clickY > plotArea.y + plotArea.height
            ) {
                return;
            }

            const CONFIG = this.config;
            const xAxis = chart.xAxis[0];
            let xValue = xAxis.toValue(clickX);

            // Clamp
            if (xValue < CONFIG.firstUnixtime) {
                xValue = CONFIG.firstUnixtime;
            }
            if (xValue > CONFIG.endUnixtime) {
                xValue = CONFIG.endUnixtime;
            }

            const xValueIndex = Math.round((xValue - CONFIG.firstUnixtime) / CONFIG.timestep);
            const currentTimeMs = CONFIG.unixtimeToVideotime[xValueIndex];
            const currentTime = currentTimeMs / 1000; // Convertir de ms a segundos

            this.updateCursor(currentTime);
            this.videoController.seekTo(currentTime);
        });
    }

    centerNavigatorAtCursor() {
        if (!this.chart) return;

        const xAxis = this.chart.xAxis[0];
        const cursor = this.cursorValue;

        if (!cursor && cursor !== 0) return;

        // const range = Math.round((this.config.zoomEnd - this.config.zoomStart));
        const range = 12 * 60 * 60 * 1000; 

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
            id: id,
            type: 'line',
            data: data,
            dataGrouping: {
                enabled: true,
                groupPixelWidth: 2,
                smoothed: true
            },
            // gapSize: 3600000, // 1 hora en milisegundos - no conectar si hay saltos mayores
            gapUnit: 'value',
            color: visible ? color : 'rgba(255, 255, 255, 0)',
            lineColor: visible ? color : 'rgba(255, 255, 255, 0)',
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
