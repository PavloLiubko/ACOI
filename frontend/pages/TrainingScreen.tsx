import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://10.0.2.2:3001";
const API_URL = `${BASE_URL}/api/trainings`;

const RED = "#DF2F3B";

interface Workout {
    reply: string;
    createdAt: string;
    generated: boolean;
}

async function getUserId(): Promise<string> {
    const id = await AsyncStorage.getItem("userId");
    if (!id) throw new Error("NO_USER");
    return id;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
}

export default function TrainingScreen() {
    const navigation = useNavigation();

    const [workout, setWorkout] = useState<Workout | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const request = useCallback(async (mode: "load" | "new") => {
        setLoading(true);
        setError(null);

        try {
            const userId = await getUserId();

            const res =
                mode === "load"
                    ? await fetch(`${API_URL}/workout?userId=${encodeURIComponent(userId)}`)
                    : await fetch(`${API_URL}/workout/new`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId }),
                    });

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

            setWorkout(body as Workout);
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
        request("load");
    }, [request]);

    return (
        <View style={s.root}>
            <ScrollView style={s.screen} contentContainerStyle={s.content}>
                <Text style={s.title}>Тренування</Text>
                <Text style={s.subtitle}>Персональний план на основі вашого профілю</Text>

                <View style={s.card}>
                    {loading && (
                        <View style={s.center}>
                            <ActivityIndicator size="large" color={RED} />
                            <Text style={s.hint}>Складаємо план тренувань…</Text>
                        </View>
                    )}

                    {!loading && workout && (
                        <>
                            <Text style={s.date}>План від {formatDate(workout.createdAt)}</Text>
                            <View style={s.divider} />
                            <Text style={s.plan}>{workout.reply}</Text>
                        </>
                    )}

                    {!loading && !workout && !error && (
                        <Text style={s.hint}>План ще не створено</Text>
                    )}

                    {!loading && error && <Text style={s.error}>{error}</Text>}
                </View>

                <Pressable
                    style={({ pressed }) => [s.btn, pressed && s.pressed, loading && s.disabled]}
                    onPress={() => request("new")}
                    disabled={loading}
                >
                    <Text style={s.btnText}>Нове тренування</Text>
                </Pressable>
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
        alignItems: "stretch",
        elevation: 5,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        marginBottom: 22,
    },
    center: { alignItems: "center", paddingVertical: 12 },
    date: { fontSize: 14, fontWeight: "700", color: RED, textAlign: "center" },
    divider: { height: 2, alignSelf: "stretch", backgroundColor: "#E6E6E6", marginVertical: 16 },
    plan: { fontSize: 16, color: "#2B2B2B", lineHeight: 23 },
    hint: { fontSize: 16, color: "#7A7A7A", textAlign: "center", marginTop: 16 },
    error: { fontSize: 16, color: RED, textAlign: "center", fontWeight: "600" },
    btn: {
        backgroundColor: RED,
        borderRadius: 18,
        paddingVertical: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
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