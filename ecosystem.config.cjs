const path = require("node:path");

const ROOT_DIR = __dirname;
const resolvePath = relativePath => path.join(ROOT_DIR, relativePath);

const SERVER_PORT = process.env.PORT || process.env.SERVER_PORT || 4000;
const ADMIN_PORT = process.env.ADMIN_PORT || 4173;

module.exports = {
  apps: [
    {
      name: "judada-server",
      cwd: ROOT_DIR,
      script: resolvePath("apps/server/dist/index.js"),
      instances: process.env.SERVER_INSTANCES || "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: SERVER_PORT
      },
      error_file: resolvePath("logs/server-error.log"),
      out_file: resolvePath("logs/server-out.log"),
      log_file: resolvePath("logs/server-combined.log"),
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
      time: true
    },
    {
      name: "judada-worker",
      cwd: ROOT_DIR,
      script: resolvePath("apps/server/dist/workers/packageGeneration.worker.js"),
      exec_mode: "fork",
      instances: process.env.WORKER_INSTANCES || 1,
      env: {
        NODE_ENV: "production"
      },
      error_file: resolvePath("logs/worker-error.log"),
      out_file: resolvePath("logs/worker-out.log"),
      time: true,
      max_memory_restart: "512M"
    },
    {
      name: "judada-admin",
      cwd: ROOT_DIR,
      script: resolvePath("apps/admin/server.mjs"),
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: ADMIN_PORT,
        ADMIN_PORT
      },
      error_file: resolvePath("logs/admin-error.log"),
      out_file: resolvePath("logs/admin-out.log"),
      time: true,
      watch: false
    }
  ]
};

