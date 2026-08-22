/** Shared ref so AppContext.navigate can change the real URL */
export const navigationRef: {
  current: ((path: string) => void) | null;
} = {
  current: null,
};