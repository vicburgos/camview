// Ejemplo de uso de TabPanel con ConfigView

import TabPanel from '../views/TabPanel.js';
import ConfigView from '../views/ConfigView.js';

/**
 * Ejemplo de cómo usar TabPanel con ConfigView como primer tab
 * 
 * @param {HTMLElement} container - Contenedor donde se montará el TabPanel
 * @returns {Object} Objeto con el elemento y métodos del TabPanel
 */
export function createTabPanelWithConfig(container) {
    // Configuración inicial
    const appConfig = {
        fps: 30,
        quality: 'high',
        showInfo: true,
        autoPlay: false,
        volume: 50,
    };

    // Crear la vista de configuración
    const configView = ConfigView({
        config: appConfig,
        onChange: (key, value) => {
            console.log(`Config changed: ${key} = ${value}`);
            // Aquí puedes agregar lógica para aplicar los cambios
        }
    });

    // Agregar opciones de configuración
    configView.addOption('FPS', 'fps', 'number', { min: 1, max: 60, step: 1 });
    configView.addOption('Calidad', 'quality', 'select', {
        items: [
            { value: 'low', label: 'Baja' },
            { value: 'medium', label: 'Media' },
            { value: 'high', label: 'Alta' },
        ]
    });
    configView.addOption('Mostrar Info', 'showInfo', 'checkbox');
    configView.addOption('Auto Play', 'autoPlay', 'checkbox');
    configView.addOption('Volumen', 'volume', 'range', { min: 0, max: 100, step: 1 });

    // Crear el TabPanel con pestañas
    const tabPanel = TabPanel({
        tabs: [
            {
                id: 'config',
                label: 'Configuración',
                content: () => configView
            },
            {
                id: 'info',
                label: 'Info',
                content: '<div class="p-3">Información adicional aquí</div>'
            },
            {
                id: 'help',
                label: 'Ayuda',
                content: () => {
                    const div = document.createElement('div');
                    div.className = 'p-3';
                    div.innerHTML = `
                        <h6>Ayuda</h6>
                        <p class="small">Contenido de ayuda aquí</p>
                    `;
                    return div;
                }
            }
        ],
        active: 'config', // Tab activo por defecto
        collapsed: false,
        maxWidth: 350,
        minWidth: 16,
        onChange: (tabId) => {
            console.log(`Tab changed to: ${tabId}`);
        }
    });

    // Montar el TabPanel en el contenedor
    container.appendChild(tabPanel.el);

    return {
        tabPanel,
        configView,
        config: appConfig,
    };
}

// Ejemplo de uso:
// const container = document.getElementById('right-panel');
// const { tabPanel, configView, config } = createTabPanelWithConfig(container);
