import React, { useEffect, useState, useRef, useCallback, FC } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, Modal, StyleSheet,
    TextInput, Animated, ScrollView, SafeAreaView, Platform,
    ActivityIndicator, ViewStyle, TextStyle, Easing // Added Easing for CustomConfirm if needed internally
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { fetchData, getToken } from '../api/api'; // Adjust path as needed
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import io, { Socket } from 'socket.io-client'; // Import Socket type
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';
import CustomPopup from '../components/CustomPopup'; // Import the CustomPopup component
import CustomConfirm from '../components/CustomConfirm'; // <-- IMPORT CUSTOM CONFIRM (Adjust path as needed)
import { RootStackParamList } from '../types/navigation';

// --- Constants ---
const statusOptions = [
    'waiting', 'available', 'roaming', 'almost full', 'full', 'on trip', 'not available',
];


const directionOptions: Array<'forward' | 'return'> = ['forward', 'return'];

// --- Types and Interfaces ---
type Taxi = {
    _id: string;
    numberPlate: string;
    status: string;
    currentStop: string;
    currentLoad: number;
    capacity?: number;
    routeName?: string;
    driverId?: string;
    updatedAt?: string;
    direction?: string;
};

type Stop = {
    name: string;
    order: number;
};

type UpdateType = 'status' | 'stop' | 'load' | 'direction' | null;

type TaxiManagementNavigationProp = StackNavigationProp<RootStackParamList, 'TaxiManagement'>;

// --- Prop Types for Reusable Components ---
interface SidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (screen: keyof RootStackParamList) => void;
    activeScreen: keyof RootStackParamList;
}

interface ActionButtonProps {
    onPress: () => void;
    title: string;
    iconName?: any;
    iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome';
    color?: string;
    textColor?: string;
    loading?: boolean;
    style?: object;
    disabled?: boolean;
}

// --- Reusable Components (Fully Implemented) ---

const Loading: React.FC = () => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ).start();
    }, [spinAnim]);

    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
            <View style={styles.loadingContainerInternal}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={50} color="#003E7E" />
                </Animated.View>
                <Text style={styles.loadingTextInternal}>Loading...</Text>
            </View>
        </LinearGradient>
    );
};

const ActionButton: React.FC<ActionButtonProps> = ({
    onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E',
    textColor = '#FFFFFF', loading = false, style = {}, disabled = false
}) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            style={[styles.actionButtonBase, { backgroundColor: color }, style, isDisabled && styles.actionButtonDisabled]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={isDisabled ? 1 : 0.7}
        >
            {loading ? (
                <ActivityIndicator size="small" color={textColor} />
            ) : (
                <>
                    {iconName && <IconComponent name={iconName} size={18} color={textColor} style={styles.actionButtonIcon} />}
                    <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
    );
};


// --- Main TaxiManagement Component ---
const TaxiManagement: React.FC = () => {
    // --- State ---
    const [taxis, setTaxis] = useState<Taxi[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // Used for update and delete operations
    const [modalVisible, setModalVisible] = useState<boolean>(false); // For update modal
    const [selectedTaxi, setSelectedTaxi] = useState<Taxi | null>(null);
    const [updateType, setUpdateType] = useState<UpdateType>(null);
    const [newStatus, setNewStatus] = useState<string>(statusOptions[0]);
    const [newStop, setNewStop] = useState<string>('');
    const [newLoad, setNewLoad] = useState<string>('0');
    const [stopOptions, setStopOptions] = useState<string[]>([]);
    const [newDirection, setNewDirection] = useState<'forward' | 'return'>(directionOptions[0]);
    const [isLoadingStops, setIsLoadingStops] = useState<boolean>(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [customPopupVisible, setCustomPopupVisible] = useState(false); // For info popups
    const [customPopupMessage, setCustomPopupMessage] = useState('');
    const [customPopupType, setCustomPopupType] = useState<'success' | 'error'>('error');
    const [confirmVisible, setConfirmVisible] = useState<boolean>(false); // For delete confirmation
    const [confirmMessage, setConfirmMessage] = useState<string>('');
    const [taxiIdToDelete, setTaxiIdToDelete] = useState<string | null>(null); // Store ID for confirmed delete

    // --- Refs ---
    const socketRef = useRef<Socket | null>(null);
    const isMountedRef = useRef(true); // Track component mount status
    const fadeAnim = useRef(new Animated.Value(0)).current; // Animation for list items
    const slideAnim = useRef(new Animated.Value(30)).current; // Animation for list items

    // --- Hooks ---
    const navigation = useNavigation<TaxiManagementNavigationProp>();

    // --- Helper Functions ---
    const showCustomPopup = (message: string, type: 'success' | 'error') => {
        setCustomPopupMessage(message);
        setCustomPopupType(type);
        setCustomPopupVisible(true);
    };

    const hideCustomPopup = () => {
        setCustomPopupVisible(false);
        setCustomPopupMessage('');
    };

    // --- Data Fetching & Setup ---
    const loadInitialData = useCallback(async () => {
        if (!isMountedRef.current) return;
        setIsLoading(true);
        let fetchedUserId: string | null = null;
        try {
            const token = await getToken();
            if (!token) {
                showCustomPopup('Please login to manage taxis.', 'error');
                if (isMountedRef.current) setIsLoading(false);
                return;
            }
            console.log("TM: Fetched Token:", token);

            // Fetch User ID
            try {
                const userData = await fetchData(apiUrl, 'api/users/get-user', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log("TM: User Data Response:", userData);
                if (userData?.user?.id && isMountedRef.current) {
                    fetchedUserId = userData.user.id;
                    setUserId(fetchedUserId);
                    console.log("TM: User ID fetched:", fetchedUserId);
                } else if (isMountedRef.current) {
                    console.error("TM: Failed to get user ID.");
                    showCustomPopup('Could not verify user identity.', 'error');
                }
            } catch (userError: any) {
                console.error("TM: Error fetching user:", userError);
                if (isMountedRef.current) showCustomPopup('Could not fetch user details.', 'error');
            }

            // Fetch Taxis assigned to the driver
            const taxiData = await fetchData(apiUrl, 'api/taxis/driver-taxi', { headers: { Authorization: `Bearer ${token}` } });
            console.log("TM: Taxi Data Response:", taxiData);
            if (taxiData?.taxis && isMountedRef.current) {
                setTaxis(taxiData.taxis);
            } else if (isMountedRef.current) {
                setTaxis([]); // Set empty array if no taxis or error
                console.log('TM: No taxis assigned to this driver.');
            }
        } catch (error: any) {
            if (isMountedRef.current) {
                setTaxis([]);
                showCustomPopup(`Failed to load initial data: ${error.message || 'Unknown error'}`, 'error');
            }
            console.error("TM: General error loading data:", error);
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, []); // Empty dependency array means this runs once on mount

    // --- Socket Connection Effect ---
    useEffect(() => {
        if (!userId) {
            console.log("TM: Socket waiting for userId...");
            return; // Don't connect until userId is available
        }
        if (socketRef.current) {
            console.log("TM: Socket ref already exists, skipping setup.");
            return; // Avoid duplicate connections
        }

        console.log('TM: Setting up socket connection...');
        const newSocket = io(apiUrl, {
            transports: ['websocket'], // Prefer websocket
            reconnectionAttempts: 5,
            timeout: 10000
        });
        socketRef.current = newSocket; // Store the socket instance

        // --- Socket Event Listeners ---
        newSocket.on('connect', () => {
            console.log('TM: Socket connected with ID:', newSocket.id);
            if (userId) {
                console.log(`TM: Emitting 'authenticate' event for userId: ${userId}`);
                newSocket.emit('authenticate', userId); // Authenticate the socket connection with the backend
            } else {
                console.error("TM: Authentication failed - userId missing at the moment of connection.");
            }
        });

        newSocket.on('disconnect', (reason: string) => {
            console.log('TM: Socket disconnected. Reason:', reason);
        });

        newSocket.on('connect_error', (err: Error) => {
            console.error('TM: Socket connection error:', err.message);
        });

        // Listen for real-time updates to taxis
        newSocket.on('taxiUpdate', (updatedTaxi: Taxi) => {
            if (isMountedRef.current) {
                console.log("TM: Received 'taxiUpdate' event:", updatedTaxi);
                setTaxis(currentTaxis =>
                    currentTaxis.map(taxi =>
                        taxi._id === updatedTaxi._id ? { ...taxi, ...updatedTaxi } : taxi
                    )
                );
            }
        });

        // Listen for real-time deletion of taxis
        newSocket.on('taxiDeleted', (deletedTaxiId: string) => {
            if (isMountedRef.current) {
                console.log("TM: Received 'taxiDeleted' event for ID:", deletedTaxiId);
                setTaxis(currentTaxis => currentTaxis.filter(taxi => taxi._id !== deletedTaxiId));
                // Optionally show a popup notification
                // showCustomPopup('A taxi was removed.', 'success');
            }
        });

        // --- Cleanup Function ---
        return () => {
            if (socketRef.current) {
                console.log('TM: Cleaning up socket connection.');
                socketRef.current.removeAllListeners(); // Remove all listeners
                socketRef.current.disconnect(); // Disconnect the socket
                socketRef.current = null; // Clear the ref
            }
        };
    }, [userId]); // Re-run effect if userId changes

    // --- Initial Data Load Effect ---
    useEffect(() => {
        isMountedRef.current = true; // Set mount status
        loadInitialData(); // Load data on mount

        // Cleanup function to set mount status to false when unmounting
        return () => {
            isMountedRef.current = false;
        };
    }, [loadInitialData]); // Dependency on the memoized loadInitialData function

    // --- Animation Effect ---
    useEffect(() => {
        // Trigger animations when loading is finished and component is mounted
        if (!isLoading && isMountedRef.current) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true
                }),
            ]).start();
        }
    }, [isLoading, fadeAnim, slideAnim]); // Dependencies for the animation effect

    // --- Fetch Stops for Selected Taxi (for Update Modal) ---
    const fetchStopsForTaxi = useCallback(async (taxiId: string) => {
        // Guard clauses
        if (!isMountedRef.current || !selectedTaxi || selectedTaxi._id !== taxiId) return;

        setIsLoadingStops(true);
        setStopOptions([]); // Clear previous options

        try {
            const token = await getToken();
            if (!token) throw new Error('Authentication required to fetch stops.');

            const data = await fetchData(apiUrl, `api/taxis/${taxiId}/stops`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data?.stops && isMountedRef.current) {
                // Sort stops by order, then alphabetically by name as a fallback
                const sortedStops = data.stops.sort((a: Stop, b: Stop) => a.order - b.order || a.name.localeCompare(b.name));
                const stopNames = sortedStops.map((stop: Stop) => stop.name);
                setStopOptions(stopNames);

                // Set the initial value for the picker
                const currentStopExists = stopNames.includes(selectedTaxi?.currentStop || '');
                const initialStop = currentStopExists ? (selectedTaxi?.currentStop ?? stopNames[0] ?? '') : (stopNames[0] ?? '');
                setNewStop(initialStop);
            } else if (isMountedRef.current) {
                // Handle case where no stops are returned
                setStopOptions([]);
                setNewStop('');
                console.log("TM: No stops found for this taxi's route.");
            }
        } catch (error: any) {
            console.error('TM: Error fetching stops:', error.message);
            if (isMountedRef.current) {
                setStopOptions([]);
                setNewStop('');
            }
            showCustomPopup(`Failed to load stops: ${error.message}`, 'error');
        } finally {
            if (isMountedRef.current) setIsLoadingStops(false);
        }
    }, [selectedTaxi]); // Dependency: re-run if selectedTaxi changes

    // --- Modal Open Effect for Fetching Stops ---
    useEffect(() => {
        // Fetch stops only when the modal is visible, update type is 'stop', and a taxi is selected
        if (modalVisible && updateType === 'stop' && selectedTaxi?._id) {
            fetchStopsForTaxi(selectedTaxi._id);
        }
    }, [modalVisible, updateType, selectedTaxi, fetchStopsForTaxi]); // Dependencies for this effect

    // --- Event Handlers ---

    // Open the update modal
    const handleActionPress = (taxi: Taxi) => {
        setSelectedTaxi(taxi); // Set the taxi to be updated
        setUpdateType(null); // Reset update type selection
        // Pre-fill modal fields with current taxi data
        setNewStatus(taxi.status || statusOptions[0]);
        setNewLoad(taxi.currentLoad?.toString() ?? '0');
        setNewStop(taxi.currentStop || '');
        setNewDirection(taxi.direction === 'return' ? 'return' : 'forward');
        // Reset stop-related state
        setStopOptions([]);
        setIsLoadingStops(false);
        setIsSubmitting(false); // Ensure submitting state is reset
        setModalVisible(true); // Show the modal
    };

    // Handle submitting updates (Status, Stop, Load)
    const handleUpdate = async () => {
        // Guard clauses
        if (!selectedTaxi || !updateType || isSubmitting) return;

        setIsSubmitting(true); // Indicate loading/processing
        let endpoint = '';
        let body = {};
        let optimisticUpdateData = {}; // Data for immediate UI update

        try {
            // Determine endpoint and body based on updateType
            if (updateType === 'status') {
                if (!newStatus) throw new Error('Please select a status.');
                endpoint = `api/taxis/${selectedTaxi._id}/status`;
                body = { status: newStatus };
                optimisticUpdateData = { status: newStatus };
            } else if (updateType === 'stop') {
                if (!newStop) throw new Error('Please select a stop.');
                endpoint = `api/taxis/${selectedTaxi._id}/currentStopManual`;
                body = { currentStop: newStop };
                optimisticUpdateData = { currentStop: newStop };
            } else if (updateType === 'load') {
                const parsedLoad = parseInt(newLoad, 10);
                // Validate load input
                if (isNaN(parsedLoad) || parsedLoad < 0) throw new Error('Invalid load number. Must be 0 or greater.');
                // Check against capacity if available
                if (selectedTaxi.capacity != null) {
                    const capacityNumber = Number(selectedTaxi.capacity);
                    if (parsedLoad > capacityNumber) {
                        throw new Error(`Load (${parsedLoad}) cannot exceed capacity (${selectedTaxi.capacity}).`);
                    }
                }
                endpoint = `api/taxis/${selectedTaxi._id}/load`;
                body = { currentLoad: parsedLoad };
                optimisticUpdateData = { currentLoad: parsedLoad };
            } else if (updateType === 'direction') { 
                if (!newDirection) throw new Error('Please select a direction.'); // Basic validation
                endpoint = `api/taxis/${selectedTaxi._id}/direction`; // Use the new endpoint
                body = { direction: newDirection };
                optimisticUpdateData = { direction: newDirection }; }
            else {
                throw new Error("Invalid update type selected.");
            }

            const token = await getToken();
            if (!token) throw new Error('Authentication required for update.');

            // Make the API call
            const response = await fetchData(apiUrl, endpoint, {
                method: 'PUT',
                body,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (isMountedRef.current) {
                // Optimistic UI Update: Update local state immediately
                // The socket listener ('taxiUpdate') will eventually confirm or correct this
                setTaxis(prevTaxis =>
                    prevTaxis.map(t =>
                        t._id === selectedTaxi._id ? { ...t, ...optimisticUpdateData } : t
                    )
                );
                showCustomPopup(response.message || 'Update successful!', 'success');
                setModalVisible(false); // Close the modal on success
            }
        } catch (error: any) {
            if (isMountedRef.current) {
                showCustomPopup(error.message || 'Update failed. Please try again.', 'error');
            }
            console.error(`TM: Error updating taxi ${updateType}:`, error);
        } finally {
            if (isMountedRef.current) setIsSubmitting(false); // Reset loading state
        }
    };

    // Trigger the delete confirmation modal
    const handleDeleteTaxi = (taxiId: string, taxiNumberPlate: string) => {
        if (isSubmitting) return; // Don't allow triggering delete if another operation is ongoing

        console.log(`TM: Initiating delete confirmation for taxi: ${taxiId}`);
        setConfirmMessage(`Are you sure you want to delete taxi ${taxiNumberPlate}? This action cannot be undone.`);
        setTaxiIdToDelete(taxiId); // Store the ID of the taxi to be deleted
        setConfirmVisible(true);   // Show the custom confirmation modal
    };

    // Perform the actual delete API call after confirmation
    const performDelete = async (idToDelete: string) => {
        if (!idToDelete) {
            console.error("TM: performDelete called without a valid taxi ID.");
            return; // Should not happen if logic is correct
        }
        console.log(`TM: Confirmed deletion. Performing delete for taxi: ${idToDelete}`);
        setIsSubmitting(true); // Set loading state for the delete operation

        try {
            const token = await getToken();
            if (!token) {
                throw new Error('Authentication required to delete.');
            }

            const endpoint = `api/taxis/${idToDelete}/delete`;
            // Make the DELETE request
            const response = await fetchData(apiUrl, endpoint, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            // Check if component is still mounted before updating state
            if (isMountedRef.current) {
                const deletedTaxi = taxis.find(t => t._id === idToDelete); // Get details for the success message
                // Remove taxi from local state immediately (Optimistic Update)
                // The socket listener ('taxiDeleted') will eventually confirm this removal
                setTaxis(prevTaxis => prevTaxis.filter(t => t._id !== idToDelete));
                showCustomPopup(response.message || `Taxi ${deletedTaxi?.numberPlate || idToDelete} deleted successfully.`, 'success');
            }

        } catch (error: any) {
            console.error("TM: Error deleting taxi:", error);
            if (isMountedRef.current) {
                showCustomPopup(error.message || 'Failed to delete taxi. Please try again.', 'error');
            }
        } finally {
            // Reset state regardless of success or failure, if component is mounted
            if (isMountedRef.current) {
                setIsSubmitting(false); // Reset loading state
                setTaxiIdToDelete(null); // Clear the stored ID
                setConfirmVisible(false); // Ensure confirm modal is hidden
            }
        }
    };

    // Handle the "Confirm" action from the CustomConfirm modal
    const handleConfirmDelete = () => {
        setConfirmVisible(false); // Hide the confirmation modal
        if (taxiIdToDelete) {
            performDelete(taxiIdToDelete); // Proceed with the deletion
        } else {
            // This case should ideally not be reached if the flow is correct
            console.error("TM: Confirm delete pressed, but no taxi ID was stored.");
            setIsSubmitting(false); // Ensure loading state is reset if something went wrong
        }
        // Note: taxiIdToDelete is cleared within performDelete's finally block
    };

    // Handle the "Cancel" action from the CustomConfirm modal
    const handleCancelDelete = () => {
        console.log("TM: Deletion cancelled by user.");
        setConfirmVisible(false); // Hide the confirmation modal
        setTaxiIdToDelete(null); // Clear the stored ID
        // No need to change isSubmitting here as no action was taken
    };


    // --- Navigation and Sidebar ---
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false); // Close sidebar on navigation
        // Use the correct navigation structure with name and params
        switch (screen) {
            case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true }); break;
            case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
            case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true }); break;
            case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true }); break;
            case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true }); break;
            case 'TaxiFareCalculator': navigation.navigate({ name: 'TaxiFareCalculator', params: undefined, merge: true }); break;
            case 'TaxiManagement': break; // Already on this screen, do nothing
            case 'Profile': navigation.navigate({ name: 'Profile', params: undefined, merge: true }); break;
            case 'AcceptedRequest': navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true }); break;
            case 'AcceptedPassenger': navigation.navigate({ name: 'AcceptedPassenger', params: undefined, merge: true }); break;
            case 'Auth': navigation.navigate({ name: 'Auth', params: undefined, merge: true }); break; // Navigate to Auth/Login
            default: console.warn(`TM: Navigating to unhandled screen: ${screen}`); break;
        }
    };

    const toggleSidebar = () => {
        setSidebarVisible(!sidebarVisible);
    };

    // --- Styling Helper ---
    const getStatusStyle = (status: string): TextStyle => {
        switch (status?.toLowerCase()) {
            case 'available': return { color: '#28a745', fontWeight: 'bold' }; // Green
            case 'full': case 'not available': return { color: '#dc3545', fontWeight: 'bold' }; // Red
            case 'almost full': case 'on trip': case 'roaming': return { color: '#ffc107', fontWeight: 'bold' }; // Yellow/Orange
            case 'waiting': return { color: '#007bff', fontWeight: 'bold' }; // Blue
            default: return { color: '#6c757d'}; // Default Gray
        }
    };

    // --- Render Taxi Card ---
    const renderTaxi = ({ item }: { item: Taxi }) => (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.taxiCard}>
                {/* Card Header */}
                <View style={styles.taxiCardHeader}>
                    <MaterialIcons name="local-taxi" size={24} color="#003E7E" />
                    <Text style={styles.taxiCardTitle}>{item.numberPlate}</Text>
                </View>
                {/* Card Body - Taxi Info */}
                <View style={styles.taxiCardBody}>
                    <View style={styles.taxiInfoRow}>
                        <Ionicons name="flag-outline" size={18} color="#555" style={styles.taxiInfoIcon}/>
                        <Text style={styles.taxiInfoLabel}>Status:</Text>
                        <Text style={[styles.taxiInfoValue, getStatusStyle(item.status)]}>{item.status || 'N/A'}</Text>
                    </View>
                    <View style={styles.taxiInfoRow}>
                        <Ionicons name="location-outline" size={18} color="#555" style={styles.taxiInfoIcon}/>
                        <Text style={styles.taxiInfoLabel}>Location:</Text>
                        <Text style={styles.taxiInfoValue} numberOfLines={1} ellipsizeMode='tail'>{item.currentStop || 'N/A'}</Text>
                    </View>
                    <View style={styles.taxiInfoRow}>
                        <Ionicons name="people-outline" size={18} color="#555" style={styles.taxiInfoIcon}/>
                        <Text style={styles.taxiInfoLabel}>Load:</Text>
                        <Text style={styles.taxiInfoValue}>
                            {item.currentLoad ?? 'N/A'}
                            {item.capacity != null ? ` / ${item.capacity}` : ''}
                        </Text>
                    </View>
                </View>
                {/* Card Footer - Action Buttons */}
                <View style={styles.taxiCardFooter}>
                    <ActionButton
                        title="Delete"
                        onPress={() => handleDeleteTaxi(item._id, item.numberPlate)} // Trigger confirmation
                        iconName="trash-outline"
                        iconFamily='Ionicons'
                        color="#dc3545" // Red color for delete
                        style={styles.deleteButton}
                        disabled={isSubmitting} // Disable if any operation is in progress
                        loading={false} // No specific loading indicator on delete button itself
                    />
                    <ActionButton
                        title="Update Info"
                        onPress={() => handleActionPress(item)} // Open update modal
                        iconName="create-outline"
                        iconFamily='Ionicons'
                        style={styles.updateButton}
                        disabled={isSubmitting} // Disable if any operation is in progress
                    />
                </View>
            </View>
        </Animated.View>
    );

    // --- Main Render Logic ---
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                {/* Sidebar Component */}
                <Sidebar
                    isVisible={sidebarVisible}
                    onClose={toggleSidebar}
                    onNavigate={handleNavigate}
                    activeScreen="TaxiManagement"
                />

                {/* Main Content Area */}
                <Animated.View style={[styles.mainContainer]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                            <Ionicons name="menu" size={32} color="#003E7E" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Manage My Taxis</Text>
                        {/* Placeholder view for alignment */}
                        <View style={styles.headerButton} />
                    </View>

                    {/* Conditional Content: Loading or Taxi List */}
                    {isLoading ? (
                        <Loading /> // Show loading indicator
                    ) : (
                        <FlatList
                            data={taxis}
                            keyExtractor={(item) => item._id}
                            renderItem={renderTaxi}
                            contentContainerStyle={styles.listContentContainer}
                            ListEmptyComponent={ // Displayed when the taxi list is empty
                                <View style={styles.emptyListContainer}>
                                    <Ionicons name="car-sport-outline" size={50} color="#888" />
                                    <Text style={styles.emptyListText}>No taxis assigned to you.</Text>
                                    <Text style={styles.emptyListSubText}>You can add or manage your taxis via your Profile.</Text>
                                    <ActionButton
                                        title="Go to Profile"
                                        onPress={() => handleNavigate('Profile')}
                                        style={{marginTop: 20}}
                                    />
                                </View>
                            }
                        />
                    )}

                    {/* Update Taxi Modal */}
                    <Modal
                        animationType="fade"
                        transparent={true}
                        visible={modalVisible}
                        onRequestClose={() => {if (!isSubmitting) setModalVisible(false);}} // Close on back button press if not submitting
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                {selectedTaxi && ( // Render content only if a taxi is selected
                                    <>
                                        {/* Close Button */}
                                        <TouchableOpacity
                                            style={styles.modalCloseButton}
                                            onPress={() => {if (!isSubmitting) setModalVisible(false);}}
                                            disabled={isSubmitting}
                                        >
                                            <Ionicons name="close-circle" size={30} color="#888" />
                                        </TouchableOpacity>
                                        {/* Modal Title */}
                                        <Text style={styles.modalTitle}>Update: {selectedTaxi.numberPlate}</Text>

                                        {/* Step 1: Select Update Type */}
                                        {!updateType && (
                                            <View style={styles.optionContainer}>
                                                <Text style={styles.optionTitle}>Select what to update:</Text>
                                                <View style={styles.optionButtons}>
                                                    <ActionButton title="Status" onPress={() => setUpdateType('status')} style={styles.modalOptionButton} iconName="flag-outline" iconFamily="Ionicons"/>
                                                    <ActionButton title="Stop" onPress={() => setUpdateType('stop')} style={styles.modalOptionButton} iconName="location-outline" iconFamily="Ionicons"/>
                                                    <ActionButton title="direction" onPress={() => setUpdateType('direction')} style={styles.modalOptionButton} iconName="arrow-up-sharp" iconFamily="Ionicons"/>
                                                    <ActionButton title="Load" onPress={() => setUpdateType('load')} style={styles.modalOptionButton} iconName="people-outline" iconFamily="Ionicons"/>
                                                </View>
                                            </View>
                                        )}

                                        {/* Step 2: Update Forms */}
                                        {updateType === 'status' && (
                                            <View style={styles.formGroup}>
                                                <Text style={styles.modalLabel}>New Status:</Text>
                                                <View style={styles.pickerContainer}>
                                                    <Picker selectedValue={newStatus} onValueChange={setNewStatus} style={styles.pickerStyle} itemStyle={styles.pickerItemStyle}>
                                                        {statusOptions.map(s => <Picker.Item key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} value={s} />)}
                                                    </Picker>
                                                </View>
                                            </View>
                                        )}
                                        {updateType === 'stop' && (
                                            <View style={styles.formGroup}>
                                                <Text style={styles.modalLabel}>New Stop:</Text>
                                                {isLoadingStops ? (
                                                    <View style={styles.loadingStopsContainer}><ActivityIndicator/><Text style={styles.loadingStopsText}>Loading stops...</Text></View>
                                                ) : stopOptions.length > 0 ? (
                                                    <View style={styles.pickerContainer}>
                                                        <Picker selectedValue={newStop} onValueChange={setNewStop} style={styles.pickerStyle} itemStyle={styles.pickerItemStyle}>
                                                            {stopOptions.map(s => <Picker.Item key={s} label={s} value={s}/>)}
                                                        </Picker>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.noStopsText}>No stops available for this taxi's route.</Text>
                                                )}
                                            </View>
                                        )}
                                     {updateType === 'direction' && (
                                            <View style={styles.formGroup}>
                                                <Text style={styles.modalLabel}>New Direction:</Text>
                                                {isLoadingStops ? (
                                                    <View style={styles.loadingStopsContainer}><ActivityIndicator/><Text style={styles.loadingStopsText}>Loading directions...</Text></View>
                                                ) : directionOptions.length > 0 ? (
                                                    <View style={styles.pickerContainer}>
                                                        <Picker selectedValue={newDirection} onValueChange={setNewDirection} style={styles.pickerStyle} itemStyle={styles.pickerItemStyle}>
                                                            {directionOptions.map(s => <Picker.Item key={s} label={s} value={s}/>)}
                                                        </Picker>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.noStopsText}>Only forward direction is available.</Text>
                                                )}
                                            </View>
                                        )}
                                        {updateType === 'load' && (
                                            <View style={styles.formGroup}>
                                                <Text style={styles.modalLabel}>Current Load (Passengers):</Text>
                                                <TextInput
                                                    style={styles.modalInput}
                                                    keyboardType="numeric"
                                                    value={newLoad}
                                                    onChangeText={setNewLoad}
                                                    placeholder="Enter current passenger count"
                                                    placeholderTextColor="#aaa"
                                                />
                                                {selectedTaxi.capacity != null && <Text style={styles.maxLoadText}>Max Capacity: {selectedTaxi.capacity}</Text>}
                                            </View>
                                        )}

                                        {/* Step 3: Action Buttons (Back/Submit) */}
                                        {updateType && (
                                            <View style={styles.modalButtons}>
                                                <ActionButton
                                                    title="Back"
                                                    onPress={() => setUpdateType(null)} // Go back to type selection
                                                    color="#6c757d" // Gray color
                                                    style={styles.modalActionButton}
                                                    disabled={isSubmitting}
                                                />
                                                <ActionButton
                                                    title="Submit Update"
                                                    onPress={handleUpdate} // Submit the changes
                                                    color="#007bff" // Blue color
                                                    style={styles.modalActionButton}
                                                    loading={isSubmitting} // Show loading indicator
                                                    // Disable submit if loading, or if required fields are missing/invalid
                                                    disabled={isSubmitting || (updateType === 'stop' && (isLoadingStops || stopOptions.length === 0 || !newStop)) || (updateType === 'status' && !newStatus) || (updateType === 'load' && (newLoad === '' || parseInt(newLoad, 10) < 0))}
                                                />
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        </View>
                    </Modal>
                </Animated.View>

                {/* Custom Info/Error Popup */}
                <CustomPopup
                    visible={customPopupVisible}
                    message={customPopupMessage}
                    type={customPopupType}
                    onClose={hideCustomPopup}
                />

                {/* Custom Confirmation Dialog for Deletion */}
                <CustomConfirm
                    visible={confirmVisible}
                    message={confirmMessage}
                    onCancel={handleCancelDelete} // Wire up the cancel handler
                    onConfirm={handleConfirmDelete} // Wire up the confirm handler
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? 15 : 10, // Adjust padding for status bar
        paddingBottom: 10,
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderBottomColor: '#DDD',
        borderBottomWidth: 1,
        elevation: 2, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center' }, // Ensure adequate tap area
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#003E7E', textAlign: 'center', flex: 1 }, // Center title using flex
    listContentContainer: { paddingHorizontal: 15, paddingVertical: 10, paddingBottom: 80 }, // Increased bottom padding
    taxiCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 15,
        elevation: 3, // Android shadow
        shadowColor: '#000000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        overflow: 'hidden', // Clip content within borders
    },
    taxiCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F0FE', // Light blue header background
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#D0D8E8',
    },
    taxiCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, flexShrink: 1 }, // Allow shrinking if text is long
    taxiCardBody: { paddingHorizontal: 15, paddingVertical: 10, },
    taxiInfoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, },
    taxiInfoIcon: { marginRight: 10, width: 20, textAlign: 'center', color: '#555' }, // Consistent icon color
    taxiInfoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 75, }, // Fixed width for alignment
    taxiInfoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1, }, // Use flex to take remaining space
    taxiCardFooter: {
        padding: 12, // Slightly more padding
        flexDirection: 'row', // Align buttons horizontally
        justifyContent: 'flex-end', // Push buttons to the right
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        marginTop: 5,
        gap: 10, // Add space between buttons
        backgroundColor: '#F9F9F9' // Subtle background for footer
    },
    updateButton: { paddingVertical: 8, paddingHorizontal: 15, },
    deleteButton: { paddingVertical: 8, paddingHorizontal: 15, },
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        marginTop: 50, // Add some top margin
        minHeight: 300, // Ensure it takes some space
    },
    emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15, },
    emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5, lineHeight: 20 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' }, // Darker overlay
    modalContent: {
        backgroundColor: '#FFF',
        padding: 25,
        borderRadius: 15,
        width: '90%',
        maxWidth: 400,
        elevation: 10, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        position: 'relative' // Needed for absolute positioning of close button
    },
    modalCloseButton: { position: 'absolute', top: 10, right: 10, padding: 5, zIndex: 1 }, // Position close button top-right
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#003E7E', marginBottom: 25, textAlign: 'center', paddingRight: 30 }, // Add padding to avoid overlap with close button
    optionContainer: { marginBottom: 20, alignItems: 'center' },
    optionTitle: { fontSize: 17, color: '#333', marginBottom: 15, fontWeight:'500' },
    optionButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', gap: 10 }, // Add gap between option buttons
    modalOptionButton: { flex: 1, paddingVertical: 10 }, // Let buttons share space
    formGroup: { marginBottom: 20 },
    modalLabel: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: '500' },
    modalInput: {
        backgroundColor: '#F8F8F8',
        borderWidth: 1,
        borderColor: '#D0D0D0',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: Platform.OS === 'ios' ? 14 : 10,
        fontSize: 16,
        color: '#000000'
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#D0D0D0',
        borderRadius: 8,
        backgroundColor: '#F8F8F8',
        overflow: 'hidden', // Clip picker content on Android if needed
        justifyContent: 'center', // Center picker content vertically
        minHeight: Platform.OS === 'ios' ? 'auto' : 50, // Ensure minimum height on Android
    },
    pickerStyle: {
        // height: Platform.OS === 'ios' ? 'auto' : 50, // Let container handle height
        width: '100%',
        backgroundColor: 'transparent', // Make background transparent
        color: '#000000', // Ensure text color is black
    },
    pickerItemStyle: {
        height: Platform.OS === 'ios' ? 120 : 'auto', // iOS requires explicit height for items
        color: '#000000', // Ensure item text color is black
        fontSize: 16, // Consistent font size
        textAlign: 'left', // Align text left
    },
    loadingStopsContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, justifyContent: 'center' },
    loadingStopsText: { marginLeft: 10, color: '#555', fontSize: 15 },
    noStopsText: { color: '#888', fontStyle: 'italic', paddingVertical: 10, textAlign: 'center', fontSize: 15 },
    maxLoadText: { fontSize: 13, color: '#666', marginTop: 4, textAlign: 'right' },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 25,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        paddingTop: 15
    },
    modalActionButton: { flex: 0.48 }, // Keep buttons spaced apart
    actionButtonBase: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 8,
        elevation: 2, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        minHeight: 44, // Minimum tap target size
    },
    actionButtonIcon: { marginRight: 8 },
    actionButtonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
    actionButtonDisabled: {
        backgroundColor: '#B0B0B0', // Grayer background when disabled
        elevation: 0,
        shadowOpacity: 0,
        opacity: 0.7 // Slightly faded look
    },
    // --- Loading Styles ---
    loadingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingContainerInternal: { justifyContent: 'center', alignItems: 'center' },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default TaxiManagement;