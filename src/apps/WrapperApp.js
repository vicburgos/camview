import App from "./App.js";

export default async function WrapperApp(root) {
    const camAvailable = root.getAttribute("cam-availables")?.split(" ");

    // Header mejorado con gradiente y sombra
    const header = document.createElement("header");
    header.classList.add("bg-gradient", "shadow-sm");
    header.style.padding = "0.25rem 0";
    header.innerHTML = `
        <div class="container-fluid">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-camera-video-fill" style="font-size: 1.5rem;"></i>
                    <div style="line-height: 1.2;">
                        <h1 class="mb-0" style="font-size: 1rem; font-weight: 600;">
                            DustCam
                        </h1>
                        <small style="font-size:10px;" class="opacity-75">Sistema de detección y monitoreo de polvo</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    root.appendChild(header);
    
    // Main container con mejor espaciado
    const main = document.createElement("main");
    main.classList.add("container", "py-2");
    root.appendChild(main);
    
    // Alert informativo
    const alertInfo = document.createElement("div");
    alertInfo.classList.add("d-flex", "align-items-center");
    alertInfo.innerHTML = `
        <div class="mb-2 p-2">
            Seleccione una cámara de la lista para iniciar la aplicación.
        </div>
    `;
    main.appendChild(alertInfo);

    // Contenedor de tarjetas con grid de Bootstrap
    const cardContainer = document.createElement("div");
    cardContainer.classList.add("row", "row-cols-1", "row-cols-md-2", "row-cols-lg-3", "g-4", "mb-4");
    main.appendChild(cardContainer);
    
    // Variable para trackear tarjeta seleccionada (solo una)
    let selectedCard = null;
    let selectedCamera = null;
    
    camAvailable.forEach((camara, index) => {
        const colDiv = document.createElement("div");
        colDiv.classList.add("col");
        
        const card = document.createElement("div");
        // Slect user none
        card.style.userSelect = "none";
        card.classList.add("card", "h-100", "shadow-sm", "border-2");
        card.style.cursor = "pointer";
        card.style.transition = "all 0.3s ease";
        card.dataset.camera = camara;
        
        const camara_human = root.getAttribute('cam-availables-human')?.split(" ")[index] || camara;
        card.innerHTML = `
            <div class="card-body text-center py-4">
                <div class="mb-1">
                    <i class="bi bi-camera-video-fill text-primary" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold mb-2">${camara_human.split('_').join(' ')}</h5>
            </div>
        `;
        
        // Selección al hacer clic en la tarjeta
        card.addEventListener("click", () => {
            // Deseleccionar la tarjeta anterior si existe
            if (selectedCard && selectedCard !== card) {
                selectedCard.classList.remove("border-primary", "border-3", "bg-primary", "bg-opacity-10");
                selectedCard.classList.add("border-2");
            }
            
            // Seleccionar la nueva tarjeta
            selectedCard = card;
            selectedCamera = camara;
            card.classList.remove("border-3");
            card.classList.add("border-primary", "bg-primary", "bg-opacity-10");
        });
        
        colDiv.appendChild(card);
        cardContainer.appendChild(colDiv);
    });

    // Sección de control
    const controlSection = document.createElement("div");
    controlSection.classList.add("card", "border-0");
    controlSection.innerHTML = `
        <div class="card-body p-2">
            <button id="start-app-btn" class="btn btn-primary fw-semibold">
                <i class="bi bi-play-fill me-2"></i>
                INICIAR APLICACIÓN
            </button>
        </div>
    `;
    main.appendChild(controlSection);

    const startAppBtn = document.getElementById("start-app-btn");
    startAppBtn.addEventListener("click", async () => {
        if (!selectedCamera) {
            // Alert de error con Bootstrap
            const errorAlert = document.createElement("div");
            errorAlert.classList.add("alert", "alert-info", "alert-dismissible", "fade", "show", "mt-3");
            errorAlert.innerHTML = `
                Por favor, seleccione una cámara para iniciar la aplicación.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            controlSection.after(errorAlert);
            
            // Auto-cerrar después de 5 segundos
            setTimeout(() => errorAlert.remove(), 1300);
            return;
        }

        // Mostrar spinner de carga
        startAppBtn.disabled = true;

        // Limpiar solo el contenido principal, mantener el header
        main.innerHTML = "";       
        main.classList.remove("container", "py-2");
        // Crear contenedor con mejor layout
        const appsContainer = document.createElement("div");
        appsContainer.classList.add("container-fluid");
        main.appendChild(appsContainer);

        //Aplicar alto al resto de pantalla después del header
        const headerHeight = header.offsetHeight;
        appsContainer.style.height = `calc(99vh - ${headerHeight}px)`;
        appsContainer.style.overflow = "auto";
        
        const start  = root.getAttribute("start-utc");
        const end    = root.getAttribute("end-utc");
        const useUTC = root.getAttribute("use-utc") === "true";
        const debug  = root.getAttribute("debug") === "true";

        // Agregar al header el nombre la camra y la opción de volver atras
        const camara_human = root.getAttribute('cam-availables-human')?.split(" ")[camAvailable.indexOf(selectedCamera)] || selectedCamera;
        header.querySelector("h1").textContent = camara_human? `DustCam - ${camara_human.split('_').join(' ')}`: "DustCam";
        const backBtn = document.createElement("button");
        backBtn.style.fontSize = "0.7rem";
        backBtn.classList.add("btn", "btn-outline-secondary", "btn-sm", "ms-3");
        backBtn.innerHTML = `<i class="bi bi-arrow-left"></i> Volver`;
        backBtn.addEventListener("click", () => {
            // Recargar la página para reiniciar la app
            window.location.reload();
        });
        header.querySelector(".d-flex.justify-content-between").appendChild(backBtn);


        App(selectedCamera, start, end, useUTC, debug, appsContainer);
    });
}
