import express, { Express } from "express";
import { registerServerRoutes } from "./index";

export function createServerApp(): Express {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  registerServerRoutes(app);
  return app;
}

export default createServerApp;
