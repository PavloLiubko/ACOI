import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import routerTraining from "./routes/trainings.js";
import routerCalories from "./routes/calories.js";
import routerProfile from "./routes/profile.js";
import { openapiSpec } from "./openapi.js";
import { connectDB } from "./DataBase/db.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.use("/api/trainings", routerTraining);
app.use("/api/calories", routerCalories);

app.use("/api/user", routerProfile);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

async function start(): Promise<void> {
    try {
        await connectDB();
        app.listen(3001, "0.0.0.0", () => {
            console.log("Server running on port 3001");
        });
    } catch (err) {
        console.error("DB connection failed:", err);
        process.exit(1);
    }
}

start();