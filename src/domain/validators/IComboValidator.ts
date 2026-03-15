import { Part } from '@prisma/client';

/**
 * Interface base para todas as estratégias de validação de Combos (linhas BX, UX, etc).
 */
export interface IComboValidator {
    /**
     * Valida se uma lista de peças forma um combo válido para determinada linha.
     * Deve laçar um AppError caso o combo seja inválido.
     * 
     * @param parts Lista de peças que compõem o Beyblade.
     * @returns boolean Verdadeiro se o combo for válido.
     */
    validate(parts: Part[]): boolean;
}
