import React, { useState, useEffect } from 'react';
import ProfileForm from './components/ProfileForm';
import GroupDetails from './components/GroupDetails';
import ScheduleCalendar from './components/ScheduleCalendar';
import { User, UserProfile, Group } from './types';
import ErrorBoundary from './components/ErrorBoundary';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [skillStats, setSkillStats] = useState<{ grouped: number; ungrouped: number }>({ grouped: 0, ungrouped: 0 });
  const [skillDistribution, setSkillDistribution] = useState<{ skill: string; count: number }[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === 'instructor') {
      fetchGroups();
      fetchSkillStats();
      fetchSkillDistribution();
    } else if (user && user.role === 'student' && profile) {
      fetchGroups();
    }
  }, [user, profile]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const fetchedGroups = data.groups || [];
      console.log('Fetched groups:', fetchedGroups);
      setGroups(fetchedGroups);
      if (user && user.role === 'student' && profile) {
        const userGroups = fetchedGroups.filter((g: Group) =>
          g.members.map(m => m.toLowerCase().trim()).includes(profile.name.toLowerCase().trim())
        );
        if (userGroups.length === 0) {
          setError('No groups match your skills. Try adding skills like python, javascript, or java.');
          setTimeout(() => setError(null), 6000);
        } else {
          setError(null);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Fetch groups error:', err);
      setError(`Failed to fetch groups: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSkillStats = async () => {
    try {
      const res = await fetch('/api/skill-match-stats');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setSkillStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Fetch skill stats error:', err);
      setError(`Failed to fetch skill stats: ${errorMessage}`);
    }
  };

  const fetchSkillDistribution = async () => {
    try {
      const res = await fetch('/api/skill-distribution');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setSkillDistribution(data.skills || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Fetch skill distribution error:', err);
      setError(`Failed to fetch skill distribution: ${errorMessage}`);
    }
  };

  const reinitializeGroups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reinitialize-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to reinitialize groups');
      await fetchGroups();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Reinitialize groups error:', err);
      setError(`Failed to reinitialize groups: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(isRegistering ? '/api/register' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: isRegistering ? name : undefined }),
      });
      if (!res.ok) throw new Error(isRegistering ? 'Registration failed' : 'Login failed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUser(data.user);
      if (data.user.role === 'student') {
        setProfile({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name.trim(),
          skills: data.user.skills?.map((s: string) => s.trim().toLowerCase()) || [],
          interests: data.user.interests || [],
          availability: data.user.availability || [],
          role: 'student',
        });
        if (data.matched_group) {
          setGroups([data.matched_group]);
        }
        if (isRegistering) {
          await reinitializeGroups();
        }
        await fetchGroups();
      }
      setEmail('');
      setName('');
      setIsRegistering(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Authentication error:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => (prev ? {
      ...prev,
      [name]: value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    } : prev));
  };

  const handleProfileSubmit = async (e: React.FormEvent, updateSkills: boolean) => {
    e.preventDefault();
    if (!user || !profile) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, id: user.id, updateSkills }),
      });
      if (!res.ok) throw new Error('Profile update failed');
      const data = await res.json();
      setProfile({
        ...profile,
        skills: profile.skills.map(s => s.trim().toLowerCase()).filter(Boolean),
        interests: profile.interests.map(i => i.trim()).filter(Boolean),
        availability: profile.availability.map(a => a.trim()).filter(Boolean),
      });
      if (data.matched_group) {
        setGroups([data.matched_group]);
      }
      await reinitializeGroups();
      await fetchGroups();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Profile update error:', err);
      setError(`Profile update failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedbackSubmit = async (groupId: number, feedback: string, rating?: number) => {
    if (!feedback.trim()) {
      setError('Feedback cannot be empty.');
      return;
    }
    if (!user) return;
    try {
      const res = await fetch(`/api/feedback/${groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, rating, userId: user.id }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const updatedGroups = groups.map(g =>
        g.id === groupId ? { ...g, feedback: [...g.feedback, data.feedback] } : g
      );
      setGroups(updatedGroups);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Feedback submission error:', err);
      setError(`Failed to submit feedback: ${errorMessage}`);
    }
  };

  const handleEvaluate = () => {
    fetchGroups();
    fetchSkillStats();
    fetchSkillDistribution();
  };

  const handleLogout = () => {
    setUser(null);
    setProfile(null);
    setGroups([]);
    setSkillStats({ grouped: 0, ungrouped: 0 });
    setSkillDistribution([]);
    setEmail('');
    setName('');
    setIsRegistering(false);
    setError(null);
    localStorage.removeItem('user');
  };

  const skillChartData = {
    labels: skillDistribution.map(s => s.skill),
    datasets: [
      {
        label: 'Skill Distribution',
        data: skillDistribution.map(s => s.count),
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="container mx-auto p-4 bg-gradient-to-br from-gray-100 to-gray-200 min-h-screen">
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded shadow">
          {error}
        </div>
      )}
      {isLoading && (
        <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded shadow">
          Loading groups...
        </div>
      )}
      {!user ? (
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg backdrop-blur-sm bg-opacity-80">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">
            {isRegistering ? 'Register' : 'Login'}
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
            </div>
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={isLoading}
                />
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : isRegistering ? 'Register' : 'Login'}
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-blue-600 hover:underline"
              disabled={isLoading}
            >
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
            </button>
            <button
              type="button"
              onClick={() => setUser({ id: 0, name: 'Instructor', email: 'instructor@example.com', role: 'instructor' })}
              className="w-full text-blue-600 hover:underline"
              disabled={isLoading}
            >
              Login as Instructor
            </button>
          </form>
        </div>
      ) : user.role === 'student' && profile ? (
        <>
          <div className="mb-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Welcome, {profile.name}</h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
          <ErrorBoundary>
            <ProfileForm
              profile={profile}
              onSubmit={handleProfileSubmit}
              onChange={handleProfileChange}
              isLoading={isLoading}
            />
          </ErrorBoundary>
          <div className="mb-6 p-6 bg-white rounded-lg shadow-lg backdrop-blur-sm bg-opacity-80">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Recommended Groups</h2>
            {isLoading ? (
              <p className="text-gray-600">Loading groups...</p>
            ) : groups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups
                  .filter(group => group.members.map(m => m.toLowerCase().trim()).includes(profile.name.toLowerCase().trim()))
                  .map((group) => (
                    <div key={group.id} className="p-4 border rounded-lg bg-gray-50 hover:shadow-md transition">
                      <GroupDetails
                        group={group}
                        userRole="student"
                        userId={user.id}
                        onFeedbackSubmit={handleFeedbackSubmit}
                      />
                      <ScheduleCalendar userRole="student" groupId={group.id} />
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-600">No groups available. Update your profile with skills like python, javascript, or java.</p>
            )}
          </div>
        </>
      ) : (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Instructor Dashboard</h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
          <button
            onClick={handleEvaluate}
            className="mb-4 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition"
            disabled={isLoading}
          >
            Refresh Evaluation
          </button>
          <div className="mb-6 p-6 bg-white rounded-lg shadow-lg backdrop-blur-sm bg-opacity-80">
            <h3 className="text-lg font-bold mb-2 text-gray-800">Skill Match Stats</h3>
            <p>Grouped Students: {skillStats.grouped}</p>
            <p>Ungrouped Students: {skillStats.ungrouped}</p>
          </div>
          <div className="mb-6 p-6 bg-white rounded-lg shadow-lg backdrop-blur-sm bg-opacity-80">
            <h3 className="text-lg font-bold mb-2 text-gray-800">Skill Distribution</h3>
            <Bar data={skillChartData} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 text-gray-800">Study Groups</h3>
            {groups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((group) => (
                  <div key={group.id} className="p-4 border rounded-lg bg-gray-50 hover:shadow-md transition">
                    <GroupDetails
                      group={group}
                      userRole="instructor"
                      userId={user.id}
                      onFeedbackSubmit={() => {}}
                    />
                    <ScheduleCalendar userRole="instructor" groupId={group.id} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No groups formed yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;