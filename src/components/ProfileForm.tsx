import React from 'react';
import { UserProfile } from '../types';

interface ProfileFormProps {
  profile: UserProfile;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent, updateSkills: boolean) => void;
  isLoading?: boolean;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onChange, onSubmit, isLoading }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.skills.length) {
      alert('Please enter at least one skill (e.g., python, javascript, java).');
      return;
    }
    onSubmit(e, true);
  };

  return (
    <div className="mb-6 p-6 bg-white rounded-lg shadow-lg backdrop-blur-sm bg-opacity-80">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Update Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            name="name"
            value={profile.name}
            onChange={onChange}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your name"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="email"
            value={profile.email}
            onChange={onChange}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Skills
            <span className="ml-1 text-gray-500" title="Enter skills separated by commas">ℹ️</span>
          </label>
          <input
            type="text"
            name="skills"
            value={profile.skills.join(', ')}
            onChange={onChange}
            list="skills"
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., python, javascript, java"
            disabled={isLoading}
          />
          <datalist id="skills">
            <option value="python" />
            <option value="javascript" />
            <option value="java" />
            <option value="react" />
            <option value="flask" />
            <option value="spring" />
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Interests</label>
          <input
            type="text"
            name="interests"
            value={profile.interests.join(', ')}
            onChange={onChange}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., AI, Web Development"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Availability</label>
          <input
            type="text"
            name="availability"
            value={profile.availability.join(', ')}
            onChange={onChange}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Mon 10-12, Wed 14-16"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

export default ProfileForm;
