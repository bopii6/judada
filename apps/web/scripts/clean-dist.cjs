const fs = require("node:fs");
const path = require("node:path");

const distPath = path.resolve(__dirname, "../dist");

const removeRecursive = targetPath => {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  const stats = fs.lstatSync(targetPath);
  if (stats.isDirectory()) {
    fs.chmodSync(targetPath, 0o777);
    for (const entry of fs.readdirSync(targetPath)) {
      removeRecursive(path.join(targetPath, entry));
    }
    fs.rmdirSync(targetPath);
  } else if (stats.isFile()) {
    fs.chmodSync(targetPath, 0o666);
    fs.unlinkSync(targetPath);
  }
};

try {
  if (fs.existsSync(distPath)) {
    removeRecursive(distPath);
    console.log(`[clean-dist] removed ${distPath}`);
  }
} catch (error) {
  console.warn(`[clean-dist] failed to remove ${distPath}:`, error.message);
}
