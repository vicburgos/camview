// InfoView - Vista de información del video

export default function InfoView({ videoController, videoMSE, config }) {
    const screen = document.createElement("div");
    Object.assign(screen.style, {
        position: 'absolute',
        top: '5px',
        left: '5px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '5px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '9px',
        zIndex: '1000',
    });
    
    function update() {
        const currentTimeIndex = Math.round(videoMSE.video.currentTime * config.fps);
        const unixtime = config.videotimeToUnixtime[currentTimeIndex]
            ? config.videotimeToUnixtime[currentTimeIndex]
            : config.videotimeToUnixtime.at(-1);
        const date = new Date(unixtime);
        const onPlaceholder = videoMSE.onPlaceholder();
        
        const dateToString = config.useUTC ? date.toUTCString().slice(0, 25) : date.toString().slice(0, 24);

        screen.innerHTML = `
            <div><strong>Date:</strong> ${dateToString}</div>
            <div><strong>Placeholder:</strong> ${onPlaceholder}</div>
            <div><strong>Loading:</strong> ${videoController.isLoading}</div>
            <div><strong>Playing:</strong> ${videoController.isPlaying}</div>
            <div><strong>Seeking:</strong> ${videoController.isSeeking}</div>
            <div><strong>Current Time:</strong> ${videoMSE.video.currentTime.toFixed(2)} s</div>
            <div><strong>Duration:</strong> ${videoMSE.video.duration.toFixed(2)} s</div>
        `;
    }
    
    return {
        el: screen,
        update,
    };
}
