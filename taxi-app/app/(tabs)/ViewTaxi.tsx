import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Dimensions,
    Animated,
    ScrollView,
    ActivityIndicator, // Keep for inline button loading
    SafeAreaView,
    Platform,
    // Alert, // REMOVED Alert
    ViewStyle,
    TextStyle
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, fetchData } from "../api/api"; // Assuming correct path
import { FontAwesome, MaterialIcons, Ionicons } from "@expo/vector-icons"; // Added Ionicons
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from "../api/apiUrl";

// *** Import the new ErrorPopup component ***
import ErrorPopup from '../components/ErrorPopup'; // (ADJUST PATH if needed)

// --- Types and Interfaces (Keep as is) ---
interface Taxi {
    _id: string;
    numberPlate: string;
    currentStop: string;
    status: string;
    currentLoad?: number;
    maxLoad?: number;
}

// --- Navigation Types (Keep as is) ---
type RootStackParamList = {
    Home: { acceptedTaxiId?: string };
    requestRide: undefined;
    ViewTaxi: undefined;
    ViewRequests: undefined;
    ViewRoute: undefined;
    LiveChat: undefined;
    TaxiManagement: undefined;
    Profile: undefined;
    AcceptedRequest: undefined;
    AcceptedPassenger: undefined;
    Auth: undefined;
    TaxiFareCalculator: undefined;
};

type ViewTaxiNavigationProp = StackNavigationProp<RootStackParamList, 'ViewTaxi'>;

interface SidebarProps { // Keep as is
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (screen: keyof RootStackParamList) => void;
    activeScreen: keyof RootStackParamList;
}

// --- Constants (Keep as is) ---
const { width: windowWidth } = Dimensions.get("window");
const ASYNC_STORAGE_MONITOR_KEY = 'monitoredTaxiId';

// --- Loading Component (Keep as is) ---
const Loading: React.FC = () => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <View style={styles.loadingContainer}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View>
            <Text style={styles.loadingText}>Searching for taxis...</Text>
        </View>
    );
};

// --- Action Button Component (Keep as is) ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    const isDisabled = disabled || loading;
    return (
        <TouchableOpacity style={[ styles.actionButtonBase, { backgroundColor: color }, style, isDisabled && styles.actionButtonDisabled ]} onPress={onPress} disabled={isDisabled}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : ( <>
            {iconName && <IconComponent name={iconName} size={18} color={textColor} style={styles.actionButtonIcon} />}
            <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
            </> )}
        </TouchableOpacity>
    );
};


// --- Info Row Component (Keep as is) ---
const InfoRow: React.FC<{ label: string; value: string | number | undefined; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; valueStyle?: TextStyle }> =
    ({ label, value, iconName, iconFamily = 'Ionicons', valueStyle = {} }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    return (
        <View style={styles.infoRow}>
            <IconComponent name={iconName} size={18} color="#555" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>{label}:</Text>
            <Text style={[styles.infoValue, valueStyle]}>{value ?? 'N/A'}</Text>
        </View>
    );
};

// --- Main ViewTaxi Component ---
const ViewTaxi: React.FC = () => {
    const [startLocation, setStartLocation] = useState<string>("");
    const [endLocation, setEndLocation] = useState<string>("");
    const [taxis, setTaxis] = useState<Taxi[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    // *** Add State for Error Popup ***
    const [isErrorPopupVisible, setIsErrorPopupVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const navigation = useNavigation<ViewTaxiNavigationProp>();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => { // Keep animation effect
        const animationTimer = setTimeout(() => { Animated.parallel([ Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }), ]).start(); }, 100);
        return () => clearTimeout(animationTimer);
    }, [fadeAnim, slideAnim]);


    // --- Functions ---

    // *** Helper function to show the error popup ***
    const showErrorPopup = (message: string) => {
        setErrorMessage(message);
        setIsErrorPopupVisible(true);
    };

    const searchTaxis = async () => {
        // *** Use showErrorPopup for client-side validation ***
        if (!startLocation.trim() || !endLocation.trim()) {
            showErrorPopup("Please enter both start and end locations.");
            return;
        }
        setIsLoading(true); setHasSearched(true); setTaxis([]);
        try {
            const token = await getToken();
            // *** Use showErrorPopup for auth error ***
            if (!token) {
                showErrorPopup("Authentication required. Please log in again.");
                setIsLoading(false);
                // Consider navigating to Auth screen here if desired:
                // navigation.navigate('Auth');
                return;
            }
            const encodedStart = encodeURIComponent(startLocation.trim());
            const encodedEnd = encodeURIComponent(endLocation.trim());
            const endpoint = `api/taxis/search?startLocation=${encodedStart}&endLocation=${encodedEnd}`;

            const response = await fetchData(apiUrl, endpoint, {
                 method: "GET",
                 headers: { Authorization: `Bearer ${token}` },
            });

            if (response?.taxis) {
                 setTaxis(response.taxis);
            } else {
                 setTaxis([]);
                 // Optional: Show message if API succeeded but returned no taxis (different from error)
                 // Could check response status code or a specific flag if API provides one
                 // For now, handled by the empty list display logic below
            }
        } catch (error: any) {
            console.error("Error fetching taxis:", error);
            // *** Use showErrorPopup for API errors, attempt to get specific message ***
            let displayMessage = "An unexpected error occurred while searching for taxis.";
            if (error?.response?.data?.message) {
                displayMessage = error.response.data.message;
            } else if (error?.data?.message) { // Check if error object itself has a message property
                displayMessage = error.data.message;
            } else if (error?.message) { // Fallback to generic error message
                displayMessage = `Failed to fetch taxis: ${error.message}`;
            }
            showErrorPopup(displayMessage);
            setTaxis([]); // Ensure taxis list is cleared on error
        }
        finally {
            setIsLoading(false);
        }
    };

    // Helper to style status text (Keep as is)
    const getStatusStyle = (status: string): TextStyle => {
         switch (status?.toLowerCase()) {
            case 'available': return { color: 'green', fontWeight: 'bold' };
            case 'full': case 'not available': return { color: 'red', fontWeight: 'bold' };
            case 'almost full': case 'on trip': return { color: 'orange', fontWeight: 'bold' };
            case 'waiting': case 'roaming': return { color: '#0052A2', fontWeight: 'bold' };
            default: return {};
         }
    };

    // Handler for Monitor Button
    const handleMonitor = async (taxiId: string) => {
        // *** Use showErrorPopup for missing ID ***
        if (!taxiId) {
            showErrorPopup("Cannot monitor taxi, ID is missing.");
            return;
        }
        try {
            console.log(`Saving taxiId ${taxiId} to AsyncStorage and navigating Home...`);
            await AsyncStorage.setItem(ASYNC_STORAGE_MONITOR_KEY, taxiId);
            handleNavigate('Home'); // Use the standard navigate handler
        } catch (e) {
            console.error("Failed to save monitoredTaxiId to AsyncStorage", e);
            // *** Use showErrorPopup for AsyncStorage error ***
            showErrorPopup("Could not start monitoring due to a storage error. Please try again.");
        }
    };

    // Render Taxi Card (Keep as is, including ActionButton usage)
    const renderTaxi = ({ item }: { item: Taxi }) => (
        <View style={styles.taxiCard}>
            <View style={styles.taxiCardHeader}>
                <MaterialIcons name="local-taxi" size={22} color="#003E7E" />
                <Text style={styles.taxiCardTitle}>{item.numberPlate}</Text>
                 <Text style={[styles.taxiStatus, getStatusStyle(item.status)]}>{item.status}</Text>
            </View>
            <View style={styles.taxiCardBody}>
                <InfoRow label="Location" value={item.currentStop} iconName="location-outline"/>
                 {item.currentLoad !== undefined && ( <InfoRow label="Load" value={item.maxLoad !== undefined ? `${item.currentLoad} / ${item.maxLoad}` : item.currentLoad} iconName="people-outline"/> )}
            </View>
             <View style={styles.taxiCardFooter}>
                <ActionButton
                     title="Monitor Live"
                     onPress={() => handleMonitor(item._id)}
                     iconName="eye-outline"
                     style={styles.monitorButton}
                     color="#17a2b8" // Example: Monitor button color
                />
             </View>
        </View>
    );

    // Navigation Handler (Keep as is)
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        // Reset error when navigating away? Optional, but can be good practice
        // setIsErrorPopupVisible(false);
        // setErrorMessage('');
        switch (screen) {
            case 'Home': navigation.navigate({ name: 'Home', params: {}, merge: true }); break;
            case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
            case 'ViewTaxi': break; // Already here
            case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true }); break;
            case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true }); break;
            case 'LiveChat': navigation.navigate({ name: 'LiveChat', params: undefined, merge: true }); break;
            case 'TaxiFareCalculator': navigation.navigate({ name: 'TaxiFareCalculator', params: undefined, merge: true }); break;
            case 'TaxiManagement': navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true }); break;
            case 'Profile': navigation.navigate({ name: 'Profile', params: undefined, merge: true }); break;
            case 'AcceptedRequest': navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true }); break;
            case 'AcceptedPassenger': navigation.navigate({ name: 'AcceptedPassenger', params: undefined, merge: true }); break;
            case 'Auth': navigation.navigate({ name: 'Auth', params: undefined, merge: true }); break;
            default:
                const exhaustiveCheck: never = screen;
                console.warn(`Attempted to navigate to unhandled screen: ${exhaustiveCheck}`);
                break;
        }
    };

    const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

    // --- Render Logic ---
    return (
        <LinearGradient colors={["#FFFFFF", "#E8F0FE"]} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="ViewTaxi" />
                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    {/* Header (Keep as is) */}
                    <View style={styles.header}>
                         <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                         <Text style={styles.headerTitle}>Find a Taxi</Text>
                         <View style={styles.headerButton} />{/* Placeholder */}
                    </View>
                    {/* ScrollView and Content (Keep structure as is) */}
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[0]} >
                         {/* Search inputs container */}
                         <View style={styles.searchContainer}>
                             <TextInput style={styles.input} placeholder="Enter Start Location or Stop" placeholderTextColor="#aaa" value={startLocation} onChangeText={setStartLocation} />
                             <TextInput style={styles.input} placeholder="Enter End Location or Stop" placeholderTextColor="#aaa" value={endLocation} onChangeText={setEndLocation} />
                             <ActionButton title="Find Taxis" onPress={searchTaxis} iconName="search" iconFamily="FontAwesome" loading={isLoading} disabled={isLoading} style={styles.searchButton} />
                         </View>

                         {/* Results container */}
                        <View style={styles.resultsContainer}>
                             {isLoading ? <Loading />
                             : hasSearched && taxis.length === 0 ? ( <View style={styles.emptyListContainer}><Ionicons name="car-sport-outline" size={50} color="#888" /><Text style={styles.emptyListText}>No taxis found matching your search.</Text><Text style={styles.emptyListSubText}>Please check your locations or try again later.</Text></View> )
                             : !hasSearched ? ( <View style={styles.emptyListContainer}><Ionicons name="search-circle-outline" size={50} color="#888" /><Text style={styles.emptyListText}>Enter start and end locations to find taxis.</Text></View> )
                             : ( <FlatList data={taxis} keyExtractor={(item) => item._id} renderItem={renderTaxi} /> )}
                         </View>
                    </ScrollView>
                </Animated.View>

                {/* *** Render the Error Popup *** */}
                {/* Place it here so it overlays everything within the SafeAreaView */}
                <ErrorPopup
                    visible={isErrorPopupVisible}
                    message={errorMessage}
                    onClose={() => setIsErrorPopupVisible(false)}
                    // Optional: You can pass custom colors if needed
                    // colors={{ background: '#yourColor', textPrimary: '#anotherColor' }}
                />
            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles (Keep as is) ---
// Copied from your provided code... ensure they are complete
const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
    scrollContent: { flexGrow: 1, },
    searchContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15, backgroundColor: '#FFFFFF', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1 },
    input: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#000000', marginBottom: 10, elevation: 1, },
    searchButton: { marginTop: 5, },
    resultsContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 15, paddingBottom: 20, },
    taxiCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 15, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden', },
    taxiCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F0FE', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D0D8E8', },
    taxiCardTitle: { fontSize: 17, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, flexShrink: 1, },
    taxiStatus: { fontSize: 14, fontWeight: 'bold', marginLeft: 10, textAlign: 'right', flexShrink: 0, },
    taxiCardBody: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 10, },
    taxiCardFooter: { padding: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 5, },
    monitorButton: { paddingVertical: 10, paddingHorizontal: 20, width: '80%', maxWidth: 300, },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
    infoIcon: { marginRight: 10, width: 20, textAlign: 'center' },
    infoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 75 },
    infoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50, },
    loadingText: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500', },
    emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 30 },
    emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15 },
    emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5 },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },
    // Sidebar styles etc should remain here...
});

export default ViewTaxi;