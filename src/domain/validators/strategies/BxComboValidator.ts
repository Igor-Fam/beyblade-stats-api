import { Part } from '@prisma/client';
import { IComboValidator } from '../IComboValidator';


export class BxComboValidator implements IComboValidator {
    public validate(parts: Part[]): boolean {
        console.log(`[BX Validator] Validating ${parts.length} parts...`);
        return true;
    }
}
