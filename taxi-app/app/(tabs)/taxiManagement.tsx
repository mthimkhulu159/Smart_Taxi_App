import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  Alert,
  Animated,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  ViewStyle,
  TextStyle // Import TextStyle for the fix
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { fetchData, getToken } from '../api/api'; // Assuming correct path
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import io from 'socket.io-client';
import { apiUrl } from '../api/apiUrl';

// --- Constants ---

// --- Types and Interfaces ---
type Taxi = {
  _id: string;
  numberPlate: string;
  status: string;
  currentStop: string;
  currentLoad: number;
  maxLoad?: number;
};

type Stop = {
  name: string;
  order: number;
};

type UpdateType = 'status' | 'stop' | 'load' | null;

const statusOptions = [
  'waiting', 'available', 'roaming', 'almost full', 'full', 'on trip', 'not available',
];

// --- Navigation Types (Ensure consistent) ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string };
  requestRide: undefined;
  ViewTaxi: undefined;
  ViewRequests: undefined;
  LiveChat: undefined;
  TaxiManagement: undefined; // Current screen
  Profile: undefined;
  AcceptedRequest: undefined;
  AcceptedPassenger: undefined;
  ViewRoute: undefined;
  Auth: undefined;
  // Add other screens if necessary
};

type TaxiManagementNavigationProp = StackNavigationProp<RootStackParamList, 'TaxiManagement'>;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

// --- Reusable Components Defined Directly In This File ---

// --- Enhanced Sidebar Component (Copied from previous screens) ---
const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose, onNavigate, activeScreen }) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: isVisible ? 0 : -300, duration: 300, useNativeDriver: true }).start();
  }, [isVisible, slideAnim]);

  const NavItem: React.FC<{ screen: keyof RootStackParamList; label: string; icon: React.ReactNode }> = ({ screen, label, icon }) => (
    <TouchableOpacity
      style={[styles.sidebarButtonInternal, activeScreen === screen && styles.sidebarButtonActiveInternal]}
      onPress={() => { onNavigate(screen); onClose(); }}
    >
      {icon}
      <Text style={[styles.sidebarButtonTextInternal, activeScreen === screen && styles.sidebarButtonTextActiveInternal]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.sidebarInternal, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.sidebarCloseButtonInternal} onPress={onClose}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.sidebarHeaderInternal}>
          <Ionicons name="car-sport-outline" size={40} color="#FFFFFF" style={styles.sidebarLogoIconInternal} />
          <Text style={styles.sidebarTitleInternal}>Shesha</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <NavItem screen="Home" label="Home" icon={<FontAwesome name="home" size={22} color="#FFFFFF" />} />
          <NavItem screen="requestRide" label="Request Ride" icon={<FontAwesome name="car" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewTaxi" label="View Taxis" icon={<MaterialIcons name="local-taxi" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewRoute" label="View Routes" icon={<MaterialIcons name="route" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedRequest" label="My Ride" icon={<FontAwesome name="check-circle" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedPassenger" label="View Passenger" icon={<FontAwesome name="circle" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewRequests" label="Search Rides" icon={<FontAwesome name="search" size={22} color="#FFFFFF" />} />
          <NavItem screen="LiveChat" label="Live Chat" icon={<Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />} />
          <NavItem screen="TaxiManagement" label="Manage Taxi" icon={<MaterialIcons name="settings" size={22} color="#FFFFFF" />} />
          <NavItem screen="Profile" label="Profile" icon={<FontAwesome name="user-circle-o" size={22} color="#FFFFFF" />} />
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

// --- Loading Component (Copied from previous screens) ---
const Loading: React.FC = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start();
  }, [spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
        <View style={styles.loadingContainerInternal}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View>
            <Text style={styles.loadingTextInternal}>Loading...</Text>
        </View>
    </LinearGradient>
  );
};

// --- Action Button Component (Copied from previous screens) ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    const isDisabled = disabled || loading;
    return (
        <TouchableOpacity
            style={[ styles.actionButtonBase, { backgroundColor: color }, style, isDisabled && styles.actionButtonDisabled ]}
            onPress={onPress} disabled={isDisabled}
        >
        {loading ? <ActivityIndicator size="small" color={textColor} /> : (
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
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedTaxi, setSelectedTaxi] = useState<Taxi | null>(null);
  const [updateType, setUpdateType] = useState<UpdateType>(null);
  const [newStatus, setNewStatus] = useState<string>(statusOptions[0]);
  const [newStop, setNewStop] = useState<string>('');
  const [newLoad, setNewLoad] = useState<string>('0');
  const [stopOptions, setStopOptions] = useState<string[]>([]);
  const [isLoadingStops, setIsLoadingStops] = useState<boolean>(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const socketRef = useRef<any>(null);

  const navigation = useNavigation<TaxiManagementNavigationProp>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Socket Connection Effect
  useEffect(() => {
    console.log('TaxiManagement: Attempting socket connection...');
    const newSocket = io(apiUrl, { transports: ['websocket'], reconnectionAttempts: 5, timeout: 10000 });
    socketRef.current = newSocket;
    newSocket.on('connect', () => console.log('TaxiManagement: Socket connected', newSocket.id));
    newSocket.on('disconnect', (reason: string) => console.log('TaxiManagement: Socket disconnected', reason));
    newSocket.on('connect_error', (err: Error) => console.log('TaxiManagement: Socket connection error:', err.message));
    newSocket.on('taxiUpdate', (updatedTaxi: Taxi) => {
      console.log('Received taxiUpdate:', updatedTaxi);
      setTaxis((currentTaxis) => currentTaxis.map((taxi) => taxi._id === updatedTaxi._id ? { ...taxi, ...updatedTaxi } : taxi));
    });
    return () => { if (socketRef.current) { console.log('TaxiManagement: Cleaning up socket connection.'); socketRef.current.close(); } };
  }, [apiUrl]);


  // Initial Data Loading Effect
  useEffect(() => {
    loadTaxis();
  }, []);

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
      }
  }, [isLoading, fadeAnim, slideAnim]);


  const loadTaxis = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) { Alert.alert('Authentication Error', 'No authentication token found. Please login.'); setIsLoading(false); return; }
      const data = await fetchData(apiUrl, 'api/taxis/driver-taxi', { headers: { Authorization: `Bearer ${token}` } });
      if (data?.taxis) { setTaxis(data.taxis); } else { setTaxis([]); console.log('No taxis assigned to this driver.'); }
    } catch (error: any) {
      setTaxis([]); Alert.alert('Error', `Failed to load your taxi details: ${error.message || 'Unknown error'}`); console.error(error);
    } finally { setIsLoading(false); }
  };

  const fetchStopsForTaxi = async (taxiId: string) => {
    setIsLoadingStops(true); setStopOptions([]);
    try {
      const token = await getToken(); if (!token) throw new Error('Authentication required to fetch stops.');
      const data = await fetchData(apiUrl, `api/taxis/${taxiId}/stops`, { headers: { Authorization: `Bearer ${token}` } });
      if (data?.stops) {
        const sortedStops = data.stops.sort((a: Stop, b: Stop) => a.order - b.order || a.name.localeCompare(b.name));
        const names = sortedStops.map((stop: Stop) => stop.name);
        setStopOptions(names);
        const currentStopExists = names.includes(selectedTaxi?.currentStop || '');
        setNewStop(currentStopExists ? selectedTaxi!.currentStop : names[0] || '');
      } else { setStopOptions([]); setNewStop(''); Alert.alert('Info', 'No stops found for this taxi\'s route.'); }
    } catch (error: any) {
      console.error('Error fetching stops:', error.message); setStopOptions([]); setNewStop(''); Alert.alert('Error', `Failed to load stops: ${error.message}`);
    } finally { setIsLoadingStops(false); }
  };

  useEffect(() => {
    if (modalVisible && updateType === 'stop' && selectedTaxi) { fetchStopsForTaxi(selectedTaxi._id); }
  }, [modalVisible, updateType, selectedTaxi]);

  const handleActionPress = (taxi: Taxi) => {
    setSelectedTaxi(taxi); setUpdateType(null);
    setNewStatus(taxi.status || statusOptions[0]); setNewLoad(taxi.currentLoad?.toString() ?? '0');
    setStopOptions([]); setNewStop(taxi.currentStop || '');
    setModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedTaxi || !updateType) { Alert.alert('Selection Error', 'No taxi or update type selected.'); return; }
    let endpoint = ''; let body = {}; let updateDataForSocket = {};
    try {
        if (updateType === 'status') { if (!newStatus) throw new Error('Please select a status.'); endpoint = `api/taxis/${selectedTaxi._id}/status`; body = { status: newStatus }; updateDataForSocket = { status: newStatus }; }
        else if (updateType === 'stop') { if (!newStop) throw new Error('Please select a stop.'); endpoint = `api/taxis/${selectedTaxi._id}/currentStopManual`; body = { currentStop: newStop }; updateDataForSocket = { currentStop: newStop }; }
        else if (updateType === 'load') {
          const parsedLoad = parseInt(newLoad, 10); if (isNaN(parsedLoad) || parsedLoad < 0) throw new Error('Please enter a valid non-negative number for load.');
          if (selectedTaxi.maxLoad != null && parsedLoad > selectedTaxi.maxLoad) throw new Error(`Load cannot exceed maximum capacity of ${selectedTaxi.maxLoad}.`);
          endpoint = `api/taxis/${selectedTaxi._id}/load`; body = { currentLoad: parsedLoad }; updateDataForSocket = { currentLoad: parsedLoad };
        }
        const token = await getToken(); if (!token) throw new Error('Authentication required for update.');
        const response = await fetchData(apiUrl, endpoint, { method: 'PUT', body, headers: { Authorization: `Bearer ${token}` } });
        const updatedTaxiData = { ...selectedTaxi, ...updateDataForSocket };
        setTaxis(prevTaxis => prevTaxis.map(t => t._id === selectedTaxi._id ? updatedTaxiData : t));
        if (socketRef.current && socketRef.current.connected) { console.log('Emitting taxiUpdate:', updatedTaxiData); socketRef.current.emit('taxiUpdate', updatedTaxiData); } else { console.warn('Socket not connected, cannot emit update.'); }
        Alert.alert('Success', response.message || 'Update successful!'); setModalVisible(false);
    } catch (error: any) { Alert.alert('Update Error', error.message || 'Failed to perform update.'); console.error(error); }
  };

  // Helper to style status text based on value
  // FIX APPLIED HERE: Added explicit TextStyle return type
  const getStatusStyle = (status: string): TextStyle => {
      switch (status?.toLowerCase()) {
          case 'available': return { color: 'green', fontWeight: 'bold' };
          case 'full':
          case 'not available': return { color: 'red', fontWeight: 'bold' };
          case 'almost full':
          case 'on trip': return { color: 'orange', fontWeight: 'bold' }; // Consider a more orange hex code if needed
          case 'waiting':
          case 'roaming': return { color: '#0052A2', fontWeight: 'bold' };
          default: return {}; // Default empty style object
      }
  };

  // Render Taxi Card Item for FlatList
  const renderTaxi = ({ item }: { item: Taxi }) => (
    <View style={styles.taxiCard}>
        <View style={styles.taxiCardHeader}>
            <MaterialIcons name="local-taxi" size={24} color="#003E7E" />
            <Text style={styles.taxiCardTitle}>{item.numberPlate}</Text>
        </View>
        <View style={styles.taxiCardBody}>
            <View style={styles.taxiInfoRow}>
                <Ionicons name="flag-outline" size={18} color="#555" style={styles.taxiInfoIcon}/>
                <Text style={styles.taxiInfoLabel}>Status:</Text>
                {/* Line 399 where the error occurred */}
                <Text style={[styles.taxiInfoValue, getStatusStyle(item.status)]}>{item.status}</Text>
            </View>
             <View style={styles.taxiInfoRow}>
                <Ionicons name="location-outline" size={18} color="#555" style={styles.taxiInfoIcon}/>
                <Text style={styles.taxiInfoLabel}>Location:</Text>
                <Text style={styles.taxiInfoValue}>{item.currentStop || 'N/A'}</Text>
            </View>
            <View style={styles.taxiInfoRow}>
                <Ionicons name="people-outline" size={18} color="#555" style={styles.taxiInfoIcon}/>
                <Text style={styles.taxiInfoLabel}>Load:</Text>
                 <Text style={styles.taxiInfoValue}>{item.currentLoad ?? 'N/A'}{item.maxLoad != null ? ` / ${item.maxLoad}` : ''}</Text>
            </View>
        </View>
         <View style={styles.taxiCardFooter}>
            <ActionButton title="Update Info" onPress={() => handleActionPress(item)} iconName="create-outline" style={styles.updateButton} />
         </View>
    </View>
  );


  // Navigation Handler
   const handleNavigate = (screen: keyof RootStackParamList) => {
     setSidebarVisible(false);
     // Navigation logic using switch... (same as previous examples)
      switch (screen) {
        case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true }); break;
        case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
        case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true }); break;
        case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true }); break;
        case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true }); break;
        case 'LiveChat': navigation.navigate({ name: 'LiveChat', params: undefined, merge: true }); break;
        case 'TaxiManagement': break; // Already here
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
         <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="TaxiManagement" />
        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
           <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Manage My Taxi</Text>
                 <View style={styles.headerButton} />
           </View>
          {isLoading ? <Loading /> : (
            <FlatList
                data={taxis} keyExtractor={(item) => item._id} renderItem={renderTaxi}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={
                    <View style={styles.emptyListContainer}>
                        <Ionicons name="information-circle-outline" size={50} color="#888" />
                        <Text style={styles.emptyListText}>No taxis assigned to your account yet.</Text>
                        <Text style={styles.emptyListSubText}>You can add a taxi via your Profile screen.</Text>
                         <ActionButton title="Go to Profile" onPress={() => handleNavigate('Profile')} style={{marginTop: 20}}/>
                    </View>
                }
            />
          )}
          <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {selectedTaxi && (
                  <>
                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalVisible(false)}><Ionicons name="close-circle" size={30} color="#888" /></TouchableOpacity>
                    <Text style={styles.modalTitle}>Update: {selectedTaxi.numberPlate}</Text>
                    {!updateType && (
                      <View style={styles.optionContainer}>
                        <Text style={styles.optionTitle}>Select update type:</Text>
                        <View style={styles.optionButtons}>
                            <ActionButton title="Status" onPress={() => setUpdateType('status')} style={styles.modalOptionButton}/>
                            <ActionButton title="Stop" onPress={() => setUpdateType('stop')} style={styles.modalOptionButton}/>
                            <ActionButton title="Load" onPress={() => setUpdateType('load')} style={styles.modalOptionButton}/>
                        </View>
                      </View>
                    )}
                    {updateType === 'status' && (
                      <View style={styles.formGroup}>
                        <Text style={styles.modalLabel}>New Status:</Text>
                         <View style={styles.pickerContainer}><Picker selectedValue={newStatus} onValueChange={(itemValue) => setNewStatus(itemValue)} style={styles.pickerStyle}>{statusOptions.map((status) => ( <Picker.Item key={status} label={status} value={status} /> ))}</Picker></View>
                      </View>
                    )}
                    {updateType === 'stop' && (
                      <View style={styles.formGroup}>
                        <Text style={styles.modalLabel}>New Stop:</Text>
                         {isLoadingStops ? <View style={styles.loadingStopsContainer}><ActivityIndicator size="small" color="#003E7E" /><Text style={styles.loadingStopsText}>Loading stops...</Text></View>
                         : stopOptions.length > 0 ? <View style={styles.pickerContainer}><Picker selectedValue={newStop} onValueChange={(itemValue) => setNewStop(itemValue)} style={styles.pickerStyle}>{stopOptions.map((stop) => ( <Picker.Item key={stop} label={stop} value={stop} /> ))}</Picker></View>
                         : <Text style={styles.noStopsText}>No stops available for this route.</Text>}
                      </View>
                    )}
                    {updateType === 'load' && (
                      <View style={styles.formGroup}>
                        <Text style={styles.modalLabel}>New Load:</Text>
                        <TextInput style={styles.modalInput} keyboardType="numeric" value={newLoad} onChangeText={setNewLoad} placeholder="Enter current passenger count" placeholderTextColor="#aaa"/>
                         {selectedTaxi.maxLoad != null && <Text style={styles.maxLoadText}>Max Capacity: {selectedTaxi.maxLoad}</Text>}
                      </View>
                    )}
                    {updateType && (
                        <View style={styles.modalButtons}>
                            <ActionButton title="Back" onPress={() => setUpdateType(null)} color="#6c757d" style={styles.modalActionButton} />
                            <ActionButton title="Submit Update" onPress={handleUpdate} color="#007bff" style={styles.modalActionButton} />
                        </View>
                    )}
                  </>
                )}
              </View>
            </View>
          </Modal>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles --- (Copied and potentially adjusted styles from previous steps)
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  listContentContainer: { paddingHorizontal: 15, paddingVertical: 10, },
  taxiCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 15, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden', },
  taxiCardHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F0FE', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D0D8E8', },
  taxiCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, },
  taxiCardBody: { paddingHorizontal: 15, paddingVertical: 10, },
  taxiInfoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, },
  taxiInfoIcon: { marginRight: 8, width: 20, },
  taxiInfoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 75, },
  taxiInfoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1, },
   taxiCardFooter: { padding: 10, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 5, },
   updateButton: { paddingVertical: 8, paddingHorizontal: 15, },
   emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 50, },
   emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15, },
    emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5, },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContent: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, width: '90%', maxWidth: 400, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  modalCloseButton: { position: 'absolute', top: 10, right: 10, padding: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#003E7E', marginBottom: 25, textAlign: 'center' },
  optionContainer: { marginBottom: 20, alignItems: 'center' },
  optionTitle: { fontSize: 17, color: '#333', marginBottom: 15, fontWeight:'500' },
  optionButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  modalOptionButton: { flex: 1, marginHorizontal: 5, paddingVertical: 10 },
  formGroup: { marginBottom: 20 },
  modalLabel: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: '500' },
  modalInput: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 16, color: '#000000' },
  pickerContainer: { borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, backgroundColor: '#F8F8F8', overflow: 'hidden' },
  pickerStyle: { height: Platform.OS === 'ios' ? 120 : 50 },
  loadingStopsContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  loadingStopsText: { marginLeft: 10, color: '#555', fontSize: 15 },
  noStopsText: { color: '#888', fontStyle: 'italic', paddingVertical: 10 },
  maxLoadText: { fontSize: 13, color: '#666', marginTop: 4, textAlign: 'right' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 15 },
  modalActionButton: { flex: 0.48 },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10: 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },
   loadingGradient: { flex: 1 },
   loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
   loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default TaxiManagement;