import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    Animated,
    ViewStyle,
    TextStyle
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, fetchData } from '../api/api'; // Adjust path if necessary
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';

// --- Types and Interfaces ---
interface TaxiDetails {
    taxiId: string;
    numberPlate: string;
    driverName: string;
    route?: string;
    currentStop: string;
    capacity?: number;
    currentLoad?: number;
    status: string;
    requestId: string; // Crucial for cancellation and chat
}

// --- Navigation Types ---
type RootStackParamList = {
    Home: { acceptedTaxiId?: string };
    requestRide: undefined;
    ViewTaxi: undefined;
    ViewRequests: undefined;
    ViewRoute: undefined;
    LiveChat: { chatSessionId: string };
    TaxiManagement: undefined;
    Profile: undefined;
    AcceptedRequest: undefined; // Current screen
    AcceptedPassenger: undefined;
    Auth: undefined;
};

type AcceptedRequestScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AcceptedRequest'>;

// --- Sidebar Props Interface ---
interface SidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (screen: keyof RootStackParamList) => void;
    activeScreen: keyof RootStackParamList;
}

// --- Constants ---
const ASYNC_STORAGE_MONITOR_KEY = 'monitoredTaxiId';

// --- Loading Component ---
const Loading: React.FC = () => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
            <View style={styles.loadingContainerInternal}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingTextInternal}>Loading Ride Details...</Text></View>
        </LinearGradient>
    );
};

// --- Action Button Component ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    const isDisabled = disabled || loading; // Button is disabled if explicitly disabled OR if loading
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


// --- Main AcceptedRequestsScreen Component ---
const AcceptedRequestsScreen = () => {
    const [taxiDetails, setTaxiDetails] = useState<TaxiDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Changed naming convention
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false); // *** ADDED: State for cancellation loading ***
    const [sidebarVisible, setSidebarVisible] = useState(false);

    const navigation = useNavigation<AcceptedRequestScreenNavigationProp>();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // Fetching Logic
    const fetchTaxiDetails = async (showAlerts = false) => {
        // Prevent fetch if another crucial action is in progress
        if (isChatLoading || isCancelling) {
            console.log("Fetch details skipped: Action in progress.");
            return;
        }
        console.log("Fetching accepted taxi details...");
        setIsLoading(true);
        // Don't clear details immediately, might cause flicker if fetch fails but previous data exists
        // setTaxiDetails(null);
        const token = await getToken();
        if (!token) {
            Alert.alert('Authentication Error', 'Please login.');
            setIsLoading(false);
            setTaxiDetails(null); // Ensure details are cleared if no token
            return;
        }
        try {
            const response = await fetchData(apiUrl, 'api/rideRequest/acceptedTaxiDetails', {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` }
            });

            // Check if the response contains valid taxiDetails
            if (response?.taxiDetails && Object.keys(response.taxiDetails).length > 0) {
                console.log("Accepted taxi details found:", response.taxiDetails);
                setTaxiDetails(response.taxiDetails);
            } else {
                // This is the "No accepted ride" state - perfectly normal
                console.log("No accepted taxi details found.");
                setTaxiDetails(null);
                if (showAlerts) {
                    Alert.alert('No Active Ride', 'You do not have an active accepted ride request.');
                }
            }
        } catch (error: any) {
            console.error('Error fetching taxi details:', error);
            // Keep existing details if fetch fails, unless it's the initial load
            // Set to null only if there were no details before the fetch attempt
            if (!taxiDetails) {
                setTaxiDetails(null);
            }
            // Show error only on manual refresh or if it's a genuine fetch problem (not just 'not found')
             if (showAlerts || !taxiDetails) { // Show alert on manual refresh or if it was already empty
                 // Avoid generic alerts for 404-like errors if possible, check error details if available
                 // Example: if (error.status !== 404) { ... }
                Alert.alert('Fetch Error', `Failed to fetch ride details: ${error.message || 'Unknown error'}`);
             }
        } finally {
            setIsLoading(false); // Ensure loading is always stopped
        }
    };

    // Fetch on Focus
    useFocusEffect(
        React.useCallback(() => {
            // Only fetch if no *other* action is currently in progress
            if (!isChatLoading && !isCancelling) {
                fetchTaxiDetails(false); // Fetch without alerts on focus
            }
            // Optional: Reset animations if needed on focus
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isChatLoading, isCancelling]) // Re-run if action states change (to potentially fetch after action)
    );

    // Animation Effect
    useEffect(() => {
        if (!isLoading) {
            const t = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]).start();
            }, 100); // Small delay to allow state to settle
            return () => clearTimeout(t);
        }
    }, [isLoading, fadeAnim, slideAnim]);


    // Chat Initiation Handler
    const handleChat = async () => {
        // Prevent action if no details, or another action is in progress
        if (!taxiDetails?.requestId || isChatLoading || isCancelling) return;

        setIsChatLoading(true);
        const token = await getToken();
        if (!token) { Alert.alert('Authentication Error', 'Please login.'); setIsChatLoading(false); return; }

        try {
            const response = await fetchData(apiUrl, 'api/chat/passenger-initiate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: taxiDetails.requestId }),
            });
            if (response?.chatSessionId) {
                handleNavigate('LiveChat', { chatSessionId: response.chatSessionId });
            } else {
                throw new Error(response?.message || 'Failed to initiate chat session.');
            }
        } catch (error: any) {
            console.error('Error initiating chat:', error);
            Alert.alert('Chat Error', error.message || 'Could not start chat session.');
        } finally {
            setIsChatLoading(false); // Ensure state is reset
        }
    };

    // *** MODIFIED: Implement Cancel Ride Handler for Passenger ***
    const handleCancelRide = (requestId: string) => {
        // Prevent action if another action is in progress
        if (isChatLoading || isCancelling) return;

        Alert.alert(
            'Confirm Cancellation',
            'Are you sure you want to cancel this ride request?',
            [
                { text: 'Keep Ride', style: 'cancel', onPress: () => {} },
                {
                    text: 'Cancel Ride',
                    style: 'destructive',
                    onPress: async () => {
                        if (!requestId) {
                            Alert.alert('Error', 'Cannot cancel ride: Request ID is missing.');
                            return;
                        }
                        setIsCancelling(true); // Set loading state
                        const token = await getToken();
                        if (!token) {
                            Alert.alert('Authentication Error', 'Please login.');
                            setIsCancelling(false);
                            return;
                        }
                        try {
                            console.log(`Attempting to cancel ride request ID: ${requestId} as passenger...`);
                            // *** USE THE CORRECT PASSENGER CANCELLATION ENDPOINT ***
                            const response = await fetchData(apiUrl, `api/riderequests/${requestId}/cancel/passenger`, {
                                method: 'DELETE', // Use DELETE method as per typical REST practices for cancellation
                                headers: { Authorization: `Bearer ${token}` },
                            });

                            // Check for successful response (adjust based on your actual API response)
                            if (response?.success || response?.message?.includes("cancelled")) { // Check common success patterns
                                Alert.alert('Success', 'Your ride request has been cancelled.');
                                // Clear the details from the screen as the ride is gone
                                setTaxiDetails(null);
                                // Optional: Navigate away after cancellation
                                // handleNavigate('Home');
                            } else {
                                // Handle potential backend errors or unexpected responses
                                throw new Error(response?.error || response?.message || 'Failed to cancel ride.');
                            }
                        } catch (error: any) {
                            console.error('Error cancelling ride:', error);
                            Alert.alert('Cancellation Error', `Could not cancel ride: ${error.message}`);
                        } finally {
                            setIsCancelling(false); // Reset loading state regardless of outcome
                        }
                    }
                }
            ]
        );
    };

    // Helper to style status text
    const getStatusStyle = (status: string): TextStyle => {
        switch (status?.toLowerCase()) {
            case 'accepted': return { color: 'green', fontWeight: 'bold' };
            case 'pending': return { color: 'orange', fontWeight: 'bold' };
            case 'picked_up': return { color: '#0052A2', fontWeight: 'bold' }; // Example for picked up
            case 'dropped_off': return { color: '#555', fontWeight: 'bold' }; // Example for dropped off
            case 'cancelled': return { color: 'red', fontWeight: 'bold' };
            default: return { color: '#333' }; // Default style
        }
    };

    // Navigation Handler
    const handleNavigate = (screen: keyof RootStackParamList, params?: any) => {
        setSidebarVisible(false); // Close sidebar on navigation
        // Standard navigation logic (ensure all needed screens are handled)
        switch (screen) {
           case 'Home': navigation.navigate({ name: 'Home', params: params, merge: true }); break;
           case 'requestRide': navigation.navigate({ name: 'requestRide', params: params, merge: true }); break;
           // ... include all other cases from your original code ...
           case 'LiveChat': if (params?.chatSessionId) { navigation.navigate('LiveChat', { chatSessionId: params.chatSessionId }); } else { console.warn("Missing chatSessionId for LiveChat navigation."); } break;
           case 'AcceptedRequest': break; // Already here, do nothing
           // ... include all other cases ...
           default: console.warn(`Attempted to navigate to unhandled screen: ${screen}`); break;
        }
    };

    // Monitor Handler
    const handleMonitor = async () => {
        // Prevent action if another action is in progress
        if (!taxiDetails?.taxiId || isChatLoading || isCancelling) {
             if (!taxiDetails?.taxiId) Alert.alert("Error", "Cannot monitor taxi, ID is missing.");
            return;
        }
        try {
            console.log(`Saving taxiId ${taxiDetails.taxiId} to AsyncStorage and navigating Home...`);
            await AsyncStorage.setItem(ASYNC_STORAGE_MONITOR_KEY, taxiDetails.taxiId);
            handleNavigate('Home'); // Navigate to Home which should pick up the monitored ID
        } catch (e) {
            console.error("Failed to save monitoredTaxiId to AsyncStorage", e);
            Alert.alert("Error", "Could not start monitoring. Please try again.");
        }
    };

    const toggleSidebar = () => {
        // Only allow opening/closing if no critical action is happening
        if (!isChatLoading && !isCancelling) {
           setSidebarVisible(!sidebarVisible);
        }
    };

    // --- Render Logic ---
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                {/* Sidebar remains available even if no ride data */}
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="AcceptedRequest" />

                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.header}>
                        {/* *** UPDATED: Disable button only during actions *** */}
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar} disabled={isChatLoading || isCancelling}>
                            <Ionicons name="menu" size={32} color="#003E7E" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>My Ride Details</Text>
                        {/* *** UPDATED: Disable button during ANY loading state *** */}
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => fetchTaxiDetails(true)} // Manual refresh shows alerts on failure/no data
                            disabled={isLoading || isChatLoading || isCancelling} // Disable if *any* load is happening
                        >
                            {/* Show spinner only for the main fetch, not chat/cancel */}
                            {(isLoading && !isChatLoading && !isCancelling) ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
                        </TouchableOpacity>
                    </View>

                    {/* Conditional Rendering based on states */}
                    {isLoading ? (
                        <Loading />
                    ) : taxiDetails ? (
                        // --- Display Taxi Details ---
                        <ScrollView contentContainerStyle={styles.scrollContent}>
                            <View style={styles.detailsCard}>
                                <View style={styles.detailsCardHeader}>
                                    <MaterialIcons name="local-taxi" size={24} color="#003E7E" />
                                    <Text style={styles.detailsCardTitle}>{taxiDetails.numberPlate}</Text>
                                    <Text style={[styles.detailsStatus, getStatusStyle(taxiDetails.status)]}>{taxiDetails.status}</Text>
                                </View>
                                <View style={styles.detailsCardBody}>
                                    <InfoRow label="Driver" value={taxiDetails.driverName} iconName="person-outline" />
                                    <InfoRow label="Location" value={taxiDetails.currentStop} iconName="location-outline" />
                                    {taxiDetails.route && <InfoRow label="Route" value={taxiDetails.route} iconName="map-outline"/>}
                                    {/* Add other details as needed */}
                                </View>
                                <View style={styles.detailsCardFooter}>
                                    <ActionButton
                                        title="Cancel Ride"
                                        onPress={() => handleCancelRide(taxiDetails.requestId)}
                                        iconName="close-circle-outline"
                                        style={styles.actionButtonSmall}
                                        color="#dc3545" // Red for cancel
                                        // *** UPDATED: Set loading and disabled states ***
                                        loading={isCancelling}
                                        disabled={isChatLoading || isCancelling} // Disable if chat is loading or already cancelling
                                    />
                                    <ActionButton
                                        title="Chat Driver"
                                        onPress={handleChat}
                                        iconName="chatbubble-ellipses-outline"
                                        style={styles.actionButtonSmall}
                                        color="#007bff" // Blue for chat
                                        loading={isChatLoading}
                                        // *** UPDATED: Disable if cancelling is in progress ***
                                        disabled={isChatLoading || isCancelling} // Disable if cancelling or already chatting
                                    />
                                    <ActionButton
                                        title="Monitor Live"
                                        onPress={handleMonitor}
                                        iconName="eye-outline"
                                        style={styles.actionButtonSmall}
                                        color="#17a2b8" // Teal for monitor
                                        // *** UPDATED: Disable if any action is in progress ***
                                        disabled={isChatLoading || isCancelling} // Disable if any action is busy
                                    />
                                </View>
                            </View>
                        </ScrollView>
                    ) : (
                        // --- Display "No Active Ride" Message ---
                        <View style={styles.emptyContainer}>
                            <Ionicons name="car-outline" size={60} color="#888" />
                            <Text style={styles.emptyText}>You don't have an active ride request.</Text>
                            <Text style={styles.emptySubText}>Your accepted ride details will appear here once available.</Text>
                            {/* Optionally add a button to request a new ride */}
                             <ActionButton
                                title="Request a Ride Now"
                                onPress={() => handleNavigate('requestRide')}
                                style={{marginTop: 20}}
                                // Disable if any loading state is active (e.g., initial load failed but user is trying actions)
                                disabled={isLoading || isChatLoading || isCancelling}
                             />
                        </View>
                    )}
                </Animated.View>
            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles --- (Keep your existing styles, ensure styles mentioned like actionButtonDisabled are defined)
const styles = StyleSheet.create({
    // ... (Include ALL your styles from the original code here)
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%', backgroundColor: 'transparent' /* Ensure header isn't blocking gradient */ },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' }, // Adjust color if needed for contrast
    scrollContent: { padding: 20, flexGrow: 1, justifyContent: 'center' }, // Center content vertically if scroll area isn't full
    detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginHorizontal: 5, elevation: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden' },
    detailsCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F0FE', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D0D8E8' },
    detailsCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, flex: 1 },
    detailsStatus: { fontSize: 14, fontWeight: 'bold', marginLeft: 10, textAlign: 'right' },
    detailsCardBody: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 15 }, // Added top padding
    detailsCardFooter: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 10, backgroundColor: '#F8F9FA' /* Optional: Subtle background */ },
    actionButtonSmall: { paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: 4, flexGrow: 1, flexShrink: 1, minWidth: 90, alignItems: 'center', justifyContent: 'center' }, // Allow growing but also shrinking, added minWidth
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }, // Increased padding slightly
    infoIcon: { marginRight: 12, width: 20, textAlign: 'center' },
    infoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 80 }, // Slightly reduced width
    infoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1, flexWrap: 'wrap' }, // Allow text wrapping
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, opacity: 0.8 }, // Slightly transparent
    emptyText: { fontSize: 18, fontWeight: '600', color: '#444', textAlign: 'center', marginTop: 15 },
    emptySubText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 }, // Added line height
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 25, /* Pill shape */ elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, minHeight: 44 /* Ensure touchable area */ },
    actionButtonIcon: { marginRight: 8 },
    actionButtonText: { fontSize: 15, fontWeight: '600', textAlign: 'center'},
    actionButtonDisabled: { backgroundColor: '#B0B0B0', /* Lighter gray */ elevation: 0, shadowOpacity: 0, opacity: 0.6 }, // Adjusted disabled style
    loadingGradient: { flex: 1 }, // Ensure gradient covers the whole area
    loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' /* Important for gradient */ },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
    // --- Add Sidebar Styles Here ---
    // If Sidebar component doesn't import its own styles, paste them here
    // e.g., sidebarInternal, sidebarCloseButtonInternal, etc.
});

export default AcceptedRequestsScreen;