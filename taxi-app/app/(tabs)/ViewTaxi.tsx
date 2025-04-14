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
  SafeAreaView,       // Added
  Platform,           // Added
  Alert,              // Added
  ViewStyle,          // Added
  TextStyle           // Added
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
// *** Import AsyncStorage ***
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, fetchData } from "../api/api"; // Assuming correct path
import { FontAwesome, MaterialIcons, Ionicons } from "@expo/vector-icons"; // Added Ionicons
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from "../api/apiUrl";
// --- Types and Interfaces ---
interface Taxi {
  _id: string;
  numberPlate: string;
  currentStop: string;
  status: string;
  currentLoad?: number;
  maxLoad?: number;
}

// --- Navigation Types (Ensure consistent) ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string }; // Keep param in type, but avoid using to pass ID
  requestRide: undefined;
  ViewTaxi: undefined; // Current screen
  ViewRequests: undefined;
  ViewRoute: undefined;
  LiveChat: undefined; // Add params if needed: { chatSessionId: string }
  TaxiManagement: undefined;
  Profile: undefined;
  AcceptedRequest: undefined;
  AcceptedPassenger: undefined;
  Auth: undefined;
};

type ViewTaxiNavigationProp = StackNavigationProp<RootStackParamList, 'ViewTaxi'>;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

// --- Constants ---
const { width: windowWidth } = Dimensions.get("window"); // Use if needed

// *** Define AsyncStorage Key (Ensure it matches HomeScreen) ***
const ASYNC_STORAGE_MONITOR_KEY = 'monitoredTaxiId';

// --- Loading Component ---
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

// --- Action Button Component ---
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

// --- Info Row Component ---
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

  const navigation = useNavigation<ViewTaxiNavigationProp>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const animationTimer = setTimeout(() => { Animated.parallel([ Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }), ]).start(); }, 100);
    return () => clearTimeout(animationTimer);
  }, [fadeAnim, slideAnim]);


  // --- Functions ---
  const searchTaxis = async () => {
    if (!startLocation.trim() || !endLocation.trim()) { Alert.alert("Missing Information", "Please enter both start and end locations."); return; }
    setIsLoading(true); setHasSearched(true); setTaxis([]);
    try {
      const token = await getToken(); if (!token) { Alert.alert("Authentication Error", "Authentication required."); setIsLoading(false); return; }
      const encodedStart = encodeURIComponent(startLocation.trim()); const encodedEnd = encodeURIComponent(endLocation.trim());
      const endpoint = `api/taxis/search?startLocation=${encodedStart}&endLocation=${encodedEnd}`;
      const response = await fetchData(apiUrl, endpoint, { method: "GET", headers: { Authorization: `Bearer ${token}` }, });
      if (response?.taxis) { setTaxis(response.taxis); } else { setTaxis([]); }
    } catch (error: any) { console.error("Error fetching taxis:", error); Alert.alert("Search Error", `Failed to fetch taxis: ${error.message || 'Please try again.'}`); setTaxis([]); }
    finally { setIsLoading(false); }
  };

  // Helper to style status text
  const getStatusStyle = (status: string): TextStyle => { switch (status?.toLowerCase()) { case 'available': return { color: 'green', fontWeight: 'bold' }; case 'full': case 'not available': return { color: 'red', fontWeight: 'bold' }; case 'almost full': case 'on trip': return { color: 'orange', fontWeight: 'bold' }; case 'waiting': case 'roaming': return { color: '#0052A2', fontWeight: 'bold' }; default: return {}; } };

  // *** Handler for Monitor Button ***
    const handleMonitor = async (taxiId: string) => {
        if (!taxiId) { Alert.alert("Error", "Cannot monitor taxi, ID is missing."); return; }
        try {
            console.log(`Saving taxiId ${taxiId} to AsyncStorage and navigating Home...`);
            await AsyncStorage.setItem(ASYNC_STORAGE_MONITOR_KEY, taxiId);
            // Navigate to Home without params, HomeScreen will read from AsyncStorage
            handleNavigate('Home'); // Use the standard navigate handler
        } catch (e) {
            console.error("Failed to save monitoredTaxiId to AsyncStorage", e);
            Alert.alert("Error", "Could not start monitoring. Please try again.");
        }
    };

  // Render Taxi Card
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
                // *** Updated onPress ***
                onPress={() => handleMonitor(item._id)}
                iconName="eye-outline"
                style={styles.monitorButton}
                color="#17a2b8"
            />
         </View>
    </View>
  );

    // Navigation Handler (Corrected)
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        switch (screen) {
            case 'Home':
                // *** FIX APPLIED HERE: Provide an empty object {} for params ***
                navigation.navigate({ name: 'Home', params: {}, merge: true });
                break;
            case 'requestRide':
                // params: undefined is correct here as RootStackParamList defines it as undefined
                navigation.navigate({ name: 'requestRide', params: undefined, merge: true });
                break;
            case 'ViewTaxi':
                break; // Already on this screen
            case 'ViewRoute':
                navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true });
                break;
            case 'ViewRequests':
                navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true });
                break;
            case 'LiveChat':
                // Add params object if/when needed, e.g., { chatId: 'someId' }
                navigation.navigate({ name: 'LiveChat', params: undefined, merge: true });
                break;
            case 'TaxiManagement':
                navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true });
                break;
            case 'Profile':
                navigation.navigate({ name: 'Profile', params: undefined, merge: true });
                break;
            case 'AcceptedRequest':
                navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true });
                break;
            case 'AcceptedPassenger':
                navigation.navigate({ name: 'AcceptedPassenger', params: undefined, merge: true });
                break;
            case 'Auth':
                navigation.navigate({ name: 'Auth', params: undefined, merge: true });
                break;
            default:
                // It's good practice to handle unexpected cases, ensures all enum values are checked
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
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Find a Taxi</Text>
                <View style={styles.headerButton} />{/* Placeholder for alignment */}
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[0]} >
                 {/* Search inputs and button container */}
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
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  // Common styles
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' }, // Ensure SafeAreaView doesn't block gradient
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center' }, // Ensure button is tappable
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' }, // Changed color for visibility
  scrollContent: { flexGrow: 1, }, // Needed for ScrollView content to take height
  searchContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15, backgroundColor: '#FFFFFF', /* Removed border bottom, added slight elevation/shadow? */ elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1 }, // Make search sticky
  input: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#000000', marginBottom: 10, elevation: 1, },
  searchButton: { marginTop: 5, }, // Add slight margin top
  resultsContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 15, paddingBottom: 20, },
  taxiCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 15, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden', }, // Enhanced card styling
  taxiCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F0FE', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D0D8E8', },
  taxiCardTitle: { fontSize: 17, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, flexShrink: 1, }, // Allow shrinking if status is long
  taxiStatus: { fontSize: 14, fontWeight: 'bold', marginLeft: 10, textAlign: 'right', flexShrink: 0, }, // Prevent status shrinking
  taxiCardBody: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 10, },
  taxiCardFooter: { padding: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 5, },
  monitorButton: { paddingVertical: 10, paddingHorizontal: 20, width: '80%', maxWidth: 300, }, // Button styling within footer
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }, // Increased padding slightly
  infoIcon: { marginRight: 10, width: 20, textAlign: 'center' },
  infoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 75 }, // Fixed width for alignment
  infoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1 }, // Value takes remaining space
  // Loading and Empty State Styles
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50, },
  loadingText: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500', },
  emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 30 }, // Add top margin
  emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15 },
  emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5 },
  // Action Button Styles
  actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  actionButtonIcon: { marginRight: 10 },
  actionButtonText: { fontSize: 16, fontWeight: '600' },
  actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },
  // Sidebar Styles (Internal suffix to avoid potential global conflicts)
  sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, /* maxWidth: '80%', */ backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10: 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 /* Adjust for status bar */ },
  sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
  sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 }, // Increased top padding
  sidebarLogoIconInternal: { marginBottom: 10 },
  sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
  sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
  sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
  sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },
  // Kept for potential reuse if a separate fullscreen loading state is needed
  loadingGradient: { flex: 1 }, // Used by fullscreen Loading, keep definition
  loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default ViewTaxi;