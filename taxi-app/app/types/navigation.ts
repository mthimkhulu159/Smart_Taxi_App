// src/types/navigation.ts
export type RootStackParamList = {
    Home: { acceptedTaxiId?: string | undefined };
    requestRide: undefined;
    ViewTaxi: undefined;
    ViewRequests: undefined;
    ViewRoute: undefined;
    LiveChat: { chatSessionId: string }; // Make sure params match actual usage
    TaxiManagement: undefined;
    Profile: undefined;
    AcceptedRequest: undefined;
    AcceptedPassenger: undefined;
    Auth: undefined;
    TaxiFareCalculator: undefined
};
