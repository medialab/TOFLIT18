/**
 * TOFLIT18 Express Application
 * =============================
 *
 * Simple express application serving the data of the TOFLIT18 project.
 */
import express from "express";
import wrap from "dolman";
import path from "path";
import config from "config";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import compress from "compression";
import morgan from "morgan";
import session from "express-session";
import createFileStore from "session-file-store";

import classificationController from "./controllers/classification";
import dataController from "./controllers/data";
import vizController from "./controllers/viz";

const FileStore = createFileStore(session),
  dolman = wrap(express);

/**
 * Initialization.
 */
const ENV = process.env.NODE_ENV || "dev";

/**
 * Configuring the application.
 */
const app = express();

// Cross-origin support
app.use(
  cors({
    credentials: true,
    origin(origin, next) {
      return next(null, !!~config.get("api.allowedOrigins").indexOf(origin));
    },
  }),
);

// Simple log
app.use(morgan("dev"));

// Session options
const sessionOptions = {
  name: "toflit18.sid",
  secret: config.get("api.secret"),
  trustProxy: false,
  resave: true,
  saveUninitialized: true,
};

// If dev, we would like to store sessions for convenience
if (ENV === "dev")
  sessionOptions.store = new FileStore({
    path: path.join(__dirname, "/../.output/sessions"),
    ttl: 24 * 60 * 60 * 60,
    reapInterval: -1,
  });

// Utilities
app.use(bodyParser.urlencoded({ limit: "5mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(session(sessionOptions));
app.use(compress());

/**
 * Routing & Mounting.
 */

// Creating routers from controllers
const dataRouter = dolman.router(dataController),
  classificationRouter = dolman.router(classificationController),
  vizRouter = dolman.router(vizController);

// Mounting
app.get("/api.json", (req, res) => res.json(dolman.specs(app)));
app.use(dataRouter);
app.use("/classification", classificationRouter);
app.use("/viz", vizRouter);
app.use((_, res) => res.notFound());

/**
 * Exporting.
 */
export default app;
