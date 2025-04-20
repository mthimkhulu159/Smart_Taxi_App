import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView, // Keep for single accepted view
    FlatList,   // Use for pending list view
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Alert,
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
import CustomConfirm from '../components/CustomConfirm'; // Import CustomConfirm
import { RootStackParamList } from '../types/navigation';

// --- Interfaces ---
// Interface for the accepted request details (matches original + backend)
interface TaxiDetails {
    taxiId: string;
    numberPlate: string;
    driverName: string;
    driverContact?: string; // Added from backend ref
    route?: string;
    currentStop: string;
    capacity?: number;
    currentLoad?: number;
    status: string; // Taxi status or Ride status? Assuming Ride status here.
    requestId: string; // Crucial for cancellation and chat
}

// Interface for pending request details (matches backend ref)
interface PendingRequestDetail {
    requestId: string;
    startingStop: string;
    destinationStop: string;
    route?: string;
    requestType?: string;
    status: 'pending'; // Explicitly pending
    createdAt: string;
}

type AcceptedRequestsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AcceptedRequest'>; // Screen name might need update

// --- Sidebar Props Interface ---
interface SidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (screen: keyof RootStackParamList) => void;
    activeScreen: keyof RootStackParamList;
}

// --- Constants ---
const ASYNC_STORAGE_MONITOR_KEY = 'monitoredTaxiId';

// --- Reusable Components ---
const Loading: React.FC<{ text?: string }> = ({ text = "Loading Details..."}) => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
            <View style={styles.loadingContainerInternal}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingTextInternal}>{text}</Text></View>
        </LinearGradient>
    );
};

const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    const isDisabled = disabled || loading;
    return (
        <TouchableOpacity style={[ styles.actionButtonBase, { backgroundColor: color }, style, isDisabled && styles.actionButtonDisabled ]} onPress={onPress} disabled={isDisabled} activeOpacity={isDisabled ? 1 : 0.6}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : ( <>
            {iconName && <IconComponent name={iconName} size={18} color={textColor} style={styles.actionButtonIcon} />}
            <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
            </> )}
        </TouchableOpacity>
    );
};

const InfoRow: React.FC<{ label: string; value: string | number | undefined; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; valueStyle?: TextStyle; numberOfLines?: number }> =
    ({ label, value, iconName, iconFamily = 'Ionicons', valueStyle = {}, numberOfLines = 1 }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    return (
        <View style={styles.infoRow}>
            <IconComponent name={iconName} size={18} color="#555" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>{label}:</Text>
            <Text style={[styles.infoValue, valueStyle]} numberOfLines={numberOfLines} ellipsizeMode="tail">{value ?? 'N/A'}</Text>
        </View>
    );
};


// --- Main Screen Component ---
const AcceptedRequestsScreen = () => {
    // State for view toggle and data
    const [viewStatus, setViewStatus] = useState<'accepted' | 'pending'>('accepted'); // Default view
    const [acceptedRequestDetails, setAcceptedRequestDetails] = useState<TaxiDetails | null>(null);
    const [pendingRequests, setPendingRequests] = useState<PendingRequestDetail[]>([]);

    // Loading and action states
    const [isLoading, setIsLoading] = useState(true);
    const [actionInProgress, setActionInProgress] = useState<{ type: 'cancel' | 'chat' | 'monitor', requestId: string } | null>(null);

    // Other states (Sidebar, Confirm Dialog)
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [customConfirmVisible, setCustomConfirmVisible] = useState(false);
    const [customConfirmMessage, setCustomConfirmMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

    const navigation = useNavigation<AcceptedRequestsScreenNavigationProp>();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // --- Confirmation Dialog Logic (Unchanged from original) ---
    const showCustomConfirm = (message: string, onConfirm: () => void) => {
        console.log('showCustomConfirm called', message, onConfirm);
        setCustomConfirmMessage(message);
        setOnConfirmAction(() => onConfirm);
        setCustomConfirmVisible(true);
    };
    const hideCustomConfirm = () => {
        setCustomConfirmVisible(false);
        setCustomConfirmMessage('');
        setOnConfirmAction(null);
    };
    const handleConfirm = () => {
        if (onConfirmAction) {
            onConfirmAction();
        }
        hideCustomConfirm();
    };

    // --- Fetching Logic ---
    const fetchDataBasedOnStatus = useCallback(async (status: 'accepted' | 'pending', showAlerts = false) => {
        if (actionInProgress) {
            console.log(`Fetch skipped: Action (${actionInProgress.type} on ${actionInProgress.requestId}) in progress.`);
            return;
        }
        console.log(`Fetching '${status}' requests...`);
        setIsLoading(true);
        // Clear the *other* state when fetching
        if (status === 'accepted') setPendingRequests([]);
        else setAcceptedRequestDetails(null);

        const token = await getToken();
        if (!token) {
            Alert.alert('Authentication Error', 'Please login.');
            setIsLoading(false);
            return;
        }

        try {
            let response: any;
            if (status === 'accepted') {
                // Fetch single accepted request
                const endpoint = 'api/rideRequest/acceptedRequests'; // From backend ref
                console.log("Calling endpoint:", endpoint);
                response = await fetchData(apiUrl, endpoint, {
                    method: 'GET', headers: { Authorization: `Bearer ${token}` }
                });
                // Handle response for single accepted request
                if (response?.taxiDetails && Object.keys(response.taxiDetails).length > 0) {
                    console.log("Accepted taxi details found:", response.taxiDetails);
                    setAcceptedRequestDetails(response.taxiDetails);
                } else {
                    console.log("No accepted taxi details found.");
                    setAcceptedRequestDetails(null);
                    if (showAlerts) Alert.alert('No Active Ride', 'You do not have an active accepted ride request.');
                }
            } else { // status === 'pending'
                // Fetch list of pending requests
                const endpoint = 'api/rideRequest/pendingRequests'; // Assumed from backend ref function name
                console.log("Calling endpoint:", endpoint);
                response = await fetchData(apiUrl, endpoint, {
                    method: 'GET', headers: { Authorization: `Bearer ${token}` }
                });
                // Handle response for list of pending requests
                if (response?.pendingRequests && Array.isArray(response.pendingRequests)) {
                    console.log(`Found ${response.pendingRequests.length} pending requests.`);
                    setPendingRequests(response.pendingRequests);
                    if (showAlerts && response.pendingRequests.length === 0) {
                        Alert.alert('No Pending Requests', 'You have no pending ride requests.');
                    }
                } else {
                    console.log(`No pending requests found or invalid response format.`);
                    setPendingRequests([]);
                    if (showAlerts) Alert.alert('No Pending Requests', 'You have no pending ride requests.');
                }
            }
        } catch (error: any) {
            console.error(`Error fetching ${status} requests:`, error);
            // Clear the relevant state on error
            if (status === 'accepted') setAcceptedRequestDetails(null);
            else setPendingRequests([]);

            // Avoid showing generic fetch error for expected 404s (no data found)
            // Check if error object has status property (depends on fetchData implementation)
            const isNotFoundError = error?.status === 404 || error?.message?.includes('not found');

            if (showAlerts && !isNotFoundError) {
                Alert.alert('Fetch Error', `Failed to fetch ${status} requests: ${error.message || 'Unknown error'}`);
            } else if (showAlerts && isNotFoundError) {
                 Alert.alert(
                    status === 'accepted' ? 'No Active Ride' : 'No Pending Requests',
                    `You have no ${status} ride requests.`
                );
            }
        } finally {
            setIsLoading(false);
        }
    }, [actionInProgress]); // Re-fetch if an action completes

    // --- Fetch on Focus & Status Change ---
    useFocusEffect(
        useCallback(() => {
            fetchDataBasedOnStatus(viewStatus, false); // Fetch based on current viewStatus
            // Reset animations
            fadeAnim.setValue(1); // Assume potentially visible
            slideAnim.setValue(0);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [viewStatus, fetchDataBasedOnStatus]) // Re-run if viewStatus changes or fetch function ref changes
    );

    // --- Animation Effect (Unchanged from original) ---
     useEffect(() => {
        // Only run animation if not loading
        if (!isLoading) {
            const t = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]).start();
            }, 100); // Small delay
            return () => clearTimeout(t);
        } else {
             // Reset animation values when starting to load (important for smooth transitions)
             fadeAnim.setValue(0);
             slideAnim.setValue(30);
        }
    }, [isLoading, fadeAnim, slideAnim]);


    // --- Action Handlers ---
    const handleChat = async (requestId: string | undefined) => {
        if (!requestId || actionInProgress) return; // Ensure requestId exists
        setActionInProgress({ type: 'chat', requestId });
        const token = await getToken();
        if (!token) { Alert.alert('Auth Error'); setActionInProgress(null); return; }
        try {
             const response = await fetchData(apiUrl, 'api/chat/passenger-initiate', {
                 method: 'POST',
                 headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ requestId }),
             });
             if (response?.chatSessionId) {
                 handleNavigate('LiveChat', { chatSessionId: response.chatSessionId });
             } else { throw new Error(response?.message || 'Failed to initiate chat.'); }
        } catch (error: any) { Alert.alert('Chat Error', error.message); }
        finally { setActionInProgress(null); }
    };

    const handleCancelRide = (requestId: string) => {
        if (actionInProgress) return;
        showCustomConfirm(
            'Are you sure you want to cancel this ride request?',
            async () => {
                setActionInProgress({ type: 'cancel', requestId });
                const token = await getToken();
                if (!token) { Alert.alert('Auth Error'); setActionInProgress(null); return; }
                try {
                    // Use the correct passenger cancellation endpoint (DELETE assumed)
                    const response = await fetchData(apiUrl, `api/rideRequest/${requestId}/cancel/passenger`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (response?.success || response?.message?.includes("cancelled")) {
                        Alert.alert('Success', 'Ride request cancelled.');
                        // Refresh the current view after cancellation
                        fetchDataBasedOnStatus(viewStatus, false);
                    } else { throw new Error(response?.error || response?.message || 'Failed to cancel.'); }
                } catch (error: any) { Alert.alert('Cancel Error', error.message); }
                 finally { setActionInProgress(null); }
            }
        );
    };

    const handleMonitor = async (taxiId: string | undefined) => {
        if (!taxiId || actionInProgress) {
             if (!taxiId) Alert.alert("Error", "Cannot monitor, Taxi ID missing.");
            return;
        }
        // Find the requestId associated with this taxiId (should only be in accepted view)
        const currentRequestId = acceptedRequestDetails?.taxiId === taxiId ? acceptedRequestDetails.requestId : null;
        if (!currentRequestId) return; // Safety check

        setActionInProgress({ type: 'monitor', requestId: currentRequestId });
        try {
            console.log(`Saving taxiId ${taxiId} to AsyncStorage...`);
            await AsyncStorage.setItem(ASYNC_STORAGE_MONITOR_KEY, taxiId);
            handleNavigate('Home'); // Navigate to Home for monitoring
        } catch (e) { Alert.alert("Error", "Could not start monitoring."); }
        finally { setActionInProgress(null); }
    };

    // --- Navigation Handler (Unchanged from original) ---
    const handleNavigate = (screen: keyof RootStackParamList, params?: any) => {
        setSidebarVisible(false);
        switch (screen) {
            case 'Home': navigation.navigate({ name: 'Home', params: params, merge: true }); break;
            case 'requestRide': navigation.navigate({ name: 'requestRide', params: params, merge: true }); break;
            case 'LiveChat': if (params?.chatSessionId) { navigation.navigate('LiveChat', { chatSessionId: params.chatSessionId }); } else { console.warn("Missing chatSessionId"); } break;
            case 'AcceptedRequest': break; // Already here
            // Add other cases from original code if needed
            default: console.warn(`Unhandled navigation to: ${screen}`); break;
        }
    };

    const toggleSidebar = () => {
        if (!actionInProgress) { // Prevent opening sidebar during actions
            setSidebarVisible(!sidebarVisible);
        }
    };

    // --- Helper to style status text (Unchanged from original) ---
    const getStatusStyle = (status: string): TextStyle => {
        switch (status?.toLowerCase()) {
            case 'accepted': return { color: 'green', fontWeight: 'bold' };
            case 'pending': return { color: 'orange', fontWeight: 'bold' };
            // Add other statuses if needed
            default: return { color: '#333' };
        }
    };

    // --- Render Pending Request Item ---
    const renderPendingItem = ({ item }: { item: PendingRequestDetail }) => {
        const isItemActionInProgress = actionInProgress?.requestId === item.requestId;
        const isAnyActionInProgress = actionInProgress !== null;

        return (
            <View style={styles.pendingCard}>
                <View style={styles.pendingCardHeader}>
                     <View style={{flex: 1, marginRight: 10}}>
                        <InfoRow label="From" value={item.startingStop} iconName="navigate-circle-outline" valueStyle={styles.locationText}/>
                        {item.requestType !== 'pickup' &&
                           <InfoRow label="To" value={item.destinationStop} iconName="flag-outline" valueStyle={styles.locationText}/>
                        }
                        {item.route && <InfoRow label="Route" value={item.route} iconName="map-outline" valueStyle={styles.locationText}/>}
                     </View>
                     <Text style={[styles.detailsStatus, getStatusStyle(item.status)]}>{item.status}</Text>
                </View>
                 <View style={styles.pendingCardFooter}>
                    <Text style={styles.createdAtText}>
                        Requested: {new Date(item.createdAt).toLocaleString()}
                    </Text>
                    <ActionButton
                        title="Cancel"
                        onPress={() => handleCancelRide(item.requestId)}
                        iconName="close-circle-outline"
                        style={styles.actionButtonSmallPending} // Specific style for single button
                        color="#dc3545"
                        loading={isItemActionInProgress && actionInProgress?.type === 'cancel'}
                        disabled={isAnyActionInProgress}
                    />
                 </View>
            </View>
        );
    };

    // --- Render Logic ---
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="AcceptedRequest" />

                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar} disabled={actionInProgress !== null}>
                            <Ionicons name="menu" size={32} color="#003E7E" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>My Rides</Text>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => fetchDataBasedOnStatus(viewStatus, true)} // Manual refresh shows alerts
                            disabled={isLoading || actionInProgress !== null}
                        >
                             {isLoading ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
                        </TouchableOpacity>
                    </View>

                    {/* Toggle Buttons */}
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleButton, viewStatus === 'pending' && styles.toggleButtonActive]}
                            onPress={() => setViewStatus('pending')}
                            disabled={isLoading || actionInProgress !== null}
                        >
                            <Text style={[styles.toggleButtonText, viewStatus === 'pending' && styles.toggleButtonTextActive]}>Pending</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleButton, viewStatus === 'accepted' && styles.toggleButtonActive]}
                            onPress={() => setViewStatus('accepted')}
                            disabled={isLoading || actionInProgress !== null}
                        >
                            <Text style={[styles.toggleButtonText, viewStatus === 'accepted' && styles.toggleButtonTextActive]}>Accepted</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content Area */}
                    {isLoading ? (
                        <Loading text={`Loading ${viewStatus} requests...`} />
                    ) : viewStatus === 'accepted' ? (
                        // --- Accepted View ---
                        acceptedRequestDetails ? (
                            <ScrollView contentContainerStyle={styles.scrollContent}>
                                <View style={styles.detailsCard}>
                                    <View style={styles.detailsCardHeader}>
                                        <MaterialIcons name="local-taxi" size={24} color="#003E7E" />
                                        <Text style={styles.detailsCardTitle}>{acceptedRequestDetails.numberPlate}</Text>
                                        {/* Assuming acceptedRequestDetails.status holds the ride status */}
                                        <Text style={[styles.detailsStatus, getStatusStyle('accepted')]}>Accepted</Text>
                                    </View>
                                    <View style={styles.detailsCardBody}>
                                        <InfoRow label="Driver" value={acceptedRequestDetails.driverName} iconName="person-outline" />
                                        {/* Add driverContact if needed */}
                                        {/* <InfoRow label="Contact" value={acceptedRequestDetails.driverContact} iconName="call-outline" /> */}
                                        <InfoRow label="Location" value={acceptedRequestDetails.currentStop} iconName="location-outline" numberOfLines={2}/>
                                        {acceptedRequestDetails.route && <InfoRow label="Route" value={acceptedRequestDetails.route} iconName="map-outline"/>}
                                    </View>
                                    <View style={styles.detailsCardFooter}>
                                        <ActionButton
                                            title="Cancel Ride"
                                            onPress={() => handleCancelRide(acceptedRequestDetails.requestId)}
                                            iconName="close-circle-outline"
                                            style={styles.actionButtonSmall}
                                            color="#dc3545"
                                            loading={actionInProgress?.type === 'cancel' && actionInProgress.requestId === acceptedRequestDetails.requestId}
                                            disabled={actionInProgress !== null}
                                        />
                                        <ActionButton
                                            title="Chat Driver"
                                            onPress={() => handleChat(acceptedRequestDetails.requestId)}
                                            iconName="chatbubble-ellipses-outline"
                                            style={styles.actionButtonSmall}
                                            color="#007bff"
                                            loading={actionInProgress?.type === 'chat' && actionInProgress.requestId === acceptedRequestDetails.requestId}
                                            disabled={actionInProgress !== null}
                                        />
                                        <ActionButton
                                            title="Monitor Live"
                                            onPress={() => handleMonitor(acceptedRequestDetails.taxiId)}
                                            iconName="eye-outline"
                                            style={styles.actionButtonSmall}
                                            color="#17a2b8"
                                            loading={actionInProgress?.type === 'monitor' && actionInProgress.requestId === acceptedRequestDetails.requestId}
                                            disabled={actionInProgress !== null || !acceptedRequestDetails.taxiId}
                                        />
                                    </View>
                                </View>
                            </ScrollView>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="car-outline" size={60} color="#888" />
                                <Text style={styles.emptyText}>No accepted ride found.</Text>
                                <Text style={styles.emptySubText}>Your accepted ride details will appear here.</Text>
                                {/* Optional: Button to request ride */}
                                {/* <ActionButton title="Request a Ride" onPress={() => handleNavigate('requestRide')} style={{marginTop: 20}}/> */}
                            </View>
                        )
                    ) : (
                        // --- Pending View ---
                        pendingRequests.length > 0 ? (
                            <FlatList
                                data={pendingRequests}
                                renderItem={renderPendingItem}
                                keyExtractor={(item) => item.requestId}
                                contentContainerStyle={styles.listContentContainer}
                            />
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="hourglass-outline" size={60} color="#888" />
                                <Text style={styles.emptyText}>No pending requests found.</Text>
                                <Text style={styles.emptySubText}>Your pending ride requests will appear here.</Text>
                                <ActionButton
                                    title="Request a New Ride"
                                    onPress={() => handleNavigate('requestRide')}
                                    style={{marginTop: 20}}
                                    disabled={actionInProgress !== null}
                                />
                            </View>
                        )
                    )}
                </Animated.View>

                <CustomConfirm
                    visible={customConfirmVisible}
                    message={customConfirmMessage}
                    onCancel={hideCustomConfirm}
                    onConfirm={handleConfirm}
                />
            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles --- (Combined and adapted styles)
const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%', backgroundColor: 'transparent' },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },

    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 15,
        marginHorizontal: 20,
        backgroundColor: '#e9ecef',
        borderRadius: 25,
        overflow: 'hidden',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleButtonActive: {
        backgroundColor: '#003E7E',
        borderRadius: 25,
    },
    toggleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003E7E',
    },
    toggleButtonTextActive: {
        color: '#FFFFFF',
    },

    scrollContent: { // For single accepted view
        padding: 20,
        flexGrow: 1,
        justifyContent: 'center' // Center card if content is short
     },
    listContentContainer: { // For pending list view
        paddingHorizontal: 15,
        paddingBottom: 20,
    },

    // Card Styles (Shared base, specific adjustments below)
    detailsCard: { // Used for the single accepted request
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginHorizontal: 5, // From original
        elevation: 4,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        overflow: 'hidden',
    },
    pendingCard: { // Used for items in the pending list
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 15, // Space between cards
        elevation: 3,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        overflow: 'hidden',
    },

    // Card Header Styles
    detailsCardHeader: { // Accepted card header
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#E8F0FE',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#D0D8E8'
    },
     pendingCardHeader: { // Pending card header
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'flex-start',
       backgroundColor: '#F8F9FA',
       padding: 15,
       borderBottomWidth: 1,
       borderBottomColor: '#EEEEEE',
    },

    // Card Title/Status Styles
    detailsCardTitle: { // Accepted card title (Plate No.)
        fontSize: 18,
        fontWeight: 'bold',
        color: '#003E7E',
        marginLeft: 10,
        flex: 1
    },
    detailsStatus: { // Shared status style
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'right',
        marginLeft: 10,
        textTransform: 'capitalize',
    },
     locationText: { // Style for From/To/Route in pending header
        fontWeight: '500',
        fontSize: 14,
    },

    // Card Body Styles
    detailsCardBody: { // Accepted card body
        paddingHorizontal: 15,
        paddingTop: 15,
        paddingBottom: 15
    },
    // No specific body style needed for pending card in this layout

    // Card Footer Styles
    detailsCardFooter: { // Accepted card footer
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        backgroundColor: '#F8F9FA'
    },
    pendingCardFooter: { // Pending card footer
        flexDirection: 'row',
        justifyContent: 'space-between', // Align items left and right
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        backgroundColor: '#F8F9FA'
    },
    createdAtText: {
        fontSize: 12,
        color: '#666',
        flexShrink: 1, // Allow text to shrink
        marginRight: 10,
    },

    // Action Button Styles (Adapted)
    actionButtonSmall: { // For accepted card (3 buttons)
        paddingVertical: 10,
        paddingHorizontal: 10,
        marginHorizontal: 4,
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
     actionButtonSmallPending: { // For pending card (1 button)
        paddingVertical: 10,
        paddingHorizontal: 15, // More padding for single button
        // No flex needed, let it size naturally
        minWidth: 90,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Info Row Styles (Minor adjustments from original)
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
    infoIcon: { marginRight: 10, width: 20, textAlign: 'center' },
    infoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 80 },
    infoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1 }, // Removed wrap

    // Empty State Styles (Unchanged from original)
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15 },
    emptySubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // Loading Styles (Unchanged from original)
    loadingGradient: { flex: 1 },
    loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },

    // Base Action Button Styles (Unchanged from original)
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 25, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, minHeight: 44 },
    actionButtonIcon: { marginRight: 8 },
    actionButtonText: { fontSize: 15, fontWeight: '600', textAlign: 'center'},
    actionButtonDisabled: { backgroundColor: '#B0B0B0', elevation: 0, shadowOpacity: 0, opacity: 0.6 },
});

export default AcceptedRequestsScreen;