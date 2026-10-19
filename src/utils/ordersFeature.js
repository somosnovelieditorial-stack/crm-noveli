// Build-time opt-in; the database capability remains mandatory for commands.
export const ordersUiEnabled = import.meta.env.VITE_PHASE_1A_ORDERS_ENABLED === 'true';
