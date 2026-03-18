import { IComboValidator } from './IComboValidator';


export class ComboValidatorFactory {
    private static validators: Map<string, IComboValidator> = new Map();


    // Registra um validador para uma linha específica.
    public static register(lineName: string, validator: IComboValidator): void {
        this.validators.set(lineName.toUpperCase(), validator);
    }

    //Retorna o validador adequado para a linha.
    public static getValidator(lineName: string): IComboValidator {
        const validator = this.validators.get(lineName.toUpperCase());

        if (!validator) {
            throw new Error(`Validator not found for line: ${lineName}`);
        }

        return validator;
    }
}
