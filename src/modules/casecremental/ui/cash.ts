// The SDK's useAnimatedNumber counts in whole numbers, which turns $8.49 into "$8.00"; the HUD
// counts in cents instead.

export const toCents = (cash: number): number => Math.round(cash * 100);
export const fromCents = (cents: number): number => cents / 100;
