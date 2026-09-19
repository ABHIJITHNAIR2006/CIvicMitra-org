import { UserProfile } from "../types";

export interface FollowData {
  following: string[];
  followers: string[];
}

export interface SocialState {
  all_users: any[];
  current_user: any | null;
  follows: { [userId: string]: FollowData };
  dismissed_recommendations: string[];
}

const STORAGE_KEYS = {
  ALL_USERS: "all_users",
  CURRENT_USER: "current_user",
  FOLLOWS: "follows",
  DISMISSED: "dismissed_recommendations",
};

export const getSocialState = (): SocialState => {
  const all_users = JSON.parse(localStorage.getItem(STORAGE_KEYS.ALL_USERS) || "[]");
  const current_user = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || "null");
  const follows = JSON.parse(localStorage.getItem(STORAGE_KEYS.FOLLOWS) || "{}");
  const dismissed_recommendations = JSON.parse(localStorage.getItem(STORAGE_KEYS.DISMISSED) || "[]");

  return { all_users, current_user, follows, dismissed_recommendations };
};

export const syncUserToAllUsers = (user: any) => {
  const { all_users } = getSocialState();
  const index = all_users.findIndex((u) => u.id === user.id || u.uid === user.uid);
  
  const userData = {
    id: user.uid || user.id,
    uid: user.uid || user.id,
    name: user.fullName || user.name || user.username,
    email: user.email,
    college: user.city || user.college || "Eco-Warrior",
    points: user.points || 0,
    events_registered: user.events_registered || [],
    joined_at: user.createdAt || new Date().toISOString(),
    avatar_initial: (user.fullName || user.name || user.username || "?")[0].toUpperCase(),
  };

  if (index > -1) {
    all_users[index] = { ...all_users[index], ...userData };
  } else {
    all_users.push(userData);
  }

  localStorage.setItem(STORAGE_KEYS.ALL_USERS, JSON.stringify(all_users));
};

export const setCurrentSocialUser = (user: any | null) => {
  if (user) {
    const userData = {
      id: user.uid || user.id,
      uid: user.uid || user.id,
      name: user.fullName || user.name || user.username,
      email: user.email,
      college: user.city || user.college || "Eco-Warrior",
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userData));
    syncUserToAllUsers(user);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
};

export const followUser = (currentUserId: string, targetUserId: string) => {
  const { follows } = getSocialState();
  
  if (!follows[currentUserId]) follows[currentUserId] = { following: [], followers: [] };
  if (!follows[targetUserId]) follows[targetUserId] = { following: [], followers: [] };

  if (!follows[currentUserId].following.includes(targetUserId)) {
    follows[currentUserId].following.push(targetUserId);
  }
  if (!follows[targetUserId].followers.includes(currentUserId)) {
    follows[targetUserId].followers.push(currentUserId);
  }

  localStorage.setItem(STORAGE_KEYS.FOLLOWS, JSON.stringify(follows));
};

export const unfollowUser = (currentUserId: string, targetUserId: string) => {
  const { follows } = getSocialState();
  
  if (follows[currentUserId]) {
    follows[currentUserId].following = follows[currentUserId].following.filter(id => id !== targetUserId);
  }
  if (follows[targetUserId]) {
    follows[targetUserId].followers = follows[targetUserId].followers.filter(id => id !== currentUserId);
  }

  localStorage.setItem(STORAGE_KEYS.FOLLOWS, JSON.stringify(follows));
};

export const dismissRecommendation = (userId: string) => {
  const { dismissed_recommendations } = getSocialState();
  if (!dismissed_recommendations.includes(userId)) {
    dismissed_recommendations.push(userId);
    localStorage.setItem(STORAGE_KEYS.DISMISSED, JSON.stringify(dismissed_recommendations));
  }
};

export const getFollowStats = (userId: string) => {
  const { follows } = getSocialState();
  return follows[userId] || { following: [], followers: [] };
};

export const getRecommendations = (currentUserId: string) => {
  const { all_users, follows, dismissed_recommendations } = getSocialState();
  const currentUser = all_users.find(u => u.id === currentUserId);
  const myFollowing = follows[currentUserId]?.following || [];

  return all_users
    .filter(u => u.id !== currentUserId && !myFollowing.includes(u.id) && !dismissed_recommendations.includes(u.id))
    .map(u => {
      let reason = "🆕 New Member";
      let mutualCount = 0;

      // Mutual connections logic
      const theirFollowers = follows[u.id]?.followers || [];
      mutualCount = theirFollowers.filter(id => myFollowing.includes(id)).length;

      if (currentUser?.college && u.college === currentUser.college) {
        reason = "📚 Same College";
      } else if (mutualCount > 0) {
        reason = "👥 Mutual Connection";
      } else if (Math.abs((u.points || 0) - (currentUser?.points || 0)) < 100) {
        reason = "⭐ Similar Level";
      }

      return { ...u, reason, mutualCount };
    })
    .sort((a, b) => {
      const priority: any = { "📚 Same College": 0, "👥 Mutual Connection": 1, "⭐ Similar Level": 2, "🆕 New Member": 3 };
      return priority[a.reason] - priority[b.reason];
    });
};
