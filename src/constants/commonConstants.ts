export const getAllowedOrigins = () =>
  [process.env.CLIENT_ORIGIN_DEV, process.env.CLIENT_ORIGIN_PROD].filter(
    Boolean,
  ); // removes undefined/null if any env is missing
