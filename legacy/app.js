import SimpleView from "./components/SimpleViewExample.js";
import AdvancedView from "./components/AdvancedViewExample.js";

export function startApp(root) {

    const simpleViewInstance = AdvancedView({
        message: "Hola Mundo",
        state: 1,
    });

    root.append(simpleViewInstance.el);

    // Simular una actualización de props después de 2 segundos
    setTimeout(() => {
        simpleViewInstance.update({
            message: "Hola Mundo Actualizado",
            state: 2,
        });
    }, 2000);

    // Instanciar otra vista para demostrar que los estilos no se duplican
    setTimeout(() => {
        const anotherSimpleViewInstance = SimpleView({
            message: "Otra Instancia, pero Simple",
            state: 99,
        });
        root.append(anotherSimpleViewInstance.el);
    }, 4000);
}
