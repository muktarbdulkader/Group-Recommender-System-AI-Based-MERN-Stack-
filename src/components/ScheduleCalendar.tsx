import React, { useState, useEffect } from 'react';
import { Schedule } from '../types';

interface ScheduleCalendarProps {
  userRole: 'student' | 'instructor';
  groupId: number;
}

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ userRole, groupId }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newSchedule, setNewSchedule] = useState({
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    agenda: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, [groupId]);

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`/api/schedules?groupId=${groupId}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Fetch schedules error:', err);
      setError(`Failed to fetch schedules: ${errorMessage}`);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'instructor') {
      setError('Instructors cannot add schedules.');
      return;
    }
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSchedule, groupId }),
      });
      if (!res.ok) throw new Error('Failed to add schedule');
      setNewSchedule({ date: '', startTime: '', endTime: '', location: '', agenda: '' });
      await fetchSchedules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Add schedule error:', err);
      setError(`Failed to add schedule: ${errorMessage}`);
    }
  };

  return (
    <div className="mb-6 p-4 bg-white rounded shadow">
      <h3 className="text-lg font-semibold mb-2">Group Schedules</h3>
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>
      )}
      {schedules.length > 0 ? (
        <ul className="space-y-2">
          {schedules.map(schedule => (
            <li key={schedule.id} className="border-b py-2">
              <p><strong>Date:</strong> {schedule.date}</p>
              <p><strong>Time:</strong> {schedule.startTime} - {schedule.endTime}</p>
              <p><strong>Location:</strong> {schedule.location || 'N/A'}</p>
              <p><strong>Agenda:</strong> {schedule.agenda || 'N/A'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No sessions scheduled.</p>
      )}
      {userRole === 'student' && (
        <form onSubmit={handleAddSchedule} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={newSchedule.date}
              onChange={(e) => setNewSchedule({ ...newSchedule, date: e.target.value })}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Time</label>
            <input
              type="time"
              value={newSchedule.startTime}
              onChange={(e) => setNewSchedule({ ...newSchedule, startTime: e.target.value })}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Time</label>
            <input
              type="time"
              value={newSchedule.endTime}
              onChange={(e) => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              value={newSchedule.location}
              onChange={(e) => setNewSchedule({ ...newSchedule, location: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Agenda</label>
            <input
              type="text"
              value={newSchedule.agenda}
              onChange={(e) => setNewSchedule({ ...newSchedule, agenda: e.target.value })}
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Add Schedule
          </button>
        </form>
      )}
    </div>
  );
};

export default ScheduleCalendar;