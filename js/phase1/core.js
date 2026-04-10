(function () {
    const PhaseOneSim = window.PhaseOneSim || (window.PhaseOneSim = {});

    const WORLD_WIDTH = 2430;
    const WORLD_HEIGHT = 1440;
    const GRID_COLS = 54;
    const GRID_ROWS = 32;
    const CELL_WIDTH = WORLD_WIDTH / GRID_COLS;
    const CELL_HEIGHT = WORLD_HEIGHT / GRID_ROWS;
    const VALLEY_RING_CELLS = 2;
    const MAX_ACTIVE_BRANCH_COLONIES = 3;
    const DAY_DURATION = 60;
    const DAYS_PER_SEASON = 3;
    const YEAR_DURATION = DAY_DURATION * DAYS_PER_SEASON * 4;
    const RESOURCE_RESPAWN_MIN = DAY_DURATION * 2;
    const RESOURCE_RESPAWN_MAX = DAY_DURATION * 3;
    const colonistAmount = 8;

    const resourcesConfig = {
        campStores: {
            food: 14,
            water: 8,
            wood: 20,
            stone: 8,
            fireFuel: 20
        },
        naturalNodes: {
            waterClusterAmount: 50,
            berriesBase: 26,
            berriesVariance: 16,
            treesBase: 24,
            treesVariance: 18,
            stoneBase: 18,
            stoneVariance: 14
        },
        starterNodes: {
            water: 50,
            berriesNear: 28,
            berriesFar: 34,
            berriesSouth: 30,
            treesEast: 34,
            treesWest: 30,
            stone: 26
        },
        branchStarterNodes: {
            water: 50,
            berriesNorthEast: 26,
            berriesSouthWest: 24,
            treesWest: 28,
            treesEast: 24,
            stone: 22
        }
    };

    const SEASONS = [
        { name: 'Spring', daylight: 0.58, temperature: 8, berryGrowth: 1.25, thirst: 1, hunger: 0.98 },
        { name: 'Summer', daylight: 0.66, temperature: 15, berryGrowth: 0.95, thirst: 1.2, hunger: 1.02 },
        { name: 'Autumn', daylight: 0.51, temperature: 4, berryGrowth: 0.7, thirst: 0.92, hunger: 1.04 },
        { name: 'Winter', daylight: 0.42, temperature: -8, berryGrowth: 0.3, thirst: 0.86, hunger: 1.14 }
    ];

    const WEATHER_TYPES = [
        { name: 'Clear', temperature: 0, moisture: 0, thirst: 1, warmth: 1, color: 'rgba(255, 223, 142, 0.08)' },
        { name: 'Cloudy', temperature: -1, moisture: 0.08, thirst: 0.96, warmth: 1.04, color: 'rgba(112, 126, 142, 0.09)' },
        { name: 'Rain', temperature: -2, moisture: 0.35, thirst: 0.88, warmth: 1.18, color: 'rgba(104, 158, 196, 0.12)' },
        { name: 'Storm', temperature: -5, moisture: 0.28, thirst: 0.96, warmth: 1.35, color: 'rgba(72, 92, 126, 0.18)' },
        { name: 'Cold Snap', temperature: -11, moisture: -0.08, thirst: 0.92, warmth: 1.62, color: 'rgba(176, 206, 255, 0.14)' },
        { name: 'Drought', temperature: 8, moisture: -0.26, thirst: 1.38, warmth: 1.04, color: 'rgba(214, 170, 88, 0.15)' }
    ];
    const WEATHER_TYPE_LOOKUP = Object.fromEntries(WEATHER_TYPES.map((entry) => [entry.name.toLowerCase(), entry]));
    const WEATHER_LAYER_PRESETS = {
        Clear: {
            precipitationType: 'none',
            intensity: 0.06,
            fogDensity: 0.02,
            darkness: 0.02,
            dustDensity: 0,
            wetnessTarget: 0.04,
            puddleTarget: 0,
            snowTarget: 0,
            splashRate: 0,
            leafDrift: 0.08,
            ambient: 'clear',
            transitionSeconds: 3
        },
        Cloudy: {
            precipitationType: 'none',
            intensity: 0.28,
            fogDensity: 0.12,
            darkness: 0.08,
            dustDensity: 0,
            wetnessTarget: 0.12,
            puddleTarget: 0.04,
            snowTarget: 0,
            splashRate: 0,
            leafDrift: 0.14,
            ambient: 'cloudy',
            transitionSeconds: 4
        },
        Rain: {
            precipitationType: 'rain',
            intensity: 0.64,
            fogDensity: 0.1,
            darkness: 0.14,
            dustDensity: 0,
            wetnessTarget: 0.68,
            puddleTarget: 0.32,
            snowTarget: 0,
            splashRate: 0.65,
            leafDrift: 0.18,
            ambient: 'rain',
            transitionSeconds: 5
        },
        Storm: {
            precipitationType: 'rain',
            intensity: 0.94,
            fogDensity: 0.16,
            darkness: 0.28,
            dustDensity: 0,
            wetnessTarget: 0.94,
            puddleTarget: 0.76,
            snowTarget: 0,
            splashRate: 1,
            leafDrift: 0.3,
            ambient: 'storm',
            transitionSeconds: 6
        },
        'Cold Snap': {
            precipitationType: 'snow',
            intensity: 0.72,
            fogDensity: 0.14,
            darkness: 0.12,
            dustDensity: 0,
            wetnessTarget: 0.08,
            puddleTarget: 0.02,
            snowTarget: 0.7,
            splashRate: 0.08,
            leafDrift: 0.24,
            ambient: 'snow',
            transitionSeconds: 6
        },
        Drought: {
            precipitationType: 'dust',
            intensity: 0.56,
            fogDensity: 0.02,
            darkness: 0.07,
            dustDensity: 0.52,
            wetnessTarget: 0,
            puddleTarget: 0,
            snowTarget: 0,
            splashRate: 0,
            leafDrift: 0.16,
            ambient: 'drywind',
            transitionSeconds: 4
        }
    };

    const BIOME_COLORS = {
        grassland: '#7f9f46',
        forest: '#4d7f34',
        rocky: '#777160',
        water: '#2f6d98',
        fertile: '#9bb04d',
        valley: '#5f553f'
    };

    const MATERIAL_KEYS = ['logs', 'fiber', 'planks', 'rope', 'hides'];
    const ITEM_TIERS = ['crude', 'standard', 'fine'];

    const ITEM_DEFS = {
        stick: { slot: null, durability: 0, quality: 1 },
        stoneTool: { slot: null, durability: 0, quality: 1 },
        axe: { slot: 'wood', durability: 18, quality: 1.15 },
        spear: { slot: 'hunting', durability: 20, quality: 1.2 },
        basket: { slot: 'hauling', durability: 16, quality: 1.1 },
        firePit: { slot: 'structure', durability: 0, quality: 1 },
        simpleClothing: { slot: 'clothing', durability: 20, quality: 1.08 },
        hoe: { slot: 'farming', durability: 18, quality: 1.15 },
        hammer: { slot: 'building', durability: 20, quality: 1.18 }
    };

    const RECIPE_DEFS = {
        stick: {
            output: 'stick',
            duration: 1.6,
            materials: { logs: 1 },
            unlocks: () => true
        },
        stoneTool: {
            output: 'stoneTool',
            duration: 2.2,
            materials: { stone: 1 },
            items: { stick: 1 },
            unlocks: (world) => world.lineageMemory.discoveries.includes('resource:stone') || world.colonyKnowledge.discoveries.includes('resource:stone')
        },
        basket: {
            output: 'basket',
            duration: 2.4,
            materials: { fiber: 2 },
            items: { stick: 1 },
            unlocks: (world) => world.colonyKnowledge.discoveries.includes('skill:tool_use')
        },
        axe: {
            output: 'axe',
            duration: 2.8,
            items: { stick: 1, stoneTool: 1 },
            unlocks: (world) => world.colonyKnowledge.discoveries.includes('skill:tool_use')
        },
        spear: {
            output: 'spear',
            duration: 2.9,
            items: { stick: 1 },
            materials: { rope: 1 },
            unlocks: (world) => world.colonyKnowledge.discoveries.includes('resource:wildAnimal') || world.colonyKnowledge.discoveries.includes('skill:hunting')
        },
        firePit: {
            output: 'firePit',
            duration: 3.2,
            materials: { stone: 3, logs: 2 },
            unlocks: (world) => world.colonyKnowledge.discoveries.includes('skill:tool_use')
        },
        simpleClothing: {
            output: 'simpleClothing',
            duration: 2.8,
            materials: { fiber: 3 },
            unlocks: (world) => world.colonyKnowledge.discoveries.includes('resource:trees') || world.colonyKnowledge.discoveries.includes('resource:wildAnimal')
        },
        hoe: {
            output: 'hoe',
            duration: 2.7,
            items: { stick: 1 },
            materials: { fiber: 2 },
            unlocks: (world) => world.colonyKnowledge.discoveries.includes('skill:planting')
        },
        hammer: {
            output: 'hammer',
            duration: 2.7,
            items: { stick: 1, stoneTool: 1 },
            unlocks: (world) => world.colonyKnowledge.discoveries.includes('skill:tool_use')
        }
    };

    const BUILDING_DEFS = {
        campfire: {
            materials: {},
            buildTime: 1.8,
            shelter: 0,
            storageBonus: 0,
            durability: 18
        },
        leanTo: {
            materials: { wood: 6, fiber: 2 },
            buildTime: 4.6,
            shelter: 6,
            storageBonus: 0,
            durability: 28
        },
        hut: {
            materials: { wood: 10, planks: 4, stone: 4 },
            buildTime: 7.6,
            shelter: 12,
            storageBonus: 0,
            durability: 42
        },
        storage: {
            materials: { wood: 8, planks: 4 },
            buildTime: 5.6,
            shelter: 0,
            storageBonus: 20,
            durability: 34
        },
        workshop: {
            materials: { wood: 6, planks: 4, stone: 3 },
            buildTime: 6.2,
            shelter: 0,
            storageBonus: 0,
            durability: 36
        },
        farmPlot: {
            materials: { wood: 3, fiber: 1 },
            buildTime: 3.8,
            shelter: 0,
            storageBonus: 0,
            durability: 18
        },
        cottage: {
            materials: { wood: 12, planks: 6, stone: 5 },
            buildTime: 8.2,
            shelter: 18,
            storageBonus: 0,
            durability: 52
        },
        house: {
            materials: { wood: 16, planks: 10, stone: 8, rope: 2 },
            buildTime: 10.6,
            shelter: 24,
            storageBonus: 0,
            durability: 64
        },
        fortifiedStructure: {
            materials: { wood: 18, planks: 12, stone: 12, rope: 2 },
            buildTime: 12.4,
            shelter: 32,
            storageBonus: 6,
            durability: 78
        },
        kitchen: {
            materials: { wood: 8, planks: 4, stone: 4 },
            buildTime: 6.4,
            shelter: 0,
            storageBonus: 4,
            durability: 36
        },
        foodHall: {
            materials: { wood: 14, planks: 8, stone: 8, rope: 2 },
            buildTime: 8.8,
            shelter: 4,
            storageBonus: 10,
            durability: 52
        },
        storagePit: {
            materials: { wood: 5, stone: 2 },
            buildTime: 4.8,
            shelter: 0,
            storageBonus: 12,
            durability: 22
        },
        granary: {
            materials: { wood: 10, planks: 6, stone: 4 },
            buildTime: 7.2,
            shelter: 0,
            storageBonus: 30,
            durability: 42
        },
        warehouse: {
            materials: { wood: 14, planks: 10, stone: 8, rope: 2 },
            buildTime: 9.8,
            shelter: 0,
            storageBonus: 48,
            durability: 58
        },
        wall: {
            materials: { wood: 8, stone: 10 },
            buildTime: 7.4,
            shelter: 4,
            storageBonus: 0,
            durability: 68
        },
        watchtower: {
            materials: { wood: 8, planks: 6, stone: 4 },
            buildTime: 7.8,
            shelter: 2,
            storageBonus: 0,
            durability: 46
        },
        irrigation: {
            materials: { wood: 4, stone: 2 },
            buildTime: 5.2,
            shelter: 0,
            storageBonus: 0,
            durability: 26
        },
        mill: {
            materials: { wood: 10, planks: 8, stone: 6 },
            buildTime: 8.4,
            shelter: 0,
            storageBonus: 0,
            durability: 48
        },
        engineeredFarm: {
            materials: { wood: 6, planks: 6, stone: 6, rope: 1 },
            buildTime: 8.6,
            shelter: 0,
            storageBonus: 0,
            durability: 34
        },
        canal: {
            materials: { wood: 6, stone: 8 },
            buildTime: 8.2,
            shelter: 0,
            storageBonus: 0,
            durability: 42
        },
        civicComplex: {
            materials: { wood: 16, planks: 12, stone: 10, rope: 2 },
            buildTime: 10.8,
            shelter: 8,
            storageBonus: 14,
            durability: 64
        },
        stoneKeep: {
            materials: { wood: 12, planks: 10, stone: 20, rope: 2 },
            buildTime: 13.2,
            shelter: 38,
            storageBonus: 10,
            durability: 96
        }
    };

    const BUILDING_FOOTPRINTS = {
        campfire: 18,
        leanTo: 26,
        hut: 45,
        storage: 28,
        workshop: 30,
        farmPlot: 45,
        cottage: 34,
        house: 40,
        fortifiedStructure: 42,
        kitchen: 30,
        foodHall: 40,
        storagePit: 24,
        granary: 32,
        warehouse: 42,
        wall: 30,
        watchtower: 28,
        irrigation: 30,
        mill: 34,
        engineeredFarm: 45,
        canal: 34,
        civicComplex: 44,
        stoneKeep: 48
    };

    const BUILDING_UPGRADES = {
        cottage: ['hut'],
        house: ['cottage'],
        fortifiedStructure: ['house'],
        stoneKeep: ['fortifiedStructure'],
        kitchen: ['campfire'],
        foodHall: ['kitchen'],
        civicComplex: ['foodHall'],
        granary: ['storagePit', 'storage'],
        warehouse: ['granary'],
        engineeredFarm: ['farmPlot'],
        canal: ['irrigation']
    };

    const TECH_BANDS = [
        'survival',
        'toolmaking',
        'agriculture',
        'masonry',
        'metallurgy',
        'bronze age',
        'iron age',
        'medicine',
        'military organization',
        'engineering'
    ];

    const ERA_BANDS = [
        'survival',
        'toolmaking',
        'agriculture',
        'masonry',
        'engineering',
        'metallurgy',
        'bronze age',
        'iron age'
    ];

    const ERA_DIPLOMACY_PROFILES = {
        survival: {
            diplomacyMethod: 'kin-band caution',
            tradeMethod: 'gift exchange',
            warfareMethod: 'foraging raids',
            rivalThresholdShift: 0.08,
            tradingThresholdShift: -0.06,
            alliedThresholdShift: -0.1,
            supportBias: -0.08,
            totalWarBias: -0.28,
            raidBias: 0.16
        },
        toolmaking: {
            diplomacyMethod: 'clan bargaining',
            tradeMethod: 'tool barter',
            warfareMethod: 'warband skirmishes',
            rivalThresholdShift: 0.05,
            tradingThresholdShift: -0.03,
            alliedThresholdShift: -0.08,
            supportBias: -0.04,
            totalWarBias: -0.18,
            raidBias: 0.1
        },
        agriculture: {
            diplomacyMethod: 'barter accords',
            tradeMethod: 'grain trade',
            warfareMethod: 'harvest raids',
            rivalThresholdShift: 0.02,
            tradingThresholdShift: 0.04,
            alliedThresholdShift: -0.02,
            supportBias: 0.04,
            totalWarBias: -0.06,
            raidBias: 0.06
        },
        masonry: {
            diplomacyMethod: 'border pacts',
            tradeMethod: 'storehouse exchange',
            warfareMethod: 'fortified reprisals',
            rivalThresholdShift: -0.02,
            tradingThresholdShift: 0.06,
            alliedThresholdShift: 0.04,
            supportBias: 0.08,
            totalWarBias: 0.06,
            raidBias: -0.02
        },
        engineering: {
            diplomacyMethod: 'caravan compacts',
            tradeMethod: 'route compacts',
            warfareMethod: 'column campaigns',
            rivalThresholdShift: -0.04,
            tradingThresholdShift: 0.08,
            alliedThresholdShift: 0.08,
            supportBias: 0.12,
            totalWarBias: 0.14,
            raidBias: -0.06
        },
        metallurgy: {
            diplomacyMethod: 'league diplomacy',
            tradeMethod: 'metal trade lanes',
            warfareMethod: 'siege columns',
            rivalThresholdShift: -0.06,
            tradingThresholdShift: 0.06,
            alliedThresholdShift: 0.1,
            supportBias: 0.14,
            totalWarBias: 0.22,
            raidBias: -0.1
        },
        'bronze age': {
            diplomacyMethod: 'city-league diplomacy',
            tradeMethod: 'bronze caravan circuits',
            warfareMethod: 'bronze war columns',
            rivalThresholdShift: -0.08,
            tradingThresholdShift: 0.1,
            alliedThresholdShift: 0.12,
            supportBias: 0.18,
            totalWarBias: 0.28,
            raidBias: -0.14
        },
        'iron age': {
            diplomacyMethod: 'border-state diplomacy',
            tradeMethod: 'iron road exchange',
            warfareMethod: 'iron host marches',
            rivalThresholdShift: -0.1,
            tradingThresholdShift: 0.09,
            alliedThresholdShift: 0.1,
            supportBias: 0.16,
            totalWarBias: 0.32,
            raidBias: -0.12
        }
    };

    const FOOD_SOURCE_KEYS = ['foraged', 'hunted', 'farmed', 'prepared'];

    const TECH_DEFS = {
        toolmaking: { band: 'toolmaking', label: 'toolmaking', breakthrough: false },
        agriculture: { band: 'agriculture', label: 'agriculture', breakthrough: false },
        masonry: { band: 'masonry', label: 'masonry', breakthrough: false },
        medicineLore: { band: 'medicine', label: 'medicine lore', breakthrough: false },
        militaryOrganization: { band: 'military organization', label: 'military organization', breakthrough: false },
        storagePlanning: { band: 'agriculture', label: 'storage planning', breakthrough: false },
        insulation: { band: 'survival', label: 'insulation', breakthrough: false },
        irrigation: { band: 'engineering', label: 'irrigation', breakthrough: true },
        engineering: { band: 'engineering', label: 'engineering', breakthrough: true },
        metallurgy: { band: 'metallurgy', label: 'metallurgy', breakthrough: true },
        bronzeAge: { band: 'bronze age', label: 'bronze age', breakthrough: true },
        ironAge: { band: 'iron age', label: 'iron age', breakthrough: true }
    };

    const LEGACY_MILESTONE_DEFS = {
        toolKnowledge: { label: 'Tool Knowledge', message: 'The colony discovered tool knowledge.' },
        firstCampfire: { label: 'First Campfire', message: 'The colony built its first campfire.' },
        firstLeanTo: { label: 'First Lean-To', message: 'The colony built its first lean-to.' },
        firstShelter: { label: 'First Shelter', message: 'The colony established true shelter.' },
        firstStorage: { label: 'First Storage', message: 'The colony built dedicated storage.' },
        firstWorkshop: { label: 'First Workshop', message: 'The colony built its first workshop.' },
        firstFarmPlot: { label: 'First Farm Plot', message: 'The colony planted its first farm plot.' },
        firstFamily: { label: 'First Family', message: 'The colony formed its first family.' },
        firstChild: { label: 'First Child', message: 'A new child was born into the colony.' },
        firstBranchColony: { label: 'First Branch Colony', message: 'The colony sent out its first branch settlement.' },
        firstTradeRoute: { label: 'First Trade Route', message: 'The colony established its first trade route.' },
        firstAlliance: { label: 'First Alliance', message: 'The colony formed its first alliance.' },
        firstRival: { label: 'First Rival', message: 'The colony entered its first rivalry.' },
        phase1Foundation: { label: 'Phase 1 Foundation', message: 'The survival foundation of the colony took hold.' },
        phase2Survivors: { label: 'Phase 2 Survivors', message: 'Need-driven survival and defense took hold.' },
        phase3Learners: { label: 'Phase 3 Learners', message: 'The colony began learning from memory and experience.' },
        phase4Makers: { label: 'Phase 4 Makers', message: 'Primitive crafting and tools became part of survival.' },
        phase5Settlement: { label: 'Phase 5 Settlement', message: 'A functioning settlement emerged.' },
        phase6People: { label: 'Phase 6 People', message: 'The colony began to feel like a people.' },
        phase7CivilGrowth: { label: 'Phase 7 Civil Growth', message: 'Infrastructure and emergent advancement took hold.' },
        phase8RegionalPlay: { label: 'Phase 8 Regional Play', message: 'Multiple colonies began shaping each other through trade and conflict.' }
    };

    const NAME_PREFIXES = [
        'Alder', 'Brim', 'Cairn', 'Dara', 'Edda', 'Fen', 'Galen', 'Hale',
        'Ivo', 'Jora', 'Kellan', 'Luma', 'Mira', 'Nash', 'Orin', 'Pella',
        'Quill', 'Rhea', 'Soren', 'Tarin', 'Una', 'Vale', 'Wren', 'Yara'
    ];

    const NAME_SUFFIXES = [
        'Ash', 'Briar', 'Crest', 'Dawn', 'Elm', 'Field', 'Grove', 'Hollow',
        'Ivory', 'Jun', 'Keel', 'Lark', 'Moss', 'Nettle', 'Oak', 'Pine',
        'Reed', 'Stone', 'Thorn', 'Vale', 'Wilde', 'Yew'
    ];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function keyForCell(col, row) {
        return `${col},${row}`;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createWeatherManagerState() {
        return {
            type: 'Clear',
            targetType: 'Clear',
            precipitationType: 'none',
            intensity: 0.06,
            targetIntensity: 0.06,
            windX: 0.18,
            windY: 0.08,
            targetWindX: 0.18,
            targetWindY: 0.08,
            darkness: 0.02,
            targetDarkness: 0.02,
            fogDensity: 0.02,
            targetFogDensity: 0.02,
            dustDensity: 0,
            targetDustDensity: 0,
            surfaceWetness: 0.04,
            puddleLevel: 0,
            snowCover: 0,
            splashRate: 0,
            leafDrift: 0.08,
            temperature: 0.5,
            gustStrength: 0,
            transition: 1,
            transitionElapsed: 0,
            transitionDuration: 3,
            lightningFlash: 0,
            lightningCooldown: 0,
            ambient: 'clear'
        };
    }

    class WeatherManager {
        constructor(world, snapshot = null) {
            this.world = world;
            this.state = {
                ...createWeatherManagerState(),
                ...(clone(snapshot || {}) || {})
            };
            this.lastPresetName = null;
            this.syncToCurrent(true);
        }

        exportState() {
            return clone(this.state);
        }

        getCurrentPreset() {
            return this.world.getWeatherPreset();
        }

        syncToCurrent(immediate = false) {
            this.setTargetFromPreset(this.getCurrentPreset(), immediate);
        }

        setTargetFromPreset(preset, immediate = false) {
            if (!preset) {
                return;
            }
            const target = this.buildTargetState(preset);
            const changed = target.type !== this.state.targetType || target.precipitationType !== this.state.precipitationType;
            const oldTargetType = this.state.targetType || this.state.type;
            this.lastPresetName = preset.name;
            this.state.targetType = target.type;
            this.state.precipitationType = target.precipitationType;
            this.state.targetIntensity = target.intensity;
            this.state.targetWindX = target.windX;
            this.state.targetWindY = target.windY;
            this.state.targetDarkness = target.darkness;
            this.state.targetFogDensity = target.fogDensity;
            this.state.targetDustDensity = target.dustDensity;
            this.state.splashRate = target.splashRate;
            this.state.leafDrift = target.leafDrift;
            this.state.ambient = target.ambient;
            this.state.temperature = target.temperature;
            this.state.transitionDuration = target.transitionSeconds;
            if (immediate) {
                this.state.type = target.type;
                this.state.intensity = target.intensity;
                this.state.windX = target.windX;
                this.state.windY = target.windY;
                this.state.darkness = target.darkness;
                this.state.fogDensity = target.fogDensity;
                this.state.dustDensity = target.dustDensity;
                this.state.surfaceWetness = target.wetnessTarget;
                this.state.puddleLevel = target.puddleTarget;
                this.state.snowCover = target.snowTarget;
                this.state.transition = 1;
                this.state.transitionElapsed = this.state.transitionDuration;
                this.state.lightningFlash = 0;
                this.state.lightningCooldown = 0;
                return;
            }
            if (changed) {
                const leavingWet =
                    oldTargetType === 'Rain' ||
                    oldTargetType === 'Storm' ||
                    this.state.surfaceWetness > 0.18 ||
                    this.state.puddleLevel > 0.08;
                const leavingSnow =
                    oldTargetType === 'Cold Snap' ||
                    this.state.snowCover > 0.06;
                const extraTransition =
                    (leavingWet ? this.state.surfaceWetness * 3.2 + this.state.puddleLevel * 4.8 : 0) +
                    (leavingSnow ? this.state.snowCover * 5.5 : 0);
                this.state.transitionElapsed = 0;
                this.state.transition = 0;
                this.state.transitionDuration = Math.max(target.transitionSeconds, target.transitionSeconds + extraTransition);
            }
        }

        buildTargetState(preset) {
            const layerPreset = WEATHER_LAYER_PRESETS[preset.name] || WEATHER_LAYER_PRESETS.Clear;
            const season = this.world.getSeason().name;
            const angleSeed =
                this.world.day * 0.73 +
                this.world.year * 1.17 +
                this.world.elapsed * 0.018 +
                preset.temperature * 0.09;
            const windAngle = angleSeed + (preset.name === 'Storm' ? 0.9 : preset.name === 'Drought' ? -0.6 : 0.22);
            const windSpeed =
                preset.name === 'Storm' ? 0.95 :
                preset.name === 'Rain' ? 0.52 :
                preset.name === 'Cold Snap' ? 0.42 :
                preset.name === 'Drought' ? 0.48 :
                preset.name === 'Cloudy' ? 0.26 :
                0.18;
            const snowTarget = preset.name === 'Cold Snap'
                ? (season === 'Winter' ? layerPreset.snowTarget : layerPreset.snowTarget * 0.45)
                : 0;
            return {
                type: preset.name,
                precipitationType: layerPreset.precipitationType,
                intensity: layerPreset.intensity,
                windX: Math.cos(windAngle) * windSpeed,
                windY: Math.sin(windAngle) * windSpeed,
                darkness: layerPreset.darkness,
                fogDensity: layerPreset.fogDensity,
                dustDensity: layerPreset.dustDensity,
                wetnessTarget: layerPreset.wetnessTarget,
                puddleTarget: layerPreset.puddleTarget,
                snowTarget,
                splashRate: layerPreset.splashRate,
                leafDrift: layerPreset.leafDrift,
                temperature: clamp((preset.temperature + 14) / 28, 0, 1),
                ambient: layerPreset.ambient,
                transitionSeconds: layerPreset.transitionSeconds
            };
        }

        update(dt) {
            const preset = this.getCurrentPreset();
            if (preset?.name !== this.lastPresetName) {
                this.setTargetFromPreset(preset, false);
            }
            const target = this.buildTargetState(preset);
            const approach = (current, desired, upRate, downRate, minEase = 0.003, maxEase = 0.18) => {
                const rate = desired > current ? upRate : downRate;
                return lerp(current, desired, clamp(dt * rate, minEase, maxEase));
            };
            const gustWave =
                Math.sin(this.world.elapsed * 0.32 + this.world.day * 0.73) * 0.5 +
                Math.sin(this.world.elapsed * 0.11 + this.world.year * 0.37) * 0.35 +
                Math.sin(this.world.elapsed * 0.58 + target.temperature * 2.4) * 0.15;
            const gustStrength = clamp((gustWave * 0.5 + 0.5) * (0.18 + target.intensity * 0.52), 0, 1);
            this.state.gustStrength = approach(this.state.gustStrength || 0, gustStrength, 0.34, 0.26, 0.002, 0.1);

            const gustScale = 1 + (this.state.gustStrength - 0.35) * 0.32;
            const desiredWindX = target.windX * gustScale;
            const desiredWindY = target.windY * (1 + (this.state.gustStrength - 0.35) * 0.22);
            this.state.intensity = approach(this.state.intensity, target.intensity, 0.34 + target.intensity * 0.18, 0.14 + target.intensity * 0.06, 0.004, 0.24);
            this.state.windX = approach(this.state.windX, desiredWindX, 0.28, 0.22, 0.003, 0.16);
            this.state.windY = approach(this.state.windY, desiredWindY, 0.28, 0.22, 0.003, 0.16);
            this.state.darkness = approach(this.state.darkness, target.darkness, 0.18, 0.1, 0.003, 0.12);
            this.state.fogDensity = approach(this.state.fogDensity, target.fogDensity, 0.12, 0.07, 0.003, 0.09);
            this.state.dustDensity = approach(this.state.dustDensity, target.dustDensity, 0.12, 0.07, 0.003, 0.09);
            const wetnessUpRate = target.type === 'Rain' || target.type === 'Storm' ? 0.12 : target.type === 'Cloudy' ? 0.045 : 0.025;
            const wetnessDownRate = target.type === 'Drought' ? 0.06 : 0.018;
            const puddleUpRate = target.type === 'Storm' ? 0.09 : target.type === 'Rain' ? 0.06 : 0.02;
            const puddleDownRate = target.type === 'Drought' ? 0.05 : 0.012;
            const snowUpRate = target.type === 'Cold Snap' ? 0.06 : 0.012;
            const snowDownRate = target.temperature > 0.55 ? 0.03 : 0.008;
            this.state.surfaceWetness = approach(this.state.surfaceWetness, target.wetnessTarget, wetnessUpRate, wetnessDownRate, 0.002, 0.08);
            this.state.puddleLevel = approach(this.state.puddleLevel, target.puddleTarget, puddleUpRate, puddleDownRate, 0.0015, 0.06);
            this.state.snowCover = approach(this.state.snowCover, target.snowTarget, snowUpRate, snowDownRate, 0.001, 0.05);
            this.state.lightningCooldown = Math.max(0, this.state.lightningCooldown - dt);
            this.state.lightningFlash = Math.max(0, this.state.lightningFlash - dt * (this.state.lightningFlash > 0.3 ? 0.9 : 1.35));
            if (target.type === 'Storm' && this.state.lightningCooldown <= 0) {
                const strikeChance = dt * (0.04 + this.state.intensity * 0.075);
                if (Math.sin(this.world.elapsed * 3.7 + this.world.day * 0.61) > 0.96 || this.world.rng() < strikeChance) {
                    this.state.lightningFlash = clamp(0.6 + this.state.intensity * 0.35, 0, 1);
                    this.state.lightningCooldown = 2.5 + this.world.rng() * 3.5;
                }
            }
            this.state.transitionElapsed = Math.min(this.state.transitionDuration, this.state.transitionElapsed + dt);
            this.state.transition = clamp(this.state.transitionElapsed / Math.max(0.1, this.state.transitionDuration), 0, 1);
            if (this.state.transition >= 1) {
                this.state.type = target.type;
            }
        }

        getRegionModifier(x, y, options = {}) {
            const cell = this.world.getCellAt(x, y);
            const modifier = {
                precipitationMultiplier: 1,
                windMultiplier: 1,
                fogBoost: 0,
                sheltered: Boolean(options.indoors || options.sheltered)
            };
            if (!cell) {
                return modifier;
            }
            if (cell.biome === 'forest') {
                modifier.windMultiplier *= 0.72;
                modifier.fogBoost += 0.05;
            } else if (cell.biome === 'rocky') {
                modifier.windMultiplier *= cell.terrain?.mountain ? 1.25 : 1.08;
            } else if (cell.biome === 'water') {
                modifier.windMultiplier *= 1.1;
                modifier.fogBoost += 0.08;
            } else if (cell.biome === 'fertile') {
                modifier.precipitationMultiplier *= 1.04;
            }
            if (cell.terrain?.marsh && !cell.terrain?.drained) {
                modifier.fogBoost += 0.12;
            }
            if (cell.terrain?.hill) {
                modifier.windMultiplier *= 1.08;
            }
            return modifier;
        }

        getStateAt(x, y, options = {}) {
            const modifier = this.getRegionModifier(x, y, options);
            const precipitationFactor = modifier.sheltered ? 0 : modifier.precipitationMultiplier;
            const windFactor = modifier.sheltered ? 0.3 : modifier.windMultiplier;
            const fog = clamp(this.state.fogDensity + modifier.fogBoost, 0, 1);
            const precipitation = this.state.precipitationType === 'none'
                ? 0
                : clamp(this.state.intensity * precipitationFactor, 0, 1);
            const movementPenalty = clamp(
                this.state.snowCover * 0.26 +
                this.state.puddleLevel * 0.18 +
                precipitation * 0.1 +
                (this.state.type === 'Storm' ? 0.05 : 0),
                0,
                0.42
            );
            return {
                ...clone(this.state),
                windX: this.state.windX * windFactor,
                windY: this.state.windY * windFactor,
                fogDensity: fog,
                precipitationIntensity: precipitation,
                visibility: clamp(1 - fog * 0.62 - precipitation * 0.34 - (this.state.darkness * 0.24), 0.28, 1),
                movementPenalty,
                lightningRisk: this.state.type === 'Storm' && !modifier.sheltered
                    ? clamp(this.state.intensity * 0.78 * windFactor, 0, 1)
                    : 0,
                stealthBonus: clamp((this.state.type === 'Storm' ? 0.18 : 0) + fog * 0.28 + precipitation * 0.12, 0, 0.42),
                firePenalty: clamp((this.state.type === 'Rain' ? 0.18 : 0) + (this.state.type === 'Storm' ? 0.34 : 0), 0, 0.5),
                ambientProfile: modifier.sheltered && precipitation > 0 ? `${this.state.ambient}-muffled` : this.state.ambient
            };
        }

        getGlobalState() {
            const precipitation = this.state.precipitationType === 'none'
                ? 0
                : clamp(this.state.intensity, 0, 1);
            return {
                ...clone(this.state),
                precipitationIntensity: precipitation,
                visibility: clamp(1 - this.state.fogDensity * 0.62 - precipitation * 0.34 - (this.state.darkness * 0.24), 0.28, 1),
                movementPenalty: clamp(
                    this.state.snowCover * 0.26 +
                    this.state.puddleLevel * 0.18 +
                    precipitation * 0.1 +
                    (this.state.type === 'Storm' ? 0.05 : 0),
                    0,
                    0.42
                ),
                lightningRisk: this.state.type === 'Storm' ? clamp(this.state.intensity * 0.78, 0, 1) : 0,
                stealthBonus: clamp((this.state.type === 'Storm' ? 0.18 : 0) + this.state.fogDensity * 0.28 + precipitation * 0.12, 0, 0.42),
                firePenalty: clamp((this.state.type === 'Rain' ? 0.18 : 0) + (this.state.type === 'Storm' ? 0.34 : 0), 0, 0.5),
                ambientProfile: this.state.ambient
            };
        }
    }

    function exportColonistSnapshot(colonist) {
        const {
            worldRef,
            plan,
            threat,
            ...rest
        } = colonist;
        return {
            ...clone(rest),
            worldRef: null,
            plan: [],
            threat: null
        };
    }

    function hydrateColonist(snapshot, rng) {
        const colonist = new Colonist(
            snapshot?.id || 0,
            snapshot?.x || 0,
            snapshot?.y || 0,
            snapshot?.name || `Colonist ${(snapshot?.id || 0) + 1}`,
            rng
        );
        Object.assign(colonist, clone(snapshot || {}));
        colonist.memory = {
            ...createKnowledgeLayer(),
            ...(clone(snapshot?.memory || {}) || {}),
            failedActions: {
                ...createKnowledgeLayer().failedActions,
                ...((snapshot?.memory?.failedActions) || {})
            },
            successfulActions: {
                ...createKnowledgeLayer().successfulActions,
                ...((snapshot?.memory?.successfulActions) || {})
            },
            actionConfidence: {
                ...createKnowledgeLayer().actionConfidence,
                ...((snapshot?.memory?.actionConfidence) || {})
            }
        };
        colonist.worldRef = null;
        return colonist;
    }

    function createEmptyLineageMemory() {
        return {
            generation: 0,
            knownResources: {
                water: [],
                berries: [],
                trees: [],
                stone: [],
                wildAnimal: []
            },
            deathCauses: {
                dehydration: 0,
                starvation: 0,
                exposure: 0,
                exhaustion: 0,
                predatorAttack: 0,
                lightningStrike: 0
            },
            dangerZones: [],
            shelterSpots: [],
            discoveries: [],
            lessons: [],
            settlementKnowledge: {
                housingTier: 0,
                storageTier: 0,
                civicTier: 0,
                defenseTier: 0,
                metallurgyHints: 0
            },
            traitAverages: {
                bravery: 0.5,
                caution: 0.5,
                curiosity: 0.5,
                aggression: 0.5,
                sociability: 0.5,
                endurance: 0.5,
                fertility: 0.5,
                learningSpeed: 0.5
            },
            culturalValues: {
                hoardFood: 0,
                shareFood: 0,
                avoidStrangers: 0,
                worshipNature: 0,
                favorExpansion: 0
            },
            achievements: [],
            branchColonies: []
        };
    }

    function createKnowledgeLayer() {
        return {
            resources: {
                water: [],
                berries: [],
                trees: [],
                stone: [],
                wildAnimal: []
            },
            dangerZones: [],
            shelterSpots: [],
            failedActions: {},
            successfulActions: {},
            actionConfidence: {},
            discoveries: []
        };
    }

    function createTraitProfile(rng = Math.random, overrides = {}) {
        return {
            bravery: 0.35 + rng() * 0.3,
            caution: 0.35 + rng() * 0.3,
            curiosity: 0.35 + rng() * 0.3,
            aggression: 0.2 + rng() * 0.25,
            sociability: 0.35 + rng() * 0.3,
            endurance: 0.35 + rng() * 0.3,
            fertility: 0.35 + rng() * 0.3,
            learningSpeed: 0.35 + rng() * 0.3,
            ...overrides
        };
    }

    function createCultureProfile(overrides = {}) {
        return {
            hoardFood: 0,
            shareFood: 0,
            avoidStrangers: 0,
            worshipNature: 0,
            favorExpansion: 0,
            ...overrides
        };
    }

    function createMaterialInventory() {
        return {
            logs: 0,
            fiber: 0,
            planks: 0,
            rope: 0,
            hides: 0
        };
    }

    function getQualityTierFromSkill(skill = 0) {
        if (skill >= 9) {
            return 'fine';
        }
        if (skill >= 4) {
            return 'standard';
        }
        return 'crude';
    }

    function getQualityMultiplier(tier, baseQuality = 1) {
        if (tier === 'fine') {
            return baseQuality * 1.2;
        }
        if (tier === 'standard') {
            return baseQuality * 1.08;
        }
        return Math.max(0.92, baseQuality * 0.96);
    }

    function getTierRank(tier = 'crude') {
        const index = ITEM_TIERS.indexOf(tier);
        return index >= 0 ? index : 0;
    }

    function getTierName(tier = 'crude') {
        return tier === 'fine' ? 'fine' : tier === 'standard' ? 'worked' : 'crude';
    }

    function createItem(id, type, craftingSkill = 0, minTier = null) {
        const def = ITEM_DEFS[type];
        const skillTier = getQualityTierFromSkill(craftingSkill);
        const tier = minTier && getTierRank(minTier) > getTierRank(skillTier) ? minTier : skillTier;
        const durabilityBase = def?.durability || 0;
        const quality = getQualityMultiplier(tier, def?.quality || 1);
        const durabilityScale = tier === 'fine' ? 1.25 : tier === 'standard' ? 1.1 : 0.95;
        return {
            id,
            type,
            tier,
            durability: durabilityBase > 0 ? Math.round(durabilityBase * durabilityScale) : 0,
            maxDurability: durabilityBase > 0 ? Math.round(durabilityBase * durabilityScale) : 0,
            quality
        };
    }

    function normalizeLineageMemory(memory) {
        const normalized = createEmptyLineageMemory();
        if (!memory) {
            return normalized;
        }
        normalized.generation = memory.generation || 0;
        Object.assign(normalized.deathCauses, memory.deathCauses || {});
        Object.assign(normalized.knownResources, memory.knownResources || {});
        normalized.dangerZones = clone(memory.dangerZones || []);
        normalized.shelterSpots = clone(memory.shelterSpots || []);
        normalized.discoveries = clone(memory.discoveries || []);
        normalized.lessons = clone(memory.lessons || []);
        Object.assign(normalized.settlementKnowledge, memory.settlementKnowledge || {});
        Object.assign(normalized.traitAverages, memory.traitAverages || {});
        Object.assign(normalized.culturalValues, memory.culturalValues || {});
        normalized.achievements = clone(memory.achievements || []);
        normalized.branchColonies = clone(memory.branchColonies || []);
        return normalized;
    }

    function rememberPoint(bucket, point, limit = 8, minDistance = 28) {
        const memory = { x: Math.round(point.x), y: Math.round(point.y) };
        const duplicate = bucket.some((entry) => distance(entry, memory) < minDistance);
        if (duplicate) {
            return false;
        }
        bucket.unshift(memory);
        bucket.splice(limit);
        return true;
    }

    function createRng(seed) {
        let state = seed >>> 0;
        return function rng() {
            state += 0x6D2B79F5;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function createNamePool(rng, count) {
        const used = new Set();
        const names = [];
        while (names.length < count) {
            const prefix = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)];
            const suffix = NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)];
            const candidate = `${prefix} ${suffix}`;
            if (used.has(candidate)) {
                continue;
            }
            used.add(candidate);
            names.push(candidate);
        }
        return names;
    }

    function hashNoise(x, y, seed) {
        const value = Math.sin(x * 127.1 + y * 311.7 + seed * 0.137) * 43758.5453123;
        return value - Math.floor(value);
    }

    class Colonist {
        constructor(id, x, y, name, rng = Math.random) {
            this.id = id;
            this.name = name || `Colonist ${id + 1}`;
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.speed = 35 + (id % 3) * 4;
            this.stats = {
                hunger: 62 + rng() * 18,
                thirst: 60 + rng() * 18,
                warmth: 66 + rng() * 16,
                energy: 62 + rng() * 18,
                morale: 64 + rng() * 18,
                health: 100
            };
            this.intent = 'stabilizing';
            this.state = 'idle';
            this.target = null;
            this.actionProgress = 0;
            this.decisionCooldown = 0;
            this.thoughtCooldown = 0;
            this.roamAngle = rng() * Math.PI * 2;
            this.selected = false;
            this.alive = true;
            this.plan = [];
            this.planStep = 0;
            this.path = [];
            this.pathIndex = 0;
            this.pathRecalcCooldown = 0;
            this.lastNeed = 'steady';
            this.threat = null;
            this.threatDistance = Infinity;
            this.lastDamageCause = null;
            this.woundSeverity = 0;
            this.woundCount = 0;
            this.lastBattleHitTtl = 0;
            this.assignedBattlefrontId = null;
            this.battleRole = null;
            this.battleFormationIndex = -1;
            this.battleOrderTtl = 0;
            this.carrying = { type: null, amount: 0 };
            this.combatPower = 12 + (id % 3) * 2;
            this.memory = createKnowledgeLayer();
            this.inventory = {
                materials: createMaterialInventory(),
                items: []
            };
            this.equipment = {
                wood: null,
                hunting: null,
                building: null,
                farming: null,
                hauling: null,
                clothing: null
            };
            this.skills = {
                foraging: 0,
                hunting: 0,
                building: 0,
                farming: 0,
                crafting: 0,
                medicine: 0,
                survival: 0,
                combat: 0
            };
            this.knowledgeShareCooldown = 0;
            this.fearKnowledgeInjected = false;
            this.ageYears = 18 + rng() * 20;
            this.lifeStage = 'adult';
            this.familyId = null;
            this.partnerId = null;
            this.homeBuildingId = null;
            this.traits = createTraitProfile(rng);
            this.relationships = {
                family: {},
                friends: {},
                rivals: {},
                mentorStudent: {}
            };
            this.mood = {
                social: 0,
                conflict: 0,
                purpose: 0,
                grief: 0
            };
            this.emotionalMemory = {
                battleTrauma: 0,
                griefLoad: 0,
                mourningTtl: 0,
                lastLossName: null,
                lastLossCause: null,
                lastLossTtl: 0
            };
            this.lastDecisionScores = [];
        }

        update(dt, world) {
            if (!this.alive) {
                return;
            }
            this.worldRef = world;

            this.decisionCooldown = Math.max(0, this.decisionCooldown - dt);
            this.thoughtCooldown = Math.max(0, this.thoughtCooldown - dt);
            this.pathRecalcCooldown = Math.max(0, this.pathRecalcCooldown - dt);
            this.knowledgeShareCooldown = Math.max(0, this.knowledgeShareCooldown - dt);
            this.lastBattleHitTtl = Math.max(0, this.lastBattleHitTtl - dt);
            this.battleOrderTtl = Math.max(0, this.battleOrderTtl - dt);
            this.emotionalMemory.battleTrauma = clamp(this.emotionalMemory.battleTrauma - dt * (this.state === 'sleeping' ? 0.018 : 0.006), 0, 1);
            this.emotionalMemory.griefLoad = clamp(this.emotionalMemory.griefLoad - dt * 0.004, 0, 1);
            this.emotionalMemory.mourningTtl = Math.max(0, this.emotionalMemory.mourningTtl - dt);
            this.emotionalMemory.lastLossTtl = Math.max(0, this.emotionalMemory.lastLossTtl - dt);
            this.mood.grief = clamp(this.emotionalMemory.griefLoad * 100, 0, 100);
            this.ageYears += dt / YEAR_DURATION;
            this.lifeStage = this.ageYears < 16 ? 'youth' : 'adult';
            const localWeather = world.getWeatherStateAt(this.x, this.y, {
                sheltered: distance(this, world.camp) < 44 && world.camp.shelter > 28
            });
            const threatVisionRadius = world.getWeatherVisibilityRadius(this, 140, { sheltered: localWeather.visibility > 0.82 && distance(this, world.camp) < 36 });
            this.threat = world.findNearestPredator(this, threatVisionRadius);
            this.threatDistance = this.threat ? distance(this, this.threat) : Infinity;

            const weather = world.getWeather();
            const season = world.getSeason();
            const temperature = world.getTemperatureAt(this.x, this.y);
            const nearCamp = distance(this, world.camp) < 80;
            const fireComfort = nearCamp && world.camp.fireFuel > 4 ? 1.6 : 0;
            const moveDrain = this.state === 'moving' ? 0.35 : 0;
            const sleepRecover = this.state === 'sleeping' ? 5.8 : 0;

            this.stats.hunger = clamp(this.stats.hunger - dt * (0.62 * season.hunger + moveDrain * 0.4), 0, 100);
            this.stats.thirst = clamp(this.stats.thirst - dt * (0.66 * season.thirst * weather.thirst + moveDrain * 0.32), 0, 100);
            const enduranceBonus = 1 - this.traits.endurance * 0.18;
            this.stats.energy = clamp(this.stats.energy - dt * (0.72 + moveDrain * 0.68) * enduranceBonus + dt * sleepRecover, 0, 100);

            const coldStress = clamp((8 - temperature) / 18, 0, 2.2) * weather.warmth;
            const clothingReduction = this.equipment.clothing ? 0.7 : 1;
            this.stats.warmth = clamp(this.stats.warmth - dt * Math.max(0.2, coldStress) * clothingReduction + dt * fireComfort, 0, 100);

            const moraleDelta = (
                (this.stats.hunger < 28 ? -0.9 : 0) +
                (this.stats.thirst < 28 ? -1 : 0) +
                (this.stats.warmth < 24 ? -0.9 : 0) +
                (this.stats.energy < 20 ? -0.7 : 0) +
                (nearCamp ? 0.35 : 0) +
                this.mood.social * 0.04 -
                this.mood.conflict * 0.06 +
                this.mood.purpose * 0.04 -
                this.emotionalMemory.battleTrauma * 0.55 -
                this.emotionalMemory.griefLoad * 0.48
            );
            this.stats.morale = clamp(this.stats.morale + dt * moraleDelta, 0, 100);

            const danger = [this.stats.hunger, this.stats.thirst, this.stats.warmth, this.stats.energy].filter((v) => v <= 0).length;
            if (danger > 0) {
                this.stats.health = clamp(this.stats.health - dt * (1.5 + danger * 1.3), 0, 100);
            } else if (nearCamp) {
                this.stats.health = clamp(this.stats.health + dt * 0.55, 0, 100);
            }
            if (nearCamp && this.stats.health > 72 && this.state !== 'moving') {
                this.woundSeverity = clamp(this.woundSeverity - dt * 0.015, 0, 1);
                if (this.woundSeverity < 0.12) {
                    this.woundCount = Math.max(0, this.woundCount - dt * 0.08);
                }
            }

            if (this.stats.health <= 0) {
                this.alive = false;
                if (this.lastDamageCause === 'battle') {
                    world.pushEvent(`${this.name} died from battle wounds.`);
                } else {
                    world.pushEvent(`${this.name} died after the environment overwhelmed their needs.`);
                }
                return;
            }

            if (this.battleOrderTtl <= 0 && this.assignedBattlefrontId !== null) {
                this.assignedBattlefrontId = null;
                this.battleRole = null;
                this.battleFormationIndex = -1;
            }

            world.refreshEquipment(this);

            const isMidAction = this.state === 'moving' || this.state === 'working' || this.state === 'sleeping';
            const shouldRefreshIntent = !this.plan.length || (this.decisionCooldown <= 0 && this.planStep === 0 && !isMidAction);
            if (shouldRefreshIntent || this.shouldReplan(world)) {
                this.buildPlan(world);
            }

            this.executePlan(dt, world);
        }

        gainSkill(skill, amount) {
            if (!(skill in this.skills)) {
                return;
            }
            const modifier = this.worldRef ? this.worldRef.getSimulationKnob('learningRate') : 1;
            this.skills[skill] = clamp(this.skills[skill] + amount * modifier, 0, 100);
        }

        shouldReplan(world) {
            if (!this.plan.length) {
                return true;
            }
            const currentStep = this.plan[this.planStep];
            if (!currentStep) {
                return true;
            }
            if (currentStep.kind === 'resource' && currentStep.entity.depleted) {
                return true;
            }
            if (currentStep.action === 'battleEngage' && currentStep.entity.resolved) {
                return true;
            }
            if (currentStep.kind === 'resource' && currentStep.entity.type === 'water') {
                return this.stats.thirst > 78 && this.intent !== 'drink';
            }
            if (this.intent === 'warm' && world.camp.fireFuel <= 0 && this.stats.warmth < 20) {
                return true;
            }
            return false;
        }

        buildPlan(world) {
            const stats = this.stats;
            const options = [
                {
                    key: 'protect',
                    need: 'danger',
                    score: this.threat && world.shouldColonistProtect(this) ? (
                        (distance(this, world.camp) < 95 ? 940 : 0) +
                        (this.stats.health > 72 ? 80 : 0) +
                        (this.stats.energy > 55 ? 40 : 0) +
                        Math.max(0, 90 - this.threatDistance) +
                        this.traits.bravery * 40 -
                        this.traits.caution * 18 +
                        world.getTraitDecisionBias(this, 'protect') +
                        world.getActionConfidence(this, 'protect') * 16 +
                        this.emotionalMemory.griefLoad * 24 -
                        this.emotionalMemory.battleTrauma * 18 +
                        world.getDivineSuggestionBonus('protect')
                    ) : -1,
                    builder: () => world.buildProtectPlan(this)
                },
                {
                    key: 'flee',
                    need: 'danger',
                    score: this.threat && world.shouldColonistFlee(this) ? (
                        880 +
                        (this.stats.health < 55 ? 90 : 0) +
                        (distance(this, world.camp) > 95 ? 40 : 0) +
                        Math.max(0, 120 - this.threatDistance) * 0.7 +
                        this.traits.caution * 35 -
                        this.traits.bravery * 10 +
                        world.getTraitDecisionBias(this, 'flee') +
                        world.getActionConfidence(this, 'flee') * 14 +
                        this.emotionalMemory.battleTrauma * 22
                    ) : -1,
                    builder: () => world.buildFleePlan(this)
                },
                {
                    key: 'war',
                    need: 'war',
                    score: world.shouldColonistJoinBattle(this) ? (
                        820 +
                        this.skills.combat * 10 +
                        world.getRoleBias(this, 'hunter') * 14 +
                        world.getRoleBias(this, 'builder') * 4 +
                        this.traits.bravery * 32 -
                        this.traits.caution * 8 +
                        world.getTraitDecisionBias(this, 'war') +
                        world.getActionConfidence(this, 'war') * 16 +
                        this.emotionalMemory.griefLoad * 10 -
                        this.emotionalMemory.battleTrauma * 26 +
                        world.getDivineSuggestionBonus('war')
                    ) : -1,
                    builder: () => world.buildWarPlan(this)
                },
                {
                    key: 'drink',
                    need: 'thirst',
                    score: (100 - stats.thirst) * 1.55 +
                        (world.camp.water < 5 ? 10 : 0) +
                        (world.camp.water <= 0.5 && stats.thirst > 40 ? -22 : 0) -
                        world.getActionConfidence(this, 'drink') * 12 +
                        world.getTraitDecisionBias(this, 'drink') +
                        world.getLessonBonus('dehydration', 'drink') -
                        world.getIntentPenalty('drink') +
                        world.getDivineSuggestionBonus('drink'),
                    builder: () => world.buildDrinkPlan(this)
                },
                {
                    key: 'haulWater',
                    need: 'water_supply',
                    score: clamp(10 - world.camp.water, 0, 10) * 4.1 +
                        (world.camp.water < 3 ? 18 : 0) +
                        (stats.thirst > 78 ? -10 : 0) -
                        world.getActionConfidence(this, 'haulWater') * 12 +
                        world.getTraitDecisionBias(this, 'haulWater') +
                        world.getLessonBonus('dehydration', 'haulWater') -
                        world.getIntentPenalty('haulWater') +
                        world.getDivineSuggestionBonus('haulWater') +
                        world.getCultureIntentBias('haulWater'),
                    builder: () => world.buildWaterHaulPlan(this)
                },
                {
                    key: 'eat',
                    need: 'hunger',
                    score: (100 - stats.hunger) * 1.4 +
                        (world.camp.food < 6 ? 8 : 0) +
                        (world.camp.food < 4 && stats.hunger > 24 ? -18 : 0) +
                        (world.camp.food < 2 && stats.hunger > 32 ? -26 : 0) +
                        (world.camp.food <= 0.5 && stats.hunger > 34 ? -20 : 0) -
                        world.getActionConfidence(this, 'eat') * 10 +
                        world.getTraitDecisionBias(this, 'eat') +
                        world.getLessonBonus('starvation', 'eat') -
                        world.getIntentPenalty('eat') +
                        world.getDivineSuggestionBonus('eat'),
                    builder: () => world.buildEatPlan(this)
                },
                {
                    key: 'warm',
                    need: 'warmth',
                    score: (100 - stats.warmth) * 1.45 +
                        Math.max(0, 10 - world.getTemperatureAt(this.x, this.y)) * 2.4 +
                        world.getActionConfidence(this, 'warm') * 8 +
                        world.getTraitDecisionBias(this, 'warm') +
                        world.getLessonBonus('exposure', 'warm'),
                    builder: () => world.buildWarmPlan(this)
                },
                {
                    key: 'sleep',
                    need: 'energy',
                    score: (100 - stats.energy) * 1.18 + world.getLessonBonus('exhaustion', 'sleep') + this.emotionalMemory.griefLoad * 12 + world.getActionConfidence(this, 'sleep') * 10 + world.getTraitDecisionBias(this, 'sleep'),
                    builder: () => world.buildSleepPlan(this)
                },
                {
                    key: 'tend',
                    need: 'recovery',
                    score: clamp(96 - stats.health, 0, 40) * 1.6 + (stats.health < 86 ? 20 : 0) + world.getActionConfidence(this, 'tend') * 10 + world.getTraitDecisionBias(this, 'tend'),
                    builder: () => world.buildTendPlan(this)
                },
                {
                    key: 'forage',
                    need: 'food_supply',
                    score: clamp(16 - world.camp.food, 0, 16) * 3.4 +
                        (world.camp.food < 4 ? 14 : 0) +
                        (world.camp.food < 3 && stats.hunger > 26 ? 18 : 0) +
                        (stats.hunger < 35 ? 4 : 0) -
                        Math.min(7, Math.max(0, 100 - stats.hunger)) * 0.22 +
                        world.getStockpilePressure() * 0.9 +
                        world.getLessonBonus('starvation', 'forage') -
                        world.getFailurePenalty(this, 'collectFood') -
                        world.getActionConfidence(this, 'forage') * 12 +
                        world.getIntentPenalty('forage') +
                        world.getDivineSuggestionBonus('forage') +
                        world.getRoleBias(this, 'gatherer') * 7 +
                        world.getCultureIntentBias('forage') +
                        this.traits.curiosity * 10 +
                        world.getTraitDecisionBias(this, 'forage') +
                        world.getEraDecisionBias('forage'),
                    builder: () => world.buildForagePlan(this)
                },
                {
                    key: 'gatherWood',
                    need: 'fuel',
                    score: clamp(12 - world.camp.fireFuel, 0, 12) * 2.9 +
                        clamp(10 - world.camp.wood, 0, 10) * 1.4 +
                        world.getConstructionDemand('wood') * 3 +
                        world.getLessonBonus('exposure', 'gatherWood') -
                        world.getActionConfidence(this, 'gatherWood') * 10 +
                        world.getIntentPenalty('gatherWood') +
                        world.getDivineSuggestionBonus('gatherWood') +
                        Math.max(world.getRoleBias(this, 'builder'), world.getRoleBias(this, 'gatherer')) * 6 +
                        world.getTraitDecisionBias(this, 'gatherWood') +
                        world.getEraDecisionBias('gatherWood'),
                    builder: () => world.buildWoodPlan(this)
                },
                {
                    key: 'gatherStone',
                    need: 'shelter',
                    score: clamp(78 - world.camp.shelter, 0, 30) * 0.8 +
                        clamp(4 - world.camp.stone, 0, 4) * 1.4 +
                        world.getConstructionDemand('stone') * 3.5 +
                        world.getLessonBonus('exposure', 'gatherStone') -
                        world.getActionConfidence(this, 'gatherStone') * 10 +
                        world.getIntentPenalty('gatherStone') +
                        world.getDivineSuggestionBonus('gatherStone') +
                        world.getRoleBias(this, 'builder') * 7 +
                        world.getTraitDecisionBias(this, 'gatherStone') +
                        world.getEraDecisionBias('gatherStone'),
                    builder: () => world.buildStonePlan(this)
                },
                {
                    key: 'hunt',
                    need: 'protein',
                    score: clamp(8 - world.camp.food, 0, 8) * 2.3 +
                        (world.camp.food < 3 ? 9 : 0) +
                        world.getStockpilePressure() * 0.75 +
                        (world.camp.food < 2 && this.stats.health > 60 && this.stats.energy > 48 ? 18 : 0) +
                        (this.equipment.hunting?.type === 'spear' ? 14 : 0) +
                        (world.countCampItems('spear') > 0 ? 4 : 0) +
                        (stats.hunger < 28 ? 4 : 0) -
                        world.getLessonBonus('starvation', 'hunt') -
                        world.getFailurePenalty(this, 'huntAnimal') -
                        world.getActionConfidence(this, 'hunt') * 12 +
                        world.getIntentPenalty('hunt') +
                        world.getDivineSuggestionBonus('hunt') +
                        world.getRoleBias(this, 'hunter') * 8 +
                        world.getCultureIntentBias('hunt') +
                        this.traits.bravery * 10 -
                        this.traits.caution * 8 +
                        world.getTraitDecisionBias(this, 'hunt') +
                        world.getEraDecisionBias('hunt'),
                    builder: () => world.buildHuntPlan(this)
                },
                {
                    key: 'craft',
                    need: 'practice',
                    score: world.chooseCraftRecipe(this)
                        ? 18 +
                            (this.skills.crafting < 8 ? 10 : 0) +
                            Math.max(0, this.skills.crafting - world.getColonySkillAverage('crafting')) * 10 +
                            world.getActionConfidence(this, 'craft') * 10 +
                            world.getDivineSuggestionBonus('craft') +
                            world.getRoleBias(this, 'crafter') * 9 +
                            this.traits.curiosity * 8 +
                            world.getTraitDecisionBias(this, 'craft') +
                            world.getEraDecisionBias('craft')
                        : -1,
                    builder: () => world.buildCraftPlan(this)
                },
                {
                    key: 'process',
                    need: 'materials',
                    score: world.chooseProcessingTask()
                        ? 14 +
                            (this.skills.crafting < 10 ? 8 : 0) +
                            Math.max(0, this.skills.crafting - world.getColonySkillAverage('crafting')) * 9 +
                            Math.max(world.getConstructionDemand('planks'), world.getConstructionDemand('rope')) * 4 +
                            world.getActionConfidence(this, 'process') * 10 +
                            world.getDivineSuggestionBonus('process') +
                            world.getRoleBias(this, 'crafter') * 8 +
                            world.getTraitDecisionBias(this, 'process') +
                            world.getEraDecisionBias('process')
                        : -1,
                    builder: () => world.buildProcessPlan(this)
                },
                {
                    key: 'repair',
                    need: 'gear',
                    score: world.needsToolRepair()
                        ? 12 +
                            (this.skills.crafting < 12 ? 8 : 0) +
                            Math.max(0, this.skills.crafting - world.getColonySkillAverage('crafting')) * 8 +
                            world.getRoleBias(this, 'crafter') * 8 +
                            world.getActionConfidence(this, 'repair') * 8 +
                            world.getTraitDecisionBias(this, 'repair') +
                            world.getEraDecisionBias('repair')
                        : -1,
                    builder: () => world.buildRepairPlan(this)
                },
                {
                    key: 'plant',
                    need: 'future_food',
                    score: world.shouldAttemptPlanting(this)
                        ? 22 +
                            (this.skills.farming < 8 ? 12 : 0) +
                            (this.equipment.farming?.type === 'hoe' ? 18 : 0) +
                            (world.countCampItems('hoe') > 0 ? 6 : 0) +
                            world.getRoleBias(this, 'farmer') * 8 +
                            world.getActionConfidence(this, 'plant') * 10 +
                            world.getDivineSuggestionBonus('plant') +
                            world.getCultureIntentBias('plant') +
                            this.traits.curiosity * 5 +
                            world.getTraitDecisionBias(this, 'plant') +
                            world.getEraDecisionBias('plant')
                        : -1,
                    builder: () => world.buildPlantTrialPlan(this)
                },
                {
                    key: 'socialize',
                    need: 'society',
                    score: world.buildSocialPlan(this)
                        ? 10 +
                            this.traits.sociability * 18 +
                            this.mood.social * 2 -
                            this.mood.conflict * 3 +
                            this.emotionalMemory.griefLoad * 18 +
                            world.getActionConfidence(this, 'socialize') * 10 +
                            world.getDivineSuggestionBonus('socialize') +
                            world.getCultureIntentBias('socialize') +
                            (this.stats.morale < 55 ? 8 : 0) +
                            world.getTraitDecisionBias(this, 'socialize') +
                            world.getEraDecisionBias('socialize')
                        : -1,
                    builder: () => world.buildSocialPlan(this)
                },
                {
                    key: 'build',
                    need: 'settlement',
                    score: world.getConstructionScore(this) + world.getCultureIntentBias('build') + world.getDivineSuggestionBonus('build') + world.getActionConfidence(this, 'build') * 10 + world.getTraitDecisionBias(this, 'build') + world.getEraDecisionBias('build'),
                    builder: () => world.buildConstructionPlan(this)
                },
                {
                    key: 'rest',
                    need: 'steady',
                    score: 6,
                    builder: () => world.buildRestPlan(this)
                }
            ].sort((a, b) => b.score - a.score);

            this.lastDecisionScores = options.slice(0, 5).map((option) => ({
                key: option.key,
                need: option.need,
                score: Number(option.score.toFixed(1))
            }));

            const viable = [];
            for (const option of options) {
                const plan = option.builder();
                if (plan && plan.length) {
                    viable.push({ option, plan });
                }
            }

            let selected = null;
            if (viable.length) {
                const topScore = viable[0].option.score;
                const critical = viable[0];
                const criticalIntent = ['protect', 'flee', 'war'].includes(critical.option.key) && critical.option.score >= 220;
                if (criticalIntent) {
                    selected = critical;
                } else {
                    const shortlist = viable.filter((entry) => entry.option.score >= Math.max(4, topScore - 22));
                    selected = world.pickWeightedDecision(shortlist) || viable[0];
                }
            }

            if (!selected) {
                selected = { option: options[options.length - 1], plan: world.buildRestPlan(this) };
            }

            this.intent = selected.option.key;
            this.lastNeed = selected.option.need;
            this.decisionCooldown = 1 + world.rng() * 0.8;
            this.plan = selected.plan;
            this.planStep = 0;
            this.path = [];
            this.pathIndex = 0;
            this.actionProgress = 0;

            if (this.thoughtCooldown <= 0) {
                world.pushThought(`${this.name} ${this.intentLabel()}.`);
                this.thoughtCooldown = 5 + world.rng() * 2;
            }
        }

        intentLabel() {
            switch (this.intent) {
                case 'protect': return 'protecting the camp';
                case 'war': return 'holding the battle line';
                case 'drink': return 'searching for water';
                case 'haulWater': return 'hauling water';
                case 'eat': return 'searching for food';
                case 'warm': return 'warming by the fire';
                case 'sleep': return 'resting';
                case 'tend': return 'treating wounds';
                case 'forage': return 'gathering food';
                case 'gatherWood': return 'hauling wood';
                case 'gatherStone': return 'carrying stone';
                case 'hunt': return 'fighting for food';
                case 'craft': return 'crafting tools';
                case 'process': return 'processing materials';
                case 'repair': return 'repairing tools';
                case 'plant': return 'testing planted food';
                case 'socialize': return 'meeting with others';
                case 'build': return 'building the settlement';
                case 'flee': return 'fleeing';
                default: return 'holding position';
            }
        }

        executePlan(dt, world) {
            const step = this.plan[this.planStep];
            if (!step) {
                this.state = 'idle';
                this.vx = 0;
                this.vy = 0;
                return;
            }

            if (step.kind === 'wander') {
                this.state = 'moving';
                this.moveAlongPathOrDirect(step, dt, world);
                if (distance(this, step) < 12) {
                    this.advancePlan();
                }
                return;
            }

            const destination = step.destination || (step.kind === 'camp' ? world.camp : step.entity);
            if (distance(this, destination) > 12) {
                this.state = 'moving';
                this.moveAlongPathOrDirect(destination, dt, world);
                return;
            }

            this.state = this.intent === 'sleep' ? 'sleeping' : 'working';
            this.vx = 0;
            this.vy = 0;
            this.actionProgress += dt;
            if (this.actionProgress < step.duration) {
                return;
            }

            world.completeIntent(this, step);
            this.actionProgress = 0;
            this.advancePlan();
        }

        advancePlan() {
            this.planStep += 1;
            this.path = [];
            this.pathIndex = 0;
            if (this.planStep >= this.plan.length) {
                this.plan = [];
                this.planStep = 0;
                this.state = 'idle';
                this.vx = 0;
                this.vy = 0;
                this.decisionCooldown = 0;
            }
        }

        moveAlongPathOrDirect(target, dt, world) {
            if (this.pathRecalcCooldown <= 0) {
                this.path = world.findPath(this, target);
                this.pathIndex = 0;
                this.pathRecalcCooldown = 1.4;
            }

            const waypoint = this.path[this.pathIndex] || target;
            this.moveToward(waypoint, dt);
            if (distance(this, waypoint) < 8 && this.pathIndex < this.path.length) {
                this.pathIndex += 1;
            }
        }

        moveToward(target, dt) {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const length = Math.hypot(dx, dy) || 1;
            const movementMultiplier = this.worldRef ? this.worldRef.getMovementSpeedMultiplierAt(this.x, this.y) : 1;
            const effectiveSpeed = this.speed * movementMultiplier;
            const step = Math.min(length, effectiveSpeed * dt);
            this.vx = (dx / length) * effectiveSpeed;
            this.vy = (dy / length) * effectiveSpeed;
            if (this.worldRef) {
                this.worldRef.recordTrafficAtPosition(this.x, this.y, 0.06);
            }
            this.x += (dx / length) * step;
            this.y += (dy / length) * step;
            if (this.worldRef) {
                this.worldRef.recordTrafficAtPosition(this.x, this.y, 0.08);
            }
        }
    }

    class PhaseOneWorld {
        constructor(seed, inheritedMemory = null) {
            this.seed = seed;
            this.rng = createRng(seed);
            this.width = WORLD_WIDTH;
            this.height = WORLD_HEIGHT;
            this.cells = [];
            this.resources = [];
            this.animals = [];
            this.predators = [];
            this.colonists = [];
            this.thoughts = ['Waiting for the colonists to wake up.'];
            this.events = ['World initialized.'];
            this.selectedEntity = null;
            this.elapsed = 0;
            this.timeOfDay = 0.28;
            this.day = 1;
            this.year = 1;
            this.seasonIndex = 0;
            this.daysPerSeason = DAYS_PER_SEASON;
            this.weatherIndex = 0;
            this.weatherTimer = 55;
            this.weatherDuration = 55;
            this.forcedWeather = null;
            this.weatherManager = new WeatherManager(this);
            this.simulationSpeed = 1;
            this.paused = false;
            this.generation = (inheritedMemory?.generation || 0) + 1;
            this.lineageMemory = normalizeLineageMemory(inheritedMemory);
            this.colonyKnowledge = createKnowledgeLayer();
            this.extinctionSnapshot = null;
            this.nextItemId = 1;
            this.nextProjectId = 1;
            this.nextColonistId = 0;
            this.nextFamilyId = 1;
            this.nextResourceId = 1;
            this.progress = {
                completedActions: {},
                recipeCrafts: {}
            };
            this.recentLabor = {
                farmer: 0,
                builder: 0,
                gatherer: 0,
                hunter: 0,
                crafter: 0
            };
            this.projects = [];
            this.buildings = [];
            this.families = [];
            this.relationshipEvents = [];
            this.rituals = [];
            this.branchColonies = clone(this.lineageMemory.branchColonies || []).map((colony, index) =>
                this.normalizeBranchColony(colony, index)
            );
            this.lastSeasonName = SEASONS[this.seasonIndex].name;
            this.structureRaidCooldown = 0;
            this.mainAttackCooldown = 30;
            this.weatherDamageCooldown = 0;
            this.lightningStrikeCooldown = 0;
            this.lastResolvedLightningFlash = 0;
            this.usedNames = new Set();
            this.borderIncidents = [];
            this.factionEvents = [];
            this.lastRaid = null;
            this.factionParties = [];
            this.factionEffects = [];
            this.battlefronts = [];
            this.battleBursts = [];
            this.battleScars = [];
            this.battleReports = [];
            this.reportCounter = 0;
            this.eraHistory = [];
            this.lastKnownEra = 'survival';
            this.battleManager = new PhaseOneSim.PhaseOneBattleManager(this);
            this.godMode = {
                protectBubbleTtl: 0,
                relics: [],
                divineSuggestion: {
                    focus: null,
                    ttl: 0,
                    source: null
                },
                myths: [],
                simulationKnobs: {
                    seasonPace: 1,
                    weatherSeverity: 1,
                    resourceAbundance: 1,
                    diseasePressure: 1,
                    learningRate: 1,
                    disasterFrequency: 1
                }
            };
            this.warAftermath = {
                occupation: null,
                recent: []
            };
            this.achievements = clone(this.lineageMemory.achievements || []);
            this.achievementLog = [];
            this.phase9 = {
                milestones: {
                    permanentSettlement: false,
                    agriculturalStability: false,
                    fortifiedCivilization: false,
                    regionalPower: false,
                    terraformer: false
                },
                terraforming: {
                    clearForest: 0,
                    digIrrigation: 0,
                    buildTerraces: 0,
                    drainMarsh: 0,
                    fortifyHills: 0,
                    quarryMountains: 0
                },
                ecology: {
                    fertility: 1,
                    rainfall: 1,
                    foodChain: 1,
                    diseaseRisk: 0,
                    soilHealth: 1,
                    forestLoss: 0,
                    huntingPressure: 0
                },
                pressure: {
                    weatherExtremes: 0,
                    predatorMigrations: 0,
                    unrest: 0,
                    blight: 0,
                    soilDepletion: 0,
                    frequentSkirmishes: 0,
                    largeScaleBattles: 0,
                    enemyTechEscalation: 0,
                    disease: 0
                },
                cooldowns: {
                    disease: 0,
                    unrest: 0,
                    blight: 0,
                    predators: 0
                }
            };
            this.institutionLife = {
                cohesion: 0.18,
                governance: 0,
                learning: 0,
                tradeCulture: 0
            };
            this.foodCulture = {
                recentSources: {
                    foraged: 6,
                    hunted: 3,
                    farmed: 0,
                    prepared: 0
                },
                staple: 'wild forage',
                dietLabel: 'forager fare',
                productionMode: 'gathered stores',
                diversity: 0.22
            };
            this.knownInstitutions = [];
            this.landUse = {
                farmingZones: [],
                gatheringZones: [],
                huntingZones: [],
                dangerZones: [],
                roads: [],
                tradeRoutes: [],
                patrolRoutes: [],
                contestedZones: [],
                outposts: [],
                ambushPoints: [],
                trafficPaths: [],
                institutionSites: [],
                districts: [],
                branchTerritories: []
            };
            this.camp = {
                x: this.width * 0.5,
                y: this.height * 0.5,
                food: resourcesConfig.campStores.food,
                water: resourcesConfig.campStores.water,
                wood: resourcesConfig.campStores.wood,
                stone: resourcesConfig.campStores.stone,
                shelter: 76,
                fireFuel: resourcesConfig.campStores.fireFuel,
                materials: createMaterialInventory(),
                items: [],
                structures: {
                    firePit: 0
                }
            };
            this.colonyKnowledge.shelterSpots.push({
                x: Math.round(this.camp.x),
                y: Math.round(this.camp.y)
            });

            this.applyInheritedMemory();

            this.generateTerrain();
            this.spawnResources();
            this.ensureStarterResources();
            this.nextResourceId = this.resources.reduce((maxId, resource) => Math.max(maxId, resource.id), 0) + 1;
            this.spawnColonists();
            this.lastKnownEra = this.getCurrentEra();
            this.eraHistory = [{ era: this.lastKnownEra, year: this.year, day: this.day, source: 'founding' }];
            this.pushEvent(this.generation === 1
                ? 'Generation 1 entered the sandbox.'
                : `Generation ${this.generation} emerged carrying old lessons.`);
        }

        applyInheritedMemory() {
            const causes = this.lineageMemory.deathCauses || {};
            const settlement = this.lineageMemory.settlementKnowledge || {};
            if ((causes.dehydration || 0) > 0) {
                this.camp.water += 8;
            }
            if ((causes.starvation || 0) > 0) {
                this.camp.food += 7;
            }
            if ((causes.exposure || 0) > 0) {
                this.camp.wood += 6;
                this.camp.fireFuel += 4;
                this.camp.shelter += 4;
            }
            if ((causes.exhaustion || 0) > 0) {
                this.camp.food += 3;
                this.camp.water += 3;
            }
            if ((causes.predatorAttack || 0) > 0) {
                this.camp.food += 2;
                this.camp.wood += 2;
            }
            this.camp.wood += settlement.housingTier * 1.5 + settlement.civicTier;
            this.camp.stone += settlement.storageTier + settlement.defenseTier * 1.5;
            this.camp.fireFuel += settlement.civicTier * 0.8;
            for (const [type, entries] of Object.entries(this.lineageMemory.knownResources || {})) {
                this.colonyKnowledge.resources[type] = clone(entries).slice(0, 8);
            }
            this.colonyKnowledge.dangerZones = clone(this.lineageMemory.dangerZones || []).slice(0, 8);
            const inheritedShelter = clone(this.lineageMemory.shelterSpots || []).slice(0, 4);
            for (const spot of inheritedShelter) {
                rememberPoint(this.colonyKnowledge.shelterSpots, spot, 6, 22);
            }
            const inheritedDiscoveries = clone(this.lineageMemory.discoveries || []).slice(0, 12);
            if ((settlement.housingTier || 0) >= 1) {
                inheritedDiscoveries.push('settlement:better_housing');
            }
            if ((settlement.storageTier || 0) >= 1) {
                inheritedDiscoveries.push('settlement:better_storage');
            }
            if ((settlement.civicTier || 0) >= 1) {
                inheritedDiscoveries.push('settlement:civic_work');
            }
            if ((settlement.defenseTier || 0) >= 1) {
                inheritedDiscoveries.push('settlement:layered_defense');
            }
            if ((settlement.housingTier || 0) >= 3 || (settlement.storageTier || 0) >= 2 || (settlement.civicTier || 0) >= 2 || (settlement.defenseTier || 0) >= 2) {
                inheritedDiscoveries.push('shared_settlement_methods');
            }
            this.colonyKnowledge.discoveries = Array.from(new Set(inheritedDiscoveries)).slice(0, 12);
            this.camp.shelter = clamp(this.camp.shelter, 0, 100);
        }

        getInheritedTraits() {
            return createTraitProfile(this.rng, this.lineageMemory.traitAverages || {});
        }

        hasTechnology(key) {
            return this.colonyKnowledge.discoveries.includes(`tech:${key}`);
        }

        unlockTechnology(key, message = null) {
            if (!TECH_DEFS[key] || this.hasTechnology(key)) {
                return false;
            }
            this.noteDiscovery(`tech:${key}`, message || `The colony advanced toward ${TECH_DEFS[key].label}.`);
            return true;
        }

        getEraDisplayName(era = this.getCurrentEra()) {
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

        getColonyStability() {
            const averages = this.getAverages();
            const foodStability = clamp(this.camp.food / Math.max(8, this.colonists.length * 4), 0, 1);
            const waterStability = clamp(this.camp.water / Math.max(6, this.colonists.length * 3), 0, 1);
            const moraleStability = clamp((averages.morale || 0) / 100, 0, 1);
            const healthStability = clamp((averages.health || 0) / 100, 0, 1);
            const housingStability = clamp((this.getHousingSatisfaction() - 0.45) / 0.8, 0, 1);
            const stockpilePenalty = clamp(this.getStockpilePressure() / 8, 0, 1);
            return clamp(
                foodStability * 0.22 +
                waterStability * 0.16 +
                moraleStability * 0.18 +
                healthStability * 0.18 +
                housingStability * 0.18 +
                (1 - stockpilePenalty) * 0.08,
                0,
                1
            );
        }

        getCurrentTechBands() {
            const active = new Set(['survival']);
            for (const key of Object.keys(TECH_DEFS)) {
                if (this.hasTechnology(key)) {
                    active.add(TECH_DEFS[key].band);
                }
            }
            return TECH_BANDS.filter((band) => active.has(band));
        }

        getCurrentEra() {
            const active = new Set(this.getCurrentTechBands());
            const bands = ERA_BANDS.filter((band) => active.has(band));
            return bands[bands.length - 1] || 'survival';
        }

        getEraDiplomacyProfile(era = this.getCurrentEra()) {
            return ERA_DIPLOMACY_PROFILES[era] || ERA_DIPLOMACY_PROFILES.survival;
        }

        getEraDiplomacyMethod(state = 'cautious', era = this.getCurrentEra()) {
            const profile = this.getEraDiplomacyProfile(era);
            if (state === 'allied') {
                return `${profile.diplomacyMethod} alliance`;
            }
            if (state === 'trading') {
                return profile.tradeMethod;
            }
            if (state === 'rival') {
                return profile.warfareMethod;
            }
            return profile.diplomacyMethod;
        }

        getEraWarfareMethod(strategy = 'watchful', era = this.getCurrentEra()) {
            const profile = this.getEraDiplomacyProfile(era);
            const map = {
                raid: profile.warfareMethod,
                'punitive strike': era === 'iron age' ? 'iron levy reprisals' : era === 'bronze age' ? 'bronze shield reprisals' : era === 'metallurgy' ? 'disciplined reprisals' : era === 'engineering' ? 'road-column reprisals' : era === 'masonry' ? 'fortified reprisals' : 'frontier reprisals',
                'defense in depth': era === 'iron age' ? 'fort-line defense' : era === 'bronze age' ? 'shieldwall defense' : era === 'engineering' || era === 'metallurgy' ? 'layered fort defense' : 'screened retreat',
                'total war': era === 'iron age' ? 'iron frontier campaigns' : era === 'bronze age' ? 'bronze host campaigns' : era === 'metallurgy' ? 'siege campaigns' : era === 'engineering' ? 'coordinated campaigns' : 'mass frontier war',
                'support campaign': era === 'iron age' ? 'road-legion relief' : era === 'bronze age' ? 'league levy relief' : era === 'engineering' || era === 'metallurgy' ? 'league relief' : 'allied relief',
                watchful: profile.diplomacyMethod
            };
            return map[strategy] || profile.warfareMethod;
        }

        recordFoodSource(source, amount = 1) {
            if (!this.foodCulture?.recentSources || !FOOD_SOURCE_KEYS.includes(source)) {
                return;
            }
            this.foodCulture.recentSources[source] = (this.foodCulture.recentSources[source] || 0) + Math.max(0, amount);
        }

        getFoodCultureSummary() {
            const recent = this.foodCulture?.recentSources || {};
            const weighted = {
                foraged: recent.foraged || 0,
                hunted: recent.hunted || 0,
                farmed: recent.farmed || 0,
                prepared: recent.prepared || 0
            };
            const total = Object.values(weighted).reduce((sum, value) => sum + value, 0);
            const shares = total > 0
                ? Object.fromEntries(Object.entries(weighted).map(([key, value]) => [key, value / total]))
                : { foraged: 0.55, hunted: 0.3, farmed: 0.1, prepared: 0.05 };
            const dominant = Object.entries(shares).sort((left, right) => right[1] - left[1])[0]?.[0] || 'foraged';
            const productiveFarms = this.countBuildings('farmPlot') + this.countBuildings('engineeredFarm');
            const kitchens = this.countBuildings('kitchen') + this.countBuildings('foodHall');
            const era = this.getCurrentEra();
            const stapleMap = {
                survival: {
                    foraged: 'wild forage',
                    hunted: 'roasted game',
                    farmed: 'rough planting',
                    prepared: 'hearth scraps'
                },
                toolmaking: {
                    foraged: 'foraged roots',
                    hunted: 'charred game',
                    farmed: 'small seed stores',
                    prepared: 'campfire suppers'
                },
                agriculture: {
                    foraged: 'field greens',
                    hunted: 'smoked meat',
                    farmed: 'grain porridge',
                    prepared: 'shared pot meals'
                },
                masonry: {
                    foraged: 'garden greens',
                    hunted: 'salted meat',
                    farmed: 'granary grain',
                    prepared: 'storehouse stews'
                },
                engineering: {
                    foraged: 'market herbs',
                    hunted: 'salt-cured meat',
                    farmed: 'milled grain',
                    prepared: 'hall meals'
                },
                metallurgy: {
                    foraged: 'market greens',
                    hunted: 'smoked cuts',
                    farmed: 'milled grain',
                    prepared: 'hearth feasts'
                },
                'bronze age': {
                    foraged: 'market greens',
                    hunted: 'bronze-smoked cuts',
                    farmed: 'granary grain',
                    prepared: 'bronze feast tables'
                },
                'iron age': {
                    foraged: 'roadside greens',
                    hunted: 'iron-smoked cuts',
                    farmed: 'field grain',
                    prepared: 'hall stewpots'
                }
            };
            const productionMode =
                productiveFarms >= 2 && kitchens > 0
                    ? (era === 'iron age' ? 'road granaries' : era === 'bronze age' ? 'bronze market halls' : era === 'metallurgy' ? 'market kitchens' : era === 'engineering' ? 'milled kitchens' : 'field kitchens')
                    : productiveFarms >= 2
                        ? (era === 'agriculture' ? 'field grain' : 'managed fields')
                        : weighted.hunted > weighted.foraged
                            ? 'hunting camps'
                            : 'gathered stores';
            const diversityBase = Object.values(shares).filter((value) => value > 0.14).length / 4;
            const diversity = clamp(diversityBase + kitchens * 0.08 + productiveFarms * 0.04, 0.12, 1);
            const dietLabel =
                era === 'survival'
                    ? (shares.hunted > shares.foraged ? 'game and gathered roots' : 'forager fare')
                    : era === 'toolmaking'
                        ? (shares.hunted > shares.foraged ? 'charred game and roots' : 'campfire forage')
                        : era === 'agriculture'
                            ? (shares.farmed >= 0.34 ? 'grain and gathered greens' : 'mixed harvest fare')
                            : era === 'masonry'
                                ? (shares.prepared >= 0.2 ? 'storehouse stews' : 'granary meals')
                                : era === 'engineering'
                                    ? (shares.prepared >= 0.24 ? 'milled hall meals' : 'engineered grain fare')
                                    : era === 'metallurgy'
                                        ? (shares.prepared >= 0.28 ? 'market hearth meals' : 'metal-age grain fare')
                                        : era === 'bronze age'
                                            ? (shares.prepared >= 0.3 ? 'bronze banquet fare' : 'bronze grain tables')
                                            : (shares.prepared >= 0.3 ? 'iron hall meals' : 'iron field rations');
            return {
                shares: Object.fromEntries(Object.entries(shares).map(([key, value]) => [key, Number(value.toFixed(2))])),
                staple: stapleMap[era]?.[dominant] || 'forager fare',
                dietLabel,
                productionMode,
                diversity: Number(diversity.toFixed(2))
            };
        }

        getCultureLegacyProfile(values = this.lineageMemory.culturalValues, options = {}) {
            const era = options.era || this.getCurrentEra();
            const rituals = options.rituals || this.rituals || [];
            const normalized = {
                hoardFood: this.getCulturalValue(values, 'hoardFood'),
                shareFood: this.getCulturalValue(values, 'shareFood'),
                avoidStrangers: this.getCulturalValue(values, 'avoidStrangers'),
                worshipNature: this.getCulturalValue(values, 'worshipNature'),
                favorExpansion: this.getCulturalValue(values, 'favorExpansion')
            };
            const scores = [
                {
                    key: 'communal hearth',
                    score: normalized.shareFood * 1.2 + normalized.worshipNature * 0.35 - normalized.hoardFood * 0.2,
                    ancientCustom: 'shared hearth rites',
                    modernization: {
                        survival: 'camp-circle kinship',
                        agriculture: 'feast-field custom',
                        masonry: 'hall-sharing tradition',
                        engineering: 'civic commons',
                        metallurgy: 'market commons',
                        'bronze age': 'bronze commons',
                        'iron age': 'iron commons'
                    }
                },
                {
                    key: 'storehouse discipline',
                    score: normalized.hoardFood * 1.1 + normalized.avoidStrangers * 0.2,
                    ancientCustom: 'winter stock rites',
                    modernization: {
                        survival: 'hard-saved caches',
                        agriculture: 'granary prudence',
                        masonry: 'storehouse law',
                        engineering: 'warehouse order',
                        metallurgy: 'ledgered storehouses',
                        'bronze age': 'bronze granary order',
                        'iron age': 'iron granary law'
                    }
                },
                {
                    key: 'frontier road',
                    score: normalized.favorExpansion * 1.15 + normalized.shareFood * 0.18 - normalized.avoidStrangers * 0.08,
                    ancientCustom: 'trail-founding oath',
                    modernization: {
                        survival: 'wandering camp lines',
                        agriculture: 'daughter-field marches',
                        masonry: 'border-road custom',
                        engineering: 'caravan road culture',
                        metallurgy: 'league road networks',
                        'bronze age': 'bronze caravan leagues',
                        'iron age': 'iron road leagues'
                    }
                },
                {
                    key: 'fortress kin',
                    score: normalized.avoidStrangers * 1.2 + normalized.hoardFood * 0.18 - normalized.shareFood * 0.15,
                    ancientCustom: 'gate-watch oath',
                    modernization: {
                        survival: 'fire-watch custom',
                        agriculture: 'stockade kin',
                        masonry: 'wall-keeping clans',
                        engineering: 'garrison civics',
                        metallurgy: 'fortress league discipline',
                        'bronze age': 'bronze shield states',
                        'iron age': 'iron border states'
                    }
                },
                {
                    key: 'river and field rites',
                    score: normalized.worshipNature * 1.18 + normalized.shareFood * 0.2,
                    ancientCustom: 'river-offering rites',
                    modernization: {
                        survival: 'spring rites',
                        agriculture: 'planting festivals',
                        masonry: 'canal blessings',
                        engineering: 'irrigation rites',
                        metallurgy: 'harvest processions',
                        'bronze age': 'bronze harvest rites',
                        'iron age': 'iron harvest law'
                    }
                }
            ].sort((left, right) => right.score - left.score);
            const dominant = scores[0];
            const secondary = scores[1];
            const ritualBias =
                (rituals.some((ritual) => ritual.type === 'planting festival') ? 0.08 : 0) +
                (rituals.some((ritual) => ritual.type === 'mourning dead') ? 0.05 : 0) +
                (rituals.some((ritual) => ritual.type === 'war preparation') ? 0.08 : 0);
            const continuityScore = clamp((dominant.score - secondary.score) * 0.45 + 0.48 + ritualBias, 0.1, 1);
            const modernizationStyle = dominant.modernization[era] ||
                dominant.modernization.engineering ||
                dominant.modernization.agriculture;
            return {
                path: dominant.key,
                secondaryPath: secondary.key,
                ancientCustom: dominant.ancientCustom,
                modernizationStyle,
                continuityScore: Number(continuityScore.toFixed(2))
            };
        }

        updateFoodCulture(dt) {
            if (!this.foodCulture?.recentSources) {
                return;
            }
            const decay = Math.max(0.92, 1 - dt * 0.0007);
            for (const key of FOOD_SOURCE_KEYS) {
                this.foodCulture.recentSources[key] = Math.max(0, (this.foodCulture.recentSources[key] || 0) * decay);
            }
            const preparedTarget =
                (this.countBuildings('kitchen') * 0.9 + this.countBuildings('foodHall') * 1.8) *
                (this.getCurrentEra() === 'engineering' || this.getCurrentEra() === 'metallurgy' || this.getCurrentEra() === 'iron age' ? 1.1 : 0.8);
            if (preparedTarget > 0 && this.camp.food > 8) {
                this.foodCulture.recentSources.prepared += dt * 0.008 * preparedTarget;
            }
            const summary = this.getFoodCultureSummary();
            this.foodCulture.staple = summary.staple;
            this.foodCulture.dietLabel = summary.dietLabel;
            this.foodCulture.productionMode = summary.productionMode;
            this.foodCulture.diversity = summary.diversity;
        }

        getEraItemTierFloor(type = null) {
            const era = this.getCurrentEra();
            if (era === 'engineering' || era === 'metallurgy' || era === 'bronze age' || era === 'iron age') {
                if (type === 'basket' || type === 'simpleClothing') {
                    return 'standard';
                }
                return 'fine';
            }
            if (era === 'agriculture' || era === 'masonry') {
                if (type === 'stick' || type === 'stoneTool') {
                    return 'crude';
                }
                return 'standard';
            }
            return 'crude';
        }

        getEraEquipmentDemand(type) {
            const population = Math.max(1, this.colonists.length);
            const era = this.getCurrentEra();
            const base = {
                axe: Math.max(2, Math.round(population * 0.35)),
                hammer: Math.max(2, Math.round(population * 0.35)),
                hoe: Math.max(2, Math.round(population * 0.35)),
                spear: Math.max(2, Math.round(population * 0.35)),
                basket: Math.max(2, Math.round(population * 0.35)),
                simpleClothing: Math.max(2, population - 2),
                stoneTool: Math.max(2, Math.round(population * 0.25)),
                stick: 3
            };
            if (era === 'engineering' || era === 'metallurgy' || era === 'bronze age' || era === 'iron age') {
                base.axe = Math.max(base.axe, Math.round(population * 0.6));
                base.hammer = Math.max(base.hammer, Math.round(population * 0.55));
                base.hoe = Math.max(base.hoe, Math.round(population * 0.55));
                base.spear = Math.max(base.spear, Math.round(population * 0.55));
                base.basket = Math.max(base.basket, Math.round(population * 0.45));
                base.simpleClothing = population;
            } else if (era === 'agriculture' || era === 'masonry') {
                base.hoe = Math.max(base.hoe, Math.round(population * 0.45));
                base.simpleClothing = Math.max(base.simpleClothing, population - 1);
            }
            return base[type] || 0;
        }

        recordWorldReport(report) {
            this.reportCounter = (this.reportCounter || 0) + 1;
            this.battleReports.unshift({
                id: `world-report-${this.reportCounter}`,
                year: this.year,
                day: this.day,
                popup: true,
                ...report
            });
            this.battleReports = this.battleReports.slice(0, 20);
        }

        syncEraProgress(source = 'emergent') {
            const currentEra = this.getCurrentEra();
            if (!this.lastKnownEra) {
                this.lastKnownEra = currentEra;
            }
            if (!this.eraHistory?.length) {
                this.eraHistory = [{ era: currentEra, year: this.year, day: this.day, source: 'founding' }];
            }
            if (currentEra === this.lastKnownEra) {
                return currentEra;
            }
            const activeColonies = this.getActiveBranchColonies();
            const alliedCount = activeColonies.filter((colony) => ['allied', 'trading'].includes(colony.diplomacyState)).length;
            const tradeCount = activeColonies.reduce((sum, colony) => sum + (colony.history?.trades || 0), 0);
            const milestoneCount = Object.values(this.phase9?.milestones || {}).filter(Boolean).length;
            const summary = {
                population: this.colonists.length,
                buildings: this.buildings.length,
                colonies: activeColonies.length,
                alliedColonies: alliedCount,
                tradeLinks: tradeCount,
                milestones: milestoneCount
            };
            this.lastKnownEra = currentEra;
            this.eraHistory.unshift({
                era: currentEra,
                year: this.year,
                day: this.day,
                source,
                summary
            });
            this.eraHistory = this.eraHistory.slice(0, 16);
            const eraName = this.getEraDisplayName(currentEra);
            this.pushEvent(`The colony entered the ${eraName} era.`);
            this.recordWorldReport({
                type: 'era',
                reportType: 'era transition',
                colonyName: eraName,
                outcome: source === 'divine' ? 'divinely advanced' : 'emerged',
                detailLines: [
                    `Era: ${eraName}`,
                    `Population: ${summary.population}`,
                    `Buildings: ${summary.buildings}`,
                    `Other colonies known: ${summary.colonies}`,
                    `Trade links: ${summary.tradeLinks}`,
                    `Regional milestones: ${summary.milestones}`
                ],
                meta: summary
            });
            return currentEra;
        }

        getPhaseReadiness() {
            const adultCount = this.colonists.filter((colonist) => colonist.alive && colonist.lifeStage === 'adult').length;
            const totalFamilies = this.families.length;
            const totalChildren = this.families.reduce((sum, family) => sum + family.childIds.length, 0);
            const ritualTypes = new Set(this.rituals.map((ritual) => ritual.type)).size;
            const toolTypesOwned = ['axe', 'hammer', 'hoe', 'spear', 'basket', 'simpleClothing']
                .filter((type) => this.countOwnedItems(type) > 0).length;

            const phase3 = (
                this.colonyKnowledge.discoveries.includes('skill:tool_use') ||
                this.colonyKnowledge.discoveries.includes('skill:planting') ||
                this.colonyKnowledge.discoveries.includes('skill:medicine')
            ) && (
                this.colonyKnowledge.resources.berries.length +
                this.colonyKnowledge.resources.water.length +
                this.colonyKnowledge.resources.trees.length +
                this.colonyKnowledge.resources.stone.length
            ) >= 4;

            const phase4 = phase3 && (
                this.countCompletedAction('craftRecipe') >= 4 ||
                this.countCompletedAction('processMaterials') >= 2 ||
                toolTypesOwned >= 2
            ) && (
                this.getCampMaterial('planks') > 0 ||
                this.getCampMaterial('rope') > 0 ||
                toolTypesOwned >= 2
            );

            const phase5 = phase4 && (
                this.countBuildings('leanTo') + this.countBuildings('hut') > 0 &&
                this.countBuildings('farmPlot') > 0 &&
                (this.countBuildings('storage') + this.countBuildings('storagePit') > 0 || this.getStorageCapacity() > 36) &&
                (this.countBuildings('workshop') > 0 || this.countCompletedAction('craftRecipe') >= 6) &&
                this.getHousingSatisfaction() > 0.8
            );

            const phase6 = phase5 && (
                totalFamilies > 0 &&
                (totalChildren > 0 || this.branchColonies.length > 0) &&
                ritualTypes >= 2 &&
                adultCount >= 2
            );

            return { phase3, phase4, phase5, phase6 };
        }

        generateUniqueName() {
            for (let tries = 0; tries < 80; tries += 1) {
                const candidate = createNamePool(this.rng, 1)[0];
                if (this.usedNames.has(candidate)) {
                    continue;
                }
                this.usedNames.add(candidate);
                return candidate;
            }
            const fallback = `Lineage ${this.nextColonistId + 1}`;
            this.usedNames.add(fallback);
            return fallback;
        }

        getActiveBranchColonies() {
            return this.branchColonies.filter((colony) => Number.isFinite(colony.x) && Number.isFinite(colony.y));
        }

        getColonySupportCooldownDuration(colony, variance = 18, base = null) {
            const isDaughter = (colony?.type || 'daughter') === 'daughter';
            const anchor = base ?? (isDaughter ? 52 : 40);
            return anchor + this.rng() * variance;
        }

        normalizeBranchColony(colony, index = 0) {
            const inheritedCulture = clone(colony.inheritedCulture || this.lineageMemory.culturalValues);
            const legacyProfile = this.getCultureLegacyProfile(inheritedCulture, {
                era: this.getCurrentEra(),
                rituals: colony.rituals || []
            });
            const defaultCulture = colony.type === 'splinter' ? 'hard frontier kin' : 'valley rim kin';
            const daughterBias = colony.type === 'daughter' ? 1 : 0;
            const splinterBias = colony.type === 'splinter' ? 1 : 0;
            const defaultMilitary = clamp(
                colony.factionIdentity?.militaryTendency ??
                (splinterBias ? 0.58 : 0.26) +
                    this.getCulturalValue(inheritedCulture, 'avoidStrangers') * 0.35 +
                    this.getCulturalValue(inheritedCulture, 'favorExpansion') * 0.12 -
                    daughterBias * 0.08,
                0.05,
                0.95
            );
            const defaultTrade = clamp(
                colony.factionIdentity?.tradeTendency ??
                (daughterBias ? 0.72 : 0.24) +
                    this.getCulturalValue(inheritedCulture, 'shareFood') * 0.38 -
                    this.getCulturalValue(inheritedCulture, 'avoidStrangers') * 0.18 +
                    daughterBias * 0.05,
                0.05,
                0.95
            );
            const defaultTrust = clamp(colony.factionIdentity?.trust ?? (daughterBias ? 0.7 : 0.34), 0.05, 0.95);
            const defaultFear = clamp(colony.factionIdentity?.fear ?? (daughterBias ? 0.18 : 0.28), 0.05, 0.95);
            const defaultEnvy = clamp(colony.factionIdentity?.envy ?? (daughterBias ? 0.1 : 0.24), 0.05, 0.95);
            const defaultDiplomacy = colony.diplomacyState ||
                (daughterBias && defaultTrade > 0.58 && defaultTrust > 0.48 ? 'trading' : 'cautious');
            return {
                ...clone(colony),
                entityType: 'colony',
                id: colony.id || index + 1,
                name: colony.name || `${colony.type === 'splinter' ? 'Splinter' : 'Daughter'} Hold ${index + 1}`,
                food: Number.isFinite(colony.food) ? colony.food : 10,
                water: Number.isFinite(colony.water) ? colony.water : 9,
                wood: Number.isFinite(colony.wood) ? colony.wood : 6,
                stone: Number.isFinite(colony.stone) ? colony.stone : 4,
                tradeCooldown: Number.isFinite(colony.tradeCooldown) ? colony.tradeCooldown : (daughterBias ? 22 + this.rng() * 14 : 32 + this.rng() * 18),
                infoCooldown: Number.isFinite(colony.infoCooldown) ? colony.infoCooldown : (daughterBias ? 18 + this.rng() * 14 : 24 + this.rng() * 18),
                raidCooldown: Number.isFinite(colony.raidCooldown) ? colony.raidCooldown : 34 + this.rng() * 14,
                diplomacyCooldown: Number.isFinite(colony.diplomacyCooldown) ? colony.diplomacyCooldown : 10 + this.rng() * 12,
                supportCooldown: Number.isFinite(colony.supportCooldown) ? colony.supportCooldown : this.getColonySupportCooldownDuration(colony, colony.type === 'daughter' ? 18 : 12, colony.type === 'daughter' ? 54 : 40),
                foundedDay: colony.foundedDay || this.day,
                foundedYear: colony.foundedYear || this.year,
                population: Number.isFinite(colony.population) ? colony.population : 2,
                founderNames: clone(colony.founderNames || []),
                inheritedCulture,
                culturalPath: colony.culturalPath || legacyProfile.path,
                ancientCustom: colony.ancientCustom || legacyProfile.ancientCustom,
                modernizationStyle: colony.modernizationStyle || legacyProfile.modernizationStyle,
                continuityScore: Number.isFinite(colony.continuityScore) ? colony.continuityScore : legacyProfile.continuityScore,
                factionIdentity: {
                    culture: colony.factionIdentity?.culture || `${defaultCulture} / ${legacyProfile.path}`,
                    militaryTendency: defaultMilitary,
                    tradeTendency: defaultTrade,
                    fear: defaultFear,
                    trust: defaultTrust,
                    envy: defaultEnvy
                },
                diplomacyState: defaultDiplomacy,
                borderFriction: clamp(colony.borderFriction || 0, 0, 1),
                recentAction: colony.recentAction || 'watching',
                defense: {
                    militia: Math.max(0, colony.defense?.militia || 0),
                    huntersPressed: Math.max(0, colony.defense?.huntersPressed || 0),
                    trainedDefenders: Math.max(0, colony.defense?.trainedDefenders || 0)
                },
                history: {
                    trades: colony.history?.trades || 0,
                    raids: colony.history?.raids || 0,
                    skirmishes: colony.history?.skirmishes || 0,
                    campaigns: colony.history?.campaigns || 0,
                    alliances: colony.history?.alliances || 0,
                    betrayals: colony.history?.betrayals || 0,
                    prisoners: colony.history?.prisoners || 0,
                    refugees: colony.history?.refugees || 0,
                    knowledgeTrades: colony.history?.knowledgeTrades || 0
                },
                warMemory: {
                    defeats: colony.warMemory?.defeats || 0,
                    victories: colony.warMemory?.victories || 0,
                    desireForRevenge: clamp(colony.warMemory?.desireForRevenge || 0, 0, 1),
                    lastEnemy: colony.warMemory?.lastEnemy || null,
                    lastOutcome: colony.warMemory?.lastOutcome || 'none'
                },
                army: {
                    available: Math.max(1, Number.isFinite(colony.army?.available) ? colony.army.available : Math.round((colony.population || 2) * (colony.type === 'splinter' ? 0.72 : 0.48))),
                    wounded: Math.max(0, Number.isFinite(colony.army?.wounded) ? colony.army.wounded : 0),
                    veterans: Math.max(0, Number.isFinite(colony.army?.veterans) ? colony.army.veterans : Math.round((colony.history?.raids || 0) * 0.4 + (colony.warMemory?.victories || 0) * 0.6)),
                    morale: clamp(Number.isFinite(colony.army?.morale) ? colony.army.morale : 0.56 + defaultMilitary * 0.18 - defaultFear * 0.08, 0.12, 1),
                    recovery: Math.max(0, Number.isFinite(colony.army?.recovery) ? colony.army.recovery : 0),
                    commander: {
                        name: colony.army?.commander?.name || colony.commanderName || this.generateUniqueName(),
                        style: colony.army?.commander?.style || (splinterBias ? 'aggressive' : daughterBias ? 'guarded' : 'balanced'),
                        aggression: clamp(Number.isFinite(colony.army?.commander?.aggression) ? colony.army.commander.aggression : defaultMilitary * 0.9 + defaultEnvy * 0.2, 0.1, 1),
                        discipline: clamp(Number.isFinite(colony.army?.commander?.discipline) ? colony.army.commander.discipline : 0.38 + defaultTrust * 0.18 + defaultMilitary * 0.24, 0.1, 1),
                        caution: clamp(Number.isFinite(colony.army?.commander?.caution) ? colony.army.commander.caution : defaultFear * 0.65 + (daughterBias ? 0.12 : 0), 0.05, 1)
                    }
                },
                occupation: {
                    state: colony.occupation?.state || 'free',
                    ttl: Math.max(0, colony.occupation?.ttl || 0),
                    claimedTarget: colony.occupation?.claimedTarget || null,
                    by: colony.occupation?.by || null,
                    tributeTick: Math.max(0, colony.occupation?.tributeTick || 0),
                    pressureTick: Math.max(0, colony.occupation?.pressureTick || 0)
                },
                structures: clone(colony.structures || {
                    outerHuts: { label: 'Outer Huts', integrity: 1 },
                    storehouse: { label: 'Storehouse', integrity: 1 },
                    watchPost: { label: 'Watch Post', integrity: 1 },
                    stockade: { label: 'Stockade', integrity: daughterBias ? 0.65 : 0.9 }
                }),
                campaign: {
                    state: colony.campaign?.state || 'idle',
                    pressure: clamp(colony.campaign?.pressure || 0, 0, 1),
                    duration: Math.max(0, colony.campaign?.duration || 0),
                    target: colony.campaign?.target || 'camp',
                    strategy: colony.campaign?.strategy || 'watchful'
                },
                lastSharedKnowledge: colony.lastSharedKnowledge || null
            };
        }

        getCulturalValue(values, key) {
            return clamp(values?.[key] || 0, 0, 1);
        }

        getBranchTerritoryRadius(colony) {
            return 95 + (colony.population || 2) * 12;
        }

        updateFactionArmy(colony, dt) {
            const army = colony.army || (colony.army = {
                available: 1,
                wounded: 0,
                veterans: 0,
                morale: 0.5,
                recovery: 0,
                commander: {
                    name: this.generateUniqueName(),
                    style: 'balanced',
                    aggression: 0.5,
                    discipline: 0.5,
                    caution: 0.5
                }
            });
            const capacity = Math.max(1, Math.round((colony.population || 2) * (0.48 + colony.factionIdentity.militaryTendency * 0.36)));
            const recoverRate = dt * (0.016 + colony.factionIdentity.trust * 0.004);
            const recovered = Math.min(army.wounded, recoverRate);
            army.wounded = Math.max(0, army.wounded - recovered);
            army.available = clamp(army.available + recovered * 0.85, 0, capacity);
            if (army.available + army.wounded < capacity && colony.food > 6 && colony.water > 6) {
                army.available = Math.min(capacity, army.available + dt * 0.0035 * (0.8 + colony.factionIdentity.militaryTendency * 0.5));
            }
            const occupationDrag = colony.occupation?.state === 'occupying' ? 0.0012 : 0;
            const revengeLift = (colony.warMemory?.desireForRevenge || 0) * 0.0014;
            const trustLift = colony.diplomacyState === 'allied' ? 0.0008 : 0;
            army.morale = clamp(
                army.morale +
                    dt * (
                        trustLift +
                        revengeLift +
                        (colony.food > 8 && colony.water > 8 ? 0.0009 : -0.0012) -
                        occupationDrag -
                        army.wounded * 0.0008
                    ),
                0.12,
                1
            );
            army.recovery = Math.max(0, army.recovery - dt);
            army.veterans = clamp(army.veterans, 0, capacity);
        }

        getCampDefenseSummary() {
            const adults = this.colonists.filter((colonist) => colonist.alive && colonist.lifeStage !== 'child');
            const militia = adults.filter((colonist) => colonist.stats.health > 48).length;
            const huntersPressed = adults.filter((colonist) =>
                this.getSoftRole(colonist) === 'hunter' || colonist.equipment.hunting?.type === 'spear'
            ).length;
            const trainedDefenders = adults.filter((colonist) =>
                colonist.skills.combat > 1.6 || colonist.intent === 'protect'
            ).length + this.countBuildings('watchtower') + this.countBuildings('wall') + this.countBuildings('fortifiedStructure');
            return {
                militia,
                huntersPressed,
                trainedDefenders
            };
        }

        getCampDefensePower() {
            const forces = this.getCampDefenseSummary();
            return forces.militia * 1 + forces.huntersPressed * 1.35 + forces.trainedDefenders * 1.8;
        }

        getMainColonyAttackSummary() {
            const adults = this.colonists.filter((colonist) => colonist.alive && colonist.lifeStage === 'adult');
            const available = adults.filter((colonist) =>
                colonist.stats.health > 48 &&
                colonist.stats.energy > 40 &&
                colonist.stats.warmth > 24 &&
                colonist.assignedBattlefrontId === null
            );
            const attackers = available
                .slice()
                .sort((left, right) => (
                    (right.skills.combat + (this.getSoftRole(right) === 'hunter' ? 1.5 : 0) + right.combatPower * 0.08) -
                    (left.skills.combat + (this.getSoftRole(left) === 'hunter' ? 1.5 : 0) + left.combatPower * 0.08)
                ));
            return {
                available,
                attackers,
                power: attackers.slice(0, 8).reduce((sum, colonist) => (
                    sum + colonist.combatPower * 0.9 + colonist.skills.combat * 1.4 + (colonist.equipment.hunting?.type === 'spear' ? 3.2 : 0)
                ), 0)
            };
        }

        getRegionalConflictPressure() {
            return this.getActiveBranchColonies().reduce((max, colony) =>
                Math.max(max, colony.campaign?.state === 'active' ? colony.campaign.pressure || 0 : 0), 0
            );
        }

        getColonyThreatScore(colony) {
            if (!colony) {
                return 0;
            }
            return clamp(
                (colony.campaign?.state === 'active' ? (colony.campaign.pressure || 0) * 0.48 : 0) +
                ((colony.borderFriction || 0) * 0.28) +
                (colony.occupation?.ttl > 0 ? 0.28 : 0) +
                (colony.recentAction === 'under attack' ? 0.22 : 0) +
                (colony.recentAction === 'retreating' ? 0.18 : 0),
                0,
                1
            );
        }

        getPrimaryThreatSource(targetColony) {
            if (!targetColony) {
                return null;
            }
            const nearbyThreats = this.getActiveBranchColonies()
                .filter((colony) =>
                    colony.id !== targetColony.id &&
                    colony.diplomacyState === 'rival' &&
                    colony.occupation?.state !== 'occupiedByMain'
                )
                .map((colony) => ({
                    colony,
                    score: clamp(
                        (1 - Math.min(distance(colony, targetColony), 340) / 340) * 0.44 +
                        (colony.campaign?.state === 'active' ? (colony.campaign.pressure || 0) * 0.32 : 0) +
                        (colony.borderFriction || 0) * 0.22 +
                        (colony.recentAction === 'raiding' || colony.recentAction === 'under attack' ? 0.14 : 0),
                        0,
                        1
                    )
                }))
                .sort((left, right) => right.score - left.score);
            return nearbyThreats[0]?.score > 0.34 ? nearbyThreats[0].colony : null;
        }

        getBranchColonyByName(name) {
            if (!name) {
                return null;
            }
            return this.getActiveBranchColonies().find((colony) => colony.name === name) || null;
        }

        getIntercolonyTarget(colony) {
            if (!colony) {
                return null;
            }
            const targetByName = this.getBranchColonyByName(colony.campaign?.target);
            if (targetByName && targetByName.id !== colony.id) {
                return targetByName;
            }
            const candidates = this.getActiveBranchColonies()
                .filter((peer) =>
                    peer.id !== colony.id &&
                    peer.occupation?.state !== 'occupiedByMain' &&
                    distance(colony, peer) < 360 &&
                    (
                        (colony.diplomacyState === 'rival' && ['allied', 'trading', 'cautious'].includes(peer.diplomacyState)) ||
                        (colony.diplomacyState === 'allied' && peer.diplomacyState === 'rival')
                    )
                )
                .map((peer) => ({
                    peer,
                    score: clamp(
                        (1 - Math.min(distance(colony, peer), 360) / 360) * 0.4 +
                        ((peer.borderFriction || 0) * 0.18) +
                        ((peer.campaign?.pressure || 0) * 0.2) +
                        (peer.diplomacyState === 'rival' ? 0.14 : 0.06),
                        0,
                        1
                    )
                }))
                .sort((left, right) => right.score - left.score);
            return candidates[0]?.score > 0.32 ? candidates[0].peer : null;
        }

        getCampaignStrategy(colony) {
            if (!colony) {
                return 'watchful';
            }
            if (colony.diplomacyState === 'allied') {
                return 'support campaign';
            }
            const eraProfile = this.getEraDiplomacyProfile();
            const commander = colony.army?.commander || { aggression: 0.5, discipline: 0.5, caution: 0.5 };
            const revenge = colony.warMemory?.desireForRevenge || 0;
            const victories = colony.warMemory?.victories || 0;
            const defeats = colony.warMemory?.defeats || 0;
            const supply = ((colony.food || 0) / 18 + (colony.water || 0) / 16) * 0.5;
            const armyReady = (colony.army?.available || 0) / Math.max(1, colony.population || 2);
            const pressure = colony.campaign?.pressure || 0;
            if (
                colony.diplomacyState === 'rival' &&
                supply < 0.7 &&
                armyReady > 0.32 &&
                pressure > Math.max(0.28, 0.38 - eraProfile.raidBias * 0.2) &&
                colony.borderFriction > 0.6 &&
                commander.caution < 0.64 &&
                commander.aggression > 0.42 &&
                victories <= defeats + 1
            ) {
                return 'raid';
            }
            if (
                colony.diplomacyState === 'rival' &&
                supply > 0.82 &&
                armyReady > 0.7 &&
                pressure > Math.max(0.34, 0.62 - eraProfile.totalWarBias * 0.28) &&
                revenge > Math.max(0.18, 0.42 - eraProfile.totalWarBias * 0.34) &&
                commander.aggression > Math.max(0.5, 0.66 - eraProfile.totalWarBias * 0.24) &&
                (victories >= 1 || colony.borderFriction > 0.84)
            ) {
                return 'total war';
            }
            if (
                colony.diplomacyState === 'rival' &&
                (
                    commander.caution > 0.64 ||
                    defeats > victories + 1 ||
                    colony.occupation?.ttl > 0 ||
                    armyReady < 0.48 ||
                    supply < 0.5
                )
            ) {
                return 'defense in depth';
            }
            return colony.diplomacyState === 'rival' ? 'punitive strike' : 'watchful';
        }

        spawnFactionParty(colony, type, direction = 'toCamp', options = {}) {
            const fromCamp = direction === 'fromCamp';
            const start = fromCamp ? this.camp : colony;
            const end = options.target || (fromCamp ? colony : this.camp);
            if (!start || !end) {
                return null;
            }
            const routeProfile = this.getRouteProfile(start, end);
            const party = {
                id: `${colony.id}:${type}:${this.elapsed.toFixed(2)}:${this.rng().toFixed(3)}`,
                colonyId: colony.id,
                colonyName: colony.name,
                type,
                direction,
                x: start.x,
                y: start.y,
                startX: start.x,
                startY: start.y,
                targetX: end.x,
                targetY: end.y,
                progress: 0,
                speed: (options.speed || (type === 'raid' ? 0.32 : type === 'refugee' ? 0.22 : 0.18)) * routeProfile.speedMultiplier,
                routeQuality: routeProfile.quality,
                routeRisk: routeProfile.raidRisk,
                onRoad: routeProfile.onRoad,
                strength: options.strength || 1,
                status: options.status || 'traveling',
                effectLabel: options.effectLabel || options.status || type,
                targetKind: options.targetKind || (fromCamp ? 'colony' : 'camp'),
                reinforceBattlefrontId: options.reinforceBattlefrontId || null,
                reinforcementValue: options.reinforcementValue || 0,
                reinforceSide: options.reinforceSide || 'defenders',
                targetColonyId: options.targetColonyId || null,
                supportMode: options.supportMode || null,
                supplies: clone(options.supplies || null),
                courierName: options.courierName || null
            };
            this.factionParties.push(party);
            this.factionParties = this.factionParties.slice(-20);
            return party;
        }

        updateFactionParties(dt) {
            const completed = [];
            for (const party of this.factionParties) {
                const previousX = party.x;
                const previousY = party.y;
                party.progress = clamp(party.progress + party.speed * dt * 0.06, 0, 1);
                party.x = party.startX + (party.targetX - party.startX) * party.progress;
                party.y = party.startY + (party.targetY - party.startY) * party.progress;
                this.recordTrafficAlongSegment(
                    { x: previousX, y: previousY },
                    { x: party.x, y: party.y },
                    party.type === 'raid' ? 0.16 : party.type === 'aid' ? 0.12 : 0.08
                );
                if (party.progress >= 1) {
                    completed.push(party);
                }
            }
            for (const party of completed) {
                if (party.reinforceBattlefrontId) {
                    const front = this.battlefronts.find((entry) => entry.id === party.reinforceBattlefrontId && !entry.resolved);
                    if (front) {
                        front.reinforcementPool = (front.reinforcementPool || 0) + party.reinforcementValue;
                        const side = party.reinforceSide === 'attackers' ? 'attackers' : 'defenders';
                        if (side === 'attackers') {
                            front.attackerHealth = Math.min(front.attackerMaxHealth + 8, front.attackerHealth + party.reinforcementValue);
                            front.attackerMaxHealth = Math.max(front.attackerMaxHealth, front.attackerHealth);
                        } else {
                            front.defenderHealth = Math.min(front.defenderMaxHealth + 8, front.defenderHealth + party.reinforcementValue);
                            front.defenderMaxHealth = Math.max(front.defenderMaxHealth, front.defenderHealth);
                        }
                        front.damageFlash = 0.8;
                        this.recordFactionEvent(`${party.colonyName} reinforced the ${side === 'attackers' ? 'assault line' : 'battle line'}.`);
                    }
                }
                if (party.targetColonyId) {
                    const targetColony = this.getActiveBranchColonies().find((entry) => entry.id === party.targetColonyId) || null;
                    if (targetColony) {
                        if (party.supplies) {
                            targetColony.food = clamp((targetColony.food || 0) + (party.supplies.food || 0), 0, 140);
                            targetColony.water = clamp((targetColony.water || 0) + (party.supplies.water || 0), 0, 140);
                            targetColony.wood = clamp((targetColony.wood || 0) + (party.supplies.wood || 0), 0, 80);
                            targetColony.stone = clamp((targetColony.stone || 0) + (party.supplies.stone || 0), 0, 70);
                            targetColony.recentAction = party.supportMode === 'main aid' ? 'receiving aid' : 'receiving convoy';
                            this.recordFactionEvent(
                                party.supportMode === 'main aid'
                                    ? `The main settlement's supply caravan reached ${targetColony.name}.`
                                    : `${party.colonyName}'s convoy reached ${targetColony.name}.`
                            );
                            this.spawnFactionEffect(party);
                            continue;
                        }
                        const army = targetColony.army || this.normalizeBranchColony(targetColony, targetColony.id - 1).army;
                        const reinforcement = Math.max(0.4, party.reinforcementValue || party.strength || 1);
                        if (party.type === 'refugee') {
                            if (party.colonyId !== targetColony.id) {
                                targetColony.population = clamp((targetColony.population || 2) + Math.max(0.4, reinforcement * 0.35), 2, 12);
                                targetColony.history.refugees = (targetColony.history.refugees || 0) + 1;
                                targetColony.food = clamp((targetColony.food || 0) + 1.5, 0, 140);
                                targetColony.water = clamp((targetColony.water || 0) + 1.2, 0, 140);
                                this.recordFactionEvent(`${party.colonyName} refugees reached ${targetColony.name}.`);
                            }
                            targetColony.recentAction = 'receiving refugees';
                            this.spawnFactionEffect(party);
                            continue;
                        }
                        army.available = clamp(army.available + reinforcement * 0.42, 0, Math.max(1, targetColony.population * 1.2));
                        army.wounded = Math.max(0, army.wounded - reinforcement * 0.18);
                        army.morale = clamp(army.morale + reinforcement * 0.03, 0.12, 1);
                        if (targetColony.campaign?.state === 'active') {
                            targetColony.campaign.pressure = clamp((targetColony.campaign.pressure || 0) - reinforcement * 0.04, 0, 1);
                        }
                        if (targetColony.occupation?.ttl > 0) {
                            targetColony.occupation.ttl = Math.max(0, targetColony.occupation.ttl - reinforcement * 0.8);
                        }
                        targetColony.recentAction = party.supportMode === 'relief'
                            ? 'receiving relief'
                            : 'receiving allied aid';
                        this.recordFactionEvent(`${party.colonyName} sent allied relief to ${targetColony.name}.`);
                    }
                }
                this.spawnFactionEffect(party);
            }
            this.factionParties = this.factionParties.filter((party) => party.progress < 1);
        }

        spawnBattlefront(colony, options = {}) {
            return this.battleManager.spawnBattlefront(colony, options);
        }

        getNearestBattlefront(origin, maxDistance = 170) {
            if (origin && origin.assignedBattlefrontId) {
                const assigned = this.battlefronts.find((front) => front.id === origin.assignedBattlefrontId && !front.resolved && front.ttl > 0) || null;
                if (assigned) {
                    return assigned;
                }
            }
            const active = this.battlefronts
                .filter((front) => !front.resolved && front.ttl > 0)
                .sort((left, right) => distance(origin, left) - distance(origin, right))[0] || null;
            if (!active || distance(origin, active) > maxDistance) {
                return null;
            }
            return active;
        }

        shouldColonistJoinBattle(colonist) {
            const battlefront = this.getNearestBattlefront(colonist);
            if (!battlefront || colonist.lifeStage !== 'adult') {
                return false;
            }
            const threshold = colonist.assignedBattlefrontId === battlefront.id ? 42 : 50;
            return colonist.stats.health > threshold && colonist.stats.energy > 34 && colonist.stats.warmth > 20;
        }

        updateBattlefronts(dt) {
            return this.battleManager.update(dt);
        }

        recordBattleReport(report) {
            this.battleManager.recordBattleReport(report);
        }

        applyBattleHit(colonist, damage, front, sourceLabel = 'enemy fighters') {
            if (!colonist?.alive) {
                return;
            }
            colonist.stats.health = clamp(colonist.stats.health - damage, 0, 100);
            colonist.stats.energy = clamp(colonist.stats.energy - damage * 0.6, 0, 100);
            colonist.stats.morale = clamp(colonist.stats.morale - damage * 0.7, 0, 100);
            colonist.lastDamageCause = 'battle';
            colonist.lastBattleHitTtl = 4.5;
            colonist.woundSeverity = clamp(colonist.woundSeverity + damage * 0.09, 0, 1);
            colonist.woundCount = Math.min(6, colonist.woundCount + (damage > 4 ? 2 : 1));
            colonist.emotionalMemory.battleTrauma = clamp((colonist.emotionalMemory?.battleTrauma || 0) + damage * 0.012, 0, 1);
            this.battleBursts.push({
                x: colonist.x + (this.rng() - 0.5) * 10,
                y: colonist.y + (this.rng() - 0.5) * 10,
                ttl: 0.85,
                maxTtl: 0.85,
                type: 'hit'
            });
            if (colonist.stats.health <= 0 && colonist.alive) {
                colonist.alive = false;
                this.pushEvent(`${colonist.name} was killed by ${sourceLabel}.`);
                front?.detailKeyMoments?.push(`${colonist.name} fell at the line.`);
            } else if (damage > 3.5) {
                this.pushEvent(`${colonist.name} was wounded in battle.`);
            }
        }

        registerBattleDeathMemory(colonist) {
            for (const survivor of this.colonists) {
                if (!survivor.alive || survivor.id === colonist.id) {
                    continue;
                }
                const nearby = distance(survivor, colonist) < 150;
                const familyBond = colonist.familyId && survivor.familyId === colonist.familyId ? 1 : 0;
                const friendBond = survivor.relationships.friends?.[colonist.id] ? 0.75 : 0;
                const witnessBond = nearby ? 0.45 : 0;
                const griefFactor = Math.max(familyBond, friendBond, witnessBond);
                if (griefFactor <= 0) {
                    continue;
                }
                survivor.emotionalMemory.battleTrauma = clamp((survivor.emotionalMemory.battleTrauma || 0) + 0.08 + griefFactor * 0.22, 0, 1);
                survivor.emotionalMemory.griefLoad = clamp((survivor.emotionalMemory.griefLoad || 0) + griefFactor * 0.28, 0, 1);
                survivor.emotionalMemory.mourningTtl = Math.max(survivor.emotionalMemory.mourningTtl || 0, 18 + griefFactor * 20);
                survivor.emotionalMemory.lastLossName = colonist.name;
                survivor.emotionalMemory.lastLossCause = 'battle';
                survivor.emotionalMemory.lastLossTtl = 42;
                survivor.stats.morale = clamp(survivor.stats.morale - (4 + griefFactor * 10), 0, 100);
                survivor.stats.energy = clamp(survivor.stats.energy - griefFactor * 3, 0, 100);
                survivor.mood.grief = clamp((survivor.mood.grief || 0) + griefFactor * 24, 0, 100);
                survivor.decisionCooldown = 0;
            }
        }

        recordWarAftermath(message) {
            this.warAftermath.recent.unshift({
                year: this.year,
                day: this.day,
                message
            });
            this.warAftermath.recent = this.warAftermath.recent.slice(0, 12);
            this.recordFactionEvent(message);
        }

        findBranchColonySiteNear(origin = this.camp, minDistance = 240) {
            const sites = [];
            for (const cell of this.cells) {
                if (!cell || ['water', 'valley'].includes(cell.biome)) {
                    continue;
                }
                const x = cell.x + CELL_WIDTH * 0.5;
                const y = cell.y + CELL_HEIGHT * 0.5;
                if (distance({ x, y }, origin) < minDistance) {
                    continue;
                }
                if (distance({ x, y }, this.camp) < 220) {
                    continue;
                }
                if (this.getActiveBranchColonies().some((colony) => distance({ x, y }, colony) < 180)) {
                    continue;
                }
                sites.push({ x, y, biome: cell.biome });
            }
            if (!sites.length) {
                return null;
            }
            return sites[Math.floor(this.rng() * sites.length)];
        }

        relocateColonyAfterDefeat(colony, reason = 'retreat') {
            const site = this.findBranchColonySiteNear(colony, 260);
            if (!site) {
                return false;
            }
            colony.x = Math.round(site.x);
            colony.y = Math.round(site.y);
            colony.biome = site.biome;
            colony.food = Math.max(3, Math.min(colony.food || 0, 6));
            colony.water = Math.max(3, Math.min(colony.water || 0, 6));
            colony.wood = Math.max(2, Math.min(colony.wood || 0, 4));
            colony.stone = Math.max(1, Math.min(colony.stone || 0, 3));
            colony.recentAction = reason === 'refounded' ? 'refounding' : 'retreating';
            colony.occupation.state = 'free';
            colony.occupation.ttl = 0;
            this.ensureBranchColonyStarterResources(colony);
            this.recordWarAftermath(`${colony.name} pulled back and re-founded deeper in the valley after defeat.`);
            return true;
        }

        createRefugeeOffshootFromMainColony(enemyColony, scale = 0.5, targetBuildingType = 'camp') {
            if (this.getActiveBranchColonies().length >= MAX_ACTIVE_BRANCH_COLONIES || this.colonists.length < 5) {
                return null;
            }
            const site = this.findBranchColonySiteNear(this.camp, 280);
            if (!site) {
                return null;
            }
            const refugee = this.normalizeBranchColony({
                id: this.branchColonies.length + 1,
                type: 'daughter',
                foundedDay: this.day,
                foundedYear: this.year,
                population: Math.max(2, Math.min(4, Math.round(2 + scale * 2))),
                x: Math.round(site.x),
                y: Math.round(site.y),
                biome: site.biome,
                name: `Refugee Hold ${this.branchColonies.length + 1}`,
                food: 6,
                water: 6,
                wood: 4,
                stone: 2,
                inheritedCulture: clone(this.lineageMemory.culturalValues),
                founderNames: this.colonists.filter((colonist) => colonist.alive).slice(0, 3).map((colonist) => colonist.name),
                factionIdentity: {
                    culture: 'scarred valley kin',
                    militaryTendency: 0.32 + scale * 0.1,
                    tradeTendency: 0.62,
                    fear: 0.34 + scale * 0.12,
                    trust: 0.82,
                    envy: 0.08
                },
                diplomacyState: 'allied',
                borderFriction: 0.04,
                recentAction: 'fleeing'
            }, this.branchColonies.length);
            refugee.warMemory.lastEnemy = enemyColony?.name || 'rival invaders';
            refugee.warMemory.lastOutcome = 'flight';
            refugee.warMemory.desireForRevenge = clamp(0.2 + scale * 0.2, 0, 1);
            this.branchColonies.push(refugee);
            this.ensureBranchColonyStarterResources(refugee);
            this.lineageMemory.branchColonies = clone(this.branchColonies);
            this.spawnFactionParty(refugee, 'refugee', 'fromCamp', {
                strength: refugee.population,
                status: 'fleeing families',
                effectLabel: 'Exodus',
                target: refugee,
                targetKind: 'colony',
                targetColonyId: refugee.id,
                speed: 0.2
            });
            this.recordWarAftermath(`Fleeing families founded ${refugee.name} after the loss of the ${targetBuildingType}.`);
            return refugee;
        }

        applyFactionWarAftermath(colony, outcome, scale = 0.4, options = {}) {
            if (!colony) {
                return;
            }
            const memory = colony.warMemory || (colony.warMemory = {
                defeats: 0,
                victories: 0,
                desireForRevenge: 0,
                lastEnemy: null,
                lastOutcome: 'none'
            });
            memory.lastEnemy = options.enemy || 'main settlement';
            memory.lastOutcome = outcome;
            if (outcome === 'defeat') {
                memory.defeats += 1;
                memory.desireForRevenge = clamp(memory.desireForRevenge + 0.12 + scale * 0.18, 0, 1);
                colony.population = Math.max(1, colony.population - Math.max(0.3, scale * 1.2));
                colony.factionIdentity.fear = clamp(colony.factionIdentity.fear + 0.08 + scale * 0.08, 0.05, 0.95);
                colony.factionIdentity.trust = clamp(colony.factionIdentity.trust - 0.06, 0.05, 0.95);
                colony.borderFriction = clamp((colony.borderFriction || 0) + 0.08 + scale * 0.08, 0, 1);
                colony.recentAction = 'retreating';
                if (options.enemy === 'main settlement' && scale > 0.46) {
                    colony.occupation = {
                        state: 'occupiedByMain',
                        ttl: 18 + scale * 18,
                        claimedTarget: options.targetBuildingType || 'stockade',
                        by: 'main settlement',
                        tributeTick: 2.2,
                        pressureTick: 4.6
                    };
                    this.recordWarAftermath(`The main settlement occupied ${colony.name}'s frontier and began taking tribute.`);
                }
                if (colony.population <= 1.4 || (scale > 0.55 && this.rng() < 0.45)) {
                    this.relocateColonyAfterDefeat(colony, 'refounded');
                } else {
                    this.recordWarAftermath(`${colony.name} retreated from the fighting and began nursing revenge.`);
                }
            } else if (outcome === 'victory') {
                memory.victories += 1;
                memory.desireForRevenge = clamp(memory.desireForRevenge - 0.1, 0, 1);
                colony.factionIdentity.fear = clamp(colony.factionIdentity.fear - 0.04, 0.05, 0.95);
                colony.factionIdentity.envy = clamp(colony.factionIdentity.envy + 0.05 + scale * 0.05, 0.05, 0.95);
                colony.recentAction = scale > 0.52 ? 'occupying' : 'looting';
                if (scale > 0.48) {
                    colony.occupation = {
                        state: 'occupying',
                        ttl: 22 + scale * 18,
                        claimedTarget: options.targetBuildingType || 'camp',
                        by: colony.name,
                        tributeTick: 2,
                        pressureTick: 4.4
                    };
                    this.warAftermath.occupation = {
                        by: colony.name,
                        ttl: colony.occupation.ttl,
                        severity: clamp(scale, 0.25, 1),
                        targetBuildingType: options.targetBuildingType || 'camp',
                        tributeTick: 2,
                        pressureTick: 4.4
                    };
                    this.recordWarAftermath(`${colony.name} occupied the outskirts after its victory and pressed its claim.`);
                } else {
                    this.recordWarAftermath(`${colony.name} looted the battlefield and withdrew with stolen goods.`);
                }
                if (options.enemy === 'main settlement' && scale > 0.58) {
                    this.createRefugeeOffshootFromMainColony(colony, scale, options.targetBuildingType || 'camp');
                    this.lineageMemory.culturalValues.avoidStrangers = clamp(this.lineageMemory.culturalValues.avoidStrangers + 0.08, -1, 1);
                    this.lineageMemory.culturalValues.favorExpansion = clamp(this.lineageMemory.culturalValues.favorExpansion + 0.05, -1, 1);
                    const lesson = `The attack from ${colony.name} scattered families and hardened the colony.`;
                    if (!this.lineageMemory.lessons.includes(lesson)) {
                        this.lineageMemory.lessons.unshift(lesson);
                        this.lineageMemory.lessons = this.lineageMemory.lessons.slice(0, 6);
                    }
                }
            }
        }

        updateWarAftermath(dt) {
            const occupation = this.warAftermath.occupation;
            if (occupation) {
                occupation.ttl = Math.max(0, occupation.ttl - dt);
                occupation.tributeTick = Math.max(0, (occupation.tributeTick || 2) - dt);
                occupation.pressureTick = Math.max(0, (occupation.pressureTick || 4.4) - dt);
                if (!this.hasProtectColonyBubble() && occupation.tributeTick <= 0) {
                    this.camp.food = Math.max(0, this.camp.food - (0.25 + occupation.severity * 0.3));
                    this.camp.wood = Math.max(0, this.camp.wood - occupation.severity * 0.12);
                    occupation.tributeTick = 2 + occupation.severity * 1.6;
                    for (const colonist of this.colonists) {
                        if (!colonist.alive) {
                            continue;
                        }
                        colonist.stats.morale = clamp(colonist.stats.morale - (0.2 + occupation.severity * 0.25), 0, 100);
                    }
                }
                if (!this.hasProtectColonyBubble() && occupation.pressureTick <= 0) {
                    const targets = this.buildings
                        .filter((building) => ['storage', 'storagePit', 'granary', 'warehouse', 'hut', 'cottage', 'house', 'watchtower', 'wall', 'fortifiedStructure'].includes(building.type))
                        .sort((left, right) => this.getBuildingIntegrityRatio(left) - this.getBuildingIntegrityRatio(right))
                        .slice(0, 1);
                    for (const target of targets) {
                        this.applyBuildingDamage(target, 0.45 + occupation.severity * 0.65);
                        this.startRepairProject(target);
                    }
                    occupation.pressureTick = 4.4 + occupation.severity * 2.4;
                    if (targets[0]) {
                        this.recordWarAftermath(`${occupation.by} damaged the ${targets[0].type} while occupation pressure held.`);
                    }
                }
                if (occupation.ttl <= 0) {
                    this.recordWarAftermath(`${occupation.by}'s occupation pressure faded and the settlement reclaimed the scarred ground.`);
                    this.warAftermath.occupation = null;
                }
            }
            for (const colony of this.getActiveBranchColonies()) {
                if (colony.occupation?.ttl > 0) {
                    colony.occupation.ttl = Math.max(0, colony.occupation.ttl - dt);
                    colony.occupation.tributeTick = Math.max(0, (colony.occupation.tributeTick || 2.2) - dt);
                    colony.occupation.pressureTick = Math.max(0, (colony.occupation.pressureTick || 4.6) - dt);
                    if (colony.occupation.state === 'occupiedByMain' && colony.occupation.tributeTick <= 0) {
                        const foodTribute = Math.min(colony.food, 0.5 + (colony.population || 2) * 0.14);
                        const waterTribute = Math.min(colony.water, 0.35 + (colony.population || 2) * 0.1);
                        const woodTribute = Math.min(colony.wood, 0.24 + (colony.army?.available || 1) * 0.08);
                        colony.food = Math.max(0, colony.food - foodTribute);
                        colony.water = Math.max(0, colony.water - waterTribute);
                        colony.wood = Math.max(0, colony.wood - woodTribute);
                        this.camp.food = clamp(this.camp.food + foodTribute, 0, 999);
                        this.camp.water = clamp(this.camp.water + waterTribute, 0, 999);
                        this.camp.wood = clamp(this.camp.wood + woodTribute, 0, 999);
                        colony.occupation.tributeTick = 2.4 + (colony.population || 2) * 0.22;
                        colony.recentAction = 'paying tribute';
                    }
                    if (colony.occupation.state === 'occupiedByMain' && colony.occupation.pressureTick <= 0) {
                        const targets = Object.entries(colony.structures || {})
                            .map(([key, value]) => ({ key, ...value }))
                            .sort((left, right) => left.integrity - right.integrity)
                            .slice(0, 1);
                        if (targets[0]) {
                            colony.structures[targets[0].key].integrity = clamp(colony.structures[targets[0].key].integrity - 0.12, 0, 1);
                        }
                        if (colony.population > 2 && this.rng() < 0.3) {
                            colony.population = Math.max(2, colony.population - 0.2);
                            colony.history.refugees += 1;
                            this.recordWarAftermath(`Families fled from ${colony.name} under occupation pressure.`);
                        }
                        colony.occupation.pressureTick = 4.8 + (colony.population || 2) * 0.3;
                    }
                    if (colony.occupation.ttl <= 0) {
                        if (colony.occupation.state === 'occupiedByMain') {
                            this.recordWarAftermath(`${colony.name} shook off main-settlement occupation and began rebuilding.`);
                        }
                        colony.occupation.state = 'free';
                        colony.occupation.claimedTarget = null;
                        colony.occupation.by = null;
                        colony.occupation.tributeTick = 0;
                        colony.occupation.pressureTick = 0;
                    }
                }
            }
        }

        createBattleDangerZone(front, outcome = 'battle') {
            const zone = { x: front.x, y: front.y, cause: outcome };
            rememberPoint(this.colonyKnowledge.dangerZones, zone, 10, 34);
            rememberPoint(this.lineageMemory.dangerZones, zone, 10, 36);
            for (const colonist of this.colonists) {
                if (!colonist.alive) {
                    continue;
                }
                rememberPoint(colonist.memory.dangerZones, zone, 8, 30);
            }
        }

        spawnFactionEffect(party) {
            this.factionEffects.push({
                id: `${party.id}:effect`,
                type: party.type,
                label: party.effectLabel,
                x: party.targetX,
                y: party.targetY,
                ttl: party.type === 'raid' ? 3.4 : 2.6,
                maxTtl: party.type === 'raid' ? 3.4 : 2.6,
                targetKind: party.targetKind
            });
            this.factionEffects = this.factionEffects.slice(-24);
        }

        updateFactionEffects(dt) {
            for (const effect of this.factionEffects) {
                effect.ttl = Math.max(0, effect.ttl - dt * 0.06);
            }
            this.factionEffects = this.factionEffects.filter((effect) => effect.ttl > 0);
        }

        recordFactionEvent(message) {
            this.factionEvents.unshift(message);
            this.factionEvents = this.factionEvents.slice(0, 12);
            this.pushEvent(message);
        }

        recordBorderIncident(message) {
            this.borderIncidents.unshift(message);
            this.borderIncidents = this.borderIncidents.slice(0, 8);
        }

        findBranchColonySite() {
            const existing = [this.camp, ...this.getActiveBranchColonies()];
            let bestSite = null;
            let bestScore = -Infinity;
            for (let attempt = 0; attempt < 80; attempt += 1) {
                const side = Math.floor(this.rng() * 4);
                const marginX = CELL_WIDTH * (VALLEY_RING_CELLS + 1.8);
                const marginY = CELL_HEIGHT * (VALLEY_RING_CELLS + 1.8);
                let x = this.width * 0.5;
                let y = this.height * 0.5;
                if (side === 0) {
                    x = marginX + this.rng() * (this.width - marginX * 2);
                    y = marginY + this.rng() * 60;
                } else if (side === 1) {
                    x = this.width - marginX - this.rng() * (this.width - marginX * 2);
                    y = this.height - marginY - this.rng() * 60;
                } else if (side === 2) {
                    x = marginX + this.rng() * 60;
                    y = marginY + this.rng() * (this.height - marginY * 2);
                } else {
                    x = this.width - marginX - this.rng() * 60;
                    y = marginY + this.rng() * (this.height - marginY * 2);
                }
                const cell = this.getCellAt(x, y);
                if (!cell || cell.biome === 'water' || cell.biome === 'valley') {
                    continue;
                }
                if (existing.some((entry) => distance(entry, { x, y }) < 230)) {
                    continue;
                }
                const score = this.scoreBranchColonySite({ x, y });
                if (score > bestScore) {
                    bestScore = score;
                    bestSite = { x, y, biome: cell.biome };
                }
            }
            return bestScore >= 10 ? bestSite : null;
        }

        scoreBranchColonySite(site) {
            const radius = 235;
            const nearby = this.resources.filter((resource) =>
                !resource.depleted && distance(resource, site) < radius
            );
            const nearestWater = nearby
                .filter((resource) => resource.type === 'water')
                .sort((left, right) => distance(left, site) - distance(right, site))[0] || null;
            const berryCount = nearby.filter((resource) => resource.type === 'berries').length;
            const treeCount = nearby.filter((resource) => resource.type === 'trees').length;
            const stoneCount = nearby.filter((resource) => resource.type === 'stone').length;
            const fertileCells = this.cells.filter((cell) =>
                cell.biome === 'fertile' &&
                distance({ x: cell.x + CELL_WIDTH * 0.5, y: cell.y + CELL_HEIGHT * 0.5 }, site) < radius
            ).length;
            if (!nearestWater || berryCount < 2 || treeCount < 1) {
                return -100;
            }
            const waterScore = nearestWater ? clamp(220 - distance(nearestWater, site), 0, 220) / 8 : -40;
            return (
                waterScore +
                berryCount * 8 +
                treeCount * 6 +
                stoneCount * 5 +
                Math.min(18, fertileCells * 1.5)
            );
        }

        ensureBranchColonyStarterResources(colony) {
            const placements = [
                { type: 'water', dx: 0, dy: -95, amount: resourcesConfig.branchStarterNodes.water, biome: 'water', radius: 120 },
                { type: 'berries', dx: 78, dy: -35, amount: resourcesConfig.branchStarterNodes.berriesNorthEast, biome: 'fertile', radius: 95 },
                { type: 'berries', dx: -72, dy: 52, amount: resourcesConfig.branchStarterNodes.berriesSouthWest, biome: 'fertile', radius: 95 },
                { type: 'trees', dx: -88, dy: 42, amount: resourcesConfig.branchStarterNodes.treesWest, biome: 'forest', radius: 95 },
                { type: 'trees', dx: 92, dy: 68, amount: resourcesConfig.branchStarterNodes.treesEast, biome: 'forest', radius: 95 },
                { type: 'stone', dx: 110, dy: 30, amount: resourcesConfig.branchStarterNodes.stone, biome: 'rocky', radius: 105 }
            ];
            for (const placement of placements) {
                const existing = this.resources.find((resource) =>
                    resource.type === placement.type &&
                    !resource.depleted &&
                    distance(resource, colony) < placement.radius
                );
                if (existing) {
                    continue;
                }
                const x = clamp(colony.x + placement.dx, CELL_WIDTH * (VALLEY_RING_CELLS + 1), this.width - CELL_WIDTH * (VALLEY_RING_CELLS + 1));
                const y = clamp(colony.y + placement.dy, CELL_HEIGHT * (VALLEY_RING_CELLS + 1), this.height - CELL_HEIGHT * (VALLEY_RING_CELLS + 1));
                this.resources.push(this.makeResource(this.nextResourceId++, placement.type, x, y, placement.amount, placement.biome));
            }
        }

        getCampMaterial(key) {
            return this.camp.materials[key] || 0;
        }

        addCampMaterial(key, amount) {
            if (!(key in this.camp.materials)) {
                return;
            }
            this.camp.materials[key] = Math.max(0, this.camp.materials[key] + amount);
        }

        consumeCampMaterial(key, amount) {
            if ((this.camp.materials[key] || 0) < amount) {
                return false;
            }
            this.camp.materials[key] -= amount;
            return true;
        }

        createCampItem(type, craftingSkill = 0) {
            const item = createItem(this.nextItemId++, type, craftingSkill, this.getEraItemTierFloor(type));
            this.camp.items.push(item);
            return item;
        }

        countCampItems(type, predicate = null) {
            if (type === 'firePit') {
                return this.camp.structures.firePit;
            }
            return this.camp.items.filter((item) => item.type === type && (!predicate || predicate(item))).length;
        }

        takeCampItem(type, predicate = null) {
            const index = this.camp.items.findIndex((item) => item.type === type && (!predicate || predicate(item)));
            if (index < 0) {
                return null;
            }
            return this.camp.items.splice(index, 1)[0];
        }

        returnCampItem(item) {
            if (!item) {
                return;
            }
            this.camp.items.push(item);
        }

        getItemSlot(type) {
            return ITEM_DEFS[type]?.slot || null;
        }

        getAllItemsForColonist(colonist) {
            const equipped = Object.values(colonist.equipment).filter(Boolean);
            return [...colonist.inventory.items, ...equipped];
        }

        countColonistItems(colonist, type) {
            return this.getAllItemsForColonist(colonist).filter((item) => item.type === type).length;
        }

        countOwnedItems(type) {
            let total = this.countCampItems(type);
            for (const colonist of this.colonists) {
                if (!colonist.alive) {
                    continue;
                }
                total += this.countColonistItems(colonist, type);
            }
            return total;
        }

        countOwnedItemsAtTier(type, minTier = 'crude') {
            const minRank = getTierRank(minTier);
            let total = this.countCampItems(type, (item) => getTierRank(item.tier) >= minRank);
            for (const colonist of this.colonists) {
                if (!colonist.alive) {
                    continue;
                }
                total += this.getAllItemsForColonist(colonist).filter((item) =>
                    item.type === type && getTierRank(item.tier) >= minRank
                ).length;
            }
            return total;
        }

        getToolForAction(colonist, action) {
            const slotMap = {
                collectWood: 'wood',
                collectStone: 'building',
                plantTrial: 'farming',
                collectFood: 'hauling',
                eatAndGatherFood: 'hauling',
                collectWater: 'hauling',
                huntAnimal: 'hunting',
                huntMeal: 'hunting',
                attackPredator: 'hunting'
            };
            const primarySlot = slotMap[action];
            return primarySlot ? colonist.equipment[primarySlot] : null;
        }

        getToolSpeedMultiplier(colonist, action) {
            const tool = this.getToolForAction(colonist, action);
            if (!tool) {
                return 1;
            }
            return 1 / (tool.quality || 1);
        }

        getHaulBonus(colonist) {
            return colonist.equipment.hauling ? 1.35 : 1;
        }

        wearTool(colonist, action, amount = 1) {
            const tool = this.getToolForAction(colonist, action);
            if (!tool || tool.maxDurability <= 0) {
                return;
            }
            tool.durability = Math.max(0, tool.durability - amount);
            if (tool.durability > 0) {
                return;
            }
            const slot = this.getItemSlot(tool.type);
            if (slot && colonist.equipment[slot] === tool) {
                colonist.equipment[slot] = null;
            } else {
                colonist.inventory.items = colonist.inventory.items.filter((entry) => entry !== tool);
            }
            this.pushEvent(`${colonist.name}'s ${tool.type} broke.`);
        }

        canCraftRecipe(key) {
            const recipe = RECIPE_DEFS[key];
            if (!recipe || !recipe.unlocks(this)) {
                return false;
            }
            for (const [material, amount] of Object.entries(recipe.materials || {})) {
                const available = material === 'stone' ? this.camp.stone : this.getCampMaterial(material);
                if (available < amount) {
                    return false;
                }
            }
            for (const [itemType, amount] of Object.entries(recipe.items || {})) {
                if (this.countCampItems(itemType) < amount) {
                    return false;
                }
            }
            return true;
        }

        consumeRecipeInputs(recipe) {
            for (const [material, amount] of Object.entries(recipe.materials || {})) {
                if (material === 'stone') {
                    this.camp.stone = Math.max(0, this.camp.stone - amount);
                } else {
                    this.consumeCampMaterial(material, amount);
                }
            }
            for (const [itemType, amount] of Object.entries(recipe.items || {})) {
                for (let i = 0; i < amount; i++) {
                    this.takeCampItem(itemType);
                }
            }
        }

        completeRecipeCraft(colonist, recipeKey) {
            const recipe = RECIPE_DEFS[recipeKey];
            if (!recipe || !this.canCraftRecipe(recipeKey)) {
                this.recordFailedAction(colonist, `craft:${recipeKey}`);
                return false;
            }
            this.consumeRecipeInputs(recipe);
            if (recipe.output === 'firePit') {
                this.camp.structures.firePit += 1;
                this.camp.fireFuel += 6;
                this.pushEvent(`${colonist.name} built a fire pit.`);
            } else {
                const item = this.createCampItem(recipe.output, colonist.skills.crafting);
                this.pushEvent(`${colonist.name} crafted ${getTierName(item.tier)} ${recipe.output}.`);
            }
            colonist.gainSkill('crafting', 1);
            colonist.gainSkill('building', 0.25);
            this.noteDiscovery('skill:tool_use', `${colonist.name} improved the colony's tools.`);
            return true;
        }

        chooseCraftRecipe(colonist) {
            const avgCrafting = this.getColonySkillAverage('crafting');
            const isCapableCrafter = colonist.skills.crafting >= avgCrafting - 0.15;
            if (!isCapableCrafter && this.countCompletedAction('collectWood') + this.countCompletedAction('collectStone') > 10) {
                return null;
            }
            const enoughTiered = (type) => this.countOwnedItemsAtTier(type, this.getEraItemTierFloor(type)) >= this.getEraEquipmentDemand(type);
            const priorities = [
                { key: 'firePit', when: () => this.camp.structures.firePit < 1 && this.getCampMaterial('logs') >= 2 && this.camp.stone >= 3 },
                { key: 'stick', when: () => this.countOwnedItems('stick') < 3 && this.getCampMaterial('logs') >= 1 },
                { key: 'spear', when: () => this.getCampMaterial('rope') >= 1 && !colonist.equipment.hunting && !enoughTiered('spear') },
                { key: 'hoe', when: () => this.colonyKnowledge.discoveries.includes('skill:planting') && !colonist.equipment.farming && !enoughTiered('hoe') && this.getCampMaterial('fiber') >= 2 },
                { key: 'stoneTool', when: () => this.countCampItems('stoneTool') < 2 && this.countCampItems('stick') >= 1 && this.camp.stone >= 1 },
                { key: 'axe', when: () => !colonist.equipment.wood && !enoughTiered('axe') && (this.countCampItems('stoneTool') > 0 || this.canCraftRecipe('axe')) },
                { key: 'hammer', when: () => !colonist.equipment.building && !enoughTiered('hammer') && (this.countCampItems('stoneTool') > 0 || this.canCraftRecipe('hammer')) },
                { key: 'basket', when: () => !colonist.equipment.hauling && !enoughTiered('basket') && this.countOwnedItems('axe') >= 1 },
                { key: 'simpleClothing', when: () => this.getCampMaterial('fiber') >= 3 && !colonist.equipment.clothing && !enoughTiered('simpleClothing') },
                { key: 'simpleClothing', when: () => this.getCampMaterial('fiber') >= 3 && this.countOwnedItemsAtTier('simpleClothing', this.getEraItemTierFloor('simpleClothing')) < this.colonists.length },
                { key: 'spear', when: () => this.getCampMaterial('rope') >= 1 && this.countOwnedItemsAtTier('spear', this.getEraItemTierFloor('spear')) < this.getEraEquipmentDemand('spear') }
            ];
            return priorities.find((entry) => entry.when() && this.canCraftRecipe(entry.key) && this.canPursueRecipe(entry.key, colonist))?.key || null;
        }

        chooseProcessingTask() {
            const desiredPlanks = Math.max(
                4,
                this.hasTechnology('masonry') && this.countBuildings('hut') > 0 ? 8 : 0,
                this.hasTechnology('engineering') ? 12 : 0,
                this.hasTechnology('storagePlanning') && (this.countBuildings('storage') + this.countBuildings('storagePit')) > 0 ? 8 : 0
            );
            const desiredRope = Math.max(
                3,
                this.hasTechnology('engineering') ? 5 : 0,
                this.hasTechnology('militaryOrganization') ? 4 : 0
            );
            if (this.getCampMaterial('fiber') >= 2 && this.countOwnedItems('spear') < 1 && this.colonyKnowledge.discoveries.includes('resource:wildAnimal')) {
                return 'rope';
            }
            if (this.getCampMaterial('fiber') >= 2 && this.countOwnedItems('hoe') < 1 && this.colonyKnowledge.discoveries.includes('skill:planting')) {
                return 'rope';
            }
            if (this.getCampMaterial('logs') >= 2 && this.getCampMaterial('planks') < desiredPlanks) {
                return 'planks';
            }
            if (this.getCampMaterial('fiber') >= 2 && this.getCampMaterial('rope') < desiredRope) {
                return 'rope';
            }
            return null;
        }

        processMaterials(colonist, output) {
            if (output === 'planks' && this.getCampMaterial('logs') >= 2) {
                this.consumeCampMaterial('logs', 2);
                this.addCampMaterial('planks', 2);
                colonist.gainSkill('crafting', 0.8);
                this.pushEvent(`${colonist.name} cut logs into planks.`);
                return true;
            }
            if (output === 'rope' && this.getCampMaterial('fiber') >= 2) {
                this.consumeCampMaterial('fiber', 2);
                this.addCampMaterial('rope', 1);
                colonist.gainSkill('crafting', 0.7);
                this.pushEvent(`${colonist.name} twisted rope from fiber.`);
                return true;
            }
            this.recordFailedAction(colonist, `process:${output}`);
            return false;
        }

        refreshEquipment(colonist) {
            if (distance(colonist, this.camp) > 20) {
                return;
            }
            const desired = ['hauling', 'wood', 'hunting', 'building', 'farming', 'clothing'];
            const preferredBySlot = {
                hauling: ['basket'],
                wood: ['axe'],
                hunting: ['spear'],
                building: ['hammer'],
                farming: ['hoe'],
                clothing: ['simpleClothing']
            };
            for (const slot of desired) {
                const equipped = colonist.equipment[slot];
                const preferredTypes = preferredBySlot[slot];
                const minTier = this.getEraItemTierFloor(preferredTypes[0]);
                const equippedRank = equipped ? getTierRank(equipped.tier) : -1;
                const isUsable = equipped && (equipped.maxDurability <= 0 || equipped.durability > equipped.maxDurability * 0.25);
                if (equipped && isUsable && equippedRank >= getTierRank(minTier)) {
                    continue;
                }
                if (equipped) {
                    this.returnCampItem(equipped);
                    colonist.equipment[slot] = null;
                }
                for (const type of preferredTypes) {
                    const candidates = this.camp.items
                        .filter((entry) =>
                            entry.type === type &&
                            (entry.maxDurability <= 0 || entry.durability > entry.maxDurability * 0.25)
                        )
                        .sort((left, right) =>
                            getTierRank(right.tier) - getTierRank(left.tier) ||
                            (right.quality || 0) - (left.quality || 0) ||
                            (right.durability || 0) - (left.durability || 0)
                        );
                    const chosen = candidates.find((entry) => getTierRank(entry.tier) >= getTierRank(minTier)) || candidates[0] || null;
                    if (chosen) {
                        this.camp.items = this.camp.items.filter((entry) => entry !== chosen);
                        colonist.equipment[slot] = chosen;
                        break;
                    }
                }
            }
        }

        needsToolRepair() {
            return this.camp.items.some((item) => item.maxDurability > 0 && item.durability < item.maxDurability * 0.55) ||
                this.colonists.some((colonist) =>
                    Object.values(colonist.equipment).some((item) => item && item.maxDurability > 0 && item.durability < item.maxDurability * 0.45)
                );
        }

        repairAvailableTool(colonist) {
            const equipped = Object.values(colonist.equipment).find((item) => item && item.maxDurability > 0 && item.durability < item.maxDurability * 0.7);
            const target = equipped || this.camp.items.find((item) => item.maxDurability > 0 && item.durability < item.maxDurability * 0.7);
            if (!target || this.getCampMaterial('planks') < 1 || this.camp.stone < 1) {
                this.recordFailedAction(colonist, 'repairTool');
                return false;
            }
            this.consumeCampMaterial('planks', 1);
            this.camp.stone = Math.max(0, this.camp.stone - 1);
            target.durability = Math.min(target.maxDurability, target.durability + Math.ceil(target.maxDurability * 0.6));
            colonist.gainSkill('crafting', 0.7);
            colonist.gainSkill('building', 0.3);
            this.pushEvent(`${colonist.name} repaired a ${target.type}.`);
            return true;
        }

        buildDrinkPlan(colonist) {
            if (this.camp.water > 4) {
                return [{ kind: 'camp', duration: 1.4, action: 'drinkCamp' }];
            }
            const source = this.findNearestResource(colonist, 'water');
            if (!source) {
                return null;
            }
            return [{ kind: 'resource', entity: source, duration: 1.8, action: 'drinkSource' }];
        }

        buildWaterHaulPlan(colonist) {
            const source = this.findNearestResource(colonist, 'water');
            if (!source) {
                this.recordFailedAction(colonist, 'collectWater');
                return null;
            }
            const stockpileSite = this.getStockpileSite();
            return [
                { kind: 'resource', entity: source, duration: this.getActionDuration(colonist, 'survival', 2.1, 'collectWater'), action: 'collectWater' },
                stockpileSite === this.camp
                    ? { kind: 'camp', duration: 0.9, action: 'deliverWater' }
                    : { kind: 'resource', entity: stockpileSite, duration: 0.9, action: 'deliverWater' }
            ];
        }

        buildEatPlan(colonist) {
            if (this.camp.food > 2.5) {
                return [{ kind: 'camp', duration: 1.8, action: 'eatCamp' }];
            }
            const source = this.findBestFoodSource(colonist, {
                preferImmediate: true,
                allowAnimals: true
            });
            if (!source) {
                this.recordFailedAction(colonist, 'eat');
                return null;
            }
            if (source.type === 'wildAnimal') {
                const stockpileSite = this.getStockpileSite();
                return [
                    { kind: 'resource', entity: source, duration: this.getActionDuration(colonist, 'hunting', 3.4, 'huntMeal'), action: 'huntMeal' },
                    stockpileSite === this.camp
                        ? { kind: 'camp', duration: 0.8, action: 'deliverFood' }
                        : { kind: 'resource', entity: stockpileSite, duration: 0.8, action: 'deliverFood' }
                ];
            }
            const stockpileSite = this.getStockpileSite();
            return [
                { kind: 'resource', entity: source, duration: this.getActionDuration(colonist, 'foraging', 2.6, 'eatAndGatherFood'), action: 'eatAndGatherFood' },
                stockpileSite === this.camp
                    ? { kind: 'camp', duration: 0.8, action: 'deliverFood' }
                    : { kind: 'resource', entity: stockpileSite, duration: 0.8, action: 'deliverFood' }
            ];
        }

        buildWarmPlan(colonist) {
            const home = this.getSleepSite(colonist);
            if (home !== this.camp && this.camp.fireFuel <= 0) {
                return [{ kind: 'resource', entity: home, duration: 2.4, action: 'warmHome' }];
            }
            if (this.camp.fireFuel > 0) {
                return [{ kind: 'camp', duration: 2.8, action: 'warmCamp' }];
            }
            const shelter = this.findBestShelterSpot(colonist);
            if (shelter && distance(shelter, this.camp) > 16) {
                return [{ kind: 'wander', x: shelter.x, y: shelter.y, duration: 1.8, action: 'seekShelter' }];
            }
            return this.buildWoodPlan(colonist);
        }

        buildSleepPlan(colonist) {
            const home = this.getSleepSite(colonist);
            if (home !== this.camp) {
                return [
                    { kind: 'resource', entity: home, duration: 3.8, action: 'sleepHome' }
                ];
            }
            const shelter = this.findBestShelterSpot(colonist);
            if (shelter && distance(shelter, this.camp) > 16) {
                return [
                    { kind: 'wander', x: shelter.x, y: shelter.y, duration: 0.8, action: 'seekShelter' },
                    { kind: 'camp', duration: 4.2, action: 'sleepCamp' }
                ];
            }
            return [{ kind: 'camp', duration: 4.2, action: 'sleepCamp' }];
        }

        buildSocialPlan(colonist) {
            const peers = this.colonists
                .filter((entry) =>
                    entry !== colonist &&
                    entry.alive &&
                    distance(entry, colonist) < 120 &&
                    entry.stats.health > 40
                )
                .sort((a, b) => {
                    const aFriend = colonist.relationships.friends[a.id] || 0;
                    const bFriend = colonist.relationships.friends[b.id] || 0;
                    return (bFriend - aFriend) || (distance(colonist, a) - distance(colonist, b));
                })[0];
            if (!peers) {
                return null;
            }
            return [
                { kind: 'resource', entity: peers, duration: 1.8, action: 'socializeWithPeer' }
            ];
        }

        buildTendPlan() {
            return [{ kind: 'camp', duration: 2.4, action: 'tendWounds' }];
        }

        buildForagePlan(colonist) {
            const source = this.findBestFoodSource(colonist, {
                preferImmediate: false,
                allowAnimals: false
            });
            if (!source) {
                this.recordFailedAction(colonist, 'collectFood');
                return null;
            }
            const stockpileSite = this.getStockpileSite();
            return [
                { kind: 'resource', entity: source, duration: this.getActionDuration(colonist, 'foraging', 2.6, 'collectFood'), action: 'collectFood' },
                stockpileSite === this.camp
                    ? { kind: 'camp', duration: 0.8, action: 'deliverFood' }
                    : { kind: 'resource', entity: stockpileSite, duration: 0.8, action: 'deliverFood' }
            ];
        }

        buildWoodPlan(colonist) {
            const trees = this.findNearestResource(colonist, 'trees');
            if (!trees) {
                this.recordFailedAction(colonist, 'collectWood');
                return null;
            }
            const stockpileSite = this.getStockpileSite();
            return [
                { kind: 'resource', entity: trees, duration: this.getActionDuration(colonist, 'building', 3.4, 'collectWood'), action: 'collectWood' },
                stockpileSite === this.camp
                    ? { kind: 'camp', duration: 0.8, action: 'deliverWood' }
                    : { kind: 'resource', entity: stockpileSite, duration: 0.8, action: 'deliverWood' }
            ];
        }

        buildStonePlan(colonist) {
            const stone = this.findNearestResource(colonist, 'stone');
            if (!stone) {
                this.recordFailedAction(colonist, 'collectStone');
                return null;
            }
            const stockpileSite = this.getStockpileSite();
            return [
                { kind: 'resource', entity: stone, duration: this.getActionDuration(colonist, 'building', 3.6, 'collectStone'), action: 'collectStone' },
                stockpileSite === this.camp
                    ? { kind: 'camp', duration: 0.8, action: 'deliverStone' }
                    : { kind: 'resource', entity: stockpileSite, duration: 0.8, action: 'deliverStone' }
            ];
        }

        buildHuntPlan(colonist) {
            const craftSpearFirst = !colonist.equipment.hunting && this.canCraftRecipe('spear') && this.canPursueRecipe('spear', colonist);
            const animal = this.findNearestAnimal(colonist, { preferYield: true });
            if (!animal) {
                this.recordFailedAction(colonist, 'huntAnimal');
                return this.buildForagePlan(colonist);
            }
            const plan = [
                { kind: 'resource', entity: animal, duration: this.getActionDuration(colonist, 'hunting', 3.8, 'huntAnimal'), action: 'huntAnimal' },
                this.getStockpileSite() === this.camp
                    ? { kind: 'camp', duration: 0.8, action: 'deliverFood' }
                    : { kind: 'resource', entity: this.getStockpileSite(), duration: 0.8, action: 'deliverFood' }
            ];
            if (craftSpearFirst) {
                plan.unshift({
                    kind: 'camp',
                    duration: this.getActionDuration(colonist, 'crafting', RECIPE_DEFS.spear.duration, 'craftRecipe'),
                    action: 'craftRecipe',
                    recipeKey: 'spear'
                });
            }
            return plan;
        }

        buildCraftPlan(colonist) {
            const recipeKey = this.chooseCraftRecipe(colonist);
            if (!recipeKey) {
                return null;
            }
            const duration = this.getActionDuration(colonist, 'crafting', RECIPE_DEFS[recipeKey].duration, 'craftRecipe');
            return [{ kind: 'camp', duration, action: 'craftRecipe', recipeKey }];
        }

        buildProcessPlan(colonist) {
            const output = this.chooseProcessingTask();
            if (!output) {
                return null;
            }
            return [{ kind: 'camp', duration: this.getActionDuration(colonist, 'crafting', 2.1, 'processMaterials'), action: 'processMaterials', output }];
        }

        buildRepairPlan(colonist) {
            if (!this.needsToolRepair()) {
                return null;
            }
            return [{ kind: 'camp', duration: this.getActionDuration(colonist, 'crafting', 2.2, 'repairTool'), action: 'repairTool' }];
        }

        buildPlantTrialPlan(colonist) {
            const plot = this.findPlantingSpot();
            if (!plot) {
                return null;
            }
            const plan = [{ kind: 'resource', entity: plot, duration: 2.6, action: 'plantTrial' }];
            if (!colonist.equipment.farming && this.canCraftRecipe('hoe') && this.canPursueRecipe('hoe', colonist)) {
                plan.unshift({
                    kind: 'camp',
                    duration: this.getActionDuration(colonist, 'crafting', RECIPE_DEFS.hoe.duration, 'craftRecipe'),
                    action: 'craftRecipe',
                    recipeKey: 'hoe'
                });
            }
            return plan;
        }

        buildFleePlan(colonist) {
            if (!colonist.threat) {
                return null;
            }
            const dx = colonist.x - colonist.threat.x;
            const dy = colonist.y - colonist.threat.y;
            const length = Math.hypot(dx, dy) || 1;
            return [{
                kind: 'wander',
                x: clamp(colonist.x + (dx / length) * 140, 24, this.width - 24),
                y: clamp(colonist.y + (dy / length) * 140, 24, this.height - 24),
                duration: 0.4,
                action: 'fleeMove'
            }];
        }

        buildProtectPlan(colonist) {
            if (!colonist.threat) {
                return null;
            }
            return [
                { kind: 'resource', entity: colonist.threat, duration: 1.1, action: 'attackPredator' }
            ];
        }

        buildWarPlan(colonist) {
            const battlefront = this.getNearestBattlefront(colonist);
            if (!battlefront) {
                return null;
            }
            const battlePoint = this.battleManager.getBattleDestinationForColonist
                ? this.battleManager.getBattleDestinationForColonist(battlefront, colonist)
                : battlefront;
            return [
                {
                    kind: 'resource',
                    entity: battlefront,
                    destination: battlePoint,
                    duration: 1.2,
                    action: 'battleEngage',
                    battlefrontId: battlefront.id
                }
            ];
        }

        buildRestPlan(colonist) {
            return [{
                kind: 'wander',
                x: clamp(colonist.x + Math.cos(colonist.roamAngle) * 55, 20, this.width - 20),
                y: clamp(colonist.y + Math.sin(colonist.roamAngle) * 55, 20, this.height - 20),
                duration: 0.5,
                action: 'wander'
            }];
        }

        generateTerrain() {
            for (let row = 0; row < GRID_ROWS; row++) {
                for (let col = 0; col < GRID_COLS; col++) {
                    const nx = col / GRID_COLS;
                    const ny = row / GRID_ROWS;
                    const elevation = (
                        Math.sin(nx * 5.6 + this.seed * 0.03) * 0.24 +
                        Math.cos(ny * 7.3 - this.seed * 0.02) * 0.18 +
                        (hashNoise(col, row, this.seed) - 0.5) * 0.5
                    );
                    const moisture = (
                        Math.cos(nx * 8.2 - 1.3) * 0.22 +
                        Math.sin(ny * 6.4 + 0.8) * 0.18 +
                        (hashNoise(col + 17, row + 9, this.seed) - 0.5) * 0.48
                    );
                    const inValleyRing =
                        col < VALLEY_RING_CELLS ||
                        row < VALLEY_RING_CELLS ||
                        col >= GRID_COLS - VALLEY_RING_CELLS ||
                        row >= GRID_ROWS - VALLEY_RING_CELLS;
                    let biome = 'grassland';
                    if (inValleyRing) {
                        biome = 'valley';
                    } else if (elevation < -0.38) {
                        biome = 'water';
                    } else if (elevation > 0.31) {
                        biome = 'rocky';
                    } else if (moisture > 0.21 && elevation > -0.04 && elevation < 0.18) {
                        biome = 'fertile';
                    } else if (moisture > 0.16) {
                        biome = 'forest';
                    }

                    this.cells.push({
                        col,
                        row,
                        x: col * CELL_WIDTH,
                        y: row * CELL_HEIGHT,
                        elevation,
                        moisture,
                        biome,
                        terrain: {
                            marsh: !inValleyRing && biome !== 'water' && biome !== 'valley' && biome !== 'rocky' && moisture > 0.28 && elevation < 0.08,
                            hill: !inValleyRing && biome !== 'water' && biome !== 'valley' && elevation > 0.1,
                            mountain: !inValleyRing && biome === 'rocky' && elevation > 0.4,
                            cleared: false,
                            irrigation: false,
                            terraced: false,
                            drained: false,
                            fortified: false,
                            quarried: false,
                            traffic: 0,
                            pathWear: 0,
                            roadLevel: 0
                        }
                    });
                }
            }
        }

        spawnResources() {
            let id = 0;
            for (const cell of this.cells) {
                const centerX = cell.x + CELL_WIDTH * 0.5;
                const centerY = cell.y + CELL_HEIGHT * 0.5;
                const jitterX = (this.rng() - 0.5) * CELL_WIDTH * 0.6;
                const jitterY = (this.rng() - 0.5) * CELL_HEIGHT * 0.6;
                const x = centerX + jitterX;
                const y = centerY + jitterY;

                if (cell.biome === 'water') {
                    const right = cell.col < GRID_COLS - 1 ? this.cells[cell.row * GRID_COLS + (cell.col + 1)] : null;
                    const down = cell.row < GRID_ROWS - 1 ? this.cells[(cell.row + 1) * GRID_COLS + cell.col] : null;
                    const downRight = (cell.col < GRID_COLS - 1 && cell.row < GRID_ROWS - 1)
                        ? this.cells[(cell.row + 1) * GRID_COLS + (cell.col + 1)]
                        : null;
                    const isWaterClusterAnchor = right?.biome === 'water' && down?.biome === 'water' && downRight?.biome === 'water';
                    if (isWaterClusterAnchor) {
                        this.resources.push(this.makeResource(
                            id++,
                            'water',
                            cell.x + CELL_WIDTH,
                            cell.y + CELL_HEIGHT,
                            resourcesConfig.naturalNodes.waterClusterAmount,
                            cell.biome
                        ));
                    }
                    continue;
                }
                if ((cell.biome === 'fertile' || cell.biome === 'forest') && this.rng() < 0.18) {
                    this.resources.push(this.makeResource(
                        id++,
                        'berries',
                        x,
                        y,
                        resourcesConfig.naturalNodes.berriesBase + this.rng() * resourcesConfig.naturalNodes.berriesVariance,
                        cell.biome
                    ));
                }
                if ((cell.biome === 'forest' || cell.biome === 'fertile') && this.rng() < 0.16) {
                    this.resources.push(this.makeResource(
                        id++,
                        'trees',
                        x + 6,
                        y - 4,
                        resourcesConfig.naturalNodes.treesBase + this.rng() * resourcesConfig.naturalNodes.treesVariance,
                        cell.biome
                    ));
                }
                if (cell.biome === 'rocky' && this.rng() < 0.14) {
                    this.resources.push(this.makeResource(
                        id++,
                        'stone',
                        x - 10,
                        y + 6,
                        resourcesConfig.naturalNodes.stoneBase + this.rng() * resourcesConfig.naturalNodes.stoneVariance,
                        cell.biome
                    ));
                }
                if ((cell.biome === 'grassland' || cell.biome === 'fertile') && this.rng() < 0.05) {
                    this.animals.push(this.makeAnimal(id++, x, y, cell.biome));
                }
                if (cell.biome === 'forest' && this.rng() < 0.035) {
                    this.predators.push(this.makePredator(id++, x, y, cell.biome));
                }
            }
        }

        ensureStarterResources() {
            const predatorCaution = this.getPredatorCaution();
            const placements = [
                { type: 'water', dx: 0, dy: -150, amount: resourcesConfig.starterNodes.water, biome: 'water' },
                { type: 'berries', dx: 72, dy: -42, amount: resourcesConfig.starterNodes.berriesNear, biome: 'fertile' },
                { type: 'berries', dx: 120, dy: -65, amount: resourcesConfig.starterNodes.berriesFar, biome: 'fertile' },
                { type: 'berries', dx: -110, dy: 80, amount: resourcesConfig.starterNodes.berriesSouth, biome: 'fertile' },
                { type: 'trees', dx: 150, dy: 95, amount: resourcesConfig.starterNodes.treesEast, biome: 'forest' },
                { type: 'trees', dx: -150, dy: -90, amount: resourcesConfig.starterNodes.treesWest, biome: 'forest' },
                { type: 'stone', dx: 185, dy: -25, amount: resourcesConfig.starterNodes.stone, biome: 'rocky' }
            ];
            let id = this.resources.length + this.animals.length + 1000;
            for (const placement of placements) {
                const x = clamp(this.camp.x + placement.dx, 30, this.width - 30);
                const y = clamp(this.camp.y + placement.dy, 30, this.height - 30);
                const existing = this.resources.find((resource) =>
                    resource.type === placement.type && distance(resource, { x, y }) < 40
                );
                if (!existing) {
                    this.resources.push(this.makeResource(id++, placement.type, x, y, placement.amount, placement.biome));
                }
            }
            const animalPlacements = [
                { dx: 170, dy: -110, biome: 'grassland' },
                { dx: -190, dy: 115, biome: 'grassland' }
            ];
            for (const placement of animalPlacements) {
                const x = clamp(this.camp.x + placement.dx, 30, this.width - 30);
                const y = clamp(this.camp.y + placement.dy, 30, this.height - 30);
                const existingAnimal = this.animals.find((animal) => !animal.depleted && distance(animal, { x, y }) < 55);
                if (!existingAnimal) {
                    this.animals.push(this.makeAnimal(id++, x, y, placement.biome));
                }
            }
            const predatorOffsetX = 120 + predatorCaution * 80;
            const predatorOffsetY = -45 - predatorCaution * 25;
            const nearbyPredator = this.predators.find((predator) =>
                distance(predator, { x: this.camp.x + predatorOffsetX, y: this.camp.y + predatorOffsetY }) < 90
            );
            if (!nearbyPredator && predatorCaution < 3) {
                this.predators.push(this.makePredator(
                    id++,
                    clamp(this.camp.x + predatorOffsetX, 30, this.width - 30),
                    clamp(this.camp.y + predatorOffsetY, 30, this.height - 30),
                    'forest'
                ));
            }
        }

        makeResource(id, type, x, y, amount, biome) {
            const respawnScale = type === 'berries'
                ? 0.42
                : type === 'water'
                    ? 0.36
                    : type === 'trees'
                        ? 0.34
                        : 0.3;
            return {
                id,
                type,
                x,
                y,
                amount,
                maxAmount: amount,
                biome,
                depleted: false,
                respawnDelay: RESOURCE_RESPAWN_MIN + this.rng() * (RESOURCE_RESPAWN_MAX - RESOURCE_RESPAWN_MIN),
                respawnTimer: 0,
                respawnScale
            };
        }

        trySpawnNaturalResource(type) {
            const biomeByType = {
                trees: ['forest', 'fertile'],
                stone: ['rocky'],
                water: ['water']
            };
            const candidateBiomes = biomeByType[type];
            if (!candidateBiomes) {
                return false;
            }
            for (let attempt = 0; attempt < 18; attempt += 1) {
                const cell = this.cells[Math.floor(this.rng() * this.cells.length)];
                if (!cell || !candidateBiomes.includes(cell.biome)) {
                    continue;
                }
                const x = cell.x + CELL_WIDTH * (0.25 + this.rng() * 0.5);
                const y = cell.y + CELL_HEIGHT * (0.25 + this.rng() * 0.5);
                const nearby = this.resources.find((resource) =>
                    resource.type === type && distance(resource, { x, y }) < (type === 'water' ? 95 : 55)
                );
                if (nearby) {
                    continue;
                }
                const amount = type === 'trees'
                    ? 18 + this.rng() * 14
                    : type === 'stone'
                        ? 14 + this.rng() * 10
                        : 36 + this.rng() * 28;
                this.resources.push(this.makeResource(this.nextResourceId++, type, x, y, amount, cell.biome));
                return true;
            }
            return false;
        }

        makeAnimal(id, x, y, biome) {
            return {
                id,
                type: 'wildAnimal',
                x,
                y,
                homeX: x,
                homeY: y,
                biome,
                amount: 1,
                maxAmount: 1,
                velocityAngle: this.rng() * Math.PI * 2,
                velocitySpeed: 12 + this.rng() * 10,
                panicTimer: 0,
                depleted: false,
                respawnDelay: RESOURCE_RESPAWN_MIN + this.rng() * (RESOURCE_RESPAWN_MAX - RESOURCE_RESPAWN_MIN),
                respawnTimer: 0
            };
        }

        makePredator(id, x, y, biome) {
            return {
                id,
                type: 'predator',
                x,
                y,
                homeX: x,
                homeY: y,
                biome,
                health: 70,
                velocityAngle: this.rng() * Math.PI * 2,
                velocitySpeed: 16 + this.rng() * 8,
                attackCooldown: 0,
                targetColonistId: null,
                retreatTimer: 0
            };
        }

        spawnColonists() {
            const inheritedStatBonus = this.getInheritedStatBonus();
            const inheritedSkillBonus = this.getInheritedSkillBonus();
            const inheritedTraits = this.getInheritedTraits();
            for (let i = 0; i < colonistAmount; i++) {
                const angle = (Math.PI * 2 * i) / 6;
                const radius = 20 + this.rng() * 24;
                const colonist = new Colonist(
                    this.nextColonistId++,
                    this.camp.x + Math.cos(angle) * radius,
                    this.camp.y + Math.sin(angle) * radius,
                    this.generateUniqueName(),
                    this.rng
                );
                colonist.stats.hunger = clamp(colonist.stats.hunger + inheritedStatBonus.hunger, 0, 100);
                colonist.stats.thirst = clamp(colonist.stats.thirst + inheritedStatBonus.thirst, 0, 100);
                colonist.stats.warmth = clamp(colonist.stats.warmth + inheritedStatBonus.warmth, 0, 100);
                colonist.stats.energy = clamp(colonist.stats.energy + inheritedStatBonus.energy, 0, 100);
                colonist.traits = createTraitProfile(this.rng, Object.fromEntries(
                    Object.entries(inheritedTraits).map(([key, value]) => [key, clamp(value + (this.rng() - 0.5) * 0.08, 0.05, 0.95)])
                ));
                for (const [skill, bonus] of Object.entries(inheritedSkillBonus)) {
                    colonist.gainSkill(skill, bonus);
                }
                for (const [type, entries] of Object.entries(this.colonyKnowledge.resources)) {
                    colonist.memory.resources[type] = clone(entries).slice(0, 3);
                }
                colonist.memory.dangerZones = clone(this.colonyKnowledge.dangerZones).slice(0, 2);
                colonist.memory.shelterSpots = clone(this.colonyKnowledge.shelterSpots).slice(0, 2);
                this.colonists.push(colonist);
            }
        }

        getInheritedStatBonus() {
            const causes = this.lineageMemory.deathCauses || {};
            return {
                hunger: (causes.starvation || 0) > 0 ? 12 : 0,
                thirst: (causes.dehydration || 0) > 0 ? 14 : 0,
                warmth: (causes.exposure || 0) > 0 ? 12 : 0,
                energy: (causes.exhaustion || 0) > 0 ? 10 : 0
            };
        }

        getInheritedSkillBonus() {
            const discoveries = new Set(this.lineageMemory.discoveries || []);
            const causes = this.lineageMemory.deathCauses || {};
            const settlement = this.lineageMemory.settlementKnowledge || {};
            return {
                foraging: discoveries.has('resource:berries') ? 1.5 : 0,
                hunting: discoveries.has('resource:wildAnimal') || discoveries.has('skill:hunting') ? 1.5 : 0,
                building: (discoveries.has('resource:stone') || discoveries.has('resource:trees') ? 1.2 : 0) + (settlement.housingTier || 0) * 0.45 + (settlement.defenseTier || 0) * 0.35,
                farming: (discoveries.has('skill:planting') ? 1.2 : 0) + (settlement.storageTier || 0) * 0.2 + (settlement.civicTier || 0) * 0.15,
                crafting: (discoveries.has('skill:tool_use') ? 1.1 : 0) + (settlement.civicTier || 0) * 0.35 + (settlement.storageTier || 0) * 0.15,
                medicine: (discoveries.has('skill:medicine') ? 1 : 0) + (settlement.civicTier || 0) * 0.12,
                survival: (causes.dehydration || 0) + (causes.exhaustion || 0) > 0 ? 1.4 : 0,
                combat: ((causes.predatorAttack || 0) > 0 ? 1.2 : 0) + (settlement.defenseTier || 0) * 0.35
            };
        }

        getCultureIntentBias(intent) {
            const values = this.lineageMemory.culturalValues;
            const mapping = {
                forage: values.hoardFood * 8 + values.worshipNature * 3,
                hunt: values.avoidStrangers * 4,
                haulWater: values.hoardFood * 3,
                socialize: values.shareFood * 10 + values.worshipNature * 2,
                build: values.favorExpansion * 8,
                plant: values.worshipNature * 6 + values.hoardFood * 4
            };
            return mapping[intent] || 0;
        }

        update(dt) {
            if (this.paused) {
                return;
            }
            this.normalizePlacedStructureFootprints();

            const seasonPace = this.getSimulationKnob('seasonPace');
            const scaledDt = dt * this.simulationSpeed;
            this.elapsed += scaledDt;
            this.timeOfDay += (scaledDt * seasonPace) / DAY_DURATION;
            while (this.timeOfDay >= 1) {
                this.timeOfDay -= 1;
                this.day += 1;
                if ((this.day - 1) % this.daysPerSeason === 0 && this.day > 1) {
                    this.seasonIndex = (this.seasonIndex + 1) % SEASONS.length;
                    if (this.seasonIndex === 0) {
                        this.year += 1;
                    }
                    this.pushEvent(`Season shifted to ${this.getSeason().name}.`);
                }
            }

            this.weatherTimer -= scaledDt;
            if (this.weatherTimer <= 0 && !this.forcedWeather) {
                const next = this.pickWeather();
                if (next.name !== this.getWeather().name) {
                    this.weatherIndex = WEATHER_TYPES.findIndex((entry) => entry.name === next.name);
                    this.pushEvent(`${next.name} moved over the colony.`);
                }
                this.weatherDuration = 42 + this.rng() * 34;
                this.weatherTimer = this.weatherDuration;
            }
            this.weatherManager.update(scaledDt);

            this.godMode.protectBubbleTtl = Math.max(0, this.godMode.protectBubbleTtl - scaledDt);
            this.godMode.divineSuggestion.ttl = Math.max(0, this.godMode.divineSuggestion.ttl - scaledDt);
            if (this.godMode.divineSuggestion.ttl <= 0) {
                this.godMode.divineSuggestion.focus = null;
                this.godMode.divineSuggestion.source = null;
            }

            this.updateCamp(scaledDt);
            this.ensureSettlementProjects();
            this.updateLandUse(scaledDt);
            this.updateFoodCulture(scaledDt);
            this.updateInstitutionLife(scaledDt);
            this.updatePhase9WorldResponse(scaledDt);
            this.updateBuildings(scaledDt);
            this.updateResources(scaledDt);
            this.updateBranchColonies(scaledDt);
            this.updateFactionParties(scaledDt);
            this.updateFactionEffects(scaledDt);
            this.updateBattlefronts(scaledDt);
            this.updateWarAftermath(scaledDt);
            this.updateAnimals(scaledDt);
            this.updatePredators(scaledDt);

            for (const colonist of this.colonists) {
                this.observeNearbyResources(colonist);
                colonist.update(scaledDt, this);
            }
            this.colonists = this.colonists.filter((colonist) => {
                if (!colonist.alive) {
                    this.recordDeath(colonist);
                    return false;
                }
                return true;
            });
            this.updateFamilyUnits(scaledDt);
            this.updateRelationshipsAndConflict(scaledDt);
            this.updateRituals(scaledDt);
            this.maybeFoundBranchColony();
            this.evaluateLegacyMilestones();

            if (this.colonists.length === 0 && !this.extinctionSnapshot) {
                this.extinctionSnapshot = this.exportLineageMemory();
                this.pushEvent(`Generation ${this.generation} was lost. Their lessons are being preserved.`);
            }
        }

        updateCamp(dt) {
            const weather = this.getWeather();
            const season = this.getSeason();
            const firePitEfficiency = this.camp.structures.firePit > 0 ? 0.82 : 1;
            const housingSatisfaction = this.getHousingSatisfaction();
            for (const role of Object.keys(this.recentLabor)) {
                this.recentLabor[role] = Math.max(0, this.recentLabor[role] - dt * 0.02);
            }
            this.camp.fireFuel = clamp(this.camp.fireFuel - dt * (0.14 + Math.max(0, -season.temperature) * 0.008 + (weather.name === 'Cold Snap' ? 0.12 : 0)) * firePitEfficiency, 0, 999);
            this.camp.water = clamp(this.camp.water - dt * (0.05 + (weather.name === 'Drought' ? 0.05 : 0)), 0, 999);
            if (weather.name === 'Rain' || weather.name === 'Storm') {
                this.camp.water = clamp(this.camp.water + dt * (weather.name === 'Storm' ? 0.24 : 0.14), 0, 999);
            }
            const spoilage = Math.min(this.camp.food, dt * this.getFoodSpoilageRate());
            this.camp.food = clamp(this.camp.food - spoilage, 0, 999);
            if (this.camp.wood > 0 && this.camp.fireFuel < 10 && this.camp.shelter > 18) {
                const used = Math.min(this.camp.wood, dt * 0.45);
                this.camp.wood -= used;
                this.camp.fireFuel += used * 1.2;
            }
            const advancedStoneDemand =
                (this.hasTechnology('masonry') ? 4 : 0) +
                (this.hasTechnology('militaryOrganization') ? 3 : 0) +
                (this.hasTechnology('engineering') ? 2 : 0) +
                this.getConstructionDemand('stone') * 0.9;
            const reservedStone = Math.max(this.camp.structures.firePit < 1 ? 3 : 1, Math.min(12, Math.ceil(advancedStoneDemand)));
            if (this.camp.stone > reservedStone && this.camp.shelter < 88) {
                const repair = Math.min(this.camp.stone - reservedStone, dt * 0.2);
                this.camp.stone -= repair;
                this.camp.shelter = clamp(this.camp.shelter + repair * 0.75, 0, 100);
            }
            this.camp.shelter = clamp(this.camp.shelter - dt * (weather.name === 'Storm' ? 0.08 : 0.02), 0, 100);
            if (housingSatisfaction < 0.92) {
                const moraleHit = (0.92 - housingSatisfaction) * 0.22;
                for (const colonist of this.colonists) {
                    if (!colonist.alive) {
                        continue;
                    }
                    colonist.stats.morale = clamp(colonist.stats.morale - dt * moraleHit, 0, 100);
                }
            }
            this.updateCulturalValues(dt);
            this.updateTechnology();
        }

        updateResources(dt) {
            const weather = this.getWeather();
            const season = this.getSeason();
            const ecology = this.phase9.ecology;
            const blightPenalty = Math.max(0.35, 1 - this.phase9.pressure.blight * 0.4);
            const rainfallFactor = clamp(ecology.rainfall || 1, 0.55, 1.2);
            const fertilityFactor = clamp(ecology.fertility || 1, 0.5, 1.25);
            const soilFactor = clamp(ecology.soilHealth || 1, 0.35, 1.15);
            const abundance = this.getSimulationKnob('resourceAbundance');
            for (const resource of this.resources) {
                if (resource.depleted) {
                    resource.respawnTimer = Math.max(0, (resource.respawnTimer || 0) - dt);
                    if (resource.respawnTimer > 0) {
                        continue;
                    }
                    resource.depleted = false;
                    resource.amount = Math.max(resource.amount || 0, resource.maxAmount * (resource.respawnScale || 0.35));
                }
                if (resource.type === 'berries') {
                    const growth = dt * 0.18 * season.berryGrowth * Math.max(0.3, 1 + weather.moisture) * fertilityFactor * soilFactor * blightPenalty * abundance;
                    resource.amount = clamp(resource.amount + growth, 0, resource.maxAmount);
                    resource.depleted = resource.amount <= 0.05;
                } else if (resource.type === 'trees') {
                    const regrowth = dt * 0.028 * Math.max(0.35, 1 + weather.moisture) * rainfallFactor * abundance;
                    resource.amount = clamp(resource.amount + regrowth, 0, resource.maxAmount);
                    resource.depleted = resource.amount <= 0.05;
                } else if (resource.type === 'stone') {
                    const regrowth = dt * 0.014 * (weather.name === 'Storm' ? 1.15 : 1) * Math.max(0.72, 1 - this.phase9.terraforming.quarryMountains * 0.03) * abundance;
                    resource.amount = clamp(resource.amount + regrowth, 0, resource.maxAmount);
                    resource.depleted = resource.amount <= 0.05;
                } else if (resource.type === 'water') {
                    const refill = dt * (
                        weather.name === 'Storm' ? 0.8 :
                        weather.name === 'Rain' ? 0.45 :
                        weather.name === 'Cloudy' ? 0.08 :
                        weather.name === 'Drought' ? 0 :
                        0.03
                    ) * rainfallFactor * abundance;
                    const droughtDrain = weather.name === 'Drought'
                        ? dt * (0.09 + resource.maxAmount * 0.0011) * Math.max(0.8, this.getSimulationKnob('weatherSeverity'))
                        : 0;
                    resource.maxAmount = 100;
                    resource.amount = clamp(resource.amount + refill - droughtDrain, 0, resource.maxAmount);
                    resource.depleted = resource.amount <= 0.05;
                }
                if (resource.depleted) {
                    this.triggerRespawnCooldown(resource);
                }
            }
            if (this.rng() < dt * 0.0014 * Math.max(0.45, rainfallFactor) * abundance) {
                this.trySpawnNaturalResource('trees');
            }
            if (this.rng() < dt * 0.001 * Math.max(0.55, 1 - this.phase9.terraforming.quarryMountains * 0.04) * abundance) {
                this.trySpawnNaturalResource('stone');
            }
            if ((weather.name === 'Rain' || weather.name === 'Storm') && this.rng() < dt * 0.0018 * rainfallFactor * abundance) {
                this.trySpawnNaturalResource('water');
            }
        }

        updateBranchColonies(dt) {
            this.mainAttackCooldown = Math.max(0, this.mainAttackCooldown - dt);
            for (const colony of this.getActiveBranchColonies()) {
                if (!colony.factionIdentity) {
                    Object.assign(colony, this.normalizeBranchColony(colony, colony.id - 1));
                }
                this.updateFactionArmy(colony, dt);
                colony.tradeCooldown = Math.max(0, (colony.tradeCooldown || 0) - dt);
                colony.infoCooldown = Math.max(0, (colony.infoCooldown || 0) - dt);
                colony.raidCooldown = Math.max(0, (colony.raidCooldown || 0) - dt);
                colony.diplomacyCooldown = Math.max(0, (colony.diplomacyCooldown || 0) - dt);
                colony.supportCooldown = Math.max(0, (colony.supportCooldown || 0) - dt);
                colony.population = clamp(colony.population + dt * 0.002, 2, 8); // colony population
                const radius = this.getBranchTerritoryRadius(colony);
                const nearbyResources = this.resources.filter((resource) =>
                    !resource.depleted && distance(resource, colony) < radius
                );
                let foodGain = 0;
                let waterGain = 0;
                for (const resource of nearbyResources) {
                    if (resource.type === 'berries') {
                        const gathered = Math.min(resource.amount, dt * 0.08);
                        resource.amount = Math.max(0, resource.amount - gathered);
                        foodGain += gathered * 0.65;
                    } else if (resource.type === 'water') {
                        const gathered = Math.min(resource.amount, dt * 0.07);
                        resource.amount = Math.max(0, resource.amount - gathered);
                        waterGain += gathered * 0.9;
                    } else if (resource.type === 'trees') {
                        const gathered = Math.min(resource.amount, dt * 0.045);
                        resource.amount = Math.max(0, resource.amount - gathered);
                        colony.wood = clamp((colony.wood || 0) + gathered * 0.55, 0, 80);
                    } else if (resource.type === 'stone') {
                        const gathered = Math.min(resource.amount, dt * 0.03);
                        resource.amount = Math.max(0, resource.amount - gathered);
                        colony.stone = clamp((colony.stone || 0) + gathered * 0.45, 0, 70);
                    }
                    if (resource.amount <= 0.05) {
                        this.triggerRespawnCooldown(resource);
                    }
                }
                colony.food = clamp((colony.food || 10) + foodGain - dt * (0.055 + colony.population * 0.01), 0, 140);
                colony.water = clamp((colony.water || 8) + waterGain - dt * (0.06 + colony.population * 0.012), 0, 140);
                this.updateFactionDiplomacy(colony, dt);
                this.updateFactionCampaign(colony, dt);
                this.resolveFactionBattleSupport(colony);
                if (colony.tradeCooldown <= 0) {
                    this.resolveFactionTrade(colony);
                }
                if (colony.infoCooldown <= 0) {
                    this.resolveFactionKnowledgeExchange(colony);
                }
                if (colony.raidCooldown <= 0) {
                    this.resolveFactionRaid(colony);
                }
                this.resolveFactionMigration(colony, dt);
                if ((colony.infoCooldown || 0) <= 12) {
                    this.absorbBranchKnowledge(colony);
                }
            }
            this.resolveIntercolonyBattles(dt);
            if (this.mainAttackCooldown <= 0) {
                this.resolveMainAllianceRelief();
            }
            if (this.mainAttackCooldown <= 0) {
                this.resolveMainColonyOffense(dt);
            }
        }

        resolveFactionBattleSupport(colony) {
            if (colony.diplomacyState !== 'allied' || colony.supportCooldown > 0) {
                return;
            }
            const reinforcementValue = Math.min(6, Math.max(2, colony.population * 0.45 + colony.factionIdentity.trust * 2));
            const front = this.battlefronts.find((entry) =>
                !entry.resolved && (
                    (entry.mode !== 'outbound' && entry.defenderHealth < entry.defenderMaxHealth * 0.82) ||
                    (entry.mode === 'outbound' && entry.attackerHealth < entry.attackerMaxHealth * 0.84)
                )
            ) || null;
            if (front) {
                let reinforceSide = front.mode === 'outbound' ? 'attackers' : 'defenders';
                if (front.mode === 'intercolonial') {
                    const attackerColony = this.getActiveBranchColonies().find((entry) => entry.id === front.colonyId) || null;
                    const defenderColony = this.getActiveBranchColonies().find((entry) => entry.id === front.defenderColonyId) || null;
                    const attackerAllied = attackerColony?.diplomacyState === 'allied';
                    const defenderAllied = defenderColony?.diplomacyState === 'allied';
                    if (defenderAllied && front.defenderHealth < front.defenderMaxHealth * 0.84) {
                        reinforceSide = 'defenders';
                    } else if (attackerAllied && front.attackerHealth < front.attackerMaxHealth * 0.84) {
                        reinforceSide = 'attackers';
                    } else {
                        reinforceSide = defenderAllied ? 'defenders' : 'attackers';
                    }
                }
                this.spawnFactionParty(colony, 'aid', 'toCamp', {
                    strength: Math.max(1.4, reinforcementValue * 0.4),
                    status: reinforceSide === 'attackers' ? 'allied assault' : 'reinforcements',
                    effectLabel: reinforceSide === 'attackers' ? 'Support' : 'Reinforce',
                    target: front,
                    targetKind: 'battle',
                    reinforceBattlefrontId: front.id,
                    reinforceSide,
                    reinforcementValue
                });
                colony.recentAction = reinforceSide === 'attackers' ? 'supporting assault' : 'sending reinforcements';
                colony.supportCooldown = this.getColonySupportCooldownDuration(colony, 22, colony.type === 'daughter' ? 58 : 40);
                return;
            }
            const alliedTarget = this.getActiveBranchColonies()
                .filter((peer) => peer.id !== colony.id && peer.diplomacyState === 'allied')
                .map((peer) => ({ peer, threat: this.getColonyThreatScore(peer) }))
                .filter((entry) => entry.threat > 0.48)
                .sort((left, right) => right.threat - left.threat)[0]?.peer || null;
            if (!alliedTarget) {
                return;
            }
            this.spawnFactionParty(colony, 'aid', 'fromCamp', {
                target: alliedTarget,
                targetKind: 'colony',
                targetColonyId: alliedTarget.id,
                supportMode: 'allied relief',
                strength: Math.max(1.2, reinforcementValue * 0.34),
                reinforcementValue,
                status: 'relief column',
                effectLabel: 'Relief'
            });
            colony.recentAction = 'relieving ally';
            colony.supportCooldown = this.getColonySupportCooldownDuration(colony, 22, colony.type === 'daughter' ? 58 : 40);
        }

        resolveMainAllianceRelief() {
            const targetColony = this.getActiveBranchColonies()
                .filter((colony) => colony.diplomacyState === 'allied')
                .map((colony) => ({ colony, threat: this.getColonyThreatScore(colony) }))
                .filter((entry) => entry.threat > 0.46)
                .sort((left, right) => right.threat - left.threat)[0]?.colony || null;
            if (!targetColony) {
                return false;
            }
            const aggressor = this.getPrimaryThreatSource(targetColony);
            if (!aggressor) {
                return false;
            }

            const offense = this.getMainColonyAttackSummary();
            const stability = this.getColonyStability();
            if (offense.attackers.length < 2 || stability < 0.42) {
                this.spawnFactionParty(targetColony, 'aid', 'fromCamp', {
                    target: targetColony,
                    targetKind: 'colony',
                    targetColonyId: targetColony.id,
                    supportMode: 'relief',
                    strength: 1.5 + targetColony.population * 0.08,
                    reinforcementValue: 2 + targetColony.population * 0.2,
                    status: 'relief caravan',
                    effectLabel: 'Relief'
                });
                targetColony.supportCooldown = this.getColonySupportCooldownDuration(targetColony, 18, targetColony.type === 'daughter' ? 52 : 32);
                this.mainAttackCooldown = 14 + this.rng() * 10;
                this.recordFactionEvent(`The main settlement sent relief stores to ${targetColony.name}.`);
                return true;
            }

            const targetDefense = this.getFactionAttackPower(aggressor) * 0.82 + (aggressor.defense?.trainedDefenders || 0) * 2;
            const battleScale = clamp(
                this.getColonyThreatScore(targetColony) * 0.55 +
                ((aggressor.campaign?.pressure || 0) * 0.22) +
                Math.max(0, offense.power - targetDefense) / 90,
                0.2,
                0.86
            );
            const committed = offense.attackers
                .slice(0, Math.max(2, Math.min(battleScale > 0.54 ? 7 : 4, Math.round(2 + battleScale * 5))))
                .map((colonist, index) => {
                    colonist.assignedBattlefrontId = `pending-relief-${aggressor.id}`;
                    colonist.battleFormationIndex = index;
                    colonist.battleRole = index < 2 ? 'frontline' : index < 4 ? 'support' : 'reserve';
                    colonist.battleOrderTtl = 36 + battleScale * 18;
                    colonist.intent = 'war';
                    colonist.state = 'moving';
                    return colonist;
                });
            const commanderColonist = committed
                .slice()
                .sort((left, right) => (right.skills.combat + right.combatPower * 0.08) - (left.skills.combat + left.combatPower * 0.08))[0] || committed[0];
            const front = this.battleManager.launchMainColonyAttack(aggressor, committed, {
                reportType: battleScale > 0.6 ? 'large battle' : 'skirmish',
                scale: battleScale,
                attackerHealth: Math.max(16, offense.power * (1 + battleScale * 0.24)),
                defenderHealth: Math.max(14, targetDefense * (1 + battleScale * 0.18)),
                commander: commanderColonist ? {
                    name: commanderColonist.name,
                    style: commanderColonist.skills.combat > 8 ? 'aggressive' : 'balanced',
                    aggression: clamp(0.4 + commanderColonist.traits.aggression * 0.45 + commanderColonist.skills.combat * 0.04, 0.1, 1),
                    discipline: clamp(0.4 + commanderColonist.traits.endurance * 0.2 + commanderColonist.skills.combat * 0.05, 0.1, 1),
                    caution: clamp(0.18 + commanderColonist.traits.caution * 0.52, 0.05, 1)
                } : null,
                supportAlliance: {
                    sponsor: 'main settlement',
                    beneficiary: targetColony.name,
                    type: 'relief strike'
                }
            });
            if (!front) {
                for (const colonist of committed) {
                    colonist.assignedBattlefrontId = null;
                    colonist.battleRole = null;
                    colonist.battleFormationIndex = -1;
                    colonist.battleOrderTtl = 0;
                }
                return false;
            }

            for (const colonist of committed) {
                colonist.assignedBattlefrontId = front.id;
            }
            aggressor.history.skirmishes += battleScale > 0.6 ? 0 : 1;
            aggressor.history.campaigns += battleScale > 0.6 ? 1 : 0;
            aggressor.recentAction = 'meeting relief force';
            targetColony.recentAction = 'relieved by main settlement';
            targetColony.supportCooldown = this.getColonySupportCooldownDuration(targetColony, 18, targetColony.type === 'daughter' ? 56 : 38);
            this.mainAttackCooldown = 28 + this.rng() * 16;
            this.recordFactionEvent(`The main settlement marched to relieve ${targetColony.name} from ${aggressor.name}.`);
            return true;
        }

        resolveIntercolonyBattles() {
            for (const colony of this.getActiveBranchColonies()) {
                if ((colony.army?.recovery || 0) > 0 || colony.diplomacyState !== 'rival') {
                    continue;
                }
                const target = this.getIntercolonyTarget(colony);
                if (!target) {
                    continue;
                }
                const forcedTarget = colony.campaign?.state === 'active' && colony.campaign?.target === target.name;
                const existing = this.battlefronts.find((front) =>
                    !front.resolved &&
                    front.mode === 'intercolonial' &&
                    (
                        (front.colonyId === colony.id && front.defenderColonyId === target.id) ||
                        (front.colonyId === target.id && front.defenderColonyId === colony.id)
                    )
                );
                if (existing) {
                    continue;
                }
                const attackPower = this.getFactionAttackPower(colony);
                const defensePower = this.getFactionAttackPower(target) * 0.88 + (target.defense?.trainedDefenders || 0) * 1.8;
                const campaignPressure = colony.campaign?.state === 'active' ? colony.campaign.pressure || 0 : 0;
                const attackDrive =
                    colony.factionIdentity.militaryTendency * 0.3 +
                    colony.borderFriction * 0.24 +
                    campaignPressure * 0.28 +
                    (colony.army?.morale || 0.5) * 0.18 +
                    (colony.warMemory?.desireForRevenge || 0) * 0.16;
                const launchChance = forcedTarget ? 0.9 : 0.11 + attackDrive * 0.12;
                if ((attackDrive < 0.56 && !forcedTarget) || attackPower < Math.max(10, defensePower * 0.62) || this.rng() > launchChance) {
                    continue;
                }
                const battleScale = clamp(
                    0.24 +
                    campaignPressure * 0.34 +
                    Math.max(0, attackPower - defensePower) / 90,
                    0.22,
                    0.92
                );
                const strategy = colony.campaign?.strategy || this.getCampaignStrategy(colony);
                if (strategy === 'raid') {
                    continue;
                }
                const routeProfile = this.getRouteProfile(colony, target);
                const reportType = battleScale > 0.6 ? 'large battle' : 'skirmish';
                const front = this.battleManager.launchIntercolonialAttack(colony, target, {
                    reportType,
                    scale: strategy === 'total war'
                        ? Math.max(battleScale + routeProfile.roadBonus * 0.2, 0.58)
                        : strategy === 'defense in depth'
                        ? Math.min(battleScale, 0.52)
                        : clamp(battleScale + routeProfile.roadBonus * 0.16 - routeProfile.raidRisk * 0.1, 0.22, 0.92),
                    attackerHealth: Math.max(12, attackPower * (0.88 + battleScale * 0.18)),
                    defenderHealth: Math.max(10, defensePower * (0.9 + battleScale * 0.16)),
                    status: strategy === 'total war'
                        ? (routeProfile.onRoad ? 'road host' : 'war host')
                        : strategy === 'defense in depth'
                        ? 'screening force'
                        : reportType === 'large battle'
                        ? 'warband'
                        : 'raiders',
                    targetBuildingType: this.battleManager.getColonyStructureTarget(target)?.key || null
                });
                if (!front) {
                    continue;
                }
                colony.history.skirmishes += reportType === 'skirmish' ? 1 : 0;
                colony.history.campaigns += reportType === 'large battle' ? 1 : 0;
                colony.recentAction = strategy === 'total war' ? 'waging total war' : strategy === 'defense in depth' ? 'screening frontier' : 'attacking frontier colony';
                target.recentAction = strategy === 'total war' ? 'under total war' : 'under attack';
                target.campaign.state = 'active';
                target.campaign.strategy = 'defense in depth';
                target.campaign.pressure = clamp((target.campaign.pressure || 0) + 0.18, 0, 1);
                target.campaign.duration = Math.max(target.campaign.duration || 0, 28 + battleScale * 24);
                target.campaign.target = colony.name;
                this.recordFactionEvent(
                    strategy === 'total war'
                        ? `${colony.name} marched on ${target.name} under a total-war campaign.`
                        : strategy === 'defense in depth'
                        ? `${colony.name} tested ${target.name}'s frontier under a defense screen.`
                        : `${colony.name} marched on ${target.name} in a ${reportType}.`
                );
                colony.raidCooldown = 42 + this.rng() * 28;
            }
        }

        updateFactionDiplomacy(colony, dt) {
            const identity = colony.factionIdentity;
            const distanceToCamp = distance(colony, this.camp);
            const localRadius = this.getBranchTerritoryRadius(colony);
            const localResourceCount = this.resources.filter((resource) =>
                !resource.depleted && distance(resource, colony) < localRadius
            ).length;
            const overlapPressure = this.getActiveBranchColonies()
                .filter((peer) => peer.id !== colony.id)
                .reduce((sum, peer) => {
                    const gap = distance(colony, peer);
                    const overlap = Math.max(0, this.getBranchTerritoryRadius(peer) + localRadius - gap);
                    return sum + overlap;
                }, 0);
            const scarcity = clamp(
                1 - (((colony.food || 0) / 22) + ((colony.water || 0) / 20) + localResourceCount / 22) / 3,
                0,
                1
            );
            const envyPressure = clamp(((this.camp.food + this.camp.water * 1.1) - (colony.food + colony.water)) / 44, 0, 1);
            const borderPressure = clamp(
                overlapPressure / 120 + Math.max(0, (250 - distanceToCamp) / 240) + Math.max(0, (8 - localResourceCount) / 10),
                0,
                1
            );
            identity.fear = clamp(identity.fear + (this.predators.length > 2 ? 0.002 : -0.0004) * dt + scarcity * 0.0035 * dt, 0.05, 0.95);
            identity.trust = clamp(
                identity.trust +
                    (colony.history.trades > colony.history.raids ? 0.0014 : -0.001) * dt -
                    borderPressure * 0.0015 * dt,
                0.05,
                0.95
            );
            identity.envy = clamp(identity.envy + envyPressure * 0.0022 * dt + borderPressure * 0.001 * dt - (colony.history.trades * 0.0001), 0.05, 0.95);
            colony.borderFriction = clamp(
                colony.borderFriction * 0.94 +
                    borderPressure * 0.42 +
                    identity.envy * 0.24 +
                    identity.militaryTendency * 0.12 -
                    identity.tradeTendency * 0.16 -
                    identity.trust * 0.18,
                0,
                1
            );
            colony.defense = this.getFactionDefenseSummary(colony);
            const previousState = colony.diplomacyState || 'unknown';
            let nextState = previousState;
            const eraProfile = this.getEraDiplomacyProfile();
            const rivalThreshold = clamp((colony.type === 'daughter' ? 0.84 : 0.72) + eraProfile.rivalThresholdShift, 0.2, 0.96);
            const tradingThreshold = clamp((colony.type === 'daughter' ? 0.68 : 0.58) + eraProfile.tradingThresholdShift, 0.18, 0.9);
            const alliedThreshold = clamp((colony.type === 'daughter' ? 0.48 : 0.35) + eraProfile.alliedThresholdShift, 0.1, 0.85);
            if (colony.borderFriction > rivalThreshold || (scarcity > 0.72 && identity.militaryTendency > 0.6) || identity.envy > 0.88) {
                nextState = 'rival';
            } else if (identity.trust > 0.8 && colony.history.trades >= 4 && colony.borderFriction < alliedThreshold) {
                nextState = 'allied';
            } else if (identity.tradeTendency > 0.48 && identity.trust > 0.44 && colony.borderFriction < tradingThreshold) {
                nextState = 'trading';
            } else {
                nextState = 'cautious';
            }
            if (previousState === 'unknown' && (this.year >= 2 || colony.history.trades > 0 || colony.history.raids > 0)) {
                nextState = nextState === 'unknown' ? 'cautious' : nextState;
            }
            if ((previousState === 'allied' || previousState === 'trading') &&
                nextState !== previousState &&
                nextState === 'rival' &&
                colony.history.trades > 0) {
                colony.history.betrayals += 1;
                this.recordFactionEvent(`${colony.name} broke trust and turned rival at the border.`);
            } else if (previousState !== 'allied' && nextState === 'allied') {
                colony.history.alliances += 1;
                this.recordFactionEvent(`${colony.name} entered an alliance with the main settlement.`);
            } else if (previousState !== nextState && colony.diplomacyCooldown <= 0) {
                this.recordFactionEvent(`${colony.name} shifted from ${previousState} to ${nextState}.`);
            }
            colony.diplomacyState = nextState;
            colony.diplomacyCooldown = nextState === previousState ? colony.diplomacyCooldown : 18 + this.rng() * 18;
            if (colony.borderFriction > 0.58 && this.rng() < 0.008 * dt) {
                const note = `${colony.name} pressed against the colony border over nearby resources.`;
                this.recordBorderIncident(note);
                colony.recentAction = 'border friction';
            }
        }

        updateFactionCampaign(colony, dt) {
            const campaign = colony.campaign || (colony.campaign = { state: 'idle', pressure: 0, duration: 0, target: 'camp', strategy: 'watchful' });
            const eraProfile = this.getEraDiplomacyProfile();
            campaign.strategy = this.getCampaignStrategy(colony);
            if (campaign.state === 'active') {
                const strategy = campaign.strategy || 'watchful';
                const targetColony = this.getBranchColonyByName(campaign.target);
                campaign.duration = Math.max(0, campaign.duration - dt);
                const pressureDelta = strategy === 'total war'
                    ? colony.borderFriction * 0.008 + colony.factionIdentity.militaryTendency * 0.006 + (colony.warMemory?.desireForRevenge || 0) * 0.004
                    : strategy === 'defense in depth'
                    ? colony.borderFriction * 0.004 + (targetColony ? 0.002 : 0) - colony.factionIdentity.trust * 0.004
                    : strategy === 'raid'
                    ? colony.borderFriction * 0.007 + colony.factionIdentity.envy * 0.005 + (1 - clamp(((colony.food || 0) + (colony.water || 0)) / 36, 0, 1)) * 0.005
                    : colony.borderFriction * 0.006 + colony.factionIdentity.militaryTendency * 0.004 - colony.factionIdentity.trust * 0.003;
                campaign.pressure = clamp(campaign.pressure * (strategy === 'total war' ? 0.998 : 0.996) + pressureDelta, 0, 1);
                colony.recentAction =
                    strategy === 'total war' ? `waging ${this.getEraWarfareMethod('total war')}` :
                    strategy === 'defense in depth' ? `holding ${this.getEraWarfareMethod('defense in depth')}` :
                    strategy === 'raid' ? `planning ${this.getEraWarfareMethod('raid')}` :
                    colony.diplomacyState === 'allied' ? this.getEraWarfareMethod('support campaign') :
                    strategy === 'punitive strike' ? this.getEraWarfareMethod('punitive strike') :
                    'campaigning';
                if (colony.diplomacyState === 'allied' && colony.supportCooldown <= 0 && this.camp.food < 26) {
                    this.resolveFactionCampaignSupport(colony);
                } else if (colony.diplomacyState === 'allied' && colony.supportCooldown <= 0 && this.getRegionalConflictPressure() > Math.max(0.34, 0.55 - eraProfile.supportBias * 0.5)) {
                    this.resolveFactionCampaignSupport(colony);
                }
                if (strategy === 'defense in depth') {
                    colony.army.morale = clamp((colony.army?.morale || 0.5) + dt * 0.0008, 0.12, 1);
                    colony.army.recovery = Math.max(0, (colony.army?.recovery || 0) - dt * 0.25);
                    if (colony.structures) {
                        const weakPoint = Object.entries(colony.structures)
                            .map(([key, value]) => ({ key, ...value }))
                            .sort((left, right) => left.integrity - right.integrity)[0];
                        if (weakPoint && weakPoint.integrity < 0.96) {
                            colony.structures[weakPoint.key].integrity = clamp(weakPoint.integrity + dt * 0.005, 0, 1);
                        }
                    }
                }
                if (colony.diplomacyState === 'rival' && colony.raidCooldown > 8 && campaign.pressure > (strategy === 'total war' ? 0.56 : strategy === 'raid' ? 0.48 : 0.68) && this.rng() < (strategy === 'total war' ? 0.006 : strategy === 'raid' ? 0.005 : 0.004) * dt) {
                    const exposed = this.buildings
                        .filter((building) => ['leanTo', 'hut', 'storage', 'storagePit', 'granary', 'watchtower', 'wall', 'cottage'].includes(building.type))
                        .sort((left, right) => this.getBuildingIntegrityRatio(left) - this.getBuildingIntegrityRatio(right))[0];
                    if (exposed) {
                        const strikeDamage = strategy === 'punitive strike'
                            ? 0.55 + campaign.pressure * 0.55
                            : strategy === 'raid'
                            ? 0.35 + campaign.pressure * 0.34
                            : 0.8 + campaign.pressure * 0.8;
                        exposed.integrity = clamp(exposed.integrity - strikeDamage, 0, exposed.maxIntegrity);
                        this.startRepairProject(exposed);
                        this.recordFactionEvent(
                            strategy === 'raid'
                                ? `${colony.name} probed the frontier with a fast raid against the ${exposed.type}.`
                                :
                            strategy === 'punitive strike'
                                ? `${colony.name} launched a punitive strike against the ${exposed.type}.`
                                : `${colony.name}'s border campaign wore down the ${exposed.type}.`
                        );
                    }
                }
                if (strategy === 'total war' && targetColony) {
                    targetColony.campaign.state = 'active';
                    targetColony.campaign.strategy = 'defense in depth';
                    targetColony.campaign.target = colony.name;
                    targetColony.campaign.pressure = clamp((targetColony.campaign.pressure || 0) + dt * 0.006, 0, 1);
                    targetColony.campaign.duration = Math.max(targetColony.campaign.duration || 0, 24 + campaign.pressure * 36);
                }
                if (campaign.duration <= 0 || campaign.pressure < 0.22 || colony.diplomacyState === 'allied') {
                    if (campaign.state === 'active') {
                        this.recordFactionEvent(`${colony.name}'s ${campaign.strategy || (colony.diplomacyState === 'allied' ? 'support campaign' : 'pressure campaign')} eased off.`);
                    }
                    campaign.state = 'idle';
                    campaign.pressure = clamp(campaign.pressure * 0.55, 0, 1);
                    campaign.duration = 0;
                    campaign.strategy = this.getCampaignStrategy(colony);
                }
                return;
            }

            const entrenchedRival =
                colony.diplomacyState === 'rival' &&
                colony.borderFriction > 0.78 &&
                colony.factionIdentity.militaryTendency > 0.62 &&
                (colony.history.raids + colony.history.skirmishes >= 2 || this.year >= 2);
            if (
                entrenchedRival &&
                (
                    colony.history.raids + colony.history.skirmishes >= 3 ||
                    this.rng() < 0.0035 * dt
                )
            ) {
                campaign.state = 'active';
                campaign.target = this.getIntercolonyTarget(colony)?.name || 'camp';
                campaign.pressure = clamp(
                    0.42 + colony.borderFriction * 0.35 + colony.factionIdentity.envy * 0.15,
                    0,
                    1
                );
                campaign.strategy = this.getCampaignStrategy(colony);
                campaign.duration =
                    campaign.strategy === 'total war' ? 110 + this.rng() * 70 :
                    campaign.strategy === 'defense in depth' ? 88 + this.rng() * 46 :
                    campaign.strategy === 'raid' ? 52 + this.rng() * 34 :
                    70 + this.rng() * 50;
                colony.history.campaigns += 1;
                colony.recentAction =
                    campaign.strategy === 'total war' ? `waging ${this.getEraWarfareMethod('total war')}` :
                    campaign.strategy === 'defense in depth' ? `holding ${this.getEraWarfareMethod('defense in depth')}` :
                    campaign.strategy === 'raid' ? `planning ${this.getEraWarfareMethod('raid')}` :
                    this.getEraWarfareMethod('punitive strike');
                this.recordFactionEvent(
                    campaign.strategy === 'total war'
                        ? `${colony.name} escalated the frontier into ${this.getEraWarfareMethod('total war')} against ${campaign.target}.`
                        : campaign.strategy === 'defense in depth'
                        ? `${colony.name} fell back into ${this.getEraWarfareMethod('defense in depth')}.`
                        : campaign.strategy === 'raid'
                        ? `${colony.name} shifted into ${this.getEraWarfareMethod('raid')} against ${campaign.target}.`
                        : `${colony.name} began ${this.getEraWarfareMethod('punitive strike')} against ${campaign.target}.`
                );
            } else if (
                colony.diplomacyState === 'allied' &&
                this.getRegionalConflictPressure() > Math.max(0.28, 0.5 - eraProfile.supportBias * 0.45) &&
                colony.factionIdentity.trust > 0.62 &&
                (
                    (this.getRegionalConflictPressure() > Math.max(0.46, 0.72 - eraProfile.supportBias * 0.55) && this.camp.food < 20 && colony.factionIdentity.tradeTendency > 0.64) ||
                    this.rng() < (0.003 + eraProfile.supportBias * 0.0015) * dt
                )
            ) {
                campaign.state = 'active';
                campaign.target = this.getPrimaryThreatSource(colony)?.name || 'camp';
                campaign.pressure = clamp(0.3 + colony.factionIdentity.tradeTendency * 0.2 + colony.factionIdentity.trust * 0.15, 0, 1);
                campaign.duration = 56 + this.rng() * 36;
                campaign.strategy = 'support campaign';
                colony.history.campaigns += 1;
                colony.recentAction = this.getEraWarfareMethod('support campaign');
                this.recordFactionEvent(`${colony.name} committed to ${this.getEraWarfareMethod('support campaign')}.`);
            }
        }

        resolveFactionCampaignSupport(colony) {
            let supported = false;
            const project = this.projects.find((entry) => ['wall', 'warehouse', 'fortifiedStructure', 'house', 'foodHall'].includes(entry.type));
            const canSendStone = colony.stone > 8 && this.camp.stone < 18;
            const canSendWood = colony.wood > 8 && this.camp.wood < 18;
            if (project && canSendStone) {
                    const amount = Math.min(3, colony.stone - 6);
                    colony.stone -= amount;
                    this.camp.stone = clamp(this.camp.stone + amount, 0, 999);
                    this.recordFactionEvent(`${colony.name} sent stone to reinforce frontier construction.`);
                    this.spawnFactionParty(colony, 'aid', 'toCamp', {
                        strength: 1.3,
                        status: 'stone convoy',
                        effectLabel: 'Stone'
                    });
                    supported = true;
            } else if (project && canSendWood) {
                    const amount = Math.min(3, colony.wood - 6);
                    colony.wood -= amount;
                    this.camp.wood = clamp(this.camp.wood + amount, 0, 999);
                    this.recordFactionEvent(`${colony.name} sent timber to reinforce frontier construction.`);
                    this.spawnFactionParty(colony, 'aid', 'toCamp', {
                        strength: 1.3,
                        status: 'timber convoy',
                        effectLabel: 'Timber'
                    });
                    supported = true;
            }
            if (!supported && this.camp.food < 26) {
                const support = Math.min(3, Math.max(1, colony.food - 10));
                if (support > 0) {
                    colony.food -= support;
                    this.camp.food = clamp(this.camp.food + support, 0, 999);
                    this.recordFactionEvent(`${colony.name} reinforced the frontier with a campaign relief caravan.`);
                    this.spawnFactionParty(colony, 'aid', 'toCamp', {
                        strength: 1.4,
                        status: 'support convoy',
                        effectLabel: 'Support'
                    });
                    supported = true;
                }
            }
            if (!supported && this.hasTechnology('engineering') && this.getCampMaterial('planks') < 5 && colony.wood > 10) {
                const amount = Math.min(2, Math.max(1, Math.floor((colony.wood - 6) / 2)));
                colony.wood -= amount * 2;
                this.addCampMaterial('planks', amount);
                this.recordFactionEvent(`${colony.name} sent worked planks through its support campaign.`);
                this.spawnFactionParty(colony, 'aid', 'toCamp', {
                    strength: 1.2,
                    status: 'plank convoy',
                    effectLabel: 'Planks'
                });
                supported = true;
            }
            if (supported) {
                colony.supportCooldown = this.getColonySupportCooldownDuration(colony, 22, colony.type === 'daughter' ? 64 : 44);
            }
        }

        getFactionDefenseSummary(colony) {
            const population = colony.population || 2;
            const army = colony.army || { available: Math.max(1, Math.round(population * 0.5)), veterans: 0, morale: 0.5 };
            const militia = Math.max(1, Math.round(Math.min(population, army.available) * (0.62 + army.morale * 0.28)));
            const huntersPressed = Math.max(0, Math.round(population * 0.12 + colony.factionIdentity.fear * 1.2 + army.veterans * 0.18));
            const trainedDefenders = Math.max(0, Math.round(
                (this.hasTechnology('militaryOrganization') ? 1 : 0) +
                colony.factionIdentity.militaryTendency * 2 +
                army.veterans * 0.34 +
                army.morale * 1.2 +
                colony.history.raids * 0.25 +
                (colony.type === 'splinter' ? 1 : 0)
            ));
            return {
                militia,
                huntersPressed,
                trainedDefenders
            };
        }

        getFactionAttackPower(colony) {
            const defense = colony.defense || this.getFactionDefenseSummary(colony);
            const escalation = this.phase9?.pressure?.enemyTechEscalation || 0;
            const stateMultiplier = colony.diplomacyState === 'rival' ? 1 + escalation * 0.28 : 1 + escalation * 0.12;
            const army = colony.army || { morale: 0.5, veterans: 0 };
            const commander = army.commander || { aggression: 0.5, discipline: 0.5 };
            const commanderFactor = 0.9 + commander.aggression * 0.16 + commander.discipline * 0.1;
            return (defense.militia * 1 + defense.huntersPressed * 1.25 + defense.trainedDefenders * 1.8) * stateMultiplier * commanderFactor * (0.86 + army.morale * 0.28);
        }

        resolveFactionTrade(colony) {
            const state = colony.diplomacyState || 'unknown';
            if (!['cautious', 'trading', 'allied'].includes(state)) {
                return;
            }
            let traded = false;
            const strategicProject = this.projects.find((project) =>
                ['wall', 'warehouse', 'fortifiedStructure', 'house', 'foodHall', 'mill', 'granary'].includes(project.type)
            );
            const cooperativePush = colony.type === 'daughter' && state !== 'cautious';
            const strategicNeed = Boolean(
                strategicProject ||
                (cooperativePush && this.hasTechnology('engineering') && (
                    this.camp.stone < 16 ||
                    this.getCampMaterial('planks') < 6 ||
                    this.getCampMaterial('rope') < 3
                ))
            );
            const canSendStone = strategicNeed && colony.stone > 8 && this.camp.stone < 20;
            const canSendWood = strategicNeed && colony.wood > 8 && this.camp.wood < 20;
            const canSendPlanks = strategicNeed && this.hasTechnology('engineering') && colony.wood > 10 && this.getCampMaterial('planks') < 10;
            const canSendRope = strategicNeed && this.hasTechnology('engineering') && colony.wood > 8 && this.getCampMaterial('rope') < 5;
            const canSendKnowledge = cooperativePush && (state === 'allied' || colony.history.trades >= 2);
            if (state !== 'cautious' && canSendStone) {
                const amount = Math.min(3, colony.stone - 6);
                colony.stone -= amount;
                this.camp.stone = clamp(this.camp.stone + amount, 0, 999);
                this.recordFactionEvent(`${colony.name} traded stone for frontier building work.`);
                this.spawnFactionParty(colony, 'trade', 'toCamp', {
                    strength: 1.4,
                    status: 'stone caravan',
                    effectLabel: 'Stone'
                });
                traded = true;
            } else if (state !== 'cautious' && canSendWood) {
                const amount = Math.min(3, colony.wood - 6);
                colony.wood -= amount;
                this.camp.wood = clamp(this.camp.wood + amount, 0, 999);
                this.recordFactionEvent(`${colony.name} traded timber for frontier building work.`);
                this.spawnFactionParty(colony, 'trade', 'toCamp', {
                    strength: 1.4,
                    status: 'timber caravan',
                    effectLabel: 'Timber'
                });
                traded = true;
            } else if (state !== 'cautious' && canSendPlanks) {
                const amount = Math.min(3, Math.max(1, Math.floor((colony.wood - 6) / 2)));
                colony.wood -= amount * 2;
                this.addCampMaterial('planks', amount);
                this.recordFactionEvent(`${colony.name} traded worked planks to support larger buildings.`);
                this.spawnFactionParty(colony, 'trade', 'toCamp', {
                    strength: 1.3,
                    status: 'plank caravan',
                    effectLabel: 'Planks'
                });
                traded = true;
            } else if (state !== 'cautious' && canSendRope) {
                const amount = Math.min(2, Math.max(1, Math.floor((colony.wood - 5) / 3)));
                colony.wood -= amount * 1.5;
                this.addCampMaterial('rope', amount);
                this.recordFactionEvent(`${colony.name} traded rope to strengthen advanced construction.`);
                this.spawnFactionParty(colony, 'trade', 'toCamp', {
                    strength: 1.1,
                    status: 'rope caravan',
                    effectLabel: 'Rope'
                });
                traded = true;
            } else if (canSendKnowledge && this.hasTechnology('engineering') && this.getSettlementKnowledgeBonus('civic') < 2.8) {
                const settlement = this.lineageMemory.settlementKnowledge || {};
                settlement.storageTier = Math.max(settlement.storageTier || 0, 1);
                settlement.civicTier = Math.max(settlement.civicTier || 0, 2);
                settlement.housingTier = Math.max(settlement.housingTier || 0, 1);
                this.recordFactionEvent(`${colony.name} shared advanced settlement methods with the main colony.`);
                this.spawnFactionParty(colony, 'knowledge', 'toCamp', {
                    strength: 1.1,
                    status: 'builders',
                    effectLabel: 'Methods'
                });
                traded = true;
            } else if (colony.food > 18 && this.camp.food < 28) {
                const amount = Math.min(4, colony.food - 14);
                colony.food -= amount;
                this.camp.food = clamp(this.camp.food + amount, 0, 999);
                this.recordFactionEvent(`${colony.name} traded food into the main stores.`);
                this.spawnFactionParty(colony, 'trade', 'toCamp', {
                    strength: Math.max(1, amount / 2),
                    status: 'food caravan',
                    effectLabel: 'Trade'
                });
                traded = true;
            } else if (colony.water > 16 && this.camp.water < 12) {
                const amount = Math.min(4, colony.water - 12);
                colony.water -= amount;
                this.camp.water = clamp(this.camp.water + amount, 0, 999);
                this.recordFactionEvent(`${colony.name} sent water from its outer wells.`);
                this.spawnFactionParty(colony, 'aid', 'toCamp', {
                    strength: Math.max(1, amount / 2),
                    status: 'water caravan',
                    effectLabel: 'Aid'
                });
                traded = true;
            } else if (this.camp.food > 40 && colony.food < 8) {
                const amount = Math.min(3, this.camp.food - 34);
                this.camp.food -= amount;
                colony.food += amount;
                this.recordFactionEvent(`The main camp sent food to ${colony.name}.`);
                this.spawnFactionParty(colony, 'trade', 'fromCamp', {
                    strength: Math.max(1, amount / 2),
                    status: 'relief caravan',
                    effectLabel: 'Relief',
                    targetKind: 'colony'
                });
                traded = true;
            } else if (this.hasTechnology('toolmaking') && this.countCampItems('stoneTool') < 2 && colony.wood > 7 && colony.stone > 5) {
                colony.wood -= 2;
                colony.stone -= 2;
                this.camp.items.push(createItem(this.nextItemId++, 'stoneTool', 1 + colony.factionIdentity.tradeTendency * 2));
                this.recordFactionEvent(`${colony.name} traded a stone tool to the main settlement.`);
                this.spawnFactionParty(colony, 'trade', 'toCamp', {
                    strength: 1.2,
                    status: 'tool caravan',
                    effectLabel: 'Tools'
                });
                traded = true;
            } else if (this.hasTechnology('medicineLore') && colony.factionIdentity.tradeTendency > 0.4) {
                const injured = this.colonists
                    .filter((colonist) => colonist.alive && colonist.stats.health < 82)
                    .sort((left, right) => left.stats.health - right.stats.health)
                    .slice(0, 2);
                if (injured.length > 0) {
                    for (const colonist of injured) {
                        colonist.stats.health = clamp(colonist.stats.health + 6, 0, 100);
                        colonist.stats.warmth = clamp(colonist.stats.warmth + 3, 0, 100);
                    }
                    this.recordFactionEvent(`${colony.name} shared medicine lore and treated the wounded.`);
                    this.spawnFactionParty(colony, 'aid', 'toCamp', {
                        strength: 1.1,
                        status: 'healers',
                        effectLabel: 'Healing'
                    });
                    traded = true;
                }
            }
            if (traded) {
                colony.history.trades += 1;
                colony.recentAction = 'trading';
                colony.factionIdentity.trust = clamp(colony.factionIdentity.trust + 0.08, 0.05, 0.95);
                colony.factionIdentity.envy = clamp(colony.factionIdentity.envy - 0.05, 0.05, 0.95);
                if (state === 'allied' || state === 'trading') {
                    const settlement = this.lineageMemory.settlementKnowledge || {};
                    settlement.storageTier = Math.max(settlement.storageTier || 0, this.countBuildings('granary') > 0 ? 2 : 1);
                    settlement.civicTier = Math.max(settlement.civicTier || 0, this.hasTechnology('engineering') ? 2 : 1);
                    if (strategicProject) {
                        settlement.housingTier = Math.max(settlement.housingTier || 0, strategicProject.type === 'house' ? 2 : 1);
                        settlement.defenseTier = Math.max(settlement.defenseTier || 0, ['wall', 'fortifiedStructure'].includes(strategicProject.type) ? 2 : settlement.defenseTier || 0);
                    }
                }
                colony.tradeCooldown = cooperativePush ? 24 + this.rng() * 18 : 42 + this.rng() * 28;
            }
        }

        resolveFactionKnowledgeExchange(colony) {
            const state = colony.diplomacyState || 'unknown';
            if (!['trading', 'allied', 'cautious'].includes(state)) {
                return;
            }
            const sharedWater = this.colonyKnowledge.resources.water[0];
            const sharedDanger = this.colonyKnowledge.dangerZones[0];
            if (sharedWater) {
                colony.lastSharedKnowledge = { type: 'water', x: sharedWater.x, y: sharedWater.y };
            }
            if (state !== 'cautious' || colony.factionIdentity.tradeTendency > 0.6) {
                if (!this.colonyKnowledge.discoveries.includes('shared_trade_routes')) {
                    this.colonyKnowledge.discoveries.push('shared_trade_routes');
                }
                if (sharedDanger) {
                    this.lineageMemory.dangerZones.push({ x: sharedDanger.x, y: sharedDanger.y, cause: sharedDanger.cause || 'rival colony' });
                }
                const settlement = this.lineageMemory.settlementKnowledge || {};
                if (colony.type === 'daughter') {
                    settlement.storageTier = Math.max(settlement.storageTier || 0, 1);
                    settlement.civicTier = Math.max(settlement.civicTier || 0, 1);
                }
                if (this.hasTechnology('engineering') && colony.diplomacyState === 'allied') {
                    settlement.housingTier = Math.max(settlement.housingTier || 0, 1);
                    if (!this.colonyKnowledge.discoveries.includes('shared_settlement_methods')) {
                        this.colonyKnowledge.discoveries.push('shared_settlement_methods');
                    }
                }
            }
            colony.history.knowledgeTrades += 1;
            colony.recentAction = 'sharing knowledge';
            this.spawnFactionParty(colony, 'knowledge', 'toCamp', {
                strength: 1,
                status: 'messengers',
                effectLabel: 'Knowledge'
            });
            colony.infoCooldown = 65 + this.rng() * 35;
        }

        resolveFactionRaid(colony) {
            if (colony.diplomacyState !== 'rival') {
                return;
            }
            const army = colony.army || this.normalizeBranchColony(colony, colony.id - 1).army;
            if ((army.recovery || 0) > 0 || (army.available || 0) < 1.5) {
                return;
            }
            const campaignPressure = colony.campaign?.state === 'active' ? colony.campaign.pressure || 0 : 0;
            const strategy = colony.campaign?.strategy || this.getCampaignStrategy(colony);
            const warfareMethod = this.getEraWarfareMethod(strategy);
            const routeProfile = this.getRouteProfile(colony, this.camp);
            const scarcity = clamp(1 - ((colony.food / 16) + (colony.water / 14)) / 2, 0, 1);
            const attackDrive =
                scarcity * 0.42 +
                colony.factionIdentity.militaryTendency * 0.35 +
                colony.factionIdentity.envy * 0.28 +
                colony.borderFriction * 0.25 +
                campaignPressure * 0.3 +
                army.morale * 0.18 +
                routeProfile.roadBonus * 0.2 -
                routeProfile.raidRisk * 0.14 +
                (strategy === 'raid' ? 0.08 : 0) +
                (colony.warMemory?.desireForRevenge || 0) * 0.2;
            if (attackDrive < 0.64 || this.rng() > 0.18 + attackDrive * 0.18) {
                return;
            }
            const vulnerable = this.buildings
                .filter((building) => ['storage', 'storagePit', 'granary', 'warehouse', 'leanTo', 'hut', 'cottage', 'kitchen', 'foodHall', 'campfire'].includes(building.type))
                .sort((left, right) => this.getBuildingIntegrityRatio(left) - this.getBuildingIntegrityRatio(right))[0];
            if (!vulnerable) {
                return;
            }
            const attackPower = this.getFactionAttackPower(colony);
            const defensePower = this.getCampDefensePower() + (this.hasProtectColonyBubble() ? 12 : 0);
            const skirmish = attackPower > defensePower * 0.72;
            const battleScale = clamp(
                (this.phase9?.pressure?.largeScaleBattles || 0) * 0.7 +
                campaignPressure * 0.4 +
                routeProfile.roadBonus * 0.16 -
                routeProfile.raidRisk * 0.08 +
                ((this.phase9?.pressure?.enemyTechEscalation || 0) * 0.25),
                0,
                1
            );
            if (skirmish) {
                colony.history.skirmishes += 1;
                const defenders = this.colonists
                    .filter((colonist) => colonist.alive && colonist.lifeStage !== 'child')
                    .sort((left, right) => right.skills.combat - left.skills.combat)
                    .slice(0, Math.max(1, Math.min(4, Math.round(colony.population / 2 + battleScale * 2))));
                for (const colonist of defenders) {
                    colonist.stats.health = clamp(colonist.stats.health - (attackPower > defensePower ? 7 + battleScale * 6 : 4 + battleScale * 3), 0, 100);
                    colonist.state = attackPower > defensePower ? 'hurt' : colonist.state;
                }
                this.recordFactionEvent(`${colony.name} clashed with the main settlement in a border skirmish.`);
            }
            if (attackPower > defensePower) {
                this.applyBuildingDamage(vulnerable, 2.4 + battleScale * 1.8);
                const foodLoss = Math.min(9, Math.max(2, colony.population + battleScale * 3));
                const woodLoss = Math.min(5, Math.max(1, colony.population * 0.5 + battleScale * 2));
                this.camp.food = Math.max(0, this.camp.food - foodLoss);
                this.camp.wood = Math.max(0, this.camp.wood - woodLoss);
                colony.food = clamp(colony.food + foodLoss * 0.7, 0, 140);
                colony.wood = clamp(colony.wood + woodLoss * 0.7, 0, 80);
                colony.history.raids += 1;
                colony.recentAction = 'raiding';
                if (battleScale > 0.52) {
                    const extraTargets = this.buildings
                        .filter((building) => building !== vulnerable && ['storage', 'storagePit', 'granary', 'warehouse', 'leanTo', 'hut', 'cottage', 'kitchen', 'foodHall', 'campfire', 'wall', 'watchtower'].includes(building.type))
                        .sort((left, right) => this.getBuildingIntegrityRatio(left) - this.getBuildingIntegrityRatio(right))
                        .slice(0, 2);
                    for (const target of extraTargets) {
                        this.applyBuildingDamage(target, 1 + battleScale * 1.2);
                        this.startRepairProject(target);
                    }
                    this.recordFactionEvent(`${colony.name} escalated the frontier fighting into a larger battle.`);
                    colony.history.campaigns += 1;
                    if (this.colonists.length > 5 && this.rng() < 0.35) {
                        colony.history.refugees += 1;
                        this.recordFactionEvent(`Families fled inward after the larger battle with ${colony.name}.`);
                    }
                }
                if (campaignPressure > 0.48) {
                    colony.campaign.pressure = clamp(campaignPressure + 0.06, 0, 1);
                }
                this.spawnFactionParty(colony, 'raid', 'toCamp', {
                    strength: Math.max(1.5, colony.population * (0.35 + campaignPressure * 0.18 + battleScale * 0.18)),
                    status: strategy === 'raid' ? warfareMethod : battleScale > 0.52 ? this.getEraWarfareMethod('total war') : warfareMethod,
                    effectLabel: strategy === 'raid' ? 'Raid' : battleScale > 0.52 ? 'Battle' : 'Raid',
                    target: vulnerable,
                    targetKind: 'building'
                });
                if (skirmish || battleScale > 0.35) {
                    this.spawnBattlefront(colony, {
                        target: vulnerable,
                        targetBuildingId: vulnerable.id,
                        targetBuildingType: vulnerable.type,
                        reportType: battleScale > 0.52 ? 'large battle' : skirmish ? 'skirmish' : 'battle',
                        initialDefenderCount: this.colonists.filter((colonist) =>
                            colonist.alive &&
                            colonist.lifeStage !== 'child' &&
                            distance(colonist, vulnerable) < 90
                        ).length,
                        scale: Math.max(0.28, battleScale),
                        attackerHealth: attackPower * (1.8 + battleScale),
                        defenderHealth: Math.max(8, defensePower * (2 + battleScale * 0.6)),
                        strength: Math.max(2, colony.population * (0.45 + battleScale * 0.3))
                    });
                }
                this.lastRaid = {
                    by: colony.name,
                    target: vulnerable.type,
                    day: this.day,
                    year: this.year
                };
                if (this.rng() < 0.26 && this.colonists.length > 4) {
                    colony.history.prisoners += 1;
                    this.recordFactionEvent(`${colony.name} carried off a prisoner after the raid on the ${vulnerable.type}.`);
                }
                this.recordFactionEvent(
                    strategy === 'raid'
                        ? `${colony.name} launched ${warfareMethod} against the ${vulnerable.type} and stole supplies.`
                        : `${colony.name} struck the ${vulnerable.type} with ${warfareMethod} and stole supplies.`
                );
                this.recordBattleReport({
                    type: battleScale > 0.52 ? 'large battle' : 'raid',
                    colonyName: colony.name,
                    outcome: 'attackers hit stores',
                    attackerStrength: Number(attackPower.toFixed(1)),
                    defenderStrength: Number(defensePower.toFixed(1)),
                    targetBuildingType: vulnerable.type,
                    tactic: strategy,
                    warfareMethod,
                    routeQuality: Number(routeProfile.quality.toFixed(2)),
                    damagedBuildings: 1 + (battleScale > 0.52 ? Math.min(2, this.buildings.filter((building) => this.getBuildingIntegrityRatio(building) < 1).length - 1) : 0),
                    foodLoss: Number(foodLoss.toFixed(1)),
                    woodLoss: Number(woodLoss.toFixed(1)),
                    prisoners: colony.history.prisoners || 0,
                    refugees: colony.history.refugees || 0
                });
                this.applyFactionWarAftermath(colony, 'victory', battleScale, {
                    enemy: 'main settlement',
                    targetBuildingType: vulnerable.type
                });
                this.startRepairProject(vulnerable);
            } else {
                colony.factionIdentity.fear = clamp(colony.factionIdentity.fear + 0.06, 0.05, 0.95);
                colony.factionIdentity.trust = clamp(colony.factionIdentity.trust - 0.04, 0.05, 0.95);
                colony.recentAction = 'repelled';
                if (campaignPressure > 0.25) {
                    colony.campaign.pressure = clamp(campaignPressure - 0.08, 0, 1);
                }
                this.recordFactionEvent(`The main settlement repelled raiders from ${colony.name}.`);
                this.recordBattleReport({
                    type: battleScale > 0.52 ? 'large battle' : 'raid',
                    colonyName: colony.name,
                    outcome: 'defenders repelled attackers',
                    attackerStrength: Number(attackPower.toFixed(1)),
                    defenderStrength: Number(defensePower.toFixed(1)),
                    targetBuildingType: vulnerable.type,
                    tactic: strategy,
                    warfareMethod,
                    routeQuality: Number(routeProfile.quality.toFixed(2)),
                    damagedBuildings: 0,
                    foodLoss: 0,
                    woodLoss: 0,
                    prisoners: colony.history.prisoners || 0,
                    refugees: colony.history.refugees || 0
                });
                this.applyFactionWarAftermath(colony, 'defeat', battleScale, {
                    enemy: 'main settlement',
                    targetBuildingType: vulnerable.type
                });
            }
            colony.raidCooldown = 56 + this.rng() * 36;
        }

        resolveMainColonyOffense() {
            const rivals = this.getActiveBranchColonies()
                .filter((colony) => colony.diplomacyState === 'rival')
                .sort((left, right) => (
                    (right.borderFriction + (right.campaign?.pressure || 0) + (right.factionIdentity?.envy || 0)) -
                    (left.borderFriction + (left.campaign?.pressure || 0) + (left.factionIdentity?.envy || 0))
                ));
            const target = rivals[0] || null;
            if (!target) {
                return false;
            }
            const offense = this.getMainColonyAttackSummary();
            const stability = this.getColonyStability();
            const defenseReserve = this.getCampDefenseSummary().militia;
            if (offense.attackers.length < 2 || stability < 0.42 || defenseReserve < 2) {
                return false;
            }

            const targetDefense = this.getFactionAttackPower(target) * 0.82 + (target.defense?.trainedDefenders || 0) * 2;
            const attackPower = offense.power;
            const battleScale = clamp(
                (this.phase9?.pressure?.largeScaleBattles || 0) * 0.65 +
                (target.campaign?.pressure || 0) * 0.3 +
                Math.max(0, attackPower - targetDefense) / 80,
                0.18,
                1
            );
            const launchChance =
                0.42 +
                clamp((attackPower - targetDefense) / 105, -0.1, 0.24) +
                clamp((target.borderFriction || 0) * 0.12 + (target.campaign?.pressure || 0) * 0.16, 0, 0.18);
            if (this.rng() > launchChance) {
                this.mainAttackCooldown = 10 + this.rng() * 10;
                return false;
            }

            const reportType = battleScale > 0.58 ? 'large battle' : 'skirmish';
            const committed = offense.attackers
                .slice(0, Math.max(2, Math.min(reportType === 'large battle' ? 7 : 4, Math.round(2 + battleScale * 5))))
                .map((colonist, index) => {
                    colonist.assignedBattlefrontId = `pending-main-attack-${target.id}`;
                    colonist.battleFormationIndex = index;
                    colonist.battleRole = index < 2 ? 'frontline' : index < 4 ? 'support' : 'reserve';
                    colonist.battleOrderTtl = 36 + battleScale * 18;
                    colonist.intent = 'war';
                    colonist.state = 'moving';
                    return colonist;
                });
            const commanderColonist = committed
                .slice()
                .sort((left, right) => (right.skills.combat + right.combatPower * 0.08) - (left.skills.combat + left.combatPower * 0.08))[0] || committed[0];

            const front = this.battleManager.launchMainColonyAttack(target, committed, {
                reportType,
                scale: battleScale,
                attackerHealth: Math.max(16, attackPower * (1.05 + battleScale * 0.22)),
                defenderHealth: Math.max(14, targetDefense * (1 + battleScale * 0.18)),
                commander: commanderColonist ? {
                    name: commanderColonist.name,
                    style: commanderColonist.skills.combat > 8 ? 'aggressive' : 'balanced',
                    aggression: clamp(0.4 + commanderColonist.traits.aggression * 0.45 + commanderColonist.skills.combat * 0.04, 0.1, 1),
                    discipline: clamp(0.4 + commanderColonist.traits.endurance * 0.2 + commanderColonist.skills.combat * 0.05, 0.1, 1),
                    caution: clamp(0.18 + commanderColonist.traits.caution * 0.52, 0.05, 1)
                } : null
            });
            if (!front) {
                for (const colonist of committed) {
                    colonist.assignedBattlefrontId = null;
                    colonist.battleRole = null;
                    colonist.battleFormationIndex = -1;
                    colonist.battleOrderTtl = 0;
                }
                return false;
            }

            for (const colonist of committed) {
                colonist.assignedBattlefrontId = front.id;
            }
            target.history.skirmishes += reportType === 'skirmish' ? 1 : 0;
            target.history.campaigns += reportType === 'large battle' ? 1 : 0;
            target.recentAction = 'under attack';
            this.recordFactionEvent(`The main settlement marched on ${target.name} in a ${reportType}.`);
            this.mainAttackCooldown = 34 + this.rng() * 20;
            return true;
        }

        resolveFactionMigration(colony, dt) {
            const desperate = (colony.food < 4 || colony.water < 4);
            const welcoming = ['allied', 'trading'].includes(colony.diplomacyState) && this.camp.food > 18 && this.getHousingSatisfaction() > 0.72;
            if (desperate && welcoming && this.rng() < 0.0015 * dt) {
                colony.population = Math.max(2, colony.population - 1);
                colony.history.refugees += 1;
                this.recordFactionEvent(`A refugee from ${colony.name} reached the main settlement.`);
                this.spawnFactionParty(colony, 'refugee', 'toCamp', {
                    strength: 0.8,
                    status: 'refugees',
                    effectLabel: 'Refugees'
                });
                if (this.colonists.length < 18) {
                    this.addColonist();
                } else {
                    this.camp.food = Math.max(0, this.camp.food - 1.5);
                }
                colony.recentAction = 'sending refugees';
                return;
            }
            const alliedHost = desperate
                ? this.getActiveBranchColonies()
                    .filter((peer) =>
                        peer.id !== colony.id &&
                        peer.diplomacyState === 'allied' &&
                        peer.food > 10 &&
                        peer.water > 10 &&
                        distance(peer, colony) < 340
                    )
                    .sort((left, right) => distance(colony, left) - distance(colony, right))[0] || null
                : null;
            if (desperate && alliedHost && this.rng() < 0.0012 * dt) {
                colony.population = Math.max(2, colony.population - 0.8);
                colony.history.refugees += 1;
                this.recordFactionEvent(`Refugees from ${colony.name} fled toward ${alliedHost.name}.`);
                this.spawnFactionParty(colony, 'refugee', 'fromCamp', {
                    target: alliedHost,
                    targetKind: 'colony',
                    targetColonyId: alliedHost.id,
                    strength: 0.9,
                    status: 'refugees',
                    effectLabel: 'Refugees'
                });
                colony.recentAction = 'sending refugees';
            }
        }

        absorbBranchKnowledge(colony) {
            const settlement = this.lineageMemory.settlementKnowledge || {};
            const population = colony.population || 2;
            if (population >= 3) {
                settlement.storageTier = Math.max(settlement.storageTier || 0, colony.food > 20 ? 2 : 1);
            }
            if (population >= 4) {
                settlement.housingTier = Math.max(settlement.housingTier || 0, 1);
            }
            if (population >= 5) {
                settlement.civicTier = Math.max(settlement.civicTier || 0, 1);
            }
            if (colony.type === 'splinter') {
                settlement.defenseTier = Math.max(settlement.defenseTier || 0, 1);
            }
            if ((colony.food || 0) > 28 && (colony.wood || 0) > 10) {
                settlement.civicTier = Math.max(settlement.civicTier || 0, 2);
            }
            if ((colony.history?.trades || 0) >= 3 && ['allied', 'trading'].includes(colony.diplomacyState)) {
                settlement.storageTier = Math.max(settlement.storageTier || 0, 2);
                settlement.civicTier = Math.max(settlement.civicTier || 0, 2);
            }
            if ((colony.history?.campaigns || 0) >= 1 || colony.diplomacyState === 'rival') {
                settlement.defenseTier = Math.max(settlement.defenseTier || 0, 2);
            }
            if ((colony.history?.knowledgeTrades || 0) >= 2 && colony.population >= 4) {
                settlement.housingTier = Math.max(settlement.housingTier || 0, 2);
                settlement.storageTier = Math.max(settlement.storageTier || 0, 2);
            }
            if ((colony.population || 0) >= 6 && (colony.food || 0) > 36 && (colony.wood || 0) > 14) {
                settlement.civicTier = Math.max(settlement.civicTier || 0, 3);
            }
        }

        updateAnimals(dt) {
            for (const animal of this.animals) {
                if (animal.depleted) {
                    if (animal.type === 'wildAnimal') {
                        animal.respawnTimer = Math.max(0, (animal.respawnTimer || 0) - dt);
                        if (animal.respawnTimer <= 0) {
                            animal.depleted = false;
                            animal.amount = animal.maxAmount || 1;
                            animal.x = animal.homeX;
                            animal.y = animal.homeY;
                            animal.velocityAngle = this.rng() * Math.PI * 2;
                            animal.velocitySpeed = 10 + this.rng() * 8;
                            animal.panicTimer = 0;
                        }
                    }
                    continue;
                }
                animal.panicTimer = Math.max(0, animal.panicTimer - dt);
                const nearestThreat = this.findNearestColonist(animal, 90);
                if (nearestThreat) {
                    animal.velocityAngle = Math.atan2(animal.y - nearestThreat.y, animal.x - nearestThreat.x);
                    animal.velocitySpeed = 48;
                    animal.panicTimer = 2.6;
                } else if (animal.panicTimer > 0) {
                    animal.velocitySpeed = 30;
                } else if (this.rng() < 0.02) {
                    animal.velocityAngle += (this.rng() - 0.5) * 0.9;
                    animal.velocitySpeed = 10 + this.rng() * 10;
                }
                animal.x += Math.cos(animal.velocityAngle) * animal.velocitySpeed * dt;
                animal.y += Math.sin(animal.velocityAngle) * animal.velocitySpeed * dt;

                const homePull = animal.panicTimer > 0 ? 0.012 : 0.04;
                animal.x = clamp(animal.x + (animal.homeX - animal.x) * homePull, 24, this.width - 24);
                animal.y = clamp(animal.y + (animal.homeY - animal.y) * homePull, 24, this.height - 24);
            }
        }

        triggerRespawnCooldown(entity) {
            if (!entity) {
                return;
            }
            entity.depleted = true;
            if (entity.type === 'wildAnimal') {
                entity.amount = 0;
                entity.respawnTimer = entity.respawnDelay || (RESOURCE_RESPAWN_MIN + this.rng() * (RESOURCE_RESPAWN_MAX - RESOURCE_RESPAWN_MIN));
                return;
            }
            entity.amount = Math.max(0, entity.amount || 0);
            entity.respawnTimer = entity.respawnDelay || (RESOURCE_RESPAWN_MIN + this.rng() * (RESOURCE_RESPAWN_MAX - RESOURCE_RESPAWN_MIN));
        }

        updatePredators(dt) {
            const predatorCaution = this.getPredatorCaution();
            for (const predator of this.predators) {
                predator.attackCooldown = Math.max(0, predator.attackCooldown - dt);
                predator.retreatTimer = Math.max(0, predator.retreatTimer - dt);
                const nearCamp = distance(predator, this.camp) < (120 + predatorCaution * 30);
                const campDeterrence = nearCamp && this.camp.fireFuel > 8 ? 1 + predatorCaution * 0.6 : 0;
                const focusedTarget = this.colonists.find((colonist) =>
                    colonist.alive && colonist.id === predator.targetColonistId
                ) || null;
                const weatherScanRadius = this.getWeatherVisibilityRadius(predator, 180 - predatorCaution * 20);
                const target = focusedTarget && distance(predator, focusedTarget) < this.getWeatherVisibilityRadius(predator, 260) * this.getWeatherStealthFactor(focusedTarget)
                    ? focusedTarget
                    : this.findNearestColonist(predator, weatherScanRadius);
                const defenders = this.colonists.filter((colonist) =>
                    colonist.alive &&
                    colonist.intent === 'protect' &&
                    distance(colonist, predator) < this.getWeatherVisibilityRadius(colonist, 70)
                );

                if (defenders.length >= 2 || campDeterrence > 0) {
                    predator.retreatTimer = Math.max(predator.retreatTimer, 4.5 + campDeterrence);
                    predator.targetColonistId = null;
                }

                if (predator.retreatTimer > 0) {
                    const retreatFrom = defenders[0] || target || this.camp;
                    predator.velocityAngle = Math.atan2(predator.y - retreatFrom.y, predator.x - retreatFrom.x);
                    predator.velocitySpeed = 34 + predatorCaution * 3;
                } else if (target) {
                    predator.targetColonistId = target.id;
                    predator.velocityAngle = Math.atan2(target.y - predator.y, target.x - predator.x);
                    predator.velocitySpeed = 30 - predatorCaution * 2;
                } else if (this.rng() < 0.025) {
                    predator.targetColonistId = null;
                    predator.velocityAngle += (this.rng() - 0.5) * 0.8;
                    predator.velocitySpeed = 12 + this.rng() * 7;
                }
                predator.x += Math.cos(predator.velocityAngle) * predator.velocitySpeed * dt;
                predator.y += Math.sin(predator.velocityAngle) * predator.velocitySpeed * dt;
                predator.x = clamp(predator.x + (predator.homeX - predator.x) * 0.015, 24, this.width - 24);
                predator.y = clamp(predator.y + (predator.homeY - predator.y) * 0.015, 24, this.height - 24);

                const attackReach = Math.max(10, (18 - predatorCaution * 2) + this.getWeatherStateAt(predator.x, predator.y).stealthBonus * 6);
                if (predator.retreatTimer <= 0 && target && distance(predator, target) < attackReach && predator.attackCooldown <= 0) {
                    target.stats.health = clamp(target.stats.health - 24, 0, 100);
                    target.stats.morale = clamp(target.stats.morale - 12, 0, 100);
                    target.lastDamageCause = 'predatorAttack';
                    this.rememberDanger(predator, target, 'predatorAttack');
                    predator.attackCooldown = 2.2 + predatorCaution * 0.5;
                    this.pushEvent(`${target.name} was mauled by a predator.`);
                }
            }
        }

        completeIntent(colonist, target) {
            const failedBefore = Object.values(colonist.memory.failedActions || {}).reduce((sum, value) => sum + value, 0);
            this.recordCompletedAction(target.action);
            switch (target.action) {
                case 'drinkCamp':
                    if (this.camp.water > 0.5) {
                        this.camp.water = Math.max(0, this.camp.water - 0.8);
                        colonist.stats.thirst = clamp(colonist.stats.thirst + 40, 0, 100);
                    }
                    break;
                case 'drinkSource':
                    if (target.entity && !target.entity.depleted && target.entity.amount > 0.2) {
                        target.entity.amount = Math.max(0, target.entity.amount - 1.2);
                        if (target.entity.amount <= 0.05) {
                            this.triggerRespawnCooldown(target.entity);
                        }
                        colonist.stats.thirst = clamp(colonist.stats.thirst + 52, 0, 100);
                        colonist.gainSkill('survival', 0.3);
                    } else {
                        this.recordFailedAction(colonist, 'drinkSource');
                    }
                    break;
                case 'collectWater':
                    if (target.entity && !target.entity.depleted && target.entity.amount > 0.2) {
                        const haul = Math.min(4.5 * this.getHaulBonus(colonist), target.entity.amount);
                        target.entity.amount = Math.max(0, target.entity.amount - haul);
                        if (target.entity.amount <= 0.05) {
                            this.triggerRespawnCooldown(target.entity);
                        }
                        colonist.carrying.type = 'water';
                        colonist.carrying.amount = haul;
                        colonist.gainSkill('survival', 0.45);
                        this.wearTool(colonist, 'collectWater', 1);
                    } else {
                        this.recordFailedAction(colonist, 'collectWater');
                    }
                    break;
                case 'deliverWater':
                    this.camp.water = clamp(this.camp.water + colonist.carrying.amount, 0, 999);
                    this.noteStorageDelivery(target);
                    colonist.carrying.type = null;
                    colonist.carrying.amount = 0;
                    break;
                case 'eatCamp':
                    if (this.camp.food > 0.5) {
                        this.camp.food = Math.max(0, this.camp.food - 1.6);
                        colonist.stats.hunger = clamp(colonist.stats.hunger + 36, 0, 100);
                    }
                    break;
                case 'eatWild':
                    if (target.entity && !target.entity.depleted) {
                        target.entity.amount = Math.max(0, target.entity.amount - 5);
                        if (target.entity.amount <= 0.05) {
                            this.triggerRespawnCooldown(target.entity);
                        }
                        colonist.stats.hunger = clamp(colonist.stats.hunger + 32, 0, 100);
                        this.recordFoodSource('foraged', 2.4);
                        colonist.gainSkill('foraging', 0.35);
                    } else {
                        this.recordFailedAction(colonist, 'eat');
                    }
                    break;
                case 'eatAndGatherFood':
                    if (target.entity && !target.entity.depleted) {
                        const totalHarvest = Math.min(8, target.entity.amount);
                        const carried = Math.max(0, totalHarvest - 3) * this.getHaulBonus(colonist);
                        target.entity.amount = Math.max(0, target.entity.amount - totalHarvest);
                        if (target.entity.amount <= 0.05) {
                            this.triggerRespawnCooldown(target.entity);
                        }
                        colonist.stats.hunger = clamp(colonist.stats.hunger + 30, 0, 100);
                        colonist.carrying.type = carried > 0 ? 'food' : null;
                        colonist.carrying.amount = carried;
                        colonist.carrying.source = 'foraged';
                        this.recordFoodSource('foraged', totalHarvest * 0.4);
                        colonist.gainSkill('foraging', 0.75);
                        this.wearTool(colonist, 'eatAndGatherFood', 1);
                    } else {
                        this.recordFailedAction(colonist, 'collectFood');
                    }
                    break;
                case 'storeFood':
                    colonist.stats.morale = clamp(colonist.stats.morale + 1.5, 0, 100);
                    break;
                case 'warmCamp':
                    colonist.stats.warmth = clamp(colonist.stats.warmth + 48, 0, 100);
                    colonist.stats.morale = clamp(colonist.stats.morale + 6, 0, 100);
                    break;
                case 'warmHome':
                    colonist.stats.warmth = clamp(colonist.stats.warmth + 34, 0, 100);
                    colonist.stats.energy = clamp(colonist.stats.energy + 6, 0, 100);
                    colonist.stats.morale = clamp(colonist.stats.morale + 4, 0, 100);
                    break;
                case 'sleepCamp':
                    colonist.stats.energy = clamp(colonist.stats.energy + 42, 0, 100);
                    colonist.stats.warmth = clamp(colonist.stats.warmth + 8, 0, 100);
                    break;
                case 'sleepHome':
                    colonist.stats.energy = clamp(colonist.stats.energy + 50, 0, 100);
                    colonist.stats.warmth = clamp(colonist.stats.warmth + 16, 0, 100);
                    colonist.stats.health = clamp(colonist.stats.health + 2, 0, 100);
                    colonist.stats.morale = clamp(colonist.stats.morale + 5, 0, 100);
                    break;
                case 'socializeWithPeer':
                    if (target.entity && target.entity.alive) {
                        const peer = target.entity;
                        const bondGain = 0.25 + colonist.traits.sociability * 0.25;
                        colonist.relationships.friends[peer.id] = (colonist.relationships.friends[peer.id] || 0) + bondGain;
                        peer.relationships.friends[colonist.id] = (peer.relationships.friends[colonist.id] || 0) + bondGain;
                        colonist.mood.social = clamp(colonist.mood.social + 0.8, -5, 5);
                        peer.mood.social = clamp(peer.mood.social + 0.8, -5, 5);
                        colonist.stats.morale = clamp(colonist.stats.morale + 2.5, 0, 100);
                        peer.stats.morale = clamp(peer.stats.morale + 2.5, 0, 100);
                        const recentAlliance = this.rituals.some((ritual) =>
                            ritual.type === 'alliance ceremony' &&
                            (ritual.year === this.year || ritual.year === this.year - 1) &&
                            Math.abs((ritual.year * 100 + ritual.day) - (this.year * 100 + this.day)) <= 2 &&
                            ritual.names &&
                            ritual.names.includes(colonist.name) &&
                            ritual.names.includes(peer.name)
                        );
                        if (!recentAlliance && (colonist.relationships.friends[peer.id] || 0) > 4 && (peer.relationships.friends[colonist.id] || 0) > 4 && this.rng() < 0.08) {
                            this.rituals.unshift({ type: 'alliance ceremony', day: this.day, year: this.year, names: [colonist.name, peer.name] });
                            this.rituals = this.rituals.slice(0, 12);
                            this.pushEvent(`${colonist.name} and ${peer.name} led an alliance ceremony.`);
                        }
                    }
                    break;
                case 'tendWounds':
                    colonist.stats.health = clamp(colonist.stats.health + 14, 0, 100);
                    colonist.stats.morale = clamp(colonist.stats.morale + 4, 0, 100);
                    colonist.gainSkill('medicine', 0.9);
                    this.noteDiscovery('skill:medicine', `${colonist.name} learned basic wound care.`);
                    break;
                case 'collectFood':
                    if (target.entity && !target.entity.depleted) {
                        const haul = Math.min(7 * this.getHaulBonus(colonist), target.entity.amount);
                        target.entity.amount = Math.max(0, target.entity.amount - haul);
                        if (target.entity.amount <= 0.05) {
                            this.triggerRespawnCooldown(target.entity);
                        }
                        colonist.carrying.type = 'food';
                        colonist.carrying.amount = haul;
                        colonist.carrying.source = 'foraged';
                        colonist.gainSkill('foraging', 0.8);
                        this.recordFoodSource('foraged', haul * 0.18);
                        this.wearTool(colonist, 'collectFood', 1);
                    } else {
                        this.recordFailedAction(colonist, 'collectFood');
                    }
                    break;
                case 'deliverFood':
                    this.camp.food += colonist.carrying.amount;
                    this.recordFoodSource(colonist.carrying.source || 'foraged', colonist.carrying.amount * 0.28);
                    this.noteStorageDelivery(target);
                    if (colonist.inventory.materials.hides > 0) {
                        this.addCampMaterial('hides', colonist.inventory.materials.hides);
                        colonist.inventory.materials.hides = 0;
                    }
                    colonist.carrying.type = null;
                    colonist.carrying.amount = 0;
                    colonist.carrying.source = null;
                    colonist.stats.morale = clamp(colonist.stats.morale + 1.5, 0, 100);
                    this.pushEvent(`${colonist.name} delivered food to camp.`);
                    colonist.gainSkill('survival', 0.2);
                    break;
                case 'collectWood':
                    if (target.entity && !target.entity.depleted) {
                        const haul = Math.min(7 * (colonist.equipment.wood ? 1.45 : 1), target.entity.amount);
                        target.entity.amount = Math.max(0, target.entity.amount - haul);
                        if (target.entity.amount <= 0.05) {
                            this.triggerRespawnCooldown(target.entity);
                        }
                        colonist.carrying.type = 'wood';
                        colonist.carrying.amount = haul;
                        colonist.inventory.materials.logs += haul;
                        colonist.inventory.materials.fiber += Math.max(1, Math.round(haul * 0.25));
                        colonist.gainSkill('building', 0.7);
                        this.wearTool(colonist, 'collectWood', 1.4);
                        if (
                            target.entity.biome === 'forest' &&
                            (target.entity.depleted || target.entity.amount < 14 || this.rng() < 0.22)
                        ) {
                            this.markForestClearingAt(target.entity.x, target.entity.y);
                        }
                    } else {
                        this.recordFailedAction(colonist, 'collectWood');
                    }
                    break;
                case 'deliverWood':
                    this.camp.wood += colonist.carrying.amount;
                    this.camp.fireFuel += colonist.carrying.amount * 0.35;
                    this.noteStorageDelivery(target);
                    this.addCampMaterial('logs', colonist.inventory.materials.logs);
                    this.addCampMaterial('fiber', colonist.inventory.materials.fiber);
                    colonist.inventory.materials.logs = 0;
                    colonist.inventory.materials.fiber = 0;
                    colonist.carrying.type = null;
                    colonist.carrying.amount = 0;
                    break;
                case 'collectStone':
                    if (target.entity && !target.entity.depleted) {
                        const haul = Math.min(6 * (colonist.equipment.building ? 1.3 : 1), target.entity.amount);
                        target.entity.amount = Math.max(0, target.entity.amount - haul);
                        if (target.entity.amount <= 0.05) {
                            this.triggerRespawnCooldown(target.entity);
                        }
                        colonist.carrying.type = 'stone';
                        colonist.carrying.amount = haul;
                        colonist.gainSkill('building', 0.7);
                        this.noteDiscovery('resource:stone', `${colonist.name} learned how to work stone.`);
                        this.wearTool(colonist, 'collectStone', 1.1);
                        this.markQuarryAt(target.entity.x, target.entity.y);
                    } else {
                        this.recordFailedAction(colonist, 'collectStone');
                    }
                    break;
                case 'deliverStone':
                    this.camp.stone += colonist.carrying.amount;
                    this.camp.shelter = clamp(this.camp.shelter + colonist.carrying.amount * 0.4, 0, 100);
                    this.noteStorageDelivery(target);
                    colonist.carrying.type = null;
                    colonist.carrying.amount = 0;
                    break;
                case 'craftRecipe':
                    if (this.completeRecipeCraft(colonist, target.recipeKey)) {
                        this.recordCraftedRecipe(target.recipeKey);
                    }
                    break;
                case 'processMaterials':
                    this.processMaterials(colonist, target.output);
                    break;
                case 'repairTool':
                    this.repairAvailableTool(colonist);
                    break;
                case 'pickupProjectMaterial': {
                    const project = this.projects.find((entry) => entry.id === target.projectId);
                    if (!project || !this.consumeConstructionMaterial(target.material, target.amount)) {
                        this.recordFailedAction(colonist, `pickupProjectMaterial:${target.material}`);
                        break;
                    }
                    colonist.carrying.type = target.material;
                    colonist.carrying.amount = target.amount;
                    break;
                }
                case 'deliverProjectMaterial': {
                    const project = this.projects.find((entry) => entry.id === target.projectId);
                    if (!project || colonist.carrying.type !== target.material) {
                        this.recordFailedAction(colonist, `deliverProjectMaterial:${target.material}`);
                        break;
                    }
                    project.delivered[target.material] = (project.delivered[target.material] || 0) + colonist.carrying.amount;
                    colonist.carrying.type = null;
                    colonist.carrying.amount = 0;
                    colonist.gainSkill('building', 0.35);
                    break;
                }
                case 'buildStructure': {
                    const project = this.projects.find((entry) => entry.id === target.projectId);
                    if (!project || !this.projectHasAllMaterials(project)) {
                        this.recordFailedAction(colonist, 'buildStructure');
                        break;
                    }
                    const hammerBonus = colonist.equipment.building?.type === 'hammer' ? 1.35 : 1;
                    project.buildProgress += hammerBonus + colonist.skills.building * 0.06;
                    colonist.gainSkill('building', 0.75);
                    this.wearTool(colonist, 'collectStone', 0.7);
                    if (project.buildProgress >= project.buildTime) {
                        this.completeProject(project, colonist);
                    }
                    break;
                }
                case 'plantTrial':
                    this.spawnPlantTrial(target, colonist);
                    colonist.gainSkill('farming', 1.1);
                    colonist.gainSkill('survival', 0.2);
                    this.noteDiscovery('skill:planting', `${colonist.name} completed the first planting trial.`);
                    this.wearTool(colonist, 'plantTrial', 1);
                    break;
                case 'huntAnimal':
                    if (target.entity && !target.entity.depleted) {
                        const spearBonus = colonist.equipment.hunting?.type === 'spear' ? 1.45 : 1;
                        this.triggerRespawnCooldown(target.entity);
                        colonist.carrying.type = 'food';
                        colonist.carrying.amount = 12 * spearBonus * this.getHaulBonus(colonist);
                        colonist.carrying.source = 'hunted';
                        colonist.inventory.materials.hides += 1;
                        colonist.stats.hunger = clamp(colonist.stats.hunger + 12, 0, 100);
                        colonist.gainSkill('hunting', 1.1);
                        colonist.gainSkill('survival', 0.35);
                        this.recordFoodSource('hunted', colonist.carrying.amount * 0.32);
                        this.noteDiscovery('skill:hunting', `${colonist.name} made a successful hunt.`);
                        this.pushEvent(`${colonist.name} brought down a wild animal${spearBonus > 1 ? ' with a spear' : ''}.`);
                        this.wearTool(colonist, 'huntAnimal', 1.5);
                    } else {
                        this.recordFailedAction(colonist, 'huntAnimal');
                    }
                    break;
                case 'huntMeal':
                    if (target.entity && !target.entity.depleted) {
                        const spearBonus = colonist.equipment.hunting?.type === 'spear' ? 1.35 : 1;
                        this.triggerRespawnCooldown(target.entity);
                        colonist.carrying.type = 'food';
                        colonist.carrying.amount = 7 * spearBonus * this.getHaulBonus(colonist);
                        colonist.carrying.source = 'hunted';
                        colonist.inventory.materials.hides += 1;
                        colonist.stats.hunger = clamp(colonist.stats.hunger + 34, 0, 100);
                        colonist.stats.morale = clamp(colonist.stats.morale + 4, 0, 100);
                        colonist.gainSkill('hunting', 1.2);
                        colonist.gainSkill('survival', 0.4);
                        this.recordFoodSource('hunted', colonist.carrying.amount * 0.3);
                        this.noteDiscovery('skill:hunting', `${colonist.name} made a successful hunt.`);
                        this.pushEvent(`${colonist.name} ate from a fresh kill and hauled the rest home${spearBonus > 1 ? ' with spear-hunt efficiency' : ''}.`);
                        this.wearTool(colonist, 'huntMeal', 1.3);
                    } else {
                        this.recordFailedAction(colonist, 'huntAnimal');
                    }
                    break;
                case 'attackPredator':
                    if (target.entity) {
                        const weaponBonus = colonist.equipment.hunting?.type === 'spear' ? 8 : 0;
                        target.entity.health -= colonist.combatPower + weaponBonus;
                        colonist.stats.energy = clamp(colonist.stats.energy - 6, 0, 100);
                        colonist.stats.morale = clamp(colonist.stats.morale + 2, 0, 100);
                        colonist.gainSkill('combat', 0.9);
                        this.wearTool(colonist, 'attackPredator', 1.2);
                        if (target.entity.health <= 0) {
                            this.predators = this.predators.filter((predator) => predator !== target.entity);
                            this.pushEvent(`${colonist.name} drove off a predator.`);
                        } else {
                            this.pushEvent(`${colonist.name} struck a predator.`);
                        }
                    }
                    break;
                case 'battleEngage':
                    if (target.entity && !target.entity.resolved) {
                        const battlefront = target.entity;
                        const weaponBonus = colonist.equipment.hunting?.type === 'spear' ? 2.2 : 0;
                        const dealt = colonist.combatPower * 0.24 + colonist.skills.combat * 0.12 + weaponBonus;
                        this.battleManager.handleColonistEngage(colonist, battlefront, dealt);
                        colonist.stats.energy = clamp(colonist.stats.energy - 7, 0, 100);
                        colonist.stats.morale = clamp(colonist.stats.morale + 1.5, 0, 100);
                        colonist.gainSkill('combat', 0.8);
                        this.wearTool(colonist, 'attackPredator', 0.8);
                    }
                    break;
                default:
                    break;
            }
            const failedAfter = Object.values(colonist.memory.failedActions || {}).reduce((sum, value) => sum + value, 0);
            if (failedAfter === failedBefore) {
                this.recordSuccessfulAction(colonist, target.action);
            }
        }

        getEntityAssignmentPenalty(entity, colonist = null) {
            let assigned = 0;
            for (const entry of this.colonists) {
                if (!entry.alive || entry === colonist) {
                    continue;
                }
                const step = entry.plan[entry.planStep];
                if (step?.entity && step.entity === entity) {
                    assigned += 1;
                }
            }
            return assigned * 85;
        }

        getActionDuration(colonist, skill, baseDuration, action = null) {
            const level = colonist?.skills?.[skill] || 0;
            const toolMultiplier = action ? this.getToolSpeedMultiplier(colonist, action) : 1;
            const workshopMultiplier = (skill === 'crafting' || skill === 'building') && (this.countBuildings('workshop') + this.countBuildings('mill')) > 0
                ? Math.max(0.72, 1 - this.countBuildings('workshop') * 0.08 - this.countBuildings('mill') * 0.06)
                : 1;
            return Math.max(0.9, baseDuration * (1 - level * 0.004) * toolMultiplier * workshopMultiplier);
        }

        shouldRevealCampStore(key) {
            switch (key) {
                case 'fiber':
                    return this.getCampMaterial('fiber') > 0 || this.countCompletedAction('collectWood') > 0;
                case 'planks':
                    return this.getCampMaterial('planks') > 0 || this.countCompletedAction('processMaterials') > 0 || this.countProjects('hut') > 0 || this.countProjects('storage') > 0 || this.countProjects('workshop') > 0;
                case 'rope':
                    return this.getCampMaterial('rope') > 0 || this.countCompletedAction('processMaterials') > 0 || this.colonyKnowledge.discoveries.includes('skill:hunting') || this.colonyKnowledge.discoveries.includes('skill:planting');
                case 'tools':
                    return this.camp.items.length > 0 ||
                        this.colonists.some((colonist) => Object.values(colonist.equipment).some(Boolean)) ||
                        this.colonyKnowledge.discoveries.includes('skill:tool_use');
                default:
                    return false;
            }
        }

        getKnownDangerZones(origin) {
            const zones = [];
            if (origin?.memory?.dangerZones?.length) {
                zones.push(...origin.memory.dangerZones);
            }
            if (this.colonyKnowledge.dangerZones.length) {
                zones.push(...this.colonyKnowledge.dangerZones);
            }
            if (this.lineageMemory.dangerZones?.length) {
                zones.push(...this.lineageMemory.dangerZones);
            }
            return zones;
        }

        getPredatorCaution() {
            const builtDefense = this.countBuildings('watchtower') * 0.4 + this.countBuildings('wall') * 0.5 + this.countBuildings('fortifiedStructure') * 0.6;
            return Math.min(3, (this.lineageMemory.deathCauses?.predatorAttack || 0) + builtDefense);
        }

        getDangerPenalty(point, origin) {
            const zones = this.getKnownDangerZones(origin);
            const cautionMultiplier = 1 + this.getPredatorCaution() * 0.45;
            let penalty = 0;
            for (const zone of zones) {
                const gap = distance(point, zone);
                if (gap < 150) {
                    penalty += (150 - gap) * 1.5 * cautionMultiplier;
                }
            }
            return penalty;
        }

        getLessonBonus(cause, intent) {
            const count = this.lineageMemory.deathCauses?.[cause] || 0;
            if (!count) {
                return 0;
            }
            const scale = Math.min(18, count * 4);
            const mappings = {
                dehydration: { drink: 6, haulWater: 14 },
                starvation: { eat: 4, forage: 12, hunt: 10 },
                exposure: { warm: 10, gatherWood: 12, gatherStone: 8 },
                exhaustion: { sleep: 12 },
                predatorAttack: { protect: 6, flee: 8 }
            };
            return (mappings[cause]?.[intent] || 0) * (scale / 18);
        }

        countCompletedAction(action) {
            return this.progress.completedActions[action] || 0;
        }

        recordCompletedAction(action) {
            this.progress.completedActions[action] = (this.progress.completedActions[action] || 0) + 1;
            const laborRole = {
                plantTrial: 'farmer',
                collectFood: 'gatherer',
                eatAndGatherFood: 'gatherer',
                collectWood: 'builder',
                collectStone: 'builder',
                buildStructure: 'builder',
                pickupProjectMaterial: 'builder',
                deliverProjectMaterial: 'builder',
                huntAnimal: 'hunter',
                huntMeal: 'hunter',
                craftRecipe: 'crafter',
                processMaterials: 'crafter',
                repairTool: 'crafter'
            }[action];
            if (laborRole) {
                this.recentLabor[laborRole] = (this.recentLabor[laborRole] || 0) + 1;
            }
        }

        recordCraftedRecipe(recipeKey) {
            this.progress.recipeCrafts[recipeKey] = (this.progress.recipeCrafts[recipeKey] || 0) + 1;
        }

        getColonySkillAverage(skill) {
            if (!this.colonists.length) {
                return 0;
            }
            const total = this.colonists.reduce((sum, colonist) => sum + (colonist.skills[skill] || 0), 0);
            return total / this.colonists.length;
        }

        canPursueRecipe(recipeKey, colonist = null) {
            const checks = {
                stick: () => this.countCompletedAction('collectWood') >= 2,
                stoneTool: () =>
                    this.colonyKnowledge.discoveries.includes('resource:stone') &&
                    this.getColonySkillAverage('building') >= 0.8 &&
                    this.countCompletedAction('collectStone') >= 2,
                basket: () =>
                    this.colonyKnowledge.discoveries.includes('skill:tool_use') &&
                    this.countCompletedAction('collectFood') + this.countCompletedAction('eatAndGatherFood') >= 6,
                axe: () =>
                    this.colonyKnowledge.discoveries.includes('skill:tool_use') &&
                    this.getColonySkillAverage('building') >= 2.5 &&
                    this.countCompletedAction('collectWood') >= 8,
                hammer: () =>
                    this.colonyKnowledge.discoveries.includes('skill:tool_use') &&
                    this.getColonySkillAverage('building') >= 2.5 &&
                    this.countCompletedAction('collectStone') >= 6,
                firePit: () =>
                    this.colonyKnowledge.discoveries.includes('skill:tool_use') &&
                    this.countCompletedAction('warmCamp') >= 8 &&
                    this.countCompletedAction('collectStone') >= 4,
                simpleClothing: () =>
                    (this.colonyKnowledge.discoveries.includes('resource:trees') || this.colonyKnowledge.discoveries.includes('resource:wildAnimal')) &&
                    this.countCompletedAction('warmCamp') >= 10 &&
                    this.getColonySkillAverage('survival') >= 1.5,
                spear: () =>
                    (this.colonyKnowledge.discoveries.includes('resource:wildAnimal') || this.colonyKnowledge.discoveries.includes('skill:hunting')) &&
                    this.countCompletedAction('huntAnimal') + this.countCompletedAction('huntMeal') >= 2 &&
                    this.getColonySkillAverage('hunting') >= 1.8,
                hoe: () =>
                    this.colonyKnowledge.discoveries.includes('skill:planting') &&
                    this.countCompletedAction('plantTrial') >= 1 &&
                    this.getColonySkillAverage('farming') >= 0.8
            };
            const check = checks[recipeKey];
            if (!check || !check()) {
                return false;
            }
            if (!colonist) {
                return true;
            }
            const personal = {
                axe: () => colonist.skills.building >= 2.5,
                hammer: () => colonist.skills.building >= 2.5,
                firePit: () => colonist.skills.crafting >= 2.5,
                simpleClothing: () => colonist.skills.survival >= 1.2 || colonist.skills.crafting >= 1.2,
                spear: () => colonist.skills.hunting >= 1.5 || colonist.skills.crafting >= 2,
                hoe: () => colonist.skills.farming >= 0.8 || colonist.skills.crafting >= 2,
                basket: () => colonist.skills.crafting >= 1.5,
                stoneTool: () => colonist.skills.building >= 0.6,
                stick: () => true
            };
            return (personal[recipeKey] || (() => true))();
        }

        shouldPracticeCrafting(colonist) {
            return this.camp.wood > 3 &&
                this.camp.stone > 2 &&
                colonist.stats.energy > 40 &&
                colonist.stats.health > 65 &&
                !this.colonyKnowledge.discoveries.includes('skill:tool_use') &&
                this.countCompletedAction('collectWood') >= 3 &&
                this.countCompletedAction('collectStone') >= 2;
        }

        shouldAttemptPlanting(colonist) {
            const seasonName = this.getSeason().name;
            return seasonName !== 'Winter' &&
                this.camp.food > 5 &&
                colonist.stats.energy > 36 &&
                colonist.stats.health > 70 &&
                (this.colonyKnowledge.resources.berries.length > 0 || this.lineageMemory.knownResources.berries.length > 0) &&
                this.countCompletedAction('collectFood') + this.countCompletedAction('eatAndGatherFood') >= 8 &&
                (!this.colonyKnowledge.discoveries.includes('skill:planting') || !colonist.equipment.farming);
        }

        countBuildings(type = null) {
            if (!type) {
                return this.buildings.length;
            }
            return this.buildings.filter((building) => building.type === type).length;
        }

        countProjects(type = null) {
            if (!type) {
                return this.projects.length;
            }
            return this.projects.filter((project) => project.type === type).length;
        }

        getBuildingCapacity() {
            return 2 + this.buildings.reduce((sum, building) => (
                sum + (BUILDING_DEFS[building.type]?.shelter || 0) * Math.max(0.25, this.getBuildingIntegrityRatio(building))
            ), 0);
        }

        getStorageBuilding() {
            return this.buildings.find((building) =>
                building.type === 'civicComplex' ||
                building.type === 'warehouse' ||
                building.type === 'granary' ||
                building.type === 'storage' ||
                building.type === 'storagePit'
            ) || null;
        }

        getBuildingIntegrityRatio(building) {
            if (!building) {
                return 0;
            }
            if (!building.maxIntegrity) {
                return 1;
            }
            return clamp(building.integrity / building.maxIntegrity, 0, 1);
        }

        applyBuildingDamage(building, amount, options = {}) {
            if (!building || !Number.isFinite(amount) || amount <= 0) {
                return 0;
            }
            const before = Number.isFinite(building.integrity)
                ? building.integrity
                : (building.maxIntegrity || 0);
            const maxIntegrity = building.maxIntegrity || Math.max(1, before || 1);
            const after = clamp(before - amount, 0, maxIntegrity);
            const applied = before - after;
            building.integrity = after;
            if (applied > 0 && options.resetHarvest !== false && (building.type === 'farmPlot' || building.type === 'engineeredFarm')) {
                building.harvestTimer = 0;
            }
            return applied;
        }

        isPositionShelteredFromWeather(x, y) {
            if (Math.hypot(this.camp.x - x, this.camp.y - y) < 52 && (this.camp.shelter || 0) >= 45) {
                return true;
            }
            return this.buildings.some((building) =>
                [
                    'leanTo',
                    'hut',
                    'cottage',
                    'house',
                    'fortifiedStructure',
                    'stoneKeep',
                    'granary',
                    'warehouse',
                    'kitchen',
                    'foodHall',
                    'civicComplex'
                ].includes(building.type) &&
                this.getBuildingIntegrityRatio(building) > 0.35 &&
                Math.hypot(building.x - x, building.y - y) < 42
            );
        }

        resolveLightningStrike(weatherState) {
            if (!weatherState || weatherState.type !== 'Storm') {
                return false;
            }
            const exposedColonists = this.colonists
                .filter((colonist) => colonist.alive && !this.isPositionShelteredFromWeather(colonist.x, colonist.y))
                .map((colonist) => ({
                    colonist,
                    state: this.getWeatherStateAt(colonist.x, colonist.y)
                }))
                .filter((entry) => entry.state.lightningRisk > 0.2)
                .sort((left, right) => right.state.lightningRisk - left.state.lightningRisk);
            const exposedBuildings = this.buildings
                .filter((building) =>
                    ['watchtower', 'wall', 'campfire', 'leanTo', 'hut', 'storage', 'storagePit', 'granary', 'farmPlot', 'engineeredFarm'].includes(building.type) &&
                    !this.isPositionShelteredFromWeather(building.x, building.y)
                )
                .map((building) => ({
                    building,
                    risk: this.getWeatherStateAt(building.x, building.y).lightningRisk +
                        (building.type === 'watchtower' ? 0.22 : building.type === 'wall' ? 0.12 : building.type === 'campfire' ? 0.08 : 0) +
                        (1 - this.getBuildingIntegrityRatio(building)) * 0.08
                }))
                .sort((left, right) => right.risk - left.risk);

            const colonistChance = exposedColonists.length > 0
                ? 0.44 + Math.min(0.2, exposedColonists[0].state.lightningRisk * 0.18)
                : 0;
            if (exposedColonists.length > 0 && (exposedBuildings.length === 0 || this.rng() < colonistChance)) {
                const target = exposedColonists[0].colonist;
                const strikeState = exposedColonists[0].state;
                const damage = 14 + strikeState.lightningRisk * 18;
                target.stats.health = clamp(target.stats.health - damage, 0, 100);
                target.stats.energy = clamp(target.stats.energy - (8 + strikeState.lightningRisk * 8), 0, 100);
                target.stats.morale = clamp(target.stats.morale - (10 + strikeState.lightningRisk * 10), 0, 100);
                target.woundSeverity = clamp((target.woundSeverity || 0) + 0.14 + strikeState.lightningRisk * 0.16, 0, 1);
                target.woundCount = Math.min(6, (target.woundCount || 0) + 1);
                target.lastDamageCause = 'lightningStrike';
                this.pushEvent(`Lightning struck near ${target.name}, leaving them badly shaken.`);
                return true;
            }
            if (exposedBuildings.length > 0) {
                const target = exposedBuildings[0].building;
                const strikeDamage = 0.7 + exposedBuildings[0].risk * 1.2;
                this.applyBuildingDamage(target, strikeDamage);
                if (target.type === 'campfire') {
                    this.camp.fireFuel = Math.max(0, this.camp.fireFuel - 2.5);
                }
                this.startRepairProject(target);
                this.pushEvent(`Lightning struck the ${target.type}.`);
                return true;
            }
            return false;
        }

        getProjectRequirements(project) {
            return project?.requirements || BUILDING_DEFS[project?.type]?.materials || {};
        }

        getProjectBuildTime(project) {
            return project?.buildTime || BUILDING_DEFS[project?.type]?.buildTime || 1;
        }

        getUpgradeRequirements(type, targetType) {
            const nextDef = BUILDING_DEFS[type];
            const previousDef = BUILDING_DEFS[targetType];
            if (!nextDef || !previousDef) {
                return nextDef?.materials || {};
            }
            const requirements = {};
            for (const [material, amount] of Object.entries(nextDef.materials || {})) {
                const reusedAmount = Math.floor((previousDef.materials?.[material] || 0) * 0.7);
                const remaining = Math.max(0, amount - reusedAmount);
                if (remaining > 0) {
                    requirements[material] = remaining;
                }
            }
            return requirements;
        }

        getDamagedBuildingTarget() {
            return this.buildings
                .filter((building) => this.getBuildingIntegrityRatio(building) < 0.68)
                .sort((left, right) => this.getBuildingIntegrityRatio(left) - this.getBuildingIntegrityRatio(right))[0] || null;
        }

        startRepairProject(building) {
            if (!building || this.projects.some((project) => project.targetBuildingId === building.id)) {
                return null;
            }
            const def = BUILDING_DEFS[building.type];
            if (!def) {
                return null;
            }
            const damageRatio = 1 - this.getBuildingIntegrityRatio(building);
            if (damageRatio <= 0.22) {
                return null;
            }
            const requirements = {};
            for (const [material, amount] of Object.entries(def.materials || {})) {
                const repairNeed = Math.max(1, Math.ceil(amount * damageRatio * 0.35));
                requirements[material] = repairNeed;
            }
            if (!Object.keys(requirements).length) {
                requirements.wood = 1;
            }
            const project = {
                id: this.nextProjectId++,
                entityType: 'project',
                type: 'repairStructure',
                x: building.x,
                y: building.y,
                targetBuildingId: building.id,
                targetBuildingType: building.type,
                requirements,
                delivered: Object.fromEntries(Object.keys(requirements).map((key) => [key, 0])),
                buildProgress: 0,
                buildTime: Math.max(1.6, def.buildTime * damageRatio * 0.55)
            };
            this.projects.push(project);
            this.pushEvent(`The colony marked ${building.type} for repair.`);
            return project;
        }

        getStockpileSite() {
            return this.getStorageBuilding() || this.camp;
        }

        noteStorageDelivery(target, ttl = 1.2) {
            const entity = target?.entity || target;
            if (entity && entity !== this.camp && BUILDING_DEFS[entity.type]?.storageBonus > 0) {
                entity.storageOpenTtl = Math.max(entity.storageOpenTtl || 0, ttl);
            }
        }

        getResidentialBuildings() {
            return this.buildings.filter((building) =>
                building.type === 'leanTo' ||
                building.type === 'hut' ||
                building.type === 'cottage' ||
                building.type === 'house' ||
                building.type === 'fortifiedStructure' ||
                building.type === 'stoneKeep'
            );
        }

        getFamilyById(familyId) {
            return this.families.find((family) => family.id === familyId) || null;
        }

        getDependentChildrenCount(colonist) {
            if (!colonist?.familyId) {
                return 0;
            }
            const family = this.getFamilyById(colonist.familyId);
            return family?.childIds?.length || 0;
        }

        isLastFamilyAdult(colonist) {
            if (!colonist?.familyId) {
                return false;
            }
            const family = this.getFamilyById(colonist.familyId);
            return Boolean(family && family.adultIds.length <= 1 && family.childIds.length > 0);
        }

        getSleepSite(colonist) {
            const family = colonist.familyId ? this.getFamilyById(colonist.familyId) : null;
            if (family?.homeBuildingId) {
                const familyHome = this.buildings.find((building) => building.id === family.homeBuildingId);
                if (familyHome) {
                    return familyHome;
                }
            }
            if (colonist.homeBuildingId) {
                const assignedHome = this.buildings.find((building) => building.id === colonist.homeBuildingId);
                if (assignedHome) {
                    return assignedHome;
                }
            }
            const residences = this.getResidentialBuildings();
            if (!residences.length) {
                return this.camp;
            }
            const best = residences
                .slice()
                .sort((a, b) => {
                    const aScore = distance(colonist, a) + this.getDangerPenalty(a, colonist) * 0.35;
                    const bScore = distance(colonist, b) + this.getDangerPenalty(b, colonist) * 0.35;
                    return aScore - bScore;
                })[0];
            return best || this.camp;
        }

        getEligibleAdults() {
            return this.colonists.filter((colonist) =>
                colonist.alive &&
                colonist.lifeStage === 'adult' &&
                colonist.stats.health > 60 &&
                colonist.stats.energy > 35
            );
        }

        formFamilyPair(a, b) {
            const family = {
                id: this.nextFamilyId++,
                memberIds: [a.id, b.id],
                adultIds: [a.id, b.id],
                childIds: [],
                bond: 20,
                birthProgress: 0,
                birthCooldown: 22,
                homeBuildingId: null
            };
            a.familyId = family.id;
            b.familyId = family.id;
            a.partnerId = b.id;
            b.partnerId = a.id;
            this.families.push(family);
            this.pushEvent(`${a.name} and ${b.name} formed a household.`);
            return family;
        }

        assignFamilyHomes() {
            const homes = this.getResidentialBuildings();
            const available = homes.slice();
            for (const family of this.families) {
                const existing = family.homeBuildingId ? this.buildings.find((building) => building.id === family.homeBuildingId) : null;
                if (existing) {
                    for (const memberId of family.memberIds) {
                        const member = this.colonists.find((colonist) => colonist.id === memberId);
                        if (member) {
                            member.homeBuildingId = existing.id;
                        }
                    }
                    const index = available.findIndex((building) => building.id === existing.id);
                    if (index >= 0) {
                        available.splice(index, 1);
                    }
                    continue;
                }
                if (!available.length) {
                    continue;
                }
                const adults = family.adultIds
                    .map((id) => this.colonists.find((colonist) => colonist.id === id))
                    .filter(Boolean);
                const anchor = adults[0] || this.camp;
                const home = available
                    .slice()
                    .sort((left, right) => distance(anchor, left) - distance(anchor, right))[0];
                if (!home) {
                    continue;
                }
                family.homeBuildingId = home.id;
                for (const memberId of family.memberIds) {
                    const member = this.colonists.find((colonist) => colonist.id === memberId);
                    if (member) {
                        member.homeBuildingId = home.id;
                    }
                }
                const index = available.findIndex((building) => building.id === home.id);
                if (index >= 0) {
                    available.splice(index, 1);
                }
            }
        }

        spawnChildForFamily(family) {
            const home = family.homeBuildingId
                ? this.buildings.find((building) => building.id === family.homeBuildingId)
                : null;
            const parents = family.adultIds
                .map((id) => this.colonists.find((colonist) => colonist.id === id))
                .filter(Boolean);
            const x = clamp((home?.x || this.camp.x) + (this.rng() - 0.5) * 18, 24, this.width - 24);
            const y = clamp((home?.y || this.camp.y) + (this.rng() - 0.5) * 18, 24, this.height - 24);
            const child = new Colonist(this.nextColonistId++, x, y, this.generateUniqueName(), this.rng);
            child.ageYears = 0;
            child.lifeStage = 'youth';
            child.speed = 26;
            child.combatPower = 5;
            child.stats.hunger = 72;
            child.stats.thirst = 70;
            child.stats.energy = 78;
            child.stats.warmth = 74;
            child.stats.morale = 78;
            child.familyId = family.id;
            child.partnerId = null;
            child.homeBuildingId = family.homeBuildingId || null;
            if (parents.length) {
                const inheritedTraits = {};
                for (const key of Object.keys(child.traits)) {
                    const average = parents.reduce((sum, parent) => sum + parent.traits[key], 0) / parents.length;
                    inheritedTraits[key] = clamp(average + (this.rng() - 0.5) * 0.12, 0.05, 0.95);
                }
                child.traits = createTraitProfile(this.rng, inheritedTraits);
                for (const parent of parents) {
                    child.relationships.family[parent.id] = 1;
                    parent.relationships.family[child.id] = 1;
                }
            }
            child.skills = {
                foraging: 0.2,
                hunting: 0,
                building: 0,
                farming: 0,
                crafting: 0,
                medicine: 0,
                survival: 0.3,
                combat: 0
            };
            this.colonists.push(child);
            family.memberIds.push(child.id);
            family.childIds.push(child.id);
            family.birthProgress = 0;
            family.birthCooldown = 85;
            this.pushEvent(`${child.name} was born into the colony.`);
            return child;
        }

        updateFamilyUnits(dt) {
            for (const family of this.families) {
                const members = family.memberIds
                    .map((id) => this.colonists.find((colonist) => colonist.id === id))
                    .filter(Boolean);
                family.memberIds = members.map((member) => member.id);
                family.adultIds = members
                    .filter((member) => member.lifeStage === 'adult')
                    .map((member) => member.id);
                family.childIds = members
                    .filter((member) => member.lifeStage !== 'adult')
                    .map((member) => member.id);
                family.birthCooldown = Math.max(0, family.birthCooldown - dt);
                for (const member of members) {
                    member.familyId = family.id;
                }
            }
            this.families = this.families.filter((family) => family.memberIds.length > 0);

            for (const colonist of this.colonists) {
                if (!colonist.partnerId || this.colonists.some((peer) => peer.id === colonist.partnerId)) {
                    continue;
                }
                colonist.partnerId = null;
            }

            for (const colonist of this.colonists) {
                if (colonist.familyId && !this.families.some((family) => family.id === colonist.familyId)) {
                    colonist.familyId = null;
                    colonist.homeBuildingId = null;
                }
            }

            const adults = this.getEligibleAdults()
                .filter((colonist) => !colonist.partnerId && !colonist.familyId && colonist.stats.morale > 48)
                .sort((a, b) => distance(a, this.camp) - distance(b, this.camp));
            const stableHomeCount = this.getResidentialBuildings().length;
            const campCanSupportHousehold =
                stableHomeCount > 0 ||
                (
                    this.camp.shelter > 62 &&
                    this.camp.food > 10 &&
                    this.camp.water > 6 &&
                    this.getHousingSatisfaction() > 0.72
                );
            while (adults.length >= 2 && this.getHousingSatisfaction() > 0.8 && this.camp.food > 8 && campCanSupportHousehold) {
                const first = adults.shift();
                const partnerIndex = adults.findIndex((candidate) => candidate.id !== first.id);
                if (partnerIndex < 0) {
                    break;
                }
                const partner = adults.splice(partnerIndex, 1)[0];
                this.formFamilyPair(first, partner);
            }

            this.assignFamilyHomes();

            for (const family of this.families) {
                const adultsInFamily = family.adultIds
                    .map((id) => this.colonists.find((colonist) => colonist.id === id))
                    .filter(Boolean);
                if (adultsInFamily.length < 2) {
                    continue;
                }
                const yearsSettled = Math.max(0, this.year - 1);
                const housingReady = this.getHousingSatisfaction() >= (yearsSettled >= 2 ? 0.84 : 0.95) && Boolean(family.homeBuildingId);
                const foodReady = this.camp.food > (yearsSettled >= 2 ? 10 : 14) && this.camp.water > 7;
                const moraleReady = adultsInFamily.every((colonist) => colonist.stats.morale > (yearsSettled >= 2 ? 50 : 56));
                const housingHeadroom = this.getBuildingCapacity() - this.colonists.length;
                const familyChildCap = Math.max(1, Math.min(3, Math.floor(yearsSettled / 2) + 1));
                const growthAllowed = housingHeadroom >= 1 && this.getStockpilePressure() < 3.2 && family.childIds.length < familyChildCap;
                if (!housingReady || !foodReady || !moraleReady || !growthAllowed || family.birthCooldown > 0) {
                    continue;
                }
                family.bond = Math.min(100, family.bond + dt * 0.18);
                family.birthProgress += dt * (
                    0.08 +
                    adultsInFamily.reduce((sum, colonist) => sum + colonist.stats.morale, 0) / 1500 +
                    family.bond / 900 +
                    yearsSettled * 0.018
                );
                if (family.birthProgress >= 10 && this.colonists.length < 14) {
                    this.spawnChildForFamily(family);
                }
            }
        }

        getHousingSatisfaction() {
            return clamp(this.getBuildingCapacity() / Math.max(1, this.colonists.length), 0.45, 1.25);
        }

        getStorageCapacity() {
            return 36 + this.buildings.reduce((sum, building) => (
                sum + (BUILDING_DEFS[building.type]?.storageBonus || 0) * Math.max(0.25, this.getBuildingIntegrityRatio(building))
            ), 0);
        }

        getPredatorPressure() {
            return (this.lineageMemory.deathCauses.predatorAttack || 0) + this.countCompletedAction('attackPredator') + this.predators.length * 1.4;
        }

        getFoodSpoilageRate() {
            const overage = Math.max(0, this.camp.food - this.getStorageCapacity());
            if (overage <= 0) {
                return 0;
            }
            if (this.countBuildings('warehouse') > 0) {
                return 0.003 * overage;
            }
            if (this.countBuildings('granary') > 0) {
                return 0.0045 * overage;
            }
            if (this.countBuildings('storage') > 0 || this.countBuildings('storagePit') > 0) {
                return 0.006 * overage;
            }
            return 0.018 * overage;
        }

        getStockpilePressure() {
            const season = this.getSeason().name;
            const desiredFood = this.colonists.length * (season === 'Autumn' ? 6 : season === 'Winter' ? 8 : 4);
            return clamp((desiredFood - this.camp.food) / 4, 0, 8);
        }

        updateCulturalValues(dt) {
            const values = this.lineageMemory.culturalValues;
            values.hoardFood = clamp(values.hoardFood + dt * (this.getStockpilePressure() > 2 ? 0.01 : -0.004), -1, 1);
            values.shareFood = clamp(values.shareFood + dt * (this.colonists.length >= 6 ? 0.006 : -0.003), -1, 1);
            values.avoidStrangers = clamp(values.avoidStrangers + dt * (this.predators.length > 0 ? 0.006 : -0.003), -1, 1);
            values.worshipNature = clamp(values.worshipNature + dt * ((this.countBuildings('farmPlot') > 0 || this.colonyKnowledge.resources.berries.length > 0) ? 0.004 : -0.001), -1, 1);
            values.favorExpansion = clamp(values.favorExpansion + dt * ((this.colonists.length > this.getBuildingCapacity() || this.camp.food > this.getStorageCapacity() * 0.5) ? 0.006 : -0.002), -1, 1);
        }

        getSettlementKnowledgeBonus(type) {
            const settlement = this.lineageMemory.settlementKnowledge || {};
            const branchBonus = this.getActiveBranchColonies().reduce((sum, colony) => {
                const culture = colony.inheritedCulture || {};
                return sum + (
                    (type === 'housing' ? (culture.shareFood || 0) + 0.5 : 0) +
                    (type === 'storage' ? (culture.hoardFood || 0) + 0.5 : 0) +
                    (type === 'civic' ? (culture.shareFood || 0) + (culture.worshipNature || 0) + 1 : 0) +
                    (type === 'defense' ? (culture.avoidStrangers || 0) + 0.8 : 0)
                );
            }, 0);
            const lineageBonus = {
                housing: settlement.housingTier || 0,
                storage: settlement.storageTier || 0,
                civic: settlement.civicTier || 0,
                defense: settlement.defenseTier || 0,
                metallurgy: settlement.metallurgyHints || 0
            }[type] || 0;
            return lineageBonus + branchBonus * 0.35;
        }

        updateTechnology() {
            const stability = this.getColonyStability();
            const readiness = this.getPhaseReadiness();
            const wintersEndured = this.rituals.filter((ritual) => ritual.type === 'war preparation').length;
            const plantingFestivals = this.rituals.filter((ritual) => ritual.type === 'planting festival').length;
            const exposurePressure = (this.lineageMemory.deathCauses.exposure || 0) + this.countCompletedAction('warmCamp');
            const predatorPressure = this.getPredatorPressure();
            const poorSoilPressure = this.countCompletedAction('collectWater') + (this.getWeather().name === 'Drought' ? 6 : 0);
            const storagePressure = this.camp.food > this.getStorageCapacity() * 0.75 || this.getStockpilePressure() > 2.5;

            if (!this.hasTechnology('toolmaking') && readiness.phase4 && (
                this.colonyKnowledge.discoveries.includes('skill:tool_use') ||
                this.countCompletedAction('craftRecipe') >= 3 ||
                this.getColonySkillAverage('crafting') >= 1.8
            )) {
                this.unlockTechnology('toolmaking', 'Repeated tool work turned survival tricks into true toolmaking.');
            }

            if (!this.hasTechnology('agriculture') && readiness.phase5 && (
                (this.colonyKnowledge.discoveries.includes('skill:planting') && plantingFestivals >= 1) ||
                (this.countBuildings('farmPlot') >= 2 && this.getColonySkillAverage('farming') >= 1.5)
            )) {
                this.unlockTechnology('agriculture', 'Repeated planting and harvests taught the colony agriculture.');
            }

            if (!this.hasTechnology('masonry') && readiness.phase5 && (
                (this.countCompletedAction('collectStone') >= 6 || (this.lineageMemory.deathCauses.exposure || 0) >= 2 || this.camp.shelter < 45) &&
                this.getColonySkillAverage('building') >= 4 &&
                (this.countBuildings('hut') > 0 || this.camp.shelter < 55)
            )) {
                this.unlockTechnology('masonry', 'Stone work and shelter strain pushed the colony toward masonry.');
            }

            if (!this.hasTechnology('medicineLore') && readiness.phase5 && (
                this.colonyKnowledge.discoveries.includes('skill:medicine') &&
                this.countCompletedAction('tendWounds') >= 4 &&
                this.getColonySkillAverage('medicine') >= 1.4
            )) {
                this.unlockTechnology('medicineLore', 'Repeated injuries and care built shared medicine lore.');
            }

            if (!this.hasTechnology('militaryOrganization') && readiness.phase6 && (
                predatorPressure >= 6 &&
                this.getColonySkillAverage('combat') >= 1.2 &&
                this.colonists.length >= 3
            )) {
                this.unlockTechnology('militaryOrganization', 'Predator pressure pushed the colony toward organized defense.');
            }

            if (!this.hasTechnology('storagePlanning') && readiness.phase5 && (
                storagePressure &&
                (this.countCompletedAction('deliverFood') + this.countCompletedAction('collectFood') >= 10) &&
                stability >= 0.45
            )) {
                this.unlockTechnology('storagePlanning', 'Repeated stockpile strain taught the colony better storage planning.');
            }

            if (!this.hasTechnology('insulation') && readiness.phase5 && (
                exposurePressure >= 12 &&
                (wintersEndured >= 1 || this.countOwnedItems('simpleClothing') >= Math.max(2, this.colonists.length - 2))
            )) {
                this.unlockTechnology('insulation', 'Harsh cold taught the colony insulation and heat-keeping habits.');
            }

            if (!this.hasTechnology('irrigation') && readiness.phase6 && (
                this.hasTechnology('agriculture') &&
                poorSoilPressure >= 10 &&
                this.countBuildings('farmPlot') >= 2 &&
                stability >= 0.48
            )) {
                this.unlockTechnology('irrigation', 'Poor soil and thirsty fields pushed the colony toward irrigation.');
            }

            if (!this.hasTechnology('engineering') && readiness.phase6 && (
                (this.countBuildings('workshop') >= 1 || this.countCompletedAction('craftRecipe') >= 12) &&
                this.countCompletedAction('processMaterials') >= 4 &&
                this.projects.length + this.buildings.length >= 5 &&
                (this.hasTechnology('masonry') || this.countBuildings('irrigation') > 0 || this.countBuildings('watchtower') > 0) &&
                stability >= 0.54
            )) {
                this.unlockTechnology('engineering', 'Stable building and material work turned into engineering knowledge.');
            }

            if (!this.hasTechnology('metallurgy') && readiness.phase6 && (
                this.hasTechnology('masonry') &&
                this.hasTechnology('engineering') &&
                this.countCompletedAction('collectStone') >= Math.max(10, 14 - this.getSettlementKnowledgeBonus('metallurgy') * 2) &&
                this.getColonySkillAverage('building') >= Math.max(4.6, 5.5 - this.getSettlementKnowledgeBonus('metallurgy') * 0.35) &&
                (
                    this.countBuildings('mill') > 0 ||
                    this.countBuildings('warehouse') > 0 ||
                    this.countBuildings('fortifiedStructure') > 0 ||
                    this.countBuildings('wall') > 0 ||
                    this.countBuildings('granary') > 0
                ) &&
                stability >= Math.max(0.5, 0.56 - this.getSettlementKnowledgeBonus('metallurgy') * 0.02)
            )) {
                this.unlockTechnology('metallurgy', 'Stone furnaces and hard labor hinted at early metallurgy.');
            }

            if (!this.hasTechnology('bronzeAge') && readiness.phase6 && (
                this.hasTechnology('metallurgy') &&
                this.hasTechnology('engineering') &&
                this.countBuildings('warehouse') >= 1 &&
                (this.countBuildings('foodHall') >= 1 || this.countBuildings('civicComplex') >= 1) &&
                (this.landUse?.tradeRoutes?.length || 0) >= 1 &&
                this.getColonySkillAverage('crafting') >= 5.2 &&
                this.getColonySkillAverage('building') >= 5 &&
                this.camp.food >= Math.max(24, this.colonists.length * 4) &&
                stability >= 0.62
            )) {
                this.unlockTechnology('bronzeAge', 'Trade, grain surplus, and alloy craft lifted the colony into a bronze age.');
            }
            if (!this.hasTechnology('ironAge') && readiness.phase6 && (
                this.hasTechnology('bronzeAge') &&
                this.hasTechnology('metallurgy') &&
                this.countBuildings('stoneKeep') >= 1 &&
                this.countBuildings('watchtower') >= 1 &&
                (this.landUse?.roads || []).filter((road) => road.surface === 'stone').length >= 4 &&
                this.getColonySkillAverage('combat') >= 4.8 &&
                this.getColonySkillAverage('building') >= 5.4 &&
                this.getColonySkillAverage('farming') >= 5 &&
                this.camp.food >= Math.max(30, this.colonists.length * 4.5) &&
                stability >= 0.66
            )) {
                this.unlockTechnology('ironAge', 'Roads, fortified borders, and disciplined metal craft carried the colony into an iron age.');
            }

            this.syncEraProgress('emergent');
        }

        updatePhase9WorldResponse(dt) {
            const terrainFeatures = this.getTerrainFeatureCounts();
            const diseaseKnob = this.getSimulationKnob('diseasePressure');
            const disasterKnob = this.getSimulationKnob('disasterFrequency');
            const activeColonies = this.getActiveBranchColonies();
            const nearbyTrees = this.resources.filter((resource) =>
                resource.type === 'trees' && !resource.depleted && distance(resource, this.camp) < 220
            ).length;
            const nearbyWater = this.resources.filter((resource) =>
                resource.type === 'water' && !resource.depleted && distance(resource, this.camp) < 240
            ).length;
            const livingAnimals = this.animals.filter((animal) => !animal.depleted).length;
            const nearbyAnimals = this.animals.filter((animal) =>
                !animal.depleted && distance(animal, this.camp) < 260
            ).length;
            const housingCount = this.countBuildings('leanTo') + this.countBuildings('hut') + this.countBuildings('cottage') + this.countBuildings('house') + this.countBuildings('fortifiedStructure') + this.countBuildings('stoneKeep');
            const storageCount = this.countBuildings('storage') + this.countBuildings('storagePit') + this.countBuildings('granary') + this.countBuildings('warehouse') + this.countBuildings('civicComplex');
            const defenseCount = this.countBuildings('watchtower') + this.countBuildings('wall') + this.countBuildings('fortifiedStructure') + this.countBuildings('stoneKeep');
            const farmCount = this.countBuildings('farmPlot') + this.countBuildings('engineeredFarm');
            const irrigationCount = this.countBuildings('irrigation') + this.countBuildings('canal');
            const engineeredFarmCount = this.countBuildings('engineeredFarm');
            const canalCount = this.countBuildings('canal');
            const stoneKeepCount = this.countBuildings('stoneKeep');
            const civicComplexCount = this.countBuildings('civicComplex');
            const campDensity = clamp((this.buildings.length + this.colonists.length * 0.85) / 30, 0, 1.6);
            const regionalConflict = this.getRegionalConflictPressure();
            const alliances = activeColonies.filter((colony) => colony.diplomacyState === 'allied').length;
            const tradingColonies = activeColonies.filter((colony) => ['allied', 'trading'].includes(colony.diplomacyState)).length;
            const activeCampaigns = activeColonies.filter((colony) => (colony.campaign?.state || 'idle') !== 'idle').length;
            const totalTrades = activeColonies.reduce((sum, colony) => sum + (colony.history?.trades || 0), 0);
            const totalRaids = activeColonies.reduce((sum, colony) => sum + (colony.history?.raids || 0), 0);
            const stability = this.getColonyStability();
            const forestLossTarget = clamp((1 - nearbyTrees / 18) * 0.65 + terrainFeatures.clearedForest / 20, 0, 1);
            const huntingPressureTarget = clamp(
                (this.countCompletedAction('huntAnimal') + this.countCompletedAction('huntMeal')) / Math.max(10, livingAnimals * 3 + nearbyAnimals * 2),
                0,
                1
            );
            const urbanDensityTarget = clamp(campDensity + Math.max(0, this.colonists.length - this.getBuildingCapacity()) * 0.05, 0, 1);
            const irrigationPressure = clamp((irrigationCount * 0.18) + (farmCount * 0.06) + canalCount * 0.08 + terrainFeatures.irrigationChannels * 0.03, 0, 1);
            const soilDepletionTarget = clamp(
                farmCount * 0.08 +
                irrigationCount * 0.05 +
                Math.max(0, 1 - nearbyWater / 4) * 0.14 +
                forestLossTarget * 0.1 -
                this.countBuildings('mill') * 0.04 -
                engineeredFarmCount * 0.08 -
                terrainFeatures.terracedCells * 0.02 -
                canalCount * 0.04,
                0,
                1
            );
            const fertilityTarget = clamp(
                1.02 -
                forestLossTarget * 0.28 -
                soilDepletionTarget * 0.18 +
                irrigationCount * 0.05 +
                engineeredFarmCount * 0.06 +
                terrainFeatures.terracedCells * 0.04,
                0.52,
                1.25
            );
            const rainfallTarget = clamp(
                1 -
                forestLossTarget * 0.24 +
                nearbyWater * 0.015 +
                terrainFeatures.drainedMarshCells * 0.008,
                0.55,
                1.18
            );
            const foodChainTarget = clamp(
                1 -
                huntingPressureTarget * 0.48 -
                Math.max(0, livingAnimals < 10 ? 0.12 : 0) -
                activeCampaigns * 0.03,
                0.35,
                1.05
            );
            const diseaseRiskTarget = clamp(
                urbanDensityTarget * 0.42 +
                irrigationPressure * 0.24 +
                terrainFeatures.drainedMarshCells * 0.02 +
                (this.getWeather().moisture > 0.2 ? 0.08 : 0) -
                (this.hasTechnology('medicineLore') ? 0.08 : 0),
                0,
                1
            );
            const soilHealthTarget = clamp(
                1 -
                soilDepletionTarget * 0.5 -
                this.phase9.pressure.blight * 0.16 +
                terrainFeatures.terracedCells * 0.05 +
                (this.getWeather().name === 'Rain' ? 0.04 : 0) +
                (this.getWeather().name === 'Storm' ? 0.03 : 0),
                0.35,
                1.1
            );

            this.phase9.ecology.forestLoss = lerp(this.phase9.ecology.forestLoss, forestLossTarget, 0.08);
            this.phase9.ecology.huntingPressure = lerp(this.phase9.ecology.huntingPressure, huntingPressureTarget, 0.08);
            this.phase9.ecology.fertility = lerp(this.phase9.ecology.fertility, fertilityTarget, 0.06);
            this.phase9.ecology.rainfall = lerp(this.phase9.ecology.rainfall, rainfallTarget, 0.04);
            this.phase9.ecology.foodChain = lerp(this.phase9.ecology.foodChain, foodChainTarget, 0.06);
            this.phase9.ecology.diseaseRisk = lerp(this.phase9.ecology.diseaseRisk, diseaseRiskTarget, 0.08);
            this.phase9.ecology.soilHealth = lerp(this.phase9.ecology.soilHealth, soilHealthTarget, 0.06);

            this.phase9.terraforming.clearForest = Math.max(this.phase9.terraforming.clearForest, terrainFeatures.clearedForest);
            this.phase9.terraforming.digIrrigation = Math.max(this.phase9.terraforming.digIrrigation, Math.max(irrigationCount, terrainFeatures.irrigationChannels));
            this.phase9.terraforming.quarryMountains = Math.max(this.phase9.terraforming.quarryMountains, terrainFeatures.quarriedMountains);
            this.phase9.terraforming.fortifyHills = Math.max(this.phase9.terraforming.fortifyHills, terrainFeatures.fortifiedHills);
            this.phase9.terraforming.buildTerraces = Math.max(this.phase9.terraforming.buildTerraces, terrainFeatures.terracedCells);
            this.phase9.terraforming.drainMarsh = Math.max(this.phase9.terraforming.drainMarsh, terrainFeatures.drainedMarshCells);

            this.updatePhase9Milestones({
                housingCount,
                storageCount,
                defenseCount,
                farmCount,
                irrigationCount,
                activeColonies,
                alliances,
                tradingColonies,
                activeCampaigns,
                totalTrades,
                totalRaids,
                stability
            });

            const milestoneCount = Object.values(this.phase9.milestones).filter(Boolean).length;
            this.phase9.pressure.weatherExtremes = clamp(
                milestoneCount * 0.11 +
                this.phase9.ecology.forestLoss * 0.34 +
                Math.max(0, 1 - this.phase9.ecology.rainfall) * 0.28,
                0,
                1
            );
            this.phase9.pressure.predatorMigrations = clamp(
                milestoneCount * 0.08 +
                Math.max(0, 1 - this.phase9.ecology.foodChain) * 0.55 +
                this.phase9.ecology.huntingPressure * 0.18,
                0,
                1
            );
            this.phase9.pressure.unrest = clamp(
                campDensity * 0.28 +
                regionalConflict * 0.44 +
                Math.max(0, 0.58 - stability) * 0.5 +
                totalRaids * 0.02,
                0,
                1
            );
            this.phase9.pressure.blight = clamp(
                irrigationPressure * 0.34 +
                Math.max(0, 1 - this.phase9.ecology.soilHealth) * 0.58 +
                (this.getWeather().name === 'Rain' || this.getWeather().name === 'Storm' ? 0.08 : 0),
                0,
                1
            );
            this.phase9.pressure.soilDepletion = clamp(
                soilDepletionTarget * 0.72 + Math.max(0, 1 - this.phase9.ecology.soilHealth) * 0.28,
                0,
                1
            );
            this.phase9.pressure.frequentSkirmishes = clamp(
                regionalConflict * 0.68 + activeCampaigns * 0.14 + totalRaids * 0.03,
                0,
                1
            );
            this.phase9.pressure.largeScaleBattles = clamp(
                this.phase9.pressure.frequentSkirmishes * 0.48 +
                activeCampaigns * 0.12 +
                (this.phase9.milestones.regionalPower ? 0.12 : 0),
                0,
                1
            );
            this.phase9.pressure.enemyTechEscalation = clamp(
                activeColonies.filter((colony) =>
                    (colony.population || 0) >= 4 &&
                    (
                        ['allied', 'trading', 'rival'].includes(colony.diplomacyState) ||
                        (colony.history?.raids || 0) > 0
                    )
                ).length * 0.18 +
                (this.phase9.milestones.regionalPower ? 0.18 : 0) +
                (this.hasTechnology('engineering') ? 0.12 : 0) +
                (this.hasTechnology('metallurgy') ? 0.18 : 0) +
                stoneKeepCount * 0.06 +
                civicComplexCount * 0.04,
                0,
                1
            );
            this.phase9.pressure.disease = clamp(
                this.phase9.ecology.diseaseRisk * 0.6 +
                this.phase9.pressure.blight * 0.2 +
                campDensity * 0.14,
                0,
                1
            ) * diseaseKnob;

            this.phase9.cooldowns.disease = Math.max(0, this.phase9.cooldowns.disease - dt * disasterKnob);
            this.phase9.cooldowns.unrest = Math.max(0, this.phase9.cooldowns.unrest - dt * disasterKnob);
            this.phase9.cooldowns.blight = Math.max(0, this.phase9.cooldowns.blight - dt * disasterKnob);
            this.phase9.cooldowns.predators = Math.max(0, this.phase9.cooldowns.predators - dt * disasterKnob);

            for (const colonist of this.colonists) {
                colonist.stats.morale = clamp(colonist.stats.morale - dt * this.phase9.pressure.unrest * 0.18, 0, 100);
                colonist.mood.conflict = clamp(colonist.mood.conflict + dt * this.phase9.pressure.unrest * 0.03, -5, 5);
                if (this.phase9.pressure.disease > 0.52) {
                    colonist.stats.health = clamp(colonist.stats.health - dt * this.phase9.pressure.disease * 0.06, 0, 100);
                }
            }

            if (farmCount > 0 && this.phase9.pressure.blight > 0.58 && this.phase9.cooldowns.blight <= 0) {
                const farm = this.buildings.find((building) => building.type === 'farmPlot') || null;
                if (farm) {
                    farm.harvestTimer = Math.max(0, farm.harvestTimer - 6);
                    this.camp.food = Math.max(0, this.camp.food - 1.2);
                    this.pushEvent('Blight weakened the nearby fields.');
                    this.phase9.cooldowns.blight = 28;
                }
            }

            if (this.phase9.pressure.disease > 0.6 && this.phase9.cooldowns.disease <= 0) {
                this.pushEvent('Dense settlement life spread sickness through the colony.');
                this.phase9.cooldowns.disease = 34;
            }

            if (this.phase9.pressure.unrest > 0.62 && this.phase9.cooldowns.unrest <= 0) {
                this.relationshipEvents.unshift('Crowding and pressure stirred unrest through the settlement.');
                this.relationshipEvents = this.relationshipEvents.slice(0, 10);
                this.phase9.cooldowns.unrest = 32;
            }

            if (this.phase9.pressure.predatorMigrations > 0.58 && this.phase9.cooldowns.predators <= 0 && this.predators.length < 7) {
                const angle = this.rng() * Math.PI * 2;
                const radius = 180 + this.rng() * 90;
                const x = clamp(this.camp.x + Math.cos(angle) * radius, 36, this.width - 36);
                const y = clamp(this.camp.y + Math.sin(angle) * radius, 36, this.height - 36);
                const predatorId = this.predators.reduce((maxId, predator) => Math.max(maxId, predator.id || 0), 0) + 1;
                this.predators.push(this.makePredator(predatorId, x, y, this.getCellAt(x, y).biome));
                this.pushEvent('Predators migrated closer to the growing settlements.');
                this.phase9.cooldowns.predators = 36;
            }

            if (livingAnimals < 14 && this.rng() < dt * 0.0007 * Math.max(0.25, this.phase9.ecology.foodChain)) {
                for (let attempt = 0; attempt < 10; attempt += 1) {
                    const cell = this.cells[Math.floor(this.rng() * this.cells.length)];
                    if (!cell || !['grassland', 'forest', 'fertile'].includes(cell.biome)) {
                        continue;
                    }
                    const x = cell.x + CELL_WIDTH * (0.2 + this.rng() * 0.6);
                    const y = cell.y + CELL_HEIGHT * (0.2 + this.rng() * 0.6);
                    if (distance({ x, y }, this.camp) < 120) {
                        continue;
                    }
                    const animalId = this.animals.reduce((maxId, animal) => Math.max(maxId, animal.id || 0), 0) + 1;
                    this.animals.push(this.makeAnimal(animalId, x, y, cell.biome));
                    break;
                }
            }
        }

        updatePhase9Milestones(context) {
            const nextMilestones = {
                permanentSettlement:
                    context.housingCount >= 2 &&
                    context.storageCount >= 1 &&
                    this.families.length >= 1 &&
                    context.stability >= 0.45,
                agriculturalStability:
                    context.farmCount >= 2 &&
                    this.camp.food >= Math.max(16, this.colonists.length * 4) &&
                    (context.irrigationCount >= 1 || this.countBuildings('mill') >= 1 || this.countBuildings('engineeredFarm') >= 1) &&
                    context.stability >= 0.5,
                fortifiedCivilization:
                    context.defenseCount >= 2 &&
                    (this.countBuildings('wall') >= 1 || this.countBuildings('watchtower') >= 1 || this.countBuildings('stoneKeep') >= 1) &&
                    context.stability >= 0.48,
                regionalPower:
                    context.activeColonies.length >= 2 &&
                    (context.alliances >= 1 || context.totalTrades >= 3 || context.activeCampaigns >= 1) &&
                    context.stability >= 0.46,
                terraformer:
                    this.phase9.terraforming.digIrrigation >= 2 &&
                    (
                        this.phase9.terraforming.clearForest >= 2 ||
                        this.phase9.terraforming.quarryMountains >= 1 ||
                        this.phase9.terraforming.buildTerraces >= 1 ||
                        this.phase9.terraforming.drainMarsh >= 1
                    )
            };
            const labels = {
                permanentSettlement: 'Permanent Settlement',
                agriculturalStability: 'Agricultural Stability',
                fortifiedCivilization: 'Fortified Civilization',
                regionalPower: 'Regional Power',
                terraformer: 'Terraformer'
            };
            for (const [key, reached] of Object.entries(nextMilestones)) {
                if (reached && !this.phase9.milestones[key]) {
                    this.phase9.milestones[key] = true;
                    this.pushEvent(`The civilization reached ${labels[key]}.`);
                    this.noteDiscovery(`phase9:${key}`, `${labels[key]} was achieved.`);
                } else if (!reached) {
                    this.phase9.milestones[key] = false;
                }
            }
        }

        getFailedActionCount(colonist, prefix) {
            return Object.entries(colonist.memory.failedActions || {}).reduce((sum, [action, count]) => (
                action.startsWith(prefix) ? sum + count : sum
            ), 0);
        }

        getRoleDemand() {
            const foodPressure = this.getStockpilePressure();
            const housingPressure = clamp((1 - this.getHousingSatisfaction()) * 8, 0, 8);
            const buildPressure = Math.min(8, this.projects.length * 3 + housingPressure);
            const crafterProbe = this.colonists.find((colonist) => colonist.alive) || null;
            const craftPressure = Math.min(8, (
                this.needsToolRepair() ? 2 : 0
            ) + (this.chooseProcessingTask() ? 2 : 0) + (crafterProbe && this.chooseCraftRecipe(crafterProbe) ? 2 : 0));
            const dangerPressure = Math.min(8, this.predators.length * 1.2 + this.colonyKnowledge.dangerZones.length * 0.25);
            return {
                farmer: foodPressure + this.countBuildings('farmPlot') * 0.8,
                builder: buildPressure + Math.min(4, this.getConstructionDemand('wood') + this.getConstructionDemand('stone')),
                gatherer: Math.max(foodPressure, this.getConstructionDemand('wood') * 0.8),
                hunter: foodPressure * 0.8 + dangerPressure,
                crafter: craftPressure + Math.min(4, this.getConstructionDemand('planks') * 0.9 + this.getConstructionDemand('rope') * 1.2)
            };
        }

        getBaseRoleScores(colonist) {
            const injuryPenalty = clamp((70 - colonist.stats.health) / 12, 0, 5);
            const exhaustionPenalty = clamp((45 - colonist.stats.energy) / 10, 0, 4);
            const farmingFailures = this.getFailedActionCount(colonist, 'plant');
            const huntingFailures = this.getFailedActionCount(colonist, 'hunt');
            const buildFailures = this.getFailedActionCount(colonist, 'build');
            const gatherFailures = this.getFailedActionCount(colonist, 'collectFood');
            const roleDemand = this.getRoleDemand();
            const dependentChildren = this.getDependentChildrenCount(colonist);
            const caretakerPressure = dependentChildren > 0 ? Math.min(4, dependentChildren * 1.2) : 0;
            const lastFamilyAdult = this.isLastFamilyAdult(colonist);
            const guardianCaution = lastFamilyAdult ? 1.8 + caretakerPressure * 0.45 : 0;

            return {
                farmer: Math.max(0, colonist.skills.farming * 1.35 + colonist.skills.survival * 0.2 + roleDemand.farmer + (colonist.intent === 'plant' ? 2.5 : 0) - farmingFailures * 0.85 - injuryPenalty * 0.35 + caretakerPressure * 0.7 + guardianCaution * 0.6),
                builder: Math.max(0, colonist.skills.building * 1.3 + colonist.skills.crafting * 0.3 + roleDemand.builder + (colonist.intent === 'build' ? 2.5 : 0) - buildFailures * 0.7 - injuryPenalty * 0.25 - exhaustionPenalty * 0.25 - guardianCaution * 0.9),
                gatherer: Math.max(0, colonist.skills.foraging * 1.25 + colonist.skills.survival * 0.45 + roleDemand.gatherer + (colonist.intent === 'forage' ? 2.2 : 0) - gatherFailures * 0.45 + farmingFailures * 0.5 + caretakerPressure * 0.55 + guardianCaution * 0.45),
                hunter: Math.max(0, colonist.skills.hunting * 1.35 + colonist.skills.combat * 0.35 + roleDemand.hunter + (colonist.intent === 'hunt' ? 2.2 : 0) - huntingFailures * 0.8 - injuryPenalty * 1.05 - exhaustionPenalty * 0.7 - guardianCaution * 2.4),
                crafter: Math.max(0, colonist.skills.crafting * 1.4 + colonist.skills.building * 0.2 + colonist.skills.medicine * 0.3 + roleDemand.crafter + ((colonist.intent === 'craft' || colonist.intent === 'process' || colonist.intent === 'repair') ? 2.4 : 0) + injuryPenalty * 0.65 + exhaustionPenalty * 0.25 + huntingFailures * 0.45 + caretakerPressure * 0.9 + guardianCaution * 1.2)
            };
        }

        getRoleScores(colonist) {
            if (colonist.lifeStage !== 'adult') {
                return {
                    farmer: 0,
                    builder: 0,
                    gatherer: 0,
                    hunter: 0,
                    crafter: 0
                };
            }
            const scores = this.getBaseRoleScores(colonist);
            const counts = { farmer: 0, builder: 0, gatherer: 0, hunter: 0, crafter: 0 };
            for (const peer of this.colonists) {
                if (peer === colonist || !peer.alive || peer.lifeStage !== 'adult') {
                    continue;
                }
                const peerScores = this.getBaseRoleScores(peer);
                const role = Object.entries(peerScores).sort((a, b) => b[1] - a[1])[0]?.[0];
                if (role) {
                    counts[role] += 1;
                }
            }
            const adultCount = this.colonists.filter((peer) => peer.alive && peer.lifeStage === 'adult').length;
            const targetPerRole = Math.max(1, adultCount / 4);
            for (const role of Object.keys(scores)) {
                const shortage = Math.max(0, targetPerRole - counts[role]);
                const crowding = Math.max(0, counts[role] - targetPerRole);
                scores[role] += shortage * 1.6;
                scores[role] -= crowding * 1.9;
            }
            const eraRoleBias = {
                survival: { gatherer: 1.8, hunter: 1.2, builder: 0.4 },
                toolmaking: { crafter: 1.8, builder: 0.8, gatherer: 0.5 },
                agriculture: { farmer: 2.6, gatherer: -0.8, hunter: -0.4 },
                masonry: { builder: 2.8, crafter: 1.2 },
                medicine: { crafter: 1.2, farmer: 0.4 },
                'military organization': { hunter: 2.2, builder: 0.8 },
                engineering: { builder: 2.4, crafter: 2.1, farmer: 0.7 },
                metallurgy: { builder: 1.6, crafter: 2.4, hunter: 1 },
                'bronze age': { crafter: 2.8, builder: 2.1, farmer: 1.2, hunter: 0.4 },
                'iron age': { builder: 2.8, farmer: 1.9, crafter: 1.8, hunter: 0.3, gatherer: -0.4 }
            }[this.getCurrentEra()] || null;
            if (eraRoleBias) {
                for (const [role, bias] of Object.entries(eraRoleBias)) {
                    scores[role] = Math.max(0, (scores[role] || 0) + bias);
                }
            }
            return scores;
        }

        getEraProjectPriorities() {
            const era = this.getCurrentEra();
            switch (era) {
                case 'survival':
                    return ['leanTo', 'hut', 'campfire', 'storage', 'workshop'];
                case 'toolmaking':
                    return ['workshop', 'storage', 'hut', 'farmPlot'];
                case 'agriculture':
                    return ['farmPlot', 'storagePit', 'granary', 'kitchen', 'irrigation'];
                case 'masonry':
                    return ['cottage', 'granary', 'watchtower', 'wall'];
                case 'engineering':
                    return ['house', 'warehouse', 'mill', 'canal', 'civicComplex', 'engineeredFarm'];
                case 'metallurgy':
                    return ['fortifiedStructure', 'stoneKeep', 'warehouse', 'civicComplex'];
                case 'bronze age':
                    return ['stoneKeep', 'civicComplex', 'foodHall', 'warehouse', 'mill', 'engineeredFarm'];
                case 'iron age':
                    return ['stoneKeep', 'watchtower', 'civicComplex', 'warehouse', 'engineeredFarm', 'foodHall'];
                default:
                    return [];
            }
        }

        getProjectDistrictType(type) {
            const map = {
                leanTo: 'housing',
                hut: 'housing',
                cottage: 'housing',
                house: 'housing',
                fortifiedStructure: 'defense',
                stoneKeep: 'defense',
                farmPlot: 'farming',
                engineeredFarm: 'farming',
                irrigation: 'farming',
                canal: 'farming',
                mill: 'craft',
                storage: 'storage',
                storagePit: 'storage',
                granary: 'storage',
                warehouse: 'storage',
                workshop: 'craft',
                kitchen: 'civic',
                foodHall: 'civic',
                civicComplex: 'civic',
                watchtower: 'defense',
                wall: 'defense',
                campfire: 'civic'
            };
            return map[type] || 'housing';
        }

        getDistrictCenter(type) {
            const district = (this.landUse?.districts || []).find((entry) => entry.type === type);
            if (district) {
                return { x: district.x, y: district.y, radius: district.radius };
            }
            const matches = this.buildings.filter((building) => this.getProjectDistrictType(building.type) === type);
            if (!matches.length) {
                return null;
            }
            return {
                x: matches.reduce((sum, building) => sum + building.x, 0) / matches.length,
                y: matches.reduce((sum, building) => sum + building.y, 0) / matches.length,
                radius: 48 + matches.length * 10
            };
        }

        getFrontierBearing() {
            const rivals = this.getActiveBranchColonies().filter((colony) => colony.diplomacyState === 'rival');
            if (!rivals.length) {
                return { x: 1, y: -0.2 };
            }
            const avgX = rivals.reduce((sum, colony) => sum + colony.x, 0) / rivals.length;
            const avgY = rivals.reduce((sum, colony) => sum + colony.y, 0) / rivals.length;
            const dx = avgX - this.camp.x;
            const dy = avgY - this.camp.y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: dx / len, y: dy / len };
        }

        getDistrictPlacementAnchor(type) {
            const camp = this.camp;
            const frontier = this.getFrontierBearing();
            const defenseVector = { x: frontier.x, y: frontier.y };
            const civicVector = { x: frontier.y * 0.2, y: -frontier.x * 0.2 };
            const anchors = {
                housing: { x: camp.x - 52, y: camp.y + 8, spread: 26 },
                farming: { x: camp.x - 118, y: camp.y + 72, spread: 34 },
                storage: { x: camp.x + 76, y: camp.y + 18, spread: 24 },
                craft: { x: camp.x + 112, y: camp.y - 8, spread: 22 },
                civic: { x: camp.x + civicVector.x * 28, y: camp.y + civicVector.y * 28, spread: 18 },
                defense: {
                    x: clamp(camp.x + defenseVector.x * 148, 50, this.width - 50),
                    y: clamp(camp.y + defenseVector.y * 148, 50, this.height - 50),
                    spread: 30
                }
            };
            return anchors[type] || { x: camp.x, y: camp.y, spread: 24 };
        }

        getInstitutionSites() {
            const sites = [];
            const civicCenter = this.getDistrictCenter('civic') || { x: this.camp.x, y: this.camp.y, radius: 48 };
            const craftCenter = this.getDistrictCenter('craft') || civicCenter;
            const storageCenter = this.getDistrictCenter('storage') || civicCenter;
            const has = (type) => this.countBuildings(type) > 0;
            if (has('campfire')) {
                sites.push({
                    id: 'hearth-circle',
                    type: 'hearth circle',
                    x: this.camp.x,
                    y: this.camp.y - 8,
                    influence: clamp(0.2 + this.colonists.length * 0.025, 0.22, 0.9),
                    era: 'survival'
                });
            }
            if (has('kitchen') || has('foodHall')) {
                sites.push({
                    id: 'commons',
                    type: has('foodHall') ? 'common hall' : 'shared kitchen',
                    x: civicCenter.x + 14,
                    y: civicCenter.y - 10,
                    influence: clamp(0.26 + this.countBuildings('foodHall') * 0.18 + this.families.length * 0.04, 0.24, 1),
                    era: this.getCurrentEra()
                });
            }
            if (has('civicComplex')) {
                sites.push({
                    id: 'council',
                    type: 'council hall',
                    x: civicCenter.x,
                    y: civicCenter.y - 28,
                    influence: clamp(0.36 + this.getActiveBranchColonies().length * 0.08, 0.3, 1),
                    era: this.getCurrentEra()
                });
            }
            if ((has('workshop') || has('mill')) && (has('civicComplex') || this.hasTechnology('engineering'))) {
                sites.push({
                    id: 'school',
                    type: this.hasTechnology('engineering') ? 'learning hall' : 'craft lodge',
                    x: craftCenter.x + 20,
                    y: craftCenter.y - 16,
                    influence: clamp(0.24 + this.countBuildings('mill') * 0.14 + this.getColonySkillAverage('crafting') * 0.04, 0.22, 1),
                    era: this.getCurrentEra()
                });
            }
            if ((this.landUse?.tradeRoutes || []).length > 0 || this.getActiveBranchColonies().some((colony) => ['allied', 'trading'].includes(colony.diplomacyState))) {
                sites.push({
                    id: 'trade',
                    type: this.hasTechnology('engineering') ? 'trade market' : 'barter ground',
                    x: storageCenter.x + 18,
                    y: storageCenter.y + 18,
                    influence: clamp(0.22 + (this.landUse?.tradeRoutes?.length || 0) * 0.16, 0.2, 1),
                    era: this.getCurrentEra()
                });
            }
            return sites;
        }

        updateInstitutionLife(dt) {
            const sites = this.getInstitutionSites();
            const cohesionTarget = clamp(
                sites.reduce((sum, site) => sum + (site.type === 'hearth circle' || site.type === 'common hall' || site.type === 'shared kitchen' ? site.influence : 0), 0) * 0.42 +
                this.families.length * 0.035,
                0.12,
                1
            );
            const governanceTarget = clamp(
                sites.reduce((sum, site) => sum + (site.type === 'council hall' ? site.influence : 0), 0) * 0.8 +
                this.getActiveBranchColonies().length * 0.05,
                0,
                1
            );
            const learningTarget = clamp(
                sites.reduce((sum, site) => sum + (site.type === 'learning hall' || site.type === 'craft lodge' ? site.influence : 0), 0) * 0.72,
                0,
                1
            );
            const tradeTarget = clamp(
                sites.reduce((sum, site) => sum + (site.type === 'trade market' || site.type === 'barter ground' ? site.influence : 0), 0) * 0.76,
                0,
                1
            );
            this.institutionLife.cohesion = lerp(this.institutionLife.cohesion || 0, cohesionTarget, dt * 0.2);
            this.institutionLife.governance = lerp(this.institutionLife.governance || 0, governanceTarget, dt * 0.18);
            this.institutionLife.learning = lerp(this.institutionLife.learning || 0, learningTarget, dt * 0.18);
            this.institutionLife.tradeCulture = lerp(this.institutionLife.tradeCulture || 0, tradeTarget, dt * 0.18);
            for (const colonist of this.colonists) {
                colonist.stats.morale = clamp(
                    colonist.stats.morale +
                    dt * this.institutionLife.cohesion * 0.12 +
                    dt * this.institutionLife.governance * 0.06,
                    0,
                    100
                );
                colonist.mood.conflict = clamp(
                    colonist.mood.conflict -
                    dt * this.institutionLife.cohesion * 0.018 -
                    dt * this.institutionLife.governance * 0.01,
                    -5,
                    5
                );
            }
            const institutionIds = sites.map((site) => site.id);
            for (const site of sites) {
                if (this.knownInstitutions.includes(site.id)) {
                    continue;
                }
                this.knownInstitutions.unshift(site.id);
                this.knownInstitutions = this.knownInstitutions.slice(0, 12);
                this.pushEvent(`The colony established a ${site.type}.`);
            }
            this.landUse.institutionSites = sites;
        }

        getSoftRole(colonist) {
            if (colonist.lifeStage !== 'adult') {
                return 'youth';
            }
            const entries = Object.entries(this.getRoleScores(colonist)).sort((a, b) => b[1] - a[1]);
            return entries[0]?.[0] || 'gatherer';
        }

        getRoleBias(colonist, role) {
            const scores = this.getRoleScores(colonist);
            const max = Math.max(...Object.values(scores));
            if (!max) {
                return 0;
            }
            return clamp((scores[role] || 0) / max, 0, 1);
        }

        canPursueBuilding(type) {
            const projected = this.getProjectedBuildingRequirements(type);
            const checks = {
                campfire: () => this.camp.structures.firePit > 0,
                leanTo: () => this.countCompletedAction('collectWood') >= 8 && this.camp.wood >= 6,
                hut: () => this.countBuildings('leanTo') >= 1 && this.getCampMaterial('planks') >= 4 && this.getColonySkillAverage('building') >= 3.2,
                cottage: () => this.hasTechnology('masonry') && this.countBuildings('hut') >= 1 && this.getCampMaterial('planks') >= (projected.planks || 0) && this.camp.stone >= (projected.stone || 0),
                house: () => this.hasTechnology('engineering') && this.countBuildings('cottage') >= 1 && this.getCampMaterial('planks') >= (projected.planks || 0) && this.camp.stone >= (projected.stone || 0) && this.getCampMaterial('rope') >= Math.max(1, projected.rope || 0),
                fortifiedStructure: () => this.hasTechnology('militaryOrganization') && this.hasTechnology('masonry') && this.countBuildings('house') >= 1 && this.camp.stone >= (projected.stone || 0) && this.getCampMaterial('planks') >= (projected.planks || 0),
                storagePit: () => this.hasTechnology('storagePlanning') && this.countCompletedAction('collectWood') >= 10,
                storage: () => this.colonyKnowledge.discoveries.includes('skill:tool_use') && this.countCompletedAction('collectWood') >= 12,
                granary: () => this.hasTechnology('storagePlanning') && this.countBuildings('storage') + this.countBuildings('storagePit') >= 1 && this.getCampMaterial('planks') >= (projected.planks || 0) && this.camp.stone >= (projected.stone || 0),
                warehouse: () => this.hasTechnology('engineering') && this.countBuildings('granary') >= 1 && this.getCampMaterial('planks') >= (projected.planks || 0) && this.camp.stone >= (projected.stone || 0),
                workshop: () => this.colonyKnowledge.discoveries.includes('skill:tool_use') && this.countCompletedAction('craftRecipe') >= 4 && this.getCampMaterial('planks') >= 2,
                kitchen: () => this.hasTechnology('agriculture') && this.countBuildings('campfire') >= 1 && this.getCampMaterial('planks') >= (projected.planks || 0) && this.camp.stone >= (projected.stone || 0),
                foodHall: () => this.hasTechnology('engineering') && this.countBuildings('kitchen') >= 1 && this.colonists.length >= 4 && this.getCampMaterial('planks') >= (projected.planks || 0),
                farmPlot: () => this.colonyKnowledge.discoveries.includes('skill:planting') && this.countCompletedAction('plantTrial') >= 2,
                irrigation: () => this.hasTechnology('irrigation') && this.countBuildings('farmPlot') >= 2 && this.camp.stone >= 2,
                watchtower: () => this.hasTechnology('militaryOrganization') && this.predators.length > 0 && this.getCampMaterial('planks') >= 4,
                wall: () => this.hasTechnology('militaryOrganization') && this.countBuildings('watchtower') >= 1 && this.camp.stone >= 8,
                mill: () => this.hasTechnology('engineering') && (this.countBuildings('workshop') >= 1 || this.countCompletedAction('craftRecipe') >= 8) && this.countBuildings('farmPlot') >= 1 && this.getCampMaterial('planks') >= 8,
                engineeredFarm: () => this.hasTechnology('engineering') && this.countBuildings('farmPlot') + this.countBuildings('engineeredFarm') >= Math.max(2, 3 - Math.floor(this.getSettlementKnowledgeBonus('storage') * 0.3)) && this.getUpgradeableBuilding('engineeredFarm') && this.getCampMaterial('planks') >= Math.max(2, (projected.planks || 0) - Math.floor(this.getSettlementKnowledgeBonus('civic') * 0.5)) && this.camp.stone >= Math.max(3, (projected.stone || 0) - Math.floor(this.getSettlementKnowledgeBonus('storage') * 0.5)),
                canal: () => this.hasTechnology('engineering') && this.hasTechnology('irrigation') && this.getUpgradeableBuilding('canal') && this.camp.stone >= Math.max(4, (projected.stone || 0) - Math.floor(this.getSettlementKnowledgeBonus('storage') * 0.4)),
                civicComplex: () => this.hasTechnology('engineering') && this.getUpgradeableBuilding('civicComplex') && this.colonists.length >= Math.max(5, 7 - Math.floor(this.getSettlementKnowledgeBonus('civic') * 0.4)) && this.getCampMaterial('planks') >= Math.max(4, (projected.planks || 0) - Math.floor(this.getSettlementKnowledgeBonus('civic') * 0.6)) && this.camp.stone >= Math.max(4, (projected.stone || 0) - Math.floor(this.getSettlementKnowledgeBonus('storage') * 0.4)),
                stoneKeep: () => this.hasTechnology('metallurgy') && this.getUpgradeableBuilding('stoneKeep') && this.camp.stone >= Math.max(8, (projected.stone || 0) - Math.floor(this.getSettlementKnowledgeBonus('defense') * 0.8)) && this.getCampMaterial('planks') >= Math.max(4, (projected.planks || 0) - Math.floor(this.getSettlementKnowledgeBonus('housing') * 0.5))
            };
            return (checks[type] || (() => false))();
        }

        getUpgradeableBuilding(type) {
            const targets = BUILDING_UPGRADES[type];
            if (!targets?.length) {
                return null;
            }
            return this.buildings
                .filter((building) => targets.includes(building.type))
                .sort((left, right) => {
                    const leftScore = this.getBuildingIntegrityRatio(left) + (left.completedYear || 0) * 0.01 + (left.completedDay || 0) * 0.001;
                    const rightScore = this.getBuildingIntegrityRatio(right) + (right.completedYear || 0) * 0.01 + (right.completedDay || 0) * 0.001;
                    return leftScore - rightScore;
                })[0] || null;
        }

        getProjectedBuildingRequirements(type) {
            const target = this.getUpgradeableBuilding(type);
            return target
                ? this.getUpgradeRequirements(type, target.type)
                : (BUILDING_DEFS[type]?.materials || {});
        }

        chooseNextProjectType() {
            const housing = this.getHousingSatisfaction();
            const stockpile = this.getStockpilePressure();
            const stability = this.getColonyStability();
            const winterized = this.hasTechnology('insulation') || this.getSeason().name === 'Winter';
            const predatorPressure = this.getPredatorPressure();
            const regionalConflict = this.getRegionalConflictPressure();
            const housingKnowledge = this.getSettlementKnowledgeBonus('housing');
            const storageKnowledge = this.getSettlementKnowledgeBonus('storage');
            const civicKnowledge = this.getSettlementKnowledgeBonus('civic');
            const defenseKnowledge = this.getSettlementKnowledgeBonus('defense');
            const phase9Ready = this.phase9.milestones.permanentSettlement || this.phase9.milestones.agriculturalStability || this.phase9.milestones.fortifiedCivilization || this.phase9.milestones.regionalPower;
            for (const type of this.getEraProjectPriorities()) {
                if (!this.canPursueBuilding(type)) {
                    continue;
                }
                if (type === 'farmPlot' && (stockpile > 1.1 || this.countBuildings('farmPlot') < 1)) {
                    return type;
                }
                if (type === 'storagePit' && stockpile > 1.2) {
                    return type;
                }
                if (type === 'granary' && (stockpile > 1.4 || storageKnowledge >= 1.2)) {
                    return type;
                }
                if (type === 'watchtower' && this.getRegionalConflictPressure() > 0.18) {
                    return type;
                }
                if (type === 'wall' && regionalConflict > 0.36) {
                    return type;
                }
                if (type === 'cottage' && housing < 1.12) {
                    return type;
                }
                if (type === 'house' && (housing < 1.14 || stability > 0.56)) {
                    return type;
                }
                if (type === 'warehouse' && (this.camp.food > this.getStorageCapacity() * 0.18 || stockpile > 0.9)) {
                    return type;
                }
                if (type === 'mill' && this.countBuildings('farmPlot') >= 1) {
                    return type;
                }
                if (type === 'canal' && (this.camp.water < 12 || this.getWeather().name === 'Drought')) {
                    return type;
                }
                if (type === 'civicComplex' && (civicKnowledge >= 1.8 || this.colonists.length >= 5)) {
                    return type;
                }
                if (type === 'engineeredFarm' && (phase9Ready || this.countBuildings('farmPlot') >= 2)) {
                    return type;
                }
                if (type === 'fortifiedStructure' && regionalConflict > 0.42) {
                    return type;
                }
                if (type === 'stoneKeep' && (regionalConflict > 0.62 || this.phase9.pressure.largeScaleBattles > 0.2)) {
                    return type;
                }
                if (type === 'workshop' || type === 'campfire' || type === 'storage' || type === 'hut' || type === 'kitchen') {
                    return type;
                }
            }
            if ((housing < 1.08 || (winterized && stability > 0.62) || housingKnowledge >= 1.5) && this.getUpgradeableBuilding('cottage') && this.canPursueBuilding('cottage')) {
                return 'cottage';
            }
            if (this.countBuildings('storagePit') < 1 && stockpile > 1.8 && this.canPursueBuilding('storagePit')) {
                return 'storagePit';
            }
            if (this.getUpgradeableBuilding('granary') && this.canPursueBuilding('granary') && (this.camp.food > this.getStorageCapacity() * 0.45 || storageKnowledge >= 1.5)) {
                return 'granary';
            }
            if (this.countBuildings('watchtower') < 1 && this.canPursueBuilding('watchtower')) {
                return 'watchtower';
            }
            if (regionalConflict > 0.54 && this.countBuildings('wall') < 1 && this.canPursueBuilding('wall')) {
                return 'wall';
            }
            if (this.countBuildings('irrigation') < 1 && this.canPursueBuilding('irrigation') && (this.getWeather().name === 'Drought' || this.camp.water < 10)) {
                return 'irrigation';
            }
            if (this.camp.structures.firePit > 0 && this.countBuildings('campfire') < 1 && this.canPursueBuilding('campfire')) {
                return 'campfire';
            }
            if ((housing < 1.08 || this.colonists.length > this.getBuildingCapacity()) && this.countBuildings('leanTo') < Math.max(2, Math.ceil(this.colonists.length / 4)) && this.canPursueBuilding('leanTo')) {
                return 'leanTo';
            }
            if ((housing < 1 || this.colonists.length >= 4) && this.countBuildings('hut') < 1 && this.canPursueBuilding('hut')) {
                return 'hut';
            }
            if (stockpile > 2.5 && this.countBuildings('farmPlot') < 2 && this.canPursueBuilding('farmPlot')) {
                return 'farmPlot';
            }
            if (this.countBuildings('storage') < 1 && (this.camp.food + this.camp.water + this.camp.wood + this.camp.stone) > this.getStorageCapacity() * 0.55 && this.canPursueBuilding('storage')) {
                return 'storage';
            }
            if (this.countBuildings('workshop') < 1 && this.canPursueBuilding('workshop')) {
                return 'workshop';
            }
            if ((this.camp.food > 20 || this.countBuildings('farmPlot') >= 2 || civicKnowledge >= 1.25) && this.getUpgradeableBuilding('kitchen') && this.canPursueBuilding('kitchen')) {
                return 'kitchen';
            }
            if ((this.countBuildings('farmPlot') >= 1 || this.camp.food > 20 || civicKnowledge >= 1.5) && this.countBuildings('mill') < 1 && this.canPursueBuilding('mill')) {
                return 'mill';
            }
            if ((housing < 1.12 || stability > 0.58 || this.families.length >= 1 || housingKnowledge >= 2.2 || regionalConflict > 0.66) && this.getUpgradeableBuilding('house') && this.canPursueBuilding('house')) {
                return 'house';
            }
            if (this.countBuildings('wall') < 1 && this.canPursueBuilding('wall')) {
                return 'wall';
            }
            if ((this.camp.food > 24 || this.colonists.length >= 5 || civicKnowledge >= 2 || regionalConflict > 0.62) && this.getUpgradeableBuilding('foodHall') && this.canPursueBuilding('foodHall')) {
                return 'foodHall';
            }
            if ((housing < 1.02 || (stability > 0.64 && predatorPressure > 4) || defenseKnowledge >= 2 || regionalConflict > 0.58) && this.getUpgradeableBuilding('fortifiedStructure') && this.canPursueBuilding('fortifiedStructure')) {
                return 'fortifiedStructure';
            }
            if (this.getUpgradeableBuilding('warehouse') && this.canPursueBuilding('warehouse') && (this.camp.food > this.getStorageCapacity() * 0.25 || stability > 0.58 || storageKnowledge >= 2 || regionalConflict > 0.52)) {
                return 'warehouse';
            }
            if (phase9Ready && this.canPursueBuilding('engineeredFarm') && (
                this.phase9.pressure.soilDepletion > 0.32 ||
                this.phase9.ecology.fertility < 0.82 ||
                this.phase9.terraforming.buildTerraces >= 1 ||
                storageKnowledge >= 1.8
            )) {
                return 'engineeredFarm';
            }
            if (phase9Ready && this.canPursueBuilding('canal') && (
                this.phase9.pressure.weatherExtremes > 0.3 ||
                this.phase9.pressure.soilDepletion > 0.28 ||
                this.camp.water < 12 ||
                storageKnowledge >= 2
            )) {
                return 'canal';
            }
            if (phase9Ready && this.canPursueBuilding('civicComplex') && (
                civicKnowledge >= 2.4 ||
                this.phase9.pressure.unrest > 0.34 ||
                this.getActiveBranchColonies().length >= 2 ||
                this.colonyKnowledge.discoveries.includes('shared_settlement_methods')
            )) {
                return 'civicComplex';
            }
            if (phase9Ready && this.canPursueBuilding('stoneKeep') && (
                defenseKnowledge >= 2.8 ||
                regionalConflict > 0.7 ||
                this.phase9.pressure.largeScaleBattles > 0.4 ||
                this.phase9.pressure.enemyTechEscalation > 0.55
            )) {
                return 'stoneKeep';
            }
            if (housing < 0.82 && this.countBuildings('hut') < 2 && this.canPursueBuilding('hut')) {
                return 'hut';
            }
            return null;
        }

        chooseProjectSite(type) {
            const upgradeTarget = this.getUpgradeableBuilding(type);
            if (upgradeTarget) {
                return {
                    x: upgradeTarget.x,
                    y: upgradeTarget.y,
                    gridCol: upgradeTarget.gridCol ?? null,
                    gridRow: upgradeTarget.gridRow ?? null,
                    targetBuildingId: upgradeTarget.id,
                    targetBuildingType: upgradeTarget.type
                };
            }
            const ring = 86 + this.buildings.length * 18;
            const index = this.buildings.length + this.projects.length;
            const angle = -Math.PI / 3 + index * 0.82;
            const baseX = clamp(this.camp.x + Math.cos(angle) * ring, 60, this.width - 60);
            const baseY = clamp(this.camp.y + Math.sin(angle) * ring, 60, this.height - 60);
            if (type === 'farmPlot') {
                const plantingSpot = this.findPlantingSpot();
                const snapped = this.snapProjectSiteToGrid(type,
                    clamp(plantingSpot.x + (this.rng() - 0.5) * 18, 50, this.width - 50),
                    clamp(plantingSpot.y + (this.rng() - 0.5) * 18, 50, this.height - 50)
                );
                if (this.isProjectSiteWithinWorkingRange(type, snapped.x, snapped.y)) {
                    return this.findOpenProjectSite(type, snapped) || snapped;
                }
                const fallback = this.snapProjectSiteToGrid(type,
                    clamp(this.camp.x + 48 + (this.rng() - 0.5) * 24, 50, this.width - 50),
                    clamp(this.camp.y + 36 + (this.rng() - 0.5) * 24, 50, this.height - 50)
                );
                return this.findOpenProjectSite(type, fallback) || fallback;
            }
            if (type === 'engineeredFarm' || type === 'irrigation' || type === 'canal') {
                const farming = this.getDistrictCenter('farming');
                if (farming) {
                    const snapped = this.snapProjectSiteToGrid(type,
                        clamp(farming.x + (this.rng() - 0.5) * 26, 50, this.width - 50),
                        clamp(farming.y + (this.rng() - 0.5) * 26, 50, this.height - 50)
                    );
                    if (this.isProjectSiteWithinWorkingRange(type, snapped.x, snapped.y)) {
                        return this.findOpenProjectSite(type, snapped) || snapped;
                    }
                }
            }
            const districtType = this.getProjectDistrictType(type);
            const existingDistrict = this.getDistrictCenter(districtType);
            const anchor = existingDistrict || this.getDistrictPlacementAnchor(districtType);
            const spread = existingDistrict ? Math.max(18, Math.min(54, (existingDistrict.radius || 42) * 0.42)) : anchor.spread;
            let x = clamp(anchor.x + (this.rng() - 0.5) * spread, 50, this.width - 50);
            let y = clamp(anchor.y + (this.rng() - 0.5) * spread, 50, this.height - 50);
            if (districtType === 'civic') {
                x = clamp(anchor.x + (this.rng() - 0.5) * 12, 50, this.width - 50);
                y = clamp(anchor.y + (this.rng() - 0.5) * 12, 50, this.height - 50);
            } else if (districtType === 'defense') {
                const bearing = this.getFrontierBearing();
                const side = this.rng() < 0.5 ? -1 : 1;
                x = clamp(anchor.x + bearing.y * side * 26 + (this.rng() - 0.5) * 10, 50, this.width - 50);
                y = clamp(anchor.y - bearing.x * side * 26 + (this.rng() - 0.5) * 10, 50, this.height - 50);
            }
            const snapped = this.snapProjectSiteToGrid(type, x, y || baseY);
            if (!this.isProjectSiteWithinWorkingRange(type, snapped.x, snapped.y)) {
                const nearbyCamp = this.snapProjectSiteToGrid(type,
                    clamp(this.camp.x + (this.rng() - 0.5) * 56, 50, this.width - 50),
                    clamp(this.camp.y + (this.rng() - 0.5) * 56, 50, this.height - 50)
                );
                return this.findOpenProjectSite(type, nearbyCamp) || nearbyCamp;
            }
            return this.findOpenProjectSite(type, snapped) || snapped;
        }

        getPlacementSpan(type) {
            if (type === 'farmPlot' || type === 'engineeredFarm' || type === 'hut') {
                return { cols: 2, rows: 2 };
            }
            return { cols: 1, rows: 1 };
        }

        snapProjectSiteToGrid(type, x, y) {
            const span = this.getPlacementSpan(type);
            const col = clamp(Math.round(x / CELL_WIDTH) - Math.floor(span.cols / 2), 0, GRID_COLS - span.cols);
            const row = clamp(Math.round(y / CELL_HEIGHT) - Math.floor(span.rows / 2), 0, GRID_ROWS - span.rows);
            return {
                x: col * CELL_WIDTH + CELL_WIDTH * span.cols * 0.5,
                y: row * CELL_HEIGHT + CELL_HEIGHT * span.rows * 0.5,
                gridCol: col,
                gridRow: row
            };
        }

        getEntryAnchor(entry, type = entry?.type) {
            if (!entry || !type) {
                return null;
            }
            if (Number.isFinite(entry.gridCol) && Number.isFinite(entry.gridRow)) {
                const span = this.getPlacementSpan(type);
                return {
                    gridCol: entry.gridCol,
                    gridRow: entry.gridRow,
                    x: entry.gridCol * CELL_WIDTH + CELL_WIDTH * span.cols * 0.5,
                    y: entry.gridRow * CELL_HEIGHT + CELL_HEIGHT * span.rows * 0.5
                };
            }
            return this.snapProjectSiteToGrid(type, entry.x, entry.y);
        }

        isFootprintOpen(type, anchor, occupied) {
            const span = this.getPlacementSpan(type);
            for (let row = 0; row < span.rows; row += 1) {
                for (let col = 0; col < span.cols; col += 1) {
                    const key = `${anchor.gridCol + col},${anchor.gridRow + row}`;
                    if (occupied.has(key)) {
                        return false;
                    }
                }
            }
            return true;
        }

        markFootprint(type, anchor, occupied) {
            const span = this.getPlacementSpan(type);
            for (let row = 0; row < span.rows; row += 1) {
                for (let col = 0; col < span.cols; col += 1) {
                    occupied.add(`${anchor.gridCol + col},${anchor.gridRow + row}`);
                }
            }
        }

        assignEntryAnchor(entry, type, anchor) {
            if (!entry || !anchor) {
                return;
            }
            entry.gridCol = anchor.gridCol;
            entry.gridRow = anchor.gridRow;
            entry.x = anchor.x;
            entry.y = anchor.y;
        }

        findOpenAnchor(type, originX, originY, occupied) {
            let anchor = this.snapProjectSiteToGrid(type, originX, originY);
            if (this.isFootprintOpen(type, anchor, occupied)) {
                return anchor;
            }
            const attempts = 28;
            const spread = Math.max(1, Math.round(this.getPlacementRadius(type) / Math.min(CELL_WIDTH, CELL_HEIGHT)));
            for (let attempt = 0; attempt < attempts; attempt += 1) {
                const angle = this.rng() * Math.PI * 2;
                const distanceOut = (spread + attempt) * Math.min(CELL_WIDTH, CELL_HEIGHT);
                anchor = this.snapProjectSiteToGrid(
                    type,
                    clamp(originX + Math.cos(angle) * distanceOut, 50, this.width - 50),
                    clamp(originY + Math.sin(angle) * distanceOut, 50, this.height - 50)
                );
                if (this.isFootprintOpen(type, anchor, occupied)) {
                    return anchor;
                }
            }
            return this.snapProjectSiteToGrid(type, originX, originY);
        }

        normalizePlacedStructureFootprints() {
            const occupied = new Set();
            const place = (entry, type) => {
                const span = this.getPlacementSpan(type);
                if (span.cols === 1 && span.rows === 1 && !Number.isFinite(entry.gridCol) && !Number.isFinite(entry.gridRow)) {
                    return;
                }
                const anchor = this.findOpenAnchor(type, entry.x, entry.y, occupied);
                this.assignEntryAnchor(entry, type, anchor);
                this.markFootprint(type, anchor, occupied);
            };
            for (const building of this.buildings) {
                place(building, building.type);
            }
            for (const project of this.projects) {
                if (project.targetBuildingId) {
                    continue;
                }
                place(project, project.type);
            }
        }

        getPlacementRadius(type) {
            return BUILDING_FOOTPRINTS[type] || 30;
        }

        getWorkingSiteRadius(type) {
            if (type === 'farmPlot' || type === 'engineeredFarm' || type === 'irrigation' || type === 'canal') {
                return 210;
            }
            return Infinity;
        }

        isProjectSiteWithinWorkingRange(type, x, y) {
            const maxDistance = this.getWorkingSiteRadius(type);
            if (!Number.isFinite(maxDistance)) {
                return true;
            }
            return distance({ x, y }, this.camp) <= maxDistance;
        }

        isProjectSiteOpen(type, x, y, options = {}) {
            if (!this.isProjectSiteWithinWorkingRange(type, x, y)) {
                return false;
            }
            const radius = this.getPlacementRadius(type);
            const ignoreProjectId = options.ignoreProjectId || null;
            const ignoreBuildingId = options.ignoreBuildingId || null;
            const padding = options.padding ?? 12;
            for (const building of this.buildings) {
                if (building.id === ignoreBuildingId) {
                    continue;
                }
                const otherRadius = this.getPlacementRadius(building.type);
                if (distance({ x, y }, building) < radius + otherRadius + padding) {
                    return false;
                }
            }
            for (const project of this.projects) {
                if (project.id === ignoreProjectId) {
                    continue;
                }
                const otherRadius = this.getPlacementRadius(project.type);
                if (distance({ x, y }, project) < radius + otherRadius + padding) {
                    return false;
                }
            }
            return true;
        }

        findOpenProjectSite(type, origin, options = {}) {
            if (!origin) {
                return null;
            }
            const attempts = options.attempts || 18;
            const spread = options.spread || Math.max(18, this.getPlacementRadius(type) * 0.8);
            if (this.isProjectSiteOpen(type, origin.x, origin.y, options)) {
                return {
                    x: clamp(origin.x, 50, this.width - 50),
                    y: clamp(origin.y, 50, this.height - 50)
                };
            }
            for (let attempt = 0; attempt < attempts; attempt += 1) {
                const angle = this.rng() * Math.PI * 2;
                const distanceOut = spread + attempt * 8;
                const candidate = this.snapProjectSiteToGrid(type,
                    clamp(origin.x + Math.cos(angle) * distanceOut, 50, this.width - 50),
                    clamp(origin.y + Math.sin(angle) * distanceOut, 50, this.height - 50)
                );
                if (this.isProjectSiteOpen(type, candidate.x, candidate.y, options)) {
                    return candidate;
                }
            }
            return null;
        }

        startProject(type) {
            const def = BUILDING_DEFS[type];
            if (!def) {
                return null;
            }
            const site = this.chooseProjectSite(type);
            const requirements = site.targetBuildingType
                ? this.getUpgradeRequirements(type, site.targetBuildingType)
                : def.materials;
            const delivered = {};
            Object.keys(requirements).forEach((key) => {
                delivered[key] = 0;
            });
            const project = {
                id: this.nextProjectId++,
                entityType: 'project',
                type,
                x: site.x,
                y: site.y,
                gridCol: site.gridCol ?? null,
                gridRow: site.gridRow ?? null,
                targetBuildingId: site.targetBuildingId || null,
                targetBuildingType: site.targetBuildingType || null,
                requirements,
                delivered,
                buildProgress: 0,
                buildTime: site.targetBuildingType ? Math.max(2, def.buildTime * 0.72) : def.buildTime
            };
            if (!project.targetBuildingType && !this.isProjectSiteOpen(type, project.x, project.y, { ignoreProjectId: project.id })) {
                return null;
            }
            this.projects.push(project);
            this.pushEvent(project.targetBuildingType
                ? `The colony planned to turn the ${project.targetBuildingType} into a ${type}.`
                : `The colony marked out a ${type} site.`);
            return project;
        }

        ensureSettlementProjects() {
            if (this.projects.length > 0) {
                return;
            }
            const damaged = this.getDamagedBuildingTarget();
            if (damaged) {
                this.startRepairProject(damaged);
                return;
            }
            const type = this.chooseNextProjectType();
            if (type) {
                this.startProject(type);
            }
        }

        getConstructionDemand(material) {
            return this.projects.reduce((sum, project) => {
                const required = this.getProjectRequirements(project)?.[material] || 0;
                const delivered = project.delivered[material] || 0;
                return sum + Math.max(0, required - delivered);
            }, 0);
        }

        getConstructionMaterialAvailable(material) {
            if (material === 'wood') {
                return this.camp.wood;
            }
            if (material === 'stone') {
                return this.camp.stone;
            }
            return this.getCampMaterial(material);
        }

        consumeConstructionMaterial(material, amount) {
            if (material === 'wood') {
                if (this.camp.wood < amount) {
                    return false;
                }
                this.camp.wood -= amount;
                return true;
            }
            if (material === 'stone') {
                if (this.camp.stone < amount) {
                    return false;
                }
                this.camp.stone -= amount;
                return true;
            }
            return this.consumeCampMaterial(material, amount);
        }

        getProjectPendingMaterial(project) {
            const requirements = this.getProjectRequirements(project);
            for (const [material, amount] of Object.entries(requirements)) {
                const delivered = project.delivered[material] || 0;
                const remaining = Math.max(0, amount - delivered);
                if (remaining <= 0) {
                    continue;
                }
                const available = this.getConstructionMaterialAvailable(material);
                if (available <= 0) {
                    continue;
                }
                const stepAmount = Math.min(remaining, available, material === 'wood' ? 2 : 1);
                return { material, amount: stepAmount };
            }
            return null;
        }

        projectHasAllMaterials(project) {
            const requirements = this.getProjectRequirements(project);
            return Object.entries(requirements).every(([material, amount]) => (project.delivered[material] || 0) >= amount);
        }

        getConstructionScore(colonist) {
            const project = this.projects[0];
            if (!project || colonist.stats.energy < 34 || colonist.stats.health < 58) {
                return -1;
            }
            const housingPressure = clamp((1 - this.getHousingSatisfaction()) * 70, 0, 40);
            const materialDemand = Object.values(this.getProjectRequirements(project)).reduce((sum, amount) => sum + amount, 0);
            const stockpilePressure = project.type === 'farmPlot' || project.type === 'storage' ? this.getStockpilePressure() * 4 : 0;
            return 18 + housingPressure + materialDemand * 0.8 + stockpilePressure + colonist.skills.building * 1.2 + this.getRoleBias(colonist, 'builder') * 10;
        }

        buildConstructionPlan(colonist) {
            const project = this.projects[0];
            if (!project) {
                return null;
            }
            const pending = this.getProjectPendingMaterial(project);
            if (pending) {
                const stockpileSite = this.getStockpileSite();
                return [
                    stockpileSite === this.camp
                        ? { kind: 'camp', duration: 0.7, action: 'pickupProjectMaterial', projectId: project.id, material: pending.material, amount: pending.amount }
                        : { kind: 'resource', entity: stockpileSite, duration: 0.7, action: 'pickupProjectMaterial', projectId: project.id, material: pending.material, amount: pending.amount },
                    { kind: 'resource', entity: project, duration: 0.8, action: 'deliverProjectMaterial', projectId: project.id, material: pending.material, amount: pending.amount }
                ];
            }
            if (this.projectHasAllMaterials(project)) {
                return [
                    { kind: 'resource', entity: project, duration: this.getActionDuration(colonist, 'building', 2.2, 'buildStructure'), action: 'buildStructure', projectId: project.id }
                ];
            }
            return null;
        }

        completeProject(project, colonist) {
            this.projects = this.projects.filter((entry) => entry !== project);
            if (project.type === 'repairStructure') {
                const target = this.buildings.find((building) => building.id === project.targetBuildingId);
                if (!target) {
                    return null;
                }
                target.integrity = target.maxIntegrity || target.integrity || 1;
                colonist.gainSkill('building', 0.8);
                this.pushEvent(`${colonist.name} repaired the ${target.type}.`);
                this.evaluateLegacyMilestones();
                return target;
            }
            if (project.targetBuildingId) {
                const target = this.buildings.find((building) => building.id === project.targetBuildingId);
                if (target) {
                    const previousType = target.type;
                    target.type = project.type;
                    target.completedDay = this.day;
                    target.completedYear = this.year;
                    target.harvestTimer = 0;
                    target.maxIntegrity = BUILDING_DEFS[project.type]?.durability || target.maxIntegrity || 30;
                    target.integrity = target.maxIntegrity;
                    colonist.gainSkill('building', 1.1);
                    if (
                        project.type === 'cottage' ||
                        project.type === 'house' ||
                        project.type === 'fortifiedStructure' ||
                        project.type === 'stoneKeep'
                    ) {
                        rememberPoint(this.colonyKnowledge.shelterSpots, target, 8, 18);
                        for (const resident of this.colonists) {
                            rememberPoint(resident.memory.shelterSpots, target, 6, 18);
                        }
                    }
                    this.pushEvent(`${colonist.name} upgraded the ${previousType} into a ${project.type}.`);
                    this.applyTerraformingAroundBuilding(target);
                    this.evaluateLegacyMilestones();
                    return target;
                }
            }
            const building = {
                id: project.id,
                entityType: 'building',
                type: project.type,
                x: project.x,
                y: project.y,
                gridCol: project.gridCol ?? null,
                gridRow: project.gridRow ?? null,
                completedDay: this.day,
                completedYear: this.year,
                harvestTimer: 0,
                maxIntegrity: BUILDING_DEFS[project.type]?.durability || 30,
                integrity: BUILDING_DEFS[project.type]?.durability || 30
            };
            this.buildings.push(building);
            colonist.gainSkill('building', 0.9);
            if (project.type === 'campfire') {
                this.camp.fireFuel += 4;
            }
            if (
                project.type === 'leanTo' ||
                project.type === 'hut' ||
                project.type === 'cottage' ||
                project.type === 'house' ||
                project.type === 'fortifiedStructure' ||
                project.type === 'stoneKeep'
            ) {
                rememberPoint(this.colonyKnowledge.shelterSpots, building, 8, 18);
                for (const resident of this.colonists) {
                    rememberPoint(resident.memory.shelterSpots, building, 6, 18);
                }
                const shelterGain = {
                    leanTo: 6,
                    hut: 10,
                    cottage: 14,
                    house: 18,
                    fortifiedStructure: 24,
                    stoneKeep: 28
                }[project.type] || 6;
                this.camp.shelter = clamp(this.camp.shelter + shelterGain, 0, 100);
            }
            this.pushEvent(`${colonist.name} finished a ${project.type}.`);
            this.applyTerraformingAroundBuilding(building);
            this.evaluateLegacyMilestones();
            return building;
        }

        updateBuildings(dt) {
            const weather = this.getWeather();
            const weatherState = this.getWeatherState();
            const irrigationBoost = 1 + this.countBuildings('irrigation') * 0.18 + this.countBuildings('canal') * 0.26;
            const engineeredFarmBoost = 1 + this.countBuildings('engineeredFarm') * 0.12;
            const disasterKnob = this.getSimulationKnob('disasterFrequency');
            this.structureRaidCooldown = Math.max(0, this.structureRaidCooldown - dt * disasterKnob);
            this.weatherDamageCooldown = Math.max(0, this.weatherDamageCooldown - dt * disasterKnob);
            this.lightningStrikeCooldown = Math.max(0, this.lightningStrikeCooldown - dt * disasterKnob);
            for (const building of this.buildings) {
                building.storageOpenTtl = Math.max(0, (building.storageOpenTtl || 0) - dt);
                if (!building.maxIntegrity) {
                    building.maxIntegrity = BUILDING_DEFS[building.type]?.durability || 30;
                    building.integrity = building.integrity || building.maxIntegrity;
                }
                const baseDecay = dt * 0.0011;
                const stormDecay = weather.name === 'Storm' ? dt * 0.008 : weather.name === 'Cold Snap' ? dt * 0.0035 : 0;
                const exposedPenalty = (building.type === 'leanTo' || building.type === 'storagePit' || building.type === 'farmPlot') ? dt * 0.0022 : 0;
                building.integrity = clamp(building.integrity - baseDecay - stormDecay - exposedPenalty, 0, building.maxIntegrity);
                if (building.type !== 'farmPlot' && building.type !== 'engineeredFarm') {
                    continue;
                }
                if (this.getSeason().name === 'Winter' || this.camp.water < 2) {
                    continue;
                }
                building.harvestTimer += dt;
                if (building.harvestTimer >= 18) {
                    building.harvestTimer = 0;
                    const localBoost = building.type === 'engineeredFarm' ? 1.45 * engineeredFarmBoost : 1;
                    const harvest = (2.5 + this.getColonySkillAverage('farming') * 0.25) * irrigationBoost * localBoost;
                    this.camp.food = clamp(this.camp.food + harvest, 0, 999);
                    this.recordFoodSource('farmed', harvest * (building.type === 'engineeredFarm' ? 0.8 : 0.65));
                    this.recentLabor.farmer = (this.recentLabor.farmer || 0) + 0.7;
                    this.pushEvent(`${building.type === 'engineeredFarm' ? 'An engineered farm' : 'A farm plot'} added food to the stockpile.`);
                }
            }
            if (weather.name === 'Storm' && this.weatherDamageCooldown <= 0) {
                const fragile = this.buildings
                    .filter((building) => this.getBuildingIntegrityRatio(building) < 0.54)
                    .sort((left, right) => this.getBuildingIntegrityRatio(left) - this.getBuildingIntegrityRatio(right))[0];
                if (fragile) {
                    this.applyBuildingDamage(fragile, 0.75);
                    this.pushEvent(`A storm battered the ${fragile.type}.`);
                    this.weatherDamageCooldown = 22;
                }
            }
            if (weatherState.lightningFlash > this.lastResolvedLightningFlash + 0.18 && this.lightningStrikeCooldown <= 0) {
                if (this.resolveLightningStrike(weatherState)) {
                    this.lightningStrikeCooldown = 16 + this.rng() * 12;
                }
            }
            this.lastResolvedLightningFlash = weatherState.lightningFlash;
            const defensiveCover = this.countBuildings('watchtower') + this.countBuildings('wall') + this.countBuildings('fortifiedStructure') + this.countBuildings('stoneKeep') * 2;
            if (this.predators.length > 0 && defensiveCover < 2 && this.structureRaidCooldown <= 0 && !this.hasProtectColonyBubble()) {
                const vulnerable = this.buildings.find((building) =>
                    building.type === 'storagePit' ||
                    building.type === 'storage' ||
                    building.type === 'campfire' ||
                    building.type === 'leanTo'
                ) || null;
                if (vulnerable && this.rng() < (0.0022 + Math.max(0, this.predators.length - defensiveCover) * 0.0009) * dt) {
                    this.applyBuildingDamage(vulnerable, 0.85);
                    this.camp.food = Math.max(0, this.camp.food - 0.9);
                    this.camp.wood = Math.max(0, this.camp.wood - 0.3);
                    this.pushEvent(`Predators raided the ${vulnerable.type} and spoiled stored supplies.`);
                    this.structureRaidCooldown = 34;
                }
            }
        }

        updateLandUse(dt = 1 / 30) {
            for (const cell of this.cells) {
                const traffic = Math.max(0, (cell.terrain.traffic || 0) - dt * 0.0035);
                cell.terrain.traffic = traffic;
                const desiredWear = clamp(
                    traffic * 0.11 +
                    (cell.terrain.cleared ? 0.04 : 0) +
                    (cell.terrain.irrigation ? 0.03 : 0),
                    0,
                    1
                );
                cell.terrain.pathWear = lerp(cell.terrain.pathWear || 0, desiredWear, dt * 0.22);
                if (this.hasTechnology('engineering') || this.hasTechnology('storagePlanning')) {
                    const roadPressure = clamp(traffic * (this.hasTechnology('engineering') ? 0.14 : 0.08), 0, 1);
                    cell.terrain.roadLevel = lerp(cell.terrain.roadLevel || 0, roadPressure, dt * 0.18);
                } else {
                    cell.terrain.roadLevel = Math.max(0, (cell.terrain.roadLevel || 0) - dt * 0.01);
                }
                if ((cell.terrain.pathWear || 0) > 0.28 && cell.biome === 'forest' && !cell.terrain.marsh) {
                    cell.terrain.cleared = true;
                    cell.biome = 'grassland';
                }
            }
            const districtDefs = [
                {
                    type: 'housing',
                    buildings: ['leanTo', 'hut', 'cottage', 'house', 'fortifiedStructure', 'stoneKeep'],
                    color: 'housing'
                },
                {
                    type: 'farming',
                    buildings: ['farmPlot', 'engineeredFarm', 'irrigation', 'canal', 'mill'],
                    color: 'farming'
                },
                {
                    type: 'storage',
                    buildings: ['storage', 'storagePit', 'granary', 'warehouse'],
                    color: 'storage'
                },
                {
                    type: 'craft',
                    buildings: ['workshop', 'mill'],
                    color: 'craft'
                },
                {
                    type: 'civic',
                    buildings: ['campfire', 'kitchen', 'foodHall', 'civicComplex'],
                    color: 'civic'
                },
                {
                    type: 'defense',
                    buildings: ['watchtower', 'wall', 'fortifiedStructure', 'stoneKeep'],
                    color: 'defense'
                }
            ];
            const districts = districtDefs
                .map((def) => {
                    const matches = this.buildings.filter((building) => def.buildings.includes(building.type));
                    if (!matches.length) {
                        return null;
                    }
                    const x = matches.reduce((sum, building) => sum + building.x, 0) / matches.length;
                    const y = matches.reduce((sum, building) => sum + building.y, 0) / matches.length;
                    return {
                        type: def.type,
                        color: def.color,
                        x,
                        y,
                        radius: 52 + matches.length * 12,
                        count: matches.length
                    };
                })
                .filter(Boolean);
            const roadTargets = [
                ...this.buildings.filter((building) =>
                    building.type === 'storage' ||
                    building.type === 'granary' ||
                    building.type === 'warehouse' ||
                    building.type === 'workshop' ||
                    building.type === 'kitchen' ||
                    building.type === 'foodHall' ||
                    building.type === 'civicComplex' ||
                    building.type === 'mill' ||
                    building.type === 'engineeredFarm' ||
                    building.type === 'canal' ||
                    building.type === 'watchtower' ||
                    building.type === 'fortifiedStructure' ||
                    building.type === 'stoneKeep' ||
                    building.type === 'cottage' ||
                    building.type === 'house'
                ),
                ...this.getActiveBranchColonies()
            ];
            const roads = roadTargets
                .filter((target) => distance(target, this.camp) > 70)
                .slice(0, 12)
                .map((target) => {
                    const route = this.getRouteProfile(this.camp, target);
                    const official = this.hasTechnology('engineering') || this.hasTechnology('storagePlanning');
                    const visible = official || route.quality > 0.15;
                    if (!visible) {
                        return null;
                    }
                    return {
                        fromX: this.camp.x,
                        fromY: this.camp.y,
                        toX: target.x,
                        toY: target.y,
                        type: target.type || 'road',
                        surface: official
                            ? (this.hasTechnology('engineering') ? 'stone' : 'road')
                            : route.quality > 0.34
                                ? 'dirt'
                                : 'trail',
                        quality: Number(route.quality.toFixed(2)),
                        traffic: Number(route.roadBonus.toFixed(2))
                    };
                })
                .filter(Boolean);
            const districtRoads = [];
            const civicDistrict = districts.find((district) => district.type === 'civic') || null;
            const spokeTargets = districts.filter((district) => district.type !== 'civic');
            const engineered = this.hasTechnology('engineering');
            const organized = this.hasTechnology('storagePlanning') || this.hasTechnology('masonry');
            if (civicDistrict && organized) {
                for (const district of spokeTargets) {
                    districtRoads.push({
                        fromX: civicDistrict.x,
                        fromY: civicDistrict.y,
                        toX: district.x,
                        toY: district.y,
                        type: `${district.type}-avenue`,
                        surface: engineered ? 'stone' : 'road',
                        quality: engineered ? 0.92 : 0.68,
                        traffic: engineered ? 0.3 : 0.2
                    });
                }
            }
            if (engineered && districts.length >= 3) {
                const ringCandidates = ['housing', 'storage', 'craft', 'defense']
                    .map((type) => districts.find((district) => district.type === type))
                    .filter(Boolean);
                for (let index = 0; index < ringCandidates.length; index += 1) {
                    const current = ringCandidates[index];
                    const next = ringCandidates[(index + 1) % ringCandidates.length];
                    if (!current || !next || current === next) {
                        continue;
                    }
                    districtRoads.push({
                        fromX: current.x,
                        fromY: current.y,
                        toX: next.x,
                        toY: next.y,
                        type: 'ring-road',
                        surface: 'stone',
                        quality: 0.88,
                        traffic: 0.24
                    });
                }
            }
            const mergedRoads = [...roads];
            for (const route of districtRoads) {
                const duplicate = mergedRoads.some((entry) =>
                    (distance({ x: entry.fromX, y: entry.fromY }, { x: route.fromX, y: route.fromY }) < 18 &&
                        distance({ x: entry.toX, y: entry.toY }, { x: route.toX, y: route.toY }) < 18) ||
                    (distance({ x: entry.fromX, y: entry.fromY }, { x: route.toX, y: route.toY }) < 18 &&
                        distance({ x: entry.toX, y: entry.toY }, { x: route.fromX, y: route.fromY }) < 18)
                );
                if (!duplicate) {
                    mergedRoads.push(route);
                }
            }
            const patrolRoutes = this.getActiveBranchColonies()
                .filter((colony) => ['rival', 'cautious', 'allied'].includes(colony.diplomacyState))
                .slice(0, 6)
                .map((colony) => {
                    const towardCampDx = this.camp.x - colony.x;
                    const towardCampDy = this.camp.y - colony.y;
                    const len = Math.hypot(towardCampDx, towardCampDy) || 1;
                    const nx = towardCampDx / len;
                    const ny = towardCampDy / len;
                    const midpointX = colony.x + nx * Math.min(110, len * 0.45);
                    const midpointY = colony.y + ny * Math.min(110, len * 0.45);
                    return {
                        fromX: colony.x,
                        fromY: colony.y,
                        toX: midpointX,
                        toY: midpointY,
                        diplomacyState: colony.diplomacyState,
                        commander: colony.army?.commander?.name || null
                    };
                });
            const tradeRoutes = this.getActiveBranchColonies()
                .filter((colony) =>
                    ['allied', 'trading'].includes(colony.diplomacyState) &&
                    (
                        this.hasTechnology('agriculture') ||
                        this.hasTechnology('storagePlanning') ||
                        (colony.history?.trades || 0) > 0
                    )
                )
                .slice(0, 6)
                .map((colony) => {
                    const route = this.getRouteProfile(this.camp, colony);
                    const eraBoost = this.hasTechnology('engineering') ? 0.22 : this.hasTechnology('storagePlanning') ? 0.12 : 0.05;
                    const throughput = clamp(
                        0.2 +
                        (colony.history?.trades || 0) * 0.08 +
                        route.quality * 0.45 +
                        eraBoost,
                        0.18,
                        1
                    );
                    return {
                        fromX: this.camp.x,
                        fromY: this.camp.y,
                        toX: colony.x,
                        toY: colony.y,
                        colonyName: colony.name,
                        surface: this.hasTechnology('engineering') ? 'caravan-road' : 'caravan-trail',
                        throughput: Number(throughput.toFixed(2)),
                        goods: this.hasTechnology('engineering')
                            ? ['grain', 'planks', 'tools']
                            : this.hasTechnology('agriculture')
                                ? ['grain', 'water', 'fiber']
                                : ['food', 'water']
                    };
                });
            const contestedZones = this.getActiveBranchColonies()
                .filter((colony) => colony.diplomacyState === 'rival' || (colony.borderFriction || 0) > 0.58 || colony.occupation?.state === 'occupiedByMain')
                .map((colony) => {
                    const midpointX = (this.camp.x + colony.x) * 0.5;
                    const midpointY = (this.camp.y + colony.y) * 0.5;
                    const separation = distance(this.camp, colony);
                    return {
                        x: midpointX,
                        y: midpointY,
                        radius: clamp(separation * 0.22 + (colony.borderFriction || 0) * 44, 44, 130),
                        severity: clamp(
                            (colony.borderFriction || 0) * 0.65 +
                            (colony.diplomacyState === 'rival' ? 0.18 : 0) +
                            ((colony.campaign?.pressure) || 0) * 0.2 +
                            (colony.occupation?.state === 'occupiedByMain' ? 0.18 : 0),
                            0.18,
                            1
                        ),
                        colonyName: colony.name,
                        diplomacyState: colony.diplomacyState
                    };
                });
            const outposts = [
                ...this.buildings
                    .filter((building) => ['watchtower', 'wall', 'fortifiedStructure', 'stoneKeep'].includes(building.type))
                    .map((building) => ({
                        x: building.x,
                        y: building.y,
                        type: building.type,
                        side: 'camp',
                        warning: clamp(0.28 + this.getRegionalConflictPressure() * 0.45, 0.2, 1)
                    })),
                ...this.getActiveBranchColonies()
                    .filter((colony) => colony.diplomacyState === 'allied' || colony.diplomacyState === 'rival')
                    .map((colony) => ({
                        x: colony.x,
                        y: colony.y,
                        type: 'frontier post',
                        side: colony.diplomacyState,
                        warning: clamp(this.getColonyThreatScore(colony) + (colony.army?.morale || 0) * 0.18, 0.2, 1),
                        colonyName: colony.name
                    }))
            ].slice(0, 12);
            const ambushPoints = contestedZones
                .map((zone, index) => {
                    const road = roads[index % Math.max(1, roads.length)] || null;
                    const anchorX = road ? (zone.x + road.toX) * 0.5 : zone.x;
                    const anchorY = road ? (zone.y + road.toY) * 0.5 : zone.y;
                    const tension = clamp(zone.severity + (road ? 0.12 : 0), 0.2, 1);
                    return {
                        x: anchorX,
                        y: anchorY,
                        radius: 10 + tension * 12,
                        severity: tension,
                        kind: road ? 'choke' : 'ambush',
                        colonyName: zone.colonyName
                    };
                })
                .slice(0, 6);
            const trafficPaths = roads
                .filter((road) => road.surface === 'trail' || road.surface === 'dirt')
                .map((road) => ({
                    fromX: road.fromX,
                    fromY: road.fromY,
                    toX: road.toX,
                    toY: road.toY,
                    surface: road.surface,
                    quality: road.quality
                }));
            this.landUse = {
                farmingZones: this.buildings.filter((building) => building.type === 'farmPlot').map((building) => ({ x: building.x, y: building.y, radius: 32 })),
                gatheringZones: this.resources
                    .filter((resource) => !resource.depleted && (resource.type === 'berries' || resource.type === 'trees' || resource.type === 'stone'))
                    .slice(0, 5)
                    .map((resource) => ({ x: resource.x, y: resource.y, type: resource.type, radius: 30 })),
                huntingZones: this.animals
                    .filter((animal) => !animal.depleted)
                    .slice(0, 4)
                    .map((animal) => ({ x: animal.x, y: animal.y, radius: 42 })),
                dangerZones: this.colonyKnowledge.dangerZones.slice(0, 6).map((zone) => ({ x: zone.x, y: zone.y, radius: 48 })),
                roads: mergedRoads,
                tradeRoutes,
                patrolRoutes,
                contestedZones,
                outposts,
                ambushPoints,
                trafficPaths,
                districts,
                branchTerritories: this.getActiveBranchColonies().map((colony) => ({
                    x: colony.x,
                    y: colony.y,
                    radius: this.getBranchTerritoryRadius(colony),
                    type: colony.type,
                    occupationState: colony.occupation?.state || 'free',
                    diplomacyState: colony.diplomacyState
                }))
            };
        }

        findPlantingSpot() {
            const fertileCell = this.cells
                .filter((cell) =>
                    cell.biome === 'fertile' &&
                    distance(
                        { x: cell.x + CELL_WIDTH * 0.5, y: cell.y + CELL_HEIGHT * 0.5 },
                        this.camp
                    ) <= this.getWorkingSiteRadius('farmPlot')
                )
                .sort((a, b) =>
                    distance({ x: a.x + CELL_WIDTH * 0.5, y: a.y + CELL_HEIGHT * 0.5 }, this.camp) -
                    distance({ x: b.x + CELL_WIDTH * 0.5, y: b.y + CELL_HEIGHT * 0.5 }, this.camp)
                )[0];
            if (!fertileCell) {
                return {
                    x: clamp(this.camp.x + 55, 30, this.width - 30),
                    y: clamp(this.camp.y - 35, 30, this.height - 30)
                };
            }
            return {
                x: fertileCell.x + CELL_WIDTH * 0.5,
                y: fertileCell.y + CELL_HEIGHT * 0.5
            };
        }

        spawnPlantTrial(target, colonist = null) {
            const x = clamp(target.x + (this.rng() - 0.5) * 12, 30, this.width - 30);
            const y = clamp(target.y + (this.rng() - 0.5) * 12, 30, this.height - 30);
            const existing = this.resources.find((resource) => resource.type === 'berries' && distance(resource, { x, y }) < 28);
            if (!existing) {
                const hasHoe = Boolean(colonist?.equipment?.farming?.type === 'hoe');
                this.resources.push(this.makeResource(
                    this.nextResourceId++,
                    'berries',
                    x,
                    y,
                    hasHoe ? 28 : 18,
                    'fertile'
                ));
            }
        }

        findBestShelterSpot(origin) {
            const candidates = [];
            if (origin?.memory?.shelterSpots?.length) {
                candidates.push(...origin.memory.shelterSpots);
            }
            if (this.colonyKnowledge.shelterSpots.length) {
                candidates.push(...this.colonyKnowledge.shelterSpots);
            }
            if (this.lineageMemory.shelterSpots?.length) {
                candidates.push(...this.lineageMemory.shelterSpots);
            }
            if (!candidates.length) {
                return this.camp;
            }
            let best = this.camp;
            let bestScore = distance(origin, this.camp);
            for (const spot of candidates) {
                const nextScore = distance(origin, spot) + this.getDangerPenalty(spot, origin) * 0.5;
                if (nextScore < bestScore) {
                    best = spot;
                    bestScore = nextScore;
                }
            }
            return best;
        }

        getKnowledgeStatements() {
            const statements = [];
            const berries = this.colonyKnowledge.resources.berries || [];
            const predators = this.colonyKnowledge.dangerZones || [];
            const winterLessons = (this.lineageMemory.deathCauses.exposure || 0) + (this.lineageMemory.deathCauses.starvation || 0);

            const berryNearWater = berries.some((entry) =>
                (this.colonyKnowledge.resources.water || []).some((water) => distance(entry, water) < 180)
            );
            if (berryNearWater) {
                statements.push('berries exist near river');
            }

            const forestPredator = predators.some((entry) => this.getCellAt(entry.x, entry.y)?.biome === 'forest');
            if (forestPredator) {
                statements.push('wolves hunt at forest edge');
            }

            if (winterLessons > 0 || this.lineageMemory.lessons.some((lesson) => /cold|winter|stock/i.test(lesson))) {
                statements.push('winter requires stockpiling');
            }

            if (this.colonyKnowledge.discoveries.includes('skill:tool_use')) {
                statements.push('simple tools improve hard labor');
            }

            if (this.colonyKnowledge.discoveries.includes('skill:planting')) {
                statements.push('food can be planted near camp');
            }

            if (this.hasTechnology('insulation')) {
                statements.push('winter pushes warmer homes and insulation');
            }

            if (this.hasTechnology('irrigation')) {
                statements.push('dry fields can be fed by irrigation');
            }

            if (this.hasTechnology('militaryOrganization')) {
                statements.push('danger demands organized defense');
            }

            return statements.slice(0, 6);
        }

        getMemoryBonus(entity, origin, type) {
            const layers = [];
            if (origin?.memory?.resources?.[type]) {
                layers.push(origin.memory.resources[type]);
            }
            if (this.colonyKnowledge.resources[type]) {
                layers.push(this.colonyKnowledge.resources[type]);
            }
            if (this.lineageMemory.knownResources?.[type]) {
                layers.push(this.lineageMemory.knownResources[type]);
            }
            let bonus = 0;
            for (const entries of layers) {
                if (entries.some((memory) => distance(memory, entity) < 55)) {
                    bonus += 24;
                }
            }
            return bonus;
        }

        findNearestResource(origin, type, options = {}) {
            const remembered = this.findRememberedResource(origin, type);
            if (remembered) {
                return remembered;
            }
            let best = null;
            let bestScore = Infinity;
            for (const resource of this.resources) {
                if (resource.type !== type || resource.depleted) {
                    continue;
                }
                const nextDistance = distance(origin, resource);
                const amountValue = options.preferYield ? resource.amount * 2.2 : resource.amount * 0.8;
                const assignmentPenalty = this.getEntityAssignmentPenalty(resource, origin);
                const dangerPenalty = this.getDangerPenalty(resource, origin);
                const memoryBonus = this.getMemoryBonus(resource, origin, type);
                const nextScore = nextDistance + assignmentPenalty + dangerPenalty - amountValue - memoryBonus;
                if (nextScore < bestScore) {
                    best = resource;
                    bestScore = nextScore;
                }
            }
            return best;
        }

        findRememberedResource(origin, type) {
            const entrySets = [];
            if (origin?.memory?.resources?.[type]?.length) {
                entrySets.push(origin.memory.resources[type]);
            }
            if (this.colonyKnowledge.resources[type]?.length) {
                entrySets.push(this.colonyKnowledge.resources[type]);
            }
            if (this.lineageMemory.knownResources?.[type]?.length) {
                entrySets.push(this.lineageMemory.knownResources[type]);
            }
            const entries = entrySets.flat();
            if (!entries.length) {
                return null;
            }
            let best = null;
            let bestDistance = Infinity;
            for (const memory of entries) {
                const resource = this.resources.find((entry) =>
                    entry.type === type &&
                    !entry.depleted &&
                    distance(entry, memory) < 50
                );
                if (!resource) {
                    continue;
                }
                const nextDistance = distance(origin, resource);
                const nextScore = nextDistance + this.getDangerPenalty(resource, origin);
                if (nextScore < bestDistance) {
                    best = resource;
                    bestDistance = nextScore;
                }
            }
            return best;
        }

        getCellCoords(x, y) {
            return {
                col: clamp(Math.floor(x / CELL_WIDTH), 0, GRID_COLS - 1),
                row: clamp(Math.floor(y / CELL_HEIGHT), 0, GRID_ROWS - 1)
            };
        }

        isWalkable(col, row) {
            const cell = this.cells[row * GRID_COLS + col];
            return cell && cell.biome !== 'water' && cell.biome !== 'valley';
        }

        getMoveCost(col, row) {
            const cell = this.cells[row * GRID_COLS + col];
            if (!cell) {
                return Infinity;
            }
            if (cell.biome === 'water') {
                return Infinity;
            }
            if (cell.biome === 'valley') {
                return Infinity;
            }
            const weatherPenalty = this.getWeatherStateAt(cell.x + CELL_WIDTH * 0.5, cell.y + CELL_HEIGHT * 0.5).movementPenalty;
            if (cell.terrain?.marsh && !cell.terrain?.drained) {
                return 2.4 + weatherPenalty * 1.25;
            }
            if (cell.terrain?.fortified) {
                return 2.2 + weatherPenalty * 0.8;
            }
            if (cell.biome === 'rocky') {
                return (cell.terrain?.quarried ? 2.2 : 2.8) + weatherPenalty * 0.7;
            }
            if (cell.biome === 'forest') {
                return 1.7 + weatherPenalty;
            }
            if (cell.biome === 'fertile') {
                const base = cell.terrain?.terraced ? 1 : 1.1;
                return base + weatherPenalty * 0.9;
            }
            return 1 + weatherPenalty * 1.1;
        }

        getPathDangerCost(col, row, origin) {
            const point = {
                x: col * CELL_WIDTH + CELL_WIDTH * 0.5,
                y: row * CELL_HEIGHT + CELL_HEIGHT * 0.5
            };
            const dangerPenalty = this.getDangerPenalty(point, origin);
            if (dangerPenalty > 140) {
                return 12;
            }
            if (dangerPenalty > 90) {
                return 6;
            }
            return dangerPenalty * 0.08;
        }

        findPath(from, to) {
            const start = this.getCellCoords(from.x, from.y);
            const goal = this.getCellCoords(to.x, to.y);
            if (start.col === goal.col && start.row === goal.row) {
                return [];
            }

            const open = [{ col: start.col, row: start.row, f: 0 }];
            const cameFrom = new Map();
            const gScore = new Map([[keyForCell(start.col, start.row), 0]]);
            const visited = new Set();

            while (open.length) {
                open.sort((a, b) => a.f - b.f);
                const current = open.shift();
                const currentKey = keyForCell(current.col, current.row);
                if (visited.has(currentKey)) {
                    continue;
                }
                visited.add(currentKey);

                if (current.col === goal.col && current.row === goal.row) {
                    return this.reconstructPath(cameFrom, current, to);
                }

                const neighbors = [
                    { col: current.col + 1, row: current.row },
                    { col: current.col - 1, row: current.row },
                    { col: current.col, row: current.row + 1 },
                    { col: current.col, row: current.row - 1 }
                ];

                for (const neighbor of neighbors) {
                    if (neighbor.col < 0 || neighbor.col >= GRID_COLS || neighbor.row < 0 || neighbor.row >= GRID_ROWS) {
                        continue;
                    }
                    if (!this.isWalkable(neighbor.col, neighbor.row)) {
                        continue;
                    }
                    const neighborKey = keyForCell(neighbor.col, neighbor.row);
                    const tentative = (gScore.get(currentKey) ?? Infinity) +
                        this.getMoveCost(neighbor.col, neighbor.row) +
                        this.getPathDangerCost(neighbor.col, neighbor.row, from);
                    if (tentative >= (gScore.get(neighborKey) ?? Infinity)) {
                        continue;
                    }
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentative);
                    const heuristic = Math.abs(goal.col - neighbor.col) + Math.abs(goal.row - neighbor.row);
                    open.push({ col: neighbor.col, row: neighbor.row, f: tentative + heuristic });
                }
            }

            return [];
        }

        reconstructPath(cameFrom, current, target) {
            const cells = [];
            let cursor = current;
            while (cursor) {
                cells.push(cursor);
                cursor = cameFrom.get(keyForCell(cursor.col, cursor.row)) || null;
            }
            cells.reverse();
            const waypoints = cells.slice(1).map((cell) => ({
                x: cell.col * CELL_WIDTH + CELL_WIDTH * 0.5,
                y: cell.row * CELL_HEIGHT + CELL_HEIGHT * 0.5
            }));
            if (waypoints.length) {
                waypoints[waypoints.length - 1] = { x: target.x, y: target.y };
            }
            return waypoints;
        }

        findBestFoodSource(origin, options = {}) {
            const berries = this.findNearestResource(origin, 'berries', {
                preferYield: !options.preferImmediate
            });
            const animal = options.allowAnimals
                ? this.findNearestAnimal(origin, {
                    preferYield: !options.preferImmediate
                })
                : null;
            if (!berries) {
                return animal;
            }
            if (!animal) {
                return berries;
            }
            const berryScore = distance(origin, berries) +
                this.getEntityAssignmentPenalty(berries, origin) +
                this.getDangerPenalty(berries, origin) -
                this.getMemoryBonus(berries, origin, 'berries') -
                berries.amount * 0.7;
            const animalScore = distance(origin, animal) * (options.preferImmediate ? 1.2 : 0.95) +
                this.getEntityAssignmentPenalty(animal, origin) +
                this.getDangerPenalty(animal, origin) +
                this.getMemoryBonus(animal, origin, 'wildAnimal') +
                (animal.panicTimer > 0 ? 18 : 0) -
                (options.preferImmediate ? 10 : 26);
            return animalScore < berryScore ? animal : berries;
        }

        findNearestAnimal(origin, options = {}) {
            let best = null;
            let bestScore = Infinity;
            for (const animal of this.animals) {
                if (animal.depleted) {
                    continue;
                }
                const nextDistance = distance(origin, animal);
                const assignmentPenalty = this.getEntityAssignmentPenalty(animal, origin);
                const yieldBonus = options.preferYield ? 24 : 12;
                const nextScore = nextDistance +
                    assignmentPenalty +
                    this.getDangerPenalty(animal, origin) -
                    this.getMemoryBonus(animal, origin, 'wildAnimal') +
                    (animal.panicTimer > 0 ? 22 : 0) -
                    yieldBonus;
                if (nextScore < bestScore) {
                    best = animal;
                    bestScore = nextScore;
                }
            }
            return best;
        }

        findNearestPredator(origin, radius = Infinity) {
            let best = null;
            let bestDistance = radius;
            for (const predator of this.predators) {
                const nextDistance = distance(origin, predator);
                if (nextDistance < bestDistance) {
                    best = predator;
                    bestDistance = nextDistance;
                }
            }
            return best;
        }

        getColonistsForThreat(threat, radius = 150) {
            return this.colonists
                .filter((colonist) => colonist.alive && distance(colonist, threat) <= radius)
                .sort((a, b) => distance(a, threat) - distance(b, threat));
        }

        shouldColonistProtect(colonist) {
            if (!colonist.threat) {
                return false;
            }
            const predatorCaution = this.getPredatorCaution();
            if (colonist.stats.health < (58 + predatorCaution * 6) || colonist.stats.energy < (40 + predatorCaution * 4)) {
                return false;
            }
            const nearby = this.getColonistsForThreat(colonist.threat);
            const defenders = nearby.filter((entry) =>
                entry.stats.health >= (58 + predatorCaution * 6) &&
                entry.stats.energy >= (40 + predatorCaution * 4) &&
                distance(entry, this.camp) < this.getWeatherVisibilityRadius(entry, 130)
            );
            return defenders.slice(0, predatorCaution > 0 ? 1 : 2).includes(colonist);
        }

        shouldColonistFlee(colonist) {
            if (!colonist.threat) {
                return false;
            }
            const predatorCaution = this.getPredatorCaution();
            const immediateFleeRadius = this.getWeatherVisibilityRadius(colonist, 48 + predatorCaution * 18);
            const broadFleeRadius = this.getWeatherVisibilityRadius(colonist, 88 + predatorCaution * 22);
            if (colonist.threatDistance < immediateFleeRadius) {
                return true;
            }
            if (colonist.stats.health < (58 + predatorCaution * 4) || colonist.stats.energy < (40 + predatorCaution * 4)) {
                return colonist.threatDistance < broadFleeRadius + 8;
            }
            const nearby = this.getColonistsForThreat(colonist.threat);
            return nearby.slice(0, 3 + predatorCaution).includes(colonist) && colonist.threatDistance < broadFleeRadius;
        }

        getIntentPenalty(intent) {
            const active = this.colonists.filter((colonist) => colonist.alive && colonist.intent === intent).length;
            if (active <= 0) {
                return 0;
            }
            const limits = {
                drink: 1,
                haulWater: 2,
                eat: 1,
                forage: 2,
                gatherWood: 1,
                gatherStone: 1,
                hunt: 1
            };
            const limit = limits[intent] ?? 1;
            return active <= limit ? 0 : (active - limit) * 18;
        }

        getFailurePenalty(colonist, action) {
            const failed = colonist.memory.failedActions[action] || 0;
            return Math.min(24, failed * 4);
        }

        normalizeActionMemoryKey(action) {
            const mapping = {
                drinkCamp: 'drink',
                drinkSource: 'drink',
                collectWater: 'haulWater',
                deliverWater: 'haulWater',
                eatCamp: 'eat',
                eatWild: 'eat',
                eatAndGatherFood: 'forage',
                collectFood: 'forage',
                deliverFood: 'forage',
                warmCamp: 'warm',
                warmHome: 'warm',
                sleepCamp: 'sleep',
                sleepHome: 'sleep',
                tendWounds: 'tend',
                collectWood: 'gatherWood',
                deliverWood: 'gatherWood',
                collectStone: 'gatherStone',
                deliverStone: 'gatherStone',
                craftRecipe: 'craft',
                processMaterials: 'process',
                repairTool: 'repair',
                plantTrial: 'plant',
                socializeWithPeer: 'socialize',
                huntAnimal: 'hunt',
                huntMeal: 'hunt',
                attackPredator: 'protect',
                battleEngage: 'war',
                buildStructure: 'build',
                pickupProjectMaterial: 'build',
                deliverProjectMaterial: 'build'
            };
            return mapping[action] || action;
        }

        getActionConfidence(colonist, action) {
            const key = this.normalizeActionMemoryKey(action);
            return clamp((colonist.memory?.actionConfidence?.[key] || 0), -1, 1);
        }

        getTraitDecisionBias(colonist, action) {
            const key = this.normalizeActionMemoryKey(action);
            const traits = colonist.traits || {};
            switch (key) {
                case 'drink':
                case 'haulWater':
                case 'eat':
                case 'forage':
                case 'sleep':
                case 'tend':
                    return traits.endurance * 4 + traits.caution * 2 - traits.aggression * 1.5;
                case 'hunt':
                case 'protect':
                case 'war':
                    return traits.bravery * 8 + traits.aggression * 6 - traits.caution * 4;
                case 'socialize':
                    return traits.sociability * 12 - traits.aggression * 3;
                case 'craft':
                case 'process':
                case 'repair':
                case 'plant':
                case 'build':
                case 'gatherWood':
                case 'gatherStone':
                    return traits.curiosity * 5 + traits.endurance * 4 + traits.learningSpeed * 4;
                default:
                    return traits.curiosity * 2 + traits.endurance * 2;
            }
        }

        getEraDecisionBias(action) {
            const era = this.getCurrentEra();
            const key = this.normalizeActionMemoryKey(action);
            const tables = {
                survival: {
                    forage: 8,
                    hunt: 5,
                    gatherWood: 3,
                    gatherStone: 2,
                    socialize: -2,
                    build: -2,
                    craft: -1
                },
                toolmaking: {
                    craft: 6,
                    process: 4,
                    gatherWood: 2,
                    gatherStone: 2
                },
                agriculture: {
                    plant: 10,
                    haulWater: 4,
                    forage: -4,
                    hunt: -2
                },
                masonry: {
                    build: 8,
                    gatherStone: 5,
                    craft: 2
                },
                medicine: {
                    tend: 6,
                    socialize: 2
                },
                'military organization': {
                    war: 7,
                    protect: 5,
                    build: 2
                },
                engineering: {
                    build: 10,
                    process: 5,
                    craft: 4,
                    haulWater: 2,
                    forage: -6
                },
                metallurgy: {
                    build: 6,
                    craft: 6,
                    process: 6,
                    gatherStone: 2
                },
                'bronze age': {
                    build: 7,
                    craft: 8,
                    process: 7,
                    plant: 3,
                    socialize: 2,
                    forage: -7,
                    hunt: -3
                },
                'iron age': {
                    build: 8,
                    craft: 6,
                    process: 6,
                    plant: 4,
                    protect: 4,
                    war: 4,
                    socialize: 1,
                    forage: -8,
                    hunt: -4
                }
            };
            return tables[era]?.[key] || 0;
        }

        pickWeightedDecision(entries) {
            if (!entries?.length) {
                return null;
            }
            if (entries.length === 1) {
                return entries[0];
            }
            const floor = Math.max(0, entries[entries.length - 1]?.option?.score || 0);
            const weighted = entries.map((entry, index) => {
                const normalized = Math.max(0, entry.option.score - floor + 1);
                const emphasis = index === 0 ? 1.08 : 1;
                return {
                    entry,
                    weight: Math.max(0.01, normalized * normalized * emphasis)
                };
            });
            const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
            let roll = this.rng() * total;
            for (const entry of weighted) {
                roll -= entry.weight;
                if (roll <= 0) {
                    return entry.entry;
                }
            }
            return weighted[0]?.entry || entries[0];
        }

        findNearestColonist(origin, radius = Infinity) {
            let best = null;
            let bestDistance = radius;
            for (const colonist of this.colonists) {
                if (!colonist.alive) {
                    continue;
                }
                const nextDistance = distance(origin, colonist);
                const stealthAdjustedDistance = nextDistance / Math.max(0.55, this.getWeatherStealthFactor(colonist));
                if (stealthAdjustedDistance < bestDistance) {
                    best = colonist;
                    bestDistance = stealthAdjustedDistance;
                }
            }
            return best;
        }

        getMovementSpeedMultiplierAt(x, y, options = {}) {
            const weather = this.getWeatherStateAt(x, y, options);
            const cell = this.getCellAt(x, y);
            const roadRelief = Math.max(cell?.terrain?.pathWear || 0, (cell?.terrain?.roadLevel || 0) * 1.15);
            const relief = clamp(roadRelief * 0.28, 0, 0.18);
            return clamp(1 - weather.movementPenalty + relief, 0.58, 1.05);
        }

        getWeatherVisibilityRadius(origin, baseRadius, options = {}) {
            const weather = this.getWeatherStateAt(origin.x, origin.y, options);
            return Math.max(28, baseRadius * weather.visibility);
        }

        getWeatherStealthFactor(origin, options = {}) {
            const weather = this.getWeatherStateAt(origin.x, origin.y, options);
            return 1 - weather.stealthBonus;
        }

        getSeason() {
            return SEASONS[this.seasonIndex];
        }

        getWeatherPreset() {
            return this.forcedWeather || WEATHER_TYPES[this.weatherIndex];
        }

        getWeather() {
            const preset = this.getWeatherPreset();
            const state = this.weatherManager?.getGlobalState();
            return state
                ? {
                    ...preset,
                    intensity: Number(state.intensity.toFixed(2)),
                    windX: Number(state.windX.toFixed(2)),
                    windY: Number(state.windY.toFixed(2)),
                    darkness: Number(state.darkness.toFixed(2)),
                    fogDensity: Number(state.fogDensity.toFixed(2)),
                    precipitationIntensity: Number(state.precipitationIntensity.toFixed(2)),
                    transition: Number(state.transition.toFixed(2))
                }
                : preset;
        }

        getWeatherState() {
            return this.weatherManager.getGlobalState();
        }

        getWeatherStateAt(x, y, options = {}) {
            return this.weatherManager.getStateAt(x, y, options);
        }

        pickWeather() {
            const season = this.getSeason().name;
            const extremes = clamp((this.phase9?.pressure?.weatherExtremes || 0) * this.getSimulationKnob('weatherSeverity'), 0, 1);
            const roll = this.rng();
            if (season === 'Winter') {
                const coldSnap = 0.28 + extremes * 0.12;
                const storm = coldSnap + 0.18 + extremes * 0.06;
                const rain = storm + 0.14 - extremes * 0.05;
                const cloudy = rain + 0.18;
                if (roll < coldSnap) return WEATHER_TYPES[4];
                if (roll < storm) return WEATHER_TYPES[3];
                if (roll < rain) return WEATHER_TYPES[2];
                if (roll < cloudy) return WEATHER_TYPES[1];
                return WEATHER_TYPES[0];
            }
            if (season === 'Summer') {
                const drought = 0.18 + extremes * 0.16;
                const storm = drought + 0.14 + extremes * 0.06;
                const rain = storm + 0.14 - extremes * 0.06;
                const cloudy = rain + 0.18;
                if (roll < drought) return WEATHER_TYPES[5];
                if (roll < storm) return WEATHER_TYPES[3];
                if (roll < rain) return WEATHER_TYPES[2];
                if (roll < cloudy) return WEATHER_TYPES[1];
                return WEATHER_TYPES[0];
            }
            const rain = 0.16 - extremes * 0.04;
            const storm = rain + 0.1 + extremes * 0.08;
            const drought = storm + 0.07 + extremes * 0.06;
            const cloudy = drought + 0.22;
            if (roll < rain) return WEATHER_TYPES[2];
            if (roll < storm) return WEATHER_TYPES[3];
            if (roll < drought) return WEATHER_TYPES[5];
            if (roll < cloudy) return WEATHER_TYPES[1];
            return WEATHER_TYPES[0];
        }

        getTemperatureAt(x, y) {
            const cell = this.getCellAt(x, y);
            const season = this.getSeason();
            const weather = this.getWeather();
            const dayFactor = Math.sin(this.timeOfDay * Math.PI * 2 - Math.PI / 2) * 6;
            const biomeFactor = cell.biome === 'water'
                ? -2
                : cell.biome === 'rocky'
                    ? -1
                    : cell.biome === 'forest'
                        ? -0.5
                        : cell.biome === 'fertile'
                            ? 1
                            : 0;
            const shelterBonus = distance({ x, y }, this.camp) < 75 ? this.camp.shelter * 0.05 : 0;
            return season.temperature + weather.temperature + dayFactor + biomeFactor + shelterBonus;
        }

        getLightLevel() {
            const daylight = this.getSeason().daylight;
            const solar = clamp(Math.sin(this.timeOfDay * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
            return clamp(lerp(0.12, 1, solar * daylight + (1 - daylight) * 0.35), 0.08, 1);
        }

        getCellAt(x, y) {
            const col = clamp(Math.floor(x / CELL_WIDTH), 0, GRID_COLS - 1);
            const row = clamp(Math.floor(y / CELL_HEIGHT), 0, GRID_ROWS - 1);
            return this.cells[row * GRID_COLS + col];
        }

        recordTrafficAtPosition(x, y, amount = 0.04) {
            const cell = this.getCellAt(x, y);
            if (!cell?.terrain) {
                return;
            }
            cell.terrain.traffic = clamp((cell.terrain.traffic || 0) + amount, 0, 8);
        }

        recordTrafficAlongSegment(start, end, amount = 0.06) {
            if (!start || !end) {
                return;
            }
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy) || 1;
            const steps = Math.max(2, Math.ceil(length / Math.min(CELL_WIDTH, CELL_HEIGHT)));
            for (let index = 0; index <= steps; index += 1) {
                const t = index / steps;
                this.recordTrafficAtPosition(start.x + dx * t, start.y + dy * t, (amount * 10) / steps);
            }
        }

        distancePointToSegment(point, start, end) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const lengthSq = dx * dx + dy * dy || 1;
            const t = clamp((((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / lengthSq, 0, 1);
            const px = start.x + dx * t;
            const py = start.y + dy * t;
            return Math.hypot(point.x - px, point.y - py);
        }

        getRouteProfile(start, end) {
            if (!start || !end) {
                return {
                    quality: 0,
                    roadBonus: 0,
                    speedMultiplier: 1,
                    raidRisk: 0,
                    onRoad: false
                };
            }
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy) || 1;
            const steps = Math.max(2, Math.ceil(length / Math.min(CELL_WIDTH, CELL_HEIGHT)));
            let qualitySum = 0;
            let roadHits = 0;
            let roughness = 0;
            for (let index = 0; index <= steps; index += 1) {
                const t = index / steps;
                const cell = this.getCellAt(start.x + dx * t, start.y + dy * t);
                if (!cell) {
                    continue;
                }
                const wear = cell.terrain?.pathWear || 0;
                const engineered = cell.terrain?.roadLevel || 0;
                qualitySum += Math.max(wear, engineered * 1.15);
                if (wear > 0.16 || engineered > 0.22) {
                    roadHits += 1;
                }
                if (cell.biome === 'rocky' || cell.biome === 'forest' || cell.terrain?.hill) {
                    roughness += 1;
                }
            }
            const quality = clamp(qualitySum / Math.max(1, steps + 1), 0, 1);
            const roughnessPenalty = roughness / Math.max(1, steps + 1);
            const contestedRisk = (this.landUse.contestedZones || []).reduce((sum, zone) => {
                const corridorDistance = this.distancePointToSegment(zone, start, end);
                if (corridorDistance > zone.radius + 28) {
                    return sum;
                }
                return sum + clamp(zone.severity * (1 - corridorDistance / Math.max(1, zone.radius + 28)), 0, 1);
            }, 0);
            const ambushRisk = (this.landUse.ambushPoints || []).reduce((sum, point) => {
                const corridorDistance = this.distancePointToSegment(point, start, end);
                if (corridorDistance > point.radius + 16) {
                    return sum;
                }
                return sum + clamp(point.severity * (1 - corridorDistance / Math.max(1, point.radius + 16)), 0, 1);
            }, 0);
            const raidRisk = clamp(contestedRisk * 0.24 + ambushRisk * 0.34 - quality * 0.18, 0, 1);
            const roadBonus = clamp(quality * 0.32 - roughnessPenalty * 0.08, -0.12, 0.34);
            return {
                quality,
                roadBonus,
                speedMultiplier: clamp(1 + roadBonus, 0.82, 1.34),
                raidRisk,
                onRoad: roadHits >= Math.max(2, Math.floor((steps + 1) * 0.45))
            };
        }

        getCellsNear(x, y, radius, filter = null) {
            const matches = [];
            for (const cell of this.cells) {
                const center = {
                    x: cell.x + CELL_WIDTH * 0.5,
                    y: cell.y + CELL_HEIGHT * 0.5
                };
                if (distance(center, { x, y }) > radius) {
                    continue;
                }
                if (filter && !filter(cell)) {
                    continue;
                }
                matches.push(cell);
            }
            return matches;
        }

        getTerrainFeatureCounts() {
            const counts = {
                marsh: 0,
                clearedForest: 0,
                irrigationChannels: 0,
                terracedCells: 0,
                drainedMarshCells: 0,
                fortifiedHills: 0,
                quarriedMountains: 0
            };
            for (const cell of this.cells) {
                const terrain = cell.terrain || {};
                if (terrain.marsh && !terrain.drained) {
                    counts.marsh += 1;
                }
                if (terrain.cleared) {
                    counts.clearedForest += 1;
                }
                if (terrain.irrigation) {
                    counts.irrigationChannels += 1;
                }
                if (terrain.terraced) {
                    counts.terracedCells += 1;
                }
                if (terrain.drained) {
                    counts.drainedMarshCells += 1;
                }
                if (terrain.fortified) {
                    counts.fortifiedHills += 1;
                }
                if (terrain.quarried) {
                    counts.quarriedMountains += 1;
                }
            }
            return counts;
        }

        transformNearbyCells(origin, radius, predicate, apply, limit = 3) {
            const matches = this.getCellsNear(origin.x, origin.y, radius, predicate)
                .sort((left, right) => (
                    distance({ x: left.x + CELL_WIDTH * 0.5, y: left.y + CELL_HEIGHT * 0.5 }, origin) -
                    distance({ x: right.x + CELL_WIDTH * 0.5, y: right.y + CELL_HEIGHT * 0.5 }, origin)
                ));
            let changed = 0;
            for (const cell of matches) {
                if (changed >= limit) {
                    break;
                }
                if (apply(cell) !== false) {
                    changed += 1;
                }
            }
            return changed;
        }

        markForestClearingAt(x, y) {
            const cell = this.getCellAt(x, y);
            if (!cell || cell.biome !== 'forest') {
                return false;
            }
            cell.terrain.cleared = true;
            if (cell.terrain.marsh && !cell.terrain.drained) {
                cell.terrain.marsh = false;
            }
            cell.biome = cell.moisture > 0.22 ? 'fertile' : 'grassland';
            return true;
        }

        markQuarryAt(x, y) {
            const cell = this.getCellAt(x, y);
            if (!cell || cell.biome !== 'rocky') {
                return false;
            }
            cell.terrain.quarried = true;
            cell.terrain.mountain = true;
            return true;
        }

        applyTerraformingAroundBuilding(building) {
            if (!building) {
                return;
            }
            if (building.type === 'engineeredFarm') {
                this.transformNearbyCells(
                    building,
                    110,
                    (cell) => cell.biome !== 'water' && cell.biome !== 'valley' && cell.terrain.hill && !cell.terrain.terraced,
                    (cell) => {
                        cell.terrain.terraced = true;
                        cell.terrain.irrigation = true;
                        if (cell.biome === 'grassland' || cell.biome === 'forest') {
                            cell.biome = 'fertile';
                        }
                    },
                    4
                );
            }
            if (building.type === 'irrigation' || building.type === 'canal') {
                this.transformNearbyCells(
                    building,
                    120,
                    (cell) => cell.biome !== 'water' && cell.biome !== 'valley' && !cell.terrain.irrigation,
                    (cell) => {
                        cell.terrain.irrigation = true;
                        if (cell.terrain.marsh) {
                            cell.terrain.drained = true;
                            cell.terrain.marsh = false;
                            if (cell.biome === 'grassland') {
                                cell.biome = 'fertile';
                            }
                        }
                    },
                    building.type === 'canal' ? 5 : 3
                );
            }
            if (
                building.type === 'wall' ||
                building.type === 'watchtower' ||
                building.type === 'fortifiedStructure' ||
                building.type === 'stoneKeep'
            ) {
                this.transformNearbyCells(
                    building,
                    120,
                    (cell) => cell.biome !== 'water' && cell.biome !== 'valley' && cell.terrain.hill && !cell.terrain.fortified,
                    (cell) => {
                        cell.terrain.fortified = true;
                        if (cell.biome === 'grassland') {
                            cell.biome = 'rocky';
                        }
                    },
                    building.type === 'stoneKeep' ? 5 : 3
                );
            }
        }

        pushThought(message) {
            this.thoughts.unshift(message);
            this.thoughts = this.thoughts.slice(0, 18);
        }

        pushEvent(message) {
            this.events.unshift(message);
            this.events = this.events.slice(0, 22);
        }

        observeNearbyResources(colonist) {
            for (const resource of this.resources) {
                if (resource.depleted) {
                    continue;
                }
                if (distance(colonist, resource) <= 60) {
                    this.rememberResource(resource, colonist);
                    this.noteDiscovery(`resource:${resource.type}`, `${colonist.name} discovered ${resource.type}.`);
                }
            }
            for (const animal of this.animals) {
                if (animal.depleted) {
                    continue;
                }
                if (distance(colonist, animal) <= 70) {
                    this.rememberResource(animal, colonist);
                    this.noteDiscovery('resource:wildAnimal', `${colonist.name} spotted live game.`);
                }
            }
            for (const predator of this.predators) {
                if (distance(colonist, predator) <= 85) {
                    this.rememberDanger({ x: predator.x, y: predator.y }, colonist, 'predator');
                    break;
                }
            }
            if (distance(colonist, this.camp) <= 85) {
                this.rememberShelterSpot(this.camp, colonist);
            }
            this.shareKnowledgeFromColonist(colonist);
        }

        rememberResource(resource, colonist = null) {
            const type = resource.type;
            if (!this.lineageMemory.knownResources[type]) {
                return;
            }
            if (colonist?.memory?.resources?.[type]) {
                rememberPoint(colonist.memory.resources[type], resource, 6, 22);
            }
            rememberPoint(this.colonyKnowledge.resources[type], resource, 8, 24);
            rememberPoint(this.lineageMemory.knownResources[type], resource, 8, 28);
        }

        rememberDanger(point, colonist = null, cause = 'danger') {
            const dangerPoint = { x: point.x, y: point.y, cause };
            if (colonist) {
                rememberPoint(colonist.memory.dangerZones, dangerPoint, 6, 28);
            }
            rememberPoint(this.colonyKnowledge.dangerZones, dangerPoint, 8, 30);
            rememberPoint(this.lineageMemory.dangerZones, dangerPoint, 8, 32);
        }

        rememberShelterSpot(point, colonist = null) {
            if (colonist) {
                rememberPoint(colonist.memory.shelterSpots, point, 4, 22);
            }
            rememberPoint(this.colonyKnowledge.shelterSpots, point, 6, 24);
            rememberPoint(this.lineageMemory.shelterSpots, point, 6, 26);
        }

        recordFailedAction(colonist, action) {
            colonist.memory.failedActions = colonist.memory.failedActions || {};
            colonist.memory.successfulActions = colonist.memory.successfulActions || {};
            colonist.memory.actionConfidence = colonist.memory.actionConfidence || {};
            this.colonyKnowledge.failedActions = this.colonyKnowledge.failedActions || {};
            colonist.memory.failedActions[action] = (colonist.memory.failedActions[action] || 0) + 1;
            this.colonyKnowledge.failedActions[action] = (this.colonyKnowledge.failedActions[action] || 0) + 1;
            const key = this.normalizeActionMemoryKey(action);
            colonist.memory.actionConfidence[key] = clamp((colonist.memory.actionConfidence[key] || 0) - 0.12, -1, 1);
        }

        recordSuccessfulAction(colonist, action) {
            const key = this.normalizeActionMemoryKey(action);
            colonist.memory.successfulActions = colonist.memory.successfulActions || {};
            colonist.memory.actionConfidence = colonist.memory.actionConfidence || {};
            colonist.memory.successfulActions[key] = (colonist.memory.successfulActions[key] || 0) + 1;
            colonist.memory.actionConfidence[key] = clamp((colonist.memory.actionConfidence[key] || 0) + 0.08, -1, 1);
        }

        noteDiscovery(key, message) {
            if (this.colonyKnowledge.discoveries.includes(key)) {
                return;
            }
            this.colonyKnowledge.discoveries.unshift(key);
            this.colonyKnowledge.discoveries = this.colonyKnowledge.discoveries.slice(0, 16);
            if (!this.lineageMemory.discoveries.includes(key)) {
                this.lineageMemory.discoveries.unshift(key);
                this.lineageMemory.discoveries = this.lineageMemory.discoveries.slice(0, 20);
            }
            this.pushEvent(message);
            this.evaluateLegacyMilestones();
        }

        unlockAchievement(key, message = null) {
            if (!LEGACY_MILESTONE_DEFS[key] || this.achievements.includes(key)) {
                return false;
            }
            this.achievements.unshift(key);
            this.achievements = this.achievements.slice(0, 40);
            if (!this.lineageMemory.achievements.includes(key)) {
                this.lineageMemory.achievements.unshift(key);
                this.lineageMemory.achievements = this.lineageMemory.achievements.slice(0, 60);
            }
            const entry = {
                key,
                label: LEGACY_MILESTONE_DEFS[key].label,
                year: this.year,
                day: this.day
            };
            this.achievementLog.unshift(entry);
            this.achievementLog = this.achievementLog.slice(0, 16);
            this.pushEvent(message || LEGACY_MILESTONE_DEFS[key].message);
            return true;
        }

        evaluateLegacyMilestones() {
            const storageCount = this.countBuildings('storage') + this.countBuildings('storagePit') + this.countBuildings('granary') + this.countBuildings('warehouse');
            const shelterCount = this.countBuildings('hut') + this.countBuildings('cottage') + this.countBuildings('house') + this.countBuildings('fortifiedStructure');
            const firstBranch = this.getActiveBranchColonies().length > 0;
            const alliances = this.getActiveBranchColonies().some((colony) => colony.diplomacyState === 'allied' || (colony.history?.alliances || 0) > 0);
            const rivals = this.getActiveBranchColonies().some((colony) => colony.diplomacyState === 'rival' || (colony.history?.raids || 0) > 0);
            const trades = this.getActiveBranchColonies().some((colony) => (colony.history?.trades || 0) > 0);
            const childCount = this.families.reduce((sum, family) => sum + family.childIds.length, 0);
            const ritualCount = this.rituals.length;

            if (this.colonyKnowledge.discoveries.includes('skill:tool_use')) {
                this.unlockAchievement('toolKnowledge');
            }
            if (this.countBuildings('campfire') > 0) {
                this.unlockAchievement('firstCampfire');
            }
            if (this.countBuildings('leanTo') > 0) {
                this.unlockAchievement('firstLeanTo');
            }
            if (shelterCount > 0) {
                this.unlockAchievement('firstShelter');
            }
            if (storageCount > 0) {
                this.unlockAchievement('firstStorage');
            }
            if (this.countBuildings('workshop') > 0) {
                this.unlockAchievement('firstWorkshop');
            }
            if (this.countBuildings('farmPlot') > 0) {
                this.unlockAchievement('firstFarmPlot');
            }
            if (this.families.length > 0) {
                this.unlockAchievement('firstFamily');
            }
            if (childCount > 0) {
                this.unlockAchievement('firstChild');
            }
            if (firstBranch) {
                this.unlockAchievement('firstBranchColony');
            }
            if (trades) {
                this.unlockAchievement('firstTradeRoute');
            }
            if (alliances) {
                this.unlockAchievement('firstAlliance');
            }
            if (rivals) {
                this.unlockAchievement('firstRival');
            }
            if (
                this.colonyKnowledge.discoveries.includes('resource:water') &&
                this.colonyKnowledge.discoveries.includes('resource:berries') &&
                this.countBuildings('leanTo') > 0
            ) {
                this.unlockAchievement('phase1Foundation');
            }
            if (
                this.countCompletedAction('collectWater') >= 4 &&
                (this.countCompletedAction('attackPredator') > 0 || this.countCompletedAction('flee') > 0 || this.getPredatorPressure() > 0)
            ) {
                this.unlockAchievement('phase2Survivors');
            }
            if (
                this.colonyKnowledge.discoveries.includes('skill:tool_use') &&
                this.colonyKnowledge.discoveries.includes('skill:planting') &&
                this.getColonySkillAverage('foraging') >= 1
            ) {
                this.unlockAchievement('phase3Learners');
            }
            if (
                this.countOwnedItems('axe') + this.countOwnedItems('hammer') + this.countOwnedItems('basket') + this.countOwnedItems('hoe') + this.countOwnedItems('spear') > 0 &&
                this.countCompletedAction('craftRecipe') >= 4
            ) {
                this.unlockAchievement('phase4Makers');
            }
            if (
                this.families.length > 0 &&
                storageCount > 0 &&
                this.countBuildings('farmPlot') > 0 &&
                (this.countBuildings('leanTo') + shelterCount) > 0
            ) {
                this.unlockAchievement('phase5Settlement');
            }
            if (
                this.families.length > 0 &&
                childCount > 0 &&
                ritualCount > 0 &&
                firstBranch
            ) {
                this.unlockAchievement('phase6People');
            }
            if (
                (this.hasTechnology('engineering') || this.countBuildings('irrigation') > 0) &&
                (this.landUse.districts?.length || 0) > 0 &&
                (this.landUse.roads?.length || 0) > 0
            ) {
                this.unlockAchievement('phase7CivilGrowth');
            }
            if (
                firstBranch &&
                (trades || alliances || rivals)
            ) {
                this.unlockAchievement('phase8RegionalPlay');
            }
        }

        shareKnowledgeFromColonist(colonist) {
            if (colonist.knowledgeShareCooldown > 0) {
                return;
            }
            const peers = this.colonists.filter((entry) =>
                entry !== colonist &&
                entry.alive &&
                distance(entry, colonist) < 58
            );
            if (!peers.length) {
                return;
            }
            for (const peer of peers) {
                for (const type of Object.keys(colonist.memory.resources)) {
                    const memory = colonist.memory.resources[type][0];
                    if (memory) {
                        rememberPoint(peer.memory.resources[type], memory, 6, 22);
                    }
                }
                const danger = colonist.memory.dangerZones[0];
                if (danger) {
                    rememberPoint(peer.memory.dangerZones, danger, 6, 26);
                }
                const shelter = colonist.memory.shelterSpots[0];
                if (shelter) {
                    rememberPoint(peer.memory.shelterSpots, shelter, 4, 22);
                }
                if (colonist.skills.survival > peer.skills.survival) {
                    peer.gainSkill('survival', 0.3);
                    colonist.relationships.mentorStudent[peer.id] = (colonist.relationships.mentorStudent[peer.id] || 0) + 1;
                    this.pushThought(`${colonist.name} mentored ${peer.name}.`);
                }
                const observedStep = colonist.plan[colonist.planStep];
                if (observedStep?.action) {
                    const skill = this.skillForAction(observedStep.action);
                    if (skill && colonist.skills[skill] > peer.skills[skill]) {
                        peer.gainSkill(skill, 0.25);
                        this.pushThought(`${peer.name} copied ${colonist.name}.`);
                    }
                }
                const warmth = colonist.familyId && peer.familyId === colonist.familyId ? 0.18 : colonist.traits.sociability * 0.08;
                colonist.relationships.friends[peer.id] = (colonist.relationships.friends[peer.id] || 0) + warmth;
                peer.relationships.friends[colonist.id] = (peer.relationships.friends[colonist.id] || 0) + warmth;
                colonist.mood.social = clamp(colonist.mood.social + 0.1, -5, 5);
                peer.mood.social = clamp(peer.mood.social + 0.12, -5, 5);
            }
            colonist.knowledgeShareCooldown = 6;
        }

        updateRelationshipsAndConflict(dt) {
            const adults = this.colonists.filter((colonist) => colonist.alive && colonist.lifeStage === 'adult');
            for (const colonist of adults) {
                colonist.mood.social = clamp(colonist.mood.social - dt * 0.03, -5, 5);
                colonist.mood.conflict = clamp(colonist.mood.conflict - dt * 0.02, -5, 5);
                colonist.mood.purpose = clamp(colonist.mood.purpose + (colonist.plan.length ? dt * 0.015 : -dt * 0.02), -5, 5);
                for (const [peerId, value] of Object.entries(colonist.relationships.rivals)) {
                    const decay = dt * (
                        colonist.stats.morale > 58 && colonist.mood.conflict < 1.5
                            ? 0.06
                            : 0.025
                    );
                    const next = Math.max(0, value - decay);
                    if (next <= 0.04) {
                        delete colonist.relationships.rivals[peerId];
                    } else {
                        colonist.relationships.rivals[peerId] = next;
                    }
                }
            }
            for (let i = 0; i < adults.length; i++) {
                for (let j = i + 1; j < adults.length; j++) {
                    const left = adults[i];
                    const right = adults[j];
                    if (distance(left, right) > 28) {
                        continue;
                    }
                    const sharedFamily = left.familyId && right.familyId && left.familyId === right.familyId;
                    const friendBond = (left.relationships.friends[right.id] || 0) + (right.relationships.friends[left.id] || 0);
                    const existingRivalry = (left.relationships.rivals[right.id] || 0) + (right.relationships.rivals[left.id] || 0);
                    const colonyStability = this.getColonyStability();
                    const friction = Math.max(
                        0,
                        (left.traits.aggression + right.traits.aggression) -
                            (left.traits.sociability + right.traits.sociability) -
                            friendBond * 0.08 -
                            (sharedFamily ? 0.45 : 0) -
                            colonyStability * 0.35
                    );
                    const clashChance = 0.0008 + Math.max(0, friction - 0.6) * 0.0011 + existingRivalry * 0.00018;
                    if (friction > 0.68 && this.rng() < clashChance) {
                        left.relationships.rivals[right.id] = (left.relationships.rivals[right.id] || 0) + 1;
                        right.relationships.rivals[left.id] = (right.relationships.rivals[left.id] || 0) + 1;
                        left.mood.conflict = clamp(left.mood.conflict + 0.8, -5, 5);
                        right.mood.conflict = clamp(right.mood.conflict + 0.8, -5, 5);
                        left.stats.morale = clamp(left.stats.morale - 1.4, 0, 100);
                        right.stats.morale = clamp(right.stats.morale - 1.4, 0, 100);
                        this.relationshipEvents.unshift(`${left.name} clashed with ${right.name}.`);
                        this.relationshipEvents = this.relationshipEvents.slice(0, 10);
                    }
                }
            }
        }

        updateRituals(dt = 1 / 30) {
            const seasonName = this.getSeason().name;
            if (seasonName !== this.lastSeasonName) {
                if (seasonName === 'Spring' && this.countBuildings('farmPlot') > 0) {
                    this.rituals.unshift({ type: 'planting festival', day: this.day, year: this.year });
                    this.pushEvent('The colony held a planting festival.');
                }
                if (seasonName === 'Winter' && this.predators.length > 0) {
                    this.rituals.unshift({ type: 'war preparation', day: this.day, year: this.year });
                    this.pushEvent('The colony prepared for winter dangers.');
                }
                this.rituals = this.rituals.slice(0, 12);
                this.lastSeasonName = seasonName;
            }
            const recentMourning = this.rituals.find((ritual) => {
                if (ritual.type !== 'mourning dead') {
                    return false;
                }
                const ageDays = (this.year - ritual.year) * (DAYS_PER_SEASON * 4) + (this.day - ritual.day);
                return ageDays >= 0 && ageDays <= 5;
            });
            if (!recentMourning) {
                return;
            }
            for (const colonist of this.colonists) {
                if (!colonist.alive) {
                    continue;
                }
                const griefLoad = colonist.emotionalMemory?.griefLoad || 0;
                const traumaLoad = colonist.emotionalMemory?.battleTrauma || 0;
                const mourningActive = (colonist.emotionalMemory?.mourningTtl || 0) > 0 || griefLoad > 0.06;
                if (!mourningActive) {
                    continue;
                }
                colonist.emotionalMemory.griefLoad = clamp(griefLoad - dt * 0.16, 0, 1);
                colonist.emotionalMemory.battleTrauma = clamp(traumaLoad - dt * 0.09, 0, 1);
                colonist.stats.morale = clamp(colonist.stats.morale + dt * 7.2, 0, 100);
                colonist.stats.social = clamp(colonist.stats.social + dt * 9, 0, 100);
                colonist.recentAction = colonist.recentAction === 'sleeping' ? colonist.recentAction : 'mourning together';
            }
        }

        maybeFoundBranchColony() {
            const values = this.lineageMemory.culturalValues;
            const homes = this.getResidentialBuildings();
            const familyCount = this.families.filter((family) => family.adultIds.length >= 1).length;
            const childCount = this.families.reduce((sum, family) => sum + family.childIds.length, 0);
            const matureFamilies = this.families.filter((family) => family.homeBuildingId && family.memberIds.length >= 2).length;
            const rivalryPressure = this.colonists.reduce((sum, colonist) => sum + Object.keys(colonist.relationships.rivals).length, 0);
            const overcrowding = this.colonists.length - this.getBuildingCapacity();
            const settlementMaturity =
                (homes.length > 0 ? 1 : 0) +
                (this.countBuildings('storage') + this.countBuildings('storagePit') > 0 ? 1 : 0) +
                (this.countBuildings('farmPlot') > 0 ? 1 : 0) +
                (this.countBuildings('workshop') > 0 ? 1 : 0);
            if (this.getActiveBranchColonies().length >= MAX_ACTIVE_BRANCH_COLONIES || this.colonists.length < 4) {
                return;
            }
            const daughterReady =
                (matureFamilies > 0 || childCount > 0 || values.favorExpansion > -0.1) &&
                this.getHousingSatisfaction() > 0.8 &&
                this.camp.food > 12 &&
                homes.length > 0 &&
                familyCount > 0 &&
                (childCount > 0 || matureFamilies > 0 || this.year >= 3) &&
                (this.year >= 2 || (this.year >= 1 && settlementMaturity >= 2 && matureFamilies > 0 && this.camp.food > 15));
            const splinterReady =
                rivalryPressure > 4 ||
                (overcrowding > 2 && values.avoidStrangers > 0.58 && (this.year >= 2 || settlementMaturity >= 3));
            const chance = daughterReady
                ? 0.0024 + Math.min(0.0016, childCount * 0.00022 + matureFamilies * 0.00028 + settlementMaturity * 0.00018)
                : splinterReady
                    ? 0.0015 + Math.min(0.0007, settlementMaturity * 0.00018 + rivalryPressure * 0.00008)
                    : 0;
            if (chance > 0 && this.rng() < chance) {
                const site = this.findBranchColonySite();
                if (!site) {
                    return;
                }
                const founderFamily = this.families
                    .filter((family) => family.memberIds.length >= 2)
                    .sort((a, b) => {
                        const aAdults = a.adultIds
                            .map((id) => this.colonists.find((colonist) => colonist.id === id))
                            .filter(Boolean);
                        const bAdults = b.adultIds
                            .map((id) => this.colonists.find((colonist) => colonist.id === id))
                            .filter(Boolean);
                        const familyScore = (family, adultsInFamily) => {
                            const morale = adultsInFamily.reduce((sum, colonist) => sum + colonist.stats.morale, 0);
                            const cohesion = adultsInFamily.reduce((sum, colonist) => {
                                return sum + Object.values(colonist.relationships.friends).reduce((peerSum, value) => peerSum + value, 0);
                            }, 0);
                            return family.memberIds.length * 6 + family.childIds.length * 3 + morale * 0.08 + cohesion * 0.02;
                        };
                        return familyScore(b, bAdults) - familyScore(a, aAdults);
                    })[0] || null;
                const founderNames = founderFamily
                    ? founderFamily.memberIds
                        .map((id) => this.colonists.find((colonist) => colonist.id === id)?.name)
                        .filter(Boolean)
                        .slice(0, 2)
                    : this.colonists.slice(0, 2).map((colonist) => colonist.name);
                const familyLedExpansion =
                    founderFamily &&
                    familyCount > 0 &&
                    this.getHousingSatisfaction() > 0.78 &&
                    settlementMaturity >= 2 &&
                    overcrowding <= 1;
                const severeFactionalSplit =
                    splinterReady &&
                    rivalryPressure > 5 &&
                    values.avoidStrangers > Math.max(0.38, values.favorExpansion + 0.08);
                const hostileBias = clamp(
                    rivalryPressure * 0.1 +
                    Math.max(0, values.avoidStrangers) * 0.45 +
                    Math.max(0, overcrowding) * 0.08 +
                    (severeFactionalSplit ? 0.28 : 0),
                    0,
                    1.35
                );
                const cooperativeBias = clamp(
                    matureFamilies * 0.18 +
                    childCount * 0.08 +
                    settlementMaturity * 0.12 +
                    Math.max(0, values.shareFood) * 0.28 +
                    Math.max(0, values.favorExpansion) * 0.22 +
                    (familyLedExpansion ? 0.25 : 0),
                    0,
                    1.35
                );
                const daughterChance = clamp(
                    0.5 +
                    (cooperativeBias - hostileBias) * 0.35 +
                    (daughterReady ? 0.15 : 0) -
                    (splinterReady ? 0.08 : 0),
                    0.12,
                    0.88
                );
                const type = this.rng() < daughterChance ? 'daughter' : 'splinter';
                const daughter = this.normalizeBranchColony({
                    id: this.branchColonies.length + 1,
                    type,
                    foundedDay: this.day,
                    foundedYear: this.year,
                    population: Math.max(2, Math.min(4, Math.max(Math.floor(this.colonists.length / 3), founderFamily?.childIds?.length ? 2 : 1))),
                    x: Math.round(site.x),
                    y: Math.round(site.y),
                    biome: site.biome,
                    name: `${type === 'splinter' ? 'Splinter' : 'Daughter'} Hold ${this.branchColonies.length + 1}`,
                    food: 10,
                    water: 9,
                    wood: 6,
                    stone: 4,
                    tradeCooldown: 32 + this.rng() * 18,
                    infoCooldown: 24 + this.rng() * 18,
                    inheritedCulture: clone(this.lineageMemory.culturalValues),
                    founderNames,
                    factionIdentity: type === 'daughter'
                        ? {
                            culture: 'valley rim kin',
                            militaryTendency: 0.18 + Math.max(0, values.avoidStrangers) * 0.08,
                            tradeTendency: 0.74 + Math.max(0, values.shareFood) * 0.08,
                            fear: 0.16,
                            trust: 0.78,
                            envy: 0.08
                        }
                        : null,
                    diplomacyState: type === 'daughter' ? 'trading' : 'cautious',
                    borderFriction: type === 'daughter' ? 0.06 : 0.12
                }, this.branchColonies.length);
                this.branchColonies.push(daughter);
                this.ensureBranchColonyStarterResources(daughter);
                this.lineageMemory.branchColonies = clone(this.branchColonies);
                if (type === 'splinter') {
                    this.pushEvent(`A splinter group founded a hard-edged settlement inside the valley rim, carrying the ${daughter.culturalPath} path.`);
                } else {
                    this.pushEvent(`A daughter colony was founded along the valley rim, carrying the ${daughter.culturalPath} path.`);
                }
            }
        }

        skillForAction(action) {
            const mapping = {
                collectFood: 'foraging',
                eatAndGatherFood: 'foraging',
                huntAnimal: 'hunting',
                huntMeal: 'hunting',
                collectWood: 'building',
                collectStone: 'building',
                craftPractice: 'crafting',
                plantTrial: 'farming',
                tendWounds: 'medicine',
                attackPredator: 'combat',
                collectWater: 'survival'
            };
            return mapping[action] || null;
        }

        recordDeath(colonist) {
            if (colonist.fearKnowledgeInjected) {
                return;
            }
            const cause = this.identifyDeathCause(colonist);
            this.lineageMemory.deathCauses[cause] += 1;
            this.rememberDanger(colonist, null, cause);
            const traitKeys = Object.keys(this.lineageMemory.traitAverages);
            for (const key of traitKeys) {
                this.lineageMemory.traitAverages[key] = clamp(
                    this.lineageMemory.traitAverages[key] * 0.92 + colonist.traits[key] * 0.08,
                    0.05,
                    0.95
                );
            }
            const lesson = this.lessonForCause(cause);
            if (!this.lineageMemory.lessons.includes(lesson)) {
                this.lineageMemory.lessons.unshift(lesson);
                this.lineageMemory.lessons = this.lineageMemory.lessons.slice(0, 6);
            }
            if (colonist.lastDamageCause === 'battle') {
                this.registerBattleDeathMemory(colonist);
                const warLesson = 'War leaves scars, exile, and reasons to fortify.';
                if (!this.lineageMemory.lessons.includes(warLesson)) {
                    this.lineageMemory.lessons.unshift(warLesson);
                    this.lineageMemory.lessons = this.lineageMemory.lessons.slice(0, 6);
                }
                this.lineageMemory.culturalValues.avoidStrangers = clamp(this.lineageMemory.culturalValues.avoidStrangers + 0.04, -1, 1);
                this.lineageMemory.culturalValues.favorExpansion = clamp(this.lineageMemory.culturalValues.favorExpansion + 0.03, -1, 1);
            }
            this.rituals.unshift({ type: 'mourning dead', day: this.day, year: this.year, name: colonist.name });
            this.rituals = this.rituals.slice(0, 12);
        }

        identifyDeathCause(colonist) {
            if (colonist.lastDamageCause === 'predatorAttack') {
                return 'predatorAttack';
            }
            if (colonist.lastDamageCause === 'lightningStrike') {
                return 'lightningStrike';
            }
            const stats = colonist.stats;
            const lowest = Math.min(stats.hunger, stats.thirst, stats.warmth, stats.energy);
            switch (lowest) {
                case stats.thirst:
                    return 'dehydration';
                case stats.warmth:
                    return 'exposure';
                case stats.energy:
                    return 'exhaustion';
                default:
                    return 'starvation';
            }
        }

        lessonForCause(cause) {
            switch (cause) {
                case 'dehydration': return 'Water must be hauled before camp runs dry.';
                case 'starvation': return 'Food patches need to be stocked before hunger spikes.';
                case 'exposure': return 'Cold nights punish weak shelter and low fire fuel.';
                case 'exhaustion': return 'Rest has to happen before collapse sets in.';
                case 'predatorAttack': return 'Predators force distance, fear, and retreat.';
                case 'lightningStrike': return 'Storms punish exposed ground and weak shelter.';
                default: return 'The colony needs better survival habits.';
            }
        }

        exportLineageMemory() {
            const settlement = this.lineageMemory.settlementKnowledge || {};
            settlement.housingTier = Math.max(
                settlement.housingTier || 0,
                this.countBuildings('cottage') > 0 ? 1 : 0,
                this.countBuildings('house') > 0 ? 2 : 0,
                this.countBuildings('fortifiedStructure') > 0 ? 3 : 0,
                this.countBuildings('stoneKeep') > 0 ? 4 : 0
            );
            settlement.storageTier = Math.max(
                settlement.storageTier || 0,
                this.countBuildings('granary') > 0 ? 1 : 0,
                this.countBuildings('warehouse') > 0 ? 2 : 0,
                this.countBuildings('civicComplex') > 0 ? 3 : 0
            );
            settlement.civicTier = Math.max(
                settlement.civicTier || 0,
                this.countBuildings('kitchen') > 0 ? 1 : 0,
                this.countBuildings('mill') > 0 ? 2 : 0,
                this.countBuildings('foodHall') > 0 ? 3 : 0,
                this.countBuildings('civicComplex') > 0 ? 4 : 0
            );
            settlement.defenseTier = Math.max(
                settlement.defenseTier || 0,
                this.countBuildings('watchtower') > 0 ? 1 : 0,
                this.countBuildings('wall') > 0 ? 2 : 0,
                this.countBuildings('fortifiedStructure') > 0 ? 3 : 0,
                this.countBuildings('stoneKeep') > 0 ? 4 : 0
            );
            settlement.metallurgyHints = Math.max(
                settlement.metallurgyHints || 0,
                this.hasTechnology('metallurgy') ? 2 : 0,
                this.countBuildings('mill') > 0 && this.countCompletedAction('collectStone') >= 10 ? 1 : 0
            );
            return {
                generation: this.generation,
                knownResources: clone(this.lineageMemory.knownResources),
                deathCauses: clone(this.lineageMemory.deathCauses),
                dangerZones: clone(this.lineageMemory.dangerZones),
                shelterSpots: clone(this.lineageMemory.shelterSpots),
                discoveries: clone(this.lineageMemory.discoveries),
                lessons: clone(this.lineageMemory.lessons),
                settlementKnowledge: clone(this.lineageMemory.settlementKnowledge),
                traitAverages: clone(this.lineageMemory.traitAverages),
                culturalValues: clone(this.lineageMemory.culturalValues),
                achievements: clone(this.lineageMemory.achievements),
                branchColonies: clone(this.branchColonies)
            };
        }

        getSaveMetadata(saveType = 'manual', savedAt = Date.now()) {
            return {
                version: 1,
                type: saveType,
                savedAt,
                generation: this.generation,
                year: this.year,
                day: this.day,
                season: this.getSeason().name,
                weather: this.getWeather().name,
                population: this.colonists.length
            };
        }

        getSelectedEntityRef() {
            const entity = this.selectedEntity;
            if (!entity) {
                return null;
            }
            if (typeof entity.id === 'number') {
                if (this.colonists.includes(entity)) return { kind: 'colonist', id: entity.id };
                if (this.buildings.includes(entity)) return { kind: 'building', id: entity.id };
                if (this.resources.includes(entity)) return { kind: 'resource', id: entity.id };
                if (this.animals.includes(entity)) return { kind: 'animal', id: entity.id };
                if (this.predators.includes(entity)) return { kind: 'predator', id: entity.id };
                if (this.branchColonies.includes(entity)) return { kind: 'colony', id: entity.id };
            }
            return null;
        }

        restoreSelectedEntity(ref) {
            if (!ref) {
                this.selectedEntity = null;
                return;
            }
            const pools = {
                colonist: this.colonists,
                building: this.buildings,
                resource: this.resources,
                animal: this.animals,
                predator: this.predators,
                colony: this.branchColonies
            };
            const pool = pools[ref.kind] || [];
            this.selectedEntity = pool.find((entry) => entry.id === ref.id) || null;
        }

        exportSaveState(saveType = 'manual') {
            const savedAt = Date.now();
            return {
                version: 1,
                metadata: this.getSaveMetadata(saveType, savedAt),
                world: {
                    seed: this.seed,
                    elapsed: this.elapsed,
                    timeOfDay: this.timeOfDay,
                    day: this.day,
                    year: this.year,
                    seasonIndex: this.seasonIndex,
                    daysPerSeason: this.daysPerSeason,
                    weatherIndex: this.weatherIndex,
                    weatherTimer: this.weatherTimer,
                    weatherDuration: this.weatherDuration,
                    forcedWeather: this.forcedWeather,
                    weatherManager: this.weatherManager.exportState(),
                    simulationSpeed: this.simulationSpeed,
                    paused: this.paused,
                    generation: this.generation,
                    lineageMemory: this.exportLineageMemory(),
                    colonyKnowledge: clone(this.colonyKnowledge),
                    extinctionSnapshot: clone(this.extinctionSnapshot),
                    nextItemId: this.nextItemId,
                    nextProjectId: this.nextProjectId,
                    nextColonistId: this.nextColonistId,
                    nextFamilyId: this.nextFamilyId,
                    nextResourceId: this.nextResourceId,
                    progress: clone(this.progress),
                    recentLabor: clone(this.recentLabor),
                    projects: clone(this.projects),
                    buildings: clone(this.buildings),
                    families: clone(this.families),
                    relationshipEvents: clone(this.relationshipEvents),
                    rituals: clone(this.rituals),
                    branchColonies: clone(this.branchColonies),
                    lastSeasonName: this.lastSeasonName,
                    structureRaidCooldown: this.structureRaidCooldown,
                    mainAttackCooldown: this.mainAttackCooldown,
                    weatherDamageCooldown: this.weatherDamageCooldown,
                    lightningStrikeCooldown: this.lightningStrikeCooldown,
                    lastResolvedLightningFlash: this.lastResolvedLightningFlash,
                    usedNames: Array.from(this.usedNames || []),
                    borderIncidents: clone(this.borderIncidents),
                    factionEvents: clone(this.factionEvents),
                    lastRaid: clone(this.lastRaid || null),
                    factionParties: clone(this.factionParties),
                    factionEffects: clone(this.factionEffects),
                    battlefronts: clone(this.battlefronts),
                    battleBursts: clone(this.battleBursts),
                    battleScars: clone(this.battleScars),
                    battleReports: clone(this.battleReports),
                    reportCounter: this.reportCounter,
                    godMode: clone(this.godMode),
                    warAftermath: clone(this.warAftermath),
                    achievements: clone(this.achievements),
                    achievementLog: clone(this.achievementLog),
                    phase9: clone(this.phase9),
                    eraHistory: clone(this.eraHistory),
                    lastKnownEra: this.lastKnownEra,
                    foodCulture: clone(this.foodCulture),
                    institutionLife: clone(this.institutionLife),
                    knownInstitutions: clone(this.knownInstitutions),
                    landUse: clone(this.landUse),
                    camp: clone(this.camp),
                    terrain: clone(this.terrain || null),
                    resources: clone(this.resources),
                    animals: clone(this.animals),
                    predators: clone(this.predators),
                    thoughts: clone(this.thoughts),
                    events: clone(this.events),
                    colonyMetrics: clone(this.colonyMetrics || {}),
                    colonists: this.colonists.map((colonist) => exportColonistSnapshot(colonist)),
                    selectedEntityRef: this.getSelectedEntityRef()
                }
            };
        }

        applySaveState(saveState) {
            const state = clone(saveState?.world || {});
            this.seed = state.seed ?? this.seed;
            this.elapsed = state.elapsed ?? 0;
            this.timeOfDay = state.timeOfDay ?? 0.28;
            this.day = state.day ?? 1;
            this.year = state.year ?? 1;
            this.seasonIndex = state.seasonIndex ?? 0;
            this.daysPerSeason = state.daysPerSeason ?? DAYS_PER_SEASON;
            this.weatherIndex = state.weatherIndex ?? 0;
            this.weatherTimer = state.weatherTimer ?? 55;
            this.weatherDuration = state.weatherDuration ?? this.weatherTimer;
            this.forcedWeather = state.forcedWeather ?? null;
            this.weatherManager = new WeatherManager(this, state.weatherManager || null);
            this.simulationSpeed = state.simulationSpeed ?? 1;
            this.paused = Boolean(state.paused);
            this.generation = state.generation ?? this.generation;
            this.lineageMemory = normalizeLineageMemory(state.lineageMemory);
            this.colonyKnowledge = {
                ...createKnowledgeLayer(),
                ...(clone(state.colonyKnowledge || {}) || {}),
                failedActions: {
                    ...createKnowledgeLayer().failedActions,
                    ...((state.colonyKnowledge?.failedActions) || {})
                },
                successfulActions: {
                    ...createKnowledgeLayer().successfulActions,
                    ...((state.colonyKnowledge?.successfulActions) || {})
                },
                actionConfidence: {
                    ...createKnowledgeLayer().actionConfidence,
                    ...((state.colonyKnowledge?.actionConfidence) || {})
                }
            };
            this.extinctionSnapshot = clone(state.extinctionSnapshot || null);
            this.nextItemId = state.nextItemId ?? this.nextItemId;
            this.nextProjectId = state.nextProjectId ?? this.nextProjectId;
            this.nextColonistId = state.nextColonistId ?? this.nextColonistId;
            this.nextFamilyId = state.nextFamilyId ?? this.nextFamilyId;
            this.nextResourceId = state.nextResourceId ?? this.nextResourceId;
            this.progress = clone(state.progress || this.progress);
            this.recentLabor = clone(state.recentLabor || this.recentLabor);
            this.projects = clone(state.projects || []);
            this.buildings = clone(state.buildings || []);
            this.normalizePlacedStructureFootprints();
            this.families = clone(state.families || []);
            this.relationshipEvents = clone(state.relationshipEvents || []);
            this.rituals = clone(state.rituals || []);
            this.branchColonies = clone(state.branchColonies || []).map((colony, index) =>
                this.normalizeBranchColony(colony, index)
            );
            this.lastSeasonName = state.lastSeasonName || this.lastSeasonName;
            this.structureRaidCooldown = state.structureRaidCooldown ?? 0;
            this.mainAttackCooldown = state.mainAttackCooldown ?? 30;
            this.weatherDamageCooldown = state.weatherDamageCooldown ?? 0;
            this.lightningStrikeCooldown = state.lightningStrikeCooldown ?? 0;
            this.lastResolvedLightningFlash = state.lastResolvedLightningFlash ?? 0;
            this.usedNames = new Set(state.usedNames || []);
            this.borderIncidents = clone(state.borderIncidents || []);
            this.factionEvents = clone(state.factionEvents || []);
            this.lastRaid = clone(state.lastRaid || null);
            this.factionParties = clone(state.factionParties || []);
            this.factionEffects = clone(state.factionEffects || []);
            this.battlefronts = clone(state.battlefronts || []);
            this.battleBursts = clone(state.battleBursts || []);
            this.battleScars = clone(state.battleScars || []);
            this.battleReports = clone(state.battleReports || []);
            this.reportCounter = state.reportCounter ?? 0;
            this.godMode = clone(state.godMode || this.godMode);
            this.warAftermath = clone(state.warAftermath || this.warAftermath);
            this.achievements = clone(state.achievements || []);
            this.achievementLog = clone(state.achievementLog || []);
            this.phase9 = clone(state.phase9 || this.phase9);
            this.eraHistory = clone(state.eraHistory || []);
            this.lastKnownEra = state.lastKnownEra || this.getCurrentEra();
            this.foodCulture = {
                ...clone(this.foodCulture),
                ...(clone(state.foodCulture || {}) || {}),
                recentSources: {
                    ...clone(this.foodCulture?.recentSources || {}),
                    ...((state.foodCulture?.recentSources) || {})
                }
            };
            this.institutionLife = clone(state.institutionLife || this.institutionLife);
            this.knownInstitutions = clone(state.knownInstitutions || []);
            this.landUse = clone(state.landUse || this.landUse);
            this.camp = clone(state.camp || this.camp);
            this.terrain = clone(state.terrain || null);
            this.resources = clone(state.resources || []);
            this.animals = clone(state.animals || []);
            this.predators = clone(state.predators || []);
            this.thoughts = clone(state.thoughts || []);
            this.events = clone(state.events || []);
            this.colonyMetrics = clone(state.colonyMetrics || {});
            this.colonists = (state.colonists || []).map((colonist) => hydrateColonist(colonist, this.rng));
            this.battleManager = new PhaseOneSim.PhaseOneBattleManager(this);
            if (!this.eraHistory.length) {
                this.eraHistory = [{ era: this.getCurrentEra(), year: this.year, day: this.day, source: 'loaded' }];
            }
            this.restoreSelectedEntity(state.selectedEntityRef || null);
        }

        setSpeed(speed) {
            this.simulationSpeed = speed;
        }

        getSimulationKnob(key) {
            return this.godMode?.simulationKnobs?.[key] || 1;
        }

        adjustSimulationKnob(key, delta) {
            if (!this.godMode?.simulationKnobs || !(key in this.godMode.simulationKnobs)) {
                return 1;
            }
            const next = clamp(this.godMode.simulationKnobs[key] + delta, 0.4, 2.4);
            this.godMode.simulationKnobs[key] = Number(next.toFixed(2));
            this.pushEvent(`God tuned ${key} to ${next.toFixed(2)}.`);
            return this.godMode.simulationKnobs[key];
        }

        placeFactionAtSelection(type = 'daughter') {
            if (this.getActiveBranchColonies().length >= 3) {
                this.pushEvent('No more faction space remains in this valley yet.');
                return null;
            }
            const anchor = this.selectedEntity && this.selectedEntity !== this.camp ? this.selectedEntity : this.camp;
            const x = clamp(anchor.x + 120, CELL_WIDTH * (VALLEY_RING_CELLS + 2), this.width - CELL_WIDTH * (VALLEY_RING_CELLS + 2));
            const y = clamp(anchor.y - 90, CELL_HEIGHT * (VALLEY_RING_CELLS + 2), this.height - CELL_HEIGHT * (VALLEY_RING_CELLS + 2));
            const colony = this.normalizeBranchColony({
                id: this.branchColonies.length + 1,
                type,
                x,
                y,
                population: type === 'daughter' ? 3 : 2,
                founderNames: type === 'daughter' ? this.colonists.slice(0, 2).map((colonist) => colonist.name) : [this.generateUniqueName()],
                inheritedCulture: clone(this.lineageMemory.culturalValues)
            }, this.branchColonies.length);
            this.branchColonies.push(colony);
            this.ensureBranchColonyStarterResources(colony);
            this.recordFactionEvent(`${colony.name} was placed on the frontier by divine intervention, carrying the ${colony.culturalPath} path.`);
            this.evaluateLegacyMilestones();
            return colony;
        }

        setStartingEra(era) {
            const presets = {
                survival: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone'],
                    techs: ['insulation'],
                    settlementKnowledge: {
                        housingTier: 0,
                        storageTier: 0,
                        civicTier: 0,
                        defenseTier: 0,
                        metallurgyHints: 0
                    }
                },
                toolmaking: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone', 'skill:tool_use'],
                    techs: ['insulation', 'toolmaking'],
                    settlementKnowledge: {
                        housingTier: 0,
                        storageTier: 0,
                        civicTier: 0,
                        defenseTier: 0,
                        metallurgyHints: 0
                    }
                },
                agriculture: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone', 'skill:tool_use', 'skill:planting'],
                    techs: ['insulation', 'toolmaking', 'agriculture', 'storagePlanning'],
                    settlementKnowledge: {
                        housingTier: 1,
                        storageTier: 1,
                        civicTier: 0,
                        defenseTier: 0,
                        metallurgyHints: 0
                    }
                },
                masonry: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone', 'skill:tool_use', 'skill:planting', 'skill:medicine'],
                    techs: ['insulation', 'toolmaking', 'agriculture', 'storagePlanning', 'masonry', 'medicineLore'],
                    settlementKnowledge: {
                        housingTier: 2,
                        storageTier: 2,
                        civicTier: 1,
                        defenseTier: 1,
                        metallurgyHints: 0
                    }
                },
                engineering: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone', 'resource:wildAnimal', 'skill:tool_use', 'skill:planting', 'skill:medicine'],
                    techs: ['insulation', 'toolmaking', 'agriculture', 'storagePlanning', 'masonry', 'medicineLore', 'militaryOrganization', 'irrigation', 'engineering'],
                    settlementKnowledge: {
                        housingTier: 2,
                        storageTier: 2,
                        civicTier: 2,
                        defenseTier: 2,
                        metallurgyHints: 0
                    }
                },
                metallurgy: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone', 'resource:wildAnimal', 'skill:tool_use', 'skill:planting', 'skill:medicine'],
                    techs: ['insulation', 'toolmaking', 'agriculture', 'storagePlanning', 'masonry', 'medicineLore', 'militaryOrganization', 'irrigation', 'engineering', 'metallurgy'],
                    settlementKnowledge: {
                        housingTier: 3,
                        storageTier: 2,
                        civicTier: 2,
                        defenseTier: 2,
                        metallurgyHints: 2
                    }
                },
                bronzeAge: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone', 'resource:wildAnimal', 'skill:tool_use', 'skill:planting', 'skill:medicine'],
                    techs: ['insulation', 'toolmaking', 'agriculture', 'storagePlanning', 'masonry', 'medicineLore', 'militaryOrganization', 'irrigation', 'engineering', 'metallurgy', 'bronzeAge'],
                    settlementKnowledge: {
                        housingTier: 3,
                        storageTier: 3,
                        civicTier: 3,
                        defenseTier: 3,
                        metallurgyHints: 3
                    }
                },
                ironAge: {
                    discoveries: ['resource:water', 'resource:berries', 'resource:trees', 'resource:stone', 'resource:wildAnimal', 'skill:tool_use', 'skill:planting', 'skill:medicine'],
                    techs: ['insulation', 'toolmaking', 'agriculture', 'storagePlanning', 'masonry', 'medicineLore', 'militaryOrganization', 'irrigation', 'engineering', 'metallurgy', 'bronzeAge', 'ironAge'],
                    settlementKnowledge: {
                        housingTier: 4,
                        storageTier: 4,
                        civicTier: 4,
                        defenseTier: 4,
                        metallurgyHints: 4
                    }
                }
            };
            const presetDiscoveries = new Set([
                'resource:water',
                'resource:berries',
                'resource:trees',
                'resource:stone',
                'resource:wildAnimal',
                'skill:tool_use',
                'skill:planting',
                'skill:medicine'
            ]);
            const preset = presets[era];
            if (!preset) {
                this.pushEvent('That era cannot be set.');
                return false;
            }
            this.colonyKnowledge.discoveries = this.colonyKnowledge.discoveries.filter((discovery) =>
                !discovery.startsWith('tech:') && !presetDiscoveries.has(discovery)
            );
            this.lineageMemory.discoveries = this.lineageMemory.discoveries.filter((discovery) =>
                !discovery.startsWith('tech:') && !presetDiscoveries.has(discovery)
            );
            for (const discovery of preset.discoveries) {
                if (!this.colonyKnowledge.discoveries.includes(discovery)) {
                    this.colonyKnowledge.discoveries.push(discovery);
                }
                if (!this.lineageMemory.discoveries.includes(discovery)) {
                    this.lineageMemory.discoveries.push(discovery);
                }
            }
            for (const tech of preset.techs) {
                this.unlockTechnology(tech, `God advanced the colony to the ${era} era.`);
            }
            Object.assign(this.lineageMemory.settlementKnowledge, preset.settlementKnowledge);
            this.syncEraProgress('divine');
            this.pushEvent(`Divine setup advanced the colony to the ${era} era.`);
            this.evaluateLegacyMilestones();
            return true;
        }

        hasProtectColonyBubble() {
            return (this.godMode?.protectBubbleTtl || 0) > 0;
        }

        getDivineSuggestionBonus(intent) {
            const focus = this.godMode?.divineSuggestion?.focus;
            const ttl = this.godMode?.divineSuggestion?.ttl || 0;
            if (!focus || ttl <= 0) {
                return 0;
            }
            const mappings = {
                food: { forage: 14, eat: 10, hunt: 12, plant: 8 },
                water: { drink: 16, haulWater: 14 },
                defense: { protect: 20, war: 16, gatherStone: 8, build: 10 },
                build: { build: 16, gatherWood: 10, gatherStone: 10, process: 8, craft: 8 },
                peace: { socialize: 16, tend: 8, rest: 6 },
                expansion: { build: 10, plant: 8, craft: 6, socialize: 4 }
            };
            return mappings[focus]?.[intent] || 0;
        }

        addGodMyth(text) {
            this.godMode.myths.unshift({
                year: this.year,
                day: this.day,
                text
            });
            this.godMode.myths = this.godMode.myths.slice(0, 18);
        }

        applyDivineSuggestion(focus, sourceText) {
            this.godMode.divineSuggestion.focus = focus;
            this.godMode.divineSuggestion.ttl = 54;
            this.godMode.divineSuggestion.source = sourceText;
            this.addGodMyth(sourceText);
            this.pushThought(sourceText);
            this.pushEvent(sourceText);
        }

        togglePause() {
            this.paused = !this.paused;
            this.pushEvent(this.paused ? 'Simulation paused.' : 'Simulation resumed.');
        }

        spawnFoodNearCamp() {
            const node = this.makeResource(this.nextResourceId++, 'berries', this.camp.x + 80, this.camp.y - 40, 24, 'fertile');
            this.resources.push(node);
            this.pushEvent('Fresh berries appeared near camp.');
        }

        spawnWaterSourceNearSelection() {
            const target = this.selectedEntity && this.selectedEntity !== this.camp ? this.selectedEntity : this.camp;
            const x = clamp(target.x + 50, CELL_WIDTH * (VALLEY_RING_CELLS + 1), this.width - CELL_WIDTH * (VALLEY_RING_CELLS + 1));
            const y = clamp(target.y - 40, CELL_HEIGHT * (VALLEY_RING_CELLS + 1), this.height - CELL_HEIGHT * (VALLEY_RING_CELLS + 1));
            const node = this.makeResource(this.nextResourceId++, 'water', x, y, 100, 'water');
            this.resources.push(node);
            this.pushEvent('A fresh water source appeared.');
        }

        blessHarvest() {
            let blessed = 0;
            for (const building of this.buildings) {
                if (building.type !== 'farmPlot' && building.type !== 'engineeredFarm') {
                    continue;
                }
                building.harvestTimer = Math.max(17.5, building.harvestTimer + 18);
                blessed += 1;
            }
            this.camp.food = clamp(this.camp.food + 8 + blessed * 2, 0, 999);
            this.recordFoodSource('farmed', 6 + blessed * 2.4);
            if (this.countBuildings('kitchen') + this.countBuildings('foodHall') > 0) {
                this.recordFoodSource('prepared', 2 + blessed);
            }
            for (const colonist of this.colonists) {
                if (!colonist.alive) continue;
                colonist.stats.morale = clamp(colonist.stats.morale + 6, 0, 100);
            }
            this.pushEvent(blessed > 0 ? 'The harvest was blessed and the fields answered quickly.' : 'A blessing filled the camp stores with food.');
        }

        lightningStrikeSelected() {
            const target = this.selectedEntity;
            if (!target || target === this.camp) {
                this.pushEvent('Select a target for lightning.');
                return false;
            }
            if (target.entityType === 'building') {
                this.applyBuildingDamage(target, 12);
                this.startRepairProject(target);
                this.pushEvent(`Lightning struck the ${target.type}.`);
                return true;
            }
            if (target.entityType === 'colonist') {
                target.lastDamageCause = 'battle';
                target.stats.health = clamp(target.stats.health - 40, 0, 100);
                target.stats.morale = clamp(target.stats.morale - 15, 0, 100);
                if (target.stats.health <= 0) {
                    target.alive = false;
                }
                this.pushEvent(`Lightning struck ${target.name}.`);
                return true;
            }
            if (target.type === 'predator' || target.type === 'wildAnimal') {
                if (target.type === 'wildAnimal') {
                    this.triggerRespawnCooldown(target);
                } else {
                    target.depleted = true;
                }
                this.pushEvent('Lightning struck a creature.');
                return true;
            }
            return false;
        }

        cureDisease() {
            this.phase9.pressure.disease = Math.max(0, this.phase9.pressure.disease - 0.28);
            this.phase9.cooldowns.disease = Math.max(0, this.phase9.cooldowns.disease - 12);
            for (const colonist of this.colonists) {
                if (!colonist.alive) continue;
                colonist.stats.health = clamp(colonist.stats.health + 10, 0, 100);
            }
            this.pushEvent('A divine cure swept sickness from the colony.');
        }

        triggerDiseaseOutbreak() {
            this.phase9.pressure.disease = clamp(this.phase9.pressure.disease + 0.26, 0, 1);
            this.phase9.cooldowns.disease = 18;
            for (const colonist of this.colonists) {
                if (!colonist.alive) continue;
                colonist.stats.health = clamp(colonist.stats.health - 5, 0, 100);
                colonist.stats.morale = clamp(colonist.stats.morale - 4, 0, 100);
            }
            this.pushEvent('A divine plague spread through the settlement.');
        }

        inspireLearning() {
            for (const colonist of this.colonists) {
                if (!colonist.alive) continue;
                colonist.gainSkill('survival', 0.6);
                colonist.gainSkill('crafting', 0.45);
                colonist.gainSkill('building', 0.45);
            }
            this.noteDiscovery('skill:tool_use', 'A divine spark inspired new understanding.');
            this.pushEvent('The colony felt a burst of inspired learning.');
        }

        calmConflict() {
            for (const colonist of this.colonists) {
                if (!colonist.alive) continue;
                colonist.mood.conflict = clamp(colonist.mood.conflict - 1.8, -5, 5);
                colonist.stats.morale = clamp(colonist.stats.morale + 5, 0, 100);
            }
            for (const colony of this.getActiveBranchColonies()) {
                colony.borderFriction = clamp((colony.borderFriction || 0) - 0.1, 0, 1);
                if (colony.diplomacyState === 'rival' && this.rng() < 0.45) {
                    colony.diplomacyState = 'cautious';
                }
            }
            this.pushEvent('A calming presence softened conflict across the valley.');
        }

        inciteWar() {
            const target = this.getActiveBranchColonies().find((colony) => colony.diplomacyState !== 'rival') || this.getActiveBranchColonies()[0];
            if (!target) {
                this.pushEvent('No rival colonies exist to incite.');
                return false;
            }
            target.diplomacyState = 'rival';
            target.borderFriction = clamp((target.borderFriction || 0) + 0.3, 0, 1);
            target.campaign.state = 'active';
            target.campaign.pressure = clamp((target.campaign.pressure || 0) + 0.3, 0.35, 1);
            target.campaign.duration = Math.max(target.campaign.duration || 0, 18);
            target.recentAction = 'incited';
            this.recordFactionEvent(`Divine meddling pushed ${target.name} toward war.`);
            return true;
        }

        spawnPredatorNearCamp() {
            const angle = this.rng() * Math.PI * 2;
            const radius = 120 + this.rng() * 60;
            const x = clamp(this.camp.x + Math.cos(angle) * radius, 36, this.width - 36);
            const y = clamp(this.camp.y + Math.sin(angle) * radius, 36, this.height - 36);
            const predatorId = this.predators.reduce((maxId, predator) => Math.max(maxId, predator.id || 0), 0) + 1;
            this.predators.push(this.makePredator(predatorId, x, y, this.getCellAt(x, y).biome));
            this.pushEvent('A predator was summoned near the settlement.');
        }

        createRelicObjective() {
            const target = this.selectedEntity && this.selectedEntity !== this.camp ? this.selectedEntity : this.camp;
            const relic = {
                id: `relic:${this.elapsed.toFixed(2)}:${this.rng().toFixed(3)}`,
                x: clamp(target.x + 36, 24, this.width - 24),
                y: clamp(target.y + 18, 24, this.height - 24),
                label: 'Relic',
                ttl: 9999
            };
            this.godMode.relics.unshift(relic);
            this.godMode.relics = this.godMode.relics.slice(0, 6);
            this.pushEvent('A strange relic descended into the world.');
        }

        terraformLandAtSelection() {
            const target = this.selectedEntity && this.selectedEntity !== this.camp ? this.selectedEntity : this.camp;
            const cell = this.getCellAt(target.x, target.y);
            if (!cell || cell.biome === 'valley') {
                this.pushEvent('That land resists divine shaping.');
                return false;
            }
            if (cell.biome === 'water') {
                cell.biome = 'fertile';
                cell.terrain.drained = true;
            } else if (cell.biome === 'rocky') {
                cell.biome = 'fertile';
                cell.terrain.quarried = true;
            } else if (cell.biome === 'forest') {
                cell.terrain.cleared = true;
                cell.biome = 'fertile';
            } else {
                cell.biome = 'fertile';
            }
            cell.terrain.irrigation = true;
            this.pushEvent('The land shifted under divine terraforming.');
            return true;
        }

        paintTerrainAtSelection(biome) {
            const target = this.selectedEntity && this.selectedEntity !== this.camp ? this.selectedEntity : this.camp;
            const cell = this.getCellAt(target.x, target.y);
            if (!cell || cell.biome === 'valley' || biome === 'valley') {
                this.pushEvent('That terrain cannot be painted here.');
                return false;
            }
            const nextBiome = ['grassland', 'forest', 'rocky', 'water', 'fertile'].includes(biome) ? biome : 'grassland';
            cell.biome = nextBiome;
            cell.terrain = {
                ...cell.terrain,
                cleared: false,
                irrigation: false,
                terraced: false,
                drained: false,
                fortified: false,
                quarried: false,
                mountain: nextBiome === 'rocky' ? Boolean(cell.terrain.hill || cell.terrain.mountain) : false
            };
            if (nextBiome === 'water') {
                const nearbyWater = this.resources.find((resource) =>
                    resource.type === 'water' && !resource.depleted && distance(resource, { x: target.x, y: target.y }) < 30
                );
                if (!nearbyWater) {
                    this.resources.push(this.makeResource(this.nextResourceId++, 'water', cell.x + CELL_WIDTH * 0.5, cell.y + CELL_HEIGHT * 0.5, 100, 'water'));
                }
            }
            this.pushEvent(`Divine terrain paint turned the land into ${nextBiome}.`);
            return true;
        }

        protectColonyBubble() {
            this.godMode.protectBubbleTtl = Math.max(this.godMode.protectBubbleTtl, 42);
            this.addGodMyth('A shimmering shield was remembered as divine protection.');
            this.pushEvent('A protective bubble settled over the colony.');
        }

        killSelectedUnit() {
            const target = this.selectedEntity;
            if (!target || target === this.camp) {
                this.pushEvent('Select a unit to kill.');
                return false;
            }
            if (target.entityType === 'colonist') {
                target.lastDamageCause = 'battle';
                target.stats.health = 0;
                target.alive = false;
                this.pushEvent(`${target.name} was struck down by divine force.`);
                return true;
            }
            if (target.type === 'predator' || target.type === 'wildAnimal') {
                if (target.type === 'wildAnimal') {
                    this.triggerRespawnCooldown(target);
                } else {
                    target.depleted = true;
                }
                this.pushEvent('A creature was struck down by divine force.');
                return true;
            }
            return false;
        }

        sendOmenOfPlenty() {
            this.lineageMemory.culturalValues.shareFood = clamp(this.lineageMemory.culturalValues.shareFood + 0.04, -1, 1);
            this.applyDivineSuggestion('food', 'The colony dreamed of overflowing stores and easy harvests.');
        }

        sendOmenOfWater() {
            this.lineageMemory.culturalValues.worshipNature = clamp(this.lineageMemory.culturalValues.worshipNature + 0.04, -1, 1);
            this.applyDivineSuggestion('water', 'The colony dreamed of hidden springs and blessed rain.');
        }

        sendWarOmen() {
            this.lineageMemory.culturalValues.avoidStrangers = clamp(this.lineageMemory.culturalValues.avoidStrangers + 0.05, -1, 1);
            this.applyDivineSuggestion('defense', 'A harsh omen warned the colony to fortify and stand ready for war.');
        }

        sendBuildersSign() {
            this.lineageMemory.culturalValues.favorExpansion = clamp(this.lineageMemory.culturalValues.favorExpansion + 0.05, -1, 1);
            this.applyDivineSuggestion('build', 'A sacred sign urged the colony to raise stronger works.');
        }

        sendPeaceOmen() {
            this.lineageMemory.culturalValues.shareFood = clamp(this.lineageMemory.culturalValues.shareFood + 0.03, -1, 1);
            this.lineageMemory.culturalValues.avoidStrangers = clamp(this.lineageMemory.culturalValues.avoidStrangers - 0.03, -1, 1);
            this.applyDivineSuggestion('peace', 'A gentle omen urged reconciliation, rest, and kinship.');
        }

        sendExpansionOmen() {
            this.lineageMemory.culturalValues.favorExpansion = clamp(this.lineageMemory.culturalValues.favorExpansion + 0.06, -1, 1);
            this.applyDivineSuggestion('expansion', 'The colony dreamed of roads, daughters, and land beyond the camp.');
        }

        addColonist() {
            const colonist = new Colonist(
                this.nextColonistId++,
                this.camp.x + this.rng() * 18,
                this.camp.y + this.rng() * 18,
                this.generateUniqueName(),
                this.rng
            );
            this.colonists.push(colonist);
            this.pushEvent(`${colonist.name} joined the colony.`);
        }

        sendAidToSelectedDaughterColony() {
            const target = this.selectedEntity;
            if (!target || target.entityType !== 'colony' || target.type !== 'daughter') {
                this.pushEvent('Select a daughter colony to send aid.');
                return false;
            }
            const food = Math.min(5, Math.max(0, this.camp.food - 12));
            const water = Math.min(4, Math.max(0, this.camp.water - 10));
            const wood = Math.min(3, Math.max(0, this.camp.wood - 10));
            if (food <= 0 && water <= 0 && wood <= 0) {
                this.pushEvent('The main colony lacks spare supplies to send.');
                return false;
            }
            this.camp.food = Math.max(0, this.camp.food - food);
            this.camp.water = Math.max(0, this.camp.water - water);
            this.camp.wood = Math.max(0, this.camp.wood - wood);
            this.spawnFactionParty(target, 'aid', 'fromCamp', {
                target,
                targetKind: 'colony',
                targetColonyId: target.id,
                supportMode: 'main aid',
                status: 'supply caravan',
                effectLabel: 'Aid',
                strength: 1.6,
                supplies: { food, water, wood }
            });
            target.supportCooldown = this.getColonySupportCooldownDuration(target, 20, 62);
            target.recentAction = 'receiving aid';
            this.pushEvent(`The main colony sent aid toward ${target.name}.`);
            return true;
        }

        healSelectedUnit() {
            const target = this.selectedEntity;
            if (target?.entityType === 'colonist') {
                target.stats.health = clamp(target.stats.health + 28, 0, 100);
                target.stats.morale = clamp(target.stats.morale + 10, 0, 100);
                target.stats.energy = clamp(target.stats.energy + 12, 0, 100);
                target.woundSeverity = clamp((target.woundSeverity || 0) - 0.22, 0, 1);
                target.woundCount = Math.max(0, (target.woundCount || 0) - 1);
                this.pushEvent(`${target.name} was restored by divine healing.`);
                return true;
            }
            if (target?.entityType === 'building') {
                target.integrity = Math.min(target.maxIntegrity || target.integrity || 1, (target.integrity || 0) + Math.max(1.5, (target.maxIntegrity || 0) * 0.18));
                this.pushEvent(`The ${target.type} was mended by divine healing.`);
                return true;
            }
            for (const colonist of this.colonists) {
                if (!colonist.alive) {
                    continue;
                }
                colonist.stats.health = clamp(colonist.stats.health + 8, 0, 100);
            }
            this.pushEvent('A divine healing wave passed through the colony.');
            return true;
        }

        instillFearKnowledgeOnSelectedColonist() {
            const colonist = this.selectedEntity;
            if (!colonist || colonist.type || colonist === this.camp || !colonist.alive) {
                this.pushEvent('Select a living colonist to instill fear knowledge.');
                return false;
            }

            colonist.lastDamageCause = 'predatorAttack';
            colonist.stats.health = 0;
            colonist.alive = false;
            colonist.intent = 'flee';
            colonist.state = 'fallen';
            colonist.fearKnowledgeInjected = true;

            this.rememberDanger(colonist, colonist, 'predatorAttack');
            for (const witness of this.colonists) {
                if (witness === colonist || !witness.alive) {
                    continue;
                }
                if (distance(witness, colonist) < 180) {
                    this.rememberDanger(colonist, witness, 'predatorAttack');
                    witness.stats.morale = clamp(witness.stats.morale - 12, 0, 100);
                    witness.stats.energy = clamp(witness.stats.energy - 4, 0, 100);
                    witness.decisionCooldown = 0;
                }
            }

            this.lineageMemory.deathCauses.predatorAttack += 1;
            const lesson = 'Predators force distance, fear, and retreat.';
            if (!this.lineageMemory.lessons.includes(lesson)) {
                this.lineageMemory.lessons.unshift(lesson);
                this.lineageMemory.lessons = this.lineageMemory.lessons.slice(0, 6);
            }
            this.pushThought(`${colonist.name}'s death taught the colony to fear predators.`);
            this.pushEvent(`${colonist.name} was sacrificed to instill fear knowledge.`);
            this.selectedEntity = null;
            return true;
        }

        applyWeather(name) {
            const match = WEATHER_TYPE_LOOKUP[name.toLowerCase()];
            if (!match) {
                return;
            }
            this.forcedWeather = match;
            this.weatherTimer = this.weatherDuration;
            this.weatherManager.syncToCurrent(false);
            this.pushEvent(`Weather forced to ${match.name}.`);
        }

        clearForcedWeather() {
            this.forcedWeather = null;
            this.weatherManager.syncToCurrent(false);
            this.pushEvent('Weather returned to seasonal drift.');
        }

        selectAt(x, y) {
            const colonist = this.colonists.find((entry) => distance(entry, { x, y }) < 16);
            if (colonist) {
                this.selectedEntity = colonist;
                return colonist;
            }
            const project = this.projects.find((entry) => distance(entry, { x, y }) < 20);
            if (project) {
                this.selectedEntity = project;
                return project;
            }
            const building = this.buildings.find((entry) => distance(entry, { x, y }) < 22);
            if (building) {
                this.selectedEntity = building;
                return building;
            }
            const animal = this.animals.find((entry) => !entry.depleted && distance(entry, { x, y }) < 18);
            if (animal) {
                this.selectedEntity = animal;
                return animal;
            }
            const resource = this.resources.find((entry) => !entry.depleted && distance(entry, { x, y }) < 16);
            if (resource) {
                this.selectedEntity = resource;
                return resource;
            }
            const colony = this.branchColonies.find((entry) => distance(entry, { x, y }) < 28);
            if (colony) {
                this.selectedEntity = colony;
                return colony;
            }
            if (distance(this.camp, { x, y }) < 28) {
                this.selectedEntity = this.camp;
                return this.camp;
            }
            this.selectedEntity = null;
            return null;
        }

        getAverages() {
            if (!this.colonists.length) {
                return { hunger: 0, thirst: 0, warmth: 0, energy: 0, morale: 0, health: 0 };
            }
            const totals = { hunger: 0, thirst: 0, warmth: 0, energy: 0, morale: 0, health: 0 };
            for (const colonist of this.colonists) {
                Object.keys(totals).forEach((key) => {
                    totals[key] += colonist.stats[key];
                });
            }
            Object.keys(totals).forEach((key) => {
                totals[key] /= this.colonists.length;
            });
            return totals;
        }

        getSummaryText() {
            const averages = this.getAverages();
            const temperature = this.getTemperatureAt(this.camp.x, this.camp.y);
            const weatherState = this.getWeatherState();
            const taskAllocation = { farmers: 0, builders: 0, gatherers: 0, hunters: 0, crafters: 0 };
            for (const colonist of this.colonists) {
                const role = this.getSoftRole(colonist);
                if (role === 'farmer') taskAllocation.farmers += 1;
                if (role === 'builder') taskAllocation.builders += 1;
                if (role === 'gatherer') taskAllocation.gatherers += 1;
                if (role === 'hunter') taskAllocation.hunters += 1;
                if (role === 'crafter') taskAllocation.crafters += 1;
            }
            const laborHistory = {
                farmers: Number(this.recentLabor.farmer.toFixed(1)),
                builders: Number(this.recentLabor.builder.toFixed(1)),
                gatherers: Number(this.recentLabor.gatherer.toFixed(1)),
                hunters: Number(this.recentLabor.hunter.toFixed(1)),
                crafters: Number(this.recentLabor.crafter.toFixed(1))
            };
            const foodCulture = this.getFoodCultureSummary();
            const weakest = this.colonists
                .slice()
                .sort((a, b) => Math.min(a.stats.hunger, a.stats.thirst, a.stats.warmth, a.stats.energy) - Math.min(b.stats.hunger, b.stats.thirst, b.stats.warmth, b.stats.energy))[0];

            return JSON.stringify({
                coordinateSystem: 'origin top-left, +x right, +y down',
                phase: 10,
                generation: this.generation,
                year: this.year,
                day: this.day,
                season: this.getSeason().name,
                weather: this.getWeather().name,
                weatherState: {
                    intensity: Number(weatherState.intensity.toFixed(2)),
                    windX: Number(weatherState.windX.toFixed(2)),
                    windY: Number(weatherState.windY.toFixed(2)),
                    gustStrength: Number((weatherState.gustStrength || 0).toFixed(2)),
                    darkness: Number(weatherState.darkness.toFixed(2)),
                    fogDensity: Number(weatherState.fogDensity.toFixed(2)),
                    transition: Number(weatherState.transition.toFixed(2)),
                    visibility: Number(weatherState.visibility.toFixed(2)),
                    movementPenalty: Number(weatherState.movementPenalty.toFixed(2)),
                    stealthBonus: Number(weatherState.stealthBonus.toFixed(2)),
                    lightningRisk: Number(weatherState.lightningRisk.toFixed(2)),
                    surfaceWetness: Number(weatherState.surfaceWetness.toFixed(2)),
                    puddleLevel: Number(weatherState.puddleLevel.toFixed(2)),
                    snowCover: Number(weatherState.snowCover.toFixed(2)),
                    lightningFlash: Number(weatherState.lightningFlash.toFixed(2)),
                    ambientProfile: weatherState.ambientProfile
                },
                lightLevel: Number(this.getLightLevel().toFixed(2)),
                temperatureAtCamp: Number(temperature.toFixed(1)),
                population: this.colonists.length,
                camp: {
                    x: Math.round(this.camp.x),
                    y: Math.round(this.camp.y),
                    food: Number(this.camp.food.toFixed(1)),
                    water: Number(this.camp.water.toFixed(1)),
                    wood: Number(this.camp.wood.toFixed(1)),
                    stone: Number(this.camp.stone.toFixed(1)),
                    shelter: Number(this.camp.shelter.toFixed(1)),
                    fireFuel: Number(this.camp.fireFuel.toFixed(1)),
                    materials: Object.fromEntries(
                        Object.entries(this.camp.materials).map(([key, value]) => [key, Number(value.toFixed(1))])
                    ),
                    itemCounts: Object.fromEntries(
                        Object.keys(ITEM_DEFS).map((key) => [key, this.countCampItems(key)])
                    ),
                    structures: clone(this.camp.structures),
                    housingCapacity: this.getBuildingCapacity(),
                    housingSatisfaction: Number(this.getHousingSatisfaction().toFixed(2)),
                    storageCapacity: Number(this.getStorageCapacity().toFixed(1))
                },
                settlement: {
                    foodCulture,
                    buildings: this.buildings.map((building) => ({
                        type: building.type,
                        x: Math.round(building.x),
                        y: Math.round(building.y),
                        integrity: Number(((building.integrity || building.maxIntegrity || 1) / Math.max(1, building.maxIntegrity || 1)).toFixed(2))
                    })),
                    projects: this.projects.map((project) => ({
                        type: project.type,
                        x: Math.round(project.x),
                        y: Math.round(project.y),
                        targetBuildingType: project.targetBuildingType || null,
                        delivered: clone(project.delivered),
                        buildProgress: Number(project.buildProgress.toFixed(1)),
                        buildTime: Number(project.buildTime.toFixed(1))
                    })),
                    taskAllocation,
                    laborHistory,
                    families: this.families.map((family) => ({
                        id: family.id,
                        members: family.memberIds.length,
                        adults: family.adultIds.length,
                        children: family.childIds.length,
                        homeBuildingId: family.homeBuildingId,
                        birthCooldown: Number(family.birthCooldown.toFixed(1))
                    })),
                    defensePlanning: {
                        camp: this.getCampDefenseSummary(),
                        regionalConflictPressure: Number(this.getRegionalConflictPressure().toFixed(2)),
                        borderIncidents: this.borderIncidents.slice(0, 5),
                        lastRaid: clone(this.lastRaid)
                    },
                    visibleFactionParties: this.factionParties.slice(0, 12).map((party) => ({
                        colonyName: party.colonyName,
                        type: party.type,
                        direction: party.direction,
                        status: party.status,
                        x: Math.round(party.x),
                        y: Math.round(party.y),
                        progress: Number(party.progress.toFixed(2)),
                        strength: Number(party.strength.toFixed(1))
                    })),
                    visibleFactionEffects: this.factionEffects.slice(0, 12).map((effect) => ({
                        type: effect.type,
                        label: effect.label,
                        targetKind: effect.targetKind,
                        x: Math.round(effect.x),
                        y: Math.round(effect.y),
                        ttl: Number(effect.ttl.toFixed(2))
                    })),
                    activeBattles: this.battlefronts.slice(0, 8).map((front) => ({
                        colonyName: front.colonyName,
                        defenderColonyName: front.defenderColonyName || null,
                        mode: front.mode,
                        x: Math.round(front.x),
                        y: Math.round(front.y),
                        attackerHealth: Number(front.attackerHealth.toFixed(1)),
                        attackerMaxHealth: Number(front.attackerMaxHealth.toFixed(1)),
                        defenderHealth: Number(front.defenderHealth.toFixed(1)),
                        defenderMaxHealth: Number(front.defenderMaxHealth.toFixed(1)),
                        scale: Number(front.scale.toFixed(2)),
                        outcome: front.outcome,
                        ttl: Number(front.ttl.toFixed(2))
                    })),
                    recentBattleReports: this.battleReports.slice(0, 8),
                    warAftermath: {
                        occupation: clone(this.warAftermath.occupation),
                        recent: this.warAftermath.recent.slice(0, 8)
                    },
                    otherColonies: this.getActiveBranchColonies().map((colony) => ({
                        id: colony.id,
                        name: colony.name,
                        type: colony.type,
                        x: Math.round(colony.x),
                        y: Math.round(colony.y),
                        population: Number(colony.population.toFixed(1)),
                        territoryRadius: Math.round(this.getBranchTerritoryRadius(colony)),
                        food: Number((colony.food || 0).toFixed(1)),
                        water: Number((colony.water || 0).toFixed(1)),
                        culturalPath: colony.culturalPath || null,
                        ancientCustom: colony.ancientCustom || null,
                        modernizationStyle: colony.modernizationStyle || null,
                        continuityScore: Number(((colony.continuityScore) || 0).toFixed(2)),
                        diplomacyState: colony.diplomacyState,
                        diplomacyMethod: this.getEraDiplomacyMethod(colony.diplomacyState),
                        borderFriction: Number((colony.borderFriction || 0).toFixed(2)),
                        recentAction: colony.recentAction || 'watching',
                        factionIdentity: Object.fromEntries(
                            Object.entries(colony.factionIdentity || {}).map(([key, value]) => [
                                key,
                                typeof value === 'number' ? Number(value.toFixed(2)) : value
                            ])
                        ),
                        campaign: {
                            state: colony.campaign?.state || 'idle',
                            pressure: Number(((colony.campaign?.pressure) || 0).toFixed(2)),
                            duration: Number(((colony.campaign?.duration) || 0).toFixed(1)),
                            target: colony.campaign?.target || 'camp',
                            strategy: colony.campaign?.strategy || 'watchful',
                            warfareMethod: this.getEraWarfareMethod(colony.campaign?.strategy || 'watchful')
                        },
                        warMemory: {
                            defeats: colony.warMemory?.defeats || 0,
                            victories: colony.warMemory?.victories || 0,
                            desireForRevenge: Number(((colony.warMemory?.desireForRevenge) || 0).toFixed(2)),
                            lastEnemy: colony.warMemory?.lastEnemy || null,
                            lastOutcome: colony.warMemory?.lastOutcome || 'none'
                        },
                        occupation: {
                            state: colony.occupation?.state || 'free',
                            ttl: Number(((colony.occupation?.ttl) || 0).toFixed(1)),
                            claimedTarget: colony.occupation?.claimedTarget || null,
                            by: colony.occupation?.by || null
                        },
                        army: {
                            available: Number(((colony.army?.available) || 0).toFixed(2)),
                            wounded: Number(((colony.army?.wounded) || 0).toFixed(2)),
                            veterans: Number(((colony.army?.veterans) || 0).toFixed(2)),
                            morale: Number(((colony.army?.morale) || 0).toFixed(2)),
                            recovery: Number(((colony.army?.recovery) || 0).toFixed(1)),
                            commander: colony.army?.commander?.name || null
                        },
                        defense: clone(colony.defense),
                        history: clone(colony.history)
                    })),
                    landUse: clone(this.landUse),
                    institutions: {
                        life: Object.fromEntries(
                            Object.entries(this.institutionLife || {}).map(([key, value]) => [key, Number(value.toFixed(2))])
                        ),
                        sites: (this.landUse.institutionSites || []).map((site) => ({
                            type: site.type,
                            x: Math.round(site.x),
                            y: Math.round(site.y),
                            influence: Number(site.influence.toFixed(2))
                        }))
                    },
                    foodStockpilePressure: Number(this.getStockpilePressure().toFixed(1))
                },
                culture: {
                    values: clone(this.lineageMemory.culturalValues),
                    continuity: this.getCultureLegacyProfile(),
                    rituals: this.rituals.slice(0, 8),
                    branchColonies: clone(this.branchColonies)
                },
                technology: {
                    era: this.getCurrentEra(),
                    bands: this.getCurrentTechBands(),
                    unlocked: Object.keys(TECH_DEFS).filter((key) => this.hasTechnology(key)),
                    dependencyHints: {
                        agriculture: ['planting', 'stable food'],
                        masonry: ['stone work', 'shelter strain'],
                        medicineLore: ['injury care', 'skilled healers'],
                        militaryOrganization: ['predator pressure', 'combat experience'],
                        irrigation: ['poor soil', 'water hauling', 'farm stability'],
                        engineering: ['material processing', 'stable workshops'],
                        metallurgy: ['masonry', 'engineering', 'heavy stone work']
                    },
                    breakthroughs: Object.keys(TECH_DEFS)
                        .filter((key) => this.hasTechnology(key) && TECH_DEFS[key].breakthrough)
                        .map((key) => TECH_DEFS[key].label)
                },
                phase9: {
                    milestones: clone(this.phase9.milestones),
                    terraforming: clone(this.phase9.terraforming),
                    terrainFeatures: this.getTerrainFeatureCounts(),
                    ecology: Object.fromEntries(
                        Object.entries(this.phase9.ecology).map(([key, value]) => [key, Number(value.toFixed(2))])
                    ),
                    pressure: Object.fromEntries(
                        Object.entries(this.phase9.pressure).map(([key, value]) => [key, Number(value.toFixed(2))])
                    )
                },
                godMode: {
                    protectBubbleTtl: Number((this.godMode.protectBubbleTtl || 0).toFixed(1)),
                    simulationKnobs: clone(this.godMode.simulationKnobs),
                    divineSuggestion: {
                        focus: this.godMode.divineSuggestion?.focus || null,
                        ttl: Number(((this.godMode.divineSuggestion?.ttl) || 0).toFixed(1)),
                        source: this.godMode.divineSuggestion?.source || null
                    },
                    relics: (this.godMode.relics || []).slice(0, 6).map((relic) => ({
                        id: relic.id,
                        x: Math.round(relic.x),
                        y: Math.round(relic.y),
                        label: relic.label
                    })),
                    myths: (this.godMode.myths || []).slice(0, 8)
                },
                milestones: {
                    unlocked: this.achievements.slice(0, 24).map((key) => ({
                        key,
                        label: LEGACY_MILESTONE_DEFS[key]?.label || key
                    })),
                    recent: this.achievementLog.slice(0, 8)
                },
                averages: Object.fromEntries(Object.entries(averages).map(([key, value]) => [key, Number(value.toFixed(1))])),
                lineage: {
                    lessons: this.lineageMemory.lessons.slice(0, 4),
                    knownResourceCounts: Object.fromEntries(
                        Object.entries(this.lineageMemory.knownResources).map(([key, entries]) => [key, entries.length])
                    ),
                    dangerZones: this.lineageMemory.dangerZones.length,
                    shelterSpots: this.lineageMemory.shelterSpots.length,
                    discoveries: this.lineageMemory.discoveries.slice(0, 6),
                    achievements: this.lineageMemory.achievements.slice(0, 16),
                    deathCauses: clone(this.lineageMemory.deathCauses),
                    traitAverages: clone(this.lineageMemory.traitAverages),
                    branchColonies: this.branchColonies.length
                },
                colonyKnowledge: {
                    knownResourceCounts: Object.fromEntries(
                        Object.entries(this.colonyKnowledge.resources).map(([key, entries]) => [key, entries.length])
                    ),
                    dangerZones: this.colonyKnowledge.dangerZones.length,
                    shelterSpots: this.colonyKnowledge.shelterSpots.length,
                    discoveries: this.colonyKnowledge.discoveries.slice(0, 6),
                    factionEvents: this.factionEvents.slice(0, 8),
                    statements: this.getKnowledgeStatements(),
                    knownRecipes: Object.keys(RECIPE_DEFS).filter((key) => RECIPE_DEFS[key].unlocks(this)),
                    pursuableRecipes: Object.keys(RECIPE_DEFS).filter((key) =>
                        RECIPE_DEFS[key].unlocks(this) &&
                        this.colonists.some((colonist) => colonist.alive && this.canPursueRecipe(key, colonist))
                    )
                },
                weakestColonist: weakest ? {
                    name: weakest.name,
                    x: Math.round(weakest.x),
                    y: Math.round(weakest.y),
                    intent: weakest.intent,
                    need: weakest.lastNeed,
                    state: weakest.state,
                    hunger: Number(weakest.stats.hunger.toFixed(1)),
                    thirst: Number(weakest.stats.thirst.toFixed(1)),
                    warmth: Number(weakest.stats.warmth.toFixed(1)),
                    energy: Number(weakest.stats.energy.toFixed(1)),
                    health: Number(weakest.stats.health.toFixed(1)),
                    rememberedFood: (weakest.memory.resources.berries.length + weakest.memory.resources.wildAnimal.length),
                    dangerMemory: weakest.memory.dangerZones.length,
                    equipment: Object.fromEntries(
                        Object.entries(weakest.equipment).map(([slot, item]) => [slot, item ? `${item.type}:${item.tier}:${item.durability}` : null])
                    )
                } : null,
                visibleResources: this.resources
                    .filter((resource) => !resource.depleted)
                    .slice(0, 10)
                    .map((resource) => ({
                        type: resource.type,
                        x: Math.round(resource.x),
                        y: Math.round(resource.y),
                        amount: Number(resource.amount.toFixed(1))
                    })),
                animals: this.animals
                    .filter((animal) => !animal.depleted)
                    .slice(0, 6)
                    .map((animal) => ({
                        x: Math.round(animal.x),
                        y: Math.round(animal.y)
                    })),
                predators: this.predators.slice(0, 6).map((predator) => ({
                    x: Math.round(predator.x),
                    y: Math.round(predator.y)
                })),
                colonists: this.colonists.slice(0, 12).map((colonist) => ({
                    name: colonist.name,
                    x: Math.round(colonist.x),
                    y: Math.round(colonist.y),
                    intent: colonist.intent,
                    need: colonist.lastNeed,
                    decisionScores: (colonist.lastDecisionScores || []).slice(0, 5),
                    state: colonist.state,
                    underThreat: Boolean(colonist.threat),
                    wartime: this.shouldColonistJoinBattle(colonist),
                    carrying: colonist.carrying?.type ? { type: colonist.carrying.type, amount: Number(colonist.carrying.amount.toFixed(1)) } : null,
                    equipment: Object.fromEntries(
                        Object.entries(colonist.equipment).map(([slot, item]) => [slot, item ? `${item.type}:${item.tier}:${item.durability}` : null])
                    ),
                    inventory: {
                        materials: Object.fromEntries(
                            Object.entries(colonist.inventory.materials).map(([key, value]) => [key, Number(value.toFixed(1))])
                        ),
                        items: colonist.inventory.items.map((item) => `${item.type}:${item.tier}:${item.durability}`)
                    },
                    skills: Object.fromEntries(Object.entries(colonist.skills).map(([key, value]) => [key, Number(value.toFixed(1))])),
                    role: this.getSoftRole(colonist),
                    ageYears: Number(colonist.ageYears.toFixed(1)),
                    lifeStage: colonist.lifeStage,
                    familyId: colonist.familyId,
                    partnerId: colonist.partnerId,
                    traits: Object.fromEntries(Object.entries(colonist.traits).map(([key, value]) => [key, Number(value.toFixed(2))])),
                    relationships: {
                        family: Object.keys(colonist.relationships.family).length,
                        friends: Object.keys(colonist.relationships.friends).length,
                        rivals: Object.keys(colonist.relationships.rivals).length,
                        mentorStudent: Object.keys(colonist.relationships.mentorStudent).length
                    },
                    mood: Object.fromEntries(Object.entries(colonist.mood).map(([key, value]) => [key, Number(value.toFixed(2))])),
                    emotionalMemory: {
                        battleTrauma: Number(((colonist.emotionalMemory?.battleTrauma) || 0).toFixed(2)),
                        griefLoad: Number(((colonist.emotionalMemory?.griefLoad) || 0).toFixed(2)),
                        mourningTtl: Number(((colonist.emotionalMemory?.mourningTtl) || 0).toFixed(1)),
                        lastLossName: colonist.emotionalMemory?.lastLossName || null,
                        lastLossCause: colonist.emotionalMemory?.lastLossCause || null
                    },
                    memory: {
                        resources: Object.fromEntries(
                            Object.entries(colonist.memory.resources).map(([key, entries]) => [key, entries.length])
                        ),
                        dangerZones: colonist.memory.dangerZones.length,
                        shelterSpots: colonist.memory.shelterSpots.length,
                        failedActions: clone(colonist.memory.failedActions)
                    },
                    hunger: Number(colonist.stats.hunger.toFixed(1)),
                    thirst: Number(colonist.stats.thirst.toFixed(1)),
                    warmth: Number(colonist.stats.warmth.toFixed(1)),
                    energy: Number(colonist.stats.energy.toFixed(1)),
                    health: Number(colonist.stats.health.toFixed(1))
                }))
            });
        }
    }

    PhaseOneWorld.fromSaveState = function fromSaveState(saveState) {
        const inherited = saveState?.world?.lineageMemory || null;
        const seed = saveState?.world?.seed || 1337;
        const world = new PhaseOneWorld(seed, inherited);
        world.applySaveState(saveState);
        return world;
    };

    PhaseOneSim.constants = {
        WORLD_WIDTH,
        WORLD_HEIGHT,
        GRID_COLS,
        GRID_ROWS,
        CELL_WIDTH,
        CELL_HEIGHT,
        BIOME_COLORS
    };
    PhaseOneSim.clamp = clamp;
    PhaseOneSim.distance = distance;
    PhaseOneSim.PhaseOneWorld = PhaseOneWorld;
})();
