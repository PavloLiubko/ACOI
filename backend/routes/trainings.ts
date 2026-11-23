import express, { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { ObjectId } from "mongodb";
import { getDB } from "../DataBase/db.js";

const routerTraining = express.Router();

interface WorkoutBody {
    reply: string;
    createdAt: Date;
    generated: boolean;
}

interface ErrorBody {
    error: string;
}

interface InstructorResponseDoc {
    _id?: ObjectId;
    userId: string;
    reply: string;
    model: string;
    createdAt: Date;
}

class HttpError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
    }
}

const MODEL: string = process.env.MODEL_AI ?? "gemini-3.5-flash";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
    if (!client) {
        const apiKey = process.env.GEMINI_KEY;
        if (!apiKey) throw new Error("GEMINI_KEY не задано");
        client = new GoogleGenAI({ apiKey });
    }
    return client;
}

const SYSTEM_INSTRUCTION = `
Ти професійний персональний тренер з багаторічним досвідом роботи з людьми різного віку і рівня підготовки. Ти спілкуєшся українською, доброзичливо, чітко і мотивуюче, без зайвої води.

ЯК ТИ ПРАЦЮЄШ
- Завжди спирайся на профіль користувача (нижче). Не питай те, що вже є в профілі.
- Підбирай навантаження під вік, вагу, зріст, спосіб життя і реальний рівень підготовки.
- Використовуй лише ті дні тренувань, які користувач указав. Не став тренування на інші дні.
- Тривалість кожного тренування не повинна перевищувати час, який користувач виділяє на тренування.
- Якщо користувач ходить у спортзал, пропонуй вправи з тренажерами та вільними вагами. Якщо ні, пропонуй вправи з власною вагою та мінімальним інвентарем, який є вдома.
- Для кожної вправи вказуй: назву, кількість підходів і повторень (або час), відпочинок між підходами.
- Давай розминку на початку і заминку в кінці.
- Нарощуй навантаження поступово. Для новачків починай з легких програм.
- Коротко пояснюй, навіщо потрібна вправа і як виконувати її безпечно.

ЗДОРОВ'Я ТА БЕЗПЕКА
- Якщо в профілі вказані хвороби чи травми, виключи вправи, які можуть їм зашкодити, і запропонуй безпечні альтернативи.
- Ти не лікар: не став діагнозів, не призначай ліки й лікування. При болю, запамороченні, болю в грудях, задишці чи інших тривожних симптомах порадь припинити тренування і звернутися до лікаря.
- Не пропонуй екстремальних дієт, голодування чи небезпечного навантаження.
- За серйозних хронічних захворювань або недавніх травм порадь узгодити програму з лікарем.

ХАРЧУВАННЯ
- Можеш давати загальні поради щодо харчування, води, сну та відновлення відповідно до мети користувача. Не складай жорстких медичних дієт.

МЕЖІ
- Відповідай лише на теми тренувань, фізичної активності, харчування, відновлення та мотивації. На інші запитання ввічливо скажи, що ти допомагаєш лише з тренуваннями і здоровим способом життя.
- Не вигадуй даних про користувача. Якщо для відповіді бракує важливої інформації, використай розумні типові припущення і коротко скажи про них.

ФОРМАТ ВІДПОВІДІ
- Текст читатимуть на екрані телефона: короткі абзаци, прості списки, без таблиць і складного форматування.
- Не використовуй Markdown-розмітку (зірочки, решітки, зворотні лапки). Для списків використовуй тире.
- Для плану тренувань групуй вправи за днями (використовуй дні з профілю).
- Завершуй короткою мотивуючою фразою.
`.trim();

const USER_REQUEST = "Склади для мене персональний план тренувань на основі мого профілю.";

function instructorResponses() {
    return getDB().collection<InstructorResponseDoc>("instructorResponse");
}

function readUserId(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new HttpError(400, "Потрібен userId");
    }
    return value.trim();
}

function sendError(res: Response<WorkoutBody | ErrorBody>, err: unknown): void {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
    }
    console.error(err);
    res.status(500).json({ error: "AI-side error" });
}

async function generateWorkout(userId: string): Promise<InstructorResponseDoc> {
    const info = await getDB().collection("userInfo").findOne({ userId });
    if (!info) throw new HttpError(404, "Профіль користувача не знайдено");

    const { _id, password, userId: _userId, ...profile } = info as Record<string, unknown>;

    const systemInstruction = `${SYSTEM_INSTRUCTION}\n\nПРОФІЛЬ КОРИСТУВАЧА (JSON):\n${JSON.stringify(profile, null, 2)}`;

    const response = await getClient().models.generateContent({
        model: MODEL,
        contents: USER_REQUEST,
        config: { systemInstruction },
    });

    const reply = response.text;
    if (!reply) throw new HttpError(502, "Empty response from AI");

    return { userId, reply, model: MODEL, createdAt: new Date() };
}

async function findLatest(userId: string): Promise<InstructorResponseDoc | null> {
    return instructorResponses().find({ userId }).sort({ createdAt: -1 }).limit(1).next();
}

routerTraining.get(
    "/workout",
    async (req: Request, res: Response<WorkoutBody | ErrorBody>): Promise<void> => {
        try {
            const userId = readUserId(req.query.userId);

            const last = await findLatest(userId);
            if (last) {
                res.json({ reply: last.reply, createdAt: last.createdAt, generated: false });
                return;
            }

            const doc = await generateWorkout(userId);
            await instructorResponses().insertOne(doc);

            res.json({ reply: doc.reply, createdAt: doc.createdAt, generated: true });
        } catch (err: unknown) {
            sendError(res, err);
        }
    }
);

routerTraining.post(
    "/workout/new",
    async (req: Request, res: Response<WorkoutBody | ErrorBody>): Promise<void> => {
        try {
            const userId = readUserId(req.body?.userId);

            const previous = await findLatest(userId);

            const doc = await generateWorkout(userId);
            await instructorResponses().insertOne(doc);

            if (previous?._id) {
                await instructorResponses().deleteOne({ _id: previous._id });
            }

            res.json({ reply: doc.reply, createdAt: doc.createdAt, generated: true });
        } catch (err: unknown) {
            sendError(res, err);
        }
    }
);

export default routerTraining;