(function () {
    const PhaseOneSim = window.PhaseOneSim || (window.PhaseOneSim = {});
    const { WORLD_WIDTH, WORLD_HEIGHT, CELL_WIDTH, CELL_HEIGHT, BIOME_COLORS } = PhaseOneSim.constants;
    const { clamp, distance } = PhaseOneSim;
    const COLONIST_SPRITE_CONFIG = {
        src: 'character-spritesheet.png',
        frameWidth: 64,
        frameHeight: 64,
        emoteFrameCount: 7,
        walkFrameCount: 9,
        gatherFrameCount: 6,
        fightFrameCount: 6,
        jumpFrameCount: 5,
        idleStandFrameCount: 2,
        idleStyleCount: 2,
        drawWidth: 28,
        drawHeight: 28,
        rows: {
            emote: {
                up: 0,
                left: 1,
                down: 2,
                right: 3
            },
            walk: {
                up: 8,
                left: 9,
                down: 10,
                right: 11
            },
            idle: {
                up: 30,
                left: 31,
                down: 32,
                right: 33
            },
            idleStand: {
                up: 22,
                left: 23,
                down: 24,
                right: 25
            },
            jump: {
                up: 26,
                left: 27,
                down: 28,
                right: 29
            },
            gather: {
                up: 12,
                left: 13,
                down: 14,
                right: 15
            },
            fight: {
                up: 50,
                left: 51,
                down: 52,
                right: 53
            }
        }
    };

    class PhaseOneRenderer {
        constructor(canvas, world) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.world = world;
            this.baseScale = 1;
            this.zoom = 1.7;
            this.minZoom = 1;
            this.maxZoom = 2.8;
            this.cameraX = world.camp.x;
            this.cameraY = world.camp.y;
            this.colonistSprite = null;
            this.colonistSpriteReady = false;
            this.colonistSpriteState = new Map();
            this.loadColonistSprite();
            this.resize();
        }

        loadColonistSprite() {
            const sprite = new Image();
            sprite.onload = () => {
                this.colonistSprite = sprite;
                this.colonistSpriteReady = true;
                this.render();
            };
            sprite.onerror = () => {
                this.colonistSprite = null;
                this.colonistSpriteReady = false;
            };
            sprite.src = COLONIST_SPRITE_CONFIG.src;
        }

        resize() {
            const ratio = window.devicePixelRatio || 1;
            const width = this.canvas.clientWidth;
            const height = this.canvas.clientHeight;
            this.canvas.width = Math.max(1, Math.floor(width * ratio));
            this.canvas.height = Math.max(1, Math.floor(height * ratio));
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(ratio, ratio);
            this.viewportWidth = width;
            this.viewportHeight = height;
            this.baseScale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
            this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
            this.clampCamera();
        }

        screenToWorld(screenX, screenY) {
            const scale = this.getScale();
            const halfWidth = this.viewportWidth / scale / 2;
            const halfHeight = this.viewportHeight / scale / 2;
            return {
                x: this.cameraX - halfWidth + screenX / scale,
                y: this.cameraY - halfHeight + screenY / scale
            };
        }

        getScale() {
            return this.baseScale * this.zoom;
        }

        getZoomOutFactor() {
            return clamp((this.maxZoom - this.zoom) / Math.max(0.001, this.maxZoom - this.minZoom), 0, 1);
        }

        getViewBounds() {
            const scale = this.getScale();
            const halfWidth = this.viewportWidth / scale / 2;
            const halfHeight = this.viewportHeight / scale / 2;
            return {
                left: this.cameraX - halfWidth,
                right: this.cameraX + halfWidth,
                top: this.cameraY - halfHeight,
                bottom: this.cameraY + halfHeight,
                width: halfWidth * 2,
                height: halfHeight * 2
            };
        }

        getEraArtDirection() {
            const era = this.world.getCurrentEra ? this.world.getCurrentEra() : 'survival';
            const directions = {
                survival: {
                    sky: 'rgba(214, 182, 126, 0.08)',
                    ground: 'rgba(84, 66, 34, 0.05)',
                    accent: 'rgba(240, 209, 141, 0.12)',
                    lane: 'rgba(120, 90, 48, 0.1)',
                    banner: '#c8ad79',
                    civic: '#7d6034'
                },
                toolmaking: {
                    sky: 'rgba(212, 176, 118, 0.09)',
                    ground: 'rgba(89, 67, 38, 0.055)',
                    accent: 'rgba(235, 200, 132, 0.12)',
                    lane: 'rgba(124, 92, 52, 0.11)',
                    banner: '#d0b07a',
                    civic: '#86663b'
                },
                agriculture: {
                    sky: 'rgba(219, 196, 122, 0.08)',
                    ground: 'rgba(68, 89, 34, 0.06)',
                    accent: 'rgba(228, 215, 124, 0.11)',
                    lane: 'rgba(126, 108, 56, 0.11)',
                    banner: '#d8bf76',
                    civic: '#8c7337'
                },
                masonry: {
                    sky: 'rgba(210, 202, 184, 0.09)',
                    ground: 'rgba(82, 77, 70, 0.065)',
                    accent: 'rgba(228, 220, 206, 0.12)',
                    lane: 'rgba(132, 124, 112, 0.12)',
                    banner: '#ddd2c0',
                    civic: '#8d857e'
                },
                engineering: {
                    sky: 'rgba(198, 208, 219, 0.1)',
                    ground: 'rgba(70, 85, 72, 0.07)',
                    accent: 'rgba(219, 228, 235, 0.12)',
                    lane: 'rgba(152, 160, 168, 0.13)',
                    banner: '#d7dde3',
                    civic: '#7f8e98'
                },
                metallurgy: {
                    sky: 'rgba(191, 199, 214, 0.12)',
                    ground: 'rgba(68, 78, 74, 0.08)',
                    accent: 'rgba(221, 228, 234, 0.12)',
                    lane: 'rgba(162, 170, 178, 0.14)',
                    banner: '#e1e6ea',
                    civic: '#86939d'
                },
                'bronze age': {
                    sky: 'rgba(214, 188, 132, 0.13)',
                    ground: 'rgba(92, 82, 52, 0.08)',
                    accent: 'rgba(231, 207, 146, 0.14)',
                    lane: 'rgba(162, 128, 74, 0.15)',
                    banner: '#e0c17d',
                    civic: '#9b7a42'
                },
                'iron age': {
                    sky: 'rgba(185, 190, 196, 0.14)',
                    ground: 'rgba(71, 76, 70, 0.09)',
                    accent: 'rgba(205, 209, 213, 0.14)',
                    lane: 'rgba(124, 132, 138, 0.16)',
                    banner: '#cfd5db',
                    civic: '#6f7d86'
                }
            };
            return directions[era] || directions.survival;
        }

        drawEraBackdrop(ctx) {
            const bounds = this.getViewBounds();
            const art = this.getEraArtDirection();
            const skyline = ctx.createLinearGradient(bounds.left, bounds.top, bounds.left, bounds.bottom);
            skyline.addColorStop(0, art.sky);
            skyline.addColorStop(0.45, 'rgba(255,255,255,0)');
            skyline.addColorStop(1, art.ground);
            ctx.fillStyle = skyline;
            ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);

            const horizonY = bounds.top + bounds.height * 0.26;
            ctx.fillStyle = art.accent;
            ctx.beginPath();
            ctx.ellipse(this.world.camp.x, horizonY, Math.max(180, bounds.width * 0.18), 48, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = art.lane;
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(this.world.camp.x - 120, this.world.camp.y + 110);
            ctx.lineTo(this.world.camp.x + 120, this.world.camp.y + 110);
            ctx.stroke();
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(this.world.camp.x - 90, this.world.camp.y + 110);
            ctx.lineTo(this.world.camp.x + 90, this.world.camp.y + 110);
            ctx.stroke();
        }

        decorateEraBuilding(ctx, building, palette) {
            const era = this.world.getCurrentEra ? this.world.getCurrentEra() : 'survival';
            const art = this.getEraArtDirection();
            if (['hut', 'cottage', 'house', 'warehouse', 'civicComplex', 'fortifiedStructure', 'stoneKeep'].includes(building.type)) {
                ctx.strokeStyle = 'rgba(48, 36, 24, 0.28)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(building.x - 10, building.y - 4);
                ctx.lineTo(building.x + 10, building.y - 4);
                ctx.stroke();
            }
            if (era === 'survival' || era === 'toolmaking') {
                if (['leanTo', 'hut', 'storage'].includes(building.type)) {
                    ctx.strokeStyle = 'rgba(232, 214, 172, 0.45)';
                    ctx.lineWidth = 0.9;
                    ctx.beginPath();
                    ctx.moveTo(building.x - 7, building.y - 2);
                    ctx.lineTo(building.x + 7, building.y - 2);
                    ctx.stroke();
                }
                return;
            }
            if (era === 'agriculture' || era === 'masonry') {
                if (['granary', 'foodHall', 'warehouse', 'civicComplex'].includes(building.type)) {
                    ctx.strokeStyle = art.banner;
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(building.x - 2, building.y - 16);
                    ctx.lineTo(building.x - 2, building.y - 6);
                    ctx.lineTo(building.x + 6, building.y - 10);
                    ctx.stroke();
                }
                return;
            }
            if (era === 'engineering' || era === 'metallurgy' || era === 'bronze age' || era === 'iron age') {
                if (['house', 'warehouse', 'civicComplex', 'fortifiedStructure', 'stoneKeep', 'watchtower'].includes(building.type)) {
                    ctx.strokeStyle = art.banner;
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(building.x - 4, building.y - 20);
                    ctx.lineTo(building.x - 4, building.y - 6);
                    ctx.lineTo(building.x + 7, building.y - 11);
                    ctx.lineTo(building.x - 4, building.y - 14);
                    ctx.stroke();
                }
                if (['house', 'civicComplex', 'stoneKeep'].includes(building.type)) {
                    ctx.fillStyle = art.civic;
                    ctx.fillRect(building.x - 2, building.y - 18, 4, 6);
                }
            }
            void palette;
        }

        drawDietOverlay(ctx, building) {
            const era = this.world.getCurrentEra ? this.world.getCurrentEra() : 'survival';
            if (building.type === 'granary' || building.type === 'warehouse') {
                const grainColor = era === 'iron age' ? '#c9d0c1' : era === 'engineering' || era === 'metallurgy' || era === 'bronze age' ? '#d8d3aa' : '#dcc36b';
                ctx.fillStyle = grainColor;
                ctx.fillRect(building.x - 6, building.y - 2, 3, 9);
                ctx.fillRect(building.x - 1, building.y - 4, 3, 11);
                ctx.fillRect(building.x + 4, building.y - 1, 3, 8);
            } else if (building.type === 'kitchen' || building.type === 'foodHall') {
                const mealColor = era === 'metallurgy'
                    ? '#d9dde2'
                    : era === 'engineering'
                        ? '#d8d6bf'
                        : era === 'bronze age'
                            ? '#d9c489'
                            : era === 'iron age'
                                ? '#cfd5cf'
                            : '#d9b473';
                ctx.fillStyle = mealColor;
                ctx.beginPath();
                ctx.arc(building.x - 5, building.y - 2, 2.4, 0, Math.PI * 2);
                ctx.arc(building.x + 3, building.y - 1, 2.1, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(233, 228, 214, 0.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(building.x, building.y - 10);
                ctx.lineTo(building.x, building.y - 18);
                ctx.stroke();
            } else if (building.type === 'farmPlot' || building.type === 'engineeredFarm') {
                const cropColor = era === 'survival' || era === 'toolmaking'
                    ? '#8fae52'
                    : era === 'agriculture'
                        ? '#c2bf67'
                        : era === 'masonry'
                            ? '#d2c46e'
                            : '#d4d9b0';
                ctx.strokeStyle = cropColor;
                ctx.lineWidth = 1;
                for (let i = -1; i <= 1; i += 1) {
                    ctx.beginPath();
                    ctx.moveTo(building.x + i * 6, building.y + 6);
                    ctx.lineTo(building.x + i * 6, building.y - 4);
                    ctx.lineTo(building.x + i * 6 + 2, building.y - 8);
                    ctx.stroke();
                }
            } else if (building.type === 'mill') {
                ctx.fillStyle = era === 'engineering' || era === 'metallurgy'
                    ? '#dadfd5'
                    : era === 'bronze age'
                        ? '#d8c58a'
                        : era === 'iron age'
                            ? '#c6ccc5'
                        : '#d5bf78';
                ctx.fillRect(building.x - 5, building.y + 6, 10, 4);
            }
        }

        clampCamera() {
            const scale = this.getScale();
            const halfWidth = this.viewportWidth / scale / 2;
            const halfHeight = this.viewportHeight / scale / 2;
            const minX = halfWidth;
            const maxX = WORLD_WIDTH - halfWidth;
            const minY = halfHeight;
            const maxY = WORLD_HEIGHT - halfHeight;
            this.cameraX = clamp(this.cameraX, Math.min(minX, maxX), Math.max(minX, maxX));
            this.cameraY = clamp(this.cameraY, Math.min(minY, maxY), Math.max(minY, maxY));
        }

        centerOn(x, y) {
            this.cameraX = x;
            this.cameraY = y;
            this.clampCamera();
        }

        panBy(screenDx, screenDy) {
            const scale = this.getScale();
            this.cameraX -= screenDx / scale;
            this.cameraY -= screenDy / scale;
            this.clampCamera();
        }

        zoomAt(screenX, screenY, zoomFactor) {
            const before = this.screenToWorld(screenX, screenY);
            this.zoom = clamp(this.zoom * zoomFactor, this.minZoom, this.maxZoom);
            this.clampCamera();
            const after = this.screenToWorld(screenX, screenY);
            this.cameraX += before.x - after.x;
            this.cameraY += before.y - after.y;
            this.clampCamera();
        }

        render() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
            ctx.fillStyle = BIOME_COLORS.valley || '#5f553f';
            ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
            ctx.save();
            const scale = this.getScale();
            const halfWidth = this.viewportWidth / scale / 2;
            const halfHeight = this.viewportHeight / scale / 2;
            ctx.scale(scale, scale);
            ctx.translate(-this.cameraX + halfWidth, -this.cameraY + halfHeight);
            this.drawTerrain(ctx);
            this.drawEraBackdrop(ctx);
            this.drawLandUse(ctx);
            this.drawResources(ctx);
            this.drawSettlement(ctx);
            this.drawCamp(ctx);
            this.drawColonists(ctx);
            this.drawWeather(ctx);
            this.drawLighting(ctx);
            ctx.restore();
        }

        drawLandUse(ctx) {
            const occupation = this.world.warAftermath?.occupation || null;
            if (occupation) {
                ctx.fillStyle = 'rgba(171, 67, 57, 0.08)';
                ctx.beginPath();
                ctx.arc(this.world.camp.x, this.world.camp.y, 150 + occupation.severity * 70, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(223, 123, 109, 0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.world.camp.x, this.world.camp.y, 132 + occupation.severity * 56, 0, Math.PI * 2);
                ctx.stroke();
            }
            for (const road of this.world.landUse.roads || []) {
                const surface = road.surface || 'road';
                ctx.strokeStyle = surface === 'stone'
                    ? 'rgba(168, 172, 176, 0.34)'
                    : surface === 'dirt'
                        ? 'rgba(170, 132, 84, 0.26)'
                        : surface === 'trail'
                            ? 'rgba(160, 138, 98, 0.18)'
                            : 'rgba(188, 168, 122, 0.22)';
                ctx.lineWidth = surface === 'stone' ? 6 : surface === 'dirt' ? 5 : 3;
                ctx.beginPath();
                ctx.moveTo(road.fromX, road.fromY);
                ctx.lineTo(road.toX, road.toY);
                ctx.stroke();
                ctx.strokeStyle = surface === 'stone'
                    ? 'rgba(98, 102, 108, 0.28)'
                    : 'rgba(96, 76, 44, 0.24)';
                ctx.lineWidth = surface === 'trail' ? 1.4 : 2;
                ctx.beginPath();
                ctx.moveTo(road.fromX, road.fromY);
                ctx.lineTo(road.toX, road.toY);
                ctx.stroke();
            }
            for (const path of this.world.landUse.trafficPaths || []) {
                ctx.strokeStyle = path.surface === 'dirt'
                    ? `rgba(126, 90, 54, ${(0.12 + (path.quality || 0) * 0.18).toFixed(3)})`
                    : `rgba(148, 126, 88, ${(0.08 + (path.quality || 0) * 0.12).toFixed(3)})`;
                ctx.lineWidth = path.surface === 'dirt' ? 2.8 : 1.8;
                ctx.setLineDash(path.surface === 'trail' ? [5, 7] : []);
                ctx.beginPath();
                ctx.moveTo(path.fromX, path.fromY);
                ctx.lineTo(path.toX, path.toY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            for (const route of this.world.landUse.tradeRoutes || []) {
                ctx.strokeStyle = route.surface === 'caravan-road'
                    ? `rgba(223, 203, 126, ${(0.18 + route.throughput * 0.18).toFixed(3)})`
                    : `rgba(208, 178, 112, ${(0.12 + route.throughput * 0.14).toFixed(3)})`;
                ctx.lineWidth = route.surface === 'caravan-road' ? 3.2 : 2.2;
                ctx.setLineDash([10, 8]);
                ctx.beginPath();
                ctx.moveTo(route.fromX, route.fromY);
                ctx.lineTo(route.toX, route.toY);
                ctx.stroke();
                ctx.setLineDash([]);
                const midpointX = (route.fromX + route.toX) * 0.5;
                const midpointY = (route.fromY + route.toY) * 0.5;
                ctx.fillStyle = 'rgba(232, 214, 160, 0.86)';
                ctx.beginPath();
                ctx.arc(midpointX, midpointY, 3 + route.throughput * 2, 0, Math.PI * 2);
                ctx.fill();
                if (this.zoom >= 1.35) {
                    ctx.fillStyle = 'rgba(245, 235, 208, 0.7)';
                    ctx.font = 'bold 10px Georgia';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(route.colonyName, midpointX, midpointY - 7);
                    ctx.textAlign = 'start';
                    ctx.textBaseline = 'alphabetic';
                }
            }
            for (const route of this.world.landUse.patrolRoutes || []) {
                ctx.strokeStyle = route.diplomacyState === 'rival'
                    ? 'rgba(209, 102, 84, 0.34)'
                    : route.diplomacyState === 'allied'
                        ? 'rgba(171, 205, 150, 0.28)'
                        : 'rgba(214, 193, 140, 0.22)';
                ctx.setLineDash([8, 6]);
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(route.fromX, route.fromY);
                ctx.lineTo(route.toX, route.toY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            for (const zone of this.world.landUse.contestedZones || []) {
                const alpha = 0.06 + zone.severity * 0.08;
                ctx.fillStyle = zone.diplomacyState === 'rival'
                    ? `rgba(187, 76, 60, ${alpha.toFixed(3)})`
                    : `rgba(196, 152, 78, ${alpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = zone.diplomacyState === 'rival'
                    ? `rgba(223, 119, 101, ${(0.16 + zone.severity * 0.16).toFixed(3)})`
                    : `rgba(221, 188, 116, ${(0.14 + zone.severity * 0.12).toFixed(3)})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            for (const outpost of this.world.landUse.outposts || []) {
                const color = outpost.side === 'rival'
                    ? 'rgba(214, 110, 92, 0.82)'
                    : outpost.side === 'allied'
                        ? 'rgba(178, 214, 156, 0.82)'
                        : 'rgba(218, 205, 154, 0.76)';
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(outpost.x, outpost.y - 7);
                ctx.lineTo(outpost.x + 6, outpost.y + 5);
                ctx.lineTo(outpost.x - 6, outpost.y + 5);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = `rgba(36, 28, 20, ${(0.34 + outpost.warning * 0.26).toFixed(3)})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(outpost.x, outpost.y, 10 + outpost.warning * 8, 0, Math.PI * 2);
                ctx.stroke();
            }
            for (const point of this.world.landUse.ambushPoints || []) {
                ctx.strokeStyle = point.kind === 'choke'
                    ? `rgba(227, 190, 116, ${(0.2 + point.severity * 0.24).toFixed(3)})`
                    : `rgba(221, 124, 92, ${(0.2 + point.severity * 0.24).toFixed(3)})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(point.x - 6, point.y - 6);
                ctx.lineTo(point.x + 6, point.y + 6);
                ctx.moveTo(point.x + 6, point.y - 6);
                ctx.lineTo(point.x - 6, point.y + 6);
                ctx.stroke();
            }
            for (const district of this.world.landUse.districts || []) {
                const fills = {
                    housing: 'rgba(222, 201, 155, 0.08)',
                    farming: 'rgba(146, 197, 88, 0.08)',
                    storage: 'rgba(198, 166, 108, 0.08)',
                    craft: 'rgba(139, 166, 193, 0.08)',
                    civic: 'rgba(184, 156, 210, 0.08)',
                    defense: 'rgba(202, 111, 96, 0.08)'
                };
                const strokes = {
                    housing: 'rgba(222, 201, 155, 0.2)',
                    farming: 'rgba(146, 197, 88, 0.2)',
                    storage: 'rgba(198, 166, 108, 0.2)',
                    craft: 'rgba(139, 166, 193, 0.2)',
                    civic: 'rgba(184, 156, 210, 0.22)',
                    defense: 'rgba(202, 111, 96, 0.2)'
                };
                ctx.fillStyle = fills[district.color] || 'rgba(255,255,255,0.05)';
                ctx.beginPath();
                ctx.arc(district.x, district.y, district.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = strokes[district.color] || 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(district.x, district.y, district.radius, 0, Math.PI * 2);
                ctx.stroke();
                if (this.zoom >= 1.45) {
                    const labels = {
                        housing: 'Homes',
                        farming: 'Fields',
                        storage: 'Stores',
                        craft: 'Works',
                        civic: 'Commons',
                        defense: 'Line'
                    };
                    ctx.fillStyle = 'rgba(248, 239, 216, 0.72)';
                    ctx.font = 'bold 11px Georgia';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(labels[district.type] || district.type, district.x, district.y);
                    ctx.textAlign = 'start';
                    ctx.textBaseline = 'alphabetic';
                }
            }
            for (const site of this.world.landUse.institutionSites || []) {
                const palette = site.type === 'council hall'
                    ? { fill: 'rgba(210, 188, 124, 0.85)', stroke: 'rgba(96, 72, 36, 0.8)' }
                    : site.type === 'learning hall' || site.type === 'craft lodge'
                        ? { fill: 'rgba(157, 192, 220, 0.82)', stroke: 'rgba(55, 76, 104, 0.82)' }
                        : site.type === 'trade market' || site.type === 'barter ground'
                            ? { fill: 'rgba(222, 170, 100, 0.82)', stroke: 'rgba(108, 70, 34, 0.82)' }
                            : { fill: 'rgba(194, 176, 146, 0.8)', stroke: 'rgba(82, 66, 44, 0.76)' };
                ctx.fillStyle = palette.fill;
                ctx.beginPath();
                ctx.arc(site.x, site.y, 5 + site.influence * 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = palette.stroke;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(site.x, site.y, 8 + site.influence * 5, 0, Math.PI * 2);
                ctx.stroke();
                if (this.zoom >= 1.55) {
                    ctx.fillStyle = 'rgba(244, 235, 210, 0.74)';
                    ctx.font = 'bold 10px Georgia';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(site.type, site.x, site.y - 10);
                    ctx.textAlign = 'start';
                    ctx.textBaseline = 'alphabetic';
                }
            }
            for (const zone of this.world.landUse.farmingZones || []) {
                ctx.fillStyle = 'rgba(146, 197, 88, 0.12)';
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            for (const zone of this.world.landUse.branchTerritories || []) {
                const occupied = zone.occupationState === 'occupying' || zone.occupationState === 'occupiedByMain';
                ctx.strokeStyle = occupied
                    ? 'rgba(218, 102, 86, 0.34)'
                    : zone.diplomacyState === 'allied'
                        ? 'rgba(183, 216, 165, 0.2)'
                        : zone.type === 'splinter'
                        ? 'rgba(196, 110, 84, 0.22)'
                        : 'rgba(214, 210, 160, 0.18)';
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                ctx.stroke();
                if (occupied) {
                    ctx.fillStyle = 'rgba(218, 102, 86, 0.06)';
                    ctx.beginPath();
                    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            for (const zone of this.world.landUse.gatheringZones || []) {
                ctx.strokeStyle = 'rgba(236, 222, 145, 0.22)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            for (const zone of this.world.landUse.huntingZones || []) {
                ctx.strokeStyle = 'rgba(169, 130, 92, 0.2)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            for (const zone of this.world.landUse.dangerZones || []) {
                ctx.strokeStyle = 'rgba(208, 83, 72, 0.22)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        drawTerrain(ctx) {
            const season = this.world.getSeason().name;
            for (const cell of this.world.cells) {
                let fill = BIOME_COLORS[cell.biome];
                const terrain = cell.terrain || {};
                if (season === 'Winter' && cell.biome !== 'water') {
                    fill = '#a6b0aa';
                } else if (season === 'Autumn' && cell.biome === 'forest') {
                    fill = '#8c6a2f';
                }
                ctx.fillStyle = fill;
                ctx.fillRect(cell.x, cell.y, CELL_WIDTH + 1, CELL_HEIGHT + 1);

                if (cell.biome === 'forest') {
                    ctx.fillStyle = 'rgba(28, 59, 25, 0.18)';
                    for (let i = 0; i < 4; i++) {
                        ctx.fillRect(cell.x + 8 + i * 10, cell.y + ((i * 11) % 24), 6, 6);
                    }
                } else if (cell.biome === 'fertile') {
                    ctx.fillStyle = 'rgba(188, 201, 94, 0.22)';
                    ctx.fillRect(cell.x + 10, cell.y + 8, 22, 10);
                    ctx.fillRect(cell.x + 30, cell.y + 26, 16, 8);
                } else if (cell.biome === 'rocky') {
                    ctx.fillStyle = 'rgba(238, 220, 194, 0.14)';
                    ctx.fillRect(cell.x + 8, cell.y + 8, 12, 7);
                    ctx.fillRect(cell.x + 32, cell.y + 18, 14, 9);
                } else if (cell.biome === 'water') {
                    ctx.fillStyle = '#6f8e45';
                    ctx.fillRect(cell.x, cell.y, CELL_WIDTH + 1, CELL_HEIGHT + 1);
                    ctx.fillStyle = 'rgba(88, 142, 182, 0.4)';
                    const pattern = (cell.col + cell.row) % 3;
                    if (pattern === 0) {
                        ctx.fillRect(cell.x + 7, cell.y + 10, CELL_WIDTH - 14, 8);
                        ctx.fillRect(cell.x + 12, cell.y + 24, CELL_WIDTH - 24, 7);
                    } else if (pattern === 1) {
                        ctx.fillRect(cell.x + 10, cell.y + 8, CELL_WIDTH - 20, 9);
                        ctx.fillRect(cell.x + 5, cell.y + 26, CELL_WIDTH - 14, 6);
                    } else {
                        ctx.fillRect(cell.x + 6, cell.y + 14, CELL_WIDTH - 18, 8);
                        ctx.fillRect(cell.x + 16, cell.y + 28, CELL_WIDTH - 26, 6);
                    }
                    ctx.fillStyle = 'rgba(180, 221, 239, 0.16)';
                    ctx.fillRect(cell.x + 14, cell.y + 11, 10, 2);
                    ctx.fillRect(cell.x + 24, cell.y + 27, 8, 2);
                } else if (cell.biome === 'valley') {
                    ctx.fillStyle = 'rgba(37, 31, 22, 0.16)';
                    ctx.fillRect(cell.x + 4, cell.y + 4, CELL_WIDTH - 8, CELL_HEIGHT - 8);
                    ctx.strokeStyle = 'rgba(200, 173, 120, 0.14)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(cell.x + 6, cell.y + CELL_HEIGHT - 6);
                    ctx.lineTo(cell.x + CELL_WIDTH * 0.45, cell.y + 8);
                    ctx.lineTo(cell.x + CELL_WIDTH - 6, cell.y + CELL_HEIGHT - 10);
                    ctx.stroke();
                }

                if (terrain.marsh && !terrain.drained) {
                    ctx.fillStyle = 'rgba(78, 118, 82, 0.28)';
                    ctx.fillRect(cell.x + 4, cell.y + 6, CELL_WIDTH - 8, CELL_HEIGHT - 12);
                    ctx.fillStyle = 'rgba(156, 179, 102, 0.35)';
                    for (let i = 0; i < 4; i += 1) {
                        const reedX = cell.x + 8 + i * 9;
                        ctx.fillRect(reedX, cell.y + 10 + (i % 2) * 8, 2, 10);
                    }
                }
                if (terrain.cleared) {
                    ctx.fillStyle = 'rgba(92, 63, 38, 0.42)';
                    ctx.fillRect(cell.x + 9, cell.y + 13, 6, 5);
                    ctx.fillRect(cell.x + 24, cell.y + 24, 7, 5);
                    ctx.fillRect(cell.x + 35, cell.y + 11, 5, 5);
                }
                if (terrain.terraced) {
                    ctx.strokeStyle = 'rgba(214, 202, 152, 0.35)';
                    ctx.lineWidth = 1.2;
                    for (let i = 0; i < 3; i += 1) {
                        const y = cell.y + 9 + i * 12;
                        ctx.beginPath();
                        ctx.moveTo(cell.x + 6, y);
                        ctx.lineTo(cell.x + CELL_WIDTH - 6, y);
                        ctx.stroke();
                    }
                }
                if (terrain.irrigation) {
                    ctx.strokeStyle = 'rgba(102, 156, 196, 0.35)';
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(cell.x + 6, cell.y + CELL_HEIGHT * 0.65);
                    ctx.lineTo(cell.x + CELL_WIDTH - 6, cell.y + CELL_HEIGHT * 0.35);
                    ctx.stroke();
                }
                if (terrain.drained) {
                    ctx.strokeStyle = 'rgba(177, 157, 112, 0.32)';
                    ctx.lineWidth = 1.1;
                    ctx.beginPath();
                    ctx.moveTo(cell.x + 7, cell.y + 8);
                    ctx.lineTo(cell.x + CELL_WIDTH - 7, cell.y + CELL_HEIGHT - 8);
                    ctx.stroke();
                }
                if (terrain.fortified) {
                    ctx.strokeStyle = 'rgba(204, 180, 138, 0.42)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(cell.x + 5, cell.y + 5, CELL_WIDTH - 10, CELL_HEIGHT - 10);
                }
                if (terrain.quarried) {
                    ctx.strokeStyle = 'rgba(221, 209, 190, 0.34)';
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(cell.x + 8, cell.y + 10);
                    ctx.lineTo(cell.x + 18, cell.y + 20);
                    ctx.lineTo(cell.x + 30, cell.y + 13);
                    ctx.lineTo(cell.x + 40, cell.y + 26);
                    ctx.stroke();
                }
            }

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= WORLD_WIDTH; x += CELL_WIDTH) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, WORLD_HEIGHT);
                ctx.stroke();
            }
            for (let y = 0; y <= WORLD_HEIGHT; y += CELL_HEIGHT) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(WORLD_WIDTH, y);
                ctx.stroke();
            }
        }

        drawResources(ctx) {
            for (const relic of this.world.godMode?.relics || []) {
                ctx.fillStyle = '#f2d37c';
                ctx.beginPath();
                ctx.moveTo(relic.x, relic.y - 12);
                ctx.lineTo(relic.x + 10, relic.y);
                ctx.lineTo(relic.x, relic.y + 12);
                ctx.lineTo(relic.x - 10, relic.y);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 247, 204, 0.8)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 241, 179, 0.22)';
                ctx.beginPath();
                ctx.arc(relic.x, relic.y, 18, 0, Math.PI * 2);
                ctx.fill();
            }
            for (const resource of this.world.resources) {
                if (resource.depleted) {
                    continue;
                }
                if (resource.type === 'water') {
                    ctx.fillStyle = '#83cceb';
                    ctx.beginPath();
                    ctx.arc(resource.x, resource.y, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,255,0.28)';
                    ctx.fillRect(resource.x - 4, resource.y - 3, 8, 3);
                    continue;
                }
                if (resource.type === 'berries') {
                    ctx.fillStyle = '#5b8b2f';
                    ctx.beginPath();
                    ctx.arc(resource.x, resource.y, 9, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#d53658';
                    ctx.fillRect(resource.x - 5, resource.y - 2, 4, 4);
                    ctx.fillRect(resource.x + 1, resource.y - 5, 4, 4);
                    ctx.fillRect(resource.x, resource.y + 2, 4, 4);
                    continue;
                }
                if (resource.type === 'trees') {
                    ctx.fillStyle = '#5f3415';
                    ctx.fillRect(resource.x - 2, resource.y + 3, 4, 11);
                    ctx.fillStyle = '#356d28';
                    ctx.beginPath();
                    ctx.arc(resource.x, resource.y, 11, 0, Math.PI * 2);
                    ctx.fill();
                    continue;
                }
                if (resource.type === 'stone') {
                    ctx.fillStyle = '#b5a99a';
                    ctx.beginPath();
                    ctx.moveTo(resource.x - 10, resource.y + 6);
                    ctx.lineTo(resource.x - 2, resource.y - 8);
                    ctx.lineTo(resource.x + 10, resource.y - 3);
                    ctx.lineTo(resource.x + 7, resource.y + 8);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            for (const animal of this.world.animals) {
                if (animal.depleted) {
                    continue;
                }
                ctx.fillStyle = '#7f5938';
                ctx.beginPath();
                ctx.ellipse(animal.x, animal.y, 10, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(animal.x + 5, animal.y - 5, 7, 2);
                ctx.fillStyle = '#3b2617';
                ctx.fillRect(animal.x - 6, animal.y + 4, 2, 5);
                ctx.fillRect(animal.x + 3, animal.y + 4, 2, 5);
            }

            for (const predator of this.world.predators) {
                ctx.fillStyle = '#4f3f2e';
                ctx.beginPath();
                ctx.ellipse(predator.x, predator.y, 11, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2d2418';
                ctx.beginPath();
                ctx.moveTo(predator.x - 6, predator.y - 5);
                ctx.lineTo(predator.x - 2, predator.y - 12);
                ctx.lineTo(predator.x + 1, predator.y - 5);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(predator.x + 6, predator.y - 5);
                ctx.lineTo(predator.x + 2, predator.y - 12);
                ctx.lineTo(predator.x - 1, predator.y - 5);
                ctx.fill();
                ctx.fillStyle = '#d16558';
                ctx.fillRect(predator.x - 4, predator.y - 1, 2, 2);
                ctx.fillRect(predator.x + 2, predator.y - 1, 2, 2);
            }
        }

        drawCamp(ctx) {
            const camp = this.world.camp;
            const era = this.world.getCurrentEra ? this.world.getCurrentEra() : 'survival';
            const art = this.getEraArtDirection();
            const bubbleTtl = this.world.godMode?.protectBubbleTtl || 0;
            if (bubbleTtl > 0) {
                const alpha = Math.min(0.32, 0.12 + (bubbleTtl / 42) * 0.2);
                ctx.strokeStyle = `rgba(132, 214, 255, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(camp.x, camp.y, 104, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = `rgba(132, 214, 255, ${alpha * 0.28})`;
                ctx.beginPath();
                ctx.arc(camp.x, camp.y, 104, 0, Math.PI * 2);
                ctx.fill();
            }
            if (era === 'engineering' || era === 'metallurgy' || era === 'bronze age' || era === 'iron age') {
                ctx.fillStyle = 'rgba(190, 198, 205, 0.16)';
                ctx.beginPath();
                ctx.arc(camp.x, camp.y + 14, 56, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(112, 122, 130, 0.24)';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(camp.x, camp.y + 14, 42, 0, Math.PI * 2);
                ctx.stroke();
            } else if (era === 'agriculture' || era === 'masonry') {
                ctx.strokeStyle = 'rgba(173, 145, 96, 0.24)';
                ctx.lineWidth = 4;
                ctx.strokeRect(camp.x - 42, camp.y - 14, 84, 48);
            }
            ctx.fillStyle = 'rgba(86, 54, 24, 0.42)';
            ctx.beginPath();
            ctx.arc(camp.x, camp.y, 72, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#dcc89c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(camp.x, camp.y, 34, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#7d4a1f';
            ctx.fillRect(camp.x - 28, camp.y - 18, 14, 28);
            ctx.fillRect(camp.x + 14, camp.y - 18, 14, 28);
            ctx.fillStyle = '#92714e';
            ctx.fillRect(camp.x - 34, camp.y - 24, 68, 10);
            ctx.strokeStyle = art.banner;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(camp.x - 2, camp.y - 24);
            ctx.lineTo(camp.x - 2, camp.y - 42);
            ctx.lineTo(camp.x + 12, camp.y - 37);
            ctx.lineTo(camp.x - 2, camp.y - 33);
            ctx.stroke();

            ctx.fillStyle = camp.fireFuel > 0 ? '#ffb448' : '#5f4a3a';
            ctx.beginPath();
            ctx.arc(camp.x, camp.y + 10, 10, 0, Math.PI * 2);
            ctx.fill();
            if (camp.fireFuel > 0) {
                ctx.fillStyle = '#ffe388';
                ctx.beginPath();
                ctx.arc(camp.x, camp.y + 8, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            if (camp.structures?.firePit > 0) {
                ctx.strokeStyle = '#5f3720';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(camp.x - 14, camp.y + 18);
                ctx.lineTo(camp.x - 6, camp.y + 25);
                ctx.lineTo(camp.x + 6, camp.y + 25);
                ctx.lineTo(camp.x + 14, camp.y + 18);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 176, 72, 0.35)';
                ctx.beginPath();
                ctx.arc(camp.x, camp.y + 21, 7, 0, Math.PI * 2);
                ctx.fill();
            }
            if (era === 'metallurgy' || era === 'bronze age' || era === 'iron age') {
                ctx.fillStyle = 'rgba(212, 220, 228, 0.22)';
                ctx.fillRect(camp.x - 18, camp.y - 30, 36, 4);
                ctx.fillRect(camp.x - 12, camp.y - 34, 24, 3);
            }

            if (this.world.selectedEntity === camp) {
                ctx.strokeStyle = '#fff1a8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(camp.x, camp.y, 42, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        drawSettlement(ctx) {
            const era = this.world.getCurrentEra ? this.world.getCurrentEra() : 'survival';
            const eraTints = {
                survival: { wood: '#8b6a48', roof: '#6c4c31', trim: '#c8ad79', stone: '#877a6e', field: '#8caf4a' },
                toolmaking: { wood: '#8d6d4a', roof: '#6a4b30', trim: '#cfb07e', stone: '#8a7d71', field: '#90b451' },
                agriculture: { wood: '#90704b', roof: '#715338', trim: '#d7bd7e', stone: '#8a7f73', field: '#97bc5c' },
                masonry: { wood: '#8e7258', roof: '#6f5640', trim: '#d8c8af', stone: '#938983', field: '#9abc63' },
                engineering: { wood: '#826a55', roof: '#5e5146', trim: '#ddd1bc', stone: '#8f9599', field: '#9fc76a' },
                metallurgy: { wood: '#786458', roof: '#4f4e50', trim: '#e1d8c8', stone: '#848b92', field: '#9cc26a' },
                'bronze age': { wood: '#7a664f', roof: '#8a6748', trim: '#e0c88a', stone: '#9e917f', field: '#a8c06a' },
                'iron age': { wood: '#6b6258', roof: '#57585b', trim: '#d7dbe0', stone: '#7b8288', field: '#9bb967' }
            };
            const palette = eraTints[era] || eraTints.survival;
            for (const colony of this.world.branchColonies || []) {
                if (!Number.isFinite(colony.x) || !Number.isFinite(colony.y)) {
                    continue;
                }
                const diplomacy = colony.diplomacyState || 'unknown';
                const ringColors = {
                    unknown: 'rgba(191, 179, 150, 0.38)',
                    cautious: 'rgba(214, 195, 121, 0.42)',
                    trading: 'rgba(122, 194, 158, 0.44)',
                    allied: 'rgba(110, 196, 204, 0.46)',
                    rival: 'rgba(204, 106, 92, 0.48)'
                };
                ctx.strokeStyle = ringColors[diplomacy] || ringColors.unknown;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(colony.x, colony.y + 6, Math.max(20, this.world.getBranchTerritoryRadius(colony) * 0.2), 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = colony.type === 'splinter' ? '#8b5f48' : '#8f7652';
                ctx.beginPath();
                ctx.arc(colony.x, colony.y + 6, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#6c4c31';
                ctx.fillRect(colony.x - 20, colony.y - 6, 40, 10);
                ctx.fillStyle = '#d8c79c';
                ctx.fillRect(colony.x - 4, colony.y + 2, 8, 10);
                ctx.strokeStyle = diplomacy === 'rival'
                    ? 'rgba(229, 130, 109, 0.95)'
                    : diplomacy === 'allied'
                        ? 'rgba(136, 230, 230, 0.95)'
                        : colony.type === 'splinter'
                            ? 'rgba(210, 120, 92, 0.9)'
                            : 'rgba(245, 232, 176, 0.85)';
                ctx.lineWidth = 1.4;
                ctx.strokeRect(colony.x - 22, colony.y - 10, 44, 30);
                if (colony.campaign?.state === 'active') {
                    ctx.strokeStyle = diplomacy === 'allied' ? 'rgba(123, 220, 216, 0.95)' : 'rgba(221, 106, 91, 0.95)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(colony.x - 10, colony.y - 18);
                    ctx.lineTo(colony.x + 12, colony.y - 18);
                    ctx.lineTo(colony.x + 6, colony.y - 10);
                    ctx.stroke();
                }
                if (colony.occupation?.state === 'occupying') {
                    ctx.strokeStyle = 'rgba(234, 139, 116, 0.95)';
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.arc(colony.x, colony.y + 6, 24, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(234, 139, 116, 0.88)';
                    ctx.beginPath();
                    ctx.moveTo(colony.x + 15, colony.y - 12);
                    ctx.lineTo(colony.x + 24, colony.y - 6);
                    ctx.lineTo(colony.x + 15, colony.y);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            this.drawFactionEffects(ctx);
            this.drawFactionParties(ctx);
            this.drawBattlefronts(ctx);
            for (const project of this.world.projects) {
                this.drawProject(ctx, project);
            }
            for (const building of this.world.buildings) {
                this.drawBuilding(ctx, building);
            }
        }

        drawBattlefronts(ctx) {
            for (const scar of this.world.battleScars || []) {
                const alpha = Math.max(0.12, Math.min(0.42, (scar.ttl / Math.max(1, scar.maxTtl || scar.ttl || 1)) * 0.42));
                ctx.fillStyle = `rgba(43, 31, 24, ${alpha})`;
                ctx.beginPath();
                ctx.arc(scar.x, scar.y, scar.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            for (const front of this.world.battlefronts || []) {
                const alpha = Math.max(0.2, Math.min(1, front.ttl / Math.max(1, front.maxTtl || front.ttl || 1)));
                const radius = 16 + front.scale * 16;
                if (front.formation?.attackerOrigin) {
                    ctx.strokeStyle = `rgba(218, 141, 115, ${0.28 * alpha})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(front.formation.attackerOrigin.x, front.formation.attackerOrigin.y);
                    ctx.lineTo(front.formation.defenderAnchor.x, front.formation.defenderAnchor.y);
                    ctx.stroke();
                    ctx.fillStyle = `rgba(238, 214, 178, ${0.9 * alpha})`;
                    ctx.font = 'bold 8px Georgia';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(
                        `${front.tactics?.attacker || 'attack'} / ${front.reportType || 'battle'}`,
                        front.formation.attackerOrigin.x,
                        front.formation.attackerOrigin.y - 8
                    );
                    ctx.textAlign = 'start';
                    ctx.textBaseline = 'alphabetic';
                }
                ctx.strokeStyle = `rgba(228, 113, 92, ${0.7 * alpha})`;
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.arc(front.x, front.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = `rgba(226, 214, 170, ${0.65 * alpha})`;
                ctx.beginPath();
                ctx.arc(front.x, front.y, radius - 5, 0, Math.PI * 2);
                ctx.stroke();

                if ((front.damageFlash || 0) > 0) {
                    ctx.fillStyle = `rgba(255, 208, 126, ${0.22 * Math.min(1, front.damageFlash)})`;
                    ctx.beginPath();
                    ctx.arc(front.x, front.y, radius + 6, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = `rgba(70, 24, 19, ${0.8 * alpha})`;
                ctx.fillRect(front.x - 16, front.y - radius - 12, 32, 4);
                ctx.fillStyle = `rgba(218, 97, 82, ${0.95 * alpha})`;
                ctx.fillRect(front.x - 16, front.y - radius - 12, 32 * Math.max(0, front.attackerHealth / Math.max(1, front.attackerMaxHealth)), 4);

                ctx.fillStyle = `rgba(30, 45, 26, ${0.8 * alpha})`;
                ctx.fillRect(front.x - 16, front.y - radius - 6, 32, 4);
                ctx.fillStyle = `rgba(123, 196, 111, ${0.95 * alpha})`;
                ctx.fillRect(front.x - 16, front.y - radius - 6, 32 * Math.max(0, front.defenderHealth / Math.max(1, front.defenderMaxHealth)), 4);

                ctx.strokeStyle = `rgba(255, 233, 190, ${0.75 * alpha})`;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(front.x - 5, front.y - 5);
                ctx.lineTo(front.x + 5, front.y + 5);
                ctx.moveTo(front.x + 5, front.y - 5);
                ctx.lineTo(front.x - 5, front.y + 5);
                ctx.stroke();

                const attackers = (front.attackers || []).filter((attacker) => attacker.alive && attacker.hp > 0);
                for (const attacker of attackers) {
                    this.drawBattleFighter(ctx, attacker.x, attacker.y, '#b6584e', '#f0b5aa', true, attacker.posture === 'engaged');
                }

                const defenders = (front.mode === 'outbound' || front.mode === 'intercolonial')
                    ? (front.defenders || []).filter((defender) => defender.alive && defender.hp > 0)
                    : this.world.colonists.filter((colonist) =>
                        colonist.alive &&
                        (colonist.intent === 'war' || colonist.intent === 'protect') &&
                        distance(colonist, front) < 78
                    );
                if (front.formation?.defenderAnchor && defenders.length > 0) {
                    ctx.strokeStyle = `rgba(141, 208, 135, ${0.32 * alpha})`;
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.arc(front.formation.defenderAnchor.x, front.formation.defenderAnchor.y, 18 + front.scale * 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
                for (const defender of defenders) {
                    if (front.mode === 'outbound' || front.mode === 'intercolonial') {
                        this.drawBattleFighter(ctx, defender.x, defender.y, '#587348', '#d6e5b8', false, defender.posture === 'engaged');
                    } else {
                        ctx.strokeStyle = `rgba(121, 204, 118, ${0.4 * alpha})`;
                        ctx.lineWidth = 1.4;
                        ctx.beginPath();
                        ctx.arc(defender.x, defender.y, 13.5, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
            for (const burst of this.world.battleBursts || []) {
                const alpha = Math.max(0, Math.min(1, burst.ttl / Math.max(0.1, burst.maxTtl || burst.ttl || 1)));
                ctx.fillStyle = burst.type === 'building'
                    ? `rgba(255, 171, 102, ${(0.28 * alpha).toFixed(3)})`
                    : `rgba(255, 220, 145, ${(0.32 * alpha).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, 4 + (1 - alpha) * 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = burst.type === 'building'
                    ? `rgba(97, 54, 35, ${(0.7 * alpha).toFixed(3)})`
                    : `rgba(140, 56, 46, ${(0.68 * alpha).toFixed(3)})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, 2 + (1 - alpha) * 8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        drawBattleFighter(ctx, x, y, body, head, attacker, engaged = false) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
            ctx.beginPath();
            ctx.ellipse(x, y + 3.5, 2.5, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.arc(x, y + 1, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = head;
            ctx.beginPath();
            ctx.arc(x, y - 3.2, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = attacker ? '#4a241d' : '#29441f';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 2, y);
            ctx.lineTo(x + 5.5, y + 2.5);
            ctx.stroke();
            if (engaged) {
                ctx.strokeStyle = attacker ? '#f1d3ab' : '#d8f1c9';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(x, y, 5.4, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        drawFactionParties(ctx) {
            for (const party of this.world.factionParties || []) {
                if (!Number.isFinite(party.x) || !Number.isFinite(party.y)) {
                    continue;
                }
                const colors = {
                    trade: '#d8c07a',
                    aid: '#7dc9c8',
                    knowledge: '#d7d08a',
                    raid: '#d46d5d',
                    refugee: '#d7d2bb'
                };
                const color = colors[party.type] || '#ffffff';
                const memberCount = Math.max(2, Math.min(5, Math.round((party.strength || 1) * 1.35)));
                const offsets = [
                    { x: 0, y: 0 },
                    { x: -7, y: 4 },
                    { x: 7, y: 4 },
                    { x: -4, y: -6 },
                    { x: 4, y: -6 }
                ];
                const dx = party.targetX - party.startX;
                const dy = party.targetY - party.startY;
                const length = Math.max(1, Math.hypot(dx, dy));
                const trailX = -dx / length;
                const trailY = -dy / length;
                const baseX = party.x;
                const baseY = party.y;

                for (let i = 0; i < memberCount; i += 1) {
                    const offset = offsets[i] || offsets[0];
                    const px = baseX + offset.x + trailX * i * 1.3;
                    const py = baseY + offset.y + trailY * i * 1.3;
                    this.drawFactionPartyMember(ctx, party, px, py, color, i === 0);
                }

                if (party.type === 'trade' || party.type === 'aid') {
                    ctx.fillStyle = '#6a533b';
                    ctx.fillRect(baseX - 4, baseY + 6, 8, 5);
                } else if (party.type === 'knowledge') {
                    ctx.fillStyle = '#5b4633';
                    ctx.font = 'bold 7px Georgia';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('i', baseX, baseY + 8);
                    ctx.textAlign = 'start';
                    ctx.textBaseline = 'alphabetic';
                }
            }
        }

        drawFactionEffects(ctx) {
            for (const effect of this.world.factionEffects || []) {
                if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y)) {
                    continue;
                }
                const alpha = Math.max(0, Math.min(1, effect.ttl / Math.max(0.1, effect.maxTtl || effect.ttl || 1)));
                const colors = {
                    trade: 'rgba(233, 207, 124, ',
                    aid: 'rgba(134, 214, 211, ',
                    knowledge: 'rgba(226, 224, 145, ',
                    raid: 'rgba(225, 107, 95, ',
                    refugee: 'rgba(222, 215, 196, '
                };
                const base = colors[effect.type] || 'rgba(255,255,255,';
                ctx.strokeStyle = `${base}${(0.65 * alpha).toFixed(3)})`;
                ctx.lineWidth = effect.type === 'raid' ? 3 : 2;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, 10 + (1 - alpha) * 12, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = `${base}${(0.18 * alpha).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, 6 + (1 - alpha) * 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = `rgba(61, 47, 31, ${(0.95 * alpha).toFixed(3)})`;
                ctx.font = 'bold 8px Georgia';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(effect.label || effect.type, effect.x, effect.y - 12);
                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
            }
        }

        drawFactionPartyMember(ctx, party, x, y, color, leader) {
            const bodyColor = party.type === 'raid' ? '#7f3c34' : color;
            const accent = party.type === 'aid'
                ? '#d7f3f0'
                : party.type === 'trade'
                    ? '#f3e3ab'
                    : party.type === 'knowledge'
                        ? '#efe9b0'
                        : party.type === 'refugee'
                            ? '#f0e8d2'
                            : '#f0b5aa';

            ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
            ctx.beginPath();
            ctx.ellipse(x, y + 4.5, 2.4, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.arc(x, y + 1.5, leader ? 4 : 3.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(x, y - 3.4, leader ? 2.2 : 1.9, 0, Math.PI * 2);
            ctx.fill();

            if (party.type === 'raid') {
                ctx.strokeStyle = '#3f241d';
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.moveTo(x + 3, y - 1);
                ctx.lineTo(x + 7, y + 4);
                ctx.stroke();
            } else if (party.type === 'trade') {
                ctx.strokeStyle = '#70543b';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + 2.5, y + 1.5);
                ctx.lineTo(x + 5.5, y + 3.5);
                ctx.stroke();
            } else if (party.type === 'aid') {
                ctx.strokeStyle = '#4c736d';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x - 2, y - 1);
                ctx.lineTo(x + 2, y - 1);
                ctx.moveTo(x, y - 3);
                ctx.lineTo(x, y + 1);
                ctx.stroke();
            } else if (party.type === 'refugee') {
                ctx.strokeStyle = '#7e715e';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x - 2, y + 1);
                ctx.lineTo(x + 2, y + 1);
                ctx.stroke();
            }
        }

        drawProject(ctx, project) {
            ctx.strokeStyle = '#d8c497';
            ctx.lineWidth = 2;
            ctx.strokeRect(project.x - 16, project.y - 14, 32, 28);
            ctx.strokeRect(project.x - 11, project.y - 9, 22, 18);
            const progress = Math.max(0, Math.min(1, project.buildProgress / Math.max(0.1, project.buildTime)));
            ctx.fillStyle = 'rgba(216, 196, 151, 0.18)';
            ctx.fillRect(project.x - 16, project.y + 18, 32, 4);
            ctx.fillStyle = '#d8c497';
            ctx.fillRect(project.x - 16, project.y + 18, 32 * progress, 4);
            if (project.type === 'repairStructure') {
                ctx.strokeStyle = '#ffdd8c';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(project.x - 8, project.y - 6);
                ctx.lineTo(project.x + 8, project.y + 6);
                ctx.moveTo(project.x - 8, project.y + 6);
                ctx.lineTo(project.x + 8, project.y - 6);
                ctx.stroke();
            }
            if (this.world.selectedEntity === project) {
                ctx.strokeStyle = '#fff1a8';
                ctx.strokeRect(project.x - 20, project.y - 18, 40, 44);
            }
        }

        drawBuilding(ctx, building) {
            const era = this.world.getCurrentEra ? this.world.getCurrentEra() : 'survival';
            const eraTints = {
                survival: { wood: '#9c7a52', roof: '#c8a36e', stone: '#7e7162', trim: '#e3cfaa', field: '#7cab4c' },
                toolmaking: { wood: '#937149', roof: '#c49a66', stone: '#847666', trim: '#e0cca2', field: '#7cab4c' },
                agriculture: { wood: '#8b6843', roof: '#bb905c', stone: '#8a7c68', trim: '#dfc48e', field: '#8eb954' },
                masonry: { wood: '#816348', roof: '#9d6f50', stone: '#9a8a78', trim: '#dfd1bf', field: '#8eb954' },
                engineering: { wood: '#746655', roof: '#7d5e4b', stone: '#9ca4aa', trim: '#d3d9dd', field: '#93ba66' },
                metallurgy: { wood: '#665a4d', roof: '#71584a', stone: '#8e979f', trim: '#d0d7dd', field: '#97bf6b' },
                'bronze age': { wood: '#78654c', roof: '#91694b', stone: '#9a8a73', trim: '#e0c788', field: '#a5c76b' },
                'iron age': { wood: '#5f605d', roof: '#62656b', stone: '#8c949a', trim: '#dde2e6', field: '#9cc46b' }
            };
            const palette = eraTints[era] || eraTints.survival;
            if (building.type === 'campfire') {
                ctx.fillStyle = '#6f4220';
                ctx.beginPath();
                ctx.arc(building.x, building.y + 2, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffb448';
                ctx.beginPath();
                ctx.arc(building.x, building.y, 5, 0, Math.PI * 2);
                ctx.fill();
            } else if (building.type === 'leanTo') {
                ctx.fillStyle = '#8f6a43';
                ctx.beginPath();
                ctx.moveTo(building.x - 14, building.y + 10);
                ctx.lineTo(building.x, building.y - 12);
                ctx.lineTo(building.x + 14, building.y + 10);
                ctx.closePath();
                ctx.fill();
            } else if (building.type === 'hut') {
                ctx.fillStyle = palette.wood;
                ctx.fillRect(building.x - 13, building.y - 10, 26, 20);
                ctx.fillStyle = palette.roof;
                ctx.fillRect(building.x - 15, building.y - 14, 30, 8);
            } else if (building.type === 'cottage') {
                ctx.fillStyle = era === 'masonry' || era === 'engineering' || era === 'metallurgy' || era === 'bronze age' || era === 'iron age' ? '#9a8876' : palette.wood;
                ctx.fillRect(building.x - 15, building.y - 11, 30, 22);
                ctx.fillStyle = palette.roof;
                ctx.fillRect(building.x - 17, building.y - 16, 34, 8);
                ctx.fillStyle = palette.trim;
                ctx.fillRect(building.x - 4, building.y - 2, 8, 13);
            } else if (building.type === 'house') {
                ctx.fillStyle = era === 'engineering' || era === 'metallurgy'
                    ? '#9aa0a4'
                    : era === 'bronze age'
                        ? '#9a815f'
                        : era === 'iron age'
                            ? '#8e949a'
                        : '#a3845f';
                ctx.fillRect(building.x - 17, building.y - 12, 34, 24);
                ctx.fillStyle = palette.roof;
                ctx.fillRect(building.x - 19, building.y - 18, 38, 9);
                ctx.fillStyle = palette.trim;
                ctx.fillRect(building.x - 5, building.y - 1, 10, 13);
                ctx.fillRect(building.x - 13, building.y - 5, 6, 6);
                ctx.fillRect(building.x + 7, building.y - 5, 6, 6);
            } else if (building.type === 'fortifiedStructure') {
                ctx.fillStyle = palette.stone;
                ctx.fillRect(building.x - 18, building.y - 14, 36, 28);
                ctx.strokeStyle = palette.trim;
                ctx.lineWidth = 1.8;
                ctx.strokeRect(building.x - 18, building.y - 14, 36, 28);
                ctx.fillStyle = '#8f5a39';
                ctx.fillRect(building.x - 6, building.y - 1, 12, 15);
            } else if (building.type === 'storage') {
                ctx.fillStyle = palette.wood;
                ctx.fillRect(building.x - 12, building.y - 9, 24, 18);
                ctx.strokeStyle = palette.trim;
                ctx.lineWidth = 1.2;
                ctx.strokeRect(building.x - 12, building.y - 9, 24, 18);
            } else if (building.type === 'storagePit') {
                ctx.fillStyle = '#5c4330';
                ctx.beginPath();
                ctx.ellipse(building.x, building.y + 2, 13, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ad8b67';
                ctx.lineWidth = 1.2;
                ctx.stroke();
            } else if (building.type === 'granary') {
                ctx.fillStyle = palette.wood;
                ctx.fillRect(building.x - 14, building.y - 10, 28, 20);
                ctx.fillStyle = '#d7c17a';
                ctx.fillRect(building.x - 10, building.y - 5, 20, 10);
            } else if (building.type === 'warehouse') {
                ctx.fillStyle = era === 'engineering' || era === 'metallurgy'
                    ? '#8d949a'
                    : era === 'bronze age'
                        ? '#8e7c63'
                        : era === 'iron age'
                            ? '#7e878e'
                        : palette.wood;
                ctx.fillRect(building.x - 18, building.y - 11, 36, 22);
                ctx.strokeStyle = palette.trim;
                ctx.lineWidth = 1.4;
                ctx.strokeRect(building.x - 18, building.y - 11, 36, 22);
            } else if (building.type === 'workshop') {
                ctx.fillStyle = era === 'engineering' || era === 'metallurgy'
                    ? '#7b8288'
                    : era === 'bronze age'
                        ? '#85684e'
                        : era === 'iron age'
                            ? '#727b83'
                        : '#72614c';
                ctx.fillRect(building.x - 14, building.y - 7, 28, 14);
                ctx.fillStyle = '#caa05a';
                ctx.fillRect(building.x - 8, building.y - 11, 16, 4);
            } else if (building.type === 'kitchen') {
                ctx.fillStyle = '#7a5a3b';
                ctx.fillRect(building.x - 15, building.y - 8, 30, 16);
                ctx.fillStyle = '#e0a45c';
                ctx.beginPath();
                ctx.arc(building.x, building.y - 4, 5, 0, Math.PI * 2);
                ctx.fill();
            } else if (building.type === 'foodHall') {
                ctx.fillStyle = era === 'engineering' || era === 'metallurgy'
                    ? '#8b847b'
                    : era === 'bronze age'
                        ? '#8f714f'
                        : era === 'iron age'
                            ? '#7f8589'
                        : '#826246';
                ctx.fillRect(building.x - 20, building.y - 10, 40, 20);
                ctx.fillStyle = '#d8b36d';
                ctx.fillRect(building.x - 12, building.y - 4, 24, 8);
            } else if (building.type === 'civicComplex') {
                ctx.fillStyle = era === 'engineering' || era === 'metallurgy'
                    ? '#88919a'
                    : era === 'bronze age'
                        ? '#92795c'
                        : era === 'iron age'
                            ? '#808890'
                        : '#7d6b57';
                ctx.fillRect(building.x - 22, building.y - 12, 44, 24);
                ctx.fillStyle = palette.trim;
                ctx.fillRect(building.x - 16, building.y - 6, 32, 12);
                ctx.strokeStyle = palette.trim;
                ctx.lineWidth = 1.3;
                ctx.strokeRect(building.x - 22, building.y - 12, 44, 24);
            } else if (building.type === 'farmPlot') {
                ctx.fillStyle = '#755631';
                ctx.fillRect(building.x - 14, building.y - 10, 28, 20);
                ctx.strokeStyle = palette.field;
                ctx.lineWidth = 1.4;
                ctx.strokeRect(building.x - 14, building.y - 10, 28, 20);
                ctx.fillStyle = palette.field;
                ctx.fillRect(building.x - 10, building.y - 6, 20, 12);
            } else if (building.type === 'engineeredFarm') {
                ctx.fillStyle = '#6d5530';
                ctx.fillRect(building.x - 16, building.y - 11, 32, 22);
                ctx.strokeStyle = palette.field;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(building.x - 16, building.y - 11, 32, 22);
                ctx.fillStyle = palette.field;
                ctx.fillRect(building.x - 12, building.y - 7, 24, 5);
                ctx.fillRect(building.x - 12, building.y + 1, 24, 5);
            } else if (building.type === 'irrigation') {
                ctx.strokeStyle = '#73b8dd';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(building.x - 16, building.y + 6);
                ctx.lineTo(building.x - 4, building.y - 4);
                ctx.lineTo(building.x + 8, building.y + 2);
                ctx.lineTo(building.x + 16, building.y - 6);
                ctx.stroke();
            } else if (building.type === 'canal') {
                ctx.strokeStyle = '#6ab2dc';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(building.x - 18, building.y + 8);
                ctx.lineTo(building.x - 6, building.y - 6);
                ctx.lineTo(building.x + 6, building.y + 5);
                ctx.lineTo(building.x + 18, building.y - 8);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(214, 235, 246, 0.6)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(building.x - 18, building.y + 8);
                ctx.lineTo(building.x - 6, building.y - 6);
                ctx.lineTo(building.x + 6, building.y + 5);
                ctx.lineTo(building.x + 18, building.y - 8);
                ctx.stroke();
            } else if (building.type === 'watchtower') {
                ctx.fillStyle = era === 'engineering' || era === 'metallurgy' || era === 'bronze age' || era === 'iron age' ? palette.stone : palette.wood;
                ctx.fillRect(building.x - 4, building.y - 16, 8, 22);
                ctx.fillStyle = palette.trim;
                ctx.fillRect(building.x - 10, building.y - 20, 20, 6);
            } else if (building.type === 'wall') {
                ctx.fillStyle = palette.stone;
                ctx.fillRect(building.x - 18, building.y - 6, 36, 12);
            } else if (building.type === 'mill') {
                ctx.fillStyle = '#6f5b47';
                ctx.fillRect(building.x - 12, building.y - 10, 24, 20);
                ctx.strokeStyle = '#d2bf9a';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(building.x, building.y - 16);
                ctx.lineTo(building.x, building.y + 12);
                ctx.moveTo(building.x - 10, building.y - 2);
                ctx.lineTo(building.x + 10, building.y - 2);
                ctx.moveTo(building.x - 8, building.y - 10);
                ctx.lineTo(building.x + 8, building.y + 6);
                ctx.moveTo(building.x + 8, building.y - 10);
                ctx.lineTo(building.x - 8, building.y + 6);
                ctx.stroke();
            } else if (building.type === 'stoneKeep') {
                ctx.fillStyle = palette.stone;
                ctx.fillRect(building.x - 22, building.y - 16, 44, 32);
                ctx.strokeStyle = palette.trim;
                ctx.lineWidth = 1.8;
                ctx.strokeRect(building.x - 22, building.y - 16, 44, 32);
                ctx.fillStyle = '#8f5b39';
                ctx.fillRect(building.x - 7, building.y + 1, 14, 15);
                ctx.fillRect(building.x - 22, building.y - 20, 8, 10);
                ctx.fillRect(building.x + 14, building.y - 20, 8, 10);
            }
            this.decorateEraBuilding(ctx, building, palette);
            this.drawDietOverlay(ctx, building);
            const integrity = building.maxIntegrity ? (building.integrity / building.maxIntegrity) : 1;
            if (integrity < 0.18) {
                ctx.fillStyle = 'rgba(35, 28, 22, 0.42)';
                ctx.beginPath();
                ctx.arc(building.x, building.y + 4, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(146, 98, 70, 0.9)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(building.x - 10, building.y + 8);
                ctx.lineTo(building.x - 2, building.y - 2);
                ctx.lineTo(building.x + 9, building.y + 9);
                ctx.stroke();
            }
            if (integrity < 0.85) {
                ctx.strokeStyle = integrity < 0.45 ? 'rgba(209, 82, 68, 0.85)' : 'rgba(232, 183, 84, 0.85)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(building.x - 10, building.y - 8);
                ctx.lineTo(building.x - 2, building.y + 4);
                ctx.moveTo(building.x + 2, building.y - 6);
                ctx.lineTo(building.x + 9, building.y + 5);
                ctx.stroke();
            }
            if (this.world.selectedEntity === building) {
                ctx.strokeStyle = '#fff1a8';
                ctx.lineWidth = 2;
                ctx.strokeRect(building.x - 18, building.y - 16, 36, 32);
            }
        }

        drawColonists(ctx) {
            for (const colonist of this.world.colonists) {
                if (!colonist.alive) {
                    this.drawDeadColonist(ctx, colonist);
                    continue;
                }
                const drewSprite = this.drawColonistSprite(ctx, colonist);
                if (!drewSprite) {
                    this.drawColonistFallback(ctx, colonist);
                }
                this.drawColonistGear(ctx, colonist);
                this.drawColonistBattleState(ctx, colonist);
                this.drawIntentBubble(ctx, colonist);

                if (colonist.intent === 'war') {
                    ctx.strokeStyle = 'rgba(226, 108, 92, 0.9)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(colonist.x, colonist.y, 13, 0, Math.PI * 2);
                    ctx.stroke();
                }

                if (this.world.selectedEntity === colonist) {
                    ctx.strokeStyle = '#fff1a8';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(colonist.x, colonist.y, 11, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }

        drawColonistFallback(ctx, colonist) {
            const danger = Math.min(colonist.stats.hunger, colonist.stats.thirst, colonist.stats.warmth, colonist.stats.energy);
            const faceColor = danger < 24 ? '#c8d04a' : '#72d84f';
            const faceShade = danger < 24 ? '#92a02c' : '#44a834';
            const cheekColor = danger < 24 ? 'rgba(255, 204, 127, 0.24)' : 'rgba(255, 239, 165, 0.18)';

            ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
            ctx.beginPath();
            ctx.ellipse(colonist.x, colonist.y + 11, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = faceColor;
            ctx.beginPath();
            ctx.arc(colonist.x, colonist.y, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = faceShade;
            ctx.beginPath();
            ctx.arc(colonist.x + 3, colonist.y + 3, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#7f5030';
            ctx.fillRect(colonist.x - 1, colonist.y - 13, 2, 4);
            ctx.fillStyle = '#ef6588';
            ctx.fillRect(colonist.x - 2, colonist.y - 16, 4, 4);

            ctx.fillStyle = cheekColor;
            ctx.beginPath();
            ctx.arc(colonist.x - 4, colonist.y + 2, 2, 0, Math.PI * 2);
            ctx.arc(colonist.x + 4, colonist.y + 2, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(colonist.x - 3.2, colonist.y - 2.5, 2.2, 0, Math.PI * 2);
            ctx.arc(colonist.x + 3.2, colonist.y - 2.5, 2.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#2d2418';
            ctx.beginPath();
            ctx.arc(colonist.x - 2.8, colonist.y - 2.2, 0.9, 0, Math.PI * 2);
            ctx.arc(colonist.x + 2.8, colonist.y - 2.2, 0.9, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#2d2418';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(colonist.x, colonist.y + 1.8, 3.8, 0.25, Math.PI - 0.25);
            ctx.stroke();
        }

        getColonistWorkAnimation(colonist) {
            const currentStep = colonist.plan?.[colonist.planStep] || null;
            const gatherActions = new Set([
                'collectFood',
                'deliverFood',
                'collectWater',
                'deliverWater',
                'collectWood',
                'deliverWood'
            ]);
            const isActivelyWorking = colonist.state === 'working' && colonist.actionProgress > 0;
            if (isActivelyWorking && gatherActions.has(currentStep?.action)) {
                return 'gather';
            }
            return null;
        }

        getColonistSpritePose(colonist) {
            const now = performance.now() * 0.001;
            const previous = this.colonistSpriteState.get(colonist.id) || {
                x: colonist.x,
                y: colonist.y,
                direction: 'down',
                animation: 'idleStand',
                idleStyle: Math.floor(Math.random() * COLONIST_SPRITE_CONFIG.idleStyleCount),
                frame: 0,
                frameTime: now
            };
            const dx = colonist.x - previous.x;
            const dy = colonist.y - previous.y;
            const movingByDelta = Math.abs(dx) + Math.abs(dy) > 0.12;
            const movingByVelocity = Math.abs(colonist.vx || 0) + Math.abs(colonist.vy || 0) > 4;
            const moving = movingByDelta || colonist.state === 'moving' || (colonist.state === 'moving' && movingByVelocity);
            let direction = previous.direction;
            if (moving) {
                const dirX = movingByDelta ? dx : (colonist.vx || 0);
                const dirY = movingByDelta ? dy : (colonist.vy || 0);
                if (Math.abs(dirX) + Math.abs(dirY) > 0.01) {
                    direction = Math.abs(dirX) > Math.abs(dirY)
                        ? (dirX >= 0 ? 'right' : 'left')
                        : (dirY >= 0 ? 'down' : 'up');
                }
            }
            const workAnimation = this.getColonistWorkAnimation(colonist);
            const animation = workAnimation || (moving ? 'walk' : this.getColonistStationaryAnimation(colonist));
            const frameCount =
                animation === 'emote'
                    ? COLONIST_SPRITE_CONFIG.emoteFrameCount
                    : animation === 'walk'
                    ? COLONIST_SPRITE_CONFIG.walkFrameCount
                    : animation === 'gather'
                        ? COLONIST_SPRITE_CONFIG.gatherFrameCount
                        : animation === 'fight'
                            ? COLONIST_SPRITE_CONFIG.fightFrameCount
                        : animation === 'jump'
                            ? COLONIST_SPRITE_CONFIG.jumpFrameCount
                        : animation === 'idleStand'
                            ? COLONIST_SPRITE_CONFIG.idleStandFrameCount
                            : 1;
            const idleStyle = Number.isFinite(previous.idleStyle)
                ? previous.idleStyle
                : Math.floor(Math.random() * COLONIST_SPRITE_CONFIG.idleStyleCount);
            let frame = animation === 'idle'
                ? idleStyle
                : previous.animation === animation
                    ? previous.frame
                    : 0;
            let frameTime = previous.frameTime;
            const cadence =
                animation === 'emote'
                    ? 0.12
                    : animation === 'walk'
                    ? 0.08
                    : animation === 'gather'
                        ? 0.11
                        : animation === 'fight'
                            ? 0.09
                        : animation === 'jump'
                            ? 0.1
                        : animation === 'idleStand'
                            ? 0.55
                            : 0.42;
            if (animation !== 'idle' && now - previous.frameTime >= cadence) {
                frame = (frame + 1) % frameCount;
                frameTime = now;
            } else if (previous.animation !== animation) {
                frameTime = now;
            }
            const next = {
                x: colonist.x,
                y: colonist.y,
                direction,
                animation,
                idleStyle,
                frame,
                frameTime
            };
            this.colonistSpriteState.set(colonist.id, next);
            return next;
        }

        getColonistStationaryAnimation(colonist) {
            const sitIntents = new Set(['sleep', 'warm', 'socialize']);
            const fightIntents = new Set(['war', 'protect']);
            const isBattleReady = colonist.intent === 'war' ||
                (colonist.intent === 'protect' && (colonist.assignedBattlefrontId || colonist.battleRole || colonist.lastBattleHitTtl > 0));
            if (fightIntents.has(colonist.intent) && isBattleReady) {
                return 'fight';
            }
            if (colonist.intent === 'socialize' && this.shouldColonistEmote(colonist)) {
                return 'emote';
            }
            if (sitIntents.has(colonist.intent)) {
                return 'idle';
            }
            if (this.shouldColonistCelebrate(colonist)) {
                return 'jump';
            }
            return 'idleStand';
        }

        shouldColonistEmote(colonist) {
            if (distance(colonist, this.world.camp) > 120) {
                return false;
            }
            const recentEvents = (this.world.events || []).slice(0, 4).join(' ').toLowerCase();
            return recentEvents.includes('alliance ceremony') ||
                recentEvents.includes('formed a household') ||
                recentEvents.includes('was born') ||
                recentEvents.includes('held a planting festival');
        }

        shouldColonistCelebrate(colonist) {
            if (distance(colonist, this.world.camp) > 130 || colonist.intent === 'war' || colonist.intent === 'protect') {
                return false;
            }
            if (colonist.intent === 'sleep' ||
                colonist.intent === 'warm' ||
                colonist.intent === 'socialize' ||
                colonist.intent === 'forage' ||
                colonist.intent === 'gatherWood' ||
                colonist.intent === 'gatherStone' ||
                colonist.intent === 'haulWater' ||
                colonist.intent === 'plant') {
                return false;
            }
            const recentEvents = (this.world.events || []).slice(0, 5).join(' ').toLowerCase();
            const hasCelebration = recentEvents.includes('blessed') ||
                recentEvents.includes('formed a household') ||
                recentEvents.includes('was born') ||
                recentEvents.includes('held a planting festival') ||
                recentEvents.includes('finished a') ||
                recentEvents.includes('upgraded');
            return hasCelebration && colonist.stats.morale > 70;
        }

        drawColonistSprite(ctx, colonist) {
            if (!this.colonistSpriteReady || !this.colonistSprite) {
                return false;
            }
            const pose = this.getColonistSpritePose(colonist);
            const row = COLONIST_SPRITE_CONFIG.rows[pose.animation]?.[pose.direction];
            if (!Number.isFinite(row)) {
                return false;
            }
            const frameCount =
                pose.animation === 'emote'
                    ? COLONIST_SPRITE_CONFIG.emoteFrameCount
                    : pose.animation === 'walk'
                    ? COLONIST_SPRITE_CONFIG.walkFrameCount
                    : pose.animation === 'gather'
                        ? COLONIST_SPRITE_CONFIG.gatherFrameCount
                        : pose.animation === 'fight'
                            ? COLONIST_SPRITE_CONFIG.fightFrameCount
                        : pose.animation === 'jump'
                            ? COLONIST_SPRITE_CONFIG.jumpFrameCount
                        : pose.animation === 'idleStand'
                            ? COLONIST_SPRITE_CONFIG.idleStandFrameCount
                            : 1;
            const frame = pose.frame % frameCount;
            const sx = frame * COLONIST_SPRITE_CONFIG.frameWidth;
            const sy = row * COLONIST_SPRITE_CONFIG.frameHeight;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
            ctx.beginPath();
            ctx.ellipse(colonist.x, colonist.y + 11, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.drawImage(
                this.colonistSprite,
                sx,
                sy,
                COLONIST_SPRITE_CONFIG.frameWidth,
                COLONIST_SPRITE_CONFIG.frameHeight,
                colonist.x - COLONIST_SPRITE_CONFIG.drawWidth * 0.5,
                colonist.y - COLONIST_SPRITE_CONFIG.drawHeight * 0.72,
                COLONIST_SPRITE_CONFIG.drawWidth,
                COLONIST_SPRITE_CONFIG.drawHeight
            );
            return true;
        }

        drawDeadColonist(ctx, colonist) {
            ctx.fillStyle = 'rgba(55, 20, 16, 0.32)';
            ctx.beginPath();
            ctx.ellipse(colonist.x, colonist.y + 12, 11, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#6d322c';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(colonist.x - 7, colonist.y + 4);
            ctx.lineTo(colonist.x + 7, colonist.y - 4);
            ctx.stroke();

            ctx.strokeStyle = '#e6d0bf';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(colonist.x - 5, colonist.y + 5);
            ctx.lineTo(colonist.x + 5, colonist.y - 3);
            ctx.stroke();

            ctx.fillStyle = 'rgba(168, 34, 26, 0.45)';
            ctx.beginPath();
            ctx.arc(colonist.x + 6, colonist.y + 5, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        drawColonistBattleState(ctx, colonist) {
            if (colonist.woundSeverity > 0.08) {
                const alpha = Math.min(0.85, 0.18 + colonist.woundSeverity * 0.65);
                ctx.strokeStyle = `rgba(166, 34, 28, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(colonist.x - 6, colonist.y - 5);
                ctx.lineTo(colonist.x + 1, colonist.y + 3);
                ctx.moveTo(colonist.x + 1, colonist.y - 6);
                ctx.lineTo(colonist.x + 6, colonist.y - 1);
                ctx.stroke();

                if (colonist.woundCount > 1) {
                    ctx.fillStyle = `rgba(255, 233, 206, ${Math.min(0.9, 0.22 + colonist.woundSeverity * 0.45)})`;
                    ctx.fillRect(colonist.x - 7, colonist.y + 4, 5, 3);
                }
            }

            if (colonist.lastBattleHitTtl > 0) {
                const pulse = 0.25 + Math.min(0.55, colonist.lastBattleHitTtl * 0.1);
                ctx.strokeStyle = `rgba(222, 54, 44, ${pulse})`;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(colonist.x, colonist.y, 15, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (colonist.assignedBattlefrontId && colonist.battleRole) {
                ctx.fillStyle = 'rgba(43, 27, 18, 0.88)';
                ctx.beginPath();
                ctx.arc(colonist.x, colonist.y - 14, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#f6dfc4';
                ctx.font = 'bold 7px Georgia';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(colonist.battleRole === 'frontline' ? 'F' : colonist.battleRole === 'support' ? 'S' : 'R', colonist.x, colonist.y - 13.5);
                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
            }
        }

        drawIntentBubble(ctx, colonist) {
            const symbol = this.getIntentSymbol(colonist);
            if (!symbol) {
                return;
            }
            const bubbleX = colonist.x + 13;
            const bubbleY = colonist.y - 16;
            ctx.fillStyle = 'rgba(255, 248, 226, 0.96)';
            ctx.beginPath();
            ctx.arc(bubbleX, bubbleY, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a3a25';
            ctx.font = 'bold 8px Georgia';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(symbol, bubbleX, bubbleY + 0.5);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }

                getIntentSymbol(colonist) {
            const map = {
                drink: '💧',
                haulWater: '🪣',
                eat: '🥗',
                forage: '🌱',
                hunt: '🏹',
                war: '⚔️',
                warm: '🥰',
                sleep: '💤',
                tend: '🩺',
                gatherWood: '🌲',
                gatherStone: '🪨',
                protect: '🛡️',
                flee: '🏃',
                craft: '🔨',
                process: '⚙️',
                repair: '🔧',
                plant: '🌱'
            };
            return map[colonist.intent] || null;
        }

        drawColonistGear(ctx, colonist) {
            const x = colonist.x;
            const y = colonist.y;
            if (colonist.carrying?.type) {
                this.drawCarriedBundle(ctx, colonist.carrying.type, x - 13, y + 5);
            }
            if (colonist.equipment.wood?.type === 'axe') {
                this.drawAxe(ctx, x + 11, y + 2, colonist.equipment.wood);
            }
            if (colonist.equipment.building?.type === 'hammer') {
                this.drawHammer(ctx, x + 10, y - 2, colonist.equipment.building);
            }
            if (colonist.equipment.hunting?.type === 'spear') {
                this.drawSpear(ctx, x + 12, y + 1, colonist.equipment.hunting);
            }
            if (colonist.equipment.farming?.type === 'hoe') {
                this.drawHoe(ctx, x - 11, y + 1, colonist.equipment.farming);
            }
            if (colonist.equipment.hauling?.type === 'basket') {
                this.drawBasket(ctx, x - 12, y + 8, colonist.equipment.hauling);
            }
            if (colonist.equipment.clothing?.type === 'simpleClothing') {
                const clothing = colonist.equipment.clothing;
                const clothingColor = clothing.tier === 'fine'
                    ? '#d4d9dd'
                    : clothing.tier === 'standard'
                        ? '#c9a86a'
                        : '#b69b6c';
                ctx.strokeStyle = clothingColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y + 3, 6, 0.2, Math.PI - 0.2);
                ctx.stroke();
                if (clothing.tier !== 'crude') {
                    ctx.strokeStyle = 'rgba(72, 54, 34, 0.6)';
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.arc(x, y + 3.2, 4.5, 0.3, Math.PI - 0.3);
                    ctx.stroke();
                }
            }
        }

        getGearPalette(item) {
            const tier = item?.tier || 'crude';
            if (tier === 'fine') {
                return {
                    shaft: '#6f4b30',
                    head: '#cfd6de',
                    trim: '#d7dde3',
                    basket: '#b18a54'
                };
            }
            if (tier === 'standard') {
                return {
                    shaft: '#84552f',
                    head: '#c6a86b',
                    trim: '#c2ab71',
                    basket: '#a37a44'
                };
            }
            return {
                shaft: '#8c5b34',
                head: '#b8aba0',
                trim: '#a89a7a',
                basket: '#9c7447'
            };
        }

        drawCarriedBundle(ctx, type, x, y) {
            if (type === 'food') {
                ctx.fillStyle = '#d85d4f';
                ctx.fillRect(x - 3, y - 3, 6, 6);
                return;
            }
            if (type === 'water') {
                ctx.fillStyle = '#6ebddd';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                return;
            }
            if (type === 'wood') {
                ctx.strokeStyle = '#8c5b34';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x - 4, y + 2);
                ctx.lineTo(x + 4, y - 2);
                ctx.stroke();
                return;
            }
            if (type === 'stone') {
                ctx.fillStyle = '#b7aa99';
                ctx.beginPath();
                ctx.moveTo(x - 4, y + 2);
                ctx.lineTo(x - 1, y - 4);
                ctx.lineTo(x + 4, y - 1);
                ctx.lineTo(x + 2, y + 3);
                ctx.closePath();
                ctx.fill();
                return;
            }
            if (type === 'fiber') {
                ctx.strokeStyle = '#bfd17b';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(x - 4, y + 2);
                ctx.lineTo(x, y - 4);
                ctx.lineTo(x + 4, y + 1);
                ctx.stroke();
                return;
            }
            if (type === 'planks' || type === 'logs') {
                ctx.strokeStyle = '#8c5b34';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x - 4, y - 2);
                ctx.lineTo(x + 4, y - 2);
                ctx.moveTo(x - 4, y + 2);
                ctx.lineTo(x + 4, y + 2);
                ctx.stroke();
            }
        }

        drawAxe(ctx, x, y, item) {
            const palette = this.getGearPalette(item);
            ctx.strokeStyle = palette.shaft;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 2, y + 4);
            ctx.lineTo(x + 3, y - 5);
            ctx.stroke();
            ctx.fillStyle = palette.head;
            ctx.fillRect(x + 1, y - 5, 5, 4);
        }

        drawHammer(ctx, x, y, item) {
            const palette = this.getGearPalette(item);
            ctx.strokeStyle = palette.shaft;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y + 5);
            ctx.lineTo(x, y - 4);
            ctx.stroke();
            ctx.fillStyle = palette.head;
            ctx.fillRect(x - 4, y - 5, 8, 3);
        }

        drawSpear(ctx, x, y, item) {
            const palette = this.getGearPalette(item);
            ctx.strokeStyle = palette.shaft;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 5, y + 5);
            ctx.lineTo(x + 5, y - 5);
            ctx.stroke();
            ctx.fillStyle = palette.trim;
            ctx.beginPath();
            ctx.moveTo(x + 5, y - 5);
            ctx.lineTo(x + 8, y - 8);
            ctx.lineTo(x + 6, y - 2);
            ctx.closePath();
            ctx.fill();
        }

        drawHoe(ctx, x, y, item) {
            const palette = this.getGearPalette(item);
            ctx.strokeStyle = palette.shaft;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 1, y + 5);
            ctx.lineTo(x + 3, y - 5);
            ctx.stroke();
            ctx.strokeStyle = palette.trim;
            ctx.beginPath();
            ctx.moveTo(x + 3, y - 5);
            ctx.lineTo(x + 7, y - 3);
            ctx.stroke();
        }

        drawBasket(ctx, x, y, item) {
            const palette = this.getGearPalette(item);
            ctx.fillStyle = palette.basket;
            ctx.beginPath();
            ctx.ellipse(x, y, 5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = palette.shaft;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, y - 1, 4, Math.PI, 0);
            ctx.stroke();
        }

        drawWeather(ctx) {
            const weather = this.world.getWeather().name;
            const zoomOut = this.getZoomOutFactor();
            if (weather === 'Cloudy' || weather === 'Rain' || weather === 'Storm') {
                const cloudAlpha = weather === 'Storm'
                    ? 0.16 + zoomOut * 0.18
                    : weather === 'Rain'
                        ? 0.13 + zoomOut * 0.16
                        : 0.1 + zoomOut * 0.22;
                const cloudCount = Math.round((weather === 'Cloudy' ? 12 : 10) + zoomOut * (weather === 'Cloudy' ? 34 : 20));
                const cloudColor = weather === 'Storm'
                    ? `rgba(91, 104, 122, ${cloudAlpha})`
                    : weather === 'Rain'
                        ? `rgba(146, 161, 176, ${cloudAlpha})`
                        : `rgba(184, 196, 206, ${cloudAlpha})`;
                ctx.fillStyle = cloudColor;
                for (let i = 0; i < cloudCount; i++) {
                    const baseX = (i * 173 + this.world.elapsed * (weather === 'Cloudy' ? 7 : 12)) % (WORLD_WIDTH + 220) - 110;
                    const baseY = 40 + ((i * 97) % Math.max(120, WORLD_HEIGHT - 160));
                    const width = 120 + (i % 5) * 22 + zoomOut * 90;
                    const height = 38 + (i % 3) * 10 + zoomOut * 20;
                    ctx.beginPath();
                    ctx.ellipse(baseX, baseY, width * 0.34, height * 0.26, 0, 0, Math.PI * 2);
                    ctx.ellipse(baseX + width * 0.18, baseY - 8, width * 0.26, height * 0.24, 0, 0, Math.PI * 2);
                    ctx.ellipse(baseX - width * 0.2, baseY + 4, width * 0.22, height * 0.2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            if (weather === 'Rain' || weather === 'Storm') {
                ctx.strokeStyle = weather === 'Storm' ? 'rgba(170, 205, 255, 0.4)' : 'rgba(190, 226, 255, 0.3)';
                ctx.lineWidth = weather === 'Storm' ? 2 : 1.2;
                const dropCount = weather === 'Storm' ? 180 : 135;
                for (let i = 0; i < dropCount; i++) {
                    const x = (i * 97 + this.world.elapsed * (weather === 'Storm' ? 260 : 180)) % WORLD_WIDTH;
                    const y = (i * 57 + this.world.elapsed * (weather === 'Storm' ? 340 : 260)) % WORLD_HEIGHT;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x - (weather === 'Storm' ? 8 : 6), y + (weather === 'Storm' ? 18 : 14));
                    ctx.stroke();
                }
                ctx.fillStyle = weather === 'Storm' ? 'rgba(180, 218, 255, 0.22)' : 'rgba(190, 228, 255, 0.16)';
                for (let i = 0; i < 42; i++) {
                    const x = (i * 151 + this.world.elapsed * 110) % WORLD_WIDTH;
                    const y = (i * 89 + this.world.elapsed * 130) % WORLD_HEIGHT;
                    ctx.beginPath();
                    ctx.ellipse(x, y, 4 + (i % 3), 1.6 + (i % 2), 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (weather === 'Cold Snap') {
                ctx.fillStyle = 'rgba(230, 244, 255, 0.2)';
                for (let i = 0; i < 80; i++) {
                    const x = (i * 71 + this.world.elapsed * 42) % WORLD_WIDTH;
                    const y = (i * 63 + this.world.elapsed * 28) % WORLD_HEIGHT;
                    ctx.fillRect(x, y, 2, 2);
                }
            } else if (weather === 'Drought') {
                ctx.strokeStyle = 'rgba(154, 107, 42, 0.26)';
                for (let i = 0; i < 12; i++) {
                    const x = 110 + ((i * 173) % (WORLD_WIDTH - 220));
                    const y = 100 + ((i * 137) % (WORLD_HEIGHT - 200));
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + 12, y + 24);
                    ctx.lineTo(x + 6, y + 16);
                    ctx.stroke();
                }
                ctx.fillStyle = 'rgba(224, 181, 104, 0.08)';
                for (let i = 0; i < 18; i++) {
                    const x = (i * 143 + this.world.elapsed * 24) % WORLD_WIDTH;
                    const y = (i * 81 + this.world.elapsed * 18) % WORLD_HEIGHT;
                    ctx.fillRect(x, y, 28 + (i % 4) * 7, 2);
                }
            }
        }

        drawLighting(ctx) {
            const lightLevel = this.world.getLightLevel();
            const darkness = clamp(1 - lightLevel, 0, 0.78);
            if (darkness > 0.02) {
                ctx.fillStyle = `rgba(9, 16, 34, ${darkness})`;
                ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
            }

            const weatherColor = this.world.getWeather().color;
            if (weatherColor) {
                ctx.fillStyle = weatherColor;
                ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
            }

            if (this.world.camp.fireFuel > 0) {
                const glow = ctx.createRadialGradient(
                    this.world.camp.x,
                    this.world.camp.y + 10,
                    0,
                    this.world.camp.x,
                    this.world.camp.y + 10,
                    110
                );
                glow.addColorStop(0, 'rgba(255, 215, 126, 0.32)');
                glow.addColorStop(1, 'rgba(255, 215, 126, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(this.world.camp.x, this.world.camp.y + 10, 110, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    PhaseOneSim.PhaseOneRenderer = PhaseOneRenderer;
})();
