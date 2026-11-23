import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://10.0.2.2:3001";
const API_URL = `${BASE_URL}/api/calories/analyze`;

const RED = "#DF2F3B";

interface Result {
    id: string;
    name: string;
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
}

interface HistoryItem {
    id: string;
    name: string;
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    createdAt: string;
}

interface DayGroup {
    key: string;
    label: string;
    items: HistoryItem[];
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dayLabel(d: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(d) === dayKey(today)) return "Сьогодні";
    if (dayKey(d) === dayKey(yesterday)) return "Вчора";
    return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDay(items: HistoryItem[]): DayGroup[] {
    const map = new Map<string, DayGroup>();
    for (const it of items) {
        const d = new Date(it.createdAt);
        const key = dayKey(d);
        let g = map.get(key);
        if (!g) {
            g = { key, label: dayLabel(d), items: [], calories: 0, protein: 0, carbs: 0, fat: 0 };
            map.set(key, g);
        }
        g.items.push(it);
        g.calories += it.calories_kcal;
        g.protein += it.protein_g;
        g.carbs += it.carbs_g;
        g.fat += it.fat_g;
    }
    return Array.from(map.values());
}

async function getUserId(): Promise<string> {
    const id = await AsyncStorage.getItem("userId");
    if (!id) throw new Error("NO_USER");
    return id;
}

function upload(form: FormData): Promise<{ status: number; ok: boolean; raw: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL);
        xhr.timeout = 60000;
        xhr.onload = () =>
            resolve({
                status: xhr.status,
                ok: xhr.status >= 200 && xhr.status < 300,
                raw: xhr.responseText,
            });
        xhr.onerror = () => reject(new Error("Network request failed"));
        xhr.ontimeout = () => reject(new Error("Timeout"));
        xhr.send(form);
    });
}

export default function FoodScanScreen() {
    const navigation = useNavigation<any>();

    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const loadHistory = useCallback(async () => {
        try {
            const userId = await getUserId();
            const res = await fetch(
                `${BASE_URL}/api/calories/history?userId=${encodeURIComponent(userId)}`
            );
            if (!res.ok) return;
            const body = await res.json();
            setHistory(body.items ?? []);
        } catch (e) {
            console.log("history error:", e);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [loadHistory])
    );

    function confirmDelete(item: HistoryItem) {
        Alert.alert("Видалити?", `«${item.name}» буде видалено з історії`, [
            { text: "Скасувати", style: "cancel" },
            { text: "Видалити", style: "destructive", onPress: () => removeItem(item.id) },
        ]);
    }

    async function removeItem(id: string) {
        try {
            const userId = await getUserId();
            const res = await fetch(
                `${BASE_URL}/api/calories/${id}?userId=${encodeURIComponent(userId)}`,
                { method: "DELETE" }
            );
            if (res.ok || res.status === 404) {
                setHistory((prev) => prev.filter((x) => x.id !== id));
                setResult((prev) => (prev && prev.id === id ? null : prev));
            } else {
                Alert.alert("Помилка", "Не вдалося видалити");
            }
        } catch {
            Alert.alert("Помилка", "Немає звʼязку з сервером");
        }
    }

    async function analyze(uri: string, mimeType?: string | null) {
        setPhotoUri(uri);
        setResult(null);
        setError(null);
        setLoading(true);

        try {
            const userId = await getUserId();

            const type = mimeType ?? "image/jpeg";
            const ext = type.split("/")[1] ?? "jpg";

            const form = new FormData();
            form.append("userId", userId);
            form.append("photo", { uri, name: `food.${ext}`, type } as any);

            const res = await upload(form);

            const raw = res.raw;
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
            setResult(body as Result);
            loadHistory();
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
    }

    async function pickPhoto() {
        const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.6,
        });
        if (!r.canceled) {
            await analyze(r.assets[0].uri, r.assets[0].mimeType);
        }
    }

    return (
        <View style={s.root}>
            <ScrollView style={s.screen} contentContainerStyle={s.content}>
                <Text style={s.title}>Скан їжі</Text>
                <Text style={s.subtitle}>Завантажте свій прийом їжі, щоб дізнатися калорії та БЖВ</Text>

                <View style={s.card}>
                    {photoUri ? (
                        <Image source={{ uri: photoUri }} style={s.photo} />
                    ) : (
                        <Image source={require("../assets/scan.png")} style={s.iconBig} />
                    )}

                    {loading && (
                        <View style={s.center}>
                            <ActivityIndicator size="large" color={RED} />
                            <Text style={s.hint}>Аналізуємо страву…</Text>
                        </View>
                    )}

                    {!loading && result && (
                        <>
                            <Text style={s.dishName}>{result.name}</Text>
                            <Text style={s.big}>{Math.round(result.calories_kcal)}</Text>
                            <Text style={s.label}>ккал у порції</Text>
                            <View style={s.divider} />
                            <View style={s.macros}>
                                <Macro name="Білки" value={result.protein_g} />
                                <Macro name="Вуглеводи" value={result.carbs_g} />
                                <Macro name="Жири" value={result.fat_g} />
                            </View>
                        </>
                    )}

                    {!loading && !result && !error && (
                        <Text style={s.hint}>
                            Покладіть страву так, щоб було видно тарілку чи упаковку — так оцінка точніша
                        </Text>
                    )}

                    {!loading && error && <Text style={s.error}>{error}</Text>}
                </View>

                <Pressable
                    style={({ pressed }) => [s.btn, pressed && s.pressed, loading && s.disabled]}
                    onPress={pickPhoto}
                    disabled={loading}
                >
                    <Text style={s.btnText}>Обрати з галереї</Text>
                </Pressable>

                {groupByDay(history).map((g) => (
                    <View key={g.key} style={s.dayBlock}>
                        <View style={s.dayHeader}>
                            <Text style={s.dayTitle}>{g.label}</Text>
                            <Text style={s.dayTotal}>{Math.round(g.calories)} ккал</Text>
                        </View>
                        <Text style={s.dayMacros}>
                            Б {round1(g.protein)} г · В {round1(g.carbs)} г · Ж {round1(g.fat)} г
                        </Text>

                        {g.items.map((it) => (
                            <View key={it.id} style={s.item}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.itemName}>{it.name}</Text>
                                    <Text style={s.itemInfo}>
                                        {Math.round(it.calories_kcal)} ккал · Б {round1(it.protein_g)} · В{" "}
                                        {round1(it.carbs_g)} · Ж {round1(it.fat_g)}
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={() => confirmDelete(it)}
                                    style={({ pressed }) => [s.delBtn, pressed && s.pressed]}
                                >
                                    <Text style={s.delText}>Delete</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                ))}
            </ScrollView>

            <View style={s.tabBar}>
                <Pressable onPress={() => navigation.navigate('Home')} style={s.tab}>
                    <Image source={require('../images/home.png')} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Trainings')} style={s.tab}>
                    <Image source={require('../images/training.png')} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Meals')} style={s.tab}>
                    <Image source={require('../images/meal.png')} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Profile')} style={s.tab}>
                    <Image source={require('../images/profile.png')} />
                </Pressable>
            </View>
        </View>
    );
}

function Macro({ name, value }: { name: string; value: number }) {
    return (
        <View style={s.macro}>
            <Text style={s.macroValue}>{round1(value)} г</Text>
            <Text style={s.macroName}>{name}</Text>
        </View>
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
        paddingVertical: 28,
        paddingHorizontal: 24,
        alignItems: "center",
        elevation: 5,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        marginBottom: 22,
    },
    iconBig: { width: 120, height: 120 },
    photo: { width: 220, height: 220, borderRadius: 18 },
    center: { alignItems: "center", marginTop: 24 },
    dishName: { fontSize: 20, fontWeight: "700", color: "#2B2B2B", textAlign: "center", marginTop: 18 },
    big: { fontSize: 72, fontWeight: "800", color: RED, marginTop: 6 },
    label: { fontSize: 18, fontWeight: "700", color: "#2B2B2B" },
    divider: { height: 2, alignSelf: "stretch", backgroundColor: "#E6E6E6", marginVertical: 20, marginHorizontal: 10 },
    macros: { flexDirection: "row", alignSelf: "stretch", justifyContent: "space-around" },
    macro: { alignItems: "center" },
    macroValue: { fontSize: 22, fontWeight: "800", color: RED },
    macroName: { fontSize: 14, color: "#7A7A7A", marginTop: 2 },
    hint: { fontSize: 16, color: "#7A7A7A", textAlign: "center", marginTop: 20 },
    error: { fontSize: 16, color: RED, textAlign: "center", marginTop: 20, fontWeight: "600" },
    btn: {
        flexDirection: "row",
        gap: 10,
        backgroundColor: RED,
        borderRadius: 18,
        paddingVertical: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
    dayBlock: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 18,
        marginTop: 18,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    dayTitle: { fontSize: 18, fontWeight: "700", color: "#2B2B2B" },
    dayTotal: { fontSize: 18, fontWeight: "800", color: RED },
    dayMacros: { fontSize: 14, color: "#7A7A7A", marginTop: 4, marginBottom: 8 },
    item: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#E6E6E6",
        gap: 10,
    },
    itemName: { fontSize: 16, fontWeight: "600", color: "#2B2B2B" },
    itemInfo: { fontSize: 13, color: "#7A7A7A", marginTop: 2 },
    delBtn: { backgroundColor: RED, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
    delText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    tabBar: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingVertical: 18,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        backgroundColor: "#E0313A",
    },
    tab: {
        padding: 6,
    },
});