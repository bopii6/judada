import { Router } from "express";
import { dictionaryService } from "../services";

const router = Router();

router.get("/:word", async (req, res, next) => {
    try {
        const { word } = req.params;
        const definition = await dictionaryService.lookup(word);
        res.json({ definition });
    } catch (error) {
        next(error);
    }
});

export default router;
