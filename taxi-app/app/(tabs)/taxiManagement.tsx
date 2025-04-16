import React, { useEffect, useState, useRef, useCallback, FC } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, Modal, StyleSheet,
    TextInput, Alert, Animated, ScrollView, SafeAreaView, Platform,
    ActivityIndicator, ViewStyle, TextStyle
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
// --- Constants ---

// --- Types and Interfaces ---
type Taxi = {
    _id: string;
    numberPlate: string;
    status: string;
    currentStop: string;
    currentLoad: number;
    capacity?: number; // Use 'capacity' for consistency if backend uses it
    routeName?: string;
    driverId?: string;
    updatedAt?: string;
};

type Stop = {
    name: string;
    order: number;
};

type UpdateType = 'status' | 'stop' | 'load' | null;

const statusOptions = [
    'waiting', 'available', 'roaming', 'almost full', 'full', 'on trip', 'not available',
];

// --- Navigation Types ---
// Ensure this EXACTLY matches the definition used across your app
type RootStackParamList = {
    Home: { acceptedTaxiId?: string | undefined }; // Make sure optional is | undefined
    requestRide: undefined;
    ViewTaxi: undefined;
    ViewRequests: undefined;
    ViewRoute: undefined;
    LiveChat: undefined; // Assuming undefined params for now
    TaxiManagement: undefined; // Current screen
    Profile: undefined;
    AcceptedRequest: undefined;
    AcceptedPassenger: undefined;
    Auth: undefined;
    TaxiFareCalculator: undefined
};
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
    const [taxis, setTaxis] = useState<Taxi[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [selectedTaxi, setSelectedTaxi] = useState<Taxi | null>(null);
    const [updateType, setUpdateType] = useState<UpdateType>(null);
    const [newStatus, setNewStatus] = useState<string>(statusOptions[0]);
    const [newStop, setNewStop] = useState<string>('');
    const [newLoad, setNewLoad] = useState<string>('0');
    const [stopOptions, setStopOptions] = useState<string[]>([]);
    const [isLoadingStops, setIsLoadingStops] = useState<boolean>(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const isMountedRef = useRef(true);

    const navigation = useNavigation<TaxiManagementNavigationProp>();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // --- Fetch User ID and Taxis ---
    const loadInitialData = useCallback(async () => {
        if (!isMountedRef.current) return;
        setIsLoading(true);
        let fetchedUserId: string | null = null;
        try {
            const token = await getToken();
            if (!token) { Alert.alert('Authentication Error', 'Please login.'); if (isMountedRef.current) setIsLoading(false); return; }
            try {
                const userData = await fetchData(apiUrl, 'api/users/get-user', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
                if (userData?.user?._id && isMountedRef.current) { fetchedUserId = userData.user._id; setUserId(fetchedUserId); console.log("TM: User ID fetched:", fetchedUserId); }
                else if (isMountedRef.current) { console.error("TM: Failed to get user ID."); Alert.alert('Error', 'Could not verify user identity.'); }
            } catch (userError: any) { console.error("TM: Error fetching user:", userError); if (isMountedRef.current) Alert.alert('Error', 'Could not fetch user details.'); }
            const taxiData = await fetchData(apiUrl, 'api/taxis/driver-taxi', { headers: { Authorization: `Bearer ${token}` } });
            if (taxiData?.taxis && isMountedRef.current) { setTaxis(taxiData.taxis); }
            else if (isMountedRef.current) { setTaxis([]); console.log('No taxis assigned.'); }
        } catch (error: any) { if (isMountedRef.current) { setTaxis([]); Alert.alert('Error', `Failed to load data: ${error.message || 'Unknown error'}`); } console.error(error); }
        finally { if (isMountedRef.current) setIsLoading(false); }
    }, []);

    // --- Socket Connection Effect ---
    useEffect(() => {
        if (!userId) { console.log("TM: Socket waiting for userId..."); return; }
        if (socketRef.current) { console.log("TM: Socket ref already exists."); return; }
        console.log('TM: Setting up socket...');
        const newSocket = io(apiUrl, { transports: ['websocket'], reconnectionAttempts: 5, timeout: 10000 });
        socketRef.current = newSocket;
        newSocket.on('connect', () => { console.log('TM: Socket connected', newSocket.id); if (userId) { console.log(`TM: Emitting authenticate for ${userId}`); newSocket.emit('authenticate', userId); } else { console.error("TM: Auth failed - userId missing at connect."); } });
        newSocket.on('disconnect', (reason: string) => { console.log('TM: Socket disconnected', reason); });
        newSocket.on('connect_error', (err: Error) => console.log('TM: Socket connect error:', err.message));
        newSocket.on('taxiUpdate', (updatedTaxi: Taxi) => { if (isMountedRef.current) { setTaxis(currentTaxis => currentTaxis.map(taxi => taxi._id === updatedTaxi._id ? { ...taxi, ...updatedTaxi } : taxi)); } });
        return () => { if (socketRef.current) { console.log('TM: Cleaning up socket.'); socketRef.current.removeAllListeners(); socketRef.current.disconnect(); socketRef.current = null; } };
    }, [userId]);

    // --- Initial Data Load Effect ---
    useEffect(() => { isMountedRef.current = true; loadInitialData(); return () => { isMountedRef.current = false; } }, [loadInitialData]);

    // --- Animation Effect ---
    useEffect(() => { if (!isLoading && isMountedRef.current) { Animated.parallel([ Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }), ]).start(); } }, [isLoading, fadeAnim, slideAnim]);

    // --- Fetch Stops for Selected Taxi ---
    const fetchStopsForTaxi = useCallback(async (taxiId: string) => {
        if (!isMountedRef.current || !selectedTaxi || selectedTaxi._id !== taxiId) return;
        setIsLoadingStops(true); setStopOptions([]);
        try {
            const token = await getToken(); if (!token) throw new Error('Authentication required.');
            const data = await fetchData(apiUrl, `api/taxis/${taxiId}/stops`, { headers: { Authorization: `Bearer ${token}` } });
            if (data?.stops && isMountedRef.current) {
                const sortedStops = data.stops.sort((a: Stop, b: Stop) => a.order - b.order || a.name.localeCompare(b.name));
                const names = sortedStops.map((stop: Stop) => stop.name); setStopOptions(names);
                const currentSelectedTaxi = selectedTaxi; const currentStopExists = names.includes(currentSelectedTaxi?.currentStop || '');
                const initialStop = currentStopExists ? (currentSelectedTaxi?.currentStop ?? names[0] ?? '') : (names[0] ?? ''); setNewStop(initialStop);
            } else { if (isMountedRef.current) { setStopOptions([]); setNewStop(''); } }
        } catch (error: any) { console.error('Error fetching stops:', error.message); if (isMountedRef.current) { setStopOptions([]); setNewStop(''); } Alert.alert('Error', `Failed to load stops: ${error.message}`); }
        finally { if (isMountedRef.current) setIsLoadingStops(false); }
    }, [selectedTaxi]);

    // --- Modal Open Effect for Fetching Stops ---
    useEffect(() => { if (modalVisible && updateType === 'stop' && selectedTaxi?._id) { fetchStopsForTaxi(selectedTaxi._id); } }, [modalVisible, updateType, selectedTaxi, fetchStopsForTaxi]);

    // --- Modal Trigger ---
    const handleActionPress = (taxi: Taxi) => { setSelectedTaxi(taxi); setUpdateType(null); setNewStatus(taxi.status || statusOptions[0]); setNewLoad(taxi.currentLoad?.toString() ?? '0'); setNewStop(taxi.currentStop || ''); setStopOptions([]); setIsLoadingStops(false); setIsSubmitting(false); setModalVisible(true); };

    // --- Handle API Update (No Client-Side Socket Emission) ---
    const handleUpdate = async () => {
        if (!selectedTaxi || !updateType || isSubmitting) return;
        setIsSubmitting(true); let endpoint = ''; let body = {}; let optimisticUpdateData = {};
        try {
            if (updateType === 'status') { if (!newStatus) throw new Error('Select status.'); endpoint = `api/taxis/${selectedTaxi._id}/status`; body = { status: newStatus }; optimisticUpdateData = { status: newStatus }; }
            else if (updateType === 'stop') { if (!newStop) throw new Error('Select stop.'); endpoint = `api/taxis/${selectedTaxi._id}/currentStopManual`; body = { currentStop: newStop }; optimisticUpdateData = { currentStop: newStop }; }
            else if (updateType === 'load') {
                const parsedLoad = parseInt(newLoad, 10); if (isNaN(parsedLoad) || parsedLoad < 0) throw new Error('Invalid load.');
                if (selectedTaxi.capacity != null && parsedLoad > selectedTaxi.capacity) throw new Error(`Load exceeds capacity (${selectedTaxi.capacity}).`);
                endpoint = `api/taxis/${selectedTaxi._id}/load`; body = { currentLoad: parsedLoad }; optimisticUpdateData = { currentLoad: parsedLoad };
            } else { throw new Error("Invalid update type."); }
            const token = await getToken(); if (!token) throw new Error('Auth required.');
            const response = await fetchData(apiUrl, endpoint, { method: 'PUT', body, headers: { Authorization: `Bearer ${token}` } });
            if (isMountedRef.current) {
                setTaxis(prevTaxis => prevTaxis.map(t => t._id === selectedTaxi._id ? { ...t, ...optimisticUpdateData } : t));
                Alert.alert('Success', response.message || 'Update sent!'); setModalVisible(false);
            }
        } catch (error: any) { if (isMountedRef.current) { Alert.alert('Update Error', error.message || 'Update failed.'); } console.error(error); }
        finally { if (isMountedRef.current) setIsSubmitting(false); }
    };

    // --- Status Styling Helper ---
    const getStatusStyle = (status: string): TextStyle => {
        switch (status?.toLowerCase()) {
            case 'available': return { color: '#28a745', fontWeight: 'bold' };
            case 'full': case 'not available': return { color: '#dc3545', fontWeight: 'bold' };
            case 'almost full': case 'on trip': case 'roaming': return { color: '#ffc107', fontWeight: 'bold' };
            case 'waiting': return { color: '#007bff', fontWeight: 'bold' };
            default: return { color: '#6c757d'};
        }
    };

    // --- Render Taxi Card ---
    const renderTaxi = ({ item }: { item: Taxi }) => (
        <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.taxiCard}>
                <View style={styles.taxiCardHeader}>
                    <MaterialIcons name="local-taxi" size={24} color="#003E7E" />
                    <Text style={styles.taxiCardTitle}>{item.numberPlate}</Text>
                </View>
                <View style={styles.taxiCardBody}>
                    <View style={styles.taxiInfoRow}><Ionicons name="flag-outline" size={18} color="#555" style={styles.taxiInfoIcon}/><Text style={styles.taxiInfoLabel}>Status:</Text><Text style={[styles.taxiInfoValue, getStatusStyle(item.status)]}>{item.status || 'N/A'}</Text></View>
                    <View style={styles.taxiInfoRow}><Ionicons name="location-outline" size={18} color="#555" style={styles.taxiInfoIcon}/><Text style={styles.taxiInfoLabel}>Location:</Text><Text style={styles.taxiInfoValue} numberOfLines={1} ellipsizeMode='tail'>{item.currentStop || 'N/A'}</Text></View>
                    <View style={styles.taxiInfoRow}><Ionicons name="people-outline" size={18} color="#555" style={styles.taxiInfoIcon}/><Text style={styles.taxiInfoLabel}>Load:</Text><Text style={styles.taxiInfoValue}>{item.currentLoad ?? 'N/A'}{item.capacity != null ? ` / ${item.capacity}` : ''}</Text></View>
                </View>
                <View style={styles.taxiCardFooter}>
                    <ActionButton title="Update Info" onPress={() => handleActionPress(item)} iconName="create-outline" iconFamily='Ionicons' style={styles.updateButton} disabled={isSubmitting} />
                </View>
            </View>
        </Animated.View>
    );

    // --- Navigation and Sidebar ---
    // ***** FIX APPLIED HERE *****
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        // Pass object with name and explicit params matching RootStackParamList
        switch (screen) {
            case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined } }); break; // Pass expected params object
            case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined }); break; // Explicit params: undefined
            case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined }); break; // Explicit params: undefined
            case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined }); break; // Explicit params: undefined
            case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: undefined }); break; // Explicit params: undefined
            case 'LiveChat': navigation.navigate({ name: 'LiveChat', params: undefined }); break; // Explicit params: undefined
            case 'TaxiFareCalculator': navigation.navigate({ name: 'TaxiFareCalculator', params: undefined, merge: true }); break;
            case 'TaxiManagement': break; // Do nothing
            case 'Profile': navigation.navigate({ name: 'Profile', params: undefined }); break; // Explicit params: undefined
            case 'AcceptedRequest': navigation.navigate({ name: 'AcceptedRequest', params: undefined }); break; // Explicit params: undefined
            case 'AcceptedPassenger': navigation.navigate({ name: 'AcceptedPassenger', params: undefined }); break; // Explicit params: undefined
            case 'Auth': navigation.navigate({ name: 'Auth', params: undefined }); break; // Explicit params: undefined
            default: console.warn(`Navigating to unhandled screen: ${screen}`); break;
        }
    };
    const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

    // --- Render Logic ---
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="TaxiManagement" />
                <Animated.View style={[styles.mainContainer]}>
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                            <Ionicons name="menu" size={32} color="#003E7E" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Manage My Taxis</Text>
                        <View style={styles.headerButton} />
                    </View>

                    {isLoading ? ( <Loading /> ) : (
                        <FlatList
                            data={taxis}
                            keyExtractor={(item) => item._id}
                            renderItem={renderTaxi}
                            contentContainerStyle={styles.listContentContainer}
                            ListEmptyComponent={
                                <View style={styles.emptyListContainer}>
                                    <Ionicons name="car-sport-outline" size={50} color="#888" />
                                    <Text style={styles.emptyListText}>No taxis assigned.</Text>
                                    <Text style={styles.emptyListSubText}>Add a taxi via your Profile.</Text>
                                    <ActionButton title="Go to Profile" onPress={() => handleNavigate('Profile')} style={{marginTop: 20}}/>
                                </View>
                            }
                        />
                    )}

                    {/* --- Modal --- */}
                    <Modal
                        animationType="fade"
                        transparent={true}
                        visible={modalVisible}
                        onRequestClose={() => {if (!isSubmitting) setModalVisible(false);}}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                {selectedTaxi && (
                                    <>
                                        <TouchableOpacity style={styles.modalCloseButton} onPress={() => {if (!isSubmitting) setModalVisible(false);}}>
                                            <Ionicons name="close-circle" size={30} color="#888" />
                                        </TouchableOpacity>
                                        <Text style={styles.modalTitle}>Update: {selectedTaxi.numberPlate}</Text>

                                        {!updateType && ( /* Update Type Selection */
                                            <View style={styles.optionContainer}>
                                                <Text style={styles.optionTitle}>Select update type:</Text>
                                                <View style={styles.optionButtons}>
                                                    <ActionButton title="Status" onPress={() => setUpdateType('status')} style={styles.modalOptionButton} iconName="flag-outline" iconFamily="Ionicons"/>
                                                    <ActionButton title="Stop" onPress={() => setUpdateType('stop')} style={styles.modalOptionButton} iconName="location-outline" iconFamily="Ionicons"/>
                                                    <ActionButton title="Load" onPress={() => setUpdateType('load')} style={styles.modalOptionButton} iconName="people-outline" iconFamily="Ionicons"/>
                                                </View>
                                            </View>
                                        )}
                                        {updateType === 'status' && ( /* Status Form */
                                            <View style={styles.formGroup}><Text style={styles.modalLabel}>New Status:</Text><View style={styles.pickerContainer}><Picker selectedValue={newStatus} onValueChange={setNewStatus} style={styles.pickerStyle} itemStyle={styles.pickerItemStyle}>{statusOptions.map(s => <Picker.Item key={s} label={s} value={s} />)}</Picker></View></View>
                                        )}
                                        {updateType === 'stop' && ( /* Stop Form */
                                            <View style={styles.formGroup}><Text style={styles.modalLabel}>New Stop:</Text>{isLoadingStops ? <View style={styles.loadingStopsContainer}><ActivityIndicator/><Text style={styles.loadingStopsText}>Loading...</Text></View> : stopOptions.length > 0 ? <View style={styles.pickerContainer}><Picker selectedValue={newStop} onValueChange={setNewStop} style={styles.pickerStyle} itemStyle={styles.pickerItemStyle}>{stopOptions.map(s => <Picker.Item key={s} label={s} value={s}/>)}</Picker></View> : <Text style={styles.noStopsText}>No stops.</Text>}</View>
                                        )}
                                        {updateType === 'load' && ( /* Load Form */
                                            <View style={styles.formGroup}><Text style={styles.modalLabel}>Current Load:</Text><TextInput style={styles.modalInput} keyboardType="numeric" value={newLoad} onChangeText={setNewLoad} placeholder="Count" placeholderTextColor="#aaa"/>{selectedTaxi.capacity != null && <Text style={styles.maxLoadText}>Max: {selectedTaxi.capacity}</Text>}</View>
                                        )}
                                        {updateType && ( /* Action Buttons */
                                            <View style={styles.modalButtons}>
                                                <ActionButton title="Back" onPress={() => setUpdateType(null)} color="#6c757d" style={styles.modalActionButton} disabled={isSubmitting} />
                                                <ActionButton title="Submit Update" onPress={handleUpdate} color="#007bff" style={styles.modalActionButton} loading={isSubmitting} disabled={isSubmitting || (updateType === 'stop' && isLoadingStops)} />
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

// --- Styles ---
const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    mainContainer: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%', backgroundColor: '#FFFFFF', borderBottomColor: '#DDD', borderBottomWidth: 1 },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#003E7E' },
    listContentContainer: { paddingHorizontal: 15, paddingVertical: 10, paddingBottom: 60 },
    taxiCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 15, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden', },
    taxiCardHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F0FE', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D0D8E8', },
    taxiCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, },
    taxiCardBody: { paddingHorizontal: 15, paddingVertical: 10, },
    taxiInfoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, },
    taxiInfoIcon: { marginRight: 8, width: 20, textAlign: 'center' },
    taxiInfoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 75, },
    taxiInfoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1, },
    taxiCardFooter: { padding: 10, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 5, },
    updateButton: { paddingVertical: 8, paddingHorizontal: 15, },
    emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 50, },
    emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15, },
    emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5, },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
    modalContent: { backgroundColor: '#FFF', padding: 25, borderRadius: 15, width: '90%', maxWidth: 400, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
    modalCloseButton: { position: 'absolute', top: 10, right: 10, padding: 5, zIndex: 1 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#003E7E', marginBottom: 25, textAlign: 'center' },
    optionContainer: { marginBottom: 20, alignItems: 'center' },
    optionTitle: { fontSize: 17, color: '#333', marginBottom: 15, fontWeight:'500' },
    optionButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
    modalOptionButton: { flex: 1, marginHorizontal: 5, paddingVertical: 10 },
    formGroup: { marginBottom: 20 },
    modalLabel: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: '500' },
    modalInput: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 16, color: '#000000' },
    pickerContainer: { borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 8, backgroundColor: '#F8F8F8', overflow: 'hidden', justifyContent: 'center' },
    pickerStyle: { height: Platform.OS === 'ios' ? 'auto' : 50, backgroundColor: 'transparent' },
    pickerItemStyle: { height: Platform.OS === 'ios' ? 120 : 'auto', color: '#000000' },
    loadingStopsContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, justifyContent: 'center' },
    loadingStopsText: { marginLeft: 10, color: '#555', fontSize: 15 },
    noStopsText: { color: '#888', fontStyle: 'italic', paddingVertical: 10, textAlign: 'center' },
    maxLoadText: { fontSize: 13, color: '#666', marginTop: 4, textAlign: 'right' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 15 },
    modalActionButton: { flex: 0.48 },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 8 },
    actionButtonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
    actionButtonDisabled: { backgroundColor: '#B0B0B0', elevation: 0, shadowOpacity: 0 },
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10: 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },
    loadingGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingContainerInternal: { justifyContent: 'center', alignItems: 'center' },
    loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default TaxiManagement;