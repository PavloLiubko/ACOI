import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { getDB } from "../DataBase/db.js";

const routerCalores = express.Router();

interface FoodAnalysis {
    is_food: boolean;
    name?: string;
    calories_kcal?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
}

interface GeminiResponse {
    candidates?: {
        content?: { parts?: { text?: string }[] };
    }[];
}

interface SuccessBody {
    name: string;
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
}

interface AnalyzeBody extends SuccessBody {
    id: string;
}

interface ErrorBody {
    error: string;
}

interface FoodPhotoDoc extends SuccessBody {
    _id?: ObjectId;
    userId: string;
    createdAt: Date;
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 МБ
});

function handleUpload(req: Request, res: Response<ErrorBody>, next: NextFunction): void {
    upload.single("photo")(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
            const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            res.status(status).json({ error: `Помилка завантаження: ${err.code}` });
            return;
        }
        if (err) {
            next(err);
            return;
        }
        next();
    });
}

const PROMPT = `Ти нутріціолог. Проаналізуй фото.

1. Якщо на фото НЕ їжа і не напій — постав is_food=false, інші поля не заповнюй.
2. Якщо на фото їжа — постав is_food=true і оціни харчову цінність УСІЄЇ порції, яку видно на фото:
   - name: коротка приблизна назва страви українською, 1-4 слова (наприклад "Борщ зі сметаною");
   - calories_kcal: калорійність, ціле число, ккал;
   - protein_g: білки, грами;
   - carbs_g: вуглеводи, грами;
   - fat_g: жири, грами.

Правила:
- Якщо на фото кілька страв, склади значення всіх разом, а в name назви головну або перелічи через кому.
- Розмір порції оціни за видимими орієнтирами (тарілка, виделка, упаковка). Якщо орієнтирів немає, бери типову порцію.
- Значення мають бути узгоджені: калорії приблизно дорівнюють білки*4 + вуглеводи*4 + жири*9.
- Не додавай жодного тексту, окрім JSON.`;

const SCHEMA = {
    type: "object",
    properties: {
        is_food: { type: "boolean", description: "true, якщо на фото їжа або напій" },
        name: { type: "string", description: "Коротка приблизна назва страви українською" },
        calories_kcal: { type: "integer", description: "Калорії всієї порції, ккал" },
        protein_g: { type: "number", description: "Білки, г" },
        carbs_g: { type: "number", description: "Вуглеводи, г" },
        fat_g: { type: "number", description: "Жири, г" },
    },
    required: ["is_food"],
};

routerCalores.post(
    "/analyze",
    handleUpload,
    async (req: Request, res: Response<AnalyzeBody | ErrorBody>): Promise<void> => {
        const apiKey = process.env.GEMINI_KEY;
        const model = process.env.MODEL_AI ?? "gemini-3.5-flash";

        if (!apiKey) {
            console.error("GEMINI_KEY не задано");
            res.status(500).json({ error: "Сервер не налаштовано" });
            return;
        }

        const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
        if (!userId) {
            res.status(400).json({ error: "Потрібен userId" });
            return;
        }

        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "Додай файл у полі photo" });
            return;
        }
        if (!file.mimetype.startsWith("image/")) {
            res.status(400).json({ error: "Файл має бути зображенням" });
            return;
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

            const geminiRes = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: file.mimetype,
                                        data: file.buffer.toString("base64"),
                                    },
                                },
                                { text: PROMPT },
                            ],
                        },
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: SCHEMA,
                        thinkingConfig: { thinkingLevel: "low" },
                    },
                }),
            });

            if (!geminiRes.ok) {
                const details = await geminiRes.text();
                console.error("Gemini error:", geminiRes.status, details);
                res.status(502).json({ error: `Gemini повернув ${geminiRes.status}` });
                return;
            }

            const data = (await geminiRes.json()) as GeminiResponse;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                res.status(502).json({ error: "Порожня відповідь від Gemini" });
                return;
            }

            const result = JSON.parse(text) as FoodAnalysis;

            if (!result.is_food) {
                res.status(422).json({ error: "На фото не їжа" });
                return;
            }

            const { calories_kcal, protein_g, carbs_g, fat_g } = result;

            if (
                calories_kcal === undefined ||
                protein_g === undefined ||
                carbs_g === undefined ||
                fat_g === undefined
            ) {
                res.status(502).json({ error: "Gemini не повернув усі показники" });
                return;
            }

            const name =
                typeof result.name === "string" && result.name.trim()
                    ? result.name.trim().slice(0, 80)
                    : "Страва";

            const body: SuccessBody = { name, calories_kcal, protein_g, carbs_g, fat_g };

            let insertedId: ObjectId;
            try {
                const doc: FoodPhotoDoc = { userId, ...body, createdAt: new Date() };
                const ins = await getDB().collection<FoodPhotoDoc>("foodPhotos").insertOne(doc);
                insertedId = ins.insertedId;
            } catch (dbErr: unknown) {
                console.error("Не вдалося зберегти в foodPhotos:", dbErr);
                res.status(500).json({ error: "Не вдалося зберегти результат" });
                return;
            }

            res.json({ id: insertedId.toString(), ...body });
        } catch (e: unknown) {
            console.error(e);
            res.status(500).json({ error: "Внутрішня помилка сервера" });
        }
    }
);

routerCalores.get(
    "/history",
    async (req: Request, res: Response): Promise<void> => {
        const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
        if (!userId) {
            res.status(400).json({ error: "Потрібен userId" });
            return;
        }

        try {
            const docs = await getDB()
                .collection<FoodPhotoDoc>("foodPhotos")
                .find({ userId })
                .sort({ createdAt: -1 })
                .limit(1000)
                .toArray();

            res.json({
                items: docs.map((d) => ({
                    id: d._id!.toString(),
                    name: d.name,
                    calories_kcal: d.calories_kcal,
                    protein_g: d.protein_g,
                    carbs_g: d.carbs_g,
                    fat_g: d.fat_g,
                    createdAt: d.createdAt,
                })),
            });
        } catch (e: unknown) {
            console.error(e);
            res.status(500).json({ error: "Внутрішня помилка сервера" });
        }
    }
);

routerCalores.delete(
    "/:id",
    async (req: Request<{ id: string }>, res: Response): Promise<void> => {
        const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
        const { id } = req.params;

        if (!userId) {
            res.status(400).json({ error: "Потрібен userId" });
            return;
        }
        if (!ObjectId.isValid(id)) {
            res.status(400).json({ error: "Некоректний id" });
            return;
        }

        try {
            const r = await getDB()
                .collection<FoodPhotoDoc>("foodPhotos")
                .deleteOne({ _id: new ObjectId(id), userId });

            if (r.deletedCount === 0) {
                res.status(404).json({ error: "Запис не знайдено" });
                return;
            }
            res.json({ ok: true });
        } catch (e: unknown) {
            console.error(e);
            res.status(500).json({ error: "Внутрішня помилка сервера" });
        }
    }
);

export default routerCalores;