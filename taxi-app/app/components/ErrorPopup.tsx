// src/components/ErrorPopup.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons'; // Make sure @expo/vector-icons is installed

// Basic Color Palette (Consider moving to a shared theme file later)
const defaultColors = {
    background: '#29335C', // Example background
    primaryAccent: '#007AFF',
    textPrimary: '#FFFFFF',
    error: '#FF3B30',
    buttonText: '#FFFFFF',
};

interface ErrorPopupProps {
    visible: boolean;
    message: string;
    onClose: () => void;
    colors?: Partial<typeof defaultColors>; // Allow overriding default colors
}

const ErrorPopup: React.FC<ErrorPopupProps> = ({
    visible,
    message,
    onClose,
    colors: propColors,
}) => {
    const colors = { ...defaultColors, ...propColors }; // Merge default and provided colors

    if (!visible) return null;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose} // Handles hardware back button on Android
        >
            <View style={popupStyles.centeredView}>
                <View style={[popupStyles.modalView, { backgroundColor: colors.background }]}>
                    <Feather name="alert-circle" size={30} color={colors.error} style={popupStyles.errorIcon} />
                    <Text style={[popupStyles.modalTitle, { color: colors.textPrimary }]}>Error</Text>
                    <Text style={[popupStyles.modalText, { color: colors.textPrimary }]}>{message || "An unexpected error occurred."}</Text>
                    <TouchableOpacity
                        style={[popupStyles.button, { backgroundColor: colors.primaryAccent }]}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Text style={[popupStyles.buttonText, { color: colors.buttonText }]}>OK</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Styles specific to the popup
const popupStyles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent background overlay
    },
    modalView: {
        margin: 20,
        borderRadius: 15,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '80%',
        maxWidth: 350,
    },
    errorIcon: {
        marginBottom: 15,
    },
    modalTitle: {
        marginBottom: 5,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
    },
    modalText: {
        marginBottom: 20,
        textAlign: 'center',
        fontSize: 16,
        lineHeight: 22,
    },
    button: {
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 30,
        elevation: 2,
        minWidth: 100,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

export default ErrorPopup;