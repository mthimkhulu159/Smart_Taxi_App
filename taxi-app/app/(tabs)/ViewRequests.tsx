import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert, // Still useful for confirmations if needed, but not for errors now
  Animated,
  ScrollView,
  SafeAreaView,
  Platform,
  ViewStyle,
  TextStyle,
  Modal, // Import Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchData, getToken } from '../api/api'; // Assuming correct path
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';

// --- Types and Interfaces ---
interface RideRequest {
  _id: string;
  passenger: string; // Ideally, backend sends passenger name or object with name
  passengerName?: string; // Add if backend can provide it
  startingStop: string;
  destinationStop: string;
  requestType: 'ride' | 'pickup'; // Use specific types
  status: string; // e.g., 'pending', 'accepted'
}

// --- Navigation Types (Ensure consistent) ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string };
  requestRide: undefined;
  ViewTaxi: undefined;
  ViewRequests: undefined; // Current screen
  LiveChat: undefined;
  TaxiManagement: undefined;
  Profile: undefined;
  AcceptedRequest: undefined;
  AcceptedPassenger: undefined;
  ViewRoute: undefined;
  Auth: undefined;
  TaxiFareCalculator: undefined;
  // Add other screens if necessary
};

type ViewRequestsNavigationProp = StackNavigationProp<RootStackParamList, 'ViewRequests'>;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

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
  const [isLoading, setIsLoading] = useState<boolean>(true); // For initial fetch
  const [isAccepting, setIsAccepting] = useState<string | null>(null); // Store ID of request being accepted
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // State for custom error modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const navigation = useNavigation<ViewRequestsNavigationProp>();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Function to show the custom error modal
  const displayError = (title: string, message: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Function to close the custom error modal
  const closeErrorModal = () => {
    setShowErrorModal(false);
    setErrorTitle('');
    setErrorMessage('');
  };


  // Fetching Logic
  const fetchNearbyRequests = async (showAlerts = false) => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        displayError('Authentication Error', 'Authentication token not found. Please log in again.');
        return;
      }
      const data = await fetchData(apiUrl, 'api/rideRequest/driver/ride-requests', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(data.rideRequests || []);
      if (showAlerts && (!data.rideRequests || data.rideRequests.length === 0)) {
        // Using Alert for informational message, not error
        Alert.alert('No Requests', 'No new nearby requests found at this time.');
      }
    } catch (err: any) {
      console.error('Error fetching nearby requests:', err);
      // Show error only if manually refreshing or initial load fails hard
      if(showAlerts || requests.length === 0){ // Show alert on refresh fail or if list was already empty
          // Using custom modal for errors
          displayError('Fetch Error', err.message || 'Failed to fetch nearby requests. Please try again.');
      }
      setRequests([]); // Clear requests on error
    } finally {
      setIsLoading(false);
    }
  };

  // Initial Fetch and Animation
  useEffect(() => {
    fetchNearbyRequests();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const animationTimer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
      }, 100);
      return () => clearTimeout(animationTimer);
    }
  }, [isLoading, fadeAnim, slideAnim]);


  // Accept Request Handler
  const handleAccept = async (requestId: string) => {
    setIsAccepting(requestId); // Show loading indicator on the specific button
    try {
      const token = await getToken();
      if (!token) {
        displayError('Authentication Error', 'Authentication token not found. Please log in again.');
        return;
      }

      // Assume fetchData now handles parsing response and throwing on non-2xx statuses
      // Or, we handle the response parsing directly here as before.
      // Let's handle response parsing here to get specific server error messages.
      const response = await fetch(`${apiUrl}/api/rideRequest/accept/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json', // Often needed for PATCH
        },
      });

      if (response.ok) { // Check for success status (200-299)
        const responseData = await response.json();
        Alert.alert('Success', responseData.message || 'Request accepted! You can view details under "Accepted Passenger".',
          [{ text: 'OK', onPress: () => navigation.navigate('AcceptedPassenger') }] // Navigate after success
        );
        // Remove the accepted request from the list
        setRequests((prev) => prev.filter((req) => req._id !== requestId));
      } else {
        // Handle non-success status codes
        const statusCode = response.status;
        let errorMsg = 'Failed to accept the request.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || `Server responded with status ${statusCode}.`;

          // Map specific server error messages to user-friendly messages
          if (errorMsg.toLowerCase().includes("ride request not found")) {
            displayError('Request Not Found', 'The requested ride was not found or might have been cancelled.');
          } else if (errorMsg.toLowerCase().includes("request is no longer pending")) {
            displayError('Request Unavailable', 'This request is no longer pending and cannot be accepted.');
            fetchNearbyRequests(); // Refresh the list to remove it
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
             fetchNearbyRequests(); // Refresh the list to remove it
          } else if (errorMsg.toLowerCase().includes("taxi is not available for pickup requests")) {
            displayError('Taxi Unavailable', 'Your taxi is not currently available for pickup requests.');
          } else if (errorMsg.toLowerCase().includes("unsupported request type")) {
            displayError('Unsupported Type', 'This request type is not supported.');
          } else if (statusCode >= 500) {
            displayError('Server Error', 'An error occurred on the server. Please try again later.');
          } else {
            // Generic HTTP error with server message
            displayError(`HTTP Error ${statusCode}`, errorMsg);
          }

        } catch (e) {
          // Handle cases where the error response is not JSON or parsing fails
          console.error("Failed to parse error response or map error message:", e);
          displayError(`Request Failed (Status: ${statusCode})`, 'An unexpected error occurred on the server.');
        }
      }

    } catch (err: any) {
      console.error('Error accepting request:', err);
      // Handle errors that occur before getting a server response (e.g., network issues)
      if (err.message && err.message.includes('Network request failed')) {
         displayError('Network Error', 'Could not connect to the server. Please check your internet connection.');
      } else {
         displayError('Unexpected Error', err.message || 'An unexpected error occurred while trying to accept the request.');
      }
    } finally {
      setIsAccepting(null); // Hide loading indicator
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
            {/* Display name if available, otherwise ID */}
            <Text style={styles.requestInfoValue}>{item.passengerName || item.passenger || 'N/A'}</Text>
          </View>
          <View style={styles.requestInfoRow}>
            <Ionicons name="navigate-circle-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
            <Text style={styles.requestInfoLabel}>From:</Text>
            <Text style={styles.requestInfoValue}>{item.startingStop}</Text>
          </View>
          {item.requestType === 'ride' && item.destinationStop && ( // Only show destination for 'ride' type
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
            color="#28a745" // Green color for accept
            loading={isAccepting === item._id} // Show loading only for this button
            disabled={isAccepting !== null} // Disable all accept buttons while one is processing
          />
        </View>
    </View>
  );

 // Helper to style status text (can be reused/imported)
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
     // Navigation logic using switch... (same as previous examples)
     switch (screen) {
       case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true }); break;
       case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
       case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true }); break;
       case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true }); break;
       case 'ViewRequests': break; // Already here
       case 'LiveChat': navigation.navigate({ name: 'LiveChat', params: undefined, merge: true }); break;
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
          {/* Sidebar */}
          <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="ViewRequests" />

        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
              <Text style={styles.headerTitle}>Nearby Requests</Text>
              {/* Right Header Button: Refresh */}
               <TouchableOpacity style={styles.headerButton} onPress={() => fetchNearbyRequests(true)} disabled={isLoading}>
                 {isLoading ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
               </TouchableOpacity>
            </View>

          {/* Main Content Area */}
          {isLoading && requests.length === 0 ? ( // Show loading only on initial load when list is empty
            <Loading />
          ) : (
            <FlatList
              data={requests}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContentContainer}
              ListEmptyComponent={ // Styled empty state
                  <View style={styles.emptyListContainer}>
                    <Ionicons name="search-circle-outline" size={50} color="#888" />
                    <Text style={styles.emptyListText}>No nearby requests found.</Text>
                    <Text style={styles.emptyListSubText}>Pull down to refresh or tap the refresh icon above.</Text>
                  </View>
              }
              // Optional: Add pull-to-refresh
              onRefresh={() => fetchNearbyRequests(true)}
              refreshing={isLoading && requests.length > 0} // Show refresh indicator only when refreshing existing list
            />
          )}
          {/* Removed separate Refresh button, added to header */}
        </Animated.View>

        {/* Custom Error Modal */}
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
  // Common Styles (gradient, safeArea, mainContainer, header, etc.)
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' }, // Centered icon
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },

  // List Styles
  listContentContainer: {
      paddingHorizontal: 15,
      paddingVertical: 10, // Add vertical padding
      flexGrow: 1, // Ensure empty component takes space
  },
  requestCard: { // Using sectionCard style as base
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
      justifyContent: 'space-between', // Space out title and status
      backgroundColor: '#E8F0FE',
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#D0D8E8',
  },
  requestCardTitle: {
      fontSize: 16, // Slightly smaller title
      fontWeight: 'bold',
      color: '#003E7E',
      marginLeft: 8, // Space after icon
      flex: 1, // Allow title to take space
  },
    requestStatus: {
        fontSize: 14,
        fontWeight: 'bold', // Handled by getStatusStyle
        marginLeft: 10, // Space before status
    },
  requestCardBody: {
      paddingHorizontal: 15,
      paddingVertical: 10,
  },
  requestInfoRow: { // Similar to taxiInfoRow
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7, // Slightly more space
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
      width: 90, // Adjusted width
  },
  requestInfoValue: {
      fontSize: 15,
      color: '#000',
      fontWeight: '600',
      flex: 1,
  },
    requestCardFooter: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        paddingTop: 5, // Less top padding
        alignItems: 'center', // Center button
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        marginTop: 5,
    },
    acceptButton: {
        paddingVertical: 10, // Adjust button size
        paddingHorizontal: 20,
        width: '80%', // Make button wider
        maxWidth: 300,
    },

    // Empty List Styles (from TaxiManagement)
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        marginTop: 30, // Adjusted margin
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
    },

  // Action Button Styles (Copied from previous screens)
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },

  // --- Sidebar Styles (Copied from previous screens) ---
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10: 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },

  // --- Loading Styles ---
    loadingGradient: { flex: 1 },
    loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },

  // --- Custom Modal Styles ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%', // Adjust width as needed
    maxWidth: 400, // Max width for larger screens
    alignItems: 'center',
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F', // Red for error
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ViewRequestScreen;