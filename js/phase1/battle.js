(function () {
    const PhaseOneSim = window.PhaseOneSim || (window.PhaseOneSim = {});
    const clamp = PhaseOneSim.clamp || ((value, min, max) => Math.max(min, Math.min(max, value)));

    function distance(a, b) {
        return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
    }

    function titleCase(text) {
        return String(text || '')
            .split(' ')
            .filter(Boolean)
            .map((part) => part[0].toUpperCase() + part.slice(1))
            .join(' ');
    }

    function normalizeVector(dx, dy) {
        const length = Math.hypot(dx, dy) || 1;
        return { x: dx / length, y: dy / length };
    }

    function cloneIds(list) {
        return Array.isArray(list) ? list.slice() : [];
    }

    function clamp01(value) {
        return clamp(value, 0, 1);
    }

    class PhaseOneBattleManager {
        constructor(world) {
            this.world = world;
            this.reportCounter = 0;
            this.combatantCounter = 0;
        }

        spawnBattlefront(colony, options = {}) {
            const target = options.target || this.world.camp;
            if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
                return null;
            }

            const scale = clamp(options.scale || 0.35, 0.2, 1);
            const approach = this.buildApproachGeometry(target, options);
            const tactics = this.pickBattleTactics(colony, options);
            const battlePoint = options.mode === 'inbound'
                ? approach.defenderAnchor
                : { x: target.x, y: target.y };
            const front = {
                id: `${colony.id}:battle:${this.world.elapsed.toFixed(2)}:${this.world.rng().toFixed(3)}`,
                colonyId: colony.id,
                colonyName: colony.name,
                mode: options.mode || 'inbound',
                x: battlePoint.x,
                y: battlePoint.y,
                scale,
                formation: approach,
                tactics,
                ttl: 12 + scale * 12,
                maxTtl: 12 + scale * 12,
                attackerHealth: 0,
                attackerMaxHealth: 0,
                defenderHealth: Math.max(8, options.defenderHealth || 14),
                defenderMaxHealth: Math.max(8, options.defenderHealth || 14),
                targetBuildingId: options.targetBuildingId || null,
                targetBuildingType: options.targetBuildingType || null,
                reportType: options.reportType || 'battle',
                resolved: false,
                outcome: 'active',
                damageFlash: 0,
                reinforcementPool: 0,
                attackerCasualties: 0,
                defenderCasualties: 0,
                noDefenderTime: 0,
                surpriseWindow: 2.8 + scale * 1.8,
                surpriseTriggered: false,
                breakthroughDamage: [],
                initialDefenderCount: options.initialDefenderCount || 0,
                initialAttackerCount: 0,
                mainAttackerIds: cloneIds(options.mainAttackerIds || []),
                attackers: [],
                defenders: [],
                targetColonyId: options.targetColonyId || null,
                targetColonyName: options.targetColonyName || null,
                defenderColonyId: options.defenderColonyId || null,
                defenderColonyName: options.defenderColonyName || null,
                factionUnitIds: cloneIds(options.factionUnitIds || []),
                defenderFactionUnitIds: cloneIds(options.defenderFactionUnitIds || []),
                createdDay: this.world.day,
                createdYear: this.world.year,
                status: options.status || 'warband',
                raidContext: options.raidContext ? { ...options.raidContext } : null,
                lastResolvedAt: 0,
                detailKeyMoments: [],
                supportAlliance: options.supportAlliance || null,
                commanders: this.buildCommanders(colony, options),
                orderState: {
                    attackers: 'press',
                    defenders: 'hold'
                },
                morale: {
                    attackers: 0.6,
                    defenders: 0.6
                },
                phase: 'muster',
                phaseTime: 0,
                musterTime: 3.6 + scale * 2.8,
                engageTime: 0,
                lineHoldTime: 1.8 + scale * 1.4,
                commandIssued: false
            };
            front.morale = this.buildFrontMorale(front, colony, options);
            front.orderState = this.buildOrderState(front);

            if (front.mode === 'outbound' || front.mode === 'intercolonial') {
                const defendingColony = front.mode === 'intercolonial' ? options.defenderColony || colony : colony;
                this.populateEnemyDefenders(front, defendingColony, options);
                if (front.mode === 'outbound') {
                    this.populateBorrowedSupportAttackers(front, options);
                }
                if (!front.targetBuildingType) {
                    const weakest = this.getColonyStructureTarget(defendingColony);
                    front.targetBuildingType = weakest?.key || null;
                }
                front.defenderHealth = this.getProxyHealth(this.getFrontDefenders(front));
                front.defenderMaxHealth = front.defenderHealth;
                front.initialDefenderCount = this.getFrontDefenders(front).length;
                front.attackerHealth = front.mode === 'outbound'
                    ? this.getMainAttackerHealth(front)
                    : this.getProxyHealth(this.getFrontAttackers(front));
                front.attackerMaxHealth = Math.max(front.attackerHealth, 8);
                front.initialAttackerCount = front.mode === 'outbound'
                    ? front.mainAttackerIds.length + this.getFrontAttackers(front).length
                    : this.getFrontAttackers(front).length;
            } else {
                this.populateAttackers(front, colony, options);
                front.attackerHealth = this.getProxyHealth(this.getFrontAttackers(front));
                front.attackerMaxHealth = front.attackerHealth;
                front.initialAttackerCount = this.getFrontAttackers(front).length;
            }

            this.world.battlefronts.push(front);
            this.world.battlefronts = this.world.battlefronts.slice(-8);
            return front;
        }

        launchMainColonyAttack(targetColony, colonists, options = {}) {
            if (!targetColony || !colonists?.length) {
                return null;
            }
            const target = {
                x: targetColony.x,
                y: targetColony.y
            };
            return this.spawnBattlefront(targetColony, {
                ...options,
                mode: 'outbound',
                target,
                targetColonyId: targetColony.id,
                targetColonyName: targetColony.name,
                mainAttackerIds: colonists.map((entry) => entry.id)
            });
        }

        launchIntercolonialAttack(attackerColony, defenderColony, options = {}) {
            if (!attackerColony || !defenderColony) {
                return null;
            }
            return this.spawnBattlefront(attackerColony, {
                ...options,
                mode: 'intercolonial',
                target: { x: defenderColony.x, y: defenderColony.y },
                targetColonyId: defenderColony.id,
                targetColonyName: defenderColony.name,
                defenderColony: defenderColony,
                defenderColonyId: defenderColony.id,
                defenderColonyName: defenderColony.name,
                colonySource: attackerColony
            });
        }

        buildApproachGeometry(target, options = {}) {
            const camp = this.world.camp;
            const source = options.colonySource || camp;
            const towardTarget = normalizeVector(target.x - source.x, target.y - source.y);
            const tacticBias = options.scale || 0.35;
            const depth = 70 + tacticBias * 58;
            const width = 32 + tacticBias * 32;
            const stageX = target.x - towardTarget.x * depth;
            const stageY = target.y - towardTarget.y * depth;
            const lineX = target.x - towardTarget.x * (26 + tacticBias * 18);
            const lineY = target.y - towardTarget.y * (26 + tacticBias * 18);
            const defenderMusterDepth = 28 + tacticBias * 24;
            return {
                attackerOrigin: { x: stageX, y: stageY },
                defenderOrigin: {
                    x: lineX + towardTarget.x * defenderMusterDepth,
                    y: lineY + towardTarget.y * defenderMusterDepth
                },
                attackerSpawnOrigin: {
                    x: stageX - towardTarget.x * (18 + tacticBias * 16),
                    y: stageY - towardTarget.y * (18 + tacticBias * 16)
                },
                defenderAnchor: { x: lineX, y: lineY },
                advanceVector: { x: towardTarget.x, y: towardTarget.y },
                flankVector: { x: -towardTarget.y, y: towardTarget.x },
                width,
                depth
            };
        }

        buildCommanders(colony, options = {}) {
            const colonyCommander = colony.army?.commander || {
                name: colony.commanderName || `${colony.name} watch captain`,
                style: 'balanced',
                aggression: 0.5,
                discipline: 0.5,
                caution: 0.5
            };
            const defaultDefenderCommander = options.defenderColony?.army?.commander || {
                name: options.defenderColony?.commanderName || options.defenderColonyName || 'Frontier war leader',
                style: 'balanced',
                aggression: 0.5,
                discipline: 0.55,
                caution: 0.35
            };
            const campCommander = options.defenderCommander || defaultDefenderCommander || {
                name: 'Camp war leader',
                style: 'balanced',
                aggression: 0.5,
                discipline: 0.55,
                caution: 0.35
            };
            return {
                attackers: { ...(options.mode === 'outbound' ? options.commander || campCommander : colonyCommander) },
                defenders: { ...(options.mode === 'outbound' ? colonyCommander : campCommander) }
            };
        }

        buildFrontMorale(front, colony, options = {}) {
            const defenderArmy = (options.defenderColony?.army) || colony.army || { morale: 0.55 };
            const attackerMorale = front.mode === 'outbound'
                ? clamp01(0.52 + (options.commander?.discipline || 0.5) * 0.18 + front.scale * 0.08)
                : clamp01(0.46 + defenderArmy.morale * 0.44 + (front.commanders.attackers.discipline || 0.5) * 0.08);
            const defenderMorale = front.mode === 'outbound' || front.mode === 'intercolonial'
                ? clamp01(0.42 + defenderArmy.morale * 0.44 + (front.commanders.defenders.caution || 0.4) * 0.08)
                : clamp01(0.5 + (this.world.getCampDefenseSummary()?.trainedDefenders || 0) * 0.02);
            return {
                attackers: attackerMorale,
                defenders: defenderMorale
            };
        }

        buildOrderState(front) {
            const attackers = front.commanders.attackers;
            const defenders = front.commanders.defenders;
            const attackerOrder = attackers.aggression > 0.72
                ? 'press'
                : attackers.caution > 0.62
                    ? 'probe'
                    : 'advance';
            const defenderOrder = defenders.caution > 0.68
                ? 'fallback'
                : defenders.discipline > 0.62
                    ? 'hold'
                    : 'screen';
            return {
                attackers: attackerOrder,
                defenders: defenderOrder
            };
        }

        pickBattleTactics(colony, options = {}) {
            const commander = options.mode === 'outbound'
                ? options.commander || { aggression: 0.5, discipline: 0.5, caution: 0.4, style: 'balanced' }
                : colony.army?.commander || { aggression: 0.5, discipline: 0.5, caution: 0.4, style: 'balanced' };
            const military = colony.factionIdentity?.militaryTendency || 0.5;
            const fear = colony.factionIdentity?.fear || 0.3;
            const scale = options.scale || 0.35;
            let attacker = 'probe';
            if (scale > 0.72 && (military > 0.7 || commander.style === 'aggressive')) {
                attacker = 'wedge';
            } else if ((fear < 0.22 && military > 0.62) || commander.aggression > 0.7) {
                attacker = 'flank';
            } else if (military > 0.5 || commander.style === 'balanced') {
                attacker = 'rush';
            }

            const defense = options.defenderColony
                ? this.world.getFactionDefenseSummary(options.defenderColony)
                : this.world.getCampDefenseSummary ? this.world.getCampDefenseSummary() : { trainedDefenders: 0, militia: 0 };
            const defenderCommander = options.defenderColony?.army?.commander || colony.army?.commander || { caution: 0.4, discipline: 0.5 };
            let defender = 'hold';
            if ((defense.trainedDefenders || 0) >= 3 && scale > 0.48 && defenderCommander.discipline > 0.52) {
                defender = 'shield';
            } else if (((defense.militia || 0) >= 7 && scale < 0.44) || defenderCommander.caution > 0.7) {
                defender = 'screen';
            } else if ((defense.trainedDefenders || 0) >= 2 && (military < 0.45 || defenderCommander.style === 'aggressive')) {
                defender = 'counter';
            }
            const attackerFormation = scale > 0.7 && commander.discipline > 0.58
                ? 'stacked-lines'
                : attacker === 'wedge'
                    ? 'vanguard-wedge'
                    : attacker === 'flank'
                        ? 'encircle'
                        : commander.caution > 0.62
                            ? 'screen-line'
                            : 'line';
            const defenderFormation = defender === 'shield'
                ? 'stacked-lines'
                : defender === 'screen'
                    ? 'screen-line'
                    : defender === 'counter'
                        ? 'checker'
                        : defenderCommander.caution > 0.7
                            ? 'crescent'
                            : 'line';
            return { attacker, defender, attackerFormation, defenderFormation };
        }

        getFormationOffsets(formationType, role, row, column, columns, lateralOffset, depthOffset) {
            let lateral = lateralOffset;
            let depth = depthOffset;
            switch (formationType) {
                case 'vanguard-wedge':
                    lateral *= 0.58 + row * 0.22;
                    depth += Math.abs(column - (columns - 1) * 0.5) * 2.2;
                    break;
                case 'encircle':
                    lateral *= role === 'frontline' ? 1.18 : 1.72;
                    depth += role === 'support' ? 3 : role === 'reserve' ? 7 : 0;
                    break;
                case 'stacked-lines':
                    lateral *= 0.86;
                    depth += row * 3.8;
                    break;
                case 'screen-line':
                    lateral *= 1.24;
                    depth -= role === 'frontline' ? 3.2 : 0;
                    break;
                case 'crescent':
                    depth += Math.abs(column - (columns - 1) * 0.5) * 1.8;
                    lateral *= 1.08;
                    break;
                case 'checker':
                    lateral += (row % 2 === 0 ? -1 : 1) * 3.6;
                    depth += (column % 2 === 0 ? 0 : 2.6);
                    break;
                default:
                    break;
            }
            return { lateral, depth };
        }

        getFormationMatchupModifier(front, side, role = 'frontline') {
            const attackerFormation = front.tactics?.attackerFormation || 'line';
            const defenderFormation = front.tactics?.defenderFormation || 'line';
            const pairs = {
                'vanguard-wedge:stacked-lines': side === 'attackers' && role === 'frontline' ? 1.08 : 0.96,
                'encircle:screen-line': side === 'attackers' && role !== 'frontline' ? 1.1 : 0.95,
                'stacked-lines:checker': side === 'defenders' ? 1.08 : 0.96,
                'screen-line:vanguard-wedge': side === 'defenders' && role === 'frontline' ? 1.08 : 0.96,
                'crescent:encircle': side === 'defenders' ? 1.06 : 0.97
            };
            return pairs[`${attackerFormation}:${defenderFormation}`] || 1;
        }

        populateAttackers(front, colony, options) {
            const attackerHealthBudget = Math.max(10, options.attackerHealth || 14);
            const armyAvailable = colony.army?.available || colony.population || 4;
            const unitCount = Math.max(
                3,
                Math.min(
                    12,
                    Math.round((options.strength || armyAvailable) * (0.55 + front.scale * 0.4))
                )
            );
            const formation = front.formation;
            const columns = Math.max(2, Math.ceil(Math.sqrt(unitCount)));
            for (let i = 0; i < unitCount; i += 1) {
                const row = Math.floor(i / columns);
                const column = i % columns;
                const baseLateralOffset = (column - (columns - 1) * 0.5) * (8 + front.scale * 4);
                const baseDepthOffset = row * (8 + front.scale * 4);
                const role = row === 0 ? 'frontline' : row === 1 ? 'support' : 'reserve';
                const { lateral: lateralOffset, depth: depthOffset } = this.getFormationOffsets(
                    front.tactics.attackerFormation,
                    role,
                    row,
                    column,
                    columns,
                    baseLateralOffset,
                    baseDepthOffset
                );
                const tacticOffset = front.tactics.attacker === 'flank'
                    ? lateralOffset * (1.45 + row * 0.08)
                    : front.tactics.attacker === 'wedge'
                        ? lateralOffset * (0.65 + row * 0.18)
                        : lateralOffset;
                const spawnOrigin = formation.attackerSpawnOrigin || formation.attackerOrigin;
                const startX = spawnOrigin.x +
                    formation.flankVector.x * tacticOffset -
                    formation.advanceVector.x * depthOffset;
                const startY = spawnOrigin.y +
                    formation.flankVector.y * tacticOffset -
                    formation.advanceVector.y * depthOffset;
                const veteranBonus = (colony.army?.veterans || 0) / Math.max(1, unitCount) * 0.22;
                const hp = attackerHealthBudget / unitCount * (0.8 + this.world.rng() * 0.45 + veteranBonus);
                const unitData = {
                    id: `atk-${++this.combatantCounter}`,
                    colonyId: colony.id,
                    colonyName: colony.name,
                    battlefrontId: front.id,
                    side: 'attackers',
                    x: startX,
                    y: startY,
                    vx: 0,
                    vy: 0,
                    hp: Math.max(2.5, hp),
                    maxHp: Math.max(2.5, hp),
                    speed: 17 + this.world.rng() * 8 + front.scale * 6 + (front.commanders.attackers.discipline || 0.5) * 2.2,
                    damage: 2 + front.scale * 1.6 + this.world.rng() * 1.1 + (front.commanders.attackers.aggression || 0.5) * 0.55,
                    attackCooldown: this.world.rng() * 0.6,
                    targetColonistId: null,
                    alive: true,
                    posture: 'advance',
                    formationRow: row,
                    formationColumn: column,
                    role
                };
                if (front.mode !== 'outbound') {
                    const unit = this.world.createFactionUnit(unitData);
                    front.factionUnitIds.push(unit.id);
                } else {
                    front.attackers.push(unitData);
                }
            }
        }

        populateEnemyDefenders(front, colony, options) {
            const healthBudget = Math.max(10, options.defenderHealth || 14);
            const unitCount = Math.max(2, Math.min(10, Math.round(((colony.army?.available || colony.population || 4)) * (0.5 + front.scale * 0.35))));
            const columns = Math.max(2, Math.ceil(Math.sqrt(unitCount)));
            for (let i = 0; i < unitCount; i += 1) {
                const row = Math.floor(i / columns);
                const column = i % columns;
                const baseLateralOffset = (column - (columns - 1) * 0.5) * (8 + front.scale * 4);
                const baseDepthOffset = row * (8 + front.scale * 4);
                const role = row === 0 ? 'frontline' : row === 1 ? 'support' : 'reserve';
                const { lateral: lateralOffset, depth: depthOffset } = this.getFormationOffsets(
                    front.tactics.defenderFormation,
                    role,
                    row,
                    column,
                    columns,
                    baseLateralOffset,
                    baseDepthOffset
                );
                const defenderSpawn = {
                    x: Number.isFinite(colony?.x) ? colony.x : front.formation.defenderOrigin.x,
                    y: Number.isFinite(colony?.y) ? colony.y : front.formation.defenderOrigin.y
                };
                const startX = defenderSpawn.x +
                    front.formation.flankVector.x * lateralOffset +
                    front.formation.advanceVector.x * depthOffset;
                const startY = defenderSpawn.y +
                    front.formation.flankVector.y * lateralOffset +
                    front.formation.advanceVector.y * depthOffset;
                const veteranBonus = (colony.army?.veterans || 0) / Math.max(1, unitCount) * 0.2;
                const hp = healthBudget / unitCount * (0.82 + this.world.rng() * 0.38 + veteranBonus);
                const unitData = {
                    id: `def-${++this.combatantCounter}`,
                    colonyId: colony.id,
                    colonyName: colony.name,
                    battlefrontId: front.id,
                    side: 'defenders',
                    x: startX,
                    y: startY,
                    vx: 0,
                    vy: 0,
                    hp: Math.max(2.4, hp),
                    maxHp: Math.max(2.4, hp),
                    speed: 16 + this.world.rng() * 7 + front.scale * 5 + (front.commanders.defenders.discipline || 0.5) * 1.8,
                    damage: 2 + front.scale * 1.3 + this.world.rng() * 1 + (front.commanders.defenders.aggression || 0.5) * 0.4,
                    attackCooldown: this.world.rng() * 0.55,
                    alive: true,
                    posture: 'holding',
                    formationRow: row,
                    formationColumn: column,
                    role
                };
                if (front.mode === 'outbound' || front.mode === 'intercolonial') {
                    const unit = this.world.createFactionUnit(unitData);
                    front.defenderFactionUnitIds.push(unit.id);
                } else {
                    front.defenders.push(unitData);
                }
            }
        }

        populateBorrowedSupportAttackers(front, options = {}) {
            const borrowed = Array.isArray(options.borrowedSupportColonies) ? options.borrowedSupportColonies : [];
            if (!borrowed.length) {
                return;
            }
            let offsetIndex = 0;
            for (const support of borrowed) {
                const unitCount = Math.max(1, Math.min(4, Math.round(support.available || 1)));
                const columns = Math.max(1, Math.ceil(Math.sqrt(unitCount)));
                for (let i = 0; i < unitCount; i += 1) {
                    const row = Math.floor(i / columns);
                    const column = i % columns;
                    const lateralOffset = (column - (columns - 1) * 0.5) * (8 + front.scale * 4);
                    const depthOffset = row * (8 + front.scale * 4) + 16 + offsetIndex * 8;
                    const spawnOrigin = front.formation.attackerSpawnOrigin || front.formation.attackerOrigin;
                    const startX = spawnOrigin.x +
                        front.formation.flankVector.x * lateralOffset -
                        front.formation.advanceVector.x * depthOffset;
                    const startY = spawnOrigin.y +
                        front.formation.flankVector.y * lateralOffset -
                        front.formation.advanceVector.y * depthOffset;
                    const commander = support.commander || { aggression: 0.5, discipline: 0.5 };
                    const hp = 3 + front.scale * 1.1 + this.world.rng() * 1;
                    const unit = this.world.createFactionUnit({
                        id: `ally-atk-${++this.combatantCounter}`,
                        colonyId: support.colonyId,
                        colonyName: support.colonyName,
                        battlefrontId: front.id,
                        side: 'attackers',
                        x: startX,
                        y: startY,
                        hp,
                        maxHp: hp,
                        speed: 16 + this.world.rng() * 6 + (commander.discipline || 0.5) * 2,
                        damage: 1.8 + front.scale * 1.2 + this.world.rng() * 0.8 + (commander.aggression || 0.5) * 0.45,
                        attackCooldown: this.world.rng() * 0.6,
                        alive: true,
                        posture: 'advance',
                        formationRow: row + 2 + offsetIndex,
                        formationColumn: column,
                        role: row === 0 ? 'support' : 'reserve'
                    });
                    front.factionUnitIds.push(unit.id);
                }
                offsetIndex += 1;
            }
        }

        getDefenderFallbackAnchor(front) {
            return {
                x: front.formation.defenderAnchor.x + front.formation.advanceVector.x * (16 + front.scale * 12),
                y: front.formation.defenderAnchor.y + front.formation.advanceVector.y * (16 + front.scale * 12)
            };
        }

        getContactAnchor(front) {
            const distanceFromDefenderAnchor = 7 + front.scale * 5;
            return {
                x: front.formation.defenderAnchor.x - front.formation.advanceVector.x * distanceFromDefenderAnchor,
                y: front.formation.defenderAnchor.y - front.formation.advanceVector.y * distanceFromDefenderAnchor
            };
        }

        getDefenderFormationDestination(front, unit) {
            const activeDefenders = Math.max(2, front.initialDefenderCount || this.getFrontDefenders(front).length || 2);
            const columns = Math.max(2, Math.ceil(Math.sqrt(activeDefenders)));
            const engageTightness = front.phase === 'engage' ? 0.62 : 1;
            const baseLateralOffset = (unit.formationColumn - (columns - 1) * 0.5) * (8 + front.scale * 4) * engageTightness;
            const baseDepthOffset = unit.formationRow * (8 + front.scale * 3) * (front.phase === 'engage' ? 0.72 : 1);
            const formationOffset = this.getFormationOffsets(
                front.tactics.defenderFormation,
                unit.role || 'frontline',
                unit.formationRow || 0,
                unit.formationColumn || 0,
                columns,
                baseLateralOffset,
                baseDepthOffset
            );
            const lateralOffset = formationOffset.lateral;
            const depthOffset = formationOffset.depth;
            const fallbackAnchor = this.getDefenderFallbackAnchor(front);
            let anchor = front.phase === 'muster'
                ? (front.formation.defenderOrigin || front.formation.defenderAnchor)
                : front.formation.defenderAnchor;
            let rolePush = depthOffset;
            if (front.phase === 'engage' && !['fallback', 'rally'].includes(front.orderState.defenders)) {
                anchor = this.getContactAnchor(front);
            }
            if (front.orderState.defenders === 'fallback') {
                anchor = fallbackAnchor;
                rolePush = depthOffset + 8;
            } else if (front.orderState.defenders === 'rally') {
                anchor = {
                    x: fallbackAnchor.x - front.formation.advanceVector.x * (6 + front.scale * 5),
                    y: fallbackAnchor.y - front.formation.advanceVector.y * (6 + front.scale * 5)
                };
                rolePush = depthOffset + (unit.role === 'reserve' ? 10 : 4);
            } else if (front.orderState.defenders === 'screen') {
                anchor = {
                    x: front.formation.defenderAnchor.x - front.formation.advanceVector.x * (10 + front.scale * 8),
                    y: front.formation.defenderAnchor.y - front.formation.advanceVector.y * (10 + front.scale * 8)
                };
                rolePush = depthOffset - (unit.role === 'frontline' ? 4 : 0);
            } else if (front.orderState.defenders === 'hold') {
                rolePush = depthOffset + (unit.role === 'reserve' ? 6 : 0);
            }
            return {
                x: anchor.x + front.formation.flankVector.x * lateralOffset + front.formation.advanceVector.x * rolePush,
                y: anchor.y + front.formation.flankVector.y * lateralOffset + front.formation.advanceVector.y * rolePush
            };
        }

        ensureInboundDefenderAssignments(front, defenders) {
            const sorted = defenders
                .slice()
                .sort((left, right) => {
                    const leftPriority = (left.skills.combat || 0) + (left.combatPower || 0) * 0.08 + (left.stats.health || 0) * 0.01;
                    const rightPriority = (right.skills.combat || 0) + (right.combatPower || 0) * 0.08 + (right.stats.health || 0) * 0.01;
                    return rightPriority - leftPriority;
                });
            const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(2, sorted.length))));
            sorted.forEach((colonist, index) => {
                colonist.assignedBattlefrontId = front.id;
                colonist.battleFormationIndex = index;
                colonist.battleRole = index < columns ? 'frontline' : index < columns * 2 ? 'support' : 'reserve';
                colonist.battleOrderTtl = Math.max(colonist.battleOrderTtl || 0, 10 + front.scale * 8);
                if (colonist.intent !== 'war' && colonist.intent !== 'protect') {
                    colonist.intent = 'war';
                }
            });
        }

        getNearbyDefenders(front, radius = 76) {
            const defenders = this.world.colonists.filter((colonist) =>
                colonist.alive &&
                colonist.lifeStage === 'adult' &&
                distance(colonist, front) <= radius &&
                (colonist.intent === 'war' || colonist.intent === 'protect')
            );
            this.ensureInboundDefenderAssignments(front, defenders);
            return defenders;
        }

        getProxyHealth(units) {
            return units.reduce((sum, attacker) => sum + Math.max(0, attacker.hp || 0), 0);
        }

        getFrontAttackers(front) {
            if (Array.isArray(front.factionUnitIds) && front.factionUnitIds.length > 0) {
                return front.factionUnitIds
                    .map((id) => this.world.getFactionUnitById(id))
                    .filter((unit) => unit && unit.alive && unit.hp > 0);
            }
            return (front.attackers || []).filter((attacker) => attacker.alive && attacker.hp > 0);
        }

        getFrontDefenders(front) {
            if ((front.mode === 'outbound' || front.mode === 'intercolonial') && Array.isArray(front.defenderFactionUnitIds) && front.defenderFactionUnitIds.length > 0) {
                return front.defenderFactionUnitIds
                    .map((id) => this.world.getFactionUnitById(id))
                    .filter((unit) => unit && unit.alive && unit.hp > 0);
            }
            return (front.defenders || []).filter((defender) => defender.alive && defender.hp > 0);
        }

        getAssignedColonists(front) {
            return this.world.colonists.filter((colonist) =>
                colonist.alive &&
                colonist.assignedBattlefrontId === front.id
            );
        }

        getMainAttackerHealth(front) {
            const colonistHealth = this.getAssignedColonists(front).reduce((sum, colonist) => sum + Math.max(0, colonist.stats.health), 0);
            const supportHealth = this.getFrontAttackers(front).reduce((sum, unit) => sum + Math.max(0, unit.hp || 0), 0);
            return colonistHealth + supportHealth;
        }

        getAssignedColonistFormationDestination(front, colonist) {
            const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(2, front.mainAttackerIds.length || this.getAssignedColonists(front).length || 2))));
            const index = Math.max(0, colonist.battleFormationIndex);
            const row = Math.floor(index / columns);
            const column = index % columns;
            const engageTightness = front.phase === 'engage' ? 0.68 : 1;
            const role = colonist.battleRole || (row === 0 ? 'frontline' : row === 1 ? 'support' : 'reserve');
            const formationOffset = this.getFormationOffsets(
                front.tactics.attackerFormation,
                role,
                row,
                column,
                columns,
                (column - (columns - 1) * 0.5) * (10 + front.scale * 5) * engageTightness,
                row * (10 + front.scale * 4) * (front.phase === 'engage' ? 0.75 : 1)
            );
            const lateralOffset = formationOffset.lateral;
            const depthOffset = formationOffset.depth;
            const anchor = front.phase === 'engage'
                ? this.getContactAnchor(front)
                : front.formation.attackerOrigin;
            return {
                x: anchor.x +
                    front.formation.flankVector.x * lateralOffset +
                    front.formation.advanceVector.x * depthOffset,
                y: anchor.y +
                    front.formation.flankVector.y * lateralOffset +
                    front.formation.advanceVector.y * depthOffset
            };
        }

        getBattleDestinationForColonist(front, colonist) {
            const index = Math.max(0, colonist.battleFormationIndex);
            if (front.mode !== 'outbound') {
                const activeDefenders = Math.max(2, front.initialDefenderCount || 2);
                const columns = Math.max(2, Math.ceil(Math.sqrt(activeDefenders)));
                const row = Math.floor(index / columns);
                const column = index % columns;
                const role = colonist.battleRole || (row === 0 ? 'frontline' : row === 1 ? 'support' : 'reserve');
                const formationOffset = this.getFormationOffsets(
                    front.tactics.defenderFormation,
                    role,
                    row,
                    column,
                    columns,
                    (column - (columns - 1) * 0.5) * (10 + front.scale * 5),
                    row * (9 + front.scale * 4)
                );
                const lateralOffset = formationOffset.lateral;
                const depthOffset = formationOffset.depth;
                const fallbackAnchor = this.getDefenderFallbackAnchor(front);
                let anchor = front.phase === 'muster'
                    ? (front.formation.defenderOrigin || front.formation.defenderAnchor)
                    : front.formation.defenderAnchor;
                if (front.orderState.defenders === 'fallback' || front.orderState.defenders === 'rally') {
                    anchor = fallbackAnchor;
                }
                const rolePush = colonist.battleRole === 'reserve' ? depthOffset + 8 : depthOffset;
                return {
                    x: anchor.x + front.formation.flankVector.x * lateralOffset + front.formation.advanceVector.x * rolePush,
                    y: anchor.y + front.formation.flankVector.y * lateralOffset + front.formation.advanceVector.y * rolePush
                };
            }
            return this.getAssignedColonistFormationDestination(front, colonist);
        }

        getColonistCombatTarget(front, colonist) {
            if (!front || front.resolved) {
                return null;
            }
            const enemyPool = front.mode === 'outbound'
                ? this.getFrontDefenders(front)
                : this.getFrontAttackers(front);
            const living = enemyPool
                .filter((unit) => this.canBreakFormationForTarget(front, colonist, unit))
                .filter((unit) => unit.alive && unit.hp > 0)
                .sort((left, right) => distance(colonist, left) - distance(colonist, right));
            return living[0] || null;
        }

        getColonistCombatDestination(front, colonist) {
            if (front?.phase !== 'engage') {
                return this.getBattleDestinationForColonist(front, colonist);
            }
            const target = this.getColonistCombatTarget(front, colonist);
            if (target) {
                return {
                    x: target.x,
                    y: target.y,
                    target
                };
            }
            return this.getBattleDestinationForColonist(front, colonist);
        }

        isHoldingOpeningLine(front) {
            return front?.phase === 'engage' && (front.engageTime || 0) < (front.lineHoldTime || 0);
        }

        getContactHoldRadius(front) {
            return 18 + front.scale * 10;
        }

        canBreakFormationForTarget(front, actor, target) {
            if (!front || !actor || !target || !this.isHoldingOpeningLine(front)) {
                return true;
            }
            const contact = this.getContactAnchor(front);
            const leash = this.getContactHoldRadius(front);
            return distance(target, contact) <= leash && distance(actor, contact) <= leash + 8;
        }

        update(dt) {
            const completed = [];

            for (let index = this.world.battleBursts.length - 1; index >= 0; index -= 1) {
                const burst = this.world.battleBursts[index];
                burst.ttl = Math.max(0, burst.ttl - dt);
                if (burst.ttl <= 0) {
                    this.world.battleBursts.splice(index, 1);
                    this.world.battleBurstPool?.release(burst);
                }
            }

            for (const front of this.world.battlefronts) {
                if (front.resolved) {
                    front.ttl = Math.max(0, front.ttl - dt * 1.6);
                    continue;
                }

                if (front.mode === 'outbound') {
                    this.updateOutboundFront(front, dt, completed);
                    continue;
                }
                if (front.mode === 'intercolonial') {
                    this.updateIntercolonialFront(front, dt, completed);
                    continue;
                }

                const defenders = this.getNearbyDefenders(front);
                front.initialDefenderCount = Math.max(front.initialDefenderCount || 0, defenders.length);
                front.damageFlash = Math.max(0, front.damageFlash - dt);
                front.surpriseWindow = Math.max(0, front.surpriseWindow - dt);
                this.updateOrderState(front);
                this.syncFactionUnitOrders(front);
                this.ensureFrontPhase(front, defenders, dt);
                if (front.phase === 'engage') {
                    front.engageTime = Math.max(0, (front.engageTime || 0) + dt);
                }

                const attackers = this.getFrontAttackers(front);
                for (const attacker of attackers) {
                    if (!attacker.alive || attacker.hp <= 0) {
                        attacker.alive = false;
                        continue;
                    }
                    attacker.attackCooldown = Math.max(0, attacker.attackCooldown - dt);
                    this.updateAttacker(front, attacker, defenders, dt);
                }

                const livingAttackers = attackers.filter((attacker) => attacker.alive && attacker.hp > 0);
                front.attackerHealth = this.getProxyHealth(attackers);
                front.attackerMaxHealth = Math.max(front.attackerMaxHealth, front.attackerHealth);

                const defenderStrength = defenders.reduce((sum, colonist) => {
                    const healthFactor = clamp(colonist.stats.health / 100, 0.1, 1);
                    return sum + (colonist.combatPower * 0.2 + colonist.skills.combat * 0.45 + 2.6) * healthFactor;
                }, 0);
                const defenderPool = Math.max(0, defenderStrength + (front.reinforcementPool || 0));
                front.noDefenderTime = defenders.length > 0 ? 0 : front.noDefenderTime + dt;
                if (!front.surpriseTriggered && defenders.length === 0 && front.surpriseWindow > 0) {
                    front.surpriseTriggered = true;
                    this.noteFrontMoment(front, 'The attackers caught the frontier line by surprise.');
                }
                front.defenderHealth = defenderPool;
                front.defenderMaxHealth = Math.max(front.defenderMaxHealth, defenderPool, 8);

                if (livingAttackers.length === 0 || front.attackerHealth <= 0 || front.orderState.attackers === 'rout') {
                    this.resolveFront(front, 'defenders', defenders);
                    completed.push(front);
                    continue;
                }

                front.ttl = Math.max(0, front.ttl - dt);
                if (front.ttl <= 0 || (front.defenderHealth <= 0 && front.noDefenderTime > 2.5) || front.orderState.defenders === 'rout') {
                    this.resolveFront(front, 'attackers', defenders);
                    completed.push(front);
                }
            }

            for (let index = this.world.battleScars.length - 1; index >= 0; index -= 1) {
                const scar = this.world.battleScars[index];
                scar.ttl = Math.max(0, scar.ttl - dt);
                if (scar.ttl <= 0) {
                    this.world.battleScars.splice(index, 1);
                    this.world.battleScarPool?.release(scar);
                }
            }
            this.world.battlefronts = this.world.battlefronts.filter((front) => front.ttl > 0);
            return completed;
        }

        updateOutboundFront(front, dt, completed) {
            const attackers = this.getAssignedColonists(front);
            const defenders = this.getFrontDefenders(front);
            const supportAttackers = this.getFrontAttackers(front);
            const combinedAttackers = attackers.concat(supportAttackers);
            front.initialAttackerCount = Math.max(front.initialAttackerCount || 0, combinedAttackers.length);
            front.damageFlash = Math.max(0, front.damageFlash - dt);
            this.updateOrderState(front);
            this.syncFactionUnitOrders(front);
            this.ensureFrontPhase(front, defenders, dt);
            if (front.phase === 'engage') {
                front.engageTime = Math.max(0, (front.engageTime || 0) + dt);
            }
            for (const defender of defenders) {
                if (!defender.alive || defender.hp <= 0) {
                    defender.alive = false;
                    continue;
                }
                defender.attackCooldown = Math.max(0, defender.attackCooldown - dt);
                this.updateProxyCombatant(front, defender, combinedAttackers, dt, 'defender');
            }
            for (const attacker of supportAttackers) {
                if (!attacker.alive || attacker.hp <= 0) {
                    attacker.alive = false;
                    continue;
                }
                attacker.attackCooldown = Math.max(0, attacker.attackCooldown - dt);
                this.updateProxyCombatant(front, attacker, defenders, dt, 'attacker');
            }

            front.attackerHealth = this.getMainAttackerHealth(front);
            front.attackerMaxHealth = Math.max(front.attackerMaxHealth, front.attackerHealth);
            front.defenderHealth = this.getProxyHealth(defenders);
            front.defenderMaxHealth = Math.max(front.defenderMaxHealth, front.defenderHealth);
            front.noDefenderTime = defenders.length > 0 ? 0 : front.noDefenderTime + dt;
            front.ttl = Math.max(0, front.ttl - dt);

            if (front.defenderHealth <= 0 || front.noDefenderTime > 1.8 || front.orderState.defenders === 'rout') {
                this.resolveFront(front, 'attackers', attackers);
                completed.push(front);
                return;
            }
            if (front.attackerHealth <= 0 || combinedAttackers.length === 0 || front.ttl <= 0 || front.orderState.attackers === 'rout') {
                this.resolveFront(front, 'defenders', attackers);
                completed.push(front);
            }
        }

        updateIntercolonialFront(front, dt, completed) {
            front.damageFlash = Math.max(0, front.damageFlash - dt);
            front.ttl = Math.max(0, front.ttl - dt);
            this.updateOrderState(front);
            this.syncFactionUnitOrders(front);
            const attackers = this.getFrontAttackers(front);
            const defenders = this.getFrontDefenders(front);
            this.ensureFrontPhase(front, defenders, dt);
            if (front.phase === 'engage') {
                front.engageTime = Math.max(0, (front.engageTime || 0) + dt);
            }
            for (const attacker of attackers) {
                if (!attacker.alive || attacker.hp <= 0) {
                    attacker.alive = false;
                    continue;
                }
                attacker.attackCooldown = Math.max(0, attacker.attackCooldown - dt);
                this.updateProxyCombatant(front, attacker, defenders, dt, 'attacker');
            }
            for (const defender of defenders) {
                if (!defender.alive || defender.hp <= 0) {
                    defender.alive = false;
                    continue;
                }
                defender.attackCooldown = Math.max(0, defender.attackCooldown - dt);
                this.updateProxyCombatant(front, defender, attackers, dt, 'defender');
            }

            front.attackerHealth = this.getProxyHealth(attackers);
            front.attackerMaxHealth = Math.max(front.attackerMaxHealth, front.attackerHealth);
            front.defenderHealth = this.getProxyHealth(defenders);
            front.defenderMaxHealth = Math.max(front.defenderMaxHealth, front.defenderHealth);
            front.noDefenderTime = defenders.filter((entry) => entry.alive && entry.hp > 0).length > 0 ? 0 : front.noDefenderTime + dt;

            if (front.defenderHealth <= 0 || front.noDefenderTime > 1.8 || front.orderState.defenders === 'rout') {
                this.resolveFront(front, 'attackers', defenders);
                completed.push(front);
                return;
            }
            if (front.attackerHealth <= 0 || attackers.filter((entry) => entry.alive && entry.hp > 0).length === 0 || front.ttl <= 0 || front.orderState.attackers === 'rout') {
                this.resolveFront(front, 'defenders', defenders);
                completed.push(front);
            }
        }

        updateOrderState(front) {
            const attackerLosses = front.initialAttackerCount > 0 ? front.attackerCasualties / Math.max(1, front.initialAttackerCount) : 0;
            const defenderLosses = front.initialDefenderCount > 0 ? front.defenderCasualties / Math.max(1, front.initialDefenderCount) : 0;
            front.morale.attackers = clamp01(front.morale.attackers - attackerLosses * 0.04 + defenderLosses * 0.012);
            front.morale.defenders = clamp01(front.morale.defenders - defenderLosses * 0.04 + attackerLosses * 0.014);
            front.orderState.attackers = front.morale.attackers < 0.18
                ? 'rout'
                : front.morale.attackers < 0.34
                    ? 'fallback'
                    : 'press';
            if (front.morale.defenders < 0.18) {
                front.orderState.defenders = 'rout';
            } else if (front.morale.defenders < 0.34) {
                front.orderState.defenders = 'fallback';
            } else if (front.orderState.defenders === 'fallback' && front.morale.defenders > 0.46) {
                front.orderState.defenders = 'rally';
            } else if (front.orderState.defenders === 'rally' && front.morale.defenders > 0.58) {
                front.orderState.defenders = 'hold';
            } else if (!['fallback', 'rally', 'rout'].includes(front.orderState.defenders)) {
                front.orderState.defenders = front.commanders.defenders.caution > 0.68 ? 'screen' : 'hold';
            }
            if (front.orderState.defenders === 'rally') {
                front.morale.defenders = clamp01(front.morale.defenders + 0.004 + (front.commanders.defenders.discipline || 0.5) * 0.006);
            }
        }

        getColonistEngageModifier(front, colonist) {
            let modifier = 1;
            if (front.mode !== 'outbound') {
                if (front.orderState.defenders === 'rally' && colonist.battleRole === 'frontline') {
                    modifier *= 1.08;
                } else if (front.orderState.defenders === 'fallback') {
                    modifier *= colonist.battleRole === 'reserve' ? 0.96 : 0.88;
                }
                if (front.tactics.defender === 'shield' && colonist.battleRole === 'frontline') {
                    modifier *= 1.08;
                }
            }
            modifier *= this.getFormationMatchupModifier(front, 'defenders', colonist.battleRole || 'frontline');
            return modifier;
        }

        updateAttacker(front, attacker, defenders, dt) {
            const target = front.phase === 'engage'
                ? this.pickAttackerTarget(front, attacker, defenders)
                : null;
            const destination = target || attacker.commandTarget || this.getAttackerOrderDestination(front, attacker);
            const dx = destination.x - attacker.x;
            const dy = destination.y - attacker.y;
            const len = Math.hypot(dx, dy) || 1;
            const speedBase = attacker.speed * (target ? 1 : 0.78);
            const speed = front.orderState.attackers === 'fallback'
                ? speedBase * 0.72
                : front.tactics.attacker === 'rush'
                ? speedBase * 1.18
                : front.tactics.attacker === 'wedge' && attacker.role === 'frontline'
                    ? speedBase * 1.12
                    : speedBase;
            attacker.vx = (dx / len) * speed;
            attacker.vy = (dy / len) * speed;
            attacker.x += attacker.vx * dt;
            attacker.y += attacker.vy * dt;
            attacker.posture = target
                ? 'engaged'
                : front.orderState.attackers === 'fallback'
                    ? 'fallback'
                    : distance(attacker, destination) < 10
                        ? 'holding'
                        : 'advance';

            if (target && distance(attacker, target) < 13 && attacker.attackCooldown <= 0) {
                const tacticBonus = front.tactics.attacker === 'wedge' && attacker.role === 'frontline'
                    ? 1.18
                    : front.tactics.attacker === 'flank' && attacker.role !== 'frontline'
                        ? 1.12
                        : 1;
                const formationBonus = this.getFormationMatchupModifier(front, 'attackers', attacker.role || 'frontline');
                const damage = attacker.damage * tacticBonus * formationBonus * (0.9 + this.world.rng() * 0.35);
                const wasAlive = target.alive;
                this.world.applyBattleHit(target, damage, front, front.colonyName);
                front.damageFlash = 0.9;
                attacker.attackCooldown = 0.45 + this.world.rng() * 0.28;
                if (wasAlive && !target.alive) {
                    front.defenderCasualties += 1;
                    this.noteFrontMoment(front, `${target.name} fell in the fighting.`);
                }
                return;
            }

            if (front.phase === 'engage' && !target && front.targetBuildingId && this.world.rng() < dt * 1.8) {
                const building = this.world.buildings.find((entry) => entry.id === front.targetBuildingId) || null;
                if (building && distance(attacker, building) < 18) {
                    building.integrity = clamp(building.integrity - (0.1 + front.scale * 0.14), 0, building.maxIntegrity);
                    this.world.spawnBattleBurst(
                        building.x + (this.world.rng() - 0.5) * 12,
                        building.y + (this.world.rng() - 0.5) * 12,
                        1.05,
                        'building'
                    );
                }
            }
        }

        updateProxyCombatant(front, unit, targets, dt, side) {
            const target = front.phase === 'engage'
                ? this.pickClosestColonist(front, unit, targets, 24 + front.scale * 18)
                : null;
            const fallback = side === 'defender'
                ? this.getDefenderFormationDestination(front, unit)
                : this.getAttackerOrderDestination(front, unit);
            const destination = target || unit.commandTarget || fallback;
            const dx = destination.x - unit.x;
            const dy = destination.y - unit.y;
            const len = Math.hypot(dx, dy) || 1;
            const retreating = side === 'defender' ? front.orderState.defenders === 'fallback' : front.orderState.attackers === 'fallback';
            const speed = unit.speed * (target ? 1 : retreating ? 0.95 : 0.72);
            unit.vx = (dx / len) * speed;
            unit.vy = (dy / len) * speed;
            unit.x += unit.vx * dt;
            unit.y += unit.vy * dt;
            unit.posture = target ? 'engaged' : retreating ? 'fallback' : 'advance';
            if (target && distance(unit, target) < 13 && unit.attackCooldown <= 0) {
                const formationBonus = this.getFormationMatchupModifier(front, side === 'attacker' ? 'attackers' : 'defenders', unit.role || 'frontline');
                const damage = unit.damage * formationBonus * (0.92 + this.world.rng() * 0.3);
                if (target.entityType === 'factionUnit') {
                    this.world.applyFactionUnitHit(target, damage, front, side === 'defender' ? front.colonyName : 'enemy fighters');
                    unit.attackCooldown = 0.48 + this.world.rng() * 0.26;
                    front.damageFlash = 0.86;
                    if (!target.alive) {
                        if (side === 'defender') {
                            front.attackerCasualties += 1;
                        } else {
                            front.defenderCasualties += 1;
                        }
                    }
                    return;
                }
                if (front.mode === 'intercolonial') {
                    target.hp = Math.max(0, target.hp - damage);
                    unit.attackCooldown = 0.48 + this.world.rng() * 0.26;
                    front.damageFlash = 0.86;
                    if (target.hp <= 0 && target.alive) {
                        target.alive = false;
                        if (side === 'defender') {
                            front.attackerCasualties += 1;
                        } else {
                            front.defenderCasualties += 1;
                        }
                    }
                    return;
                }
                this.world.applyBattleHit(target, damage, front, side === 'defender' ? front.colonyName : 'enemy fighters');
                unit.attackCooldown = 0.48 + this.world.rng() * 0.26;
                front.damageFlash = 0.86;
                if (!target.alive) {
                    if (side === 'defender') {
                        front.attackerCasualties += 1;
                    } else {
                        front.defenderCasualties += 1;
                    }
                }
            }
        }

        pickClosestColonist(front, origin, colonists, maxDistance) {
            let best = null;
            let bestDistance = maxDistance;
            for (const colonist of colonists) {
                if (!this.canBreakFormationForTarget(front, origin, colonist)) {
                    continue;
                }
                const current = distance(origin, colonist);
                if (current < bestDistance) {
                    bestDistance = current;
                    best = colonist;
                }
            }
            return best;
        }

        getAttackerFormationDestination(front, attacker) {
            const { defenderAnchor, flankVector, advanceVector } = front.formation;
            const columns = Math.max(2, Math.ceil(Math.sqrt(front.initialAttackerCount || this.getFrontAttackers(front).length || 4)));
            const engageTightness = front.phase === 'engage' ? 0.62 : 1;
            const formationOffset = this.getFormationOffsets(
                front.tactics.attackerFormation,
                attacker.role || 'frontline',
                attacker.formationRow || 0,
                attacker.formationColumn || 0,
                columns,
                (attacker.formationColumn - (columns - 1) * 0.5) * (7 + front.scale * 4) * engageTightness,
                attacker.formationRow * (7 + front.scale * 3) * (front.phase === 'engage' ? 0.72 : 1)
            );
            let tacticOffset = formationOffset.lateral;
            const rowOffset = formationOffset.depth;
            if (front.tactics.attacker === 'flank' && attacker.role !== 'frontline') {
                tacticOffset *= 1.65;
            }
            if (front.tactics.attacker === 'wedge') {
                tacticOffset *= 0.72 + attacker.formationRow * 0.14;
            }
            const anchor = front.phase === 'engage' ? this.getContactAnchor(front) : defenderAnchor;
            return {
                x: anchor.x + flankVector.x * tacticOffset - advanceVector.x * rowOffset,
                y: anchor.y + flankVector.y * tacticOffset - advanceVector.y * rowOffset
            };
        }

        getAttackerOrderDestination(front, attacker) {
            const base = this.getAttackerFormationDestination(front, attacker);
            if (front.orderState.attackers === 'fallback' || front.orderState.attackers === 'rout') {
                return {
                    x: front.formation.attackerOrigin.x -
                        front.formation.advanceVector.x * (14 + front.scale * 12 + attacker.formationRow * 4) +
                        front.formation.flankVector.x * ((attacker.formationColumn - 1.5) * (8 + front.scale * 4)),
                    y: front.formation.attackerOrigin.y -
                        front.formation.advanceVector.y * (14 + front.scale * 12 + attacker.formationRow * 4) +
                        front.formation.flankVector.y * ((attacker.formationColumn - 1.5) * (8 + front.scale * 4))
                };
            }
            if (front.orderState.attackers === 'probe') {
                return {
                    x: base.x - front.formation.advanceVector.x * (10 + front.scale * 8 + (attacker.role === 'reserve' ? 10 : 0)),
                    y: base.y - front.formation.advanceVector.y * (10 + front.scale * 8 + (attacker.role === 'reserve' ? 10 : 0))
                };
            }
            if (front.orderState.attackers === 'advance') {
                return {
                    x: base.x - front.formation.advanceVector.x * (attacker.role === 'reserve' ? 8 : 3),
                    y: base.y - front.formation.advanceVector.y * (attacker.role === 'reserve' ? 8 : 3)
                };
            }
            if (front.orderState.attackers === 'press') {
                return {
                    x: base.x + front.formation.advanceVector.x * (attacker.role === 'frontline' ? 8 + front.scale * 5 : attacker.role === 'support' ? 4 : 0),
                    y: base.y + front.formation.advanceVector.y * (attacker.role === 'frontline' ? 8 + front.scale * 5 : attacker.role === 'support' ? 4 : 0)
                };
            }
            return base;
        }

        syncFactionUnitOrders(front) {
            for (const attacker of this.getFrontAttackers(front)) {
                attacker.commandOrder = front.orderState.attackers;
                attacker.commandTarget = this.getAttackerOrderDestination(front, attacker);
            }
            for (const defender of this.getFrontDefenders(front)) {
                defender.commandOrder = front.orderState.defenders;
                defender.commandTarget = this.getDefenderFormationDestination(front, defender);
            }
        }

        isFrontReadyToEngage(front, defenders) {
            const attackerUnits = this.getFrontAttackers(front);
            const assignedAttackers = this.getAssignedColonists(front);
            const totalAttackers = front.mode === 'outbound'
                ? assignedAttackers.length + attackerUnits.length
                : attackerUnits.length;
            const formedAttackers = front.mode === 'outbound'
                ? assignedAttackers.filter((colonist) =>
                    distance(colonist, this.getAssignedColonistFormationDestination(front, colonist)) < 18
                ).length + attackerUnits.filter((unit) =>
                    unit.commandTarget && distance(unit, unit.commandTarget) < 16
                ).length
                : attackerUnits.filter((unit) => unit.commandTarget && distance(unit, unit.commandTarget) < 16).length;
            const totalDefenders = front.mode === 'outbound' || front.mode === 'intercolonial'
                ? this.getFrontDefenders(front).length
                : defenders.length;
            const formedDefenders = front.mode === 'outbound' || front.mode === 'intercolonial'
                ? this.getFrontDefenders(front).filter((unit) => unit.commandTarget && distance(unit, unit.commandTarget) < 16).length
                : defenders.filter((colonist) => distance(colonist, this.getBattleDestinationForColonist(front, colonist)) < 18).length;
            const attackerReady = totalAttackers === 0 ? false : formedAttackers / Math.max(1, totalAttackers) >= 0.72;
            const defenderReady = totalDefenders === 0 ? false : formedDefenders / Math.max(1, totalDefenders) >= 0.72;
            return attackerReady && (defenderReady || front.surpriseTriggered);
        }

        ensureFrontPhase(front, defenders, dt) {
            if (front.phase === 'engage') {
                return;
            }
            front.phaseTime += dt;
            if (!front.commandIssued) {
                this.noteFrontMoment(
                    front,
                    `${front.commanders.attackers.name} ordered ${titleCase(front.tactics.attacker)} while ${front.commanders.defenders.name} formed ${titleCase(front.tactics.defender)}.`
                );
                front.commandIssued = true;
            }
            if (this.isFrontReadyToEngage(front, defenders)) {
                front.phase = 'engage';
                front.phaseTime = 0;
                front.engageTime = 0;
                this.noteFrontMoment(front, 'Both lines formed and the battle was joined.');
            } else if (front.surpriseTriggered && front.phaseTime >= front.musterTime * 0.6) {
                front.phase = 'engage';
                front.phaseTime = 0;
                front.engageTime = 0;
                this.noteFrontMoment(front, 'The line broke early under surprise pressure.');
            }
        }

        pickAttackerTarget(front, attacker, defenders) {
            let best = null;
            let bestDistance = 18 + front.scale * 8;
            for (const colonist of defenders) {
                if (!this.canBreakFormationForTarget(front, attacker, colonist)) {
                    continue;
                }
                const currentDistance = distance(attacker, colonist);
                if (currentDistance < bestDistance) {
                    bestDistance = currentDistance;
                    best = colonist;
                }
            }
            if (best) {
                attacker.targetColonistId = best.id;
            } else {
                attacker.targetColonistId = null;
            }
            return best;
        }

        getFallbackDestination(front) {
            if (front.targetBuildingId) {
                const building = this.world.buildings.find((entry) => entry.id === front.targetBuildingId);
                if (building) {
                    return building;
                }
            }
            return { x: front.x, y: front.y };
        }

        handleColonistEngage(colonist, front, dealt) {
            if (!front || front.resolved) {
                return false;
            }
            const target = this.getColonistCombatTarget(front, colonist);
            if (!target) {
                return false;
            }
            const targetDistance = distance(colonist, target);
            if (targetDistance > 16) {
                return false;
            }

            const tacticBonus = front.tactics.defender === 'counter'
                ? 1.15
                : front.tactics.defender === 'shield' && distance(colonist, front.formation.defenderAnchor) < 26
                    ? 1.1
                    : 1;
            const orderBonus = this.getColonistEngageModifier(front, colonist);
            target.hp = Math.max(0, target.hp - dealt * tacticBonus * orderBonus);
            front.damageFlash = 0.95;
            this.world.spawnBattleBurst(
                target.x + (this.world.rng() - 0.5) * 8,
                target.y + (this.world.rng() - 0.5) * 8,
                0.9,
                'hit'
            );
            if (target.hp <= 0 && target.alive) {
                target.alive = false;
                if (front.mode === 'outbound') {
                    front.defenderCasualties += 1;
                } else {
                    front.attackerCasualties += 1;
                }
            }
            if (front.mode === 'outbound') {
                front.defenderHealth = this.getProxyHealth(front.defenders);
            } else {
                front.attackerHealth = this.getProxyHealth(this.getFrontAttackers(front));
            }
            return true;
        }

        noteFrontMoment(front, message) {
            if (!message) {
                return;
            }
            front.detailKeyMoments.push(message);
            front.detailKeyMoments = front.detailKeyMoments.slice(-4);
        }

        resolveFront(front, outcome, defenders) {
            front.resolved = true;
            front.outcome = outcome;
            front.ttl = 2.8;
            front.lastResolvedAt = this.world.elapsed;
            this.transitionResolvedFactionUnits(front, outcome);

            const colony = this.world.getActiveBranchColonies().find((entry) => entry.id === front.colonyId) || null;
            const defenderColony = this.world.getActiveBranchColonies().find((entry) => entry.id === front.defenderColonyId) || null;
            let raidSummary = null;
            this.applyArmyOutcome(front, colony, outcome, defenderColony);

            if (outcome === 'defenders') {
                raidSummary = this.resolveInboundRaidOutcome(front, colony, false);
                this.world.spawnBattleScar(front.x, front.y, 12 + front.scale * 10, 90);
                this.world.createBattleDangerZone(front, 'defenders held');
                this.recordBattleReport(this.createFrontReport(front, defenders, 'defenders held', [], raidSummary));
                if (front.mode === 'intercolonial') {
                    if (colony) {
                        this.world.applyFactionWarAftermath(colony, 'defeat', front.scale, {
                            enemy: defenderColony?.name || front.defenderColonyName || 'frontier defenders',
                            targetBuildingType: front.targetBuildingType
                        });
                    }
                    if (defenderColony) {
                        this.world.applyFactionWarAftermath(defenderColony, 'victory', front.scale, {
                            enemy: colony?.name || front.colonyName,
                            targetBuildingType: front.targetBuildingType
                        });
                    }
                } else {
                    const aftermathResult = front.mode === 'outbound' ? 'victory' : 'defeat';
                    this.world.applyFactionWarAftermath(colony, aftermathResult, front.scale, {
                        enemy: 'main settlement',
                        targetBuildingType: front.targetBuildingType
                    });
                }
                if (front.mode === 'outbound') {
                    this.clearBattleOrders(front, true);
                    this.world.recordFactionEvent(`${colony?.name || front.colonyName} repelled the main settlement's attack.`);
                } else if (front.mode === 'intercolonial') {
                    this.world.recordFactionEvent(`${defenderColony?.name || front.defenderColonyName || 'The defenders'} held against ${colony?.name || front.colonyName}.`);
                } else {
                    this.clearBattleOrders(front, true);
                    this.world.recordFactionEvent(`The settlement broke the warband from ${front.colonyName}.`);
                }
                return;
            }

            const target = front.mode === 'outbound'
                ? this.getColonyStructureTarget(colony, front.targetBuildingType)
                : front.mode === 'intercolonial'
                ? this.getColonyStructureTarget(defenderColony, front.targetBuildingType)
                : this.world.buildings.find((building) => building.id === front.targetBuildingId)
                    || this.world.buildings.find((building) => building.type === front.targetBuildingType)
                    || null;
            const damagedBuildings = this.applyBreakthroughDamage(front, target, front.mode === 'intercolonial' ? defenderColony : colony);
            raidSummary = this.resolveInboundRaidOutcome(front, colony, true, damagedBuildings);
            this.world.spawnBattleScar(front.x, front.y, 14 + front.scale * 12, 120);
            this.world.createBattleDangerZone(front, 'attackers broke through');
            this.recordBattleReport(this.createFrontReport(front, defenders, 'attackers broke through', damagedBuildings, raidSummary));
            if (front.mode === 'intercolonial') {
                if (colony) {
                    this.world.applyFactionWarAftermath(colony, 'victory', front.scale, {
                        enemy: defenderColony?.name || front.defenderColonyName || 'frontier defenders',
                        targetBuildingType: front.targetBuildingType
                    });
                }
                if (defenderColony) {
                    this.world.applyFactionWarAftermath(defenderColony, 'defeat', front.scale, {
                        enemy: colony?.name || front.colonyName,
                        targetBuildingType: front.targetBuildingType
                    });
                }
            } else {
                const victoryResult = front.mode === 'outbound' ? 'defeat' : 'victory';
                this.world.applyFactionWarAftermath(colony, victoryResult, front.scale, {
                    enemy: 'main settlement',
                    targetBuildingType: front.targetBuildingType
                });
            }
            if (front.mode === 'outbound') {
                this.clearBattleOrders(front, true);
                this.world.recordFactionEvent(`The main settlement overran ${front.colonyName}'s frontier line.`);
            } else if (front.mode === 'intercolonial') {
                this.world.recordFactionEvent(`${colony?.name || front.colonyName} overran ${defenderColony?.name || front.defenderColonyName || 'the rival frontier line'}.`);
            } else {
                this.clearBattleOrders(front, true);
                this.world.recordFactionEvent(`${front.colonyName} overran the defenders at the frontier battle.`);
            }
        }

        resolveInboundRaidOutcome(front, colony, attackersWon, damagedBuildings = []) {
            if (front.mode !== 'inbound' || !front.raidContext || !colony) {
                return null;
            }
            const raid = front.raidContext;
            if (!attackersWon) {
                colony.factionIdentity.fear = clamp(colony.factionIdentity.fear + 0.06, 0.05, 0.95);
                colony.factionIdentity.trust = clamp(colony.factionIdentity.trust - 0.04, 0.05, 0.95);
                colony.recentAction = 'repelled';
                if (raid.campaignPressure > 0.25) {
                    colony.campaign.pressure = clamp(raid.campaignPressure - 0.08, 0, 1);
                }
                this.world.recordFactionEvent(`The main settlement repelled raiders from ${colony.name}.`);
                return {
                    foodLoss: 0,
                    woodLoss: 0,
                    prisoners: colony.history.prisoners || 0,
                    refugees: colony.history.refugees || 0,
                    warfareMethod: raid.warfareMethod
                };
            }

            const foodLoss = Math.min(9, Math.max(2, colony.population + front.scale * 3));
            const woodLoss = Math.min(5, Math.max(1, colony.population * 0.5 + front.scale * 2));
            this.world.camp.food = Math.max(0, this.world.camp.food - foodLoss);
            this.world.camp.wood = Math.max(0, this.world.camp.wood - woodLoss);
            colony.food = clamp((colony.food || 0) + foodLoss * 0.7, 0, 140);
            colony.wood = clamp((colony.wood || 0) + woodLoss * 0.7, 0, 80);
            colony.history.raids += 1;
            colony.recentAction = 'raiding';
            if (raid.campaignPressure > 0.48) {
                colony.campaign.pressure = clamp(raid.campaignPressure + 0.06, 0, 1);
            }
            if (front.scale > 0.52) {
                colony.history.campaigns += 1;
                if (this.world.colonists.length > 5 && this.world.rng() < 0.35) {
                    colony.history.refugees += 1;
                    this.world.recordFactionEvent(`Families fled inward after the larger battle with ${colony.name}.`);
                }
            }
            if (this.world.rng() < 0.26 && this.world.colonists.length > 4) {
                colony.history.prisoners += 1;
                this.world.recordFactionEvent(`${colony.name} carried off a prisoner after the raid on the ${front.targetBuildingType}.`);
            }
            this.world.lastRaid = {
                by: colony.name,
                target: front.targetBuildingType,
                day: this.world.day,
                year: this.world.year
            };
            this.world.recordFactionEvent(
                raid.strategy === 'raid'
                    ? `${colony.name} launched ${raid.warfareMethod} against the ${front.targetBuildingType} and stole supplies.`
                    : `${colony.name} struck the ${front.targetBuildingType} with ${raid.warfareMethod} and stole supplies.`
            );
            return {
                foodLoss,
                woodLoss,
                prisoners: colony.history.prisoners || 0,
                refugees: colony.history.refugees || 0,
                warfareMethod: raid.warfareMethod,
                damagedBuildings
            };
        }

        transitionResolvedFactionUnits(front, outcome) {
            const losingSide = outcome === 'attackers' ? 'defenders' : 'attackers';
            const contact = this.getContactAnchor(front);
            const attackerFallback = {
                x: front.formation.attackerOrigin.x - front.formation.advanceVector.x * (26 + front.scale * 18),
                y: front.formation.attackerOrigin.y - front.formation.advanceVector.y * (26 + front.scale * 18)
            };
            const defenderFallback = this.getDefenderFallbackAnchor(front);
            const attackersWon = outcome === 'attackers';

            for (const attacker of this.getFrontAttackers(front)) {
                if (!attacker?.alive || attacker.hp <= 0) {
                    continue;
                }
                attacker.battlefrontId = null;
                attacker.commandOrder = null;
                attacker.commandTarget = null;
                if (losingSide === 'attackers') {
                    attacker.transientMode = 'retreat';
                    attacker.transientTtl = 8 + front.scale * 3;
                    attacker.retreatTarget = {
                        x: attackerFallback.x + front.formation.flankVector.x * ((attacker.formationColumn - 1.5) * 8),
                        y: attackerFallback.y + front.formation.flankVector.y * ((attacker.formationColumn - 1.5) * 8)
                    };
                } else {
                    attacker.transientMode = attackersWon ? 'pursue' : 'rally';
                    attacker.transientTtl = attackersWon ? 5.5 + front.scale * 2 : 4.5 + front.scale * 1.5;
                    attacker.retreatTarget = attackersWon
                        ? {
                            x: contact.x + front.formation.advanceVector.x * (14 + front.scale * 10),
                            y: contact.y + front.formation.advanceVector.y * (14 + front.scale * 10)
                        }
                        : { x: contact.x, y: contact.y };
                }
            }

            for (const defender of this.getFrontDefenders(front)) {
                if (!defender?.alive || defender.hp <= 0) {
                    continue;
                }
                defender.battlefrontId = null;
                defender.commandOrder = null;
                defender.commandTarget = null;
                if (losingSide === 'defenders') {
                    defender.transientMode = 'retreat';
                    defender.transientTtl = 8 + front.scale * 3;
                    defender.retreatTarget = {
                        x: defenderFallback.x + front.formation.flankVector.x * ((defender.formationColumn - 1.5) * 8),
                        y: defenderFallback.y + front.formation.flankVector.y * ((defender.formationColumn - 1.5) * 8)
                    };
                } else {
                    defender.transientMode = 'rally';
                    defender.transientTtl = 4.8 + front.scale * 1.6;
                    defender.retreatTarget = {
                        x: front.formation.defenderAnchor.x,
                        y: front.formation.defenderAnchor.y
                    };
                }
            }
        }

        clearBattleOrders(front, preserveFactionUnits = false) {
            if (!preserveFactionUnits) {
                this.world.removeFactionUnitsByBattlefront(front.id);
            }
            for (const colonist of this.world.colonists) {
                if (colonist.assignedBattlefrontId === front.id) {
                    colonist.assignedBattlefrontId = null;
                    colonist.battleRole = null;
                    colonist.battleFormationIndex = -1;
                    colonist.battleOrderTtl = 0;
                }
            }
            front.factionUnitIds = [];
            front.defenderFactionUnitIds = [];
        }

        applyArmyOutcome(front, colony, outcome, defenderColony = null) {
            const defenderLosses = Math.max(0, front.defenderCasualties || 0);
            const attackerLosses = Math.max(0, front.attackerCasualties || 0);
            if (front.mode === 'intercolonial') {
                if (colony?.army) {
                    colony.army.available = Math.max(0, colony.army.available - attackerLosses * 0.45);
                    colony.army.wounded += attackerLosses * 0.3;
                    colony.army.veterans = clamp(colony.army.veterans + (outcome === 'attackers' ? 0.35 : 0.1), 0, Math.max(1, colony.population || 2));
                    colony.army.morale = clamp01(colony.army.morale + (outcome === 'attackers' ? 0.08 : -0.05));
                    colony.army.recovery = Math.max(colony.army.recovery || 0, 16 + front.scale * 12);
                }
                if (defenderColony?.army) {
                    defenderColony.army.available = Math.max(0, defenderColony.army.available - defenderLosses * 0.5);
                    defenderColony.army.wounded += defenderLosses * 0.34;
                    defenderColony.army.veterans = Math.max(0, defenderColony.army.veterans - defenderLosses * 0.05);
                    defenderColony.army.morale = clamp01(defenderColony.army.morale + (outcome === 'defenders' ? 0.06 : -0.1));
                    defenderColony.army.recovery = Math.max(defenderColony.army.recovery || 0, 18 + front.scale * 14);
                }
                return;
            }
            if (!colony?.army) {
                return;
            }
            const army = colony.army;
            if (front.mode === 'outbound') {
                army.available = Math.max(0, army.available - defenderLosses * 0.55);
                army.wounded += defenderLosses * 0.35;
                army.veterans = Math.max(0, army.veterans - defenderLosses * 0.08);
                army.morale = clamp01(army.morale + (outcome === 'defenders' ? 0.05 : -0.12));
                army.recovery = Math.max(army.recovery || 0, 18 + front.scale * 14);
            } else {
                army.available = Math.max(0, army.available - attackerLosses * 0.45);
                army.wounded += attackerLosses * 0.3;
                army.veterans = clamp(army.veterans + (outcome === 'attackers' ? 0.35 : 0.12), 0, Math.max(1, colony.population || 2));
                army.morale = clamp01(army.morale + (outcome === 'attackers' ? 0.08 : -0.05));
                army.recovery = Math.max(army.recovery || 0, 14 + front.scale * 10);
            }
        }

        getColonyStructureTarget(colony, preferredType = null) {
            if (!colony?.structures) {
                return null;
            }
            const entries = Object.entries(colony.structures)
                .map(([key, value]) => ({ key, ...value }))
                .sort((left, right) => left.integrity - right.integrity);
            const preferred = preferredType ? entries.find((entry) => entry.key === preferredType) : null;
            return preferred || entries[0] || null;
        }

        applyBreakthroughDamage(front, primaryTarget, colony = null) {
            const damaged = [];
            const candidates = (front.mode === 'outbound' || front.mode === 'intercolonial')
                ? Object.entries(colony?.structures || {})
                    .map(([key, value]) => ({ key, ...value }))
                    .sort((left, right) => left.integrity - right.integrity)
                : this.world.buildings
                    .filter((building) =>
                        ['storage', 'storagePit', 'granary', 'warehouse', 'leanTo', 'hut', 'cottage', 'kitchen', 'foodHall', 'campfire', 'wall', 'watchtower', 'house', 'fortifiedStructure'].includes(building.type)
                    )
                    .sort((left, right) => distance(left, front) - distance(right, front));
            const strikeCount = front.reportType === 'large battle'
                ? 1 + (front.surpriseTriggered ? 2 : 1) + (front.tactics.attacker === 'wedge' ? 1 : 0)
                : 1 + (front.surpriseTriggered ? 1 : 0);
            const selected = [];
            const selectedKeys = new Set();
            const getCandidateKey = (building) => front.mode === 'outbound' ? building?.key : building?.id;
            if (primaryTarget) {
                selected.push(primaryTarget);
                selectedKeys.add(getCandidateKey(primaryTarget));
            }
            for (const building of candidates) {
                if (selected.length >= strikeCount) {
                    break;
                }
                const candidateKey = getCandidateKey(building);
                if (!selectedKeys.has(candidateKey)) {
                    selected.push(building);
                    selectedKeys.add(candidateKey);
                }
            }
            for (const building of selected) {
                const damage = (building === primaryTarget ? 1.4 : 0.7) + front.scale * (building === primaryTarget ? 2.2 : 1.35);
                if (front.mode === 'outbound' || front.mode === 'intercolonial') {
                    colony.structures[building.key].integrity = clamp(colony.structures[building.key].integrity - damage * 0.18, 0, 1);
                    damaged.push(colony.structures[building.key].label || building.key);
                    colony.food = Math.max(0, colony.food - 2.4);
                    colony.water = Math.max(0, colony.water - 1.8);
                    colony.population = clamp(colony.population - (building.key === 'outerHuts' ? 0.35 : 0.12), 2, 12);
                } else {
                    building.integrity = clamp(building.integrity - damage, 0, building.maxIntegrity);
                    this.world.startRepairProject(building);
                    damaged.push(building.type);
                    this.world.spawnBattleBurst(
                        building.x + (this.world.rng() - 0.5) * 12,
                        building.y + (this.world.rng() - 0.5) * 12,
                        1.2,
                        'building'
                    );
                }
            }
            front.breakthroughDamage = damaged;
            if (damaged.length > 1) {
                this.noteFrontMoment(front, `The breakthrough spread into ${damaged.length} structures.`);
            }
            return damaged;
        }

        createFrontReport(front, defenders, outcome, damagedBuildings = [], raidSummary = null) {
            const defenderCount = Math.max(front.initialDefenderCount || 0, defenders.length);
            const escapedAttackers = this.getFrontAttackers(front).length;
            const outboundAttackers = front.mode === 'outbound' ? this.getAssignedColonists(front).filter((entry) => entry.alive).length : escapedAttackers;
            const reportType = front.reportType || 'battle';
            const meta = front.mode === 'intercolonial'
                ? `${front.colonyName} vs ${front.defenderColonyName || 'frontier colony'} at year ${this.world.year}, day ${this.world.day}`
                : `${front.colonyName} at year ${this.world.year}, day ${this.world.day}`;
            const targetLabel = front.targetBuildingType ? titleCase(front.targetBuildingType) : 'Frontier line';
            const detailLines = [
                `Target: ${targetLabel}`,
                `Commanders: ${front.commanders.attackers.name} vs ${front.commanders.defenders.name}`,
                `Attacker tactic: ${titleCase(front.tactics.attacker)}`,
                `Attacker formation: ${titleCase(String(front.tactics.attackerFormation || 'line').replace(/-/g, ' '))}`,
                `Defender tactic: ${titleCase(front.tactics.defender)}`,
                `Defender formation: ${titleCase(String(front.tactics.defenderFormation || 'line').replace(/-/g, ' '))}`,
                `Attackers fielded: ${front.initialAttackerCount}`,
                `Defenders present: ${defenderCount}`,
                `Attacker losses: ${front.attackerCasualties}`,
                `Defender losses: ${front.defenderCasualties}`,
                `Attackers remaining: ${front.mode === 'outbound' ? outboundAttackers : escapedAttackers}`,
                `Defenders remaining: ${front.mode === 'outbound' ? this.getFrontDefenders(front).length : defenders.filter((entry) => entry.alive).length}`
            ];
            if (front.surpriseTriggered) {
                detailLines.push('The attack landed before the defenders fully formed up.');
            }
            if (front.supportAlliance) {
                detailLines.push(`${front.supportAlliance.sponsor} entered the fight for ${front.supportAlliance.beneficiary}.`);
            }
            if (damagedBuildings.length > 1) {
                detailLines.push(`Buildings hit: ${damagedBuildings.map((entry) => titleCase(entry)).join(', ')}`);
            }
            if (raidSummary) {
                if (raidSummary.foodLoss > 0 || raidSummary.woodLoss > 0) {
                    detailLines.push(`Stores lost: food ${Number((raidSummary.foodLoss || 0).toFixed(1))}, wood ${Number((raidSummary.woodLoss || 0).toFixed(1))}`);
                }
                if ((raidSummary.prisoners || 0) > 0) {
                    detailLines.push(`Prisoners taken: ${raidSummary.prisoners}`);
                }
                if ((raidSummary.refugees || 0) > 0) {
                    detailLines.push(`Refugees displaced: ${raidSummary.refugees}`);
                }
            }

            if (front.detailKeyMoments.length) {
                detailLines.push(...front.detailKeyMoments);
            } else if (outcome === 'defenders held') {
                detailLines.push('The defenders held the line and pushed the attackers back.');
            } else {
                detailLines.push('The attackers broke the line and hit the frontier structures.');
            }

            return {
                type: reportType,
                colonyName: front.colonyName,
                outcome,
                targetBuildingType: front.targetBuildingType || null,
                attackerRemaining: Number(front.attackerHealth.toFixed(1)),
                defenderRemaining: Number(front.defenderHealth.toFixed(1)),
                attackerCount: front.initialAttackerCount,
                defenderCount,
                attackerCasualties: front.attackerCasualties,
                defenderCasualties: front.defenderCasualties,
                mode: front.mode,
                tactics: { ...front.tactics },
                commanders: {
                    attackers: front.commanders.attackers.name,
                    defenders: front.commanders.defenders.name
                },
                orderState: { ...front.orderState },
                supportAlliance: front.supportAlliance ? { ...front.supportAlliance } : null,
                morale: {
                    attackers: Number(front.morale.attackers.toFixed(2)),
                    defenders: Number(front.morale.defenders.toFixed(2))
                },
                surprise: front.surpriseTriggered,
                damagedBuildings,
                resourceLosses: raidSummary ? {
                    food: Number(((raidSummary.foodLoss) || 0).toFixed(1)),
                    wood: Number(((raidSummary.woodLoss) || 0).toFixed(1))
                } : null,
                detailLines,
                meta,
                popup: reportType === 'skirmish' || reportType === 'battle' || reportType === 'large battle'
            };
        }

        recordBattleReport(report) {
            this.reportCounter += 1;
            this.world.battleReports.unshift({
                id: `battle-report-${this.reportCounter}`,
                year: this.world.year,
                day: this.world.day,
                popup: Boolean(report.popup),
                ...report
            });
            this.world.battleReports = this.world.battleReports.slice(0, 16);
        }
    }

    PhaseOneSim.PhaseOneBattleManager = PhaseOneBattleManager;
})();
