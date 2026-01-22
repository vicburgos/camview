import { VideoController } from "../controllers/video.controller.js";
import { VideoCanvasController } from "../controllers/videoCanvas.controller.js";
import { ChartController } from "../controllers/chart.controller.js";
import { GeometryController } from "../controllers/geometry.controller.js";
import { fetchManifest } from "../services/fetch.service.js";
import { buildConfig } from "../builders/config.builder.js";
import videoMSE from "../models/videoMSE.model.js";
import VideoView from "../views/VideoView.js";
import LoadingView from "../views/LoadingView.js";
import TabPanel from "../views/TabPanel.js";
import InfoView from "../views/InfoView.js";
import FilterOptionsView from "../views/FilterOptionsView.js";


export default async function CamView(container, options = {}) {

    const defaultOptions = {
        camID: null,
        time: {
            startUTC: null,
            endUTC: null,
            initialTimeUTC: null,
        },
        chart: {
            useUTC: true,
            defaultSeries: null,
        },
        settings: {
            collapse: false,
            color: {
                active: false,
                type: 'line', // 'line' o 'face'
                opacity: 0.5,
                levels: 10,
                minLevel: 0,
                maxLevel: 100,
            },
        },
        debug: false,
    };

    // Fusionar opciones por defecto con las proporcionadas
    const config = {
        ...defaultOptions,
        ...options,
        time: { ...defaultOptions.time, ...options.time },
        chart: { ...defaultOptions.chart, ...options.chart },
        settings: {
            ...defaultOptions.settings,
            ...options.settings,
            color: { ...defaultOptions.settings.color, ...options.settings?.color },
        },
    };

    const { camID, time, chart, settings, debug } = config;

    /* 
      Arranque de la aplicación
    */
    console.time("CamView initialization");
    
    // Obtener o crear el elemento contenedor
    const root = typeof container === 'string' 
        ? document.getElementById(container) 
        : container;
    
    if (!root) {
        throw new Error(`Container element not found: ${container}`);
    }
    
    // Mostrar vista de carga
    const loadingView = LoadingView();
    root.appendChild(loadingView.el);
    
    // Obtener manifest y construir configuración
    const manifest = await fetchManifest(camID);
    
    
    const CONFIG = await buildConfig(
        camID, 
        time?.startUTC, 
        time?.endUTC, 
        chart?.useUTC, 
        manifest,
        time?.initialTimeUTC,
        chart?.defaultSeries
    );
    loadingView.destroy();
    console.timeEnd("CamView initialization");

    /*
      Layout
    */
    const layout = document.createElement('div');
    layout.id = 'layout';
    Object.assign(layout.style, {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        gap: '5px',
        overflow: 'hidden',
        userSelect: 'none',
        padding: '5px',
    });
    root.appendChild(layout);

    // Left panel para el contenido principal
    const leftPanel = document.createElement("div");
    leftPanel.id = "left-panel";
    Object.assign(leftPanel.style, {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        overflow: 'hidden',
        minWidth: '400px',
    });
    layout.appendChild(leftPanel);

    // Right panel para tabs
    const rightPanel = document.createElement("div");
    rightPanel.id = "right-panel";
    layout.appendChild(rightPanel);

    // Contenedor de video
    const videoWrapper = document.createElement("div");
    videoWrapper.id = "video-wrapper";
    const videoWrapperHeight = 60;
    Object.assign(videoWrapper.style, {
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
    });
    leftPanel.appendChild(videoWrapper);

    // Contenedor de gráfico
    const chartWrapper = document.createElement("div");
    chartWrapper.id = "chart";
    Object.assign(chartWrapper.style, {
        height: `${100 - videoWrapperHeight}%`,
        minHeight: '200px',
        width: '100%',
        overflow: 'hidden',
    });
    leftPanel.appendChild(chartWrapper);

    /*
      Modelos
    */
    const videoINP = new videoMSE({
        videoChunksList: CONFIG.videoChunksList,
        metadata: {
            mapping: CONFIG.videotimeToChunkIndex,
            urlKey: 'inp',
            fps: CONFIG.fps,
            initialTime: CONFIG.initialTime,
        },
    });

    const videoGS = new videoMSE({
        videoChunksList: CONFIG.videoChunksList,
        metadata: {
            mapping: CONFIG.videotimeToChunkIndex,
            urlKey: 'gs',
            fps: CONFIG.fps,
            initialTime: CONFIG.initialTime,
        },
    });

    /*-------------------------------------
        Controladores
    -------------------------------------*/
    const videoController = new VideoController([videoINP, videoGS]);
    const canvasController = new VideoCanvasController([videoINP, videoGS]);
    const chartController = new ChartController(CONFIG, videoController);
    const geometryController = new GeometryController(CONFIG);

    // Conectar geometryController con chartController
    geometryController.setChartController(chartController);

    // Configurar filtro base con opciones de color
    if (settings?.color?.active) {
        const filterOptions = {
            type: settings.color.type,
            opacity: settings.color.opacity,
            levels: settings.color.levels,
            minLevel: settings.color.minLevel,
            maxLevel: settings.color.maxLevel,
            active: settings.color.active,
        };
        if (filterOptions.type=="line"){
            canvasController.setFilter(canvasController.contourLineFilter, filterOptions);
        }
        else if (filterOptions.type=="face"){
            canvasController.setFilter(canvasController.contourFaceFilter, filterOptions);
        }
        else {
            canvasController.setFilter(canvasController.contourLineFilter, filterOptions);
        }
    } else {
        canvasController.setFilter(canvasController.baseFilter);
    }

    /*
      Vistas
    */
    const videoView = VideoView({
        canvasController: canvasController,
        videoController: videoController,
        chartController: chartController,
        geometryController: geometryController,
    });
    videoWrapper.appendChild(videoView.el);

    // Loop de renderizado usando requestAnimationFrame para mejor performance
    let lastUpdateTime = 0;
    const targetFPS = 10;
    const frameInterval = 1000 / targetFPS;

    function renderLoop(currentTime) {
        if (currentTime - lastUpdateTime >= frameInterval) {
            videoView.update();
            lastUpdateTime = currentTime;
        }
        requestAnimationFrame(renderLoop);
    }
    videoINP.video.addEventListener('loadedmetadata', () => {
        requestAnimationFrame(renderLoop);
    });

    // En estado oculto
    const videoContainer = document.createElement('div');
    videoContainer.style.position = 'absolute';
    videoContainer.style.bottom = '0';
    videoContainer.style.right = '0';
    videoContainer.style.width = '1px';
    videoContainer.style.display = 'flex';
    videoContainer.style.flexDirection = 'column';
    videoWrapper.appendChild(videoContainer);
    videoContainer.appendChild(videoINP.video);
    videoContainer.appendChild(videoGS.video);

    if (debug) {
        /*
          Screen de informacion
        */
        const infoView = InfoView({
            videoController,
            videoMSE: videoINP,
            config: CONFIG,
        });
        root.appendChild(infoView.el);
        videoController.onLoadingChange(() => infoView.update());
        videoController.onPlayingChange(() => infoView.update());
        videoController.onSeekingChange(() => infoView.update());
        videoINP.video.addEventListener('timeupdate',
            () => infoView.update()
        );
        videoINP.video.addEventListener(
            'loadedmetadata', () => infoView.update()
        );

        videoContainer.style.width = '240px';
    }


    /*
      TabPanel - Panel lateral de configuración
    */
    const filterOptionsView = FilterOptionsView({ canvasController });

    const tabPanel = TabPanel({
        tabs: [
            {
                id: 'setting',
                label: 'Configuración',
                content: () => filterOptionsView
            }
        ],
        active: 'setting',
        collapsed: settings.collapse,
        maxWidth: 280,
        onChange: (tabId) => {
            console.log('Tab changed:', tabId);
        }
    });
    rightPanel.appendChild(tabPanel.el);

    /*
      Chart - Inicializar gráfico
    */
    chartController.initialize();

    // Sincronizar el cursor del chart con el video
    videoINP.video.addEventListener('timeupdate', () => {
        chartController.updateCursor(videoINP.video.currentTime);
    });

    // Configurar series por defecto si se proporcionan y fueron precalculadas
    if (CONFIG.defaultSeriesData) {
        const { x, y, data } = CONFIG.defaultSeriesData;
        
        // Agregar punto de geometría con datos precalculados cuando el video esté listo
        videoINP.video.addEventListener('loadedmetadata', () => {
            geometryController.addPoint(x, y, '#ff0000', data)
                .catch(error => {
                    console.error('Error loading default series:', error);
                });
        }, { once: true });
    }

    // Retornar objeto con referencias útiles
    return {
        videoController,
        canvasController,
        chartController,
        geometryController,
        destroy: () => {
            // Cleanup
            videoView.destroy?.();
            filterOptionsView.destroy?.();
            tabPanel.destroy?.();
            videoINP.cleanup?.();
            videoGS.cleanup?.();
            root.innerHTML = '';
        }
    };
}