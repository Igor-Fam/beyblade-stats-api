import { Part, PartType } from '../../../prisma/generated/client';

export type ComboPart = Part & {
    partType: PartType;
};


export interface IComboValidator {
    /**
     * Valida se uma lista de peças forma um combo válido para determinada linha.
     * Deve lançar um AppError caso o combo seja inválido.
     * 
     * @param parts Lista de peças completas que compõem o Beyblade.
     * @returns boolean Verdadeiro se o combo for válido.
     */
    validate(parts: ComboPart[]): boolean;
}
