(function () {
    const PhaseOneSim = window.PhaseOneSim || (window.PhaseOneSim = {});

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = value;
        }
    }

    function setNodeText(id, value) {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = value;
        }
    }

    function setSelectionStat(labelId, valueId, label, value) {
        const labelNode = document.getElementById(labelId);
        const valueNode = document.getElementById(valueId);
        if (labelNode && labelNode.childNodes.length > 0) {
            labelNode.childNodes[0].nodeValue = `${label}: `;
        }
        if (valueNode) {
            valueNode.textContent = value;
        }
    }

    function describePressure(world, temperature, weatherName, seasonName, averages) {
        const alerts = [];
        if (temperature < 2) alerts.push('cold exposure');
        if (weatherName === 'Drought') alerts.push('water stress');
        if (weatherName === 'Storm') alerts.push('storm damage');
        if (seasonName === 'Winter') alerts.push('winter drain');
        if (averages.hunger < 38) alerts.push('food low');
        if (averages.thirst < 42) alerts.push('thirst rising');
        if (averages.energy < 35) alerts.push('fatigue');
        return alerts.length ? alerts.join(' / ') : 'steady survival pressure';
    }

    function describeEra(era) {
        const labels = {
            survival: 'Survivalist',
            toolmaking: 'Toolmaking',
            agriculture: 'Agrarian',
            masonry: 'Masonry',
            engineering: 'Engineering',
            metallurgy: 'Metallurgy',
            'bronze age': 'Bronze Age',
            'iron age': 'Iron Age'
        };
        return labels[era] || era;
    }

    class PhaseOneUI {
        constructor(world, renderer) {
            this.world = world;
            this.renderer = renderer;
            this.lastRenderStamp = 0;
            this.activeReportId = null;
            this.dismissedReportId = null;
            this.isDragging = false;
            this.dragDistance = 0;
            this.lastPointer = null;
            this.wasCompactLayout = false;
            this.touchMode = null;
            this.touchDistance = 0;
            this.touchCenter = null;
            this.bindStaticLabels();
            this.bindButtons();
            this.bindCanvasSelection();
            this.bindResponsivePanels();
        }

        bindStaticLabels() {
            document.title = 'Dwellers';
            const title = document.querySelector('#top-bar h1');
            if (title) {
                title.textContent = 'Dwellers';
            }

            const labels = document.querySelectorAll('.need-label');
            const values = ['Hunger', 'Thirst', 'Warmth', 'Energy'];
            labels.forEach((node, index) => {
                node.textContent = values[index] || node.textContent;
            });

            setText('selection-title', 'Selection');
            setText('report-title', 'Phase Notes');
            const storageHeader = document.querySelector('#storage-banner h2');
            if (storageHeader) {
                storageHeader.textContent = 'Camp Stores';
            }

            const buttonLabels = {
                'btn-god-mode': 'Pause / Resume',
                'btn-god-focus': 'Focus View',
                'btn-spawn-food': 'Spawn Berries',
                'btn-spawn-water': 'Spawn Water',
                'btn-spawn-colonist': 'Spawn Colonist',
                'btn-aid-daughter': 'Aid Daughter',
                'btn-bless-harvest': 'Bless Harvest',
                'btn-lightning-strike': 'Lightning',
                'btn-kill-creature': 'Instill Fear',
                'btn-kill-unit': 'Kill Unit',
                'btn-infect-creature': 'Spread Sickness',
                'btn-heal-creature': 'Heal Selection',
                'btn-cure-disease': 'Disease Cure',
                'btn-disease-outbreak': 'Disease Outbreak',
                'btn-inspire-learning': 'Inspire Learning',
                'btn-calm-conflict': 'Calm Conflict',
                'btn-incite-war': 'Incite War',
                'btn-spawn-predator': 'Spawn Predator',
                'btn-create-relic': 'Create Relic',
                'btn-terraform-land': 'Terraform Land',
                'btn-protect-bubble': 'Protect Bubble',
                'btn-omen-food': 'Dream of Plenty',
                'btn-omen-water': 'Dream of Water',
                'btn-omen-defense': 'War Omen',
                'btn-omen-build': "Builder's Sign",
                'btn-omen-peace': 'Peace Omen',
                'btn-omen-expansion': 'Expansion Omen',
                'btn-save-run': 'Save Run',
                'btn-load-run': 'Load Run',
                'btn-clear-local-save': 'Clear Local Saves',
                'btn-season-slower': 'Slower Seasons',
                'btn-season-faster': 'Faster Seasons',
                'btn-weather-softer': 'Softer Weather',
                'btn-weather-harsher': 'Harsher Weather',
                'btn-abundance-lower': 'Less Abundance',
                'btn-abundance-higher': 'More Abundance',
                'btn-disease-lower': 'Lower Disease',
                'btn-disease-higher': 'Higher Disease',
                'btn-learning-slower': 'Slower Learning',
                'btn-learning-faster': 'Faster Learning',
                'btn-disaster-lower': 'Lower Disasters',
                'btn-disaster-higher': 'Higher Disasters',
                'btn-place-daughter': 'Place Daughter',
                'btn-place-rival': 'Place Rival',
                'btn-paint-grassland': 'Paint Grassland',
                'btn-paint-forest': 'Paint Forest',
                'btn-paint-rocky': 'Paint Rocky',
                'btn-paint-water': 'Paint Water',
                'btn-paint-fertile': 'Paint Fertile',
                'btn-era-survival': 'Era Survival',
                'btn-era-toolmaking': 'Era Toolmaking',
                'btn-era-agriculture': 'Era Agriculture',
                'btn-era-masonry': 'Era Masonry',
                'btn-era-engineering': 'Era Engineering',
                'btn-era-metallurgy': 'Era Metallurgy',
                'btn-era-bronze': 'Era Bronze Age',
                'btn-era-iron': 'Era Iron Age',
                'btn-toggle-storm': 'Spawn Storm',
                'btn-weather-sun': 'Clear Skies',
                'btn-weather-rain': 'Rain',
                'btn-weather-fog': 'Drought',
                'btn-weather-cloudy': 'Cloudy',
                'btn-zoom-out': '-',
                'btn-zoom-in': '+'
            };
            Object.entries(buttonLabels).forEach(([id, label]) => setText(id, label));
        }

        bindButtons() {
            const actions = {
                'btn-god-mode': () => this.world.togglePause(),
                'btn-god-focus': () => this.renderer.centerOn(this.world.camp.x, this.world.camp.y),
                'btn-spawn-food': () => this.world.spawnFoodNearCamp(),
                'btn-spawn-water': () => this.world.spawnWaterSourceNearSelection(),
                'btn-spawn-colonist': () => this.world.addColonist(),
                'btn-aid-daughter': () => this.world.sendAidToSelectedDaughterColony(),
                'btn-bless-harvest': () => this.world.blessHarvest(),
                'btn-lightning-strike': () => this.world.lightningStrikeSelected(),
                'btn-kill-creature': () => this.world.instillFearKnowledgeOnSelectedColonist(),
                'btn-kill-unit': () => this.world.killSelectedUnit(),
                'btn-infect-creature': () => this.world.triggerDiseaseOutbreak(),
                'btn-heal-creature': () => this.world.healSelectedUnit(),
                'btn-cure-disease': () => this.world.cureDisease(),
                'btn-disease-outbreak': () => this.world.triggerDiseaseOutbreak(),
                'btn-inspire-learning': () => this.world.inspireLearning(),
                'btn-calm-conflict': () => this.world.calmConflict(),
                'btn-incite-war': () => this.world.inciteWar(),
                'btn-spawn-predator': () => this.world.spawnPredatorNearCamp(),
                'btn-create-relic': () => this.world.createRelicObjective(),
                'btn-terraform-land': () => this.world.terraformLandAtSelection(),
                'btn-protect-bubble': () => this.world.protectColonyBubble(),
                'btn-omen-food': () => this.world.sendOmenOfPlenty(),
                'btn-omen-water': () => this.world.sendOmenOfWater(),
                'btn-omen-defense': () => this.world.sendWarOmen(),
                'btn-omen-build': () => this.world.sendBuildersSign(),
                'btn-omen-peace': () => this.world.sendPeaceOmen(),
                'btn-omen-expansion': () => this.world.sendExpansionOmen(),
                'btn-save-run': () => {
                    if (typeof window.saveCurrentRunState === 'function') {
                        window.saveCurrentRunState('manual');
                    }
                },
                'btn-load-run': () => {
                    if (typeof window.loadCurrentRunState === 'function') {
                        window.loadCurrentRunState(true);
                    }
                },
                'btn-clear-local-save': () => {
                    if (typeof window.clearAllSavedData === 'function') {
                        window.clearAllSavedData();
                    }
                },
                'btn-season-slower': () => this.world.adjustSimulationKnob('seasonPace', -0.15),
                'btn-season-faster': () => this.world.adjustSimulationKnob('seasonPace', 0.15),
                'btn-weather-softer': () => this.world.adjustSimulationKnob('weatherSeverity', -0.15),
                'btn-weather-harsher': () => this.world.adjustSimulationKnob('weatherSeverity', 0.15),
                'btn-abundance-lower': () => this.world.adjustSimulationKnob('resourceAbundance', -0.15),
                'btn-abundance-higher': () => this.world.adjustSimulationKnob('resourceAbundance', 0.15),
                'btn-disease-lower': () => this.world.adjustSimulationKnob('diseasePressure', -0.15),
                'btn-disease-higher': () => this.world.adjustSimulationKnob('diseasePressure', 0.15),
                'btn-learning-slower': () => this.world.adjustSimulationKnob('learningRate', -0.15),
                'btn-learning-faster': () => this.world.adjustSimulationKnob('learningRate', 0.15),
                'btn-disaster-lower': () => this.world.adjustSimulationKnob('disasterFrequency', -0.15),
                'btn-disaster-higher': () => this.world.adjustSimulationKnob('disasterFrequency', 0.15),
                'btn-place-daughter': () => this.world.placeFactionAtSelection('daughter'),
                'btn-place-rival': () => this.world.placeFactionAtSelection('splinter'),
                'btn-paint-grassland': () => this.world.paintTerrainAtSelection('grassland'),
                'btn-paint-forest': () => this.world.paintTerrainAtSelection('forest'),
                'btn-paint-rocky': () => this.world.paintTerrainAtSelection('rocky'),
                'btn-paint-water': () => this.world.paintTerrainAtSelection('water'),
                'btn-paint-fertile': () => this.world.paintTerrainAtSelection('fertile'),
                'btn-era-survival': () => this.world.setStartingEra('survival'),
                'btn-era-toolmaking': () => this.world.setStartingEra('toolmaking'),
                'btn-era-agriculture': () => this.world.setStartingEra('agriculture'),
                'btn-era-masonry': () => this.world.setStartingEra('masonry'),
                'btn-era-engineering': () => this.world.setStartingEra('engineering'),
                'btn-era-metallurgy': () => this.world.setStartingEra('metallurgy'),
                'btn-era-bronze': () => this.world.setStartingEra('bronzeAge'),
                'btn-era-iron': () => this.world.setStartingEra('ironAge'),
                'btn-toggle-storm': () => this.world.applyWeather('Storm'),
                'btn-weather-sun': () => this.world.applyWeather('Clear'),
                'btn-weather-rain': () => this.world.applyWeather('Rain'),
                'btn-weather-fog': () => this.world.applyWeather('Drought'),
                'btn-weather-cloudy': () => this.world.applyWeather('Cloudy'),
                'btn-zoom-out': () => {
                    const cx = this.renderer.viewportWidth * 0.5;
                    const cy = this.renderer.viewportHeight * 0.5;
                    this.renderer.zoomAt(cx, cy, 0.88);
                    this.renderer.render();
                    this.refresh(true);
                },
                'btn-zoom-in': () => {
                    const cx = this.renderer.viewportWidth * 0.5;
                    const cy = this.renderer.viewportHeight * 0.5;
                    this.renderer.zoomAt(cx, cy, 1.12);
                    this.renderer.render();
                    this.refresh(true);
                }
            };

            Object.entries(actions).forEach(([id, handler]) => {
                const node = document.getElementById(id);
                if (node) {
                    node.addEventListener('click', handler);
                }
            });

            document.querySelectorAll('.time-button').forEach((button) => {
                button.addEventListener('click', () => {
                    const speed = Number(button.dataset.speed || 1);
                    this.world.setSpeed(speed);
                    document.querySelectorAll('.time-button').forEach((candidate) => {
                        candidate.classList.toggle('is-active', candidate === button);
                    });
                });
            });

            document.querySelectorAll('.panel-toggle').forEach((button) => {
                button.addEventListener('click', () => {
                    const targetId = button.dataset.target;
                    const target = targetId ? document.getElementById(targetId) : button.closest('.overlay-panel');
                    if (!target) {
                        return;
                    }
                    const collapsed = target.classList.toggle('is-collapsed');
                    button.textContent = collapsed ? '+' : '-';
                    button.setAttribute('aria-expanded', String(!collapsed));
                });
            });

            document.querySelectorAll('.god-tab').forEach((button) => {
                button.addEventListener('click', () => this.setGodTab(button.dataset.godTab || 'powers'));
            });

            const devPanel = document.getElementById('dev-panel');
            if (devPanel) {
                devPanel.style.display = 'none';
            }
            const reportClose = document.getElementById('report-close');
            if (reportClose) {
                reportClose.addEventListener('click', () => this.hideBattleReport());
            }
        }

        bindCanvasSelection() {
            this.renderer.canvas.addEventListener('mousedown', (event) => {
                if (event.button !== 0) {
                    return;
                }
                this.isDragging = true;
                this.dragDistance = 0;
                this.lastPointer = { x: event.clientX, y: event.clientY };
            });

            this.renderer.canvas.addEventListener('mousemove', (event) => {
                if (!this.isDragging || !this.lastPointer) {
                    return;
                }
                const dx = event.clientX - this.lastPointer.x;
                const dy = event.clientY - this.lastPointer.y;
                this.dragDistance += Math.abs(dx) + Math.abs(dy);
                this.renderer.panBy(dx, dy);
                this.lastPointer = { x: event.clientX, y: event.clientY };
                this.renderer.render();
                this.refresh(true);
            });

            const stopDrag = () => {
                this.isDragging = false;
                this.lastPointer = null;
            };
            window.addEventListener('mouseup', stopDrag);
            this.renderer.canvas.addEventListener('mouseleave', stopDrag);

            this.renderer.canvas.addEventListener('wheel', (event) => {
                event.preventDefault();
                const rect = this.renderer.canvas.getBoundingClientRect();
                const screenX = event.clientX - rect.left;
                const screenY = event.clientY - rect.top;
                const zoomFactor = event.deltaY < 0 ? 1.12 : 0.89;
                this.renderer.zoomAt(screenX, screenY, zoomFactor);
                this.renderer.render();
                this.refresh(true);
            }, { passive: false });

            this.renderer.canvas.addEventListener('click', (event) => {
                if (this.dragDistance > 6) {
                    this.dragDistance = 0;
                    return;
                }
                const rect = this.renderer.canvas.getBoundingClientRect();
                const worldPoint = this.renderer.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
                this.world.selectAt(worldPoint.x, worldPoint.y);
                this.renderSelection();
                this.renderGodDrawer();
            });

            this.renderer.canvas.addEventListener('touchstart', (event) => {
                if (event.touches.length === 1) {
                    const touch = event.touches[0];
                    this.touchMode = 'pan';
                    this.dragDistance = 0;
                    this.lastPointer = { x: touch.clientX, y: touch.clientY };
                } else if (event.touches.length === 2) {
                    this.touchMode = 'pinch';
                    this.touchDistance = this.getTouchDistance(event.touches);
                    this.touchCenter = this.getTouchCenter(event.touches);
                    this.lastPointer = null;
                }
                event.preventDefault();
            }, { passive: false });

            this.renderer.canvas.addEventListener('touchmove', (event) => {
                if (this.touchMode === 'pan' && event.touches.length === 1 && this.lastPointer) {
                    const touch = event.touches[0];
                    const dx = touch.clientX - this.lastPointer.x;
                    const dy = touch.clientY - this.lastPointer.y;
                    this.dragDistance += Math.abs(dx) + Math.abs(dy);
                    this.renderer.panBy(dx, dy);
                    this.lastPointer = { x: touch.clientX, y: touch.clientY };
                    this.renderer.render();
                    this.refresh(true);
                } else if (event.touches.length === 2) {
                    const nextDistance = this.getTouchDistance(event.touches);
                    const nextCenter = this.getTouchCenter(event.touches);
                    if (this.touchDistance > 0 && this.touchCenter) {
                        const zoomFactor = clamp(nextDistance / this.touchDistance, 0.92, 1.08);
                        const rect = this.renderer.canvas.getBoundingClientRect();
                        this.renderer.zoomAt(nextCenter.x - rect.left, nextCenter.y - rect.top, zoomFactor);
                        this.renderer.panBy(nextCenter.x - this.touchCenter.x, nextCenter.y - this.touchCenter.y);
                        this.renderer.render();
                        this.refresh(true);
                    }
                    this.touchMode = 'pinch';
                    this.touchDistance = nextDistance;
                    this.touchCenter = nextCenter;
                    this.lastPointer = null;
                }
                event.preventDefault();
            }, { passive: false });

            this.renderer.canvas.addEventListener('touchend', (event) => {
                if (this.touchMode === 'pan' && event.touches.length === 0 && this.lastPointer && this.dragDistance <= 10) {
                    const rect = this.renderer.canvas.getBoundingClientRect();
                    const worldPoint = this.renderer.screenToWorld(this.lastPointer.x - rect.left, this.lastPointer.y - rect.top);
                    this.world.selectAt(worldPoint.x, worldPoint.y);
                    this.renderSelection();
                    this.renderGodDrawer();
                }
                if (event.touches.length < 2) {
                    this.touchDistance = 0;
                    this.touchCenter = null;
                }
                if (event.touches.length === 0) {
                    this.touchMode = null;
                    this.lastPointer = null;
                    this.dragDistance = 0;
                }
                event.preventDefault();
            }, { passive: false });

            this.renderer.canvas.addEventListener('touchcancel', (event) => {
                this.touchMode = null;
                this.touchDistance = 0;
                this.touchCenter = null;
                this.isDragging = false;
                this.lastPointer = null;
                this.dragDistance = 0;
                event.preventDefault();
            }, { passive: false });
        }

        getTouchDistance(touches) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.hypot(dx, dy);
        }

        getTouchCenter(touches) {
            return {
                x: (touches[0].clientX + touches[1].clientX) * 0.5,
                y: (touches[0].clientY + touches[1].clientY) * 0.5
            };
        }

        bindResponsivePanels() {
            const applyCompactState = () => {
                const compact = window.innerWidth <= 1400 || window.matchMedia('(pointer: coarse)').matches;
                if (compact && !this.wasCompactLayout) {
                    this.setPanelCollapsed('thought-rail', true);
                    this.setPanelCollapsed('log-panel', true);
                }
                this.wasCompactLayout = compact;
            };
            window.addEventListener('resize', applyCompactState);
            applyCompactState();
        }

        setPanelCollapsed(targetId, collapsed) {
            const target = document.getElementById(targetId);
            if (!target) {
                return;
            }
            target.classList.toggle('is-collapsed', collapsed);
            const button = document.querySelector(`.panel-toggle[data-target="${targetId}"]`);
            if (button) {
                button.textContent = collapsed ? '+' : '-';
                button.setAttribute('aria-expanded', String(!collapsed));
            }
        }

        refresh(force) {
            const now = performance.now();
            if (!force && now - this.lastRenderStamp < 120) {
                return;
            }
            this.lastRenderStamp = now;

            const averages = this.world.getAverages();
            const weather = this.world.getWeather();
            const season = this.world.getSeason();
            const camp = this.world.camp;

            setText('current-generation', String(this.world.generation));
            setText('current-year', String(this.world.year));
            setText('current-season', season.name);
            setText('current-weather', weather.name);
            setText('current-era', describeEra(this.world.getCurrentEra()));
            setText('total-population', String(this.world.colonists.length));

            this.updateNeedBar('need-food', averages.hunger);
            this.updateNeedBar('need-build', averages.thirst);
            this.updateNeedBar('need-care', averages.warmth);
            this.updateNeedBar('need-defense', averages.energy);

            const temperature = this.world.getTemperatureAt(camp.x, camp.y);
            const pressureSummary = describePressure(this.world, temperature, weather.name, season.name, averages);
            setText('need-order', `Pressure: ${pressureSummary} | ${weather.name}, ${temperature.toFixed(1)}C at camp, day ${this.world.day}`);
            const toolCount = camp.items.length + this.world.colonists.reduce(
                (sum, colonist) => sum + Object.values(colonist.equipment).filter(Boolean).length,
                0
            );
            const storageParts = [
                `Food ${camp.food.toFixed(0)}`,
                `Water ${camp.water.toFixed(0)}`,
                `Logs ${camp.materials.logs.toFixed(0)}`
            ];
            if (this.world.shouldRevealCampStore('fiber')) {
                storageParts.push(`Fiber ${camp.materials.fiber.toFixed(0)}`);
            }
            if (this.world.shouldRevealCampStore('planks')) {
                storageParts.push(`Planks ${camp.materials.planks.toFixed(0)}`);
            }
            if (this.world.shouldRevealCampStore('rope')) {
                storageParts.push(`Rope ${camp.materials.rope.toFixed(0)}`);
            }
            if (this.world.shouldRevealCampStore('tools')) {
                storageParts.push(`Tools ${toolCount}`);
            }
            setText('storage-value', storageParts.join(' | '));

            this.renderThoughts();
            this.renderEvents();
            this.renderSelection();
            this.renderGodDrawer();
            this.renderBattlefieldPanel();
            this.renderBattleReport();
            this.renderSaveStatus();
        }

        renderBattlefieldPanel() {
            const panel = document.getElementById('battle-panel');
            if (!panel) {
                return;
            }
            const activeFront = (this.world.battlefronts || [])
                .filter((entry) => !entry.resolved && entry.ttl > 0)
                .sort((left, right) => (right.scale || 0) - (left.scale || 0))[0] || null;
            if (!activeFront) {
                panel.classList.add('is-hidden');
                setNodeText('battle-meta', 'No active battles.');
                const list = document.getElementById('battle-summary');
                if (list) {
                    list.innerHTML = '';
                }
                return;
            }

            panel.classList.remove('is-hidden');
            const title = activeFront.reportType === 'large battle' ? 'Battlefield' : 'Skirmish Line';
            setText('battle-title', title);
            const theater = activeFront.mode === 'outbound'
                ? 'Main settlement attacking'
                : activeFront.mode === 'intercolonial'
                ? `${activeFront.colonyName} attacking`
                : `${activeFront.colonyName} attacking`;
            const theaterTarget = activeFront.mode === 'intercolonial'
                ? activeFront.defenderColonyName || activeFront.targetColonyName || activeFront.targetBuildingType || 'frontier colony'
                : activeFront.colonyName || activeFront.targetColonyName || activeFront.targetBuildingType || 'frontier line';
            setNodeText(
                'battle-meta',
                `${theater} • ${theaterTarget} • Year ${this.world.year}, Day ${this.world.day}`
            );
            const attackerPct = Math.round((activeFront.attackerHealth / Math.max(1, activeFront.attackerMaxHealth || 1)) * 100);
            const defenderPct = Math.round((activeFront.defenderHealth / Math.max(1, activeFront.defenderMaxHealth || 1)) * 100);
            const pressure = attackerPct - defenderPct;
            const lineState = pressure > 24
                ? 'Attackers pressing the line'
                : pressure < -24
                    ? 'Defenders stabilizing'
                    : 'Line contested';
            const detailLines = [
                `Target: ${activeFront.targetBuildingType || 'frontier line'}`,
                `Tactics: ${activeFront.tactics?.attacker || 'attack'} vs ${activeFront.tactics?.defender || 'defend'}`,
                `Force state: attackers ${attackerPct}% / defenders ${defenderPct}%`,
                `Casualties: attackers ${activeFront.attackerCasualties || 0} / defenders ${activeFront.defenderCasualties || 0}`,
                `Pressure: ${lineState}`,
                `Breakthrough: ${activeFront.breakthroughDamage?.length ? activeFront.breakthroughDamage.join(', ') : 'not yet'}`
            ];
            if (activeFront.surpriseTriggered) {
                detailLines.push('Surprise: defenders were caught before fully forming.');
            }
            const list = document.getElementById('battle-summary');
            if (list) {
                list.innerHTML = detailLines.map((line) => `<li>${line}</li>`).join('');
            }
        }

        renderSaveStatus() {
            const metadata = typeof window.getCurrentRunSaveMetadata === 'function'
                ? window.getCurrentRunSaveMetadata()
                : null;
            const lines = metadata ? [
                `Saved run: Year ${metadata.year}, Day ${metadata.day}`,
                `Generation ${metadata.generation} | Population ${metadata.population}`,
                `${metadata.type === 'autosave' ? 'Autosave' : 'Manual save'} | ${metadata.savedAtLabel || 'time unknown'}`
            ] : ['No saved run.'];
            setNodeText('save-status', lines.join('\n'));
        }

        updateNeedBar(id, value) {
            const fill = document.getElementById(id);
            const label = document.getElementById(`${id}-value`);
            const percent = `${Math.round(value)}%`;
            if (fill) {
                fill.style.width = percent;
            }
            if (label) {
                label.textContent = percent;
            }
        }

        renderThoughts() {
            const feed = document.getElementById('thought-feed');
            if (!feed) {
                return;
            }
            feed.innerHTML = this.world.thoughts.map((line) => `<li>${line}</li>`).join('');
        }

        renderEvents() {
            const log = document.getElementById('event-log');
            if (!log) {
                return;
            }
            log.innerHTML = this.world.events.map((line) => `<li>${line}</li>`).join('');
        }

        hideBattleReport() {
            const modal = document.getElementById('report-modal');
            if (!modal) {
                return;
            }
            modal.classList.remove('is-visible');
            modal.dataset.open = 'false';
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
            modal.style.transform = 'translateY(-10px)';
            this.dismissedReportId = this.activeReportId;
            this.activeReportId = null;
        }

        renderBattleReport() {
            const modal = document.getElementById('report-modal');
            if (!modal) {
                return;
            }
            const latest = (this.world.battleReports || []).find((entry) => entry.popup) || null;
            if (!latest) {
                modal.classList.remove('is-visible');
                modal.dataset.open = 'false';
                modal.style.display = 'none';
                this.activeReportId = null;
                return;
            }
            if (this.dismissedReportId === latest.id && this.activeReportId !== latest.id) {
                return;
            }
            this.activeReportId = latest.id;
            const reportTitle = latest.type === 'era'
                ? 'Era Report'
                : latest.type === 'skirmish'
                    ? 'Skirmish Report'
                    : 'Battle Report';
            setText('report-title', reportTitle);
            setNodeText(
                'report-meta',
                `${latest.colonyName || 'Unknown'} • Year ${latest.year}, Day ${latest.day}${latest.targetBuildingType ? ` • ${latest.targetBuildingType}` : ''}`
            );
            const list = document.getElementById('report-list');
            if (list) {
                const details = latest.detailLines || [
                    `Outcome: ${latest.outcome || 'unknown'}`,
                    latest.tactic ? `Doctrine: ${latest.tactic}` : null,
                    latest.warfareMethod ? `Method: ${latest.warfareMethod}` : null,
                    `Attackers: ${latest.attackerCount || 0}`,
                    `Defenders: ${latest.defenderCount || 0}`
                ].filter(Boolean);
                list.innerHTML = details.map((entry) => `<li>${entry}</li>`).join('');
            }
            modal.classList.add('is-visible');
            modal.dataset.open = 'true';
            modal.style.display = 'block';
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            modal.style.transform = 'translateY(0)';
        }

        renderSelection() {
            const selected = this.world.selectedEntity;
            const panel = document.getElementById('stats-panel');
            const godPanel = document.getElementById('sidebar');
            if (!panel) {
                return;
            }
            const godDrawerOpen = godPanel && !godPanel.classList.contains('is-collapsed');
            panel.classList.toggle('is-hidden', !selected || godDrawerOpen);
            if (!selected) {
                return;
            }
            if (godDrawerOpen) {
                return;
            }

            if (selected === this.world.camp) {
                setText('selection-title', 'Camp');
                setSelectionStat('stat-label-a', 'stat-energy', 'Fire Fuel', `${this.world.camp.fireFuel.toFixed(0)}`);
                setSelectionStat('stat-label-b', 'stat-hunger', 'Food', `${this.world.camp.food.toFixed(0)}`);
                setSelectionStat('stat-label-c', 'stat-fun', 'Water', `${this.world.camp.water.toFixed(0)}`);
                setSelectionStat('stat-label-d', 'stat-age', 'Shelter', `${this.world.camp.shelter.toFixed(0)}`);
                setSelectionStat('stat-label-e', 'stat-trait', 'Role', 'Camp heart / warmth anchor');
                return;
            }

            if (selected.entityType === 'project') {
                setText('selection-title', `Project: ${selected.type}`);
                setSelectionStat('stat-label-a', 'stat-energy', 'Progress', `${selected.buildProgress.toFixed(1)} / ${selected.buildTime.toFixed(1)}`);
                setSelectionStat('stat-label-b', 'stat-hunger', 'Materials', Object.entries(selected.delivered).map(([key, value]) => `${key} ${value}`).join(', ') || 'No materials needed');
                setSelectionStat('stat-label-c', 'stat-fun', 'Position', `${selected.x.toFixed(0)}, ${selected.y.toFixed(0)}`);
                setSelectionStat('stat-label-d', 'stat-age', 'State', 'Under construction');
                setSelectionStat('stat-label-e', 'stat-trait', 'Notes', 'Colonists haul materials here and build over time');
                return;
            }

            if (selected.entityType === 'building') {
                setText('selection-title', selected.type[0].toUpperCase() + selected.type.slice(1));
                const integrity = Math.round((selected.integrity / Math.max(1, selected.maxIntegrity || 1)) * 100);
                setSelectionStat('stat-label-a', 'stat-energy', 'Integrity', `${integrity}%`);
                setSelectionStat('stat-label-b', 'stat-hunger', 'Position', `${selected.x.toFixed(0)}, ${selected.y.toFixed(0)}`);
                setSelectionStat('stat-label-c', 'stat-fun', 'Function', selected.type === 'farmPlot' ? 'Food production zone' : 'Settlement structure');
                setSelectionStat('stat-label-d', 'stat-age', 'Built', `Day ${selected.completedDay || '-'} / Year ${selected.completedYear || '-'}`);
                setSelectionStat('stat-label-e', 'stat-trait', 'Notes', 'Part of the colony home base');
                return;
            }

            if (selected.entityType === 'colony') {
                setText('selection-title', selected.name);
                setSelectionStat('stat-label-a', 'stat-energy', 'Population', `${Math.round(selected.population || 0)}`);
                setSelectionStat('stat-label-b', 'stat-hunger', 'Stores', `F${Math.round(selected.food || 0)} W${Math.round(selected.water || 0)}`);
                setSelectionStat('stat-label-c', 'stat-fun', 'Diplomacy', selected.diplomacyState || 'unknown');
                setSelectionStat('stat-label-d', 'stat-age', 'Action', selected.recentAction || 'settled');
                setSelectionStat('stat-label-e', 'stat-trait', 'Path', `${selected.type} / ${selected.culturalPath || 'frontier kin'}`);
                return;
            }

            if (selected.type === 'wildAnimal') {
                setText('selection-title', 'Wild Animal');
                setSelectionStat('stat-label-a', 'stat-energy', 'Type', 'Food source');
                setSelectionStat('stat-label-b', 'stat-hunger', 'Habitat', selected.biome || 'unknown');
                setSelectionStat('stat-label-c', 'stat-fun', 'Position', `${selected.x.toFixed(0)}, ${selected.y.toFixed(0)}`);
                setSelectionStat('stat-label-d', 'stat-age', 'Behavior', 'Skittish');
                setSelectionStat('stat-label-e', 'stat-trait', 'Notes', 'Roams and flees nearby colonists');
                return;
            }

            if (selected.type) {
                setText('selection-title', selected.type[0].toUpperCase() + selected.type.slice(1));
                setSelectionStat('stat-label-a', 'stat-energy', 'Amount', `${selected.amount.toFixed(0)} left`);
                setSelectionStat('stat-label-b', 'stat-hunger', 'Biome', selected.biome || 'unknown');
                setSelectionStat('stat-label-c', 'stat-fun', 'Position', `${selected.x.toFixed(0)}, ${selected.y.toFixed(0)}`);
                setSelectionStat('stat-label-d', 'stat-age', 'Kind', 'Resource node');
                setSelectionStat('stat-label-e', 'stat-trait', 'Use', 'Environmental supply / pressure');
                return;
            }

            setText('selection-title', selected.name);
            setSelectionStat('stat-label-a', 'stat-energy', 'Energy', `${selected.stats.energy.toFixed(0)}`);
            setSelectionStat('stat-label-b', 'stat-hunger', 'Hunger', `${selected.stats.hunger.toFixed(0)}`);
            setSelectionStat('stat-label-c', 'stat-fun', 'Thirst', `${selected.stats.thirst.toFixed(0)}`);
            setSelectionStat('stat-label-d', 'stat-age', 'Age', `${selected.ageYears.toFixed(1)}y / ${selected.lifeStage}`);
            setSelectionStat('stat-label-e', 'stat-trait', 'Status', `family ${selected.familyId ?? '-'} / ${selected.intent} / ${selected.stats.health.toFixed(0)} health`);
        }

        setGodTab(tab) {
            document.querySelectorAll('.god-tab').forEach((button) => {
                const active = button.dataset.godTab === tab;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-selected', String(active));
            });
            document.querySelectorAll('.god-tab-panel').forEach((panel) => {
                const active = panel.dataset.godPanel === tab;
                panel.classList.toggle('is-active', active);
                panel.hidden = !active;
            });
        }

        renderGodDrawer() {
            const selected = this.world.selectedEntity;
            const selectionLines = [];
            if (!selected) {
                selectionLines.push('No selection.');
            } else if (selected === this.world.camp) {
                selectionLines.push('Camp');
                selectionLines.push(`Food: ${this.world.camp.food.toFixed(1)}`);
                selectionLines.push(`Water: ${this.world.camp.water.toFixed(1)}`);
                selectionLines.push(`Shelter: ${this.world.camp.shelter.toFixed(1)}`);
                selectionLines.push(`Fire fuel: ${this.world.camp.fireFuel.toFixed(1)}`);
            } else if (selected.entityType === 'building') {
                selectionLines.push(`Building: ${selected.type}`);
                selectionLines.push(`Integrity: ${Math.round((selected.integrity / Math.max(1, selected.maxIntegrity || 1)) * 100)}%`);
                selectionLines.push(`Built: day ${selected.completedDay}, year ${selected.completedYear}`);
                selectionLines.push(`Pos: ${Math.round(selected.x)}, ${Math.round(selected.y)}`);
            } else if (selected.entityType === 'project') {
                selectionLines.push(`Project: ${selected.type}`);
                selectionLines.push(`Progress: ${selected.buildProgress.toFixed(1)} / ${selected.buildTime.toFixed(1)}`);
                selectionLines.push(`Pos: ${Math.round(selected.x)}, ${Math.round(selected.y)}`);
            } else if (selected.entityType === 'colonist') {
                selectionLines.push(`${selected.name}`);
                selectionLines.push(`Intent: ${selected.intent}`);
                selectionLines.push(`Role: ${selected.softRole}`);
                selectionLines.push(`Age: ${selected.ageYears.toFixed(1)} (${selected.lifeStage})`);
                selectionLines.push(`Health: ${selected.stats.health.toFixed(0)}  Morale: ${selected.stats.morale.toFixed(0)}`);
                selectionLines.push(`Family: ${selected.familyId ?? '-'}`);
            } else if (selected.entityType === 'colony') {
                selectionLines.push(`${selected.name}`);
                selectionLines.push(`Type: ${selected.type}`);
                selectionLines.push(`Population: ${Math.round(selected.population || 0)}`);
                selectionLines.push(`Food ${Number(selected.food || 0).toFixed(1)} / Water ${Number(selected.water || 0).toFixed(1)} / Wood ${Number(selected.wood || 0).toFixed(1)}`);
                selectionLines.push(`Diplomacy: ${selected.diplomacyState || 'unknown'}  Border: ${Number(selected.borderFriction || 0).toFixed(2)}`);
                selectionLines.push(`Recent action: ${selected.recentAction || 'settled'}`);
            } else if (selected.type) {
                selectionLines.push(`${selected.type}`);
                if (typeof selected.amount === 'number') {
                    selectionLines.push(`Amount: ${selected.amount.toFixed(1)}`);
                }
                selectionLines.push(`Biome: ${selected.biome || 'unknown'}`);
                selectionLines.push(`Pos: ${Math.round(selected.x)}, ${Math.round(selected.y)}`);
            }
            setNodeText('god-inspect-selection', selectionLines.join('\n'));

            const lineage = this.world.lineageMemory || {};
            const lineageLines = [
                `Generation: ${this.world.generation}`,
                `Lessons: ${(lineage.lessons || []).slice(0, 3).join(' | ') || 'none'}`,
                `Discoveries: ${(lineage.discoveries || []).slice(0, 5).join(', ') || 'none'}`,
                `Deaths: ${JSON.stringify(lineage.deathCauses || {})}`
            ];
            setNodeText('god-inspect-lineage', lineageLines.join('\n'));

            const culture = this.world.lineageMemory?.culturalValues || {};
            const continuity = this.world.getCultureLegacyProfile ? this.world.getCultureLegacyProfile() : null;
            const cultureLines = [
                `Hoard food: ${(culture.hoardFood || 0).toFixed(2)}`,
                `Share food: ${(culture.shareFood || 0).toFixed(2)}`,
                `Avoid strangers: ${(culture.avoidStrangers || 0).toFixed(2)}`,
                `Worship nature: ${(culture.worshipNature || 0).toFixed(2)}`,
                `Favor expansion: ${(culture.favorExpansion || 0).toFixed(2)}`,
                continuity ? `Path: ${continuity.path}` : null,
                continuity ? `Ancient custom: ${continuity.ancientCustom}` : null,
                continuity ? `Modern style: ${continuity.modernizationStyle}` : null,
                continuity ? `Continuity: ${continuity.continuityScore.toFixed(2)}` : null
            ];
            setNodeText('god-inspect-culture', cultureLines.filter(Boolean).join('\n'));

            const memoryLines = [];
            if (selected?.entityType === 'colonist') {
                memoryLines.push(`Known water: ${(selected.memory.resources?.water || []).length}`);
                memoryLines.push(`Known food: ${(selected.memory.resources?.berries || []).length + (selected.memory.resources?.wildAnimal || []).length}`);
                memoryLines.push(`Danger zones: ${(selected.memory.dangerZones || []).length}`);
                memoryLines.push(`Shelter spots: ${(selected.memory.shelterSpots || []).length}`);
                memoryLines.push(`Failed actions: ${Object.keys(selected.memory.failedActions || {}).length}`);
            } else {
                memoryLines.push(`Colony danger zones: ${(this.world.colonyKnowledge?.dangerZones || []).length}`);
                memoryLines.push(`Colony shelters: ${(this.world.colonyKnowledge?.shelterSpots || []).length}`);
                memoryLines.push(`Discoveries: ${(this.world.colonyKnowledge?.discoveries || []).slice(0, 5).join(', ') || 'none'}`);
            }
            setNodeText('god-inspect-memory', memoryLines.join('\n'));

            const thoughtLines = [];
            if (selected?.entityType === 'colonist') {
                thoughtLines.push(`Current intent: ${selected.intent || 'none'}`);
                thoughtLines.push(`Current need: ${selected.lastNeed || 'none'}`);
                const planStep = selected.plan[selected.planStep];
                thoughtLines.push(`Plan step: ${planStep ? `${planStep.action} (${planStep.kind})` : 'none'}`);
                thoughtLines.push('Top scores:');
                for (const entry of (selected.lastDecisionScores || []).slice(0, 5)) {
                    thoughtLines.push(`${entry.key}: ${entry.score} [${entry.need}]`);
                }
                if (!selected.lastDecisionScores?.length) {
                    thoughtLines.push('No decision trace yet.');
                }
            } else {
                thoughtLines.push(`Recent thoughts: ${(this.world.thoughts || []).slice(0, 4).join(' | ') || 'none'}`);
                thoughtLines.push(`Recent events: ${(this.world.events || []).slice(0, 4).join(' | ') || 'none'}`);
            }
            setNodeText('god-inspect-thoughts', thoughtLines.join('\n'));

            const battleLines = [
                `Active battles: ${(this.world.battlefronts || []).filter((front) => !front.resolved).length}`,
                `Predators: ${(this.world.predators || []).length}`,
                `Conflict pressure: ${this.world.getRegionalConflictPressure().toFixed(2)}`
            ];
            if (selected?.entityType === 'colonist') {
                battleLines.push(`Would join battle: ${this.world.shouldColonistJoinBattle(selected) ? 'yes' : 'no'}`);
                battleLines.push(`Combat: ${selected.skills.combat.toFixed(1)}`);
                battleLines.push(`Health: ${selected.stats.health.toFixed(0)} Energy: ${selected.stats.energy.toFixed(0)}`);
            } else {
                const defense = this.world.getCampDefenseSummary();
                battleLines.push(`Militia: ${defense.militia} Hunters: ${defense.huntersPressed} Defenders: ${defense.trainedDefenders}`);
            }
            setNodeText('god-inspect-battle', battleLines.join('\n'));

            const worldLines = [
                `Year ${this.world.year}, day ${this.world.day}`,
                `Season: ${this.world.getSeason().name}`,
                `Weather: ${this.world.getWeather().name}`,
                `Population: ${this.world.colonists.length}`,
                `Era: ${describeEra(this.world.getCurrentEra())}`,
                `Diet: ${(this.world.foodCulture?.dietLabel) || 'forager fare'}`,
                `Colonies: ${this.world.getActiveBranchColonies().length}`,
                `Battles: ${(this.world.battlefronts || []).filter((front) => !front.resolved).length}`,
                `Bubble: ${(this.world.godMode?.protectBubbleTtl || 0).toFixed(1)}`,
                `Relics: ${(this.world.godMode?.relics || []).length}`,
                `Season pace: ${this.world.getSimulationKnob('seasonPace').toFixed(2)}`,
                `Weather severity: ${this.world.getSimulationKnob('weatherSeverity').toFixed(2)}`,
                `Resource abundance: ${this.world.getSimulationKnob('resourceAbundance').toFixed(2)}`,
                `Disease pressure: ${this.world.getSimulationKnob('diseasePressure').toFixed(2)}`,
                `Learning rate: ${this.world.getSimulationKnob('learningRate').toFixed(2)}`,
                `Disaster frequency: ${this.world.getSimulationKnob('disasterFrequency').toFixed(2)}`
            ];
            setNodeText('god-world-summary', worldLines.join('\n'));

            const influence = this.world.godMode?.divineSuggestion || {};
            const influenceLines = [
                `Focus: ${influence.focus || 'none'}`,
                `TTL: ${(influence.ttl || 0).toFixed(1)}`,
                `Source: ${influence.source || 'none'}`
            ];
            setNodeText('god-influence-summary', influenceLines.join('\n'));
            const myths = (this.world.godMode?.myths || []).map((entry) => `Y${entry.year} D${entry.day}: ${entry.text}`);
            setNodeText('god-influence-myths', myths.join('\n') || 'No myths yet.');
        }
    }

    PhaseOneSim.PhaseOneUI = PhaseOneUI;
})();
