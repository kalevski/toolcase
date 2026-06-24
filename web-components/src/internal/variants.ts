// Canonical Bootstrap variant allow-lists, shared by the components that validate
// a `variant` attribute. VARIANTS_FULL is the 8-colour set (incl. light/dark);
// VARIANTS_CORE drops light/dark for components that don't support them.
export const VARIANTS_FULL = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'] as const
export const VARIANTS_CORE = ['primary', 'secondary', 'success', 'danger', 'warning', 'info'] as const
