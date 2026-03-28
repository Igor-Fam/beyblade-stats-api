import { useState, useEffect } from 'react';

export type Language = 'en' | 'pt';

const translations = {
  en: {
    // General
    hub: 'Hub',
    cancel: 'Cancel',
    reset: 'Reset',
    remove: 'Remove',
    custom: 'Custom',
    btn_clear: 'Clear',

    // Battle Logger
    logger_title: 'Battle Logger',
    rotate_device: 'Rotate your device',
    rotate_desc: 'The Battle Logger requires landscape mode to perfectly fit the arena and avoid blind scrolling.',
    stadium_placeholder: '-- Stadium --',
    reset_score_title: 'Reset Score',
    undo_last: 'Undo last battle',
    battle_history: 'Battle history',

    // Hub
    hub_title: 'Beyblade X Hub',
    hub_logger_desc: 'Register matches, test setups, and tally performance.',
    hub_stats_title: 'Statistics',
    hub_stats_desc: 'Coming Soon: Analyze matchups, metagame trends, and counters.',

    // Status/Toasts
    status_select_stadium: 'Please select a stadium!',
    status_select_lines: 'Please select a line for both combos!',
    status_undo_success: 'Last battle undone!',
    status_undo_error: 'Failed to undo: ',
    status_battle_logged: 'Battle Logged: Combo {winner} won by {type}!',
    status_save_error: 'Error saving battle',
    status_remove_error: 'Failed to remove: ',

    // Modals
    history_title: 'Session Battles',
    history_empty: 'No battles this session',
    history_reset_label: 'LATEST SCORE RESET',
    reset_modal_title: 'Reset Scoreboard',
    reset_modal_desc: 'Are you sure you want to reset both scores to 0?',

    // Combo Card
    combo_title: 'Combo {id}',
    line_label: 'Line',
    select_line: 'Select Line',
    fav_tooltip: 'Favorite this combo',
    unfav_tooltip: 'Unfavorite',
    load_favs: 'Load Favorites',
    load_history: 'Load History',
    no_combos: 'No combos found',
    fav_alert: 'Select a Line and Parts to favorite!',
    custom_combo: 'Custom Combo',
    clear_history: 'Clear History',
    clear_history_confirm_title: 'Clear Combo History',
    clear_history_confirm_desc: 'Are you sure you want to delete all recently used combos from this list?',

    // Stats Page
    stats_title: 'Parts Statistics',
    stats_loading: 'Calculating ratings...',
    stats_empty: 'No battle data yet.',
    stats_ranking_mode: 'Ranking by',
    col_part: 'Part',
    col_type: 'Type',
    col_elo: 'Elo',
    col_bp: 'BP',
    col_avg_pts: 'Avg. Pts',
    col_battles: 'Battles',
    col_wins: 'Wins',
    col_losses: 'Losses',
    col_winrate: 'Win Rate',
    col_scoring_rate: 'Scoring Rate',
    col_points_gained: 'Points Gained',
    col_points_conceded: 'Points Conceded',
    back_to_stats: 'Back to Stats',
    best_synergies: 'Best Synergies',
    best_synergies_desc: 'Parts that result in a higher scoring rate when used in the same combo.',
    best_counters: 'Best Counters',
    best_counters_desc: 'Parts against which this piece performs worse (lowest average points).',
    no_analytics_data: 'Not enough data (min. 10 battles).',
    win_finishes: 'Winning Methods',
    loss_finishes: 'Losing Methods',
    finish_spin: 'Spin Finish',
    finish_over: 'Over Finish',
    finish_burst: 'Burst Finish',
    finish_xtreme: 'Xtreme Finish',
    tag_dependent: 'Dependent',
    dependency_modal_title: 'Dependency Analysis',
    dependency_modal_desc: 'This part earned more than 70% of its total points in conjunction with the following parts:',
    btn_add_filter: 'Add Filter',
    filter_op_eq: 'Equals',
    filter_op_gt: 'Greater than',
    filter_op_gte: 'Greater or equal',
    filter_op_lt: 'Less than',
    filter_op_lte: 'Less or equal',
    modal_filter_title: 'Filters',
    btn_clear_filters: 'Clear All',
    btn_filters: 'Filters',
  },
  pt: {
    // General
    hub: 'Início',
    cancel: 'Cancelar',
    reset: 'Resetar',
    remove: 'Remover',
    custom: 'Customizado',
    btn_clear: 'Limpar',

    // Battle Logger
    logger_title: 'Log de Batalha',
    rotate_device: 'Gire seu dispositivo',
    rotate_desc: 'O Battle Logger exige o modo horizontal para enquadrar perfeitamente a arena e evitar rolagens cegas.',
    stadium_placeholder: '-- Arena --',
    reset_score_title: 'Resetar Placar',
    undo_last: 'Desfazer última',
    battle_history: 'Histórico',

    // Hub
    hub_title: 'Painel Central',
    hub_logger_desc: 'Registre partidas, teste setups e contabilize performance.',
    hub_stats_title: 'Estatísticas',
    hub_stats_desc: 'Em Breve: Analise confrontos, tendências de metagame e counters.',

    // Status/Toasts
    status_select_stadium: 'Por favor, selecione uma arena!',
    status_select_lines: 'Selecione as linhas de ambos os combos!',
    status_undo_success: 'Última batalha desfeita!',
    status_undo_error: 'Falha ao desfazer: ',
    status_battle_logged: 'Batalha registrada: Combo {winner} venceu por {type}!',
    status_save_error: 'Erro ao salvar batalha',
    status_remove_error: 'Falha ao remover: ',

    // Modals
    history_title: 'Batalhas da Sessão',
    history_empty: 'Nenhuma batalha nesta sessão',
    history_reset_label: 'ÚLTIMO RESET DE PLACAR',
    reset_modal_title: 'Resetar Placar',
    reset_modal_desc: 'Tem certeza que deseja zerar os scores?',

    // Combo Card
    combo_title: 'Combo {id}',
    line_label: 'Linha',
    select_line: 'Selecionar Linha',
    fav_tooltip: 'Favoritar este combo',
    unfav_tooltip: 'Desfavoritar',
    load_favs: 'Carregar Favoritos',
    load_history: 'Carregar Histórico',
    no_combos: 'Nenhum combo encontrado',
    fav_alert: 'Selecione uma Linha e Peças para favoritar!',
    custom_combo: 'Combo Customizado',
    clear_history: 'Limpar Histórico',
    clear_history_confirm_title: 'Limpar Histórico de Combos',
    clear_history_confirm_desc: 'Tem certeza que deseja apagar todos os combos usados recentemente desta lista?',

    // Stats Page
    stats_title: 'Estatísticas de Peças',
    stats_loading: 'Calculando ratings...',
    stats_empty: 'Sem dados de batalha ainda.',
    stats_ranking_mode: 'Ranking por',
    col_part: 'Peça',
    col_type: 'Tipo',
    col_elo: 'Elo',
    col_bp: 'BP',
    col_avg_pts: 'Pts Méd.',
    col_battles: 'Batalhas',
    col_wins: 'Vitórias',
    col_losses: 'Derrotas',
    col_winrate: 'Taxa',
    col_scoring_rate: 'Taxa Pont.',
    col_points_gained: 'Pontos Ganhos',
    col_points_conceded: 'Pontos Cedidos',
    back_to_stats: 'Voltar para Estatísticas',
    best_synergies: 'Melhores Sinergias',
    best_synergies_desc: 'Peças que resultam em uma maior taxa de pontuação quando usadas no mesmo combo.',
    best_counters: 'Melhores Counters',
    best_counters_desc: 'Peças contra as quais esta peça tem o pior desempenho (menor média de pontos).',
    no_analytics_data: 'Dados insuficientes (mín. 10 batalhas).',
    win_finishes: 'Como venceu',
    loss_finishes: 'Como perdeu',
    finish_spin: 'Spin Finish',
    finish_over: 'Over Finish',
    finish_burst: 'Burst Finish',
    finish_xtreme: 'Xtreme Finish',
    tag_dependent: 'Dependente',
    dependency_modal_title: 'Análise de Dependência',
    dependency_modal_desc: 'Esta peça obteve mais de 70% de seus pontos totais em conjunto com as seguintes peças:',
    btn_add_filter: 'Adicionar Filtro',
    filter_op_eq: 'Igual a',
    filter_op_gt: 'Maior que',
    filter_op_gte: 'Maior ou igual a',
    filter_op_lt: 'Menor que',
    filter_op_lte: 'Menor ou igual a',
    modal_filter_title: 'Filtros',
    btn_clear_filters: 'Limpar Todos',
    btn_filters: 'Filtros',
  }
};

export function getLanguage(): Language {
  const saved = localStorage.getItem('app_lang');
  if (saved === 'en' || saved === 'pt') return saved;

  // Auto-detect browser language
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('pt') ? 'pt' : 'en';
}

export function setLanguage(lang: Language) {
  localStorage.setItem('app_lang', lang);
  window.dispatchEvent(new Event('languagechange'));
}

export function useTranslation() {
  const [lang, setLang] = useState<Language>(getLanguage());

  useEffect(() => {
    const handleLangChange = () => setLang(getLanguage());
    window.addEventListener('languagechange', handleLangChange);
    return () => window.removeEventListener('languagechange', handleLangChange);
  }, []);

  const t = (key: keyof typeof translations.en, params?: Record<string, string | number>) => {
    let text = translations[lang][key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return { t, lang, setLanguage };
}
