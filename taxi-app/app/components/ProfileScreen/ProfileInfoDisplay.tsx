import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/userProfile'; // Adjust import path as needed
import { colors } from '../../constants/colors'; // Adjust import path as needed

interface InfoRowProps {
    label: string;
    value: string | undefined | string[];
    iconName: keyof typeof Ionicons.glyphMap | keyof typeof MaterialIcons.glyphMap | keyof typeof FontAwesome.glyphMap;
    iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome';
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, iconName, iconFamily = 'Ionicons' }) => {
    const IconComponent =
        iconFamily === 'MaterialIcons'
            ? MaterialIcons
            : iconFamily === 'FontAwesome'
            ? FontAwesome
            : Ionicons;
    const displayValue = Array.isArray(value) ? value.join(', ') : value;

    return (
        <View style={styles.infoRow}>
            <IconComponent name={iconName as any} size={20} color={colors.primary} style={styles.infoIcon} />
            <Text style={styles.infoLabel}>{label}:</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
                {displayValue || 'Not set'}
            </Text>
        </View>
    );
};

interface ProfileInfoDisplayProps {
    user: UserProfile;
    onEditPress: () => void;
}

const ProfileInfoDisplay: React.FC<ProfileInfoDisplayProps> = ({ user, onEditPress }) => {
    return (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Account Details</Text>
                <TouchableOpacity style={styles.editButtonInline} onPress={onEditPress}>
                    <FontAwesome name="pencil" size={16} color={colors.primary} />
                    <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.infoContainer}>
                <InfoRow label="Name" value={user.name} iconName="person-outline" />
                <InfoRow label="Email" value={user.email} iconName="mail-outline" />
                <InfoRow label="Phone" value={user.phone} iconName="call-outline" />
                <InfoRow label="Roles" value={user.role} iconName="shield-checkmark-outline" />
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
        color: colors.text,
    },
    editButtonInline: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
    },
    editButtonText: {
        marginLeft: 5,
        color: colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    infoContainer: {
        // paddingHorizontal: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoIcon: {
        marginRight: 10,
        width: 24, // Fixed width for alignment
        textAlign: 'center',
    },
    infoLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primaryText,
        minWidth: 60, // Ensure label takes enough space
    },
    infoValue: {
        fontSize: 16,
        color: colors.text,
        flexShrink: 1, // Allow text to shrink and wrap
    },
});

export default ProfileInfoDisplay;