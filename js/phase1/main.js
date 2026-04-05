(function () {
    const PhaseOneSim = window.PhaseOneSim || (window.PhaseOneSim = {});
    const LINEAGE_SAVE_KEY = 'ai-civ-sim-lineage-v1';
    const RUN_SAVE_KEY = 'ai-civ-sim-run-v1';
    const RUN_SAVE_META_KEY = 'ai-civ-sim-run-meta-v1';
    const SAVE_PREFIX = 'ai-civ-sim-';
    const RUN_SAVE_VERSION = 1;
    const AUTOSAVE_INTERVAL = 45;

    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('game-canvas');
        const canvasContainer = document.getElementById('canvas-container');
        const initialRunSnapshot = loadCurrentRunSnapshot();
        let world = initialRunSnapshot
            ? PhaseOneSim.PhaseOneWorld.fromSaveState(initialRunSnapshot)
            : new PhaseOneSim.PhaseOneWorld(1337, loadLineageMemory());
        const renderer = new PhaseOneSim.PhaseOneRenderer(canvas, world);
        const ui = new PhaseOneSim.PhaseOneUI(world, renderer);
        let manualStepping = false;
        let extinctionHandled = false;
        let resizeTick = null;
        let resizeObserver = null;
        let lastAutosaveElapsed = world.elapsed || 0;
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

        function step(dt) {
            const fixed = 1 / 30;
            let remaining = Math.min(0.5, Math.max(0, dt));
            while (remaining > 0) {
                const slice = Math.min(fixed, remaining);
                world.update(slice);
                remaining -= slice;
            }
            if (world.colonists.length === 0 && world.extinctionSnapshot && !extinctionHandled) {
                extinctionHandled = true;
                respawnFromLineage(world.extinctionSnapshot);
            }
            if ((world.elapsed || 0) - lastAutosaveElapsed >= AUTOSAVE_INTERVAL) {
                saveCurrentRunState('autosave', false);
            }
            renderer.render();
            ui.refresh();
        }

        function frame(now) {
            if (!running) {
                return;
            }
            const dt = (now - lastTime) / 1000;
            lastTime = now;
            if (!manualStepping) {
                step(dt);
            } else {
                renderer.render();
                ui.refresh();
            }
            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', scheduleResize);
        canvas.addEventListener('gesturestart', gestureBlocker, { passive: false });
        canvas.addEventListener('gesturechange', gestureBlocker, { passive: false });
        canvas.addEventListener('gestureend', gestureBlocker, { passive: false });
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
        window.saveCurrentRunState = saveCurrentRunState;
        window.loadCurrentRunState = loadCurrentRunState;
        window.getCurrentRunSaveMetadata = getCurrentRunSaveMetadata;
        window.advanceTime = (ms = 16) => {
            manualStepping = true;
            step(Math.max(0, ms) / 1000);
            return Promise.resolve();
        };
        window.render_game_to_text = () => world.getSummaryText();
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
