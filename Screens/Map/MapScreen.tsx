import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
} from 'react-native';
import MapView, {
  Marker,
  Region,
  PROVIDER_GOOGLE,
  Callout,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../context/ThemeContext';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { RootStackParamList } from '../../types';

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface Business {
  id: string;
  name: string;
  description?: string;
  type: string;
  location: string;
  imageUrl?: string;
  ownerId?: string;
}

interface BusinessWithCoords extends Business {
  latitude: number;
  longitude: number;
  geocoded: boolean;
}

const DEFAULT_REGION: Region = {
  latitude: -26.2041, // Johannesburg default
  longitude: 28.0473,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

const GOOGLE_MAPS_API_KEY = 'AIzaSyDR5JhBnTT53KmUwNQI6QcWG5RjY5sdYRM';

export default function MapScreen() {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesWithCoords, setBusinessesWithCoords] = useState<BusinessWithCoords[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  // Request location permission and get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission',
            'Please enable location permissions to see businesses near you.'
          );
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation(location);

        const newRegion: Region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(newRegion);

        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      } catch (error) {
        console.error('Error getting location:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch businesses from Firestore
  useEffect(() => {
    const q = query(collection(db, 'businesses'), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Business[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Business, 'id'>),
        }));
        setBusinesses(fetched);
      },
      (error) => {
        console.error('Error fetching businesses:', error);
        Alert.alert('Error', 'Failed to load businesses');
      }
    );

    return () => unsubscribe();
  }, []);

  // Helper function to validate location string - strict validation for proper addresses
  const isValidLocation = (location: string): boolean => {
    if (!location || typeof location !== 'string') return false;
    const trimmed = location.trim();
    
    // Reject empty or very short strings
    if (trimmed.length < 10) return false;
    
    // Reject single numbers, single words, or gibberish
    if (/^\d+$/.test(trimmed)) return false; // Just numbers
    if (trimmed.split(/\s+/).length < 2) return false; // Single word
    
    // Reject common invalid patterns
    if (/^[a-zA-Z]{1,5}$/.test(trimmed)) return false; // Very short single words
    if (/^\d{1,4}$/.test(trimmed)) return false; // Just 1-4 digits
    
    // Must contain at least 2 words (e.g., "123 Main Street" or "Cape Town, South Africa")
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2) return false;
    
    // Must have some alphanumeric content (not just special characters)
    if (!/[a-zA-Z0-9]/.test(trimmed)) return false;
    
    return true;
  };

  // Geocode business locations (optimized for speed)
  useEffect(() => {
    if (businesses.length === 0) {
      setBusinessesWithCoords([]);
      setGeocoding(false);
      return;
    }

    const geocodeBusinesses = async () => {
      setGeocoding(true);
      
      // Filter and prepare businesses for geocoding
      const businessesToGeocode = businesses.filter((business) => {
        if (!business.location) return false;
        const locationStr = business.location.trim();
        return isValidLocation(locationStr);
      });

      if (businessesToGeocode.length === 0) {
        setBusinessesWithCoords([]);
        setGeocoding(false);
        return;
      }

      // Geocode in parallel batches (5 at a time to avoid rate limits)
      const BATCH_SIZE = 5;
      const geocoded: BusinessWithCoords[] = [];
      const geocodeCache = new Map<string, { lat: number; lng: number }>();

      // Process in batches
      for (let i = 0; i < businessesToGeocode.length; i += BATCH_SIZE) {
        const batch = businessesToGeocode.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (business) => {
          const locationStr = business.location.trim();

          // Check cache first
          if (geocodeCache.has(locationStr)) {
            const cached = geocodeCache.get(locationStr)!;
            return {
              ...business,
              latitude: cached.lat,
              longitude: cached.lng,
              geocoded: true,
            };
          }

          try {
            // Use Google Geocoding API
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                locationStr
              )}&key=${GOOGLE_MAPS_API_KEY}`
            );

            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
              const location = data.results[0].geometry.location;
              const coords = { lat: location.lat, lng: location.lng };
              
              // Double-check coordinates are valid
              if (!coords.lat || !coords.lng || isNaN(coords.lat) || isNaN(coords.lng)) {
                return null; // Invalid coordinates
              }
              
              // Cache the result
              geocodeCache.set(locationStr, coords);
              
              return {
                ...business,
                latitude: coords.lat,
                longitude: coords.lng,
                geocoded: true,
              };
            } else if (data.status === 'OVER_QUERY_LIMIT') {
              console.error('Geocoding API quota exceeded');
              Alert.alert('Error', 'Geocoding service limit reached. Please try again later.');
              return null;
            }
            // Skip businesses that can't be geocoded (ZERO_RESULTS, INVALID_REQUEST, etc.)
            return null;
          } catch (error) {
            return null; // Skip on error
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter((result): result is BusinessWithCoords => result !== null);
        geocoded.push(...validResults);

        // Update state incrementally for better UX
        if (geocoded.length > 0) {
          setBusinessesWithCoords([...geocoded]);
        }

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < businessesToGeocode.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setBusinessesWithCoords(geocoded);
      setGeocoding(false);

      // Fit map to show all businesses and user location (only if we have geocoded businesses)
      // If no businesses geocoded, just center on user location
      if (mapRef.current) {
        if (geocoded.length > 0) {
          const coordinates = geocoded.map((b) => ({
            latitude: b.latitude,
            longitude: b.longitude,
          }));

          if (userLocation) {
            coordinates.push({
              latitude: userLocation.coords.latitude,
              longitude: userLocation.coords.longitude,
            });
          }

          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
            animated: true,
          });
        } else if (userLocation) {
          // If no businesses, just center on user
          const newRegion: Region = {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }
    };

    geocodeBusinesses();
  }, [businesses, userLocation]);

  const handleMarkerPress = (business: BusinessWithCoords) => {
    navigation.navigate('ShopScreen', {
      businessId: business.id,
      businessName: business.name,
    });
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      const newRegion: Region = {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
      >
        {/* User location marker (if available) */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.coords.latitude,
              longitude: userLocation.coords.longitude,
            }}
            title="Your Location"
            pinColor={colors.primary}
          />
        )}

        {/* Business markers */}
        {businessesWithCoords.map((business) => (
          <Marker
            key={business.id}
            coordinate={{
              latitude: business.latitude,
              longitude: business.longitude,
            }}
            title={business.name}
            description={business.type}
            onPress={() => handleMarkerPress(business)}
          >
            {business.imageUrl ? (
              <View style={localStyles.markerContainer}>
                <View style={[localStyles.markerImageContainer, { borderColor: colors.primary }]}>
                  <Image
                    source={{ uri: business.imageUrl }}
                    style={localStyles.markerImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={[localStyles.markerPin, { backgroundColor: colors.primary }]} />
              </View>
            ) : (
              <View style={[localStyles.defaultMarker, { backgroundColor: colors.primary }]}>
                <Ionicons name="business" size={20} color="#FFFFFF" />
              </View>
            )}
            <Callout onPress={() => handleMarkerPress(business)}>
              <View style={[localStyles.calloutContainer, { backgroundColor: colors.cardBackground }]}>
                {business.imageUrl && (
                  <Image
                    source={{ uri: business.imageUrl }}
                    style={localStyles.calloutImage}
                    resizeMode="cover"
                  />
                )}
                <Text style={[localStyles.calloutTitle, { color: colors.text }]} numberOfLines={1}>
                  {business.name}
                </Text>
                <Text style={[localStyles.calloutType, { color: colors.textSecondary }]} numberOfLines={1}>
                  {business.type}
                </Text>
                {business.description && (
                  <Text style={[localStyles.calloutDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                    {business.description}
                  </Text>
                )}
                <Text style={[localStyles.calloutTap, { color: colors.primary }]}>
                  Tap to view
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Loading overlay - only show for initial map load, not geocoding */}
      {loading && (
        <View style={localStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[localStyles.loadingText, { color: colors.text }]}>
            Loading map...
          </Text>
        </View>
      )}

      {/* Subtle geocoding indicator */}
      {geocoding && !loading && (
        <View style={localStyles.geocodingIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[localStyles.geocodingText, { color: colors.textSecondary }]}>
            Loading businesses...
          </Text>
        </View>
      )}

      {/* Info card - show even while geocoding */}
      {!loading && (
        <View style={[localStyles.infoCard, { backgroundColor: colors.cardBackground }]}>
          <View style={localStyles.infoRow}>
            <Ionicons name="business-outline" size={20} color={colors.primary} />
            <Text style={[localStyles.infoText, { color: colors.text }]}>
              {geocoding 
                ? `Loading... ${businessesWithCoords.length} found`
                : `${businessesWithCoords.length} ${businessesWithCoords.length === 1 ? 'business' : 'businesses'} nearby`
              }
            </Text>
          </View>
        </View>
      )}

      {/* Center on user button */}
      {userLocation && (
        <TouchableOpacity
          style={[localStyles.centerButton, { backgroundColor: colors.primary }]}
          onPress={centerOnUser}
        >
          <Ionicons name="locate" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerImage: {
    width: '100%',
    height: '100%',
  },
  markerPin: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  defaultMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutContainer: {
    width: 200,
    padding: 10,
    borderRadius: 8,
  },
  calloutImage: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  calloutType: {
    fontSize: 12,
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 12,
    marginBottom: 4,
  },
  calloutTap: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  geocodingIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  geocodingText: {
    fontSize: 12,
  },
  infoCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  centerButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
