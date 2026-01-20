// VideoController - Sincroniza múltiples videos MSE
// Arquitectura: Un video maestro controla todo, los demás son esclavos que lo siguen

export class VideoController {
    constructor(videos = []) {
        if (!videos || videos.length === 0) {
            throw new Error('VideoController requires at least one video');
        }
        
        this.videosMSEList = videos;
        this.masterVideo = videos[0].video; // El primer video es el maestro
        this.slaveVideos = videos.slice(1).map(v => v.video); // Los demás son esclavos
        
        this.fps = videos[0]?.metadata?.fps || 10;
        this.syncThreshold = 1 / (this.fps*2); // 1 frame de tolerancia
        
        // Estados
        this.isPlaying = false;
        this.isLoading = false;
        this.isSeeking = false;
        this.wasPlayingBeforeSeek = false;
        
        // Listeners para eventos
        this.loadingListeners = [];
        this.playingListeners = [];
        this.seekingListeners = [];
        
        this.init();
    }
    
    // Agregar listener para cambios de loading
    onLoadingChange(callback) {
        this.loadingListeners.push(callback);
    }
    
    // Emitir evento de loading
    emitLoadingChange(isLoading) {
        this.loadingListeners.forEach(listener => listener(isLoading));
    }

    onPlayingChange(callback) {
        this.playingListeners = this.playingListeners || [];
        this.playingListeners.push(callback);
    }

    emitPlayingChange(isPlaying) {
        if (this.playingListeners) {
            this.playingListeners.forEach(listener => listener(isPlaying));
        }
    }

    onSeekingChange(callback) {
        this.seekingListeners.push(callback);
    }

    emitSeekingChange(isSeeking) {
        this.seekingListeners.forEach(listener => listener(isSeeking));
    }
    
    init() {
        // Solo el maestro tiene listeners de control
        this.setupMasterListeners();
        
        // Loop de sincronización simple
        this.syncInterval = setInterval(() => this.syncLoop(), 100);
    }
    
    setupMasterListeners() {
        // Play/Pause
        this.masterVideo.addEventListener('play', () => {
            const wasPlaying = this.isPlaying;
            this.isPlaying = true;
            if (!wasPlaying) {
                this.emitPlayingChange(true);
            }
            this.playSlaves();
        });
        
        this.masterVideo.addEventListener('pause', () => {
            // No cambiar isPlaying si:
            // 1. Está en seeking (pausa automática del navegador)
            // 2. Está en loading (pausa por buffering)
            if (!this.isSeeking && !this.isLoading) {
                const wasPlaying = this.isPlaying;
                this.isPlaying = false;
                if (wasPlaying) {
                    this.emitPlayingChange(false);
                }
                this.pauseSlaves();
            }
        });
        
        // Seeking
        this.masterVideo.addEventListener('seeking', () => {
            this.isSeeking = true;
            this.wasPlayingBeforeSeek = this.isPlaying;
            this.emitSeekingChange(true);
        });
        
        this.masterVideo.addEventListener('seeked', () => {
            this.isSeeking = false;
            this.emitSeekingChange(false);
            this.syncSlaves();
            
            // Reanudar si estaba reproduciendo
            if (this.wasPlayingBeforeSeek) {
                // Actualizar isPlaying ANTES de intentar reproducir
                // para que si entra en buffering, sepa que debe reanudar
                this.isPlaying = true;
                
                setTimeout(() => {
                    if (!this.isSeeking && this.wasPlayingBeforeSeek) {
                        this.masterVideo.play().catch(err => {
                            console.warn('Error playing after seek:', err);
                        });
                    }
                }, 100);
            }
        });
        
        // Rate change
        this.masterVideo.addEventListener('ratechange', () => {
            this.syncRate();
        });
        
        this.masterVideo.addEventListener('canplay', () => {
            this.checkAndResume();
        });
        
        this.masterVideo.addEventListener('playing', () => {
            this.checkAndResume();
        });
    }
    
    syncLoop() {
        // Verificar loading en todos los videos
        this.updateLoadingState();
        
        // Si hay loading, pausar todos
        if (this.isLoading) {
            this.pauseAll();
            return;
        }
        
        // Sincronizar esclavos al maestro
        this.syncSlaves();
    }
    
    updateLoadingState() {
        const anyLoading = [this.masterVideo, ...this.slaveVideos].some(video => {
            return video.readyState < 3; // HAVE_FUTURE_DATA
        });
        
        const wasLoading = this.isLoading;
        this.isLoading = anyLoading;
        
        // Emitir evento si cambió el estado
        if (wasLoading !== anyLoading) {
            this.emitLoadingChange(anyLoading);
        }
        
        // Si dejó de cargar y debería reproducir, reanudar
        if (wasLoading && !anyLoading && this.isPlaying) {
            this.resumeAll();
        }
    }
    
    syncSlaves() {
        const masterTime = this.masterVideo.currentTime;
        
        this.slaveVideos.forEach(video => {
            const timeDiff = Math.abs(video.currentTime - masterTime);
            if (timeDiff > this.syncThreshold) {
                video.currentTime = masterTime;
            }
        });
    }
    
    syncRate() {
        const masterRate = this.masterVideo.playbackRate;
        this.slaveVideos.forEach(video => {
            if (video.playbackRate !== masterRate) {
                video.playbackRate = masterRate;
            }
        });
    }
    
    playSlaves() {
        this.slaveVideos.forEach(video => {
            if (video.paused && !this.isLoading) {
                video.currentTime = this.masterVideo.currentTime;
                video.playbackRate = this.masterVideo.playbackRate;
                video.play().catch(err => {
                    // Ignorar errores de AbortError que son normales
                    if (err.name !== 'AbortError') {
                        console.warn('Error playing slave:', err);
                    }
                });
            }
        });
    }
    
    pauseSlaves() {
        this.slaveVideos.forEach(video => {
            if (!video.paused) {
                video.pause();
            }
        });
    }
    
    pauseAll() {
        if (!this.masterVideo.paused) {
            this.masterVideo.pause();
        }
        this.pauseSlaves();
    }
    
    resumeAll() {
        this.syncSlaves();
        if (this.masterVideo.paused && this.masterVideo.readyState >= 3) {
            this.masterVideo.play().catch(err => {
                console.warn('Error resuming master:', err);
            });
        }
    }
    
    checkAndResume() {
        if (!this.isLoading && this.isPlaying) {
            this.resumeAll();
        }
    }
    
    // API pública
    play() {
        this.masterVideo.play().catch(err => {
            if (err.name !== 'AbortError') {
                console.warn('Error playing master:', err);
            }
        });
    }
    
    pause() {
        this.masterVideo.pause();
    }
    
    seekTo(time) {
        this.masterVideo.currentTime = time;
    }
    
    setPlaybackRate(rate) {
        this.masterVideo.playbackRate = rate;
    }
    
    nextFrame() {
        this.masterVideo.currentTime += 1 / this.fps;
    }
    
    prevFrame() {
        this.masterVideo.currentTime -= 1 / this.fps;
    }
    
    getCurrentTime() {
        return this.masterVideo.currentTime;
    }
    
    getDuration() {
        return this.masterVideo.duration;
    }
   
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
}
