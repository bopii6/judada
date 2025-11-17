import { Router } from "express";
import { randomUUID } from "crypto";

const router = Router();

// 简单的设备ID生成接口，前端仅需一个稳定字符串即可
router.post("/", (_req, res) => {
  const deviceId = `device-${randomUUID()}`;
  res.json({ success: true, deviceId });
});

export default router;
