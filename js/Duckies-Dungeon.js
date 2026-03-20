let GRID_W = 14;
let GRID_H = 12;

const ENEMY_TYPES = {
    w: { name: 'Weak', hp: 3, atk: 1, char: 'w', desc: 'Low HP, low dmg' },
    e: { name: 'Normal', hp: 6, atk: 2, char: 'e', desc: 'Balanced threat' },
    T: { name: 'Tank', hp: 12, atk: 1, char: 'T', desc: 'High HP, low dmg' },
    f: { name: 'Fast', hp: 3, atk: 3, char: 'f', desc: 'Low HP, high dmg' },
    M: { name: 'Mage', hp: 4, atk: 4, char: 'M', desc: 'High dmg, low HP' }
};

const STATUS_EFFECTS = {
    poison: { name: 'POISON', desc: 'Lose 1 HP per turn', dmgPerTurn: 1 },
    bleed: { name: 'BLEED', desc: 'Lose 1 HP when moving', dmgOnMove: 1 },
    stun: { name: 'STUN', desc: 'Cannot move next turn', turnsLeft: 0 }
};

const SHOP_ITEMS = {
    heal: { name: 'Health Potion', cost: 80, effect: 'heal', amount: 5 },
    xpBoost: { name: 'XP Crystal', cost: 150, effect: 'xp', amount: 20 },
    weapon1: { name: 'Iron Sword', cost: 250, effect: 'weapon', level: 2 },
    weapon2: { name: 'Steel Sword', cost: 500, effect: 'weapon', level: 3 },
    weapon3: { name: 'Mythril Blade', cost: 1000, effect: 'weapon', level: 4 },
    armor1: { name: 'Iron Armor', cost: 250, effect: 'armor', level: 2 },
    armor2: { name: 'Steel Armor', cost: 500, effect: 'armor', level: 3 },
    armor3: { name: 'Mythril Armor', cost: 1000, effect: 'armor', level: 4 }
};

const PERKS = [
    { name: '+50% Damage', desc: 'Deal 50% more dmg', effect: 'dmgBoost', value: 0.5 },
    { name: 'Double Gold', desc: 'Enemies drop 2x gold', effect: 'goldBoost', value: 2 },
    { name: '-50% Shop', desc: 'Shop items cost half', effect: 'shopDiscount', value: 0.5 },
    { name: '+Max HP', desc: 'Max HP +5', effect: 'hpBoost', value: 5 },
    { name: 'No Poison', desc: 'Immunity to poison', effect: 'noPoisonImmune' }
];

function adjustGridSize() {
    const screenWidth = window.innerWidth;
    if (screenWidth < 400) { GRID_W = 10; GRID_H = 9; }
    else if (screenWidth < 600) { GRID_W = 12; GRID_H = 10; }
    else if (screenWidth < 800) { GRID_W = 14; GRID_H = 12; }
    else { GRID_W = 16; GRID_H = 14; }
}

let state = {
    player: { 
        x: 0, y: 0, 
        hp: 10, maxHp: 10, 
        atk: 3, def: 1, 
        lvl: 1, exp: 0, nextExp: 10, 
        gold: 100,
        weaponLvl: 1,
        armorLvl: 1,
        statusEffects: {},
        dmgBoost: 0,
        goldBoost: 1,
        shopDiscount: 1,
        noPoisonImmune: false
    },
    level: 1,
    floorPerks: [],
    dungeon: [],
    roomTypes: {},
    enemies: [],
    items: [],
    log: [],
    canMove: true,
    shopOpen: false,
    infoOpen: false
};

const shopModal = document.getElementById('shopModal');
const infoModal = document.getElementById('infoModal');
const shopBtn = document.getElementById('shopBtn');
const infoBtn = document.getElementById('infoBtn');
const closeShop = document.getElementById('closeShop');
const closeInfo = document.getElementById('closeInfo');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const buttons = document.querySelectorAll('.btn[data-dir]');

buttons.forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const [dx, dy] = btn.dataset.dir.split(',').map(Number);
        movePlayer(dx, dy);
    });
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const [dx, dy] = btn.dataset.dir.split(',').map(Number);
        movePlayer(dx, dy);
    });
});

shopBtn.addEventListener('touchstart', toggleShop);
shopBtn.addEventListener('mousedown', toggleShop);
closeShop.addEventListener('touchstart', toggleShop);
closeShop.addEventListener('mousedown', toggleShop);

infoBtn.addEventListener('touchstart', toggleInfo);
infoBtn.addEventListener('mousedown', toggleInfo);
closeInfo.addEventListener('touchstart', toggleInfo);
closeInfo.addEventListener('mousedown', toggleInfo);

fullscreenBtn.addEventListener('touchstart', toggleFullscreen);
fullscreenBtn.addEventListener('mousedown', toggleFullscreen);

document.addEventListener('keydown', (e) => {
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); toggleShop(); }
    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); toggleInfo(); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
});

window.addEventListener('resize', () => {
    adjustGridSize();
    generateDungeon();
    render();
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen');
    }
});

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Fullscreen failed:', err);
        });
        document.body.classList.add('fullscreen');
    } else {
        document.exitFullscreen();
        document.body.classList.remove('fullscreen');
    }
}

function toggleShop() {
    if (state.infoOpen) return;
    state.shopOpen = !state.shopOpen;
    if (state.shopOpen) {
        renderShop();
        shopModal.classList.add('active');
    } else {
        shopModal.classList.remove('active');
    }
}

function toggleInfo() {
    if (state.shopOpen) return;
    state.infoOpen = !state.infoOpen;
    if (state.infoOpen) {
        renderInfo();
        infoModal.classList.add('active');
    } else {
        infoModal.classList.remove('active');
    }
}

function renderInfo() {
    let enemyHtml = '';
    Object.entries(ENEMY_TYPES).forEach(([key, enemy]) => {
        const scaled = { 
            hp: Math.floor(enemy.hp + state.level * 2), 
            atk: Math.floor(enemy.atk + state.level) 
        };
        enemyHtml += `<div class="item">
            <div class="item-name">${enemy.char} - ${enemy.name}</div>
            <div class="item-desc">HP: ${scaled.hp} | ATK: ${scaled.atk}</div>
            <div class="item-desc">${enemy.desc}</div>
        </div>`;
    });
    document.getElementById('enemyIndex').innerHTML = enemyHtml || 'No enemies found';
    
    let statusHtml = '';
    Object.entries(STATUS_EFFECTS).forEach(([key, effect]) => {
        const hasEffect = state.player.statusEffects[key];
        const cls = hasEffect ? 'item status-active' : 'item';
        statusHtml += `<div class="${cls}">
            <div class="item-name">${effect.name}${hasEffect ? ' ✓' : ''}</div>
            <div class="item-desc">${effect.desc}</div>
        </div>`;
    });
    document.getElementById('statusEffects').innerHTML = statusHtml;
    
    let perkHtml = '';
    if (state.floorPerks.length === 0) {
        perkHtml = '<div class="perk">No perks this floor</div>';
    } else {
        state.floorPerks.forEach(perk => {
            perkHtml += `<div class="perk">✓ ${perk.name}<br><span style="font-size:smaller">${perk.desc}</span></div>`;
        });
    }
    document.getElementById('floorPerks').innerHTML = perkHtml;
}

function renderShop() {
    let html = '';
    Object.entries(SHOP_ITEMS).forEach(([key, item]) => {
        let cost = Math.floor(item.cost * state.player.shopDiscount);
        let affordable = state.player.gold >= cost;
        let canBuy = affordable;
        
        if (item.effect === 'weapon' && item.level <= state.player.weaponLvl) canBuy = false;
        if (item.effect === 'armor' && item.level <= state.player.armorLvl) canBuy = false;
        
        html += `<div class="shop-item">
            <span>${item.name} - ${cost}g</span>
            <button class="shop-btn" ${canBuy ? '' : 'disabled'} onclick="buyItem('${key}')">${canBuy ? 'BUY' : 'NO'}</button>
        </div>`;
    });
    document.getElementById('shopItems').innerHTML = html;
}

function buyItem(key) {
    const item = SHOP_ITEMS[key];
    const cost = Math.floor(item.cost * state.player.shopDiscount);
    if (state.player.gold < cost) return;
    
    state.player.gold -= cost;
    
    if (item.effect === 'heal') {
        state.player.hp = Math.min(state.player.hp + item.amount, state.player.maxHp);
        addLog(`Bought potion!`);
    } else if (item.effect === 'xp') {
        state.player.exp += item.amount;
        addLog(`Bought XP!`);
        checkLevelUp();
    } else if (item.effect === 'weapon') {
        state.player.weaponLvl = item.level;
        state.player.atk = 3 + state.player.lvl + (item.level * 2);
        addLog(`Weapon: Lvl ${item.level}!`);
    } else if (item.effect === 'armor') {
        state.player.armorLvl = item.level;
        state.player.def = 1 + Math.floor(state.player.lvl / 2) + (item.level * 1);
        addLog(`Armor: Lvl ${item.level}!`);
    }
    
    render();
    renderShop();
}

function generatePerks() {
    state.floorPerks = [];
    let numPerks = Math.floor(state.level / 3) + 1;
    const shuffled = PERKS.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numPerks && i < shuffled.length; i++) {
        const perk = shuffled[i];
        state.floorPerks.push(perk);
        
        if (perk.effect === 'dmgBoost') state.player.dmgBoost = perk.value;
        else if (perk.effect === 'goldBoost') state.player.goldBoost = perk.value;
        else if (perk.effect === 'shopDiscount') state.player.shopDiscount = perk.value;
        else if (perk.effect === 'hpBoost') {
            state.player.maxHp += perk.value;
        }
        else if (perk.effect === 'noPoisonImmune') state.player.noPoisonImmune = true;
    }
    
    addLog(`Floor ${state.level} perks!`);
}

function showDeathScreen() {
    const statsHtml = `
        <div>FLOOR: ${state.level}</div>
        <div>LEVEL: ${state.player.lvl}</div>
        <div>GOLD: ${state.player.gold}</div>
        <div>ENEMIES KILLED: ${Math.floor(state.player.gold / 20)}</div>
    `;
    document.getElementById('deathStats').innerHTML = statsHtml;
    document.getElementById('deathModal').classList.add('active');
}

function restartGame() {
    state = {
        player: { 
            x: 0, y: 0, 
            hp: 10, maxHp: 10, 
            atk: 3, def: 1, 
            lvl: 1, exp: 0, nextExp: 10, 
            gold: 100,
            weaponLvl: 1,
            armorLvl: 1,
            statusEffects: {},
            dmgBoost: 0,
            goldBoost: 1,
            shopDiscount: 1,
            noPoisonImmune: false
        },
        level: 1,
        floorPerks: [],
        dungeon: [],
        roomTypes: {},
        enemies: [],
        items: [],
        log: [],
        canMove: true,
        shopOpen: false,
        infoOpen: false
    };
    document.getElementById('deathModal').classList.remove('active');
    generateDungeon();
    render();
    addLog(`Floor ${state.level}!`);
}

function checkLevelUp() {
    while (state.player.exp >= state.player.nextExp) {
        state.player.lvl++;
        state.player.exp -= state.player.nextExp;
        state.player.nextExp = 10 + state.player.lvl * 5;
        state.player.maxHp += 5;
        state.player.atk = 3 + state.player.lvl + (state.player.weaponLvl * 2);
        addLog(`LVL UP ${state.player.lvl}!`);
    }
}

function addLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 3) state.log.pop();
    updateLog();
}

function updateLog() {
    let html = state.log.map(m => `> ${m}`).join('<br>');
    document.getElementById('info').innerHTML = html;
}

function generateDungeon() {
    state.dungeon = [];
    state.roomTypes = {};
    
    for (let y = 0; y < GRID_H; y++) {
        state.dungeon[y] = [];
        for (let x = 0; x < GRID_W; x++) {
            if (x === 0 || x === GRID_W - 1 || y === 0 || y === GRID_H - 1) {
                state.dungeon[y][x] = '#';
            } else {
                state.dungeon[y][x] = '.';
            }
        }
    }
    
    const startX = Math.floor(GRID_W / 2);
    const startY = Math.floor(GRID_H / 2);
    state.dungeon[startY][startX] = '.';
    state.player.x = startX;
    state.player.y = startY;
    
    for (let y = 1; y < GRID_H - 1; y++) {
        for (let x = 1; x < GRID_W - 1; x++) {
            if (Math.random() < 0.1) state.dungeon[y][x] = '#';
        }
    }
    
    for (let i = 0; i < 2; i++) {
        let x, y, type;
        const rand = Math.random();
        if (rand < 0.33) type = 'treasure';
        else if (rand < 0.66) type = 'trap';
        else type = 'safe';
        
        do {
            x = Math.floor(Math.random() * (GRID_W - 4)) + 2;
            y = Math.floor(Math.random() * (GRID_H - 4)) + 2;
        } while (state.dungeon[y][x] !== '.' || (Math.abs(x - state.player.x) < 2 && Math.abs(y - state.player.y) < 2));
        
        state.dungeon[y][x] = type[0].toUpperCase();
        state.roomTypes[`${x},${y}`] = type;
    }
    
    state.enemies = [];
    const enemyCount = 2 + Math.floor(state.level / 2);
    for (let i = 0; i < enemyCount; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * (GRID_W - 4)) + 2;
            y = Math.floor(Math.random() * (GRID_H - 4)) + 2;
        } while (state.dungeon[y][x] !== '.' || (Math.abs(x - state.player.x) < 3 && Math.abs(y - state.player.y) < 3));
        
        const types = Object.keys(ENEMY_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];
        const baseData = ENEMY_TYPES[type];
        const hp = baseData.hp + state.level * 2;
        
        state.enemies.push({
            x, y, type,
            hp, maxHp: hp,
            atk: baseData.atk + state.level,
            def: 0,
            char: baseData.char
        });
    }
    
    state.items = [];
    for (let i = 0; i < 1 + state.level; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * (GRID_W - 4)) + 2;
            y = Math.floor(Math.random() * (GRID_H - 4)) + 2;
        } while (state.dungeon[y][x] !== '.' || state.enemies.some(e => e.x === x && e.y === y));
        
        const goldAmount = 20 + state.level * 10;
        state.items.push({ x, y, type: 'gold', amount: goldAmount });
    }
    
    generatePerks();
}

function render() {
    let html = '';
    for (let y = 0; y < GRID_H; y++) {
        html += '<div class="row">';
        for (let x = 0; x < GRID_W; x++) {
            let content = ' ';
            let cls = 'cell';
            
            const roomKey = `${x},${y}`;
            if (state.dungeon[y][x] === '#') {
                cls += ' wall';
            } else if (state.dungeon[y][x] === 'T') {
                cls += ' treasure';
                content = 'T';
            } else if (state.dungeon[y][x] === '!') {
                cls += ' trap';
                content = '!';
            } else if (state.roomTypes[roomKey] === 'safe') {
                cls += ' safe';
                content = 'S';
            } else {
                cls += ' floor';
            }
            
            if (state.player.x === x && state.player.y === y) {
                cls = 'cell player';
                content = '@';
            }
            
            const enemy = state.enemies.find(e => e.x === x && e.y === y);
            if (enemy) {
                cls = 'cell enemy';
                content = enemy.char;
            }
            
            const item = state.items.find(it => it.x === x && it.y === y);
            if (item) {
                cls = 'cell gold';
                content = '$';
            }
            
            html += `<div class="${cls}">${content}</div>`;
        }
        html += '</div>';
    }
    document.getElementById('dungeon').innerHTML = html;
    
    document.getElementById('hp').textContent = state.player.hp;
    document.getElementById('playerLvl').textContent = state.player.lvl;
    document.getElementById('exp').textContent = state.player.exp;
    document.getElementById('gold').textContent = state.player.gold;
    document.getElementById('level').textContent = state.level;
    document.getElementById('weaponLvl').textContent = state.player.weaponLvl;
    document.getElementById('armorLvl').textContent = state.player.armorLvl;
    
    document.getElementById('hpBar').style.width = (state.player.hp / state.player.maxHp * 100) + '%';
    document.getElementById('expBar').style.width = (state.player.exp / state.player.nextExp * 100) + '%';
}

function movePlayer(dx, dy) {
    if (!state.canMove || state.player.hp <= 0 || state.shopOpen || state.infoOpen) return;
    state.canMove = false;
    setTimeout(() => { state.canMove = true; }, 100);
    
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    
    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H || state.dungeon[ny][nx] === '#') {
        state.canMove = true;
        return;
    }
    
    if (state.player.statusEffects.bleed) {
        state.player.hp -= STATUS_EFFECTS.bleed.dmgOnMove;
        addLog(`Bleed: -1 HP`);
    }
    
    const roomKey = `${nx},${ny}`;
    const roomType = state.roomTypes[roomKey];
    
    if (roomType === 'trap') {
        state.player.hp -= 2;
        addLog(`Trap! -2 HP`);
        delete state.roomTypes[roomKey];
    } else if (roomType === 'treasure') {
        state.player.gold += 50;
        addLog(`Treasure! +50g`);
        delete state.roomTypes[roomKey];
    } else if (roomType === 'safe') {
        state.player.hp = Math.min(state.player.hp + 3, state.player.maxHp);
        addLog(`Safe room! +3 HP`);
    }
    
    const enemy = state.enemies.find(e => e.x === nx && e.y === ny);
    if (enemy) {
        fight(enemy);
        moveEnemies();
        updateStatusEffects();
        render();
        return;
    }
    
    const item = state.items.find(it => it.x === nx && it.y === ny);
    if (item) {
        const goldAmount = Math.floor(item.amount * state.player.goldBoost);
        state.player.gold += goldAmount;
        addLog(`+${goldAmount}g`);
        state.items = state.items.filter(it => it !== item);
    }
    
    state.player.x = nx;
    state.player.y = ny;
    moveEnemies();
    updateStatusEffects();
    render();
}

function updateStatusEffects() {
    if (state.player.statusEffects.poison && !state.player.noPoisonImmune) {
        state.player.hp -= STATUS_EFFECTS.poison.dmgPerTurn;
        addLog(`Poison: -1 HP`);
    }
    if (state.player.statusEffects.stun) {
        state.player.statusEffects.stun--;
        if (state.player.statusEffects.stun <= 0) {
            delete state.player.statusEffects.stun;
            addLog(`Unstunned!`);
        }
    }
}

function fight(enemy) {
    const dmgBoost = 1 + state.player.dmgBoost;
    const dmg = Math.max(1, (state.player.atk + Math.floor(Math.random() * 3)) * dmgBoost - enemy.def);
    enemy.hp -= dmg;
    addLog(`Hit ${Math.floor(dmg)}!`);
    
    if (enemy.hp <= 0) {
        state.enemies = state.enemies.filter(e => e !== enemy);
        const goldReward = Math.floor((20 + state.level * 10) * state.player.goldBoost);
        const expReward = 10 + state.level * 3;
        state.player.exp += expReward;
        state.player.gold += goldReward;
        addLog(`Kill +${expReward}EXP +${goldReward}g`);
        checkLevelUp();
        
        if (state.enemies.length === 0) {
            state.level++;
            generateDungeon();
            addLog(`Floor ${state.level}!`);
        }
    } else {
        const eDmg = Math.max(1, enemy.atk - state.player.def);
        state.player.hp -= eDmg;
        addLog(`Hit ${eDmg}!`);
        
        const statusChance = Math.random();
        if (statusChance < 0.15 && !state.player.noPoisonImmune) {
            state.player.statusEffects.poison = true;
            addLog(`Poisoned!`);
        } else if (statusChance < 0.3) {
            state.player.statusEffects.bleed = true;
            addLog(`Bleeding!`);
        } else if (statusChance < 0.4) {
            state.player.statusEffects.stun = 1;
            addLog(`Stunned!`);
        }
        
        if (state.player.hp <= 0) {
            addLog(`DEAD`);
            showDeathScreen();
        }
    }
}

function moveEnemies() {
    state.enemies.forEach(enemy => {
        if (Math.random() < 0.6) {
            const directions = [];
            if (state.player.x > enemy.x) directions.push([1, 0]);
            if (state.player.x < enemy.x) directions.push([-1, 0]);
            if (state.player.y > enemy.y) directions.push([0, 1]);
            if (state.player.y < enemy.y) directions.push([0, -1]);
            
            if (directions.length > 0) {
                const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
                const nx = enemy.x + dx;
                const ny = enemy.y + dy;
                
                if (state.dungeon[ny] && state.dungeon[ny][nx] === '.' && !state.enemies.some(e => e.x === nx && e.y === ny) && state.roomTypes[`${nx},${ny}`] !== 'safe') {
                    enemy.x = nx;
                    enemy.y = ny;
                    
                    if (enemy.x === state.player.x && enemy.y === state.player.y) {
                        fight(enemy);
                    }
                }
            }
        }
    });
}

adjustGridSize();
generateDungeon();
render();
addLog(`Floor ${state.level}!`);
