/// <reference types="jest" />
import { StandardComboValidator } from '../../../domain/validators/strategies/StandardComboValidator';
import { PartTypes } from '../../../domain/enums/PartTypes';
import { ComboPart } from '../../../domain/validators/IComboValidator';
import { AppError } from '../../../errors/AppError';

describe('StandardComboValidator', () => {

    let validator: StandardComboValidator;

    beforeEach(() => {
        validator = new StandardComboValidator([PartTypes.BLADE, PartTypes.RATCHET, PartTypes.BIT]);
    });

    const createMockPart = (name: string, typeSlug: string, metadata: any = null): ComboPart => {
        return {
            id: Math.floor(Math.random() * 100),
            name: name,
            abbreviation: null,
            lineId: null,
            partTypeId: 1,
            metadata: metadata,
            partType: {
                id: 1,
                name: typeSlug
            }
        };
    };

    it('should return true for a perfectly valid standard 3-part combo', () => {
        const fakeCombo = [
            createMockPart('DranSword', PartTypes.BLADE),
            createMockPart('3-60', PartTypes.RATCHET),
            createMockPart('Flat', PartTypes.BIT)
        ];

        const isValid = validator.validate(fakeCombo);
        expect(isValid).toBe(true);
    });

    it('should throw AppError if a required slot is missing (e.g. no Blade)', () => {
        const fakeCombo = [
            createMockPart('3-60', PartTypes.RATCHET),
            createMockPart('Flat', PartTypes.BIT)
        ];

        expect(() => validator.validate(fakeCombo)).toThrow(AppError);
        expect(() => validator.validate(fakeCombo)).toThrow(/Error: mismatched part types/i);
    });

    it('should throw AppError if a ratchet-integrated Bit tries to assemble with a Ratchet simultaneously', () => {
        const fakeCombo = [
            createMockPart('DranSword', PartTypes.BLADE),
            createMockPart('3-60', PartTypes.RATCHET),
            createMockPart('Turbo', PartTypes.BIT, { consumesSlots: [PartTypes.RATCHET] })
        ];

        expect(() => validator.validate(fakeCombo)).toThrow(AppError);
    });

    it('should throw AppError if a Ratchet-sensitive Blade receives an unauthorized Ratchet height', () => {
        const fakeCombo = [
            createMockPart('ClockMirage', PartTypes.BLADE, { allowedRatchetHeights: [5] }),
            createMockPart('9-60', PartTypes.RATCHET),
            createMockPart('Ball', PartTypes.BIT)
        ];

        expect(() => validator.validate(fakeCombo)).toThrow(AppError);
        expect(() => validator.validate(fakeCombo)).toThrow(/requires a Ratchet with height ending in 5/);
    });

    it('should return true if a Ratchet-sensitive Blade receives an authorized Ratchet height', () => {
        const fakeCombo = [
            createMockPart('ClockMirage', PartTypes.BLADE, { allowedRatchetHeights: [5] }),
            createMockPart('4-55', PartTypes.RATCHET),
            createMockPart('Free Ball', PartTypes.BIT)
        ];

        const isValid = validator.validate(fakeCombo);
        expect(isValid).toBe(true);
    });
});
