import App from "./apps/App.js";
import WrapperApp from "./apps/WrapperApp.js";

// Initialize app
const root = document.getElementById("root-app");
const error = `
    <h2 style="
        height: 100%;
        width: 100%;
        display: flex; 
        flex-direction: column; 
        justify-content: center; 
        align-items: center;
        transform: translateY(-25%);
        color: red;
    ">
        Error en la inicialización de la app
    </h2>
`;
if (root.classList.contains("cam-view")) {
    // Parse attributes
    const camara = root.getAttribute("camara");
    const start  = root.getAttribute("start-utc");
    const end    = root.getAttribute("end-utc");
    const useUTC = root.getAttribute("use-utc") === "true";
    App(camara, start, end, useUTC, root).catch(error => {
        console.error("Error starting app:", error);
        root.innerHTML = error;
    });
}

if (root.classList.contains("wrapper")) {
    WrapperApp(root).catch(error => {
        console.error("Error starting wrapper app:", error);
        root.innerHTML = error;
    });
}

