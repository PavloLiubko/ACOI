import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { getDB } from "../DataBase/db.js";

const routerProfile = express.Router();

interface ErrorBody {
    error: string;
}

const GENDERS = ["male", "female"] as const;
const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const;

interface UserInfoDoc {
    userId: string;
    gender: (typeof GENDERS)[number];
    height: number;
    weight: number;
    age: number;
    lifestyle: string;
    timeForTraining: number;
    visitGym: boolean;
    trainingDays: string[];
    diseases: string;
    createdAt: Date;
    updatedAt?: Date;
}

const isPositiveInt = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v > 0;

routerProfile.post(
    "/profile",
    async (req: Request, res: Response<{ userId: string } | ErrorBody>): Promise<void> => {
        const b = req.body ?? {};

        if (!GENDERS.includes(b.gender)) {
            res.status(400).json({ error: "Некоректна стать" });
            return;
        }
        if (!isPositiveInt(b.height)) {
            res.status(400).json({ error: "Некоректний зріст" });
            return;
        }
        if (typeof b.weight !== "number" || !Number.isFinite(b.weight) || b.weight <= 0) {
            res.status(400).json({ error: "Некоректна вага" });
            return;
        }
        if (!isPositiveInt(b.age)) {
            res.status(400).json({ error: "Некоректний вік" });
            return;
        }
        if (typeof b.lifestyle !== "string" || !b.lifestyle.trim()) {
            res.status(400).json({ error: "Опишіть спосіб життя" });
            return;
        }
        if (!isPositiveInt(b.timeForTraining)) {
            res.status(400).json({ error: "Некоректний час на тренування" });
            return;
        }
        if (typeof b.visitGym !== "boolean") {
            res.status(400).json({ error: "Вкажіть, чи відвідуєте спортзал" });
            return;
        }
        if (
            !Array.isArray(b.trainingDays) ||
            b.trainingDays.length === 0 ||
            !b.trainingDays.every((d: unknown) => (WEEKDAYS as readonly string[]).includes(d as string))
        ) {
            res.status(400).json({ error: "Некоректні дні тренувань" });
            return;
        }

        const doc: UserInfoDoc = {
            userId: randomUUID(),
            gender: b.gender,
            height: b.height,
            weight: b.weight,
            age: b.age,
            lifestyle: b.lifestyle.trim(),
            timeForTraining: b.timeForTraining,
            visitGym: b.visitGym,
            trainingDays: [...new Set<string>(b.trainingDays)],
            diseases: typeof b.diseases === "string" ? b.diseases.trim() : "",
            createdAt: new Date(),
        };

        try {
            await getDB().collection<UserInfoDoc>("userInfo").insertOne(doc);
            res.status(201).json({ userId: doc.userId });
        } catch (err: unknown) {
            console.error(err);
            res.status(500).json({ error: "Помилка сервера" });
        }
    }
);

routerProfile.get(
    "/profile",
    async (req: Request, res: Response<Record<string, unknown> | ErrorBody>): Promise<void> => {
        const userId = req.query.userId;

        if (typeof userId !== "string" || !userId.trim()) {
            res.status(400).json({ error: "Потрібен userId" });
            return;
        }

        try {
            const info = await getDB()
                .collection("userInfo")
                .findOne({ userId: userId.trim() }, { projection: { _id: 0, password: 0 } });

            if (!info) {
                res.status(404).json({ error: "Профіль користувача не знайдено" });
                return;
            }

            res.json(info);
        } catch (err: unknown) {
            console.error(err);
            res.status(500).json({ error: "Помилка сервера" });
        }
    }
);

routerProfile.put(
    "/profile",
    async (req: Request, res: Response<Record<string, unknown> | ErrorBody>): Promise<void> => {
        const b = req.body ?? {};

        if (typeof b.userId !== "string" || !b.userId.trim()) {
            res.status(400).json({ error: "Потрібен userId" });
            return;
        }
        const userId = b.userId.trim();

        const update: Partial<UserInfoDoc> = {};

        if (b.gender !== undefined) {
            if (!GENDERS.includes(b.gender)) {
                res.status(400).json({ error: "Некоректна стать" });
                return;
            }
            update.gender = b.gender;
        }
        if (b.height !== undefined) {
            if (!isPositiveInt(b.height)) {
                res.status(400).json({ error: "Некоректний зріст" });
                return;
            }
            update.height = b.height;
        }
        if (b.weight !== undefined) {
            if (typeof b.weight !== "number" || !Number.isFinite(b.weight) || b.weight <= 0) {
                res.status(400).json({ error: "Некоректна вага" });
                return;
            }
            update.weight = b.weight;
        }
        if (b.age !== undefined) {
            if (!isPositiveInt(b.age)) {
                res.status(400).json({ error: "Некоректний вік" });
                return;
            }
            update.age = b.age;
        }
        if (b.lifestyle !== undefined) {
            if (typeof b.lifestyle !== "string" || !b.lifestyle.trim()) {
                res.status(400).json({ error: "Опишіть спосіб життя" });
                return;
            }
            update.lifestyle = b.lifestyle.trim();
        }
        if (b.timeForTraining !== undefined) {
            if (!isPositiveInt(b.timeForTraining)) {
                res.status(400).json({ error: "Некоректний час на тренування" });
                return;
            }
            update.timeForTraining = b.timeForTraining;
        }
        if (b.visitGym !== undefined) {
            if (typeof b.visitGym !== "boolean") {
                res.status(400).json({ error: "Вкажіть, чи відвідуєте спортзал" });
                return;
            }
            update.visitGym = b.visitGym;
        }
        if (b.trainingDays !== undefined) {
            if (
                !Array.isArray(b.trainingDays) ||
                b.trainingDays.length === 0 ||
                !b.trainingDays.every((d: unknown) => (WEEKDAYS as readonly string[]).includes(d as string))
            ) {
                res.status(400).json({ error: "Некоректні дні тренувань" });
                return;
            }
            update.trainingDays = [...new Set<string>(b.trainingDays)];
        }
        if (b.diseases !== undefined) {
            if (typeof b.diseases !== "string") {
                res.status(400).json({ error: "Некоректне поле «Хвороби / травми»" });
                return;
            }
            update.diseases = b.diseases.trim();
        }

        if (Object.keys(update).length === 0) {
            res.status(400).json({ error: "Немає полів для оновлення" });
            return;
        }
        update.updatedAt = new Date();

        try {
            const col = getDB().collection<UserInfoDoc>("userInfo");

            const result = await col.updateOne({ userId }, { $set: update });
            if (result.matchedCount === 0) {
                res.status(404).json({ error: "Профіль користувача не знайдено" });
                return;
            }

            const info = await getDB()
                .collection("userInfo")
                .findOne({ userId }, { projection: { _id: 0, password: 0 } });

            res.json(info ?? {});
        } catch (err: unknown) {
            console.error(err);
            res.status(500).json({ error: "Помилка сервера" });
        }
    }
);

export default routerProfile;