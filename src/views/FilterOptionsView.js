// FilterOptionsView - Vista para configurar las opciones del filtro de contorno

export default function FilterOptionsView({ canvasController }) {
    const container = document.createElement("div");
    container.className = "filter-options-view p-3";

    // Título
    const title = document.createElement("h6");
    title.className = "mb-3";
    title.textContent = "Opciones del Filtro";
    // container.appendChild(title);

    // Helper para crear un control con label y valor
    function createControl(label, value, onChange, options = {}) {
        const wrapper = document.createElement("div");
        wrapper.className = "mb-3";

        const labelRow = document.createElement("div");
        labelRow.className = "d-flex justify-content-between align-items-center mb-1";

        const labelEl = document.createElement("label");
        labelEl.className = "form-label small mb-0";
        labelEl.textContent = label;

        labelRow.appendChild(labelEl);

        let valueDisplay = null;
        if (options.showBadge !== false) {
            valueDisplay = document.createElement("span");
            valueDisplay.className = "badge bg-secondary";
            valueDisplay.textContent = value;
            labelRow.appendChild(valueDisplay);
        }

        wrapper.appendChild(labelRow);

        if (options.type === 'select') {
            const select = document.createElement("select");
            select.className = "form-select form-select-sm";
            
            options.items.forEach(item => {
                const option = document.createElement("option");
                option.value = item.value;
                option.textContent = item.label;
                if (item.value === value) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            select.onchange = () => {
                const newValue = options.items.find(item => item.value == select.value);
                if (valueDisplay) {
                    valueDisplay.textContent = newValue.label;
                }
                onChange(select.value);
            };

            wrapper.appendChild(select);
        } else {
            // Range control
            const rangeWrapper = document.createElement("div");
            rangeWrapper.className = "d-flex align-items-center gap-2";

            const range = document.createElement("input");
            range.type = "range";
            range.className = "form-range flex-grow-1";
            range.min = options.min || 0;
            range.max = options.max || 100;
            range.step = options.step || 1;
            range.value = value;

            range.oninput = () => {
                const val = parseFloat(range.value);
                if (valueDisplay) {
                    valueDisplay.textContent = options.toFixed ? val.toFixed(options.toFixed) : val;
                }
                onChange(val);
            };

            rangeWrapper.appendChild(range);
            wrapper.appendChild(rangeWrapper);
        }

        return wrapper;
    }

    // Obtener configuración actual
    const config = canvasController.config;

    // Determinar filtro activo actual
    let currentFilter = 'line';
    let filterEnabled = true;
    
    if (canvasController.activeFilter === canvasController.baseFilter) {
        filterEnabled = false;
    } else if (canvasController.activeFilter === canvasController.contourLineFilter) {
        currentFilter = 'line';
    } else if (canvasController.activeFilter === canvasController.contourFaceFilter) {
        currentFilter = 'face';
    }

    // === Switch Activar/Desactivar Filtro ===
    const switchWrapper = document.createElement("div");
    switchWrapper.className = "mb-3";

    const switchRow = document.createElement("div");
    switchRow.className = "d-flex justify-content-between align-items-center";

    const switchLabel = document.createElement("label");
    switchLabel.className = "form-label small mb-0";
    switchLabel.textContent = "Activar detección de polvo";

    const switchControl = document.createElement("div");
    switchControl.className = "form-check form-switch";

    const switchInput = document.createElement("input");
    switchInput.type = "checkbox";
    switchInput.className = "form-check-input";
    switchInput.checked = filterEnabled;
    switchInput.style.cursor = "pointer";

    let selectedFilterType = currentFilter;

    switchInput.onchange = () => {
        if (switchInput.checked) {
            // Activar filtro seleccionado
            if (selectedFilterType === 'line') {
                canvasController.setFilter(canvasController.contourLineFilter);
            } else {
                canvasController.setFilter(canvasController.contourFaceFilter);
            }
        } else {
            // Desactivar filtro (usar base)
            canvasController.setFilter(canvasController.baseFilter);
        }
    };

    switchControl.appendChild(switchInput);
    switchRow.appendChild(switchLabel);
    switchRow.appendChild(switchControl);
    switchWrapper.appendChild(switchRow);
    container.appendChild(switchWrapper);

    // === Tipo de Filtro ===
    const filterTypeControl = createControl(
        "Tipo de contorno",
        currentFilter,
        (value) => {
            selectedFilterType = value;
            if (switchInput.checked) {
                // Solo aplicar si el filtro está activado
                if (value === 'line') {
                    canvasController.setFilter(canvasController.contourLineFilter);
                } else {
                    canvasController.setFilter(canvasController.contourFaceFilter);
                }
            }
        },
        {
            type: 'select',
            showBadge: false,
            items: [
                { value: 'line', label: 'Línea' },
                { value: 'face', label: 'Cara' }
            ]
        }
    );
    container.appendChild(filterTypeControl);

    // === Mapa de Colores ===
    const colorMapControl = createControl(
        "Mapa de Colores",
        config.colorMapId,
        (value) => canvasController.setColorMap(parseInt(value)),
        {
            type: 'select',
            showBadge: false,
            items: [
                { value: 1, label: 'Espectral' },
                { value: 2, label: 'Turbo' },
                { value: 3, label: 'Gradiente Verde-Rojo' },
                { value: 4, label: 'Rainbow' },
            ]
        }
    );
    container.appendChild(colorMapControl);

    // Separador
    const separator = document.createElement("hr");
    separator.className = "my-3";
    container.appendChild(separator);

    // === Opacidad ===
    const alphaControl = createControl(
        "Opacidad",
        config.alpha.toFixed(2),
        (value) => canvasController.setAlpha(value),
        { min: 0, max: 1, step: 0.01, toFixed: 2 }
    );
    container.appendChild(alphaControl);

    // === Niveles de Contorno ===
    const levelsControl = createControl(
        "Niveles de Contorno",
        config.levels,
        (value) => canvasController.setLevels(value),
        { min: 2, max: 25, step: 1 }
    );
    container.appendChild(levelsControl);

    // === Nivel Mínimo ===
    const minLevelControl = createControl(
        "Nivel Mínimo (%)",
        config.minLevel,
        (value) => canvasController.setMinLevel(value),
        { min: 0, max: 100, step: 1 }
    );
    container.appendChild(minLevelControl);

    // === Nivel Máximo ===
    const maxLevelControl = createControl(
        "Nivel Máximo (%)",
        config.maxLevel,
        (value) => canvasController.setMaxLevel(value),
        { min: 0, max: 100, step: 1 }
    );
    container.appendChild(maxLevelControl);

    return {
        el: container,
    };
}
