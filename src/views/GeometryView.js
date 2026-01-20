export default function GeometryView({ geometryController, canvasElement }) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '5',
    });

    // Crear SVG overlay
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.assign(svg.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
    });
    container.appendChild(svg);

    let currentPoint = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    
    // Función para obtener el rect del canvas visible (considerando objectFit: 'contain')
    const getCanvasRect = () => {
        const rect = canvasElement.getBoundingClientRect();
        const videoWidth = canvasElement.videoWidth || canvasElement.width;
        const videoHeight = canvasElement.videoHeight || canvasElement.height;
        
        if (!videoWidth || !videoHeight) return rect;
        
        const rectAspect = rect.width / rect.height;
        const videoAspect = videoWidth / videoHeight;
        
        let visibleWidth = rect.width;
        let visibleHeight = rect.height;
        let offsetX = 0;
        let offsetY = 0;
        
        // Si objectFit: 'contain' está activo, calcular el área visible
        if (rectAspect > videoAspect) {
            // Hay letterbox a los lados
            visibleWidth = rect.height * videoAspect;
            offsetX = (rect.width - visibleWidth) / 2;
        } else {
            // Hay letterbox arriba y abajo
            visibleHeight = rect.width / videoAspect;
            offsetY = (rect.height - visibleHeight) / 2;
        }
        
        return {
            left: rect.left + offsetX,
            top: rect.top + offsetY,
            width: visibleWidth,
            height: visibleHeight,
            right: rect.left + offsetX + visibleWidth,
            bottom: rect.top + offsetY + visibleHeight,
            offsetX: offsetX,
            offsetY: offsetY
        };
    };
    
    // Función para actualizar la posición y tamaño del container y SVG según el canvas visible
    const updateSVGPosition = () => {
        const canvasRect = canvasElement.getBoundingClientRect();
        const videoWidth = canvasElement.videoWidth || canvasElement.width;
        const videoHeight = canvasElement.videoHeight || canvasElement.height;
        
        if (!videoWidth || !videoHeight) return;
        
        const rectAspect = canvasRect.width / canvasRect.height;
        const videoAspect = videoWidth / videoHeight;
        
        let visibleWidth = canvasRect.width;
        let visibleHeight = canvasRect.height;
        let offsetX = 0;
        let offsetY = 0;
        
        if (rectAspect > videoAspect) {
            visibleWidth = canvasRect.height * videoAspect;
            offsetX = (canvasRect.width - visibleWidth) / 2;
        } else {
            visibleHeight = canvasRect.width / videoAspect;
            offsetY = (canvasRect.height - visibleHeight) / 2;
        }
        
        // Actualizar el container para que solo cubra el área visible
        container.style.left = `${offsetX}px`;
        container.style.top = `${offsetY}px`;
        container.style.width = `${visibleWidth}px`;
        container.style.height = `${visibleHeight}px`;
        
        // El SVG ahora cubre todo el container (que es del tamaño del área visible)
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
    };

    // Context menu para crear punto
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Verificar si hay una carga en progreso
        if (geometryController.isFetching) {
            // Mostrar feedback visual
            container.style.cursor = 'wait';
            setTimeout(() => {
                container.style.cursor = '';
            }, 500);
            return;
        }
        
        const rect = getCanvasRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        // Si se ha presionado sobre la actual posición del punto, removerlo
        if (currentPoint) {
            const circle = svg.querySelector(`[data-geometry-id="${currentPoint.id}"]`);
            if (circle) {
                const cx = parseFloat(circle.getAttribute('cx'));
                const cy = parseFloat(circle.getAttribute('cy'));
                const radius = parseFloat(circle.getAttribute('r')) + 4; // Margen de 4px
                const distSq = (e.clientX - rect.left - cx) ** 2 + (e.clientY - rect.top - cy) ** 2;
                if (distSq <= radius * radius) {
                    geometryController.removeGeometry(currentPoint.id);
                    currentPoint = null;
                    return;
                }
            }
        }

        // Remover punto existente si hay uno (esto tambien remueve la serie del chart)
        if (currentPoint) {
            geometryController.removeGeometry(currentPoint.id);
            currentPoint = null;
        }

        // Crear nuevo punto
        geometryController.addPoint(x, y, '#ff0000').then(geometry => {
            if (geometry) {
                currentPoint = geometry;
                renderPoint(geometry);
            } else {
                // Si ya hay otro punto, remover este inmediatamente
                geometryController.removeGeometry(geometry.id);
            }
        });
    });
    
    // Habilitar eventos de contextmenu en el container
    container.style.pointerEvents = 'auto';
    
    // Actualizar posición del SVG al inicio
    updateSVGPosition();

    function renderPoint(geometry) {
        // Limpiar SVG
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }

        if (!geometry) return;

        const rect = getCanvasRect();
        
        // Crear círculo con posición en píxeles (relativo al área visible del SVG)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', geometry.x * rect.width);
        circle.setAttribute('cy', geometry.y * rect.height);
        circle.setAttribute('r', 10); // Radio fijo en píxeles
        // Sin fill
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('stroke', geometry.color);
        circle.setAttribute('stroke-width', 2);
        circle.setAttribute('data-geometry-id', geometry.id);
        circle.style.cursor = 'move';
        circle.style.pointerEvents = 'auto';

        // Drag functionality
        circle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            
            const rect = getCanvasRect();
            dragStartX = e.clientX - rect.left - (geometry.x * rect.width);
            dragStartY = e.clientY - rect.top - (geometry.y * rect.height);
        });

        svg.appendChild(circle);
    }
    
    // Event listeners globales para drag
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !currentPoint) return;
        
        const rect = getCanvasRect();
        const circle = svg.querySelector(`[data-geometry-id="${currentPoint.id}"]`);
        if (!circle) return;
        
        const newX = e.clientX - rect.left - dragStartX;
        const newY = e.clientY - rect.top - dragStartY;
        
        circle.setAttribute('cx', newX);
        circle.setAttribute('cy', newY);
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging && currentPoint) {
            isDragging = false;
            
            const circle = svg.querySelector(`[data-geometry-id="${currentPoint.id}"]`);
            if (circle) {
                const rect = getCanvasRect();
                const finalX = parseFloat(circle.getAttribute('cx')) / rect.width;
                const finalY = parseFloat(circle.getAttribute('cy')) / rect.height;
                
                // Actualizar el punto con las nuevas coordenadas (hace fetch automáticamente)
                geometryController.updatePoint(currentPoint.id, finalX, finalY);
            }
        }
    });
    
    // Función para redibujar todos los puntos (cuando cambia el tamaño)
    function redrawAll() {
        // Actualizar posición del SVG
        updateSVGPosition();
        
        const geometries = geometryController.getModel().getAllGeometries();
        const rect = getCanvasRect();
        
        geometries.forEach((geometry) => {
            const circle = svg.querySelector(`[data-geometry-id="${geometry.id}"]`);
            if (circle) {
                circle.setAttribute('cx', geometry.x * rect.width);
                circle.setAttribute('cy', geometry.y * rect.height);
            }
        });
    }
    
    // Observer para detectar cambios de tamaño en el canvas
    const resizeObserver = new ResizeObserver(() => {
        redrawAll();
    });
    resizeObserver.observe(canvasElement);

    // Escuchar cambios en el modelo
    geometryController.getModel().onChange((event, geometry) => {
        if (event === 'add' || event === 'update') {
            renderPoint(geometry);
        } else if (event === 'remove' || event === 'clear') {
            while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }
            currentPoint = null;
        }
    });

    return {
        el: container,
        redrawAll, // Exponer método para forzar redibujado si es necesario
    };
}
