import { createApp } from "./app";
import { getEnv } from "./config/env";

const { PORT } = getEnv();
const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
