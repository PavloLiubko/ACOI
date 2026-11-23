import {createStaticNavigation, StaticParamList} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from "./pages/HomeScreen";
import TrainingScreen from "./pages/TrainingScreen";
import MealScreen from "./pages/MealScreen";
import ProfileScreen from "./pages/ProfileScreen";
import LoginScreen from "./pages/LoginScreen";

const Navigator = createNativeStackNavigator({
    initialRouteName: 'Home',
    screenOptions: {
        headerShown: false,
    },
    screens: {
        Home: {
            screen: HomeScreen,
        },
        Trainings: {
            screen: TrainingScreen,
        },
        Meals: {
            screen: MealScreen,
        },
        Profile: {
            screen: ProfileScreen,
        },
        Login: {
            screen: LoginScreen,
        }
    }
});

type RootStackParamList = StaticParamList<typeof Navigator>;

declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList {}
    }
}

const Navigation = createStaticNavigation(Navigator);


export default function App() {
    return <Navigation />;
}


