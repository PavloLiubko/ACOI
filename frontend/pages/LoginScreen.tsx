import { useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.0.2.2:3001';
const API_URL = `${BASE_URL}/api/user`;

type Gender = 'male' | 'female';

type Weekday =
    | 'Monday'
    | 'Tuesday'
    | 'Wednesday'
    | 'Thursday'
    | 'Friday'
    | 'Saturday'
    | 'Sunday';

export interface ProfilePayload {
    gender: Gender;
    height: number; // int
    weight: number; // float
    age: number; // int
    lifestyle: string;
    timeForTraining: number; // хв, int
    visitGym: boolean;
    trainingDays: Weekday[];
    diseases: string;
}

type ErrorKey =
    | 'gender'
    | 'height'
    | 'weight'
    | 'age'
    | 'lifestyle'
    | 'timeForTraining'
    | 'visitGym'
    | 'trainingDays';

type Errors = Partial<Record<ErrorKey, string>>;

const GENDERS: { value: Gender; label: string }[] = [
    { value: 'male', label: 'Чоловік' },
    { value: 'female', label: 'Жінка' },
];

const GYM_OPTIONS: { value: boolean; label: string }[] = [
    { value: true, label: 'Так' },
    { value: false, label: 'Ні' },
];

const WEEKDAYS: { value: Weekday; label: string }[] = [
    { value: 'Monday', label: 'Понеділок' },
    { value: 'Tuesday', label: 'Вівторок' },
    { value: 'Wednesday', label: 'Середа' },
    { value: 'Thursday', label: 'Четвер' },
    { value: 'Friday', label: 'Пʼятниця' },
    { value: 'Saturday', label: 'Субота' },
    { value: 'Sunday', label: 'Неділя' },
];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
        >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </Pressable>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            {children}
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
}

export default function LoginScreen() {
    const navigation = useNavigation<any>();

    const [gender, setGender] = useState<Gender | null>(null);
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [age, setAge] = useState('');
    const [lifestyle, setLifestyle] = useState('');
    const [trainingTime, setTrainingTime] = useState('');
    const [visitGym, setVisitGym] = useState<boolean | null>(null);
    const [days, setDays] = useState<Weekday[]>([]);
    const [diseases, setDiseases] = useState('');
    const [errors, setErrors] = useState<Errors>({});

    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const toggleDay = (day: Weekday) => {
        setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    };

    const save = async (payload: ProfilePayload) => {
        setSubmitError(null);
        setSaving(true);

        try {
            const res = await fetch(`${API_URL}/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const raw = await res.text();
            let body: any = null;
            try {
                body = JSON.parse(raw);
            } catch {
                console.log('Не JSON від сервера:', res.status, API_URL, raw.slice(0, 200));
                setSubmitError(
                    res.status === 404
                        ? 'Сервер не знайшов шлях. Перевір API_URL і префікс роутера'
                        : `Сервер повернув не JSON (код ${res.status})`
                );
                return;
            }

            if (!res.ok) {
                setSubmitError(body?.error ?? `Помилка ${res.status}`);
                return;
            }

            await AsyncStorage.setItem('userId', body.userId);

            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        } catch (e) {
            console.log('Network error:', API_URL, e);
            setSubmitError(`Немає звʼязку з ${API_URL}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = () => {
        if (saving) return;

        const h = parseInt(height, 10);
        const w = parseFloat(weight);
        const a = parseInt(age, 10);
        const t = parseInt(trainingTime, 10);

        const next: Errors = {};
        if (!gender) next.gender = 'Оберіть стать';
        if (!Number.isInteger(h)) next.height = 'Вкажіть ваш зріст';
        if (!Number.isFinite(w)) next.weight = 'Вкажіть вашу вагу';
        if (!Number.isInteger(a)) next.age = 'Вкажіть ваш вік';
        if (!lifestyle.trim()) next.lifestyle = 'Опишіть ваш спосіб життя';
        if (!Number.isInteger(t)) next.timeForTraining = 'Вкажіть час на тренування';
        if (visitGym === null) next.visitGym = 'Оберіть варіант';
        if (days.length === 0) next.trainingDays = 'Оберіть хоча б один день';

        setErrors(next);
        if (Object.keys(next).length > 0) return;

        const payload: ProfilePayload = {
            gender: gender as Gender,
            height: h,
            weight: w,
            age: a,
            lifestyle: lifestyle.trim(),
            timeForTraining: t,
            visitGym: visitGym as boolean,
            trainingDays: days,
            diseases: diseases.trim(),
        };

        save(payload);
    };

    return (
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Розкажіть про себе</Text>
                <Text style={styles.subtitle}>Ці дані потрібні, щоб скласти план саме для вас</Text>

                <View style={styles.card}>
                    <Field label="Стать" error={errors.gender}>
                        <View style={styles.row}>
                            {GENDERS.map((g) => (
                                <Chip
                                    key={g.value}
                                    label={g.label}
                                    selected={gender === g.value}
                                    onPress={() => setGender(g.value)}
                                />
                            ))}
                        </View>
                    </Field>

                    <TextInput
                        style={[styles.input, errors.height && styles.inputError]}
                        value={height}
                        onChangeText={(t) => setHeight(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="Введіть ваш зріст (см)"
                        placeholderTextColor={styles.placeholder.color}
                    />
                    {errors.height ? <Text style={styles.inputErrorText}>{errors.height}</Text> : null}

                    <TextInput
                        style={[styles.input, errors.weight && styles.inputError]}
                        value={weight}
                        onChangeText={(t) => {
                            const v = t.replace(',', '.'); // кома → крапка
                            if (/^\d*\.?\d*$/.test(v)) setWeight(v);
                        }}
                        keyboardType="decimal-pad"
                        placeholder="Введіть вашу вагу (кг)"
                        placeholderTextColor={styles.placeholder.color}
                    />
                    {errors.weight ? <Text style={styles.inputErrorText}>{errors.weight}</Text> : null}

                    <TextInput
                        style={[styles.input, errors.age && styles.inputError]}
                        value={age}
                        onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="Введіть ваш вік"
                        placeholderTextColor={styles.placeholder.color}
                    />
                    {errors.age ? <Text style={styles.inputErrorText}>{errors.age}</Text> : null}

                    <TextInput
                        style={[styles.input, errors.lifestyle && styles.inputError]}
                        value={lifestyle}
                        onChangeText={setLifestyle}
                        placeholder="Опишіть ваш спосіб життя"
                        placeholderTextColor={styles.placeholder.color}
                    />
                    {errors.lifestyle ? <Text style={styles.inputErrorText}>{errors.lifestyle}</Text> : null}

                    <TextInput
                        style={[styles.input, errors.timeForTraining && styles.inputError]}
                        value={trainingTime}
                        onChangeText={(t) => setTrainingTime(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="Введіть час на тренування (хв)"
                        placeholderTextColor={styles.placeholder.color}
                    />
                    {errors.timeForTraining ? <Text style={styles.inputErrorText}>{errors.timeForTraining}</Text> : null}

                    <Field label="Відвідую спортзал" error={errors.visitGym}>
                        <View style={styles.row}>
                            {GYM_OPTIONS.map((o) => (
                                <Chip
                                    key={o.label}
                                    label={o.label}
                                    selected={visitGym === o.value}
                                    onPress={() => setVisitGym(o.value)}
                                />
                            ))}
                        </View>
                    </Field>

                    <Field label="Дні тренувань" error={errors.trainingDays}>
                        <View style={[styles.row, styles.wrap]}>
                            {WEEKDAYS.map((d) => (
                                <Chip
                                    key={d.value}
                                    label={d.label}
                                    selected={days.includes(d.value)}
                                    onPress={() => toggleDay(d.value)}
                                />
                            ))}
                        </View>
                    </Field>

                    <TextInput
                        style={[styles.input, styles.multiline]}
                        value={diseases}
                        onChangeText={setDiseases}
                        multiline
                        placeholder="Введіть ваші хвороби чи травми (якщо немає, залиште порожнім)"
                        placeholderTextColor={styles.placeholder.color}
                    />

                    {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

                    <Pressable
                        onPress={handleSubmit}
                        disabled={saving}
                        style={({ pressed }) => [
                            styles.button,
                            pressed && styles.buttonPressed,
                            saving && styles.buttonDisabled,
                        ]}
                    >
                        <Text style={styles.buttonText}>{saving ? 'Збереження…' : 'Продовжити'}</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        width: '100%',
        backgroundColor: '#F2F2F2',
    },
    scroll: {
        alignItems: 'center',
        paddingTop: 56,
        paddingBottom: 40,
    },
    flameIcon: {
        color: '#E0313A',
        fontSize: 72,
    },
    title: {
        marginTop: 8,
        fontSize: 26,
        fontWeight: '700',
        color: '#E0313A',
    },
    subtitle: {
        marginTop: 4,
        marginBottom: 20,
        paddingHorizontal: 24,
        fontSize: 14,
        color: '#7A7A7A',
        textAlign: 'center',
    },
    card: {
        width: '90%',
        padding: 18,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
    },
    field: {
        marginBottom: 18,
    },
    label: {
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#333333',
    },
    input: {
        marginBottom: 18,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: '#E3E3E3',
        borderRadius: 12,
        backgroundColor: '#F2F2F2',
        fontSize: 16,
        color: '#222222',
    },
    inputError: {
        borderColor: '#E0313A',
    },
    inputErrorText: {
        marginTop: -12,
        marginBottom: 18,
        fontSize: 13,
        color: '#E0313A',
    },
    multiline: {
        minHeight: 84,
        textAlignVertical: 'top',
    },
    placeholder: {
        color: '#A5A5A5',
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    wrap: {
        flexWrap: 'wrap',
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1.5,
        borderColor: '#E0313A',
        borderRadius: 999,
        backgroundColor: '#FFFFFF',
    },
    chipSelected: {
        backgroundColor: '#E0313A',
    },
    chipText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#E0313A',
    },
    chipTextSelected: {
        color: '#FFFFFF',
    },
    error: {
        marginTop: 6,
        fontSize: 13,
        color: '#E0313A',
    },
    submitError: {
        marginTop: 6,
        marginBottom: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#E0313A',
        textAlign: 'center',
    },
    button: {
        marginTop: 6,
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: '#E0313A',
        alignItems: 'center',
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});