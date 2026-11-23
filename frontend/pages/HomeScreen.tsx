import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View, Image, Pressable, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.0.2.2:3001';
const API_URL = `${BASE_URL}/api/user`;

const RED = '#E0313A';

function pluralDays(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'день поспіль';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дні поспіль';
    return 'днів поспіль';
}

type Status = 'checking' | 'ok' | 'error';

export default function HomeScreen() {
    const navigation = useNavigation<any>();

    const [status, setStatus] = useState<Status>('checking');
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    const dayCounter = 0;

    const message =
        dayCounter === 0
            ? 'Почніть сьогодні: перше тренування запустить вашу серію'
            : 'Так тримати! Не перериайте серію';

    const goToLogin = useCallback(() => {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;

            (async () => {
                setStatus('checking');
                setError(null);

                try {
                    const userId = await AsyncStorage.getItem('userId');
                    if (!userId) {
                        if (!cancelled) goToLogin();
                        return;
                    }

                    const res = await fetch(
                        `${API_URL}/profile?userId=${encodeURIComponent(userId)}`
                    );
                    if (cancelled) return;

                    if (res.status === 404) {
                        goToLogin();
                        return;
                    }

                    if (!res.ok) {
                        setError(`Помилка сервера (код ${res.status})`);
                        setStatus('error');
                        return;
                    }

                    setStatus('ok');
                } catch (e) {
                    if (cancelled) return;
                    console.log('Network error:', API_URL, e);
                    setError(`Немає звʼязку з ${API_URL}`);
                    setStatus('error');
                }
            })();

            return () => {
                cancelled = true;
            };
        }, [goToLogin, attempt])
    );

    return (
        <View style={styles.root}>
            <View style={styles.content}>

                <View style={{ width:'100%', height:'80%', justifyContent:'center', alignItems: 'center' }} >
                    <Image style = {{ width:'80%' }} source = {require('../assets/meimei.webp')} ></Image>
                    <Text style = {styles.title} >Your goal physique</Text>
                </View>

            </View>

            <View style={styles.tabBar}>
                <Pressable onPress={() => navigation.navigate('Home')} style={styles.tab}>
                    <Image source={require('../images/home.png')} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Trainings')} style={styles.tab}>
                    <Image source={require('../images/training.png')} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Meals')} style={styles.tab}>
                    <Image source={require('../images/meal.png')} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Profile')} style={styles.tab}>
                    <Image source={require('../images/profile.png')} />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        width: '100%',
        backgroundColor: '#F2F2F2',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    center: {
        alignItems: 'center',
    },
    title: {
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
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 18,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        // тінь: iOS + Android
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    fire: {
        width: 120,
        height: 120,
    },
    counter: {
        marginTop: 8,
        fontSize: 64,
        fontWeight: '800',
        color: '#E0313A',
    },
    counterLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
    },
    divider: {
        width: '80%',
        height: 1.5,
        marginVertical: 20,
        backgroundColor: '#E3E3E3',
    },
    message: {
        fontSize: 14,
        color: '#7A7A7A',
        textAlign: 'center',
    },
    hint: {
        marginTop: 16,
        fontSize: 16,
        color: '#7A7A7A',
        textAlign: 'center',
    },
    error: {
        fontSize: 16,
        color: '#E0313A',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    btn: {
        alignSelf: 'stretch',
        backgroundColor: '#E0313A',
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.8,
    },
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 18,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        backgroundColor: '#E0313A',
    },
    tab: {
        padding: 6,
    },
});