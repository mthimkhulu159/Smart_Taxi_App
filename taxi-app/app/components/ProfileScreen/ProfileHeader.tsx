import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors'; // Adjust path as needed

interface ProfileHeaderProps {
    onToggleSidebar: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ onToggleSidebar }) => {
    return (
        <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={onToggleSidebar}>
                <Ionicons name="menu" size={32} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.headerButton} />{/* Placeholder for balance */}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.secondary,
    },
    headerTitle: {
        fontSize: 22,
        color: colors.primary,
        fontWeight: 'bold',
    },
    headerButton: {
        padding: 8,
    },
});

export default ProfileHeader;