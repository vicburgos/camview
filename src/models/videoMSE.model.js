export default class videoMSE {
  constructor({
    videoChunksList = [],
    metadata = {},
  }) {
    // Validación: videoChunksList no puede estar vacío
    if (!videoChunksList || videoChunksList.length === 0) {
      throw new Error('videoChunksList is required and cannot be empty');
    }

    // -----------------------
    // Metadata con defaults
    // -----------------------
    this.metadata = {
      fps: 10,
      mime: 'video/mp4; codecs="avc1.640028"',
      bufferAhead: 2,
      mapping: null,
      initialTime: 0,
      cleanupBuffer: false,
      urlKey: null,
      ...metadata, // override
    };

    // Determinar modo de operación: 'seek' o 'sequential'
    this.mode = this.metadata.mapping ? 'seek' : 'sequential';

    // Validar estructura de videoChunksList según el modo
    // Modo sequential: cada chunk requiere { inp }
    // Modo seek: cada chunk requiere { inp, timestampOffset, durationSeconds }
    const firstChunkToCheck = videoChunksList[0];
    if (!firstChunkToCheck.inp) {
      throw new Error('Each chunk in videoChunksList must have a "url" property');
    }
    if (this.mode === 'seek') {
      if (firstChunkToCheck.timestampOffset === undefined || firstChunkToCheck.durationSeconds === undefined) {
        throw new Error('In seek mode, each chunk must have "url", "timestampOffset", and "durationSeconds"');
      }
    }

    // -----------------------
    // Config principal
    // -----------------------
    this.video = document.createElement("video");
    this.videoChunksList = videoChunksList;
    this.playListURL = videoChunksList.map(v => v[this.metadata.urlKey || 'url']);
    
    // Calcular duracion total solo si hay mapping
    this.totalVideoTime = this.metadata.mapping
      ? videoChunksList.at(-1).timestampOffset + videoChunksList.at(-1).durationSeconds
      : null;
    
    this.initialTime = this.metadata.initialTime;
    this.currentChunkIndex = 0; // Para modo sin mapping (secuencial)

    this.loadedChunks         = new Set();
    this.failedChunks         = new Set();
    this.isAppending          = false;     // Flag para evitar append concurrentes
    this.timeOffsetAdjustment = 0;         // Acumulador de ajuste temporal
    this.placeholderBuffer    = null;      // Buffer del chunk placeholder base
    this.placeholderDuration  = 0.1;       // Duración del chunk placeholder base
    
    // Asignar método addBuffer según el modo (solo se evalúa una vez)
    this.addBuffer = this.mode === 'seek' 
      ? this.addBufferWithMapping 
      : this.addBufferSequential;
    
    this.loadPlaceholder();                // Cargar chunk placeholder
    this.initMediaSource();
  }

  //-----------------------------
  //MediaSource setup            
  // -----------------------------

  async loadPlaceholder() {
    try {
      const response = await fetch('/media/camview/placeholder-chunk.mp4');
      this.placeholderBuffer = await response.arrayBuffer();
    } catch (err) {
      console.warn('the chunk placeholder is not available:', err.message);
    }
  }

  async generatePlaceholder(durationSeconds) {
    if (!this.placeholderBuffer) {
      console.warn('Chunk placeholder no available');
      return null;
    }

    return this.placeholderBuffer;
  }

  async fetchWithRetry(url, chunkIndex, maxRetries = 1, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        
        // Validar tamaño mínimo razonable (ej: 0.01MB = 10KB)
        const minSize = 10 * 1024; // 10 KB
        if (arrayBuffer.byteLength < minSize) {
          throw new Error(
            `Buffer corrupted: size ${arrayBuffer.byteLength} bytes < ${minSize} bytes`
          );
        }

        return arrayBuffer;
      } catch (err) {
        console.warn(
          `Try ${i + 1}/${maxRetries} failed for chunk ${chunkIndex}:`, err.message
        );
        if (i === maxRetries - 1) {
          throw err;
        }
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }


  #loopbuffer() {
    if (this.video.ended) return;
    this.addBuffer(this.video.currentTime);
    setTimeout(() => this.#loopbuffer(), 500);
  }

  
  initMediaSource() {
    this.mediaSource = new MediaSource();
    this.video.src = URL.createObjectURL(this.mediaSource);

    this.mediaSource.addEventListener("sourceopen", () => {
      if (this.sourceBuffer) return;

      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.metadata.mime);
      this.sourceBuffer.mode = "sequence";

      // Solo establecer duración si hay mapping
      if (this.metadata.mapping && this.totalVideoTime) {
        this.mediaSource.duration = this.totalVideoTime;
      }
      // Sin mapping, la duración será indefinida (Infinity)

      this.addBuffer(this.initialTime).then(() => {
        if (this.metadata.mapping && this.initialTime > 0) {
          this.video.currentTime = this.initialTime;
        }
      });

      // Iniciar loop de buffer
      this.#loopbuffer();

    });
  }


  //-----------------------------
  //Buffer logic - Soporta dos modos:
  // 1. Con mapping: seek habilitado, usa indices
  // 2. Sin mapping: secuencial, sin seek
  // El metodo addBuffer se asigna en el constructor segun el modo
  //-----------------------------

  async addBufferWithMapping(currentTime) {
    if (this.isAppending) return;

    const currentTimeIndex = Math.floor(currentTime * this.metadata.fps);
    const currentChunkIndex = this.metadata.mapping[currentTimeIndex];
    
    if (currentChunkIndex === null || currentChunkIndex === undefined) {
      console.warn('No available chunk for current time:', currentTime);
      return;
    }
    
    const startChunk = currentChunkIndex;
    const endChunk = Math.min(
      currentChunkIndex + this.metadata.bufferAhead,
      this.playListURL.length - 1
    );

    const chunksToLoad = [];
    for (let i = startChunk; i <= endChunk; i++) {
      if (!this.loadedChunks.has(i)) {
        chunksToLoad.push(i);
      }
    }
    if (chunksToLoad.length === 0) return;

    this.isAppending = true;

    for (const chunkIndex of chunksToLoad) {
      const url = this.playListURL[chunkIndex];
      try {
        const arrayBuffer = await this.fetchWithRetry(url, chunkIndex);
        
        // Acceso directo al chunk usando índice
        const chunkInfo = this.videoChunksList[chunkIndex];
        
        // Usar timestampOffset del chunk
        this.sourceBuffer.timestampOffset = chunkInfo.timestampOffset;
        
        await this.appendBuffer(arrayBuffer);
        this.loadedChunks.add(chunkIndex);

        if (chunkIndex === this.videoChunksList.length - 1) {
          this.mediaSource.endOfStream();
        }
        
        // Limpiar buffer si está habilitado
        if (this.metadata.cleanupBuffer) {
          this.cleanupBuffer(currentTime);
        }

      } catch (err) {
        console.error(
          `Chunk ${chunkIndex} failed to load`);
        
        const chunkInfo = this.videoChunksList[chunkIndex];
        const placeholderBuffer = await this.generatePlaceholder(chunkInfo.durationSeconds);
        
        if (placeholderBuffer) {
          try {
            // Calcular cuántas repeticiones necesitamos
            const repetitions = Math.ceil(
              chunkInfo.durationSeconds / this.placeholderDuration
            );
            console.log(
              `Insert placeholder for chunk ${chunkIndex}, repetitions: ${repetitions}`
            );
            
            // Insertar múltiples copias del placeholder
            for (let i = 0; i < repetitions; i++) {
              const offset = (chunkInfo.timestampOffset
                + (i * this.placeholderDuration) 
                - this.timeOffsetAdjustment
              );
              this.sourceBuffer.timestampOffset = offset;
              await this.appendBuffer(placeholderBuffer);
            }
            
          } catch (appendErr) {
            console.error(`Error insertando placeholder:`, appendErr.message);
            // Si falla, acumular toda la duración del chunk
            this.timeOffsetAdjustment += chunkInfo.durationSeconds;
          }
        } else {
          // Si no hay placeholder, acumular toda la duración
          this.timeOffsetAdjustment += chunkInfo.durationSeconds;
        }
        
        this.loadedChunks.add(chunkIndex);
        this.failedChunks.add(chunkIndex);
        continue;
      }
    }

    this.isAppending = false;
  }

  async addBufferSequential() {
    if (this.isAppending) return;
    
    // Modo secuencial: cargar el siguiente chunk disponible
    if (this.currentChunkIndex >= this.playListURL.length) {
      return; // Ya se cargaron todos los chunks
    }

    const chunksToLoad = [];
    const maxChunks = Math.min(
      this.currentChunkIndex + this.metadata.bufferAhead,
      this.playListURL.length
    );

    for (let i = this.currentChunkIndex; i < maxChunks; i++) {
      if (!this.loadedChunks.has(i)) {
        chunksToLoad.push(i);
      }
    }

    if (chunksToLoad.length === 0) {
      // Avanzar el índice si ya están cargados
      this.currentChunkIndex = maxChunks;
      return;
    }

    this.isAppending = true;

    for (const chunkIndex of chunksToLoad) {
      const url = this.playListURL[chunkIndex];
      try {
        const arrayBuffer = await this.fetchWithRetry(url, chunkIndex);
        
        // En modo secuencial, no establecer timestampOffset
        // Los chunks se agregan uno tras otro automáticamente
        await this.appendBuffer(arrayBuffer);
        this.loadedChunks.add(chunkIndex);
        this.currentChunkIndex = chunkIndex + 1;

        if (chunkIndex === this.videoChunksList.length - 1) {
          this.mediaSource.endOfStream();
        }
        
        // Limpiar buffer si está habilitado
        if (this.metadata.cleanupBuffer) {
          this.cleanupBuffer();
        }

      } catch (err) {
        console.error(`Chunk ${chunkIndex} failed to load:`, err.message);
        
        // En modo secuencial, simplemente saltamos el chunk fallido
        this.loadedChunks.add(chunkIndex);
        this.failedChunks.add(chunkIndex);
        this.currentChunkIndex = chunkIndex + 1;
        continue;
      }
    }

    this.isAppending = false;
  }


  appendBuffer(arrayBuffer) {
    return new Promise((resolve, reject) => {
      this.sourceBuffer.addEventListener(
        "updateend", () => resolve(), { once: true }
      );
      this.sourceBuffer.appendBuffer(arrayBuffer);
    });
  }


  //-----------------------------
  // Método para limpiar el buffer y evitar sobrecarga
  //-----------------------------
  cleanupBuffer(currentTime) {
    if (!this.metadata.cleanupBuffer) return;
    if (!this.sourceBuffer || this.sourceBuffer.updating) return;

    if (this.mode === 'seek') {
      // Modo seek: usar mapping para calcular tiempo de limpieza
      const currentTimeIndex = Math.round(currentTime * this.metadata.fps);
      const currentChunkIndex = this.metadata.mapping[currentTimeIndex];    
      const chunkInfo = this.videoChunksList[currentChunkIndex];

      const keepBehind = 2 * chunkInfo.durationSeconds;
      const removeEnd = currentTime - keepBehind;

      if (removeEnd <= 0) return;

      try {
        this.sourceBuffer.remove(0, removeEnd);
      } catch { }
    } else {
      // Modo sequential: usar video.currentTime directamente
      const currentVideoTime = this.video.currentTime;
      const keepBehindSeconds = 10; // Mantener 10 segundos detrás
      const removeEnd = currentVideoTime - keepBehindSeconds;

      if (removeEnd <= 0) return;

      try {
        this.sourceBuffer.remove(0, removeEnd);
      } catch { }
    }
  }

  //-----------------------------
  // Metodo para verificar si el currentTime está en un placeholder
  //-----------------------------
  onPlaceholder(currentTime = null) {
    if (this.mode !== 'seek') {
      // En modo secuencial, no podemos determinar con precisión
      return false;
    }
    
    const time = currentTime !== null ? currentTime : this.video.currentTime;
    const currentTimeIndex = Math.round(time * this.metadata.fps);
    const currentChunkIndex = this.metadata.mapping[currentTimeIndex];
    
    if (currentChunkIndex === null || currentChunkIndex === undefined) {
      return false;
    }
    
    return this.failedChunks.has(currentChunkIndex);
  }

  onLoading() {
    // Doc:
    //HAVE_NOTHING      = 0 
    //HAVE_METADATA     = 1
    //HAVE_CURRENT_DATA = 2
    //HAVE_FUTURE_DATA  = 3
    //HAVE_ENOUGH_DATA  = 4

    // With this logic, if readyState < 3, we are loading/buffering
    return this.video.readyState < 3;
  }
}