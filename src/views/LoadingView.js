// LoadingView - Vista de carga inicial de la aplicación

export default function LoadingView() {
    const container = document.createElement("div");
    
    Object.assign(container.style, {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    });

    const message = document.createElement("h2");
    Object.assign(message.style, {
        margin: '0',
        padding: '20px',
        fontWeight: 'normal',
        color: '#333',
        fontSize: '32px',
        textAlign: 'center',
        display: 'inline-block',
        minWidth: '320px',
    });

    const text = document.createElement("span");
    text.textContent = "Inicializando aplicación";
    
    const dots = document.createElement("span");
    dots.style.display = "inline-block";
    dots.style.width = "1.5em";
    dots.style.textAlign = "left";
    
    message.appendChild(text);
    message.appendChild(dots);
    container.appendChild(message);

    // Animación de puntos
    let dotCount = 0;
    const intervalId = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        dots.textContent = '.'.repeat(dotCount);
    }, 350);

    return {
        el: container,
        destroy: () => {
            clearInterval(intervalId);
            container.remove();
        }
    };
}
