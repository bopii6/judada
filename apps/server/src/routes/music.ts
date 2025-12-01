import { Router } from "express";

import { musicTrackService } from "../services";

const router = Router();

router.get("/tracks", async (_req, res, next) => {
  try {
    const tracks = await musicTrackService.listPublished();
    res.json({ tracks });
  } catch (error) {
    next(error);
  }
});

router.get("/tracks/:slug", async (req, res, next) => {
  try {
    const track = await musicTrackService.getPublishedBySlug(req.params.slug);
    res.json({ track });
  } catch (error) {
    next(error);
  }
});

export default router;
