import { prisma } from '../database';

async function main() {
    console.log('🌱 Starting seed...');

    // --- Part Types ---
    console.log('Creating part types...');
    const [blade, ratchet, bit, lockChip, mainBlade, assistBlade] = await Promise.all([
        prisma.partType.upsert({ where: { name: 'BLADE' }, update: {}, create: { name: 'BLADE' } }),
        prisma.partType.upsert({ where: { name: 'RATCHET' }, update: {}, create: { name: 'RATCHET' } }),
        prisma.partType.upsert({ where: { name: 'BIT' }, update: {}, create: { name: 'BIT' } }),
        prisma.partType.upsert({ where: { name: 'LOCK_CHIP' }, update: {}, create: { name: 'LOCK_CHIP' } }),
        prisma.partType.upsert({ where: { name: 'MAIN_BLADE' }, update: {}, create: { name: 'MAIN_BLADE' } }),
        prisma.partType.upsert({ where: { name: 'ASSIST_BLADE' }, update: {}, create: { name: 'ASSIST_BLADE' } }),
    ]);
    console.log('- Part types created');

    // --- Lines ---
    console.log('Creating lines...');
    const [bx, ux, cx] = await Promise.all([
        prisma.line.upsert({ where: { name: 'BX' }, update: {}, create: { name: 'BX' } }),
        prisma.line.upsert({ where: { name: 'UX' }, update: {}, create: { name: 'UX' } }),
        prisma.line.upsert({ where: { name: 'CX' }, update: {}, create: { name: 'CX' } }),
    ]);
    console.log('- Lines created');

    // --- Blades ---
    console.log('Creating Blades...');

    const bxBlades = [
        "BearScratch",
        "BlackShell",
        "Bumblebee",
        "Captain America",
        "Chewbacca",
        "CobaltDragoon",
        "CobaltDrake",
        "CrimsonGaruda",
        "CrocCrunch",
        "Darth Vader",
        "DracielShield",
        "DragoonStorm",
        "DranDagger",
        "DranSword",
        "DranzerSpiral",
        "DrigerSlash",
        "General Grievous",
        "GoatTackle",
        "Green Goblin",
        "Grogu",
        "HellsChain",
        "HellsScythe",
        "Iron Man",
        "KnightLance",
        "KnightShield",
        "LeonClaw",
        "LightningL-Drago (Rapid-Hit)",
        "LightningL-Drago (Upper)",
        "Luke Skywalker",
        "MammothTusk",
        "Megatron",
        "Miles Morales",
        "Moff Gideon",
        "Obi-Wan Kenobi",
        "Optimus Primal",
        "Optimus Prime",
        "PhoenixFeather",
        "PhoenixWing",
        "PteraSwing",
        "Red Hulk",
        "RhinoHorn",
        "Rock Leone",
        "SamuraiCalibur",
        "SamuraiSteel",
        "SharkEdge",
        "SharkGill",
        "ShelterDrake",
        "ShinobiKnife",
        "SphinxCowl",
        "Spider-Man",
        "Starscream",
        "StormPegasis",
        "StormSpriggan",
        "Stormtrooper",
        "Thanos",
        "The Mandalorian",
        "TriceraPress",
        "TriceraSpiky",
        "TyrannoBeat",
        "TyrannoRoar",
        "UnicornSting",
        "Venom",
        "VictoryValkyrie",
        "ViperTail",
        "WeissTiger",
        "WhaleWave",
        "WizardArrow",
        "WyvernGale",
        "XenoXcalibur",
        "Yell Kong",
    ];

    const uxBlades = [
        "AeroPegasus",
        "ClockMirage",
        "DranBuster",
        "GhostCircle",
        "GolemRock",
        "Hack Viking",
        "HellsHammer",
        "ImpactDrake",
        "KnightMail",
        "LeonCrest",
        "MeteorDragoon",
        "MummyCurse",
        "OrochiCluster",
        "PhoenixRudder",
        "SamuraiSaber",
        "ScorpioSpear",
        "SharkScale",
        "ShinobiShadow",
        "SilverWolf",
        "Stun Medusa",
        "WizardRod",
        "WyvernHover",
    ];

    const bladeEntries: { name: string; lineId: number; metadata?: object }[] = [
        ...bxBlades.map(name => ({ name, lineId: bx.id })),
        ...uxBlades.map(name => ({ name, lineId: ux.id })),
        // Blades with metadata overrides:
        { name: 'ClockMirage', lineId: ux.id, metadata: { allowedRatchetHeights: [5] } },
    ];

    for (const { name, lineId, metadata } of bladeEntries) {
        await prisma.part.upsert({
            where: { id: (await prisma.part.findFirst({ where: { name, lineId } }))?.id ?? 0 },
            update: metadata ? { metadata } : {},
            create: { name, partTypeId: blade.id, lineId, ...(metadata ? { metadata } : {}) },
        });
    }
    console.log('- Blades created');

    // --- Ratchets ---
    console.log('Creating Ratchets...');
    const ratchets = [
        "0-60", "0-70", "0-80",
        "1-50", "1-60", "1-70", "1-80",
        "2-60", "2-70", "2-80",
        "3-60", "3-70", "3-80", "3-85",
        "4-50", "4-55", "4-60", "4-70", "4-80",
        "5-60", "5-70", "5-80",
        "6-60", "6-70", "6-80",
        "7-55", "7-60", "7-70", "7-80",
        "8-70",
        "9-60", "9-65", "9-70", "9-80",
        "M-85",
    ];

    for (const name of ratchets) {
        await prisma.part.upsert({
            where: { id: (await prisma.part.findFirst({ where: { name, lineId: null } }))?.id ?? 0 },
            update: {},
            create: { name, partTypeId: ratchet.id, lineId: null },
        });
    }
    console.log('- Ratchets created');

    // --- Bits ---
    console.log('Creating Bits...');
    const bits: { name: string; abbreviation: string; metadata?: object }[] = [
        { name: 'Flat', abbreviation: 'F' },
        { name: 'Taper', abbreviation: 'T' },
        { name: 'Ball', abbreviation: 'B' },
        { name: 'Needle', abbreviation: 'N' },
        { name: 'High Needle', abbreviation: 'HN' },
        { name: 'Low Flat', abbreviation: 'LF' },
        { name: 'Point', abbreviation: 'P' },
        { name: 'Orb', abbreviation: 'O' },
        { name: 'Rush', abbreviation: 'R' },
        { name: 'High Taper', abbreviation: 'HT' },
        { name: 'Spike', abbreviation: 'S' },
        { name: 'Gear Flat', abbreviation: 'GF' },
        { name: 'Gear Ball', abbreviation: 'GB' },
        { name: 'Gear Point', abbreviation: 'GP' },
        { name: 'Gear Needle', abbreviation: 'GN' },
        { name: 'Accel', abbreviation: 'A' },
        { name: 'Hexa', abbreviation: 'H' },
        { name: 'Disc Ball', abbreviation: 'DB' },
        { name: 'Quake', abbreviation: 'Q' },
        { name: 'Metal Needle', abbreviation: 'MN' },
        { name: 'Unite', abbreviation: 'U' },
        { name: 'Cyclone', abbreviation: 'C' },
        { name: 'Dot', abbreviation: 'D' },
        { name: 'Glide', abbreviation: 'G' },
        { name: 'Elevate', abbreviation: 'E' },
        { name: 'Free Ball', abbreviation: 'FB' },
        { name: 'Bound Spike', abbreviation: 'BS' },
        { name: 'Rubber Accel', abbreviation: 'RA' },
        { name: 'Level', abbreviation: 'L' },
        { name: 'Trans Point', abbreviation: 'TP' },
        { name: 'Low Rush', abbreviation: 'LR' },
        { name: 'Under Needle', abbreviation: 'UN' },
        { name: 'Vortex', abbreviation: 'V' },
        { name: 'Low Orb', abbreviation: 'LO' },
        { name: 'Wedge', abbreviation: 'W' },
        { name: 'Kick', abbreviation: 'K' },
        { name: 'Zap', abbreviation: 'Z' },
        { name: 'Gear Rush', abbreviation: 'GR' },
        { name: 'Turbo', abbreviation: 'Tr', metadata: { consumesSlots: ['RATCHET'] } },
        { name: 'Wall Ball', abbreviation: 'WB' },
        { name: 'Under Flat', abbreviation: 'UF' },
        { name: 'Merge', abbreviation: 'M' },
        { name: 'Trans Kick', abbreviation: 'TK' },
        { name: 'Operate', abbreviation: 'Op', metadata: { consumesSlots: ['RATCHET'] } },
        { name: 'Jolt', abbreviation: 'J' },
        { name: 'Wall Wedge', abbreviation: 'WW' },
        { name: 'Ignition', abbreviation: 'I' },
        { name: 'Yielding', abbreviation: 'Y' },
        { name: 'Free Flat', abbreviation: 'FF' },
    ];

    for (const { name, abbreviation, metadata } of bits) {
        await prisma.part.upsert({
            where: { id: (await prisma.part.findFirst({ where: { name, lineId: null } }))?.id ?? 0 },
            update: metadata ? { metadata } : {},
            create: { name, abbreviation, partTypeId: bit.id, lineId: null, ...(metadata ? { metadata } : {}) },
        });
    }
    console.log('- Bits created');

    // --- Lock Chips (CX Line) ---
    console.log('Creating Lock Chips...');
    
    // Deleta os Lock Chips antigos para garantir que a associação com a linha CX seja apagada
    await prisma.part.deleteMany({ where: { partType: { name: 'LOCK_CHIP' } } });

    const lockChips: { name: string; metadata?: object }[] = [
        { name: 'Bahamut' },
        { name: 'Cerberus' },
        { name: 'Dran' },
        { name: 'Emperor', metadata: { isMetal: true } },
        { name: 'Fox' },
        { name: 'Hells' },
        { name: 'Hornet' },
        { name: 'Knight' },
        { name: 'Kraken' },
        { name: 'Leon' },
        { name: 'Pegasus' },
        { name: 'Perseus' },
        { name: 'Phoenix' },
        { name: 'Ragna' },
        { name: 'Rhino' },
        { name: 'Sol' },
        { name: 'Stag' },
        { name: 'Valkyrie', metadata: { isMetal: true } },
        { name: 'Whale' },
        { name: 'Wizard' },
        { name: 'Wolf' },
    ];

    for (const { name, metadata } of lockChips) {
        await prisma.part.upsert({
            where: { id: (await prisma.part.findFirst({ where: { name, lineId: null } }))?.id ?? 0 },
            update: { lineId: null, ...(metadata ? { metadata } : {}) },
            create: { name, partTypeId: lockChip.id, lineId: null, ...(metadata ? { metadata } : {}) },
        });
    }
    console.log('- Lock Chips created');

    // --- Assist Blades ---
    console.log('Creating Assist Blades...');
    const assistBlades: { name: string; abbreviation: string }[] = [
        { name: 'Assault', abbreviation: 'A' },
        { name: 'Bumper', abbreviation: 'B' },
        { name: 'Charge', abbreviation: 'C' },
        { name: 'Dual', abbreviation: 'D' },
        { name: 'Erase', abbreviation: 'E' },
        { name: 'Free', abbreviation: 'F' },
        { name: 'Heavy', abbreviation: 'H' },
        { name: 'Jaggy', abbreviation: 'J' },
        { name: 'Knuckle', abbreviation: 'K' },
        { name: 'Massive', abbreviation: 'M' },
        { name: 'Round', abbreviation: 'R' },
        { name: 'Slash', abbreviation: 'S' },
        { name: 'Turn', abbreviation: 'T' },
        { name: 'Vertical', abbreviation: 'V' },
        { name: 'Wheel', abbreviation: 'W' },
        { name: 'Zillion', abbreviation: 'Z' },
    ];

    for (const { name, abbreviation } of assistBlades) {
        await prisma.part.upsert({
            where: { id: (await prisma.part.findFirst({ where: { name, lineId: null } }))?.id ?? 0 },
            update: { abbreviation, lineId: null },
            create: { name, abbreviation, partTypeId: assistBlade.id, lineId: null },
        });
    }
    console.log('- Assist Blades created');

    // --- Main Blades (CX Line) ---
    console.log('Creating Main Blades...');
    const mainBlades: string[] = [
        'Arc', 'Blast', 'Brave', 'Brush', 'Dark', 'Eclipse', 'Fang', 'Flame',
        'Flare', 'Fort', 'Hunt', 'Might', 'Reaper', 'Volt', 'Wriggle'
    ];

    for (const name of mainBlades) {
        await prisma.part.upsert({
            where: { id: (await prisma.part.findFirst({ where: { name, lineId: cx.id } }))?.id ?? 0 },
            update: { lineId: cx.id },
            create: { name, partTypeId: mainBlade.id, lineId: cx.id },
        });
    }
    console.log('- Main Blades created');

    console.log('Seed complete');


}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
