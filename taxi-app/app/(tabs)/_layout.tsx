import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AuthScreen from './Auth';
import Home from './index';
import ProfileScreen from './Profile';
import { View, Text } from 'react-native';
import { useAuth } from '../context/authContext';
import ViewTaxi from './ViewTaxi';
import RideRequestScreen from './rideRequest';
import TaxiManagementScreen from './taxiManagement';
import LiveChatScreen from './LiveChat';
import AcceptedPassengersScreen from './AcceptedPassenger';
import AcceptedRequestsScreen from './AcceptedRequests';
import ViewRequestScreen from './ViewRequests';
import ViewRoute from './ViewRoute';
import ForgotPassword from './ForgotPassword';
import TaxiFareCalculator from './TaxiFareCalculator';
const Stack = createStackNavigator();

export default function TabLayout() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Home"
            component={Home}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
           name='AcceptedRequest'
           component={AcceptedRequestsScreen}
           options={{headerShown: false}}
          />
         <Stack.Screen
           name='AcceptedPassenger'
           component={AcceptedPassengersScreen}
           options={{headerShown: false}}
          />
      
          <Stack.Screen
          name="ViewTaxi"
          component={ViewTaxi}
          options={{headerShown: false}}
          />  
          
          <Stack.Screen
          name="ViewRoute"
          component={ViewRoute}
          options={{headerShown: false}}
          />
          <Stack.Screen
           name="requestRide"
           component={RideRequestScreen}
           options={{headerShown: false}}
          />
          <Stack.Screen
          name='TaxiFareCalculator'
          component={TaxiFareCalculator}
          options={{headerShown: false}}
          />
                  <Stack.Screen
          name='TaxiManagement'
          component={TaxiManagementScreen}
          options={{headerShown: false}}
          />
          <Stack.Screen
            name="LiveChat"
            component={LiveChatScreen}
            options={{headerShown: false}}
            />
            <Stack.Screen
            name='ViewRequests'
            component={ViewRequestScreen}
            options={{headerShown: false}}
            />
        </>
      ) : (
        <>
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
        name="ForgotPassword"
        component={ForgotPassword}
        options={{ headerShown: false }}
      />
      </>
      )}
    </Stack.Navigator>
  );
}
