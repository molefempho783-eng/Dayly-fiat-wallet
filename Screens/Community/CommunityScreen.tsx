// Screens/Communities/CommunityScreen.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
  Dimensions, // Added Dimensions
  RefreshControl,
  ScrollView,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList, Community } from "../../types";
import { collection, getDocs, doc, getDoc } from "firebase/firestore"; // Added doc, getDoc
import { db, auth } from "../../firebaseConfig"; // Added auth
import { useTheme } from '../context/ThemeContext';
import createStyles, { FONT_SIZES } from '../context/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from "firebase/auth"; // Added
import * as Location from 'expo-location'; 
import { TabView, SceneMap, TabBar } from 'react-native-tab-view'; // Added
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_COMMUNITY_LOGO = require("../../assets/community-placeholder.png");

type NavigationProp = StackNavigationProp<RootStackParamList, "ChatScreen">;

interface CommunityListItem extends Community {
  id: string;
}

const CommunityScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const styles = createStyles(colors).communityScreen;
  const globalStyles = createStyles(colors).global;

  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userCity, setUserCity] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<string[]>([]); 
  
  // State for tabs
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [routes, setRoutes] = useState([{ key: 'explore', title: 'Explore' }]);

  // Cache key for communities
  const COMMUNITIES_CACHE_KEY = "cached_communities";
  const COMMUNITIES_CACHE_TIMESTAMP_KEY = "cached_communities_timestamp";
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Helper: Load from cache
  const loadFromCache = async (): Promise<CommunityListItem[] | null> => {
    try {
      const [cachedData, timestamp] = await Promise.all([
        AsyncStorage.getItem(COMMUNITIES_CACHE_KEY),
        AsyncStorage.getItem(COMMUNITIES_CACHE_TIMESTAMP_KEY),
      ]);
      
      if (cachedData && timestamp) {
        const cacheAge = Date.now() - parseInt(timestamp, 10);
        if (cacheAge < CACHE_DURATION) {
          return JSON.parse(cachedData);
        }
      }
    } catch (err) {
      console.error("Error loading from cache:", err);
    }
    return null;
  };

  // Helper: Save to cache
  const saveToCache = async (data: CommunityListItem[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(COMMUNITIES_CACHE_KEY, JSON.stringify(data)),
        AsyncStorage.setItem(COMMUNITIES_CACHE_TIMESTAMP_KEY, Date.now().toString()),
      ]);
    } catch (err) {
      console.error("Error saving to cache:", err);
    }
  };

  // Helper: Fetch with timeout and retry
  const fetchWithTimeout = async (timeoutMs: number = 8000) => {
    const fetchPromise = getDocs(collection(db, "communities"));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    );
    return Promise.race([fetchPromise, timeoutPromise]);
  };

  // Fetch communities function (reusable for refresh)
  const fetchCommunities = useCallback(async (skipCache: boolean = false) => {
    if (!skipCache) {
      setLoading(true);
    }
    setError(null);
    
    // Try to load from cache first for instant display (unless refreshing)
    let cached: CommunityListItem[] | null = null;
    if (!skipCache) {
      cached = await loadFromCache();
      if (cached) {
        setCommunities(cached);
        const categoriesSet = new Set<string>();
        cached.forEach(community => {
          (community.categories || []).forEach(cat => categoriesSet.add(cat));
        });
        setAllCategories(Array.from(categoriesSet).sort());
        setLoading(false);
      }
    }

    // Then fetch fresh data in background
    try {
      const snapshot = await fetchWithTimeout(8000) as any;
      const results: CommunityListItem[] = [];
      const categoriesSet = new Set<string>();
      
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        const categories: string[] = data.categories || [];
        categories.forEach(cat => categoriesSet.add(cat));
        results.push({
          id: docSnap.id,
          name: data.name || "Unnamed Community",
          description: data.description || "",
          logo: data.logo || undefined,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          location: data.location || undefined, 
          categories: categories, 
        });
      });
      
      results.sort((a, b) => a.name.localeCompare(b.name));
      setCommunities(results);
      await saveToCache(results);

      const sortedCategories = Array.from(categoriesSet).sort();
      setAllCategories(sortedCategories);

      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      // Only log error if we don't have cached data
      if (!cached) {
        console.error("Error fetching communities:", err);
      }
      
      // If we have cached data, show it even if fetch failed (silently)
      if (cached && !skipCache) {
        // Don't show error if we have cached data - it's working fine
        setError(null);
      } else {
        // Only show error if we have no cached data
        if (err?.message?.includes("timeout") || err?.message?.includes("Request timeout")) {
          setError("Connection timeout. Please check your internet connection.");
        } else {
          setError("Failed to load communities. Please try again.");
        }
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCommunities(true); // Skip cache on refresh
  }, [fetchCommunities]);

  // Get user location and joined communities when screen is focused (optimized)
  useFocusEffect(
    useCallback(() => {
      // Load cached city first
      const loadCachedCity = async () => {
        try {
          const cached = await AsyncStorage.getItem("cached_user_city");
          if (cached) {
            setUserCity(cached);
          }
        } catch (err) {
          // Ignore cache errors
        }
      };

      // Get user location (non-blocking, with timeout)
      const getLocation = async () => {
        try {
          // Try location with timeout
          const locationPromise = (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            let city: string | null = null;
            if (status === 'granted') {
              let location = await Location.getCurrentPositionAsync({
                timeout: 5000, // 5 second timeout
              });
              let [place] = await Location.reverseGeocodeAsync(location.coords);
              city = place?.city || place?.region || null;
            }
            if (!city) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              try {
                const resp = await fetch('https://ipinfo.io/json?token=9f064f7b5ecf4d', {
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);
                const data = await resp.json();
                city = data.city || data.region || null;
              } catch (fetchErr) {
                clearTimeout(timeoutId);
                // If fetch fails, city remains null
              }
            }
            return city;
          })();

          const timeoutPromise = new Promise<string | null>((resolve) =>
            setTimeout(() => resolve(null), 5000)
          );

          const city = await Promise.race([locationPromise, timeoutPromise]);
          if (city) {
            setUserCity(city);
            await AsyncStorage.setItem("cached_user_city", city);
          }
        } catch (err) {
          console.error("Error getting location:", err);
          // Don't set to null if we have cached city
        }
      };

      // Get user auth state and joined communities (with timeout)
      const unsubAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUid(user.uid);
          try {
            // Use timeout for user data fetch
            const userRef = doc(db, "users", user.uid);
            const fetchPromise = getDoc(userRef);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 5000)
            );
            
            const userSnap = await Promise.race([fetchPromise, timeoutPromise]) as any;
            if (userSnap && userSnap.exists()) {
              const userData = userSnap.data();
              setJoinedCommunityIds(new Set(userData.joinedCommunities || []));
            } else {
              setJoinedCommunityIds(new Set());
            }
          } catch (err: any) {
            // Only log if it's not a timeout (timeouts are expected with slow connections)
            if (!err?.message?.includes("Timeout") && !err?.message?.includes("timeout")) {
              console.error("Error fetching user data:", err);
            }
            // Gracefully handle - just use empty set, user can still browse
            setJoinedCommunityIds(new Set());
          }
        } else {
          setUid(null);
          setJoinedCommunityIds(new Set());
        }
      });

      // Load cached city immediately, then fetch fresh location in background
      loadCachedCity();
      getLocation(); // Non-blocking
      
      return () => unsubAuth(); // Cleanup auth listener
    }, [])
  );
// Handle opening a community and save it as recently visited
const handleOpenCommunity = async (community: CommunityListItem) => {
  try {
    await AsyncStorage.setItem("recentCommunityId", community.id);
  } catch (err) {
    console.warn("Failed to save recent community:", err);
  }

  navigation.navigate("CommunityDetailScreen", { community });
};

// Explore Communities: exclude already joined ones
const exploreCommunities = useMemo(() => {
  const normalizedQuery = searchQuery.toLowerCase();

  let filtered = communities.filter((community) => {
    const searchMatch =
      !normalizedQuery ||
      community.name.toLowerCase().includes(normalizedQuery) ||
      (community.description?.toLowerCase().includes(normalizedQuery) ?? false);

    const categoryMatch =
      !selectedCategory ||
      (community.categories?.includes(selectedCategory) ?? false);

    // ✅ Exclude joined communities and ones created by current user
    const notJoinedOrCreated =
      !joinedCommunityIds.has(community.id) && community.createdBy !== uid;

    return searchMatch && categoryMatch && notJoinedOrCreated;
  });

  // ✅ Prioritize communities near user’s city
  if (userCity) {
    const normalizedCity = userCity.toLowerCase();
    const localCommunities = filtered.filter((c) =>
      c.location?.toLowerCase().includes(normalizedCity)
    );
    const restCommunities = filtered.filter(
      (c) => !c.location?.toLowerCase().includes(normalizedCity)
    );
    return [...localCommunities, ...restCommunities];
  }

  return filtered;
}, [communities, searchQuery, selectedCategory, userCity, joinedCommunityIds, uid]);

// My Communities: prioritize recently visited
const myCommunities = useMemo(() => {
  if (!uid) return [];

  const filtered = communities.filter(
    (c) => c.createdBy === uid || joinedCommunityIds.has(c.id)
  );

  const normalizedQuery = searchQuery.toLowerCase();
  let result = !normalizedQuery
    ? filtered
    : filtered.filter(
        (community) =>
          community.name.toLowerCase().includes(normalizedQuery) ||
          (community.description?.toLowerCase().includes(normalizedQuery) ?? false)
      );

  // Prioritize recently visited
  const sortWithRecent = async () => {
    const recentId = await AsyncStorage.getItem("recentCommunityId");
    if (recentId) {
      result.sort((a, b) =>
        a.id === recentId ? -1 : b.id === recentId ? 1 : 0
      );
    }
  };
  sortWithRecent();

  return result;
}, [communities, uid, joinedCommunityIds, searchQuery]);
  // This useEffect now works because myCommunities is defined above
  useEffect(() => {
    if (uid && myCommunities.length > 0) {
      setRoutes([
        { key: 'explore', title: 'Explore' },
        { key: 'myCommunities', title: 'My Communities' },
      ]);
    } else {
      setRoutes([{ key: 'explore', title: 'Explore' }]);
    }
  }, [uid, myCommunities]); // Dependency fixed to myCommunities

  // Reusable card renderer
  const renderCommunityCard = ({ item }: { item: CommunityListItem }) => {
    const initials = item.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .substring(0,2)
      .toUpperCase();

    return (
      <TouchableOpacity
        style={styles.communityCard}
        onPress={() => handleOpenCommunity(item)}
      >
        {item.logo ? (
          <Image
            source={{ uri: item.logo }}
            style={styles.communityLogo}
          />
        ) : (
          <View
            style={{
              width: styles.communityLogo.width,
              height: styles.communityLogo.height,
              borderRadius: styles.communityLogo.width / 2,
              backgroundColor: colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: FONT_SIZES.large,
                fontWeight: 'bold',
              }}
            >
              {initials}
            </Text>
          </View>
        )}
        <View style={styles.communityCardContent}>
          <Text style={styles.communityCardTitle}>{item.name}</Text>
          <Text style={styles.lastMessagePreview} numberOfLines={1}>
            {item.description || "No description available."}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Tab Components
  const ExploreRoute = () => (
    <View style={{ flex: 1 }}>
      {/* Category Filter */}
      <View style={styles.categoryListContainer}>
        <FlatList
          data={["All", ...allCategories]}
          renderItem={({ item: category }) => {
            const isAllButton = category === "All";
            const isActive = (isAllButton && selectedCategory === null) || (selectedCategory === category);
            return (
              <TouchableOpacity
                style={[ styles.categoryButton, isActive && styles.categoryButtonActive ]}
                onPress={() => setSelectedCategory(isAllButton ? null : category)}
              >
                <Text style={[ styles.categoryButtonText, isActive && styles.categoryButtonTextActive ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          }}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      </View>

      {/* Location Text */}
      {userCity && (
        <Text style={{
                      textAlign: 'center',
                      color: colors.primary,
                      fontWeight: 'bold',
                      fontSize: FONT_SIZES.medium,
                      marginTop: 6,
                      marginBottom: 8
                    }}>
          Prioritizing communities near {userCity}
        </Text>
      )}

      {/* Error Message */}
      {error && (
        <Text style={[globalStyles.loadingOverlayText, { color: colors.error }]}> 
          {error}
        </Text>
      )}

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.activityIndicatorContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading communities...</Text>
        </View>
      ) : (
        <FlatList
          nestedScrollEnabled
          style={styles.scrollViewContent}
          data={exploreCommunities} // Use explore list
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.communityListRow}
          renderItem={renderCommunityCard} // Use reusable function
          ListEmptyComponent={
            <Text style={styles.noResultsText}>No communities found.</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );

  const MyCommunitiesRoute = () => (
    <View style={{ flex: 1 }}>
      {loading && !refreshing ? (
        <View style={styles.activityIndicatorContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          nestedScrollEnabled
          style={styles.scrollViewContent}
          data={myCommunities} // Use my communities list
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.communityListRow}
          renderItem={renderCommunityCard} // Use reusable function
          ListEmptyComponent={
            <Text style={styles.noResultsText}>You haven't joined or created any communities.</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );

  const renderScene = SceneMap({
    explore: ExploreRoute,
    myCommunities: MyCommunitiesRoute,
  });
  
  const Wrapper = Platform.OS === 'web'
    ? View
    : require('react-native').SafeAreaView || View;

  return (
    <Wrapper style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <Text style={styles.pageTitle}>Communities</Text>
        </View>

        <TextInput
          style={styles.searchBar}
          placeholder="Search communities..."
          placeholderTextColor={colors.placeholderText as string}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* --- This is the new TabView --- */}
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: Dimensions.get('window').width }}
renderTabBar={(props) => (
            <TabBar
              {...props as any}
              style={{
                backgroundColor: colors.background,
                elevation: 0,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderColor,
              }}
              indicatorStyle={{ height: 3, backgroundColor: colors.primary }}
              activeColor={colors.primary}
              inactiveColor={colors.secondaryText}
              
              // --- THIS IS THE CORRECTED BLOCK ---
              renderLabel={({ route, focused, color }: {
                route: { key: string; title: string };
                focused: boolean;
                color: string;
              }) => (
                <Text style={{ color, fontWeight: 'bold' }}>
                  {route.title}
                </Text>
              )}
              // --- END OF FIX ---
            />
          )}
        />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateCommunityScreen")}
      >
        <Ionicons name="add" size={32} color={colors.buttonText} />
      </TouchableOpacity>
    </Wrapper>
  );
};

export default CommunityScreen;