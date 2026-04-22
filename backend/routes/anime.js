import express from "express";
import { searchAnime, getAnimeInfo, getEpisodeLinks } from "../scrapers/animeav1.service.js";
import { ApiError } from "../utils/api-error.js";

const router = express.Router();

// GET /api/anime/search?q=naruto
router.get("/search", async (req, res, next) => {
  try {
    const { q, domain } = req.query;

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      throw new ApiError(400, "El parametro 'q' es requerido para buscar anime");
    }

    const result = await searchAnime(q, domain);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/info?url=https://animeav1.com/media/naruto
router.get("/info", async (req, res, next) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      throw new ApiError(400, "El parametro 'url' es requerido");
    }

    const result = await getAnimeInfo(url);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/anime/episode?url=https://animeav1.com/media/naruto/1&includeMega=false&excludeServers=pdrain
router.get("/episode", async (req, res, next) => {
  try {
    const { url, includeMega, excludeServers } = req.query;

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      throw new ApiError(400, "El parametro 'url' es requerido");
    }

    const result = await getEpisodeLinks(url, includeMega, excludeServers);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
