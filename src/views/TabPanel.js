// TabPanel - Panel lateral con pestañas para configuración y opciones

export default function TabPanel(container, options = {}) {
    const tabs = options.tabs || [];
    let activeTab = options.active || tabs[0]?.id;
    let collapsed = options.collapsed ?? false;
    const onChange = options.onChange || (() => {});
    const maxWidth = options.maxWidth || 350;
    const minWidth = options.minWidth || 16;

    // Contenedor principal
    const el = document.createElement("div");
    el.className = "tab-panel-container border-start bg-white";

    // Header
    const header = document.createElement("div");
    header.id = "tab-panel-header";
    header.style.width = `${maxWidth}px`;

    // Content
    const content = document.createElement("div");
    content.id = "tab-panel-content";
    content.style.width = `${maxWidth}px`;
    content.className = "content-panel flex-fill overflow-auto";

    el.append(header, content);

    // Estilos
    const style = document.createElement('style');
    style.textContent = `
        .tab-panel-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-width: ${minWidth}px;
            width: ${maxWidth}px;
            max-width: ${maxWidth}px;
            transition: width 0.3s ease;
        }
        .tab-panel-container:has(.collapsed) {
            width: ${minWidth}px !important;
        }
        .tab-panel-container:has(.collapsed) > .content-panel {
            display: none;
        }
        .tab-panel-container:has(.collapsed) .nav {
            display: none;
        }
        .nav-link.active {
            border-top: 3px solid silver;
        }
        .tab-panel-container .nav.single-tab {
            display: none;
        }
    `;
    document.head.appendChild(style);

    // Renderizar header
    function renderHeader() {
        header.innerHTML = "";
        const wrapperHeader = document.createElement("div");
        wrapperHeader.className = "d-flex align-items-center";

        if (collapsed) wrapperHeader.classList.add("collapsed");

        // Botón de colapso/expansión
        const toggleBtn = document.createElement("button");
        Object.assign(toggleBtn.style, {
            width: `${minWidth}px`,
            height: `30px`,
            padding: '2px',
            margin: '2px',
            border: 'none',
        });
        toggleBtn.className = "btn btn-link text-secondary text-decoration-none d-flex align-items-center justify-content-center";
        
        const icon = document.createElement("i");
        Object.assign(icon.style, {
            fontSize: `18px`,
            color: `black`,
        });
        icon.className = collapsed ? "bi bi-chevron-left" : "bi bi-chevron-right";
        toggleBtn.appendChild(icon);
        toggleBtn.onclick = toggle;
        wrapperHeader.appendChild(toggleBtn);

        // Si la ventana es pequeña, hacer collapsable
        window.addEventListener('resize', () => {
            if (container.clientWidth < 600) {
                collapsed = true;
                renderHeader();
            }
        });

        // Tabs usando Nav de Bootstrap
        const nav = document.createElement("ul");
        nav.className = "nav nav-tabs";
        
        // // Si solo hay una pestaña, agregar clase para ocultarla
        // if (tabs.length === 1) {
        //     nav.classList.add("single-tab");
        // }

        tabs.forEach(tab => {
            const li = document.createElement("li");
            li.className = "nav-item";

            const link = document.createElement("a");
            link.className = "nav-link";
            link.href = "#";
            link.textContent = tab.label;
            if (tab.id === activeTab) link.classList.add("active");
            link.onclick = (e) => {
                e.preventDefault();
                setActive(tab.id);
            };

            li.appendChild(link);
            nav.appendChild(li);
        });

        wrapperHeader.appendChild(nav);
        header.appendChild(wrapperHeader);
    }

    // Renderizar contenido
    function renderContent() {
        const currentTab = tabs.find(tab => tab.id === activeTab);
        content.innerHTML = "";
        
        if (currentTab && currentTab.content) {
            // Contenido puede ser función, string o HTMLElement
            if (typeof currentTab.content === 'function') {
                const result = currentTab.content();
                // Si devuelve un objeto con 'el', usar ese elemento
                if (result && result.el) {
                    content.appendChild(result.el);
                } else {
                    content.appendChild(result);
                }
            } else if (typeof currentTab.content === 'string') {
                content.innerHTML = currentTab.content;
            } else if (currentTab.content instanceof HTMLElement) {
                content.appendChild(currentTab.content);
            }
        } else {
            const placeholder = document.createElement("div");
            placeholder.innerHTML = `Contenido para la pestaña <strong>${activeTab}</strong>`;
            content.appendChild(placeholder);
        }
    }

    // Cambiar tab activo
    function setActive(id) {
        if (id === activeTab) return;
        activeTab = id;
        renderHeader();
        renderContent();
        onChange(id);
    }

    // Toggle colapso
    function toggle() {
        collapsed = !collapsed;
        renderHeader();
    }

    // Inicializar
    renderHeader();
    renderContent();

    return {
        el: el,
        setActive,
        toggle,
        update: () => {
            // Método para actualizar el panel si es necesario
            renderContent();
        },
    };
}
