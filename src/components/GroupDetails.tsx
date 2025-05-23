import React, { useState } from 'react';
import { Group } from '../types';

interface GroupDetailsProps {
  group: Group;
  userRole: 'student' | 'instructor';
  userId: number;
  onFeedbackSubmit: (groupId: number, feedback: string, rating?: number) => void;
}

const GroupDetails: React.FC<GroupDetailsProps> = ({ group, userRole, userId, onFeedbackSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    onFeedbackSubmit(group.id, feedback, rating);
    setFeedback('');
    setRating(undefined);
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="text-lg font-semibold">{group.name}</h3>
      <p><strong>Members:</strong> {group.members.join(', ')}</p>
      <p><strong>Skills:</strong> {group.matching_skills.join(', ')}</p>
      <p><strong>Study Time:</strong> {group.study_time}</p>
      {group.feedback.length > 0 && (
        <div>
          <h4 className="text-md font-semibold">Feedback:</h4>
          <ul>
            {group.feedback.map(f => (
              <li key={f.id}>{f.content} {f.rating && `(${f.rating}/5)`}</li>
            ))}
          </ul>
        </div>
      )}
      {userRole === 'student' && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Add feedback"
            className="w-full p-2 border rounded"
          />
          <div>
            <label>Rating (1-5):</label>
            <input
              type="number"
              min="1"
              max="5"
              value={rating || ''}
              onChange={(e) => setRating(parseInt(e.target.value))}
              className="w-16 p-1 border rounded"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Submit Feedback
          </button>
        </form>
      )}
    </div>
  );
};

export default GroupDetails;