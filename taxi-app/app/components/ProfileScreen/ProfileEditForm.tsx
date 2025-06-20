import React from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors'; // Adjust import path as needed

interface ProfileEditFormProps {
    name: string;
    setName: (name: string) => void;
    phone: string;
    setPhone: (phone: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
}

const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
    name,
    setName,
    phone,
    setPhone,
    onSave,
    onCancel,
    isSaving,
}) => {
    return (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Edit Account Details</Text>
            </View>
            <View style={styles.editingContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    placeholderTextColor="#aaa"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                />
                <View style={styles.editActionsContainer}>
                    <TouchableOpacity style={[styles.editActionButton, styles.cancelButton]} onPress={onCancel}>
                        <Text style={[styles.cancelButtonText]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.editActionButton, styles.saveButton]} onPress={onSave} disabled={isSaving}>
                        {isSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.saveButtonText]}>Save Changes</Text>}
                    </TouchableOpacity>
                </View>
            </View>
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    editingContainer: {
        // Add any specific styles for the editing container if needed
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
    editActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    editActionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: colors.secondary,
    },
    cancelButtonText: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: colors.primary,
    },
    saveButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ProfileEditForm;