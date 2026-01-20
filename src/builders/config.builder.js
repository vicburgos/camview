/*
    Bootstrap service for video configuration initialization
    Provides structured functions for building video player configuration
*/

export function calculateTimestep(manifest) {
    const availableTimes = manifest.videos.map(v => v.times);

    const timestepBetweenAvailableTimes = [];
    
    for (let i = 0; i < availableTimes.length; i++) {
        const times = availableTimes[i];
        for (let j = 1; j < times.length; j++) {
            const diff = (times[j] - times[j - 1]) * 1000; // in ms
            timestepBetweenAvailableTimes.push(diff);
        }
    }
    return  Math.min(...timestepBetweenAvailableTimes);
}

export function calculateDateRange(manifest, startDate, endDate) {
    const availableTimes = manifest.videos.map(v => v.times);
    let firstUnixtime = null;
    let endUnixtime = null;

    // Calculate firstUnixtime
    if (startDate) {
        const startUnix = startDate.getTime();
        let nearestStart = null;
        
        for (let i = 0; i < availableTimes.length; i++) {
            const times = availableTimes[i];
            for (let j = 0; j < times.length; j++) {
                const timeUnix = times[j] * 1000;
                if (timeUnix >= startUnix) {
                    if (!nearestStart || timeUnix < nearestStart) {
                        nearestStart = times[0] * 1000;
                    }
                }
            }
        }
        firstUnixtime = nearestStart ? nearestStart : availableTimes[0][0] * 1000;
    }

    // Calculate endUnixtime
    if (endDate) {
        const endUnix = endDate.getTime();
        let nearestEnd = null;
        
        for (let i = 0; i < availableTimes.length; i++) {
            const times = availableTimes[i];
            for (let j = 0; j < times.length; j++) {
                const timeUnix = times[j] * 1000;
                if (timeUnix <= endUnix) {
                    if (!nearestEnd || timeUnix > nearestEnd) {
                        nearestEnd = times[times.length - 1] * 1000;
                    }
                }
            }
        }
        endUnixtime = nearestEnd ? nearestEnd : availableTimes[availableTimes.length - 1].slice(-1)[0] * 1000;
    }

    if (!firstUnixtime || !endUnixtime) {
        throw new Error("No available video data in the specified date range.");
    }

    return { firstUnixtime, endUnixtime };
}

/*
    Build a videoChunksList
    A videoChunk is a object with info in the next structure:
    {   
        url: "full_url_to_video_chunk",
        times: [unixtime1, unixtime2, ...],
        durationSeconds: X,-
        timestampOffset: Y, 
        Ej: videoChunk[0].timestampOffset = 0; 
            videoChunk[1].timestampOffset = videoChunk[0].timestampOffset   + videoChunk[0].durationSeconds;
            videoChunk[2].timestampOffset = videoChunk[1].timestampOffset   + videoChunk[1].durationSeconds;
            ...
            videoChunk[n].timestampOffset = videoChunk[n-1].timestampOffset + videoChunk[n-1].durationSeconds;
    }
*/

export function buildMappings(CONFIG, manifest) {
    
    const videoChunksSet = new Set();
    
    // Precompute chunk ranges with metadata
    const chunkRanges = manifest.videos.map((video, idx) => {
        video.durationSeconds = (video.times.length) * (1 / CONFIG.fps);
        return {
            video,
            originalIndex: idx,
            start: video.times[0] * 1000,
            end: video.times[video.times.length - 1] * 1000,
        };
    });
    
    let chunkIdxAux = 0;
    
    for (let t = CONFIG.firstUnixtime; t <= CONFIG.endUnixtime; t += CONFIG.timestep) {
        // Avanzar chunkIdxAux si t > end actual
        while (chunkIdxAux < chunkRanges.length - 1 && t > chunkRanges[chunkIdxAux].end) {
            chunkIdxAux++;
        }
        
        const { video, start, end } = chunkRanges[chunkIdxAux];
        
        if (start <= t && t <= end) {
            const videoURL = video.inp;
            let chunkIndex;
            
            // Agregar a videoChunksList si no existe
            if (!videoChunksSet.has(videoURL)) {
                videoChunksSet.add(videoURL);
                chunkIndex = CONFIG.videoChunksList.length;
                CONFIG.videoChunksList.push(video);
            } else {
                // Buscar el índice existente
                chunkIndex = CONFIG.videoChunksList.findIndex(v => v.inp === videoURL);
            }
            
            // Encontrar el innerIndex (frame dentro del chunk)
            const innerIndex = video.times.findIndex(
                time => time * 1000 >= t
            );
            
            CONFIG.unixtimeToChunkIndex.push(chunkIndex);
            CONFIG.unixtimeToInnerIndex.push(innerIndex);
        } else {
            // Push null equivalents para mantener sincronización
            CONFIG.unixtimeToChunkIndex.push(null);
            CONFIG.unixtimeToInnerIndex.push(null);
        }
    }

    // Agregar timestampOffset en cada video de videoChunksList
    let accumulatedTime = 0;
    for (let i = 0; i < CONFIG.videoChunksList.length; i++) {
        const video = CONFIG.videoChunksList[i];
        video.timestampOffset = accumulatedTime;
        accumulatedTime += video.durationSeconds;

        // TODO: Corregir del Backend
        // Corregimos las url ya que les falta el base_url_prefix
        video.inp = manifest.base_url_prefix + video.inp;
        video.gs  = manifest.base_url_prefix + video.gs;
    }

}

export function healMappings(CONFIG) {
    // Healthy mappings: rellenar nulls con el siguiente válido
    for (let i = 0; i < CONFIG.unixtimeToChunkIndex.length; i++) {
        if (CONFIG.unixtimeToChunkIndex[i] === null) {
            // Find next valid index
            for (let j = i + 1; j < CONFIG.unixtimeToChunkIndex.length; j++) {
                if (CONFIG.unixtimeToChunkIndex[j] !== null) {
                    for (let k = i; k < j; k++) {
                        CONFIG.unixtimeToChunkIndex[k] = CONFIG.unixtimeToChunkIndex[j];
                        CONFIG.unixtimeToInnerIndex[k] = CONFIG.unixtimeToInnerIndex[j];
                    }
                    break;
                }
            }
        }
    }
}

export function buildUnixtimeToVideotimeMap(CONFIG) {
    
    for (let i = 0; i < CONFIG.unixtimeToChunkIndex.length; i++) {
        const chunkIndex = CONFIG.unixtimeToChunkIndex[i];
        const innerIndex = CONFIG.unixtimeToInnerIndex[i];
        const video = CONFIG.videoChunksList[chunkIndex];
        
        const videoTimeMs       = Math.round(innerIndex * (1 / CONFIG.fps) * 1000);
        const globalVideoTimeMs = Math.round(video.timestampOffset * 1000) + videoTimeMs;
        
        CONFIG.unixtimeToVideotime.push(globalVideoTimeMs);
    }
    
}

export function buildVideotimeToUnixtimeMap(CONFIG) {
    
    // Usar Map para mantener orden y evitar duplicados manteniendo el primer valor
    const videotimeToUnixtimeMap = new Map();
    
    for (let i = 0; i < CONFIG.unixtimeToVideotime.length; i++) {
        const videoTime = CONFIG.unixtimeToVideotime[i];
        const unixtime  = CONFIG.firstUnixtime + (i * CONFIG.timestep);
        
        if (!videotimeToUnixtimeMap.has(videoTime)) {
            videotimeToUnixtimeMap.set(videoTime, unixtime);
        }
    }
    
    // Convertir a array ordenado por videotime (las keys están ordenadas por inserción)
    CONFIG.videotimeToUnixtime = Array.from(videotimeToUnixtimeMap.values());
    
}

export function buildVideotimeToChunkIndexMap(CONFIG) {
    
    for (let i = 0; i < CONFIG.videotimeToUnixtime.length; i++) {
        const unixtime      = CONFIG.videotimeToUnixtime[i];
        const unixtimeIndex = Math.round((unixtime - CONFIG.firstUnixtime) / CONFIG.timestep);
        const chunkIndex    = CONFIG.unixtimeToChunkIndex[unixtimeIndex];
        CONFIG.videotimeToChunkIndex.push(chunkIndex);
    }
}

/**
 * Main bootstrap function to initialize video player configuration
 * @param {HTMLElement} root - Root element with configuration attributes
 * @param {Object} manifest - Video manifest data
 * @returns {Object} Complete CONFIG object
 */
export function buildConfig(camara, start, end, useUTC, manifest) {

    const startDate = start ? new Date(start) : null;
    const endDate   = end   ? new Date(end)   : null;

    // Build initial config
    const CONFIG = {
        camara: camara,
        useUTC: useUTC,
        fps: manifest?.fps || 10,
        videoDuration: null,

        timestep: manifest?.timestep || calculateTimestep(manifest),
        firstUnixtime: null,
        endUnixtime: null,
        
        // Lista principal de chunks (info)
        videoChunksList: [],
        
        // Mapeos con indices
        unixtimeToChunkIndex: [],
        unixtimeToInnerIndex: [],

        // Mapeos temporales
        unixtimeToVideotime: [],
        videotimeToUnixtime: [],

        // Mapeo para video
        videotimeToChunkIndex: [],

        // Total video time
        totalVideoTime: null,

        //centerPerDataDay
        centerPerDataDay: [],

    };

    // Calculate date range
    const { firstUnixtime, endUnixtime } = calculateDateRange(
        manifest, 
        startDate, 
        endDate,
    );
    CONFIG.firstUnixtime = firstUnixtime;
    CONFIG.endUnixtime   = endUnixtime;

    // Build mappings
    buildMappings(CONFIG, manifest);

    // Heal mappings (fill nulls)
    healMappings(CONFIG);

    // Build time mappings
    buildUnixtimeToVideotimeMap(CONFIG);
    buildVideotimeToUnixtimeMap(CONFIG);

    // Build mapping for video
    buildVideotimeToChunkIndexMap(CONFIG);

    //
    CONFIG.totalVideoTime = (
        CONFIG.videoChunksList.at(-1).timestampOffset +
        CONFIG.videoChunksList.at(-1).durationSeconds

    );

    // Configurar zoom inicial (últimas 10 horas por defecto) en unixtime
    // 1 * 1 * 20 * 1000 little ajust for chart
    CONFIG.zoomStart = CONFIG.endUnixtime - 11 * 60 * 60 * 1000 + 1 * 1 * 20 * 1000;
    CONFIG.zoomEnd   = CONFIG.endUnixtime;
    
    // Calcular initialTime basado en el inicio del zoom
    const xValueIndex = Math.floor((CONFIG.zoomStart - CONFIG.firstUnixtime) / CONFIG.timestep);
    const currentTimeMs = CONFIG.unixtimeToVideotime[xValueIndex];
    CONFIG.initialTime = currentTimeMs / 1000; // Convertir de ms a segundos

    //Center per data day using videotimeToUnixtime
    let currentDay = null;
    let dayStart = null;
    let dayEnd = null;
    
    for (let i = 0; i < CONFIG.videotimeToUnixtime.length; i++) {
        const unixtime = CONFIG.videotimeToUnixtime[i];
        const date = new Date(unixtime);
        const day = date.getUTCDate();
        
        if (day !== currentDay) {
            // Si había un día anterior, calcular su centro y agregarlo
            if (currentDay !== null && dayStart !== null && dayEnd !== null) {
                const center = (dayStart + dayEnd) / 2;
                CONFIG.centerPerDataDay.push(center);
            }
            // Iniciar nuevo día
            currentDay = day;
            dayStart = unixtime;
            dayEnd = unixtime;
        } else {
            // Actualizar el fin del día actual
            dayEnd = unixtime;
        }
    }
    
    // Agregar el centro del ultimo dia
    if (dayStart !== null && dayEnd !== null) {
        const center = (dayStart + dayEnd) / 2;
        CONFIG.centerPerDataDay.push(center);
    }
    
    return CONFIG;
}
