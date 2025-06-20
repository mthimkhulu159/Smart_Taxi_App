import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActionButton from '../common/ActionButton'; // Adjust path as needed
import { colors } from '../../constants/colors'; // Adjust path as needed

interface AddTaxiFormProps {
    isTaxiFormVisible: boolean;
    onToggleVisibility: () => void;
    numberPlate: string;
    setNumberPlate: (text: string) => void;
    capacity: string;
    setCapacity: (text: string) => void;
    currentStop: string;
    setCurrentStop: (text: string) => void;
    routeName: string;
    setRouteName: (text: string) => void;
    allowReturnPickups: boolean;
    setAllowReturnPickups: (value: boolean) => void;
    onAddTaxi: () => void;
    isAddingTaxi: boolean;
}

const AddTaxiForm: React.FC<AddTaxiFormProps> = ({
    isTaxiFormVisible,
    onToggleVisibility,
    numberPlate,
    setNumberPlate,
    capacity,
    setCapacity,
    currentStop,
    setCurrentStop,
    routeName,
    setRouteName,
    allowReturnPickups,
    setAllowReturnPickups,
    onAddTaxi,
    isAddingTaxi,
}) => {
    return (
        <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.addTaxiHeader} onPress={onToggleVisibility}>
                <Text style={styles.sectionTitle}>Register New Taxi</Text>
                <Ionicons name={isTaxiFormVisible ? 'chevron-up' : 'chevron-down'} size={24} color={colors.primary} />
            </TouchableOpacity>
            {isTaxiFormVisible && (
                <View style={styles.taxiFormContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Number Plate *"
                        placeholderTextColor="#aaa"
                        value={numberPlate}
                        onChangeText={setNumberPlate}
                        autoCapitalize="characters"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Capacity *"
                        placeholderTextColor="#aaa"
                        value={capacity}
                        keyboardType="numeric"
                        onChangeText={setCapacity}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Current Stop / Rank *"
                        placeholderTextColor="#aaa"
                        value={currentStop}
                        onChangeText={setCurrentStop}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Primary Route Name *"
                        placeholderTextColor="#aaa"
                        value={routeName}
                        onChangeText={setRouteName}
                    />
                    <View style={styles.switchContainer}>
                        <Text style={styles.switchLabel}>Allow Return Pickups</Text>
                        <Switch
                            trackColor={{ false: colors.secondary, true: colors.primaryAccent }}
                            thumbColor={allowReturnPickups ? colors.primary : colors.white}
                            ios_backgroundColor={colors.secondary}
                            onValueChange={setAllowReturnPickups}
                            value={allowReturnPickups}
                        />
                    </View>
                    <ActionButton
                        title="Register Taxi"
                        onPress={onAddTaxi}
                        iconName="add-circle-outline"
                        loading={isAddingTaxi}
                        style={{ marginTop: 10 }}
                        disabled={isAddingTaxi}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: colors.white,
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    addTaxiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    taxiFormContainer: {
        marginTop: 15,
        // Potentially add slide animation here using Animated.View
    },
    input: {
        backgroundColor: colors.inputBackground,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 15,
        fontSize: 16,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.borderColor,
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    switchLabel: {
        fontSize: 16,
        color: colors.textPrimary,
    },
});

export default AddTaxiForm;