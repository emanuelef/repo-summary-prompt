// Shared mutable state — imported and mutated directly by all modules.
export const state = {
  metrics: {},
  chartViewMode: localStorage.getItem('chartViewMode') || '30d',
  hasGeneratedData: false,
  cachedReposList: [],
  rawPromptText: '',
  currentAbort: null,
  progressVisible: true,
  timerInterval: null,
  cooldownTimerInterval: null,
  stepStates: {},
  lastRepo: '',
  acActiveIndex: -1,
  acItems: [],
};
