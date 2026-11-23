import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://10.0.2.2:3001";
const API_URL = `${BASE_URL}/api/user`;

const RED = "#DF2F3B";

interface Profile {
    gender?: "male" | "female";
    height?: number;
    weight?: number;
    age?: number;
    lifestyle?: string;
    timeForTraining?: number;
    visitGym?: boolean;
    trainingDays?: string[];
    diseases?: string;
}

interface Draft {
    gender?: "male" | "female";
    age: string;
    weight: string;
    height: string;
    lifestyle: string;
    timeForTraining: string;
    visitGym: boolean;
    trainingDays: string[];
    diseases: string;
}

const GENDER_LABELS: Record<string, string> = {
    male: "Чоловік",
    female: "Жінка",
};

const DAY_LABELS: Record<string, string> = {
    Monday: "Пн",
    Tuesday: "Вт",
    Wednesday: "Ср",
    Thursday: "Чт",
    Friday: "Пт",
    Saturday: "Сб",
    Sunday: "Нд",
};
const DAY_KEYS = Object.keys(DAY_LABELS);

async function getUserId(): Promise<string> {
    const id = await AsyncStorage.getItem("userId");
    if (!id) throw new Error("NO_USER");
    return id;
}

function show(value: unknown, suffix = ""): string {
    if (value === undefined || value === null || value === "") return "—";
    return `${value}${suffix}`;
}

function toDraft(p: Profile): Draft {
    return {
        gender: p.gender,
        age: p.age != null ? String(p.age) : "",
        weight: p.weight != null ? String(p.weight) : "",
        height: p.height != null ? String(p.height) : "",
        lifestyle: p.lifestyle ?? "",
        timeForTraining: p.timeForTraining != null ? String(p.timeForTraining) : "",
        visitGym: p.visitGym ?? false,
        trainingDays: p.trainingDays ?? [],
        diseases: p.diseases ?? "",
    };
}

function toNumber(v: string): number | undefined {
    const t = v.trim().replace(",", ".");
    if (t === "") return undefined;
    return Number(t);
}

export default function ProfileScreen() {
    const navigation = useNavigation<any>();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const userId = await getUserId();
            const res = await fetch(`${API_URL}/profile?userId=${encodeURIComponent(userId)}`);

            const raw = await res.text();
            let body: any = null;
            try {
                body = JSON.parse(raw);
            } catch {
                console.log("Не JSON від сервера:", res.status, API_URL, raw.slice(0, 200));
                setError(
                    res.status === 404
                        ? "Сервер не знайшов шлях. Перевір API_URL і префікс роутера"
                        : `Сервер повернув не JSON (код ${res.status})`
                );
                return;
            }

            if (!res.ok) {
                setError(body?.error ?? `Помилка ${res.status}`);
                return;
            }

            setProfile(body as Profile);
        } catch (e) {
            if (e instanceof Error && e.message === "NO_USER") {
                setError("Не знайдено користувача. Увійдіть в акаунт");
            } else {
                console.log("Network error:", API_URL, e);
                setError(`Немає звʼязку з ${API_URL}`);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    function startEdit() {
        if (!profile) return;
        setDraft(toDraft(profile));
        setFormError(null);
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setFormError(null);
    }

    function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
        setDraft((d) => (d ? { ...d, [key]: value } : d));
    }

    function toggleDay(day: string) {
        if (!draft) return;
        const has = draft.trainingDays.includes(day);
        const next = has
            ? draft.trainingDays.filter((d) => d !== day)
            : [...draft.trainingDays, day];
        setField("trainingDays", DAY_KEYS.filter((d) => next.includes(d)));
    }

    async function save() {
        if (!draft) return;

        const age = toNumber(draft.age);
        const weight = toNumber(draft.weight);
        const height = toNumber(draft.height);
        const time = toNumber(draft.timeForTraining);

        const ints = { Вік: age, Зріст: height, "Час тренування": time };
        for (const [name, v] of Object.entries(ints)) {
            if (v !== undefined && (!Number.isInteger(v) || v <= 0)) {
                setFormError(`Поле «${name}» має бути цілим додатним числом`);
                return;
            }
        }
        if (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)) {
            setFormError("Поле «Вага» має бути додатним числом");
            return;
        }
        if (draft.trainingDays.length === 0) {
            setFormError("Оберіть хоча б один день тренувань");
            return;
        }
        if (!draft.lifestyle.trim()) {
            setFormError("Опишіть спосіб життя");
            return;
        }

        setSaving(true);
        setFormError(null);

        try {
            const userId = await getUserId();
            const payload = {
                userId,
                gender: draft.gender,
                age,
                weight,
                height,
                lifestyle: draft.lifestyle.trim(),
                timeForTraining: time,
                visitGym: draft.visitGym,
                trainingDays: draft.trainingDays,
                diseases: draft.diseases.trim(),
            };

            const res = await fetch(`${API_URL}/profile`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const raw = await res.text();
            let body: any = null;
            try {
                body = JSON.parse(raw);
            } catch {
                console.log("Не JSON від сервера:", res.status, raw.slice(0, 200));
                setFormError(
                    res.status === 404
                        ? "Сервер не знайшов PUT /profile. Перезапусти бекенд"
                        : `Сервер повернув не JSON (код ${res.status})`
                );
                return;
            }

            if (!res.ok) {
                setFormError(body?.error ?? `Помилка ${res.status}`);
                return;
            }

            setProfile(Object.keys(body ?? {}).length ? (body as Profile) : (payload as Profile));
            setEditing(false);
        } catch (e) {
            if (e instanceof Error && e.message === "NO_USER") {
                setFormError("Не знайдено користувача. Увійдіть в акаунт");
            } else {
                console.log("Network error:", API_URL, e);
                setFormError(`Немає звʼязку з ${API_URL}`);
            }
        } finally {
            setSaving(false);
        }
    }

    const days = profile?.trainingDays?.map((d) => DAY_LABELS[d] ?? d).join(", ");

    return (
        <View style={s.root}>
            <ScrollView
                style={s.screen}
                contentContainerStyle={s.content}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={s.title}>Профіль</Text>
                <Text style={s.subtitle}>Ці дані використовує тренер для вашого плану</Text>

                <View style={s.card}>
                    {loading && (
                        <View style={s.center}>
                            <ActivityIndicator size="large" color={RED} />
                            <Text style={s.hint}>Завантаження…</Text>
                        </View>
                    )}

                    {!loading && profile && !editing && (
                        <>
                            <Row label="Стать" value={show(profile.gender && GENDER_LABELS[profile.gender])} />
                            <Row label="Вік" value={show(profile.age)} />
                            <Row label="Вага" value={show(profile.weight, " кг")} />
                            <Row label="Зріст" value={show(profile.height, " см")} />
                            <Row
                                label="Спортзал"
                                value={profile.visitGym === undefined ? "—" : profile.visitGym ? "Так" : "Ні"}
                            />
                            <Row label="Тренувань на тиждень" value={show(profile.trainingDays?.length)} />
                            <Row label="Дні тренувань" value={show(days)} />
                            <Row label="Спосіб життя" value={show(profile.lifestyle)} />
                            <Row label="Час тренування" value={show(profile.timeForTraining, " хв")} />
                            <Row label="Хвороби / травми" value={show(profile.diseases)} last />
                        </>
                    )}

                    {!loading && profile && editing && draft && (
                        <View style={s.form}>
                            <Text style={s.fieldLabel}>Стать</Text>
                            <View style={s.chips}>
                                {(["male", "female"] as const).map((g) => (
                                    <Chip
                                        key={g}
                                        label={GENDER_LABELS[g]}
                                        active={draft.gender === g}
                                        onPress={() => setField("gender", g)}
                                    />
                                ))}
                            </View>

                            <Field
                                label="Вік"
                                value={draft.age}
                                onChange={(v) => setField("age", v)}
                                keyboard="number-pad"
                            />
                            <Field
                                label="Вага, кг"
                                value={draft.weight}
                                onChange={(v) => setField("weight", v)}
                                keyboard="decimal-pad"
                            />
                            <Field
                                label="Зріст, см"
                                value={draft.height}
                                onChange={(v) => setField("height", v)}
                                keyboard="number-pad"
                            />
                            <Field
                                label="Час тренування, хв"
                                value={draft.timeForTraining}
                                onChange={(v) => setField("timeForTraining", v)}
                                keyboard="number-pad"
                            />
                            <Field
                                label="Спосіб життя"
                                value={draft.lifestyle}
                                onChange={(v) => setField("lifestyle", v)}
                            />

                            <View style={s.switchRow}>
                                <Text style={s.fieldLabelInline}>Ходжу в спортзал</Text>
                                <Switch
                                    value={draft.visitGym}
                                    onValueChange={(v) => setField("visitGym", v)}
                                    trackColor={{ true: RED }}
                                />
                            </View>

                            <Text style={s.fieldLabel}>Дні тренувань</Text>
                            <View style={s.chips}>
                                {DAY_KEYS.map((d) => (
                                    <Chip
                                        key={d}
                                        label={DAY_LABELS[d]}
                                        active={draft.trainingDays.includes(d)}
                                        onPress={() => toggleDay(d)}
                                    />
                                ))}
                            </View>

                            <Field
                                label="Хвороби / травми"
                                value={draft.diseases}
                                onChange={(v) => setField("diseases", v)}
                                multiline
                            />

                            {formError && <Text style={s.formError}>{formError}</Text>}
                        </View>
                    )}

                    {!loading && error && <Text style={s.error}>{error}</Text>}
                </View>

                {!loading && error && (
                    <Pressable style={({ pressed }) => [s.btn, pressed && s.pressed]} onPress={load}>
                        <Text style={s.btnText}>Спробувати ще раз</Text>
                    </Pressable>
                )}

                {!loading && profile && !editing && (
                    <Pressable style={({ pressed }) => [s.btn, pressed && s.pressed]} onPress={startEdit}>
                        <Text style={s.btnText}>Редагувати</Text>
                    </Pressable>
                )}

                {editing && (
                    <>
                        <Pressable
                            style={({ pressed }) => [s.btn, pressed && s.pressed, saving && s.disabled]}
                            onPress={save}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={s.btnText}>Зберегти</Text>
                            )}
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [s.btnGhost, pressed && s.pressed, saving && s.disabled]}
                            onPress={cancelEdit}
                            disabled={saving}
                        >
                            <Text style={s.btnGhostText}>Скасувати</Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>

            <View style={s.tabBar}>
                <Pressable onPress={() => navigation.navigate("Home")} style={s.tab}>
                    <Image source={require("../images/home.png")} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate("Trainings")} style={s.tab}>
                    <Image source={require("../images/training.png")} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate("Meals")} style={s.tab}>
                    <Image source={require("../images/meal.png")} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate("Profile")} style={s.tab}>
                    <Image source={require("../images/profile.png")} />
                </Pressable>
            </View>
        </View>
    );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
    return (
        <View style={[s.row, !last && s.rowDivider]}>
            <Text style={s.rowLabel}>{label}</Text>
            <Text style={s.rowValue}>{value}</Text>
        </View>
    );
}

function Field({
                   label,
                   value,
                   onChange,
                   keyboard,
                   multiline,
               }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    keyboard?: "number-pad" | "decimal-pad";
    multiline?: boolean;
}) {
    return (
        <View>
            <Text style={s.fieldLabel}>{label}</Text>
            <TextInput
                style={[s.input, multiline && s.inputMulti]}
                value={value}
                onChangeText={onChange}
                keyboardType={keyboard ?? "default"}
                multiline={multiline}
                placeholder="—"
                placeholderTextColor="#B5B5B5"
            />
        </View>
    );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
            <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
        </Pressable>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, width: "100%", backgroundColor: "#F1F1F1" },
    screen: { flex: 1, backgroundColor: "#F1F1F1" },
    content: { paddingHorizontal: 30, paddingTop: 90, paddingBottom: 30, alignItems: "stretch" },
    title: { fontSize: 32, fontWeight: "700", color: RED, textAlign: "center" },
    subtitle: { fontSize: 16, color: "#7A7A7A", textAlign: "center", marginTop: 8, marginBottom: 26 },
    card: {
        backgroundColor: "#fff",
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: "stretch",
        elevation: 5,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        marginBottom: 22,
    },
    center: { alignItems: "center", paddingVertical: 24 },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        paddingVertical: 16,
    },
    rowDivider: { borderBottomWidth: 2, borderBottomColor: "#E6E6E6" },
    rowLabel: { flexShrink: 1, fontSize: 16, color: "#7A7A7A" },
    rowValue: { flexShrink: 1, fontSize: 18, fontWeight: "800", color: RED, textAlign: "right" },
    hint: { fontSize: 16, color: "#7A7A7A", textAlign: "center", marginTop: 16 },
    error: { fontSize: 16, color: RED, textAlign: "center", fontWeight: "600", paddingVertical: 16 },

    // форма
    form: { paddingVertical: 8 },
    fieldLabel: { fontSize: 14, color: "#7A7A7A", marginTop: 14, marginBottom: 6 },
    fieldLabelInline: { fontSize: 16, color: "#2B2B2B" },
    input: {
        borderWidth: 1.5,
        borderColor: "#E6E6E6",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 16,
        color: "#2B2B2B",
    },
    inputMulti: { minHeight: 80, textAlignVertical: "top" },
    switchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 14,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#E6E6E6",
        backgroundColor: "#fff",
    },
    chipActive: { backgroundColor: RED, borderColor: RED },
    chipText: { fontSize: 15, color: "#2B2B2B", fontWeight: "600" },
    chipTextActive: { color: "#fff" },
    formError: { fontSize: 14, color: RED, fontWeight: "600", marginTop: 16, textAlign: "center" },

    btn: {
        backgroundColor: RED,
        borderRadius: 18,
        paddingVertical: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
    btnGhost: {
        marginTop: 12,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: RED,
    },
    btnGhostText: { color: RED, fontSize: 17, fontWeight: "700" },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
    tabBar: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingVertical: 18,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        backgroundColor: "#E0313A",
    },
    tab: { padding: 6 },
});