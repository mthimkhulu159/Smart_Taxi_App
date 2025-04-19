import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
  SafeAreaView,
  Platform,
  ViewStyle,
  TextStyle,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchData, getToken } from '../api/api'; // Assuming correct path and fetchData signature
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar';
import { apiUrl } from '../api/apiUrl';
import { RootStackParamList } from '../types/navigation';

// --- Types and Interfaces ---
interface RideRequest {
  _id: string;
  passenger: string; // Could be ID
  passengerName?: string; // Populated name from backend
  passengerPhone?: string; // Populated phone from backend (specifically for pickup)
  startingStop: string;
  destinationStop?: string; // Optional for pickup requests
  requestType: 'ride' | 'pickup';
  status: string;
}

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
  useEffect(() => {
    Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start();
  }, [spinAnim]);
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
      <TouchableOpacity style={[styles.actionButtonBase, { backgroundColor: color }, style, isDisabled && styles.actionButtonDisabled]} onPress={onPress} disabled={isDisabled}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : (<>
          {iconName && <IconComponent name={iconName} size={18} color={textColor} style={styles.actionButtonIcon} />}
          <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
        </>)}
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

// Helper to style status text
const getStatusStyle = (status: string): TextStyle => {
  switch (status?.toLowerCase()) {
    case 'pending': return { color: 'orange', fontWeight: 'bold' };
    case 'accepted': return { color: 'green', fontWeight: 'bold' };
    case 'cancelled': return { color: 'red', fontWeight: 'bold' };
    default: return { color: '#555' };
  }
};


// --- Main ViewRequestScreen Component ---
const ViewRequestScreen: React.FC = () => {
  const [requests, setRequests] = useState<RideRequest[]>([]);
  // State for selected request type, default to 'ride'
  const [selectedRequestType, setSelectedRequestType] = useState<'ride' | 'pickup'>('ride');
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


  // Fetching Logic - Updated to use different endpoints based on type
  const fetchNearbyRequests = async (showAlerts = false) => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        displayError('Authentication Error', 'Authentication token not found. Please log in again.');
        return;
      }

      let path = '';
      let dataKey = ''; // Key to access the list of requests in the response

      if (selectedRequestType === 'ride') {
        path = 'api/rideRequest/driver/ride-requests';
        dataKey = 'rideRequests'; // According to your backend code
      } else { // selectedRequestType === 'pickup'
        path = 'api/rideRequest/driver/pickup-requests';
        dataKey = 'pickupRequests'; // According to your backend code
      }

      // Use your existing fetchData function with apiUrl and the determined path
      const data = await fetchData(apiUrl, path, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const fetchedRequests = data[dataKey] || [];

      // Map fetched data to the frontend interface, ensuring requestType is correct
      // and handling potential populated passenger details from the backend
      const formattedRequests: RideRequest[] = fetchedRequests.map((req: any) => ({
          ...req,
          requestType: selectedRequestType, // Explicitly set type for frontend rendering
          // Map populated passenger details if available (as per your pickup endpoint)
          passengerName: req.passenger?.name || req.passenger,
          passengerPhone: req.passenger?.phone,
          passenger: req.passenger?._id || req.passenger, // Keep original passenger ID/object
      }));

      setRequests(formattedRequests);

      if (showAlerts && formattedRequests.length === 0) {
        const typeText = selectedRequestType === 'ride' ? 'ride' : 'pickup';
        Alert.alert(`No ${typeText} Requests`, `No new nearby ${typeText} requests found at this time.`);
      }
    } catch (err: any) {
      console.error(`Error fetching nearby ${selectedRequestType} requests:`, err);
       // Handle specific error messages from the backend pickup endpoint
       if (err.message && err.message.includes("'roaming' status to receive pickup requests")) {
         displayError('Taxi Status', 'Your taxi must be in "roaming" status to receive pickup requests.');
       } else if (showAlerts || requests.length === 0) {
         displayError('Fetch Error', err.message || `Failed to fetch nearby ${selectedRequestType} requests. Please try again.`);
       }
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch requests when component mounts or selectedRequestType changes
  useEffect(() => {
    // Call fetchNearbyRequests which will use the current selectedRequestType
    fetchNearbyRequests(false);
  }, [selectedRequestType]); // Depend on selectedRequestType

  // Animation useEffect (remains the same)
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


  // Accept Request Handler (remains the same, it just needs the request ID)
  const handleAccept = async (requestId: string) => {
    setIsAccepting(requestId);
    try {
      const token = await getToken();
      if (!token) {
        displayError('Authentication Error', 'Authentication token not found. Please log in again.');
        return;
      }

      // Your existing fetchData function might be used here too,
      // but direct fetch call is also fine if fetchData is only for GET
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
        // Remove the accepted request from the list
        setRequests((prev) => prev.filter((req) => req._id !== requestId));
      } else {
        const statusCode = response.status;
        let errorMsg = 'Failed to accept the request.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || `Server responded with status ${statusCode}.`;

          // Map specific server error messages to user-friendly messages
          if (errorMsg.toLowerCase().includes("ride request not found")) {
            displayError('Request Not Found', 'The requested request was not found or might have been cancelled.');
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
            displayError('Unsupported Type', 'This request type is not supported by the acceptance logic.');
          } else if (statusCode === 400 && errorMsg.toLowerCase().includes("your taxi must be in 'roaming' status to receive pickup requests")) {
             // This specific error is handled during fetch, but might reappear on accept if status changes
             displayError('Taxi Status', 'Your taxi must be in "roaming" status to accept pickup requests.');
          }
           else if (statusCode >= 500) {
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


  // Render Request Card Item (updated to show phone for pickup if available)
  const renderItem = ({ item }: { item: RideRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestCardHeader}>
        <Ionicons name={item.requestType === 'ride' ? "car-sport-outline" : "location-outline"} size={22} color="#003E7E" />
        <Text style={styles.requestCardTitle}>{item.requestType === 'ride' ? 'Ride Request' : 'Pickup Request'}</Text>
        <Text style={[styles.requestStatus, getStatusStyle(item.status)]}>{item.status}</Text>
      </View>
      <View style={styles.requestCardBody}>
        <View style={styles.requestInfoRow}>
          <Ionicons name="person-outline" size={18} color="#555" style={styles.requestInfoIcon} />
          <Text style={styles.requestInfoLabel}>Passenger:</Text>
          {/* Display populated name or original passenger ID */}
          <Text style={styles.requestInfoValue}>{item.passengerName || item.passenger || 'N/A'}</Text>
        </View>
         {/* Show phone number for pickup requests if available */}
        {item.requestType === 'pickup' && item.passengerPhone && (
             <View style={styles.requestInfoRow}>
              <Ionicons name="call-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
              <Text style={styles.requestInfoLabel}>Phone:</Text>
              <Text style={styles.requestInfoValue}>{item.passengerPhone}</Text>
            </View>
         )}
        <View style={styles.requestInfoRow}>
          <Ionicons name="navigate-circle-outline" size={18} color="#555" style={styles.requestInfoIcon} />
          <Text style={styles.requestInfoLabel}>From:</Text>
          <Text style={styles.requestInfoValue}>{item.startingStop}</Text>
        </View>
        {/* Only show destination for 'ride' type */}
        {item.requestType === 'ride' && item.destinationStop && (
          <View style={styles.requestInfoRow}>
            <Ionicons name="flag-outline" size={18} color="#555" style={styles.requestInfoIcon} />
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
          loading={isAccepting === item._id}
          disabled={isAccepting !== null}
        />
      </View>
    </View>
  );

  const handleNavigate = (screen: keyof RootStackParamList) => {
    setSidebarVisible(false);
    switch (screen) {
      case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true }); break;
      case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
      case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true }); break;
      case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true }); break;
      case 'ViewRequests': break;
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

  // Handler for toggling request type
  const handleTypeToggle = (type: 'ride' | 'pickup') => {
    // Only toggle if the type is different and not currently loading
    if (selectedRequestType !== type && !isLoading) {
      setSelectedRequestType(type);
      // The useEffect hook will handle fetching data for the new type
    }
  };

  // --- Render Logic ---
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
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

          {/* Request Type Toggle Buttons */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                selectedRequestType === 'ride' && styles.toggleButtonActive,
              ]}
              onPress={() => handleTypeToggle('ride')}
              disabled={isLoading} // Disable buttons while loading
            >
              <Ionicons name="car-sport-outline" size={20} color={selectedRequestType === 'ride' ? '#FFFFFF' : '#003E7E'} />
              <Text style={[
                styles.toggleButtonText,
                selectedRequestType === 'ride' && styles.toggleButtonTextActive,
              ]}>Rides</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                selectedRequestType === 'pickup' && styles.toggleButtonActive,
              ]}
              onPress={() => handleTypeToggle('pickup')}
              disabled={isLoading} // Disable buttons while loading
            >
              <Ionicons name="location-outline" size={20} color={selectedRequestType === 'pickup' ? '#FFFFFF' : '#003E7E'} />
              <Text style={[
                styles.toggleButtonText,
                selectedRequestType === 'pickup' && styles.toggleButtonTextActive,
              ]}>Pickups</Text>
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
                  <Text style={styles.emptyListText}>
                    {`No nearby ${selectedRequestType} requests found.`}
                    </Text>
                  <Text style={styles.emptyListSubText}>Pull down to refresh or tap the refresh icon above.</Text>
                </View>
              }
              onRefresh={() => fetchNearbyRequests(true)} // Refresh uses the current selected type
              refreshing={isLoading && requests.length > 0} // Show refresh indicator only when refreshing existing list
            />
          )}
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
  // Common Styles
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },

  // Toggle Styles
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20, // Pill shape
    marginHorizontal: 5, // Space between buttons
    borderWidth: 1,
    borderColor: '#003E7E',
    backgroundColor: '#FFFFFF',
  },
  toggleButtonActive: {
    backgroundColor: '#003E7E',
    borderColor: '#003E7E',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#003E7E',
    marginLeft: 5, // Space after icon
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },


  // List Styles
  listContentContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
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
    fontWeight: 'bold',
    marginLeft: 10,
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
    width: 90,
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
    paddingTop: 5,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    marginTop: 5,
  },
  acceptButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '80%',
    maxWidth: 300,
  },

  // Empty List Styles
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
  },

  // Action Button Styles
  actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  actionButtonIcon: { marginRight: 10 },
  actionButtonText: { fontSize: 16, fontWeight: '600' },
  actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },

  // Sidebar Styles (Copied from previous screens)
  sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10 : 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
  sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
  sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
  sidebarLogoIconInternal: { marginBottom: 10 },
  sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
  sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
  sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
  sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },

  // Loading Styles
  loadingGradient: { flex: 1 },
  loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },

  // Custom Modal Styles
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ViewRequestScreen;