export default function SimpleView(initialProps) {
    const defaultProps = {
        message: "",
        state: 0
    };

    let props = { ...defaultProps, ...initialProps };

    const container = document.createElement("div");

    // ------------------------------------------
    // Ejemplo con createElement
    // ------------------------------------------
    // const heading = document.createElement("h1");
    // heading.textContent = message;
    // container.appendChild(heading);
    // const paragraph = document.createElement("p");
    // paragraph.textContent = `El estado es: ${state}`;
    // container.appendChild(paragraph);

    // ------------------------------------------
    // Ejemplo con template string
    // ------------------------------------------
    const template = `
        <h1 class="simple-view title">${props.message}</h1>
        <p class="simple-view paragraph">El estado es: ${props.state}</p>
    `;

    const style = `
        .simple-view {
            font-family: Arial, sans-serif;
            color: #333;
        }
        .simple-view.title {
            font-size: 32px;
            margin-bottom: 10px;
        }
        .simple-view.paragraph {
            font-size: 16px;
        }
    `;    
    container.innerHTML = template;

    // Si hay un simple-view class, no volver a agregar el style
    if (!document.querySelector(".simple-view")) {
        console.log("Agregando estilos de SimpleView");
        document.head.insertAdjacentHTML("beforeend", `<style>${style}</style>`);
    } else {
        console.log("Los estilos de SimpleView ya existen");
    }

    return {
        el: container,
        update(newProps) {
            props = { ...props, ...newProps };
            container.innerHTML = `
                <h1 class="simple-view title">${props.message}</h1>
                <p class="simple-view paragraph">El estado es: ${props.state}</p>
            `;
        }

    }
}

