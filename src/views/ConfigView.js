// ConfigView - Vista de configuración de la aplicación

export default function ConfigView(options = {}) {
    const config = options.config || {};
    const onChange = options.onChange || (() => {});

    // Contenedor principal
    const container = document.createElement("div");
    container.className = "config-view p-3";

    // Título
    const title = document.createElement("h5");
    title.className = "mb-3";
    title.textContent = "Configuración";
    container.appendChild(title);

    // Contenedor de opciones
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "config-options";
    container.appendChild(optionsContainer);

    // Función para crear un campo de configuración
    function createConfigField(label, key, type = "text", options = {}) {
        const field = document.createElement("div");
        field.className = "mb-3";

        const labelEl = document.createElement("label");
        labelEl.className = "form-label small";
        labelEl.textContent = label;
        field.appendChild(labelEl);

        let input;

        switch (type) {
            case "checkbox":
                input = document.createElement("input");
                input.type = "checkbox";
                input.className = "form-check-input d-block";
                input.checked = config[key] || false;
                input.onchange = () => {
                    config[key] = input.checked;
                    onChange(key, input.checked);
                };
                break;

            case "select":
                input = document.createElement("select");
                input.className = "form-select form-select-sm";
                if (options.items) {
                    options.items.forEach(item => {
                        const option = document.createElement("option");
                        option.value = item.value || item;
                        option.textContent = item.label || item;
                        if (config[key] === option.value) {
                            option.selected = true;
                        }
                        input.appendChild(option);
                    });
                }
                input.onchange = () => {
                    config[key] = input.value;
                    onChange(key, input.value);
                };
                break;

            case "number":
                input = document.createElement("input");
                input.type = "number";
                input.className = "form-control form-control-sm";
                input.value = config[key] || 0;
                if (options.min !== undefined) input.min = options.min;
                if (options.max !== undefined) input.max = options.max;
                if (options.step !== undefined) input.step = options.step;
                input.onchange = () => {
                    config[key] = parseFloat(input.value);
                    onChange(key, parseFloat(input.value));
                };
                break;

            case "range":
                const rangeWrapper = document.createElement("div");
                rangeWrapper.className = "d-flex align-items-center gap-2";
                
                input = document.createElement("input");
                input.type = "range";
                input.className = "form-range flex-grow-1";
                input.value = config[key] || 0;
                if (options.min !== undefined) input.min = options.min;
                if (options.max !== undefined) input.max = options.max;
                if (options.step !== undefined) input.step = options.step;
                
                const valueDisplay = document.createElement("span");
                valueDisplay.className = "badge bg-secondary";
                valueDisplay.textContent = input.value;
                
                input.oninput = () => {
                    valueDisplay.textContent = input.value;
                };
                
                input.onchange = () => {
                    config[key] = parseFloat(input.value);
                    onChange(key, parseFloat(input.value));
                };
                
                rangeWrapper.appendChild(input);
                rangeWrapper.appendChild(valueDisplay);
                field.appendChild(rangeWrapper);
                return field;

            default:
                input = document.createElement("input");
                input.type = "text";
                input.className = "form-control form-control-sm";
                input.value = config[key] || "";
                input.onchange = () => {
                    config[key] = input.value;
                    onChange(key, input.value);
                };
                break;
        }

        field.appendChild(input);
        return field;
    }

    // Renderizar opciones de configuración
    function render() {
        optionsContainer.innerHTML = "";
        
        // Aquí se agregarán las opciones de configuración
        // Por ahora, mostrar un mensaje de placeholder
        const placeholder = document.createElement("div");
        placeholder.className = "alert alert-info small";
        placeholder.innerHTML = `
            <i class="bi bi-info-circle me-2"></i>
            Las opciones de configuración se agregarán aquí
        `;
        optionsContainer.appendChild(placeholder);
    }

    // Método para agregar una opción de configuración
    function addOption(label, key, type = "text", options = {}) {
        // Si es el primer campo, eliminar el placeholder
        const placeholder = optionsContainer.querySelector(".alert");
        if (placeholder) {
            placeholder.remove();
        }
        
        const field = createConfigField(label, key, type, options);
        optionsContainer.appendChild(field);
    }

    // Método para actualizar la vista
    function update() {
        render();
    }

    // Inicializar
    render();

    return {
        el: container,
        addOption,
        update,
    };
}
