/** Shared Hono context: set by `requireAuth()` middleware */
export type OishiEnv = {
  Variables: {
    wallet: string;
  };
};
