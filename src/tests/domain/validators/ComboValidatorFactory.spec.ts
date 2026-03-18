/// <reference types="jest" />
import { ComboValidatorFactory } from '../../../domain/validators/ComboValidatorFactory';
import { StandardComboValidator } from '../../../domain/validators/strategies/StandardComboValidator';
import { PartTypes } from '../../../domain/enums/PartTypes';

describe('ComboValidatorFactory', () => {

    beforeAll(() => {
        ComboValidatorFactory.register('BX', new StandardComboValidator([PartTypes.BLADE, PartTypes.RATCHET, PartTypes.BIT]));
        ComboValidatorFactory.register('UX', new StandardComboValidator([PartTypes.BLADE, PartTypes.RATCHET, PartTypes.BIT]));
        ComboValidatorFactory.register('CX', new StandardComboValidator([PartTypes.LOCK_CHIP, PartTypes.MAIN_BLADE, PartTypes.ASSIST_BLADE, PartTypes.RATCHET, PartTypes.BIT]));
    });

    it('should return the correct validator instance for registered Lines (BX, UX, CX)', () => {
        const bxValidator = ComboValidatorFactory.getValidator('BX');
        const uxValidator = ComboValidatorFactory.getValidator('uX');
        const cxValidator = ComboValidatorFactory.getValidator('cx');

        expect(bxValidator).toBeInstanceOf(StandardComboValidator);
        expect(uxValidator).toBeInstanceOf(StandardComboValidator);
        expect(cxValidator).toBeInstanceOf(StandardComboValidator);
    });

    it('should throw an Error if an unregistered Line is requested', () => {
        expect(() => ComboValidatorFactory.getValidator('XY')).toThrow(Error);
        expect(() => ComboValidatorFactory.getValidator('XY')).toThrow(/Validator not found for line: XY/);
    });

    it('should handle runtime registration of new Validators abstractly', () => {
        const mockCustomValidator = {
            validate: jest.fn().mockReturnValue(true)
        };

        ComboValidatorFactory.register('MFB', mockCustomValidator as any);

        const retrievedValidator = ComboValidatorFactory.getValidator('MFB');

        expect(retrievedValidator).toBe(mockCustomValidator);
    });
});
