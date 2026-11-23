export const openapiSpec = {
    openapi: "3.0.0",
    info: { title: "ACOI API", version: "1.0.0" },
    servers: [{ url: "http://localhost:3001" }],
    paths: {
        "/api/trainings/workout": {
            get: {
                summary: "Поточний план тренувань користувача (якщо немає, генерується за профілем)",
                parameters: [
                    {
                        name: "userId",
                        in: "query",
                        required: true,
                        schema: { type: "string" },
                        description: "Ідентифікатор користувача (userInfo.userId)",
                    },
                ],
                responses: {
                    "200": {
                        description:
                            "Останній збережений план із instructorResponse або щойно згенерований",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        reply: { type: "string", description: "Текст плану тренувань" },
                                        createdAt: { type: "string", format: "date-time" },
                                        generated: {
                                            type: "boolean",
                                            description: "true, якщо план щойно згенерований, false, якщо взятий з бази",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Не передано userId" },
                    "404": { description: "Профіль користувача не знайдено" },
                    "502": { description: "Порожня відповідь від AI" },
                    "500": { description: "Помилка AI" },
                },
            },
        },
        "/api/trainings/workout/new": {
            post: {
                summary:
                    "Нове тренування: генерує новий план за актуальним профілем і видаляє попередній",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: { userId: { type: "string" } },
                                required: ["userId"],
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Новий план тренувань (збережений в instructorResponse)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        reply: { type: "string", description: "Текст плану тренувань" },
                                        createdAt: { type: "string", format: "date-time" },
                                        generated: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Не передано userId" },
                    "404": { description: "Профіль користувача не знайдено" },
                    "502": { description: "Порожня відповідь від AI" },
                    "500": { description: "Помилка AI" },
                },
            },
        },
        "/api/user/profile": {
            post: {
                summary: "Зберегти профіль користувача в колекцію userInfo",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: [
                                    "gender",
                                    "height",
                                    "weight",
                                    "age",
                                    "lifestyle",
                                    "timeForTraining",
                                    "visitGym",
                                    "trainingDays",
                                ],
                                properties: {
                                    gender: { type: "string", enum: ["male", "female"] },
                                    height: { type: "integer", description: "Зріст, см" },
                                    weight: { type: "number", description: "Вага, кг" },
                                    age: { type: "integer" },
                                    lifestyle: { type: "string", description: "Опис способу життя" },
                                    timeForTraining: { type: "integer", description: "Час на тренування, хв" },
                                    visitGym: { type: "boolean" },
                                    trainingDays: {
                                        type: "array",
                                        items: {
                                            type: "string",
                                            enum: [
                                                "Monday",
                                                "Tuesday",
                                                "Wednesday",
                                                "Thursday",
                                                "Friday",
                                                "Saturday",
                                                "Sunday",
                                            ],
                                        },
                                    },
                                    diseases: { type: "string", description: "Хвороби чи травми (може бути порожнім)" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Профіль збережено, повертається згенерований userId",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: { userId: { type: "string" } },
                                },
                            },
                        },
                    },
                    "400": { description: "Некоректні дані профілю" },
                    "500": { description: "Помилка сервера" },
                },
            },
            get: {
                summary: "Профіль користувача з колекції userInfo",
                parameters: [
                    {
                        name: "userId",
                        in: "query",
                        required: true,
                        schema: { type: "string" },
                        description: "Ідентифікатор користувача (userInfo.userId)",
                    },
                ],
                responses: {
                    "200": {
                        description: "Дані профілю (без службових полів)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        userId: { type: "string" },
                                        gender: { type: "string", enum: ["male", "female"] },
                                        height: { type: "integer" },
                                        weight: { type: "number" },
                                        age: { type: "integer" },
                                        lifestyle: { type: "string" },
                                        timeForTraining: { type: "integer" },
                                        visitGym: { type: "boolean" },
                                        trainingDays: { type: "array", items: { type: "string" } },
                                        diseases: { type: "string" },
                                        createdAt: { type: "string", format: "date-time" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Не передано userId" },
                    "404": { description: "Профіль користувача не знайдено" },
                    "500": { description: "Помилка сервера" },
                },
            },
        },
        "/api/calories/analyze": {
            post: {
                summary: "Оцінка калорійності їжі за фото (результат зберігається в історію користувача)",
                requestBody: {
                    required: true,
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["userId", "photo"],
                                properties: {
                                    userId: {
                                        type: "string",
                                        description: "Ідентифікатор користувача (userInfo.userId)",
                                    },
                                    photo: {
                                        type: "string",
                                        format: "binary",
                                        description: "Фото їжі (JPEG, PNG, WebP)",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Назва, калорійність і БЖВ порції",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string", description: "Ідентифікатор збереженого запису" },
                                        name: { type: "string" },
                                        calories_kcal: { type: "integer" },
                                        protein_g: { type: "number" },
                                        carbs_g: { type: "number" },
                                        fat_g: { type: "number" },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Не передано userId, файл не передано або це не зображення" },
                    "413": { description: "Файл завеликий" },
                    "422": { description: "На фото не їжа" },
                    "502": { description: "Помилка від Gemini" },
                    "500": { description: "Внутрішня помилка" },
                },
            },
        },
        "/api/calories/history": {
            get: {
                summary: "Історія відсканованої їжі користувача (від нових до старих)",
                parameters: [
                    {
                        name: "userId",
                        in: "query",
                        required: true,
                        schema: { type: "string" },
                        description: "Ідентифікатор користувача (userInfo.userId)",
                    },
                ],
                responses: {
                    "200": {
                        description: "Список записів",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        items: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string" },
                                                    calories_kcal: { type: "integer" },
                                                    protein_g: { type: "number" },
                                                    carbs_g: { type: "number" },
                                                    fat_g: { type: "number" },
                                                    createdAt: { type: "string", format: "date-time" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Не передано userId" },
                    "500": { description: "Внутрішня помилка" },
                },
            },
        },
        "/api/calories/{id}": {
            delete: {
                summary: "Видалити запис про їжу з історії",
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                    {
                        name: "userId",
                        in: "query",
                        required: true,
                        schema: { type: "string" },
                        description: "Ідентифікатор користувача (userInfo.userId)",
                    },
                ],
                responses: {
                    "200": { description: "Видалено" },
                    "400": { description: "Не передано userId або некоректний id" },
                    "404": { description: "Запис не знайдено" },
                    "500": { description: "Внутрішня помилка" },
                },
            },
        },
    },
};