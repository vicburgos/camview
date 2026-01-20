import { VideoController } from "../controllers/video.controller.js";
import { VideoCanvasController } from "../controllers/videoCanvas.controller.js";
import { ChartController } from "../controllers/chart.controller.js";
import { GeometryController } from "../controllers/geometry.controller.js";
import { fetchManifest } from "../services/fetch.service.js";
import { buildConfig } from "../builders/config.builder.js";
import videoMSE from "../models/videoMSE.model.js";
import VideoView from "../views/VideoView.js";
import InfoView from "../views/InfoView.js";
import LoadingView from "../views/LoadingView.js";
import TabPanel from "../views/TabPanel.js";
import FilterOptionsView from "../views/FilterOptionsView.js";

export default async function App(camara, start, end, useUTC, debug, root) {
    /* 
      Arranque de la aplicación
    */
    console.time("App initialization");
    console.time("Fetching metadata");
    const loadingView = LoadingView();
    root.appendChild(loadingView.el);
    const manifest = await fetchManifest(camara);
    loadingView.destroy();
    console.timeEnd("Fetching metadata");
    const CONFIG = buildConfig(camara, start, end, useUTC, manifest);
    console.timeEnd("App initialization");

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

    root.appendChild(layout);

    // Generamos ahora dos secciones sobre rigthPanel: Arriba Video (70%), abajo Grefico (30%)

    const videoWrapper = document.createElement("div");
    videoWrapper.id = "video-wrapper";
    const videoWrapperHeight = 65;
    Object.assign(videoWrapper.style, {
        position: 'relative',
        height: `${videoWrapperHeight}%`,
        width: '100%',
        overflow: 'hidden',
    });
    leftPanel.appendChild(videoWrapper);

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

    // TODO:Para depuración
    window.videoController = videoController;
    window.canvasController = canvasController;
    window.chartController = chartController;
    window.geometryController = geometryController;

    canvasController.setFilter(canvasController.baseFilter);

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
    // Especialmente cuando Highcharts está renderizando (ej: navegando en el chart)
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
    requestAnimationFrame(renderLoop);


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

        videoContainer.style.width = '250px';
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
        collapsed: false,
        maxWidth: 280,
        onChange: (tabId) => {
            console.log('Tab changed:', tabId);
        }
    });
    rightPanel.appendChild(tabPanel.el);

    /*
      Chart
    */
    chartController.initialize();

    // Sincronizar el cursor del chart con el video
    videoINP.video.addEventListener('timeupdate', () => {
        chartController.updateCursor(videoINP.video.currentTime);
    });

}

