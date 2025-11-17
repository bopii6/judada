import { createApp } from "./app";
import { getEnv } from "./config/env";

const env = getEnv();
console.log('Environment variables:', { PORT: env.PORT, DATABASE_URL: env.DATABASE_URL ? 'set' : 'not set' });
const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
