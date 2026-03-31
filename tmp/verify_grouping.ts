import { StatsService } from '../src/services/StatsService';

async function verify() {
    const service = new StatsService();
    console.log('--- Verifying Stats Grouping ---');
    
    try {
        const parts = await service.getPartsList();
        const lockChips = parts.filter(p => p.type === 'LOCK_CHIP');
        
        console.log('Lock Chips found in list:', lockChips.length);
        lockChips.forEach(p => {
            console.log(`- ID: ${p.id}, Name: ${p.name}, Battles: ${p.totalMatches}`);
        });

        if (lockChips.length > 2) {
            console.error('FAILED: More than 2 Lock Chip entries found!');
        } else {
            console.log('SUCCESS: Grouping confirmed in Parts List.');
        }

        for (const lc of lockChips) {
            console.log(`\nChecking details for ID: ${lc.id} (${lc.name})`);
            const details = await service.getPartDetails(lc.id);
            console.log(`- Details Name: ${details.name}`);
            console.log(`- Total Matches: ${details.totalMatches}`);
            console.log(`- Best Partners: ${details.bestPartners.length}`);
            
            if (details.id !== lc.id) {
                console.error(`FAILED: ID mismatch. Expected ${lc.id}, got ${details.id}`);
            }
        }

    } catch (error) {
        console.error('Verification failed with error:', error);
    }
}

verify();
