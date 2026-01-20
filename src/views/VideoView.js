import GeometryView from './GeometryView.js';

export default function VideoView({ canvasController, videoController, chartController, geometryController }) {
    // Container principal
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        margin: 'auto',
        overflow: 'hidden',
    });
    
    // Canvas wrapper
    const canvasWrapper = document.createElement('div');
    canvasWrapper.id = 'canvas-wrapper';
    Object.assign(canvasWrapper.style, {
        position: 'relative', // Importante para que el overlay se posicione correctamente
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    });
    
    const canvas = canvasController.getCanvas(0);
    const canvasHeight = 100;
    Object.assign(canvas.style, {
        width: '100%',
        height: `${canvasHeight}%`,
        minHeight: '200px',
        objectFit: 'contain',
    });
    canvasWrapper.appendChild(canvas);
    
    // GeometryView overlay sobre el canvas (solo si se proporciona geometryController)
    if (geometryController) {
        const geometryView = GeometryView({
            geometryController: geometryController,
            canvasElement: canvas,
        });
        canvasWrapper.appendChild(geometryView.el);
    }
    
    container.appendChild(canvasWrapper);
    
    // Loading overlay
    const loadingOverlay = document.createElement('div');
    Object.assign(loadingOverlay.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '10',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    });
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border text-dark';
    spinner.setAttribute('role', 'status');
    spinner.style.cssText = 'width: 4rem; height: 4em;';
    
    loadingOverlay.appendChild(spinner);
    container.appendChild(loadingOverlay);
    
    // Controles
    const makeBtn = (icon, fontSize = "12px") => {
        const btn = document.createElement("button");
        btn.innerHTML = icon;
        Object.assign(btn.style, {
            width: "40px",
            height: "40px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize,
        });
        return btn;
    };
    
    const controlBarHeight = 30;
    const controlsBar = document.createElement("div");
    Object.assign(controlsBar.style, {
        display: "flex",
        width: "100%",
        height: `${100 - canvasHeight}%`,
        minHeight: `${controlBarHeight}px`,
        justifyContent: "center",
        alignItems: "center",
        gap: "12px",
        userSelect: "none",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
    });
    
    const btnPrev = makeBtn('<i class="bi bi-chevron-double-left"></i>');
    const btnPP   = makeBtn('<i class="bi bi-play-fill"></i>', "18px");
    const btnNext = makeBtn('<i class="bi bi-chevron-double-right"></i>');
    const btnGoto = makeBtn('<i class="bi bi-input-cursor"></i>');
    
    btnPrev.title = "Frame Anterior";
    btnPP.title = "Play/Pause";
    btnNext.title = "Frame Siguiente";
    btnGoto.title = "Centrar Cursor";
    
    // Funcionalidad de botones   
    btnPrev.onclick = () => {
        videoController.prevFrame();
    };
    
    btnNext.onclick = () => {
        videoController.nextFrame();
    };
    
    btnPP.onclick = () => {
        videoController.isPlaying
            ? videoController.pause()
            : videoController.play();
    };

    btnGoto.onclick = () => {
        if (chartController) {
            chartController.centerNavigatorAtCursor();
        }
    };

    // Bind icon to isPlaying state
    videoController.onPlayingChange((isPlaying) => {
        isPlaying
            ? btnPP.innerHTML = '<i class="bi bi-pause-fill"></i>'
            : btnPP.innerHTML = '<i class="bi bi-play-fill"></i>';
    });
    
    // Speed selector
    const speedSelect = document.createElement("select");
    speedSelect.title = "Velocidad de Reproducción";
    Object.assign(speedSelect.style, {
        height: `${controlBarHeight*0.8}px`,
        border: "1px solid #ccc",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "12px",
        padding: "0 4px",
        marginLeft: "8px",
        userSelect: "none",
    });
    
    const speeds = [0.25, 0.5, 1, 1.5, 2];
    speeds.forEach(speed => {
        const option = document.createElement("option");
        option.value = speed;
        option.textContent = `${speed}x`;
        if (speed === 1) option.selected = true;
        speedSelect.appendChild(option);
    });
    
    speedSelect.onchange = () => {
        videoController.setPlaybackRate(parseFloat(speedSelect.value))
    };
    
    controlsBar.append(btnGoto, btnPrev, btnPP, btnNext, speedSelect);
    container.appendChild(controlsBar);
    
    // Suscribir para loading - solo mostrar si dura más de 300ms
    let loadingTimeout = null;
    let thesholdTime = 200;
    
    videoController.onLoadingChange((isLoading) => {
        if (isLoading) {
            // Esperar 300ms antes de mostrar el overlay
            loadingTimeout = setTimeout(() => {
                loadingOverlay.style.display = 'flex';
                loadingTimeout = null;
            }, thesholdTime);
        } else {
            // Cancelar el timeout si aún no se mostró
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            // Ocultar el overlay si está visible
            loadingOverlay.style.display = 'none';
        }
    });

    
    // Update
    function update() {
        try {
            canvasController.render();
        } catch (error) {
            console.error('Error updating VideoView:', error);
        }
    }
    
    return {
        el: container,
        canvasWrapper, // Exponer para agregar overlays
        update,
    };
}
