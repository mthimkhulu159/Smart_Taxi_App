import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Animated,
    SafeAreaView,
    Platform,
    ViewStyle,
    TextStyle,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchData, getToken } from '../api/api'; // Assuming correct path
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';
import { RootStackParamList } from '../types/navigation'; // Assuming correct path

// --- Types and Interfaces ---
interface RideRequest {
    _id: string;
    // Passenger can be an ID string OR an object { _id: string, name: string } - THIS IS LIKELY THE ISSUE
    passenger: string | { _id: string; name: string };
    passengerName?: string; // Optional: Explicit name field might also exist
    startingStop: string;
    destinationStop: string; // Required for 'ride', usually absent/ignored for 'pickup'
    requestType: 'ride' | 'pickup';
    status: string; // e.g., 'pending'
}

type ViewRequestsNavigationProp = StackNavigationProp<RootStackParamList, 'ViewRequests'>;

// --- Loading Component ---
const Loading: React.FC = () => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
            <View style={styles.loadingContainerInternal}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingTextInternal}>Loading...</Text></View>
        </LinearGradient>
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

// --- Custom Error Modal Component ---
const ErrorModal: React.FC<{ visible: boolean; title: string; message: string; onClose: () => void }> = ({ visible, title, message, onClose }) => {
    return (
        <Modal
          animationType="fade"
          transparent={true}
          visible={visible}
          onRequestClose={onClose} // For Android back button
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalMessage}>{message}</Text>
              <TouchableOpacity onPress={onClose} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
};


// --- Main ViewRequestScreen Component ---
const ViewRequestScreen: React.FC = () => {
    const [requests, setRequests] = useState<RideRequest[]>([]);
    const [viewType, setViewType] = useState<'ride' | 'pickup'>('ride');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAccepting, setIsAccepting] = useState<string | null>(null);
    const [sidebarVisible, setSidebarVisible] = useState(false);

    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const navigation = useNavigation<ViewRequestsNavigationProp>();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const displayError = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        setShowErrorModal(true);
    };
    const closeErrorModal = () => {
        setShowErrorModal(false);
        setErrorTitle('');
        setErrorMessage('');
    };

    // --- Fetching Logic ---
    const fetchRequests = useCallback(async (type: 'ride' | 'pickup', showAlerts = false) => {
        if (isAccepting) {
            console.log("Fetch skipped: Accept action in progress.");
            return;
        }
        setIsLoading(true);
        setRequests([]);
        console.log(`Workspaceing ${type} requests...`);
        try {
            const token = await getToken();
            if (!token) {
                displayError('Authentication Error', 'Authentication token not found. Please log in again.');
                setIsLoading(false);
                return;
            }

            const endpoint = type === 'ride'
                ? 'api/rideRequest/driver/ride-requests'
                : 'api/rideRequest/driver/pickup-requests';

            const data = await fetchData(apiUrl, endpoint, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            });

            const fetchedRequests = type === 'ride' ? (data.rideRequests || []) : (data.pickupRequests || []);
            setRequests(fetchedRequests);

            if (showAlerts && fetchedRequests.length === 0) {
                Alert.alert('No Requests', `No new nearby ${type} requests found at this time.`);
            }
        } catch (err: any) {
            console.error(`Error fetching ${type} requests:`, err);
            const isPickupStatusError = type === 'pickup' && err.message?.toLowerCase().includes("must be in 'roaming' status");
            if (isPickupStatusError) {
                 displayError('Status Error', err.message || 'Your taxi must be in roaming status for pickup requests.');
            }
            else if (showAlerts || requests.length === 0) {
                 const isNotFoundError = err?.status === 404 || err?.message?.includes('not found');
                 if (!isNotFoundError){
                    displayError('Fetch Error', err.message || `Failed to fetch ${type} requests. Please try again.`);
                 }
            }
            setRequests([]);
        } finally {
            setIsLoading(false);
        }
    }, [isAccepting]); // Add isAccepting dependency

    // --- Fetch on focus or viewType change ---
    useFocusEffect(
        useCallback(() => {
            fetchRequests(viewType, false);
            fadeAnim.setValue(1);
            slideAnim.setValue(0);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [viewType, fetchRequests])
    );

    // Animation Effect
    useEffect(() => {
        if (!isLoading) {
            const animationTimer = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]).start();
            }, 100);
            return () => clearTimeout(animationTimer);
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
        }
    }, [isLoading, fadeAnim, slideAnim]);


    // Accept Request Handler
    const handleAccept = async (requestId: string) => {
        setIsAccepting(requestId);
        try {
            const token = await getToken();
            if (!token) {
              displayError('Authentication Error', 'Authentication token not found. Please log in again.');
              setIsAccepting(null);
              return;
            }

            const response = await fetch(`${apiUrl}/api/rideRequest/accept/${requestId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const responseData = await response.json();
              Alert.alert('Success', responseData.message || 'Request accepted! You can view details under "Accepted Passenger".',
                [{ text: 'OK', onPress: () => navigation.navigate('AcceptedPassenger') }]
              );
              setRequests((prev) => prev.filter((req) => req._id !== requestId));
            } else {
              const statusCode = response.status;
              let errorMsg = 'Failed to accept the request.';
              try {
                const errorData = await response.json();
                errorMsg = errorData.error || `Server responded with status ${statusCode}.`;

                if (errorMsg.toLowerCase().includes("ride request not found")) {
                  displayError('Request Not Found', 'The requested ride was not found or might have been cancelled.');
                } else if (errorMsg.toLowerCase().includes("request is no longer pending")) {
                  displayError('Request Unavailable', 'This request is no longer pending and cannot be accepted.');
                  fetchRequests(viewType); // Refresh current list type
                } else if (errorMsg.toLowerCase().includes("taxi for this driver not found")) {
                  displayError('Taxi Error', 'Your taxi information could not be found. Please contact support.');
                } else if (errorMsg.toLowerCase().includes("taxi is not on the correct route")) {
                  displayError('Route Mismatch', 'Your taxi is not on the correct route for this request.');
                } else if (errorMsg.toLowerCase().includes("taxi is not available for ride requests")) {
                  displayError('Taxi Unavailable', 'Your taxi is not currently available for ride requests.');
                } else if (errorMsg.toLowerCase().includes("invalid route stops data")) {
                  displayError('Data Error', 'There was an issue with the route information. Please try again later.');
                } else if (errorMsg.toLowerCase().includes("taxi has already passed the passenger's starting stop")) {
                    displayError('Stop Passed', 'Your taxi has already passed the passenger\'s starting stop.');
                    fetchRequests(viewType); // Refresh current list type
                } else if (errorMsg.toLowerCase().includes("taxi is not available for pickup requests")) {
                  displayError('Taxi Unavailable', 'Your taxi is not currently available for pickup requests.');
                } else if (errorMsg.toLowerCase().includes("unsupported request type")) {
                  displayError('Unsupported Type', 'This request type is not supported.');
                } else if (statusCode >= 500) {
                  displayError('Server Error', 'An error occurred on the server. Please try again later.');
                } else {
                  displayError(`HTTP Error ${statusCode}`, errorMsg);
                }

              } catch (e) {
                console.error("Failed to parse error response or map error message:", e);
                displayError(`Request Failed (Status: ${statusCode})`, 'An unexpected error occurred on the server.');
              }
            }
          } catch (err: any) {
            console.error('Error accepting request:', err);
            if (err.message && err.message.includes('Network request failed')) {
                 displayError('Network Error', 'Could not connect to the server. Please check your internet connection.');
            } else {
                 displayError('Unexpected Error', err.message || 'An unexpected error occurred while trying to accept the request.');
            }
          } finally {
            setIsAccepting(null);
          }
    };


    // Render Request Card Item
    const renderItem = ({ item }: { item: RideRequest }) => (
        <View style={styles.requestCard}>
            <View style={styles.requestCardHeader}>
                <Ionicons name={item.requestType === 'ride' ? "car-sport-outline" : "location-outline"} size={22} color="#003E7E" />
                <Text style={styles.requestCardTitle}>{item.requestType === 'ride' ? 'Ride Request' : 'Pickup Request'}</Text>
                <Text style={[styles.requestStatus, getStatusStyle(item.status)]}>{item.status}</Text>
            </View>
            <View style={styles.requestCardBody}>
                <View style={styles.requestInfoRow}>
                    <Ionicons name="person-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
                    <Text style={styles.requestInfoLabel}>Passenger:</Text>
                    {/* --- FIX APPLIED HERE --- */}
                    <Text style={styles.requestInfoValue}>
                        {item.passengerName // If explicit passengerName exists, use it
                            ? item.passengerName
                            : typeof item.passenger === 'object' && item.passenger !== null && item.passenger.name // If passenger is an object with a name
                            ? item.passenger.name // Use the name from the object
                            : typeof item.passenger === 'string' // If passenger is the ID string
                            ? item.passenger // Display the ID string
                            : 'N/A'} {/* Final fallback */}
                    </Text>
                     {/* --- END OF FIX --- */}
                </View>
                <View style={styles.requestInfoRow}>
                    <Ionicons name="navigate-circle-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
                    <Text style={styles.requestInfoLabel}>From:</Text>
                    <Text style={styles.requestInfoValue}>{item.startingStop}</Text>
                </View>
                {/* Only show destination for 'ride' type */}
                {item.requestType === 'ride' && item.destinationStop && (
                    <View style={styles.requestInfoRow}>
                        <Ionicons name="flag-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
                        <Text style={styles.requestInfoLabel}>To:</Text>
                        <Text style={styles.requestInfoValue}>{item.destinationStop}</Text>
                    </View>
                )}
            </View>
            <View style={styles.requestCardFooter}>
                <ActionButton
                    title="Accept Request"
                    onPress={() => handleAccept(item._id)}
                    iconName="checkmark-circle-outline"
                    style={styles.acceptButton}
                    color="#28a745"
                    loading={isAccepting === item._id}
                    disabled={isAccepting !== null}
                />
            </View>
        </View>
    );

    // Helper to style status text
    const getStatusStyle = (status: string): TextStyle => {
        switch (status?.toLowerCase()) {
            case 'pending': return { color: 'orange', fontWeight: 'bold' };
            case 'accepted': return { color: 'green', fontWeight: 'bold' };
            case 'cancelled': return { color: 'red', fontWeight: 'bold' };
            default: return { color: '#555' };
          }
    };

    // Navigation Handler
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        switch (screen) {
            case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true }); break;
            case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
            case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true }); break;
            case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true }); break;
            case 'ViewRequests': break; // Already here
            case 'TaxiFareCalculator': navigation.navigate({ name: 'TaxiFareCalculator', params: undefined, merge: true }); break;
            case 'TaxiManagement': navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true }); break;
            case 'Profile': navigation.navigate({ name: 'Profile', params: undefined, merge: true }); break;
            case 'AcceptedRequest': navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true }); break;
            case 'AcceptedPassenger': navigation.navigate({ name: 'AcceptedPassenger', params: undefined, merge: true }); break;
            case 'Auth': navigation.navigate({ name: 'Auth', params: undefined, merge: true }); break;
            default: console.warn(`Attempted to navigate to unhandled screen: ${screen}`); break;
          }
    };
    const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

    // --- Render Logic ---
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="ViewRequests" />

                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar} disabled={isAccepting !== null}>
                             <Ionicons name="menu" size={32} color="#003E7E" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Nearby Requests</Text>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => fetchRequests(viewType, true)}
                            disabled={isLoading || isAccepting !== null}
                        >
                             {isLoading && requests.length === 0 ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
                        </TouchableOpacity>
                    </View>

                    {/* --- Toggle Buttons --- */}
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleButton, viewType === 'ride' && styles.toggleButtonActive]}
                            onPress={() => setViewType('ride')}
                            disabled={isLoading || isAccepting !== null}
                        >
                            <Text style={[styles.toggleButtonText, viewType === 'ride' && styles.toggleButtonTextActive]}>Ride Requests</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleButton, viewType === 'pickup' && styles.toggleButtonActive]}
                            onPress={() => setViewType('pickup')}
                            disabled={isLoading || isAccepting !== null}
                        >
                            <Text style={[styles.toggleButtonText, viewType === 'pickup' && styles.toggleButtonTextActive]}>Pickup Requests</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Main Content Area */}
                    {isLoading && requests.length === 0 ? (
                        <Loading />
                    ) : (
                        <FlatList
                            data={requests}
                            keyExtractor={(item) => item._id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContentContainer}
                            ListEmptyComponent={
                                <View style={styles.emptyListContainer}>
                                    <Ionicons name="search-circle-outline" size={50} color="#888" />
                                    <Text style={styles.emptyListText}>No nearby {viewType} requests found.</Text>
                                    <Text style={styles.emptyListSubText}>
                                        {viewType === 'ride'
                                            ? "Nearby ride requests on your route will appear here."
                                            : "Pickup requests at your current location will appear here (Taxi must be 'roaming')."
                                        }
                                    </Text>
                                </View>
                            }
                            onRefresh={() => fetchRequests(viewType, true)}
                            refreshing={isLoading && requests.length > 0}
                        />
                    )}
                </Animated.View>

                <ErrorModal
                    visible={showErrorModal}
                    title={errorTitle}
                    message={errorMessage}
                    onClose={closeErrorModal}
                />
            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 10,
        marginHorizontal: 15,
        backgroundColor: '#e9ecef',
        borderRadius: 8,
        overflow: 'hidden',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleButtonActive: {
        backgroundColor: '#003E7E',
        borderRadius: 8,
    },
    toggleButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#003E7E',
    },
    toggleButtonTextActive: {
        color: '#FFFFFF',
    },
    listContentContainer: {
        paddingHorizontal: 15,
        paddingBottom: 10,
        flexGrow: 1,
    },
    requestCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        overflow: 'hidden',
    },
    requestCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#E8F0FE',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#D0D8E8',
    },
    requestCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#003E7E',
        marginLeft: 8,
        flex: 1,
    },
    requestStatus: {
        fontSize: 14,
        // fontWeight: 'bold', // Handled by getStatusStyle
        marginLeft: 10,
        textTransform: 'capitalize',
    },
    requestCardBody: {
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    requestInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
    },
    requestInfoIcon: {
        marginRight: 10,
        width: 20,
        textAlign: 'center',
    },
    requestInfoLabel: {
        fontSize: 15,
        color: '#555',
        fontWeight: '500',
        width: 90, // Fixed width for alignment
    },
    requestInfoValue: {
        fontSize: 15,
        color: '#000',
        fontWeight: '600',
        flex: 1, // Allow text to wrap if long
    },
    requestCardFooter: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        paddingTop: 5, // Less space above button
        alignItems: 'center', // Center button
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        marginTop: 5,
    },
    acceptButton: {
        paddingVertical: 10, // Standard button padding
        paddingHorizontal: 20,
        width: '80%', // Button width relative to card
        maxWidth: 300, // Max width for larger screens
    },
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        marginTop: 30,
    },
    emptyListText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#555',
        textAlign: 'center',
        marginTop: 15,
    },
    emptyListSubText: {
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
        marginTop: 5,
        lineHeight: 20,
    },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, minHeight: 44 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0, opacity: 0.7 },
    // Styles for imported/inline components (keep as is)
    loadingGradient: { flex: 1 },
    loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#D32F2F',
        marginBottom: 15,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 16,
        color: '#333333',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalButton: {
        backgroundColor: '#003E7E',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 25,
        minWidth: 120,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF', // Added color for modal button text
    },
    // Styles related to Sidebar (assuming they are correctly defined in Sidebar.tsx or here if inline)
    // Add relevant Sidebar styles if they were part of the original StyleSheet and are needed here
    // e.g., sidebarInternal, sidebarCloseButtonInternal, etc. if Sidebar wasn't a separate component
});

export default ViewRequestScreen;