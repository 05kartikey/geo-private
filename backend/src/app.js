import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import proofRoutes from "./routes/proof.js";
import { connectDB } from "./db/mongo.js";
import { redis } from "./services/nonceService.js";

connectDB();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());

app.use("/api", (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

const rateLimitOptions = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 20
};

if (redis) {
  const { RedisStore } = await import("rate-limit-redis");
  rateLimitOptions.store = new RedisStore({
    sendCommand: (...args) => redis.call(...args)
  });
}

app.use("/api", rateLimit(rateLimitOptions));
app.use("/api", proofRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
