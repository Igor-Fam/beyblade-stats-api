import { IComboValidator, ComboPart } from '../IComboValidator';
import { AppError } from '../../../errors/AppError';

import { PartTypes } from '../../enums/PartTypes';

interface PartMetadata {
    consumesSlots?: string[];
    allowedRatchetHeights?: number[];
}

export class StandardComboValidator implements IComboValidator {
    private requiredSlots: string[];

    constructor(requiredSlots: string[]) {
        this.requiredSlots = requiredSlots;
    }

    public validate(parts: ComboPart[]): boolean {
        const providedPartTypes = parts.reduce((types: string[], part) => {
            const partType = part.partType.name.toUpperCase();
            checkAndPush(this.requiredSlots, types, partType);

            const metadata = part.metadata as unknown as PartMetadata | null;

            if (metadata) {
                metadata.consumesSlots?.forEach(consumedSlot => {
                    const slotSlug = consumedSlot.toUpperCase();
                    checkAndPush(this.requiredSlots, types, slotSlug);
                });
            }

            return types;
        }, []);

        if (this.requiredSlots.length !== providedPartTypes.length || this.requiredSlots.some(slot => !providedPartTypes.includes(slot))) {
            throw new AppError(`Error: mismatched part types for this line.`);
        }

        const ratchetPart = parts.find(p => p.partType.name.toUpperCase() === PartTypes.RATCHET);

        for (const part of parts) {
            const metadata = part.metadata as unknown as PartMetadata | null;

            if (metadata?.allowedRatchetHeights) {

                if (!ratchetPart) {
                    throw new AppError(`Error: The part '${part.name}' requires a specific Ratchet height, but no Ratchet was found in the combo (incompatible with integrated Bits like Turbo).`);
                }

                const heightStr = ratchetPart.name.split('-')[1];
                const heightNum = heightStr ? parseInt(heightStr, 10) : NaN;

                const heightEndsWith = heightNum % 10;

                if (!metadata.allowedRatchetHeights.includes(heightEndsWith)) {
                    throw new AppError(`Error: The part '${part.name}' requires a Ratchet with height ending in ${metadata.allowedRatchetHeights.join(' or ')}. You provided '${ratchetPart.name}'.`);
                }

                for (const p of parts) {
                    const otherMetadata = p.metadata as unknown as PartMetadata | null;

                    if ((otherMetadata?.consumesSlots || []).includes(PartTypes.RATCHET)) {
                        throw new AppError(`Error: The part '${part.name}' is not compatible with '${p.name}'.`);
                    }
                }
            }
        }

        return true;
    }
}

function checkAndPush(requiredSlots: string[], types: string[], partType: string): void {
    if (!requiredSlots.includes(partType)) {
        throw new AppError("Error: Invalid part type");
    }

    if (types.includes(partType)) {
        throw new AppError("Error: Duplicated part type.");
    }

    types.push(partType);
}