(function () {
    const PhaseOneSim = window.PhaseOneSim || (window.PhaseOneSim = {});
    const LINEAGE_SAVE_KEY = 'ai-civ-sim-lineage-v1';
    const RUN_SAVE_KEY = 'ai-civ-sim-run-v1';
    const RUN_SAVE_META_KEY = 'ai-civ-sim-run-meta-v1';
    const SAVE_PREFIX = 'ai-civ-sim-';
    const RUN_SAVE_VERSION = 1;
    const AUTOSAVE_INTERVAL = 45;
    const AUDIO_SOURCES = [
        'sounds/background.mp3',
        'sounds/wind.mp3',
        'sounds/rain.mp3',
        'sounds/heavy_wind_rain.mp3',
        'sounds/Thunder.mp3'
    ];

    class AmbientAudioController {
        constructor(world, renderer) {
            this.world = world;
            this.renderer = renderer;
            this.players = null;
            this.thunderPool = [];
            this.debugState = {
                enabled: true,
                started: false,
                contextState: 'idle',
                shelterMix: 0,
                wind: 0,
                rain: 0,
                roofRain: 0,
                snow: 0,
                insects: 0,
                thunder: 0,
                music: 0,
                musicMode: 'idle'
            };
            this.lastLightningFlash = 0;
            this.lastThunderAt = -999;
            this.nextStormThunderGap = 5.5;
            this.audioPreloadPromise = null;
            this.boundResume = () => this.resumeFromGesture();
            ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
                window.addEventListener(eventName, this.boundResume, { passive: true });
            });
            this.preloadAudioAssets();
        }

        setWorldAndRenderer(world, renderer) {
            this.world = world;
            this.renderer = renderer;
        }

        getDebugState() {
            return { ...this.debugState };
        }

        createLoopPlayer(src) {
            const audio = new Audio(src);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = 0;
            return { audio, volume: 0, target: 0, active: false };
        }

        createThunderPlayer(src) {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.volume = 0;
            return audio;
        }

        preloadAudioAssets() {
            if (this.audioPreloadPromise || typeof Audio === 'undefined') {
                return this.audioPreloadPromise;
            }
            this.audioPreloadPromise = Promise.all(AUDIO_SOURCES.map((src) => new Promise((resolve) => {
                const audio = new Audio(src);
                audio.preload = 'auto';
                const done = () => resolve();
                audio.addEventListener('canplaythrough', done, { once: true });
                audio.addEventListener('error', done, { once: true });
                try {
                    audio.load();
                } catch (error) {
                    resolve();
                }
            })));
            return this.audioPreloadPromise;
        }

        ensurePlayers() {
            if (this.players || !this.debugState.enabled) {
                return;
            }
            if (typeof Audio === 'undefined') {
                this.debugState.enabled = false;
                return;
            }
            this.players = {
                background: this.createLoopPlayer('sounds/background.mp3'),
                wind: this.createLoopPlayer('sounds/wind.mp3'),
                rain: this.createLoopPlayer('sounds/rain.mp3'),
                storm: this.createLoopPlayer('sounds/heavy_wind_rain.mp3')
            };
            this.thunderPool = [
                this.createThunderPlayer('sounds/Thunder.mp3'),
                this.createThunderPlayer('sounds/Thunder.mp3')
            ];
            this.preloadAudioAssets();
            this.debugState.started = true;
            this.debugState.contextState = 'html-audio-ready';
        }

        resumeFromGesture() {
            this.ensurePlayers();
            if (!this.players) {
                return;
            }
            this.setLoopPlayback('background', true);
            this.debugState.contextState = 'html-audio-running';
        }

        setLoopPlayback(name, shouldPlay) {
            const player = this.players?.[name];
            if (!player) {
                return;
            }
            if (shouldPlay) {
                if (!player.active) {
                    player.active = true;
                    player.audio.play().catch(() => {
                        player.active = false;
                    });
                }
                return;
            }
            if (player.active) {
                player.audio.pause();
                player.active = false;
            }
            if (player.audio.currentTime > 0.05) {
                player.audio.currentTime = 0;
            }
        }

        setPlayerTarget(name, value) {
            const player = this.players?.[name];
            if (!player) {
                return;
            }
            player.target = Math.max(0, Math.min(1, value));
        }

        smoothPlayerVolume(name, factor = 0.08) {
            const player = this.players?.[name];
            if (!player) {
                return 0;
            }
            player.volume += (player.target - player.volume) * factor;
            player.audio.volume = Math.max(0, Math.min(1, player.volume));
            this.setLoopPlayback(name, player.target > 0.012 || player.volume > 0.018);
            return player.volume;
        }

        computeShelterMix() {
            if (!this.world || !this.renderer) {
                return 0;
            }
            const listener = { x: this.renderer.cameraX, y: this.renderer.cameraY };
            const roofedTypes = new Set(['hut', 'cottage', 'house', 'warehouse', 'granary', 'kitchen', 'foodHall', 'civicComplex']);
            const nearbyRoof = this.world.buildings.some((building) =>
                roofedTypes.has(building.type) &&
                Math.hypot(building.x - listener.x, building.y - listener.y) < 70
            );
            const campShelter = Math.hypot(this.world.camp.x - listener.x, this.world.camp.y - listener.y) < 64
                ? Math.min(1, (this.world.camp.shelter || 0) / 100)
                : 0;
            return Math.max(nearbyRoof ? 0.78 : 0, campShelter * 0.68);
        }

        triggerThunder(intensity) {
            if (!this.thunderPool.length) {
                return;
            }
            const clip = this.thunderPool.find((entry) => entry.paused || entry.ended) || this.thunderPool[0];
            clip.pause();
            clip.currentTime = 0;
            clip.volume = Math.max(0.16, Math.min(0.9, 0.26 + intensity * 0.52));
            clip.play().catch(() => {});
            this.debugState.thunder = intensity;
        }

        scheduleNextStormThunder(intensity) {
            const clamped = Math.max(0, Math.min(1, intensity || 0));
            this.nextStormThunderGap = Math.max(3.2, 7.4 - clamped * 2.2 + Math.random() * 4.1);
        }

        update() {
            if (!this.debugState.enabled) {
                return;
            }
            this.ensurePlayers();
            if (!this.players) {
                return;
            }
            const weather = this.world.getWeatherState();
            const weatherType = weather.type || this.world.getWeather().name || 'Clear';
            const shelterMix = this.computeShelterMix();
            const rainAmount = weatherType === 'Rain' ? (weather.precipitationIntensity || weather.intensity || 0) : 0;
            const windAmount = Math.min(1, Math.hypot(weather.windX, weather.windY) * 1.12 + weather.darkness * 0.36 + (weather.gustStrength || 0) * 0.22);
            const stormAmount = weatherType === 'Storm'
                ? Math.max(weather.intensity, weather.darkness * 2.2, windAmount)
                : 0;

            const backgroundTarget = 0.07;
            let windTarget = 0;
            let rainTarget = 0;
            let stormTarget = 0;
            if (weatherType === 'Cloudy' || weatherType === 'Cold Snap') {
                windTarget = 0.05 + windAmount * 0.1 * (1 - shelterMix * 0.28);
            } else if (weatherType === 'Rain') {
                rainTarget = rainAmount * (0.08 + (1 - shelterMix) * 0.18);
            } else if (weatherType === 'Storm') {
                stormTarget = 0.1 + stormAmount * 0.2 * (1 - shelterMix * 0.22);
            }
            const roofRainTarget = weatherType === 'Rain' ? rainAmount * shelterMix * 0.04 : 0;

            this.setPlayerTarget('background', backgroundTarget);
            this.setPlayerTarget('wind', windTarget);
            this.setPlayerTarget('rain', rainTarget);
            this.setPlayerTarget('storm', stormTarget);

            const timeNow = performance.now() / 1000;
            const timeSinceThunder = timeNow - this.lastThunderAt;
            const lightningDelta = weather.lightningFlash - this.lastLightningFlash;
            if (lightningDelta > 0.28 && weather.lightningFlash > 0.52 && timeSinceThunder > 3.6) {
                const thunderChance = Math.max(0.08, Math.min(0.42, 0.06 + weather.lightningFlash * 0.18 + stormAmount * 0.1));
                if (Math.random() < thunderChance) {
                    this.triggerThunder(Math.max(weather.lightningFlash, weather.intensity));
                    this.lastThunderAt = timeNow;
                }
                this.scheduleNextStormThunder(stormAmount);
            } else if (stormAmount > 0.34 && timeSinceThunder > this.nextStormThunderGap) {
                this.triggerThunder(0.24 + stormAmount * 0.44);
                this.lastThunderAt = timeNow;
                this.scheduleNextStormThunder(stormAmount);
            } else {
                this.debugState.thunder = Math.max(0, this.debugState.thunder - 0.03);
            }
            this.lastLightningFlash = weather.lightningFlash;

            const background = this.smoothPlayerVolume('background');
            const wind = this.smoothPlayerVolume('wind');
            const rain = this.smoothPlayerVolume('rain');
            const storm = this.smoothPlayerVolume('storm');

            this.debugState.contextState = 'html-audio-running';
            this.debugState.shelterMix = Number(shelterMix.toFixed(2));
            this.debugState.wind = Number((wind + storm).toFixed(3));
            this.debugState.rain = Number(rain.toFixed(3));
            this.debugState.roofRain = Number(roofRainTarget.toFixed(3));
            this.debugState.snow = 0;
            this.debugState.insects = 0;
            this.debugState.music = Number(background.toFixed(3));
            this.debugState.musicMode =
                weatherType === 'Storm' ? 'storm-drone' :
                weatherType === 'Cold Snap' ? 'winter-hush' :
                weatherType === 'Rain' ? 'rain-drift' :
                'camp-ambient';
            void storm;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('game-canvas');
        const canvasContainer = document.getElementById('canvas-container');
        const initialRunSnapshot = loadCurrentRunSnapshot();
        let world = initialRunSnapshot
            ? PhaseOneSim.PhaseOneWorld.fromSaveState(initialRunSnapshot)
            : new PhaseOneSim.PhaseOneWorld(1337, loadLineageMemory());
        const renderer = new PhaseOneSim.PhaseOneRenderer(canvas, world);
        const ui = new PhaseOneSim.PhaseOneUI(world, renderer);
        const ambientAudio = new AmbientAudioController(world, renderer);
        let manualStepping = false;
        let extinctionHandled = false;
        let resizeTick = null;
        let resizeObserver = null;
        let lastAutosaveElapsed = world.elapsed || 0;
        let audioUpdateAccumulator = 0;
        const audioUpdateInterval = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches ? 0.12 : 0.05;
        let savePersistenceSuppressed = false;
        const gestureBlocker = (event) => {
            event.preventDefault();
        };

        function readLocalJson(key) {
            try {
                const raw = window.localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        }

        function writeLocalJson(key, value) {
            try {
                window.localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        }

        function loadLineageMemory() {
            return readLocalJson(LINEAGE_SAVE_KEY);
        }

        function saveLineageMemory(memory) {
            writeLocalJson(LINEAGE_SAVE_KEY, memory);
        }

        function loadCurrentRunSnapshot() {
            const snapshot = readLocalJson(RUN_SAVE_KEY);
            if (!snapshot || snapshot.version !== RUN_SAVE_VERSION || !snapshot.world) {
                return null;
            }
            return snapshot;
        }

        function getCurrentRunSaveMetadata() {
            const metadata = readLocalJson(RUN_SAVE_META_KEY);
            if (!metadata) {
                return null;
            }
            const savedAtLabel = metadata.savedAt
                ? new Date(metadata.savedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                })
                : 'time unknown';
            return {
                ...metadata,
                savedAtLabel
            };
        }

        function persistRunSaveMetadata(metadata) {
            if (!metadata) {
                return true;
            }
            const existing = readLocalJson(RUN_SAVE_META_KEY);
            const shouldOverwrite =
                metadata.type === 'manual' ||
                !existing ||
                existing.type !== 'manual';
            return shouldOverwrite ? writeLocalJson(RUN_SAVE_META_KEY, metadata) : true;
        }

        function saveCurrentRunState(saveType = 'manual', announce = true) {
            if (savePersistenceSuppressed && saveType !== 'manual') {
                return null;
            }
            const snapshot = world.exportSaveState(saveType);
            snapshot.version = RUN_SAVE_VERSION;
            if (!writeLocalJson(RUN_SAVE_KEY, snapshot) || !persistRunSaveMetadata(snapshot.metadata)) {
                if (announce) {
                    world.pushEvent('Failed to save the current run to local storage.');
                    ui.refresh(true);
                }
                return null;
            }
            savePersistenceSuppressed = false;
            lastAutosaveElapsed = world.elapsed || 0;
            if (announce) {
                world.pushEvent(
                    `${saveType === 'autosave' ? 'Autosaved' : 'Saved'} current run at year ${world.year}, day ${world.day}.`
                );
                ui.refresh(true);
            }
            return snapshot.metadata;
        }

        function loadCurrentRunState(announce = false) {
            const snapshot = loadCurrentRunSnapshot();
            if (!snapshot) {
                if (announce) {
                    world.pushEvent('No saved run found in local storage.');
                    ui.refresh(true);
                }
                return false;
            }
            const nextWorld = PhaseOneSim.PhaseOneWorld.fromSaveState(snapshot);
            swapWorld(nextWorld);
            savePersistenceSuppressed = false;
            lastAutosaveElapsed = nextWorld.elapsed || 0;
            nextWorld.pushEvent(
                `Loaded ${snapshot.metadata?.type === 'autosave' ? 'autosave' : 'saved run'} from year ${nextWorld.year}, day ${nextWorld.day}.`
            );
            ui.refresh(true);
            return true;
        }

        function clearLineageMemory() {
            try {
                window.localStorage.removeItem(LINEAGE_SAVE_KEY);
                world.pushEvent('Cleared saved lineage memory from local storage.');
                ui.refresh(true);
            } catch {
                world.pushEvent('Failed to clear saved lineage memory.');
                ui.refresh(true);
            }
        }

        function clearAllSavedData() {
            try {
                const keysToRemove = [];
                for (let index = 0; index < window.localStorage.length; index += 1) {
                    const key = window.localStorage.key(index);
                    if (key && key.startsWith(SAVE_PREFIX)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach((key) => window.localStorage.removeItem(key));
                savePersistenceSuppressed = true;
                lastAutosaveElapsed = world.elapsed || 0;
                world.pushEvent('Cleared all AI Civ Sim local saves. Autosave is paused until a manual save or load.');
                ui.refresh(true);
            } catch {
                world.pushEvent('Failed to clear local save data.');
                ui.refresh(true);
            }
        }

        function swapWorld(nextWorld) {
            world = nextWorld;
            renderer.world = nextWorld;
            ui.world = nextWorld;
            ambientAudio.setWorldAndRenderer(nextWorld, renderer);
            renderer.centerOn(nextWorld.camp.x, nextWorld.camp.y);
            renderer.render();
            ui.refresh(true);
            window.phaseOneWorld = nextWorld;
            lastAutosaveElapsed = nextWorld.elapsed || 0;
        }

        function respawnFromLineage(memory) {
            saveLineageMemory(memory);
            const nextWorld = new PhaseOneSim.PhaseOneWorld(1337, memory);
            nextWorld.pushEvent(`Generation ${nextWorld.generation} autoloaded from extinction memory.`);
            swapWorld(nextWorld);
            extinctionHandled = false;
        }

        function resizeCanvas() {
            resizeTick = null;
            renderer.resize();
            renderer.centerOn(world.camp.x, world.camp.y);
            renderer.render();
            ui.refresh(true);
        }

        function scheduleResize() {
            if (resizeTick !== null) {
                window.cancelAnimationFrame(resizeTick);
            }
            resizeTick = window.requestAnimationFrame(resizeCanvas);
        }

        let running = true;
        let lastTime = performance.now();
        let lastUpdateDurationMs = 0;
        let lastUiDurationMs = 0;
        let lastPerfLogAt = 0;

        function getFrameStepProfile() {
            const coarsePointer = typeof window.matchMedia === 'function'
                ? window.matchMedia('(pointer: coarse)').matches
                : false;
            const mobile = coarsePointer || Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 820;
            const dense = world.colonists.length >= 32;
            const veryDense = world.colonists.length >= 40;
            const fastSim = world.simulationSpeed >= 4;
            return {
                maxSlices: mobile
                    ? (veryDense || fastSim ? 2 : dense ? 3 : 4)
                    : (veryDense || fastSim ? 4 : dense ? 5 : 6)
            };
        }

        function step(dt) {
            const fixed = 1 / 30;
            let remaining = Math.min(0.5, Math.max(0, dt));
            const updateStart = performance.now();
            const frameProfile = getFrameStepProfile();
            let slices = 0;
            const aggregatedBreakdown = {};
            while (remaining > 0 && slices < frameProfile.maxSlices) {
                const slice = Math.min(fixed, remaining);
                world.update(slice);
                const sliceBreakdown = world.performanceTelemetry?.updateBreakdown || {};
                Object.entries(sliceBreakdown).forEach(([key, value]) => {
                    aggregatedBreakdown[key] = (aggregatedBreakdown[key] || 0) + Number(value || 0);
                });
                remaining -= slice;
                slices += 1;
            }
            if (remaining > 0) {
                world.performanceTelemetry.droppedUpdateTime = Number(remaining.toFixed(3));
            } else {
                world.performanceTelemetry.droppedUpdateTime = 0;
            }
            let hottestUpdateSection = null;
            let hottestUpdateMs = 0;
            Object.entries(aggregatedBreakdown).forEach(([key, value]) => {
                const rounded = Number(value.toFixed(2));
                aggregatedBreakdown[key] = rounded;
                if (rounded > hottestUpdateMs) {
                    hottestUpdateMs = rounded;
                    hottestUpdateSection = key;
                }
            });
            world.performanceTelemetry.updateBreakdown = aggregatedBreakdown;
            world.performanceTelemetry.hottestUpdateSection = hottestUpdateSection;
            world.performanceTelemetry.hottestUpdateMs = Number(hottestUpdateMs.toFixed(2));
            world.performanceTelemetry.sliceCount = slices;
            world.performanceTelemetry.fixedStep = fixed;
            world.performanceTelemetry.maxSlices = frameProfile.maxSlices;
            if (remaining > 0) {
                world.performanceTelemetry.lastCatchupDropAt = performance.now();
            }
            lastUpdateDurationMs = performance.now() - updateStart;
            if (world.colonists.length === 0 && world.extinctionSnapshot && !extinctionHandled) {
                extinctionHandled = true;
                respawnFromLineage(world.extinctionSnapshot);
            }
            if ((world.elapsed || 0) - lastAutosaveElapsed >= AUTOSAVE_INTERVAL) {
                saveCurrentRunState('autosave', false);
            }
            renderer.render();
            lastUiDurationMs = ui.refresh() || 0;
        }

        function frame(now) {
            if (!running) {
                return;
            }
            const dt = (now - lastTime) / 1000;
            const frameMs = Math.max(0, now - lastTime);
            lastTime = now;
            if (!manualStepping) {
                step(dt);
            } else {
                renderer.render();
                lastUiDurationMs = ui.refresh() || 0;
            }
            renderer.recordFrameMetrics(frameMs, lastUpdateDurationMs, lastUiDurationMs);
            if (world.debugFlags?.showPerformance && now - lastPerfLogAt >= 5000) {
                console.info('[AI Civ Sim perf]', renderer.getPerformanceSnapshot());
                lastPerfLogAt = now;
            }
            audioUpdateAccumulator += dt;
            if (audioUpdateAccumulator >= audioUpdateInterval) {
                ambientAudio.update();
                audioUpdateAccumulator = 0;
            }
            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', scheduleResize);
        [canvas, canvasContainer, document].forEach((target) => {
            if (!target?.addEventListener) {
                return;
            }
            target.addEventListener('gesturestart', gestureBlocker, { passive: false });
            target.addEventListener('gesturechange', gestureBlocker, { passive: false });
            target.addEventListener('gestureend', gestureBlocker, { passive: false });
        });
        if (typeof window.ResizeObserver === 'function' && canvasContainer) {
            resizeObserver = new window.ResizeObserver(() => {
                scheduleResize();
            });
            resizeObserver.observe(canvasContainer);
        }
        resizeCanvas();
        requestAnimationFrame(frame);
        if (initialRunSnapshot) {
            world.pushEvent(`Loaded saved run from year ${world.year}, day ${world.day}.`);
            ui.refresh(true);
        }

        window.phaseOneWorld = world;
        window.phaseOneRenderer = renderer;
        window.phaseOneUI = ui;
        window.phaseOneAudioController = ambientAudio;
        window.saveCurrentRunState = saveCurrentRunState;
        window.loadCurrentRunState = loadCurrentRunState;
        window.getCurrentRunSaveMetadata = getCurrentRunSaveMetadata;
        window.getAudioDebugState = () => ambientAudio.getDebugState();
        window.advanceTime = (ms = 16) => {
            manualStepping = true;
            step(Math.max(0, ms) / 1000);
            ambientAudio.update();
            audioUpdateAccumulator = 0;
            renderer.recordFrameMetrics(Math.max(0, ms), lastUpdateDurationMs, lastUiDurationMs);
            return Promise.resolve();
        };
        window.render_game_to_text = () => {
            try {
                const payload = JSON.parse(world.getSummaryText());
                payload.audio = ambientAudio.getDebugState();
                payload.performance = renderer.getPerformanceSnapshot();
                return JSON.stringify(payload);
            } catch {
                return world.getSummaryText();
            }
        };
        window.exportLineageMemory = () => JSON.stringify(world.exportLineageMemory(), null, 2);
        window.clearSavedLineageMemory = () => clearLineageMemory();
        window.clearAllSavedData = () => clearAllSavedData();
        window.resumeRealtimeSimulation = () => {
            manualStepping = false;
        };
        window.pauseSimulation = () => {
            running = false;
        };
        window.resumeSimulation = () => {
            if (!running) {
                running = true;
                manualStepping = false;
                lastTime = performance.now();
                requestAnimationFrame(frame);
            }
        };
        window.addEventListener('beforeunload', () => {
            if (!savePersistenceSuppressed) {
                saveCurrentRunState('autosave', false);
            }
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        });
    });
})();
